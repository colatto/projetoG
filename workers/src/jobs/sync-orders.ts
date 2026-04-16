import PgBoss from 'pg-boss';
import { OrderClient } from '@projetog/integration-sienge';
import {
  mapOrderToLocal,
  mapOrderItemsToLocal,
  mapDeliverySchedulesToLocal,
  extractOrderQuotationLinks,
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

const JOB_NAME = 'sienge:sync-orders';

/**
 * Sync orders handler.
 * Polls GET /purchase-orders with pagination, fetches items and
 * delivery schedules for each order, and upserts into the local database.
 *
 * PRD-07 §6.2, §9.3.3, §9.6
 */
export async function processSyncOrders(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const context = { correlationId, source: 'worker' as const };
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const orderClient = new OrderClient(siengeClient);

  console.log(`[${JOB_NAME}] Starting sync. CorrelationId: ${correlationId}`);

  // ── Step 1: Check/update sync cursor ──────────────────────────
  const { data: cursor } = await supabase
    .from('sienge_sync_cursor')
    .select('*')
    .eq('resource_type', SyncResourceType.ORDERS)
    .single();

  if (cursor?.sync_status === SyncStatus.RUNNING) {
    console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
    return;
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.ORDERS);

  try {
    // ── Step 2: Fetch all purchase orders from Sienge ────────────
    const orders = await orderClient.list({}, context);
    console.log(`[${JOB_NAME}] Fetched ${orders.length} orders. CorrelationId: ${correlationId}`);

    let processedCount = 0;
    let errorCount = 0;

    // ── Step 3: Process each order ──────────────────────────────
    for (const order of orders) {
      try {
        const localOrder = mapOrderToLocal(order);

        // Upsert order
        await supabase.from('purchase_orders').upsert(
          {
            id: localOrder.id,
            formatted_purchase_order_id: localOrder.formattedPurchaseOrderId,
            supplier_id: localOrder.supplierId,
            buyer_id: localOrder.buyerId,
            building_id: localOrder.buildingId,
            sienge_status: localOrder.siengeStatus,
            local_status: localOrder.localStatus,
            authorized: localOrder.authorized,
            disapproved: localOrder.disapproved,
            delivery_late: localOrder.deliveryLate,
            consistent: localOrder.consistent,
            date: localOrder.date,
          },
          { onConflict: 'id' },
        );

        // Fetch and upsert order items
        try {
          const items = await orderClient.getItems(order.purchaseOrderId, context);
          const localItems = mapOrderItemsToLocal(order.purchaseOrderId, items);

          for (const item of localItems) {
            await supabase.from('purchase_order_items').upsert(
              {
                purchase_order_id: item.purchaseOrderId,
                item_number: item.itemNumber,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                purchase_quotation_id: item.purchaseQuotationId,
                purchase_quotation_item_id: item.purchaseQuotationItemId,
              },
              { onConflict: 'purchase_order_id,item_number' },
            );

            // Fetch delivery schedules for each item (RN-11: respects Sienge typo)
            try {
              const schedules = await orderClient.getDeliverySchedules(
                order.purchaseOrderId,
                item.itemNumber,
                context,
              );
              const localSchedules = mapDeliverySchedulesToLocal(
                order.purchaseOrderId,
                item.itemNumber,
                schedules,
              );

              for (const schedule of localSchedules) {
                await supabase.from('delivery_schedules').upsert(
                  {
                    purchase_order_id: schedule.purchaseOrderId,
                    item_number: schedule.itemNumber,
                    scheduled_date: schedule.scheduledDate,
                    scheduled_quantity: schedule.scheduledQuantity,
                  },
                  { onConflict: 'purchase_order_id,item_number,scheduled_date' },
                );
              }
            } catch (schedError: unknown) {
              const err = schedError as { message?: string };
              console.warn(
                `[${JOB_NAME}] Failed to fetch schedules for order ${order.purchaseOrderId} item ${item.itemNumber}: ${err.message}`,
              );
            }
          }
        } catch (itemsError: unknown) {
          const err = itemsError as { message?: string };
          console.warn(
            `[${JOB_NAME}] Failed to fetch items for order ${order.purchaseOrderId}: ${err.message}`,
          );
        }

        // Extract order→quotation links (§9.6)
        const links = extractOrderQuotationLinks(order);
        for (const link of links) {
          await supabase.from('order_quotation_links').upsert(
            {
              purchase_order_id: link.purchaseOrderId,
              purchase_quotation_id: link.purchaseQuotationId,
            },
            { onConflict: 'purchase_order_id,purchase_quotation_id' },
          );
        }

        processedCount++;
      } catch (orderError: unknown) {
        errorCount++;
        const err = orderError as { message?: string };
        console.error(
          `[${JOB_NAME}] Failed to process order ${order.purchaseOrderId}: ${err.message}. CorrelationId: ${correlationId}`,
        );
      }
    }

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_ORDERS,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-orders',
      http_method: 'GET',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({ total: orders.length }),
      response_payload: sanitizeForLog({ processed: processedCount, errors: errorCount }),
      related_entity_type: IntegrationEntityType.ORDER,
      retry_count: 0,
      max_retries: 5,
    });

    // ── Step 5: Update sync cursor ──────────────────────────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.IDLE,
        last_synced_at: new Date().toISOString(),
        last_offset: orders.length,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.ORDERS);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${processedCount}, Errors: ${errorCount}. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.ERROR,
        error_message: err.message ?? 'Unknown error',
      })
      .eq('resource_type', SyncResourceType.ORDERS);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_ORDERS,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-orders',
      http_method: 'GET',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      related_entity_type: IntegrationEntityType.ORDER,
      retry_count: 0,
      max_retries: 5,
    });

    console.error(`[${JOB_NAME}] Failed: ${err.message}. CorrelationId: ${correlationId}`);
    throw error;
  }
}
