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
import { recalculateOrderStatus } from '../utils/order-status-recalc.js';

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

    if (cursor?.last_synced_at) {
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
    const updatedOrderIds = new Set<number>();

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
          const localDelivery = mapDeliveryAttendedToLocal(delivery);

          // Check for divergence automatically (§6.1)
          let validationStatus = localDelivery.status;

          if (localDelivery.deliveredQuantity != null) {
            const { data: poItem } = await supabase
              .from('purchase_order_items')
              .select('quantity')
              .eq('purchase_order_id', localDelivery.purchaseOrderId)
              .eq('item_number', localDelivery.purchaseOrderItemNumber)
              .single();

            if (poItem) {
              const { data: existingDeliveries } = await supabase
                .from('deliveries')
                .select('delivered_quantity, validation_status')
                .eq('purchase_order_id', localDelivery.purchaseOrderId)
                .eq('purchase_order_item_number', localDelivery.purchaseOrderItemNumber)
                .neq('invoice_sequential_number', localDelivery.invoiceSequentialNumber || -1);

              const previouslyDelivered = (existingDeliveries || [])
                .filter((d) => d.validation_status !== 'DIVERGENCIA')
                .reduce((acc, d) => acc + Number(d.delivered_quantity || 0), 0);

              const pending = Number(poItem.quantity) - previouslyDelivered;

              if (localDelivery.deliveredQuantity > pending) {
                validationStatus = 'DIVERGENCIA';
              }
            }
          }

          // Check if it's new for audit log
          const { data: existingCheck } = await supabase
            .from('deliveries')
            .select('id')
            .eq('purchase_order_id', localDelivery.purchaseOrderId)
            .eq('purchase_order_item_number', localDelivery.purchaseOrderItemNumber)
            .eq('delivery_item_number', localDelivery.deliveryItemNumber ?? 0)
            .eq('attended_number', localDelivery.attendedNumber ?? 0)
            .eq('invoice_sequential_number', localDelivery.invoiceSequentialNumber || -1)
            .eq('invoice_item_number', localDelivery.invoiceItemNumber || -1)
            .single();

          const isNewDelivery = !existingCheck;

          // Upsert the delivery record
          const { data: upsertedDelivery, error: upsertError } = await supabase
            .from('deliveries')
            .upsert(
              {
                purchase_order_id: localDelivery.purchaseOrderId,
                purchase_order_item_number: localDelivery.purchaseOrderItemNumber,
                delivery_item_number: localDelivery.deliveryItemNumber,
                attended_number: localDelivery.attendedNumber,
                invoice_sequential_number: localDelivery.invoiceSequentialNumber,
                invoice_item_number: localDelivery.invoiceItemNumber,
                delivered_quantity: localDelivery.deliveredQuantity,
                delivery_date: localDelivery.deliveryDate,
                validation_status: validationStatus,
                sienge_synced_at: new Date().toISOString(),
              },
              {
                onConflict:
                  'purchase_order_id,purchase_order_item_number,delivery_item_number,attended_number,invoice_sequential_number,invoice_item_number',
              },
            )
            .select('id')
            .single();

          if (upsertError) {
            console.warn(`[${JOB_NAME}] Delivery upsert warning: ${upsertError.message}`);
          } else {
            updatedOrderIds.add(localDelivery.purchaseOrderId);
            if (isNewDelivery && upsertedDelivery) {
              await supabase.from('audit_logs').insert({
                event_type: 'delivery_identified',
                entity_type: 'delivery',
                entity_id: upsertedDelivery.id.toString(),
                metadata: {
                  purchaseOrderId: localDelivery.purchaseOrderId,
                  quantity: localDelivery.deliveredQuantity,
                },
              });
            }

            // PRD-06: if the order item had a replacement in progress, mark it as delivered.
            const { data: replacementRows } = await supabase
              .from('damage_replacements')
              .select('id, damage_id')
              .eq('replacement_status', 'EM_ANDAMENTO')
              .in(
                'damage_id',
                (
                  await supabase
                    .from('damages')
                    .select('id')
                    .eq('purchase_order_id', localDelivery.purchaseOrderId)
                    .eq('item_number', localDelivery.purchaseOrderItemNumber)
                    .eq('status', 'EM_REPOSICAO')
                ).data?.map((row) => row.id) ?? ['00000000-0000-0000-0000-000000000000'],
              );

            if ((replacementRows || []).length > 0) {
              const replacementIds = replacementRows!.map((row) => row.id);
              const damageIds = replacementRows!.map((row) => row.damage_id);
              await supabase
                .from('damage_replacements')
                .update({ replacement_status: 'ENTREGUE' })
                .in('id', replacementIds);
              await supabase.from('damages').update({ status: 'RESOLVIDA' }).in('id', damageIds);

              for (const damageId of damageIds) {
                await supabase.from('damage_audit_logs').insert({
                  damage_id: damageId,
                  event_type: 'reposicao_entregue',
                  actor_profile: 'sistema',
                  purchase_order_id: localDelivery.purchaseOrderId,
                });
              }
            }
          }

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
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.DELIVERIES);

    // ── Step 6: Recalculate order statuses ───────────────────────
    for (const orderId of updatedOrderIds) {
      try {
        await recalculateOrderStatus(supabase, orderId);
      } catch (err: unknown) {
        const error = err as Error;
        console.error(
          `[${JOB_NAME}] Failed to recalculate order status for order ${orderId}: ${error.message}`,
        );
      }
    }

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Invoices: ${processedInvoices.size}, Orders Updated: ${updatedOrderIds.size}, Errors: ${totalErrors}. CorrelationId: ${correlationId}`,
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
