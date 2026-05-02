import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@projetog/domain';
import { ordersListQuerySchema } from '@projetog/shared';

/** RN-08 — statuses represented on purchase_orders.local_status (orders slice; quotation statuses live in PRD-02). */
const REQUIRE_ACTION_LOCAL_STATUSES = ['ATRASADO', 'DIVERGENCIA', 'EM_AVARIA', 'REPOSICAO'] as const;

type PurchaseOrderListRow = {
  id: number;
  local_status?: string | null;
  created_at?: string | null;
};

type TrackerLite = {
  purchase_order_id: number;
  status: string | null;
  suggested_date_status: string | null;
  promised_date_current: string | null;
  updated_at: string | null;
};

function getOperationalPriority(
  localStatus: string | null | undefined,
  trackerStatus: string | null | undefined,
  suggestedDateStatus: string | null | undefined,
): number {
  if (localStatus === 'ATRASADO' || trackerStatus === 'ATRASADO') return 1;
  if (localStatus === 'DIVERGENCIA') return 2;
  if (localStatus === 'EM_AVARIA' || localStatus === 'REPOSICAO') return 3;
  if (trackerStatus === 'PAUSADO' || suggestedDateStatus === 'pending_approval') return 4;
  if (localStatus === 'PENDENTE' || localStatus === 'PARCIALMENTE_ENTREGUE') return 5;
  if (localStatus === 'ENTREGUE' || localStatus === 'CANCELADO') return 6;
  return 7;
}

function mergeLatestTrackerPerOrder(rows: TrackerLite[]): Map<number, TrackerLite> {
  const map = new Map<number, TrackerLite>();
  for (const row of rows) {
    const prev = map.get(row.purchase_order_id);
    if (!prev || (row.updated_at || '') > (prev.updated_at || '')) {
      map.set(row.purchase_order_id, row);
    }
  }
  return map;
}

export class OrdersController {
  constructor(private app: FastifyInstance) {}

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const parsed = ordersListQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.badRequest(parsed.error.message);
    }
    const { status, search, require_action, sort_priority } = parsed.data;

    if (require_action && user.role === UserRole.VISUALIZADOR_PEDIDOS) {
      return reply.forbidden('Visualizador de Pedidos não pode usar o filtro Exigem ação');
    }

    let query = this.app.supabase.from('purchase_orders').select('*, purchase_order_items(count)');

    if (user.role === UserRole.FORNECEDOR) {
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

    if (require_action && user.role !== UserRole.FORNECEDOR) {
      query = query.in('local_status', [...REQUIRE_ACTION_LOCAL_STATUSES]);
    }

    if (status) {
      query = query.eq('local_status', status);
    }

    if (search) {
      query = query.ilike('formatted_purchase_order_id', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Failed to fetch orders');
    }

    let rows = (data ?? []) as PurchaseOrderListRow[];

    if (sort_priority) {
      const ids = rows.map((r) => r.id).filter((id) => Number.isFinite(id));
      let trackerByOrder = new Map<number, TrackerLite>();
      if (ids.length > 0) {
        const { data: trackers, error: trackerErr } = await this.app.supabase
          .from('follow_up_trackers')
          .select(
            'purchase_order_id, status, suggested_date_status, promised_date_current, updated_at',
          )
          .in('purchase_order_id', ids);

        if (trackerErr) {
          request.log.error(trackerErr);
          return reply.internalServerError('Failed to fetch follow-up context for orders');
        }
        trackerByOrder = mergeLatestTrackerPerOrder((trackers ?? []) as TrackerLite[]);
      }

      rows = [...rows].sort((a, b) => {
        const ta = trackerByOrder.get(a.id);
        const tb = trackerByOrder.get(b.id);
        const pa = getOperationalPriority(a.local_status, ta?.status, ta?.suggested_date_status);
        const pb = getOperationalPriority(b.local_status, tb?.status, tb?.suggested_date_status);
        if (pa !== pb) return pa - pb;

        const aPromised = ta?.promised_date_current || '';
        const bPromised = tb?.promised_date_current || '';
        if (aPromised !== bPromised) return aPromised.localeCompare(bPromised);

        const aUp = ta?.updated_at || a.created_at || '';
        const bUp = tb?.updated_at || b.created_at || '';
        return bUp.localeCompare(aUp);
      });
    } else {
      rows = [...rows].sort((a, b) => {
        const ac = a.created_at || '';
        const bc = b.created_at || '';
        return bc.localeCompare(ac);
      });
    }

    return reply.send(rows);
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
