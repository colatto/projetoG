import PgBoss from 'pg-boss';
import { InvoiceClient } from '@projetog/integration-sienge';
import {
  mapInvoiceToLocal,
  mapInvoiceItemsToLocal,
  mapDeliveryAttendedToLocal,
  extractInvoiceOrderLinks,
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

const JOB_NAME = 'sienge:sync-deliveries';

/**
 * Sync deliveries handler.
 * Polls GET /purchase-invoices/deliveries-attended with pagination,
 * fetches related invoices and items, and upserts into the local database.
 *
 * This implements the NF→PO→Quotation linkage chain (§9.7).
 *
 * PRD-07 §6.3, §9.3.5, §9.7
 */
export async function processSyncDeliveries(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const context = { correlationId, source: 'worker' as const };
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const invoiceClient = new InvoiceClient(siengeClient);

  console.log(`[${JOB_NAME}] Starting sync. CorrelationId: ${correlationId}`);

  // ── Step 1: Check/update sync cursor ──────────────────────────
  const { data: cursor } = await supabase
    .from('sienge_sync_cursor')
    .select('*')
    .eq('resource_type', SyncResourceType.DELIVERIES)
    .single();

  if (cursor?.sync_status === SyncStatus.RUNNING) {
    const updatedAt = new Date(cursor.updated_at ?? 0);
    const now = new Date();
    const diffMins = (now.getTime() - updatedAt.getTime()) / 60000;

    if (diffMins > 60) {
      console.warn(
        `[${JOB_NAME}] Dead lock detected. Forcing unlock. CorrelationId: ${correlationId}`,
      );
      await supabase
        .from('sienge_sync_cursor')
        .update({ sync_status: SyncStatus.ERROR, error_message: 'Timeout lock' })
        .eq('resource_type', SyncResourceType.DELIVERIES);
    } else {
      console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
      return;
    }
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.DELIVERIES);

  try {
    let currentOffset = cursor?.last_offset || 0;
    let startDateFilter: string | undefined;

    if (cursor?.requires_full_sync) {
      console.log(`[${JOB_NAME}] Full resync requested. CorrelationId: ${correlationId}`);
      currentOffset = 0;
    } else if (cursor?.last_synced_at) {
      const lastSynced = new Date(cursor.last_synced_at);
      if (lastSynced.getTime() > 0) {
        const startDate = new Date(lastSynced.getTime() - 60 * 60 * 1000);
        startDateFilter = startDate.toISOString().split('T')[0];
      }
    }

    const pageLimit = 100;
    let hasMore = true;
    let totalProcessed = 0;
    let totalErrors = 0;

    const processedInvoices = new Set<number>();

    // ── Step 2: Process pages incrementally ────────────────────────
    while (hasMore) {
      const page = await invoiceClient.getDeliveriesAttendedPaged(
        {
          limit: pageLimit,
          offset: currentOffset,
          ...(startDateFilter ? { startDate: startDateFilter } : {}), // Some Sienge endpoints use startDate for delivery updates
        },
        context,
      );

      const deliveries = page.results || [];
      console.log(
        `[${JOB_NAME}] Fetched ${deliveries.length} delivery records (offset ${currentOffset}). CorrelationId: ${correlationId}`,
      );

      // ── Step 3: Process each delivery record ────────────────────
      for (const delivery of deliveries) {
        try {
          // Upsert the delivery record
          const localDelivery = mapDeliveryAttendedToLocal(delivery);
          await supabase.from('deliveries').upsert(
            {
              purchase_order_id: localDelivery.purchaseOrderId,
              purchase_order_item_number: localDelivery.purchaseOrderItemNumber,
              invoice_sequential_number: localDelivery.invoiceSequentialNumber,
              invoice_item_number: localDelivery.invoiceItemNumber,
              delivered_quantity: localDelivery.deliveredQuantity,
              status: localDelivery.status,
            },
            {
              onConflict: 'purchase_order_id,purchase_order_item_number,invoice_sequential_number',
            },
          );

          // Sync the related invoice if not already processed
          if (!processedInvoices.has(delivery.sequentialNumber)) {
            processedInvoices.add(delivery.sequentialNumber);

            try {
              const invoice = await invoiceClient.getById(delivery.sequentialNumber, context);
              const localInvoice = mapInvoiceToLocal(invoice);

              await supabase.from('purchase_invoices').upsert(
                {
                  sequential_number: localInvoice.sequentialNumber,
                  supplier_id: localInvoice.supplierId,
                  document_id: localInvoice.documentId,
                  series: localInvoice.series,
                  number: localInvoice.number,
                  issue_date: localInvoice.issueDate,
                  movement_date: localInvoice.movementDate,
                  consistency: localInvoice.consistency,
                },
                { onConflict: 'sequential_number' },
              );

              // Fetch and upsert invoice items
              const items = await invoiceClient.getItems(delivery.sequentialNumber, context);
              const localItems = mapInvoiceItemsToLocal(delivery.sequentialNumber, items);

              for (const item of localItems) {
                await supabase.from('invoice_items').upsert(
                  {
                    invoice_sequential_number: item.invoiceSequentialNumber,
                    item_number: item.itemNumber,
                    quantity: item.quantity,
                  },
                  { onConflict: 'invoice_sequential_number,item_number' },
                );
              }
            } catch (invoiceError: unknown) {
              const err = invoiceError as { message?: string };
              console.warn(
                `[${JOB_NAME}] Failed to fetch invoice ${delivery.sequentialNumber}: ${err.message}. CorrelationId: ${correlationId}`,
              );
            }
          }

          totalProcessed++;
        } catch (delError: unknown) {
          totalErrors++;
          const err = delError as { message?: string };
          console.error(
            `[${JOB_NAME}] Failed to process delivery for order ${delivery.purchaseOrderId}: ${err.message}. CorrelationId: ${correlationId}`,
          );
        }
      }

      // Extract invoice→order links (§9.7)
      const links = extractInvoiceOrderLinks(deliveries);
      for (const link of links) {
        await supabase.from('invoice_order_links').upsert(
          {
            sequential_number: link.sequentialNumber,
            invoice_item_number: link.invoiceItemNumber,
            purchase_order_id: link.purchaseOrderId,
            purchase_order_item_number: link.purchaseOrderItemNumber,
          },
          {
            onConflict:
              'sequential_number,invoice_item_number,purchase_order_id,purchase_order_item_number',
          },
        );
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
        .eq('resource_type', SyncResourceType.DELIVERIES);
    }

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_DELIVERIES,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-invoices/deliveries-attended',
      http_method: 'GET',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({
        startDateFilter: startDateFilter ?? null,
        finalOffset: currentOffset,
        invoices: processedInvoices.size,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        errors: totalErrors,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.INVOICE,
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
        requires_full_sync: false,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.DELIVERIES);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Invoices: ${processedInvoices.size}, Errors: ${totalErrors}. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.ERROR,
        error_message: err.message ?? 'Unknown error',
      })
      .eq('resource_type', SyncResourceType.DELIVERIES);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_DELIVERIES,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-invoices/deliveries-attended',
      http_method: 'GET',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      related_entity_type: IntegrationEntityType.INVOICE,
      retry_count: 0,
      max_retries: 5,
    });

    console.error(`[${JOB_NAME}] Failed: ${err.message}. CorrelationId: ${correlationId}`);
    throw error;
  }
}
