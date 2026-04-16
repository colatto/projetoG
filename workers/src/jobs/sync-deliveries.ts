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
    console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
    return;
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.DELIVERIES);

  try {
    // ── Step 2: Fetch all deliveries attended from Sienge ────────
    const deliveries = await invoiceClient.getDeliveriesAttended({}, context);
    console.log(
      `[${JOB_NAME}] Fetched ${deliveries.length} delivery records. CorrelationId: ${correlationId}`,
    );

    let processedCount = 0;
    let errorCount = 0;

    // Track unique invoices to avoid redundant API calls
    const processedInvoices = new Set<number>();

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
          { onConflict: 'purchase_order_id,purchase_order_item_number,invoice_sequential_number' },
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

        processedCount++;
      } catch (delError: unknown) {
        errorCount++;
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

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_DELIVERIES,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-invoices/deliveries-attended',
      http_method: 'GET',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({
        total: deliveries.length,
        invoices: processedInvoices.size,
      }),
      response_payload: sanitizeForLog({ processed: processedCount, errors: errorCount }),
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
        last_offset: deliveries.length,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.DELIVERIES);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${processedCount}, Invoices: ${processedInvoices.size}, Errors: ${errorCount}. CorrelationId: ${correlationId}`,
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
