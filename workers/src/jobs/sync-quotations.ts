import PgBoss from 'pg-boss';
import { QuotationClient, CreditorClient } from '@projetog/integration-sienge';
import {
  mapQuotationToLocal,
  mapSupplierNegotiationsToLocal,
  mapNegotiationItemsToLocal,
  extractCreditorEmail,
  mapCreditorToSupplier,
  mapCreditorContacts,
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

const JOB_NAME = 'sienge:sync-quotations';
const DEFAULT_QUOTATION_LOOKBACK_MONTHS = 6;

function formatDateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildQuotationWindow(lastSyncedAt?: string | null): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = formatDateOnly(now);

  if (lastSyncedAt) {
    const lastSynced = new Date(lastSyncedAt);
    if (!Number.isNaN(lastSynced.getTime()) && lastSynced.getTime() > 0) {
      lastSynced.setHours(lastSynced.getHours() - 1);
      return {
        startDate: formatDateOnly(lastSynced),
        endDate,
      };
    }
  }

  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - DEFAULT_QUOTATION_LOOKBACK_MONTHS);

  return {
    startDate: formatDateOnly(startDate),
    endDate,
  };
}

/**
 * Sync quotations handler.
 * Polls GET /purchase-quotations/all/negotiations with pagination,
 * resolves creditor emails, and upserts into the local database.
 *
 * PRD-07 §6.1, §9.3.1, RN-05
 */
export async function processSyncQuotations(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const context = { correlationId, source: 'worker' as const };
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const quotationClient = new QuotationClient(siengeClient);
  const creditorClient = new CreditorClient(siengeClient);

  console.log(`[${JOB_NAME}] Starting sync. CorrelationId: ${correlationId}`);

  // ── Step 1: Check/update sync cursor ──────────────────────────
  const { data: cursor } = await supabase
    .from('sienge_sync_cursor')
    .select('*')
    .eq('resource_type', SyncResourceType.QUOTATIONS)
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
        .eq('resource_type', SyncResourceType.QUOTATIONS);
    } else {
      console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
      return;
    }
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.QUOTATIONS);

  const quotationWindow = buildQuotationWindow(cursor?.last_synced_at);

  try {
    let currentOffset = cursor?.last_offset || 0;

    // requires_full_sync was removed from DB. If needed, implement custom logic.
    if (false) {
      console.log(`[${JOB_NAME}] Full resync requested. CorrelationId: ${correlationId}`);
      currentOffset = 0;
    }

    const pageLimit = 50;
    let hasMore = true;
    let totalProcessed = 0;
    let totalErrors = 0;

    // ── Step 2: Process pages incrementally ────────────────────────
    while (hasMore) {
      const page = await quotationClient.listNegotiationsPaged(
        {
          limit: pageLimit,
          offset: currentOffset,
          startDate: quotationWindow.startDate,
          endDate: quotationWindow.endDate,
        },
        context,
      );

      const negotiations = page.results || [];
      console.log(
        `[${JOB_NAME}] Fetched ${negotiations.length} negotiations (offset ${currentOffset}). CorrelationId: ${correlationId}`,
      );

      // ── Step 3: Process each negotiation ────────────────────────
      for (const negotiation of negotiations) {
        try {
          const localQuotation = mapQuotationToLocal(negotiation);

          // Upsert quotation
          await supabase.from('purchase_quotations').upsert(
            {
              id: localQuotation.id,
              quotation_date: localQuotation.quotationDate,
              response_date: localQuotation.responseDate,
              buyer_id: localQuotation.buyerId,
              consistency: localQuotation.consistency,
              sienge_status: localQuotation.siengeStatus,
            },
            { onConflict: 'id' },
          );

          await supabase.from('audit_logs').insert({
            entity_type: IntegrationEntityType.QUOTATION,
            entity_id: String(localQuotation.id),
            event_type: 'quotation_imported',
            metadata: { source: 'sync-quotations' },
          });

          // Process each supplier in this negotiation
          for (const supplier of negotiation.suppliers) {
            try {
              const supplierNegotiations = mapSupplierNegotiationsToLocal(
                negotiation.purchaseQuotationId,
                supplier,
              );

              // Resolve creditor email (RN-05)
              let primaryEmail: string | null = null;
              let localSupplier = mapCreditorToSupplier(
                {
                  creditorId: supplier.creditorId,
                  creditorName: supplier.creditorName,
                  tradeName: null,
                  cpf: null,
                  cnpj: null,
                  contacts: [],
                },
                supplier.supplierId,
              );
              let emailResult = { hasValidEmail: false, email: null as string | null };
              let localContacts: ReturnType<typeof mapCreditorContacts> = [];

              try {
                const creditor = await creditorClient.getById(supplier.creditorId, context);
                emailResult = extractCreditorEmail(creditor);
                primaryEmail = emailResult.email;

                localSupplier = mapCreditorToSupplier(creditor, supplier.supplierId);
                localContacts = mapCreditorContacts(creditor, supplier.supplierId);

                if (!emailResult.hasValidEmail) {
                  console.warn(
                    `[${JOB_NAME}] Supplier ${supplier.supplierId} (creditor ${supplier.creditorId}) has no valid email. Blocking per RN-05. CorrelationId: ${correlationId}`,
                  );
                }
              } catch (creditorError: unknown) {
                const err = creditorError as { message?: string };
                console.warn(
                  `[${JOB_NAME}] Failed to resolve creditor ${supplier.creditorId}: ${err.message}. CorrelationId: ${correlationId}`,
                );
              }

              localSupplier.accessStatus = emailResult.hasValidEmail ? 'ACTIVE' : 'BLOCKED';

              // Upsert Supplier
              await supabase.from('suppliers').upsert(
                {
                  id: localSupplier.id,
                  creditor_id: localSupplier.creditorId,
                  name: localSupplier.name,
                  trade_name: localSupplier.tradeName,
                  access_status: localSupplier.accessStatus,
                },
                { onConflict: 'id' },
              );

              // Upsert Supplier Contacts
              for (const contact of localContacts) {
                const { data: existingContact } = await supabase
                  .from('supplier_contacts')
                  .select('id')
                  .eq('supplier_id', contact.supplierId)
                  .eq('email', contact.email)
                  .maybeSingle();

                if (existingContact) {
                  await supabase
                    .from('supplier_contacts')
                    .update({
                      name: contact.name,
                      is_primary: contact.isPrimary,
                    })
                    .eq('id', existingContact.id);
                } else {
                  await supabase.from('supplier_contacts').insert({
                    supplier_id: contact.supplierId,
                    name: contact.name,
                    email: contact.email,
                    is_primary: contact.isPrimary,
                  });
                }
              }

              // Persist the supplier negotiation row and keep quotation items as stubs.
              // The negotiation payload does not carry the item's base catalog data.
              for (const [index, sn] of supplierNegotiations.entries()) {
                const { data: persistedSupplierNegotiation } = await supabase
                  .from('supplier_negotiations')
                  .upsert(
                    {
                      purchase_quotation_id: sn.purchaseQuotationId,
                      supplier_id: sn.supplierId,
                      sienge_negotiation_id: sn.siengeNegotiationId,
                      sienge_negotiation_number: sn.siengeNegotiationNumber,
                      status: sn.status,
                      delivery_date: sn.deliveryDate,
                      supplier_email: primaryEmail,
                    },
                    { onConflict: 'purchase_quotation_id,supplier_id' },
                  )
                  .select('id')
                  .single();

                const negotiationSummary = supplier.negotiations[index];
                if (!persistedSupplierNegotiation || !negotiationSummary) {
                  continue;
                }

                const localNegotiationItems = mapNegotiationItemsToLocal(negotiationSummary.items);

                for (const item of localNegotiationItems) {
                  await supabase.from('purchase_quotation_items').upsert(
                    {
                      id: item.purchaseQuotationItemId,
                      purchase_quotation_id: sn.purchaseQuotationId,
                    },
                    { onConflict: 'id' },
                  );

                  await supabase.from('supplier_negotiation_items').upsert(
                    {
                      supplier_negotiation_id: persistedSupplierNegotiation.id,
                      purchase_quotation_item_id: item.purchaseQuotationItemId,
                      quantity: item.quantity,
                      unit_price: item.unitPrice,
                      delivery_date: item.deliveryDate,
                    },
                    { onConflict: 'supplier_negotiation_id,purchase_quotation_item_id' },
                  );
                }
              }
            } catch (supplierError: unknown) {
              const err = supplierError as { message?: string };
              console.error(
                `[${JOB_NAME}] Failed to sync supplier ${supplier.supplierId} for quotation ${negotiation.purchaseQuotationId}: ${err.message}. CorrelationId: ${correlationId}`,
              );
              // Non-fatal for the whole quotation, simply skip to next supplier.
              // We use errorCount later to mark event_status, but we should distinguish quotation failure vs item failure.
              // Let's increment errorCount here to signal partial failure.
              // Let's increment totalErrors here to signal partial failure.
              totalErrors++;
            }
          }

          totalProcessed++;
        } catch (negError: unknown) {
          totalErrors++;
          const err = negError as { message?: string };
          console.error(
            `[${JOB_NAME}] Failed to process quotation ${negotiation.purchaseQuotationId}: ${err.message}. CorrelationId: ${correlationId}`,
          );
        }
      }

      const totalCount = page.resultSetMetadata?.count ?? 0;
      currentOffset += pageLimit;
      hasMore = currentOffset < totalCount;

      await supabase
        .from('sienge_sync_cursor')
        .update({
          last_offset: currentOffset,
          error_message: null,
        })
        .eq('resource_type', SyncResourceType.QUOTATIONS);
    }

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_QUOTATIONS,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-quotations/all/negotiations',
      http_method: 'GET',
      http_status: 200,
      status: totalErrors === 0 ? 'success' : 'failure',
      request_payload: sanitizeForLog({
        startDateFilter: quotationWindow.startDate,
        endDateFilter: quotationWindow.endDate,
        finalOffset: currentOffset,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        errors: totalErrors,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.QUOTATION,
      retry_count: 0,
      max_retries: 5,
    });

    // ── Step 5: Update sync cursor ──────────────────────────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.IDLE,
        last_synced_at: new Date().toISOString(),
        last_offset: 0,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.QUOTATIONS);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Errors: ${totalErrors}. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    // ── Error path: update cursor + log event ───────────────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.ERROR,
        error_message: err.message ?? 'Unknown error',
      })
      .eq('resource_type', SyncResourceType.QUOTATIONS);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_QUOTATIONS,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-quotations/all/negotiations',
      http_method: 'GET',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      request_payload: sanitizeForLog({
        startDateFilter: quotationWindow.startDate,
        endDateFilter: quotationWindow.endDate,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.QUOTATION,
      retry_count: 0,
      max_retries: 5,
    });

    console.error(`[${JOB_NAME}] Failed: ${err.message}. CorrelationId: ${correlationId}`);
    throw error; // Let pg-boss handle retry (Camada 2)
  }
}
