import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OrderStatusEngine } from '@projetog/domain';

export class DeliveriesController {
  constructor(private app: FastifyInstance) {}

  async listPending(
    request: FastifyRequest<any>,
    reply: FastifyReply,
  ) {
    const { status } = (request.query || {}) as { status?: string };

    let query = this.app.supabase
      .from('deliveries')
      .select('*, purchase_orders(id, local_status, order_number)')
      .in('validation_status', ['AGUARDANDO_VALIDACAO', 'DIVERGENCIA']);

    if (status) {
      query = query.eq('validation_status', status);
    }

    const { data, error } = await query;

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Failed to fetch pending deliveries');
    }

    return reply.send(data);
  }

  async validateDelivery(
    request: FastifyRequest<any>,
    reply: FastifyReply,
  ) {
    const deliveryId = (request.params as any).id;
    const { status, notes } = (request.body as any);
    const user = request.user!;

    // 1. Fetch delivery to ensure it exists and we have the purchase_order_id
    const { data: delivery, error: fetchError } = await this.app.supabase
      .from('deliveries')
      .select('purchase_order_id, validation_status')
      .eq('id', deliveryId)
      .single();

    if (fetchError || !delivery) {
      return reply.notFound('Delivery not found');
    }

    if (delivery.validation_status !== 'AGUARDANDO_VALIDACAO') {
      return reply.badRequest(`Delivery already validated as ${delivery.validation_status}`);
    }

    // 2. Update delivery
    const { error: updateError } = await this.app.supabase
      .from('deliveries')
      .update({
        validation_status: status,
        validated_by: user.sub,
        validated_at: new Date().toISOString(),
        validation_notes: notes || null,
      })
      .eq('id', deliveryId);

    if (updateError) {
      request.log.error(updateError);
      return reply.internalServerError('Failed to update delivery');
    }

    // 3. Audit log — delivery_validated_ok or delivery_validated_divergence
    const eventType = status === 'OK' ? 'delivery_validated_ok' : 'delivery_validated_divergence';
    await this.app.supabase.from('audit_logs').insert({
      event_type: eventType,
      actor_id: user.sub,
      entity_type: 'delivery',
      entity_id: deliveryId,
      metadata: { previousStatus: delivery.validation_status, newStatus: status, notes },
    });

    // 4. Trigger order status recalculation
    try {
      await this.recalculateOrder(delivery.purchase_order_id);
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(`Failed to recalculate order ${delivery.purchase_order_id}: ${error.message}`);
    }

    // 5. Follow-up signaling (Phase 6 §6.1)
    try {
      await this.handleFollowUpSignaling(delivery.purchase_order_id);
    } catch (err: unknown) {
      const error = err as Error;
      request.log.error(`Failed follow-up signaling for order ${delivery.purchase_order_id}: ${error.message}`);
    }

    return reply.send({ success: true, message: `Delivery updated to ${status}` });
  }

  /**
   * Phase 6 §6.1: Follow-up signaling after delivery validation.
   *
   * Rules:
   * - DIVERGENCIA with open deadline → keep follow-up active
   * - DIVERGENCIA with expired deadline → keep ATRASADO (handled by status engine)
   * - OK with pending balance → keep follow-up active
   * - ENTREGUE (no pending) → close follow-up tracker
   */
  private async handleFollowUpSignaling(purchaseOrderId: number) {
    const supabase = this.app.supabase;

    const { data: order } = await supabase
      .from('purchase_orders')
      .select('local_status, pending_quantity')
      .eq('id', purchaseOrderId)
      .single();

    if (!order) return;

    // If the order is fully delivered, close the follow-up tracker
    if (order.local_status === 'ENTREGUE' && Number(order.pending_quantity ?? 0) === 0) {
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
          metadata: { reason: 'Order fully delivered', purchaseOrderId },
        });
      }
    }
    // Otherwise (DIVERGENCIA, partial, ATRASADO) — follow-up remains active automatically
  }

  // Order status recalculation helper (mirrors worker logic)
  private async recalculateOrder(purchaseOrderId: number) {
    const supabase = this.app.supabase;

    const { data: order } = await supabase
      .from('purchase_orders')
      .select('id, local_status, last_delivery_date, date')
      .eq('id', purchaseOrderId)
      .single();

    if (!order) return;

    const { data: schedules } = await supabase
      .from('delivery_schedules')
      .select('scheduled_date')
      .eq('purchase_order_id', purchaseOrderId)
      .order('scheduled_date', { ascending: false })
      .limit(1);

    const promisedDate = schedules && schedules.length > 0 ? schedules[0].scheduled_date : order.date;

    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('quantity')
      .eq('purchase_order_id', purchaseOrderId);
    const totalQuantityOrdered = (items || []).reduce((acc, item) => acc + Number(item.quantity || 0), 0);

    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('delivered_quantity, validation_status, delivery_date')
      .eq('purchase_order_id', purchaseOrderId);

    const hasDivergence = (deliveries || []).some((d: { validation_status: string | null }) => d.validation_status === 'DIVERGENCIA');
    const validDeliveries = (deliveries || []).filter((d: { validation_status: string | null }) => d.validation_status !== 'DIVERGENCIA');

    const totalQuantityDelivered = validDeliveries.reduce((acc, d) => acc + Number(d.delivered_quantity || 0), 0);
    const pendingQuantity = Math.max(0, totalQuantityOrdered - totalQuantityDelivered);

    let lastDeliveryDate = order.last_delivery_date;
    if (deliveries && deliveries.length > 0) {
      const dates = deliveries.map((d: { delivery_date: string | null }) => d.delivery_date).filter(Boolean).sort();
      if (dates.length > 0) {
        lastDeliveryDate = dates[dates.length - 1];
      }
    }

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

    const updates: any = {};

    updates.total_quantity_ordered = totalQuantityOrdered;
    updates.total_quantity_delivered = totalQuantityDelivered;
    updates.pending_quantity = pendingQuantity;
    updates.has_divergence = hasDivergence;
    updates.last_delivery_date = lastDeliveryDate;
    if (order.local_status !== newStatus) updates.local_status = newStatus;

    await supabase.from('purchase_orders').update(updates).eq('id', purchaseOrderId);

    if (order.local_status !== newStatus) {
      await supabase.from('order_status_history').insert({
        purchase_order_id: purchaseOrderId,
        previous_status: order.local_status,
        new_status: newStatus,
        reason: 'Validação manual de entrega',
        changed_by_system: true,
      });

      // Audit: order_status_changed
      await supabase.from('audit_logs').insert({
        event_type: 'order_status_changed',
        entity_type: 'purchase_order',
        entity_id: purchaseOrderId.toString(),
        metadata: { previousStatus: order.local_status, newStatus, reason: 'manual_validation' },
      });
    }
  }
}
