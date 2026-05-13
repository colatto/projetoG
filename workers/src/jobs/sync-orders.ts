import PgBoss from 'pg-boss';
import { OrderClient, CreditorClient } from '@projetog/integration-sienge';
import {
  resolveOrderId,
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
 * Ensures a supplier stub exists before persisting a purchase order
 * that references it via FK. Uses CreditorClient to resolve supplier
 * details when possible; falls back to a minimal stub otherwise.
 *
 * This prevents silent FK violations on purchase_orders.supplier_id.
 */
async function ensureSupplierExists(
  supplierId: number,
  supabase: ReturnType<typeof getSupabase>,
  creditorClient: CreditorClient | null,
  context: { correlationId: string; source: 'worker' },
): Promise<void> {
  // Check if supplier already exists
  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', supplierId)
    .maybeSingle();

  if (existing) return;

  // Try to resolve from Sienge Creditor API using supplierId as creditorId fallback
  let supplierName = `Fornecedor ${supplierId}`;
  let creditorId: number | null = null;

  if (creditorClient) {
    try {
      const creditor = await creditorClient.getById(supplierId, context);
      supplierName = creditor.creditorName || supplierName;
      creditorId = creditor.creditorId;
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.warn(
        `[${JOB_NAME}] Could not resolve creditor for supplier ${supplierId}: ${error.message}. Creating stub. CorrelationId: ${context.correlationId}`,
      );
    }
  }

  const { error: upsertError } = await supabase.from('suppliers').upsert(
    {
      id: supplierId,
      creditor_id: creditorId,
      name: supplierName,
      access_status: 'ACTIVE',
    },
    { onConflict: 'id' },
  );

  if (upsertError) {
    console.error(
      `[${JOB_NAME}] Failed to create supplier stub for ${supplierId}: ${upsertError.message}. CorrelationId: ${context.correlationId}`,
    );
    throw new Error(`Failed to ensure supplier ${supplierId} exists: ${upsertError.message}`);
  }

  console.info(
    `[${JOB_NAME}] Created supplier stub for ${supplierId} (name: ${supplierName}). CorrelationId: ${context.correlationId}`,
  );
}

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

  // CreditorClient for resolving supplier details when creating stubs
  let creditorClient: CreditorClient | null = null;
  try {
    creditorClient = new CreditorClient(siengeClient);
  } catch {
    console.warn(
      `[${JOB_NAME}] Could not initialize CreditorClient. Supplier stubs will be minimal. CorrelationId: ${correlationId}`,
    );
  }

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
    const errorDetails: Array<{ orderId: number | string; error: string }> = [];

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
        let orderId: number;
        try {
          orderId = resolveOrderId(order);
        } catch (idError: unknown) {
          totalErrors++;
          const err = idError as { message?: string };
          errorDetails.push({ orderId: 'unknown', error: err.message ?? 'Cannot resolve ID' });
          console.error(
            `[${JOB_NAME}] Cannot resolve order ID: ${err.message}. CorrelationId: ${correlationId}`,
          );
          continue;
        }

        try {
          // Ensure supplier exists before order upsert (prevents FK violation)
          await ensureSupplierExists(order.supplierId, supabase, creditorClient, context);

          const localOrder = mapOrderToLocal(order);

          // Upsert order with error checking
          const { error: orderUpsertError } = await supabase.from('purchase_orders').upsert(
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

          if (orderUpsertError) {
            throw new Error(`Order upsert failed: ${orderUpsertError.message}`);
          }

          // Fetch and upsert order items
          try {
            const items = await orderClient.getItems(orderId, context);
            const localItems = mapOrderItemsToLocal(orderId, items);

            for (const item of localItems) {
              const { error: itemUpsertError } = await supabase.from('purchase_order_items').upsert(
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

              if (itemUpsertError) {
                console.warn(
                  `[${JOB_NAME}] Item upsert failed for order ${orderId} item ${item.itemNumber}: ${itemUpsertError.message}. CorrelationId: ${correlationId}`,
                );
              }

              // Fetch delivery schedules for each item (RN-11: respects Sienge typo)
              try {
                const schedules = await orderClient.getDeliverySchedules(
                  orderId,
                  item.itemNumber,
                  context,
                );
                const localSchedules = mapDeliverySchedulesToLocal(
                  orderId,
                  item.itemNumber,
                  schedules,
                );

                for (const schedule of localSchedules) {
                  const { error: schedUpsertError } = await supabase
                    .from('delivery_schedules')
                    .upsert(
                      {
                        purchase_order_id: schedule.purchaseOrderId,
                        item_number: schedule.itemNumber,
                        scheduled_date: schedule.scheduledDate,
                        scheduled_quantity: schedule.scheduledQuantity,
                      },
                      { onConflict: 'purchase_order_id,item_number,scheduled_date' },
                    );

                  if (schedUpsertError) {
                    console.warn(
                      `[${JOB_NAME}] Schedule upsert failed for order ${orderId} item ${item.itemNumber}: ${schedUpsertError.message}. CorrelationId: ${correlationId}`,
                    );
                  }
                }
              } catch (schedError: unknown) {
                const err = schedError as { message?: string };
                console.warn(
                  `[${JOB_NAME}] Failed to fetch schedules for order ${orderId} item ${item.itemNumber}: ${err.message}`,
                );
              }
            }
          } catch (itemsError: unknown) {
            const err = itemsError as { message?: string };
            console.warn(
              `[${JOB_NAME}] Failed to fetch items for order ${orderId}: ${err.message}`,
            );
          }

          // Extract order→quotation links (§9.6)
          const links = extractOrderQuotationLinks(order);
          for (const link of links) {
            const { error: linkUpsertError } = await supabase.from('order_quotation_links').upsert(
              {
                purchase_order_id: link.purchaseOrderId,
                purchase_quotation_id: link.purchaseQuotationId,
              },
              { onConflict: 'purchase_order_id,purchase_quotation_id' },
            );

            if (linkUpsertError) {
              console.warn(
                `[${JOB_NAME}] Link upsert failed for order ${orderId}: ${linkUpsertError.message}. CorrelationId: ${correlationId}`,
              );
            }
          }

          totalProcessed++;
        } catch (orderError: unknown) {
          totalErrors++;
          const err = orderError as { message?: string };
          errorDetails.push({ orderId, error: err.message ?? 'Unknown error' });
          console.error(
            `[${JOB_NAME}] Failed to process order ${orderId}: ${err.message}. CorrelationId: ${correlationId}`,
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
      status: totalErrors === 0 ? 'success' : 'failure',
      request_payload: sanitizeForLog({
        startDateFilter: startDateFilter ?? null,
        finalOffset: currentOffset,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog({
        processed: totalProcessed,
        errors: totalErrors,
        ...(errorDetails.length > 0 ? { errorSamples: errorDetails.slice(0, 5) } : {}),
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
