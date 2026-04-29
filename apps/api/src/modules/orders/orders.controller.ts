import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@projetog/domain';

export class OrdersController {
  constructor(private app: FastifyInstance) {}

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { status, search } = (request.query || {}) as { status?: string; search?: string };

    let query = this.app.supabase.from('purchase_orders').select('*, purchase_order_items(count)');

    if (user.role === UserRole.FORNECEDOR) {
      // Must filter by supplier_id
      // In this system, user.id is mapped to a profile that might have supplier_id.
      // Wait, let's fetch profile first to get supplier_id.
      const { data: profile } = await this.app.supabase
        .from('profiles')
        .select('supplier_id')
        .eq('id', user.sub)
        .single();

      if (!profile || !profile.supplier_id) {
        return reply.forbidden('User has no supplier associated');
      }
      query = query.eq('supplier_id', profile.supplier_id);
    }

    if (status) {
      query = query.eq('local_status', status);
    }

    if (search) {
      // Basic search on order number
      query = query.ilike('formatted_purchase_order_id', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Failed to fetch orders');
    }

    return reply.send(data);
  }

  async listOrderDeliveries(request: FastifyRequest, reply: FastifyReply) {
    const purchaseOrderId = parseInt(
      (request.params as { purchaseOrderId: string }).purchaseOrderId,
      10,
    );
    const user = request.user!;

    // Security check
    if (user.role === UserRole.FORNECEDOR) {
      const { data: profile } = await this.app.supabase
        .from('profiles')
        .select('supplier_id')
        .eq('id', user.sub)
        .single();
      const { data: order } = await this.app.supabase
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', purchaseOrderId)
        .single();
      if (!order || order.supplier_id !== profile?.supplier_id) {
        return reply.forbidden('Not authorized to view this order');
      }
    }

    const { data, error } = await this.app.supabase
      .from('deliveries')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('delivery_date', { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Failed to fetch deliveries');
    }

    return reply.send(data);
  }

  async cancelOrder(request: FastifyRequest, reply: FastifyReply) {
    const purchaseOrderId = parseInt(
      (request.params as { purchaseOrderId: string }).purchaseOrderId,
      10,
    );
    const { reason } = request.body as { reason?: string };
    const user = request.user!;

    const { data: order, error: orderError } = await this.app.supabase
      .from('purchase_orders')
      .select('local_status')
      .eq('id', purchaseOrderId)
      .single();

    if (orderError || !order) {
      return reply.notFound('Order not found');
    }

    if (order.local_status === 'CANCELADO') {
      return reply.badRequest('Order is already cancelled');
    }

    // Update status to CANCELADO
    const { error: updateError } = await this.app.supabase
      .from('purchase_orders')
      .update({ local_status: 'CANCELADO' })
      .eq('id', purchaseOrderId);

    if (updateError) {
      request.log.error(updateError);
      return reply.internalServerError('Failed to cancel order');
    }

    // Insert history
    await this.app.supabase.from('order_status_history').insert({
      purchase_order_id: purchaseOrderId,
      previous_status: order.local_status,
      new_status: 'CANCELADO',
      reason,
      changed_by: user.sub,
      changed_by_system: false,
    });

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'order_cancelled',
      actor_id: user.sub,
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId.toString(),
      metadata: { previousStatus: order.local_status, reason },
    });

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'order_status_changed',
      actor_id: user.sub,
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId.toString(),
      metadata: { previousStatus: order.local_status, newStatus: 'CANCELADO', reason },
    });

    // Terminate follow-up tracker
    const { data: tracker } = await this.app.supabase
      .from('follow_up_trackers')
      .update({ status: 'ENCERRADO', updated_at: new Date().toISOString() })
      .eq('purchase_order_id', purchaseOrderId)
      .neq('status', 'ENCERRADO')
      .select('id')
      .single();

    if (tracker) {
      await this.app.supabase.from('audit_logs').insert({
        event_type: 'followup_termination_requested',
        actor_id: user.sub,
        entity_type: 'follow_up_tracker',
        entity_id: tracker.id.toString(),
        metadata: { reason: 'Order cancelled' },
      });
    }

    return reply.send({ success: true, message: 'Order cancelled' });
  }

  async reportAvaria(request: FastifyRequest, reply: FastifyReply) {
    const purchaseOrderId = parseInt(
      (request.params as { purchaseOrderId: string }).purchaseOrderId,
      10,
    );
    const { status, reason } = request.body as { status: string; reason?: string };
    const user = request.user!;

    const { data: order, error: orderError } = await this.app.supabase
      .from('purchase_orders')
      .select('local_status')
      .eq('id', purchaseOrderId)
      .single();

    if (orderError || !order) {
      return reply.notFound('Order not found');
    }

    if (order.local_status === status) {
      return reply.badRequest(`Order is already ${status}`);
    }

    const { error: updateError } = await this.app.supabase
      .from('purchase_orders')
      .update({ local_status: status })
      .eq('id', purchaseOrderId);

    if (updateError) {
      request.log.error(updateError);
      return reply.internalServerError('Failed to report avaria status');
    }

    await this.app.supabase.from('order_status_history').insert({
      purchase_order_id: purchaseOrderId,
      previous_status: order.local_status,
      new_status: status,
      reason,
      changed_by: user.sub,
      changed_by_system: false,
    });

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'order_status_changed',
      actor_id: user.sub,
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId.toString(),
      metadata: { previousStatus: order.local_status, newStatus: status, reason },
    });

    return reply.send({ success: true, message: `Order updated to ${status}` });
  }

  async listStatusHistory(request: FastifyRequest, reply: FastifyReply) {
    const purchaseOrderId = parseInt(
      (request.params as { purchaseOrderId: string }).purchaseOrderId,
      10,
    );
    const user = request.user!;

    if (user.role === UserRole.FORNECEDOR) {
      const { data: profile } = await this.app.supabase
        .from('profiles')
        .select('supplier_id')
        .eq('id', user.sub)
        .single();
      const { data: order } = await this.app.supabase
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', purchaseOrderId)
        .single();
      if (!order || order.supplier_id !== profile?.supplier_id) {
        return reply.forbidden('Not authorized to view this order');
      }
    }

    const { data, error } = await this.app.supabase
      .from('order_status_history')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .order('created_at', { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Failed to fetch status history');
    }

    return reply.send(data);
  }
}
