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
        .eq('resource_type', SyncResourceType.ORDERS);
    } else {
      console.warn(`[${JOB_NAME}] Sync already running. Skipping. CorrelationId: ${correlationId}`);
      return;
    }
  }

  await supabase
    .from('sienge_sync_cursor')
    .update({ sync_status: SyncStatus.RUNNING, error_message: null })
    .eq('resource_type', SyncResourceType.ORDERS);

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

    const pageLimit = 50;
    let hasMore = true;
    let totalProcessed = 0;
    let totalErrors = 0;

    // ── Step 2: Process pages incrementally ────────────────────────
    while (hasMore) {
      const page = await orderClient.listPaged(
        {
          limit: pageLimit,
          offset: currentOffset,
          ...(startDateFilter ? { startDate: startDateFilter } : {}),
        },
        context,
      );

      const orders = page.results || [];
      console.log(
        `[${JOB_NAME}] Fetched ${orders.length} orders (offset ${currentOffset}). CorrelationId: ${correlationId}`,
      );

      // ── Step 3: Process each order in page ───────────────────────
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

          totalProcessed++;
        } catch (orderError: unknown) {
          totalErrors++;
          const err = orderError as { message?: string };
          console.error(
            `[${JOB_NAME}] Failed to process order ${order.purchaseOrderId}: ${err.message}. CorrelationId: ${correlationId}`,
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
        .eq('resource_type', SyncResourceType.ORDERS);
    }

    // ── Step 4: Register integration event ──────────────────────
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.SYNC_ORDERS,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/purchase-orders',
      http_method: 'GET',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({
        startDateFilter: startDateFilter ?? null,
        finalOffset: currentOffset,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        errors: totalErrors,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type: IntegrationEntityType.ORDER,
      retry_count: 0,
      max_retries: 5,
    });

    // ── Step 5: Update sync cursor (Done with window) ───────────
    await supabase
      .from('sienge_sync_cursor')
      .update({
        sync_status: SyncStatus.IDLE,
        last_synced_at: new Date().toISOString(),
        last_offset: 0,
        error_message: null,
      })
      .eq('resource_type', SyncResourceType.ORDERS);

    console.log(
      `[${JOB_NAME}] Completed. Processed: ${totalProcessed}, Errors: ${totalErrors}. CorrelationId: ${correlationId}`,
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
