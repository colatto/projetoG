import { SupabaseClient } from '@supabase/supabase-js';
import { OrderStatusEngine } from '@projetog/domain';

export async function recalculateOrderStatus(
  supabase: SupabaseClient,
  purchaseOrderId: number,
): Promise<void> {
  // 1. Fetch the current order
  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .select(
      'id, local_status, last_delivery_date, total_quantity_ordered, total_quantity_delivered, pending_quantity, has_divergence, date',
    ) // We assume 'date' is promisedDate or there's a deliveryDate
    .eq('id', purchaseOrderId)
    .single();

  if (orderError || !order) {
    console.error(`[recalculateOrderStatus] Order not found: ${purchaseOrderId}`);
    return;
  }

  // Follow-up V1 uses the latest consolidated promised schedule date per order (RN-20).
  const { data: schedules } = await supabase
    .from('delivery_schedules')
    .select('scheduled_date')
    .eq('purchase_order_id', purchaseOrderId)
    .order('scheduled_date', { ascending: false })
    .limit(1);

  const promisedDate = schedules && schedules.length > 0 ? schedules[0].scheduled_date : order.date;

  // 2. Fetch order items to sum total ordered
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('quantity')
    .eq('purchase_order_id', purchaseOrderId);

  const totalQuantityOrdered = (items || []).reduce(
    (acc, item) => acc + Number(item.quantity || 0),
    0,
  );

  // 3. Fetch deliveries
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('delivered_quantity, validation_status, delivery_date')
    .eq('purchase_order_id', purchaseOrderId);

  const hasDivergence = (deliveries || []).some((d) => d.validation_status === 'DIVERGENCIA');
  const validDeliveries = (deliveries || []).filter((d) => d.validation_status !== 'DIVERGENCIA');

  const totalQuantityDelivered = validDeliveries.reduce(
    (acc, d) => acc + Number(d.delivered_quantity || 0),
    0,
  );
  const pendingQuantity = Math.max(0, totalQuantityOrdered - totalQuantityDelivered);

  // Determine last_delivery_date
  let lastDeliveryDate = order.last_delivery_date;
  if (deliveries && deliveries.length > 0) {
    const dates = deliveries
      .map((d) => d.delivery_date)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      lastDeliveryDate = dates[dates.length - 1];
    }
  }

  // 4. Calculate new status
  // For 'hasAvaria' and 'hasReposicao', we would check flags if they exist. PRD-06 handles avaria.
  // For now, we assume false or keep existing status if it is EM_AVARIA / REPOSICAO
  const hasAvaria = order.local_status === 'EM_AVARIA';
  const hasReposicao = order.local_status === 'REPOSICAO';
  const isCancelled = order.local_status === 'CANCELADO';

  const newStatus = OrderStatusEngine.calculateStatus({
    totalQuantityOrdered,
    totalQuantityDelivered,
    hasDivergence,
    hasAvaria,
    hasReposicao,
    isCancelled,
    promisedDate,
  });

  // 5. Update purchase_orders if anything changed
  const updates: any = {};
  if (order.total_quantity_ordered !== totalQuantityOrdered)
    updates.total_quantity_ordered = totalQuantityOrdered;
  if (order.total_quantity_delivered !== totalQuantityDelivered)
    updates.total_quantity_delivered = totalQuantityDelivered;
  if (order.pending_quantity !== pendingQuantity) updates.pending_quantity = pendingQuantity;
  if (order.has_divergence !== hasDivergence) updates.has_divergence = hasDivergence;
  if (order.last_delivery_date !== lastDeliveryDate) updates.last_delivery_date = lastDeliveryDate;
  if (order.local_status !== newStatus) updates.local_status = newStatus;

  if (Object.keys(updates).length > 0) {
    await supabase.from('purchase_orders').update(updates).eq('id', purchaseOrderId);
  }

  // 6. Register order_status_history if status changed
  if (order.local_status !== newStatus) {
    await supabase.from('order_status_history').insert({
      purchase_order_id: purchaseOrderId,
      previous_status: order.local_status,
      new_status: newStatus,
      reason: 'Recálculo automático via sincronização de entregas Sienge',
      changed_by_system: true,
    });

    await supabase.from('audit_logs').insert({
      event_type: 'order_status_changed',
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId.toString(),
      metadata: { previousStatus: order.local_status, newStatus, reason: 'sync-deliveries' },
    });
  }

  // 7. Phase 6 §6.1: Follow-up signaling after status recalculation
  // If order is fully delivered (ENTREGUE) with no pending balance, close follow-up tracker
  if (newStatus === 'ENTREGUE' && pendingQuantity === 0) {
    const { data: tracker } = await supabase
      .from('follow_up_trackers')
      .update({ status: 'ENCERRADO', updated_at: new Date().toISOString() })
      .eq('purchase_order_id', purchaseOrderId)
      .neq('status', 'ENCERRADO')
      .select('id')
      .single();

    if (tracker) {
      await supabase.from('audit_logs').insert({
        event_type: 'followup_termination_requested',
        entity_type: 'follow_up_tracker',
        entity_id: tracker.id.toString(),
        metadata: { reason: 'Order fully delivered (worker recalc)', purchaseOrderId },
      });
    }
  }
  // Otherwise (DIVERGENCIA, PARCIALMENTE_ENTREGUE, ATRASADO, etc.) — follow-up remains active
}
