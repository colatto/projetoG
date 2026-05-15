import PgBoss from 'pg-boss';
import { CreditorClient } from '@projetog/integration-sienge';
import {
  mapCreditorToSupplier,
  mapCreditorContacts,
  extractCreditorEmail,
} from '@projetog/integration-sienge';
import {
  IntegrationEventType,
  IntegrationDirection,
  IntegrationEntityType,
  SyncResourceType,
  SyncStatus,
} from '@projetog/domain';
import { sanitizeForLog } from '@projetog/shared';
import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';

const JOB_NAME = 'sienge:sync-creditors';

/**
 * Sync creditors handler.
 * Polls GET /creditors with pagination, enriches the local `suppliers`
 * table with real names, trade names, creditor IDs, and upserts contacts
 * into `supplier_contacts`.
 *
 * This is the CANONICAL source for supplier enrichment. sync-orders
 * only creates minimal stubs to satisfy FK constraints.
 *
 * PRD-07 §7.1, RN-05
 */
export async function processSyncCreditors(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const context = { correlationId, source: 'worker' as const };
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const creditorClient = new CreditorClient(siengeClient);

  console.log(`[${JOB_NAME}] Starting sync. CorrelationId: ${correlationId}`);

  // ── Step 1: Check/update sync cursor ──────────────────────────
  const { data: cursor } = await supabase
    .from('sienge_sync_cursor')
    .select('*')
    .eq('resource_type', SyncResourceType.CREDITORS)
    .single();

  if (cursor?.sync_status === SyncStatus.RUNNING) {
    const updatedAt = new Date(cursor.last_synced_at ?? 0);
    const now = new Date();
    const diffMins = (now.getTime() - updatedAt.getTime()) / 60000;

    if (diffMins > 60) {
      console.warn(
        `[${JOB_NAME}] Dead lock detected. Forcing unlock. CorrelationId: ${correlationId}`,
      );
      await supabase
        .from('sienge_sync_cursor')
        .update({ sync_status: SyncStatus.ERROR, error_message: 'Timeout lock' })
        .eq('resource_type', SyncResourceType.CREDITORS);
    } else {
      console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
      return;
    }
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.CREDITORS);

  try {
    let currentOffset = cursor?.last_offset || 0;

    const pageLimit = 100;
    let hasMore = true;
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalEnriched = 0;
    let totalBlocked = 0;
    const errorDetails: Array<{ creditorId: number | string; error: string }> = [];

    // ── Step 2: Process pages incrementally ────────────────────────
    while (hasMore) {
      const page = await creditorClient.listPaged(
        {
          limit: pageLimit,
          offset: currentOffset,
        },
        context,
      );

      const creditors = page.results || [];
      console.log(
        `[${JOB_NAME}] Fetched ${creditors.length} creditors (offset ${currentOffset}). CorrelationId: ${correlationId}`,
      );

      // ── Step 3: Process each creditor ────────────────────────────
      for (const creditor of creditors) {
        try {
          // The creditorId from /creditors IS the supplierId used in orders/quotations
          // per the real Sienge API behavior (§17.1).
          // We use creditorId as the supplier PK.
          const supplierId = creditor.creditorId;

          // Map creditor to local supplier
          const localSupplier = mapCreditorToSupplier(creditor, supplierId);

          // Extract email and determine access status (RN-05)
          const emailResult = extractCreditorEmail(creditor);
          localSupplier.accessStatus = emailResult.hasValidEmail ? 'ACTIVE' : 'BLOCKED';

          if (!emailResult.hasValidEmail) {
            totalBlocked++;
          }

          // Upsert supplier (overwrite generic stubs from sync-orders)
          const { error: supplierUpsertError } = await supabase.from('suppliers').upsert(
            {
              id: localSupplier.id,
              creditor_id: localSupplier.creditorId,
              name: localSupplier.name,
              trade_name: localSupplier.tradeName,
              access_status: localSupplier.accessStatus,
            },
            { onConflict: 'id' },
          );

          if (supplierUpsertError) {
            throw new Error(
              `Supplier upsert failed for creditor ${creditor.creditorId}: ${supplierUpsertError.message}`,
            );
          }

          // Map and upsert supplier contacts
          const localContacts = mapCreditorContacts(creditor, supplierId);

          if (localContacts.length > 0) {
            // Delete existing contacts for this supplier and re-insert
            // (safer than upsert without unique constraint on supplier_id+email)
            const { error: deleteError } = await supabase
              .from('supplier_contacts')
              .delete()
              .eq('supplier_id', supplierId);

            if (deleteError) {
              console.warn(
                `[${JOB_NAME}] Contact cleanup warning for supplier ${supplierId}: ${deleteError.message}. CorrelationId: ${correlationId}`,
              );
            }

            for (const contact of localContacts) {
              const { error: contactUpsertError } = await supabase
                .from('supplier_contacts')
                .upsert(
                  {
                    supplier_id: contact.supplierId,
                    name: contact.name,
                    email: contact.email,
                    is_primary: contact.isPrimary,
                  },
                  { onConflict: 'supplier_id,email' },
                );

              if (contactUpsertError) {
                console.warn(
                  `[${JOB_NAME}] Contact upsert warning for supplier ${supplierId} email ${contact.email}: ${contactUpsertError.message}. CorrelationId: ${correlationId}`,
                );
              }
            }
          }

          totalEnriched++;
          totalProcessed++;
        } catch (creditorError: unknown) {
          totalErrors++;
          const err = creditorError as { message?: string };
          errorDetails.push({
            creditorId: creditor.creditorId,
            error: err.message ?? 'Unknown error',
          });
          console.error(
            `[${JOB_NAME}] Failed to process creditor ${creditor.creditorId}: ${err.message}. CorrelationId: ${correlationId}`,
          );
        }
      }

      // Check if we need to fetch more
      const totalCount = page.resultSetMetadata?.count ?? 0;
      currentOffset += pageLimit;
      hasMore = currentOffset < totalCount;

      // Checkpoint: save offset per page
      await supabase
        .from('sienge_sync_cursor')
        .update({
          last_offset: currentOffset,
          error_message: null,
        })
        .eq('resource_type', SyncResourceType.CREDITORS);
    }

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_CREDITOR,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/creditors',
      http_method: 'GET',
      http_status: 200,
      status: totalErrors === 0 ? 'success' : 'failure',
      request_payload: sanitizeForLog({
        finalOffset: currentOffset,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        enriched: totalEnriched,
        blocked: totalBlocked,
        errors: totalErrors,
        ...(errorDetails.length > 0 ? { errorSamples: errorDetails.slice(0, 5) } : {}),
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.CREDITOR,
      retry_count: 0,
      max_retries: 5,
    });

    // ── Step 5: Update sync cursor (Done) ───────────────────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.IDLE,
        last_synced_at: new Date().toISOString(),
        last_offset: 0,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.CREDITORS);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Enriched: ${totalEnriched}, Blocked: ${totalBlocked}, Errors: ${totalErrors}. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.ERROR,
        error_message: err.message ?? 'Unknown error',
      })
      .eq('resource_type', SyncResourceType.CREDITORS);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_CREDITOR,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/creditors',
      http_method: 'GET',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      related_entity_type: IntegrationEntityType.CREDITOR,
      retry_count: 0,
      max_retries: 5,
    });

    console.error(`[${JOB_NAME}] Failed: ${err.message}. CorrelationId: ${correlationId}`);
    throw error; // Let pg-boss handle retry (Camada 2)
  }
}
