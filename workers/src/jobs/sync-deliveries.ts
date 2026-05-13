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
 * Iterates over known purchase orders and fetches deliveries per order
 * from GET /purchase-invoices/deliveries-attended.
 *
 * The Sienge deliveries-attended endpoint requires at least one of:
 * purchaseOrderId, sequentialNumber, or billId.
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
    // Fetch all known order IDs to iterate over
    const { data: orders, error: ordersError } = await supabase
      .from('purchase_orders')
      .select('id')
      .order('id', { ascending: true });

    if (ordersError) {
      throw new Error(`Failed to fetch purchase orders for delivery sync: ${ordersError.message}`);
    }

    const orderIds = (orders || []).map((o: { id: number }) => o.id);
    console.log(
      `[${JOB_NAME}] Found ${orderIds.length} orders to check for deliveries. CorrelationId: ${correlationId}`,
    );

    if (orderIds.length === 0) {
      console.log(
        `[${JOB_NAME}] No orders in database — skipping delivery sync. CorrelationId: ${correlationId}`,
      );

      await supabase
        .from('sienge_sync_cursor')
        .update({
          sync_status: SyncStatus.IDLE,
          last_synced_at: new Date().toISOString(),
          last_offset: 0,
          error_message: null,
        })
        .eq('resource_type', SyncResourceType.DELIVERIES);

      return;
    }

    let totalProcessed = 0;
    let totalErrors = 0;

    const processedInvoices = new Set<number>();
    const updatedOrderIds = new Set<number>();

    // ── Step 2: Process deliveries per order ────────────────────────
    for (const purchaseOrderId of orderIds) {
      try {
        const deliveries = await invoiceClient.getDeliveriesAttended({ purchaseOrderId }, context);

        if (!deliveries || deliveries.length === 0) {
          continue;
        }

        console.log(
          `[${JOB_NAME}] Found ${deliveries.length} deliveries for order ${purchaseOrderId}. CorrelationId: ${correlationId}`,
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

            // Check if record already exists for newDelivery detection
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
                },
                {
                  onConflict:
                    'purchase_order_id,purchase_order_item_number,delivery_item_number,attended_number,invoice_sequential_number,invoice_item_number',
                },
              )
              .select('id')
              .single();

            if (upsertError) {
              throw new Error(
                `Delivery upsert failed for order ${localDelivery.purchaseOrderId}: ${upsertError.message}`,
              );
            }

            updatedOrderIds.add(localDelivery.purchaseOrderId);

            // Audit for new deliveries
            if (isNewDelivery && upsertedDelivery) {
              await supabase.from('audit_logs').insert({
                entity_type: 'delivery',
                entity_id: String(upsertedDelivery.id),
                event_type: 'delivery_received',
                metadata: {
                  purchaseOrderId: localDelivery.purchaseOrderId,
                  validationStatus,
                  source: 'sync-deliveries',
                },
              });

              // Notify about divergence
              if (validationStatus === 'DIVERGENCIA') {
                await supabase.from('audit_logs').insert({
                  entity_type: 'delivery',
                  entity_id: String(upsertedDelivery.id),
                  event_type: 'delivery_divergence_detected',
                  metadata: {
                    purchaseOrderId: localDelivery.purchaseOrderId,
                    deliveredQuantity: localDelivery.deliveredQuantity,
                    source: 'sync-deliveries',
                  },
                });
              }
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

            // Sync the related invoice if not already processed
            if (!processedInvoices.has(delivery.sequentialNumber)) {
              processedInvoices.add(delivery.sequentialNumber);

              try {
                const invoice = await invoiceClient.getById(delivery.sequentialNumber, context);
                const localInvoice = mapInvoiceToLocal(invoice);

                const { error: invoiceUpsertError } = await supabase
                  .from('purchase_invoices')
                  .upsert(
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

                if (invoiceUpsertError) {
                  console.warn(
                    `[${JOB_NAME}] Invoice upsert warning for ${localInvoice.sequentialNumber}: ${invoiceUpsertError.message}. CorrelationId: ${correlationId}`,
                  );
                }

                // Fetch and upsert invoice items
                const items = await invoiceClient.getItems(delivery.sequentialNumber, context);
                const localItems = mapInvoiceItemsToLocal(delivery.sequentialNumber, items);

                for (const item of localItems) {
                  const { error: invoiceItemUpsertError } = await supabase
                    .from('invoice_items')
                    .upsert(
                      {
                        invoice_sequential_number: item.invoiceSequentialNumber,
                        item_number: item.itemNumber,
                        quantity: item.quantity,
                      },
                      { onConflict: 'invoice_sequential_number,item_number' },
                    );

                  if (invoiceItemUpsertError) {
                    console.warn(
                      `[${JOB_NAME}] Invoice item upsert warning for invoice ${item.invoiceSequentialNumber} item ${item.itemNumber}: ${invoiceItemUpsertError.message}. CorrelationId: ${correlationId}`,
                    );
                  }
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
          const { error: linkUpsertError } = await supabase.from('invoice_order_links').upsert(
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

          if (linkUpsertError) {
            console.warn(
              `[${JOB_NAME}] Invoice-order link upsert warning: ${linkUpsertError.message}. CorrelationId: ${correlationId}`,
            );
          }
        }
      } catch (orderError: unknown) {
        totalErrors++;
        const err = orderError as { message?: string };
        console.error(
          `[${JOB_NAME}] Failed to fetch deliveries for order ${purchaseOrderId}: ${err.message}. CorrelationId: ${correlationId}`,
        );
      }
    }

    // ── Step 4: Recalculate order status for affected orders ──────
    for (const orderId of updatedOrderIds) {
      try {
        await recalculateOrderStatus(supabase, orderId);
      } catch (recalcError: unknown) {
        const err = recalcError as { message?: string };
        console.warn(
          `[${JOB_NAME}] Order status recalculation failed for order ${orderId}: ${err.message}. CorrelationId: ${correlationId}`,
        );
      }
    }

    // ── Step 5: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_DELIVERIES,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-invoices/deliveries-attended',
      http_method: 'GET',
      http_status: 200,
      status: totalErrors === 0 ? 'success' : 'failure',
      request_payload: sanitizeForLog({
        ordersChecked: orderIds.length,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        errors: totalErrors,
        ordersWithDeliveries: updatedOrderIds.size,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.INVOICE,
      retry_count: 0,
      max_retries: 5,
    });

    // ── Step 6: Update sync cursor (Done) ───────────────────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.IDLE,
        last_synced_at: new Date().toISOString(),
        last_offset: 0,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.DELIVERIES);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Errors: ${totalErrors}, Orders with deliveries: ${updatedOrderIds.size}. CorrelationId: ${correlationId}`,
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
