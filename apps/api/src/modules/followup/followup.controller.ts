import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { NotificationType, UserRole } from '@projetog/domain';
import {
  dateChangeParamsSchema as dateChangeParamsSchemaRuntime,
  dateDecisionBodySchema as dateDecisionBodySchemaRuntime,
  followupOrdersQuerySchema as followupOrdersQuerySchemaRuntime,
  followupPurchaseOrderParamsSchema as followupPurchaseOrderParamsSchemaRuntime,
  suggestDateBodySchema as suggestDateBodySchemaRuntime,
} from '@projetog/shared';

type FollowupListRow = {
  status?: string | null;
  suggested_date_status?: string | null;
  promised_date_current?: string | null;
  updated_at?: string | null;
  purchase_orders?: { local_status?: string | null } | null;
};

function toDateOnly(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export class FollowupController {
  constructor(private app: FastifyInstance) {}

  private getOperationalPriority(
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

  private sortByOperationalPriority(rows: FollowupListRow[]): FollowupListRow[] {
    return [...rows].sort((a, b) => {
      const aPriority = this.getOperationalPriority(
        a.purchase_orders?.local_status,
        a.status,
        a.suggested_date_status,
      );
      const bPriority = this.getOperationalPriority(
        b.purchase_orders?.local_status,
        b.status,
        b.suggested_date_status,
      );
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aPromised = a.promised_date_current || '';
      const bPromised = b.promised_date_current || '';
      if (aPromised !== bPromised) return aPromised.localeCompare(bPromised);

      const aUpdated = a.updated_at || '';
      const bUpdated = b.updated_at || '';
      return bUpdated.localeCompare(aUpdated);
    });
  }

  private async resolveSupplierId(profileId: string): Promise<number | null> {
    const { data } = await this.app.supabase
      .from('profiles')
      .select('supplier_id')
      .eq('id', profileId)
      .single();
    return data?.supplier_id ?? null;
  }

  private async resolveComprasEmails(): Promise<string[]> {
    const { data } = await this.app.supabase
      .from('profiles')
      .select('email, role, status')
      .eq('role', 'compras')
      .eq('status', 'ativo');

    return (data || []).map((profile) => profile.email).filter((email) => email.length > 0);
  }

  private async resolveHolidays(): Promise<Set<string>> {
    const { data } = await this.app.supabase.from('business_days_holidays').select('holiday_date');
    return new Set((data || []).map((row: { holiday_date: string }) => row.holiday_date));
  }

  private countBusinessDays(startDate: Date, endDate: Date, holidays: Set<string>): number {
    const start = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    if (end < start) return 0;

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      if (!isWeekend(cursor) && !holidays.has(key)) {
        count += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

  private addBusinessDays(startDate: Date, businessDays: number, holidays: Set<string>): Date {
    const result = toDateOnly(startDate);
    let remaining = Math.max(0, businessDays);

    while (remaining > 0) {
      result.setDate(result.getDate() + 1);
      const key = result.toISOString().slice(0, 10);
      if (!isWeekend(result) && !holidays.has(key)) {
        remaining -= 1;
      }
    }

    return result;
  }

  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { status, supplier_id, building_id, page = 1, limit = 20 } =
      followupOrdersQuerySchemaRuntime.parse(request.query);

    let query = this.app.supabase
      .from('follow_up_trackers')
      .select('*, purchase_orders(id, order_number, local_status, pending_quantity, building_id), suppliers(id, name)');

    if (status) {
      query = query.eq('status', status);
    }
    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }
    if (building_id) {
      query = query.eq('building_id', building_id);
    }

    if (user.role === UserRole.FORNECEDOR) {
      const ownSupplierId = await this.resolveSupplierId(user.sub);
      if (!ownSupplierId) {
        return reply.forbidden('Usuário sem fornecedor associado');
      }
      query = query.eq('supplier_id', ownSupplierId);
    }

    const { data, error } = await query;
    if (error) {
      request.log.error(error);
      return reply.internalServerError('Erro ao listar follow-up');
    }

    const rows = data || [];
    const orderIds = rows.map((row) => row.purchase_order_id).filter((id) => Number.isFinite(id));
    const linkedQuotationByOrderId = new Map<number, number>();
    if (orderIds.length > 0) {
      const { data: links } = await this.app.supabase
        .from('order_quotation_links')
        .select('purchase_order_id, purchase_quotation_id')
        .in('purchase_order_id', orderIds);

      for (const link of links || []) {
        const purchaseOrderId = Number(link.purchase_order_id);
        const purchaseQuotationId = Number(link.purchase_quotation_id);
        if (!Number.isFinite(purchaseOrderId) || !Number.isFinite(purchaseQuotationId)) continue;
        if (!linkedQuotationByOrderId.has(purchaseOrderId)) {
          linkedQuotationByOrderId.set(purchaseOrderId, purchaseQuotationId);
        }
      }
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      linked_quotation_id: linkedQuotationByOrderId.get(Number(row.purchase_order_id)) ?? null,
    }));
    const sortedRows = this.sortByOperationalPriority(enrichedRows);
    const total = sortedRows.length;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedRows = sortedRows.slice(from, to);

    return reply.send({
      data: paginatedRows,
      pagination: { total, page, per_page: limit },
    });
  }

  async getOrderDetail(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { purchaseOrderId } = followupPurchaseOrderParamsSchemaRuntime.parse(request.params);

    const { data: tracker, error } = await this.app.supabase
      .from('follow_up_trackers')
      .select('*, purchase_orders(*), suppliers(id, name)')
      .eq('purchase_order_id', purchaseOrderId)
      .single();

    if (error || !tracker) {
      return reply.notFound('Follow-up não encontrado');
    }

    if (user.role === UserRole.FORNECEDOR) {
      const ownSupplierId = await this.resolveSupplierId(user.sub);
      if (!ownSupplierId || ownSupplierId !== tracker.supplier_id) {
        return reply.forbidden('Acesso negado a este pedido');
      }
    }

    const { data: dateChanges } = await this.app.supabase
      .from('follow_up_date_changes')
      .select('*')
      .eq('follow_up_tracker_id', tracker.id)
      .order('created_at', { ascending: false });

    const { data: notifications } = await this.app.supabase
      .from('notification_logs')
      .select('*')
      .eq('follow_up_tracker_id', tracker.id)
      .order('created_at', { ascending: false });

    return reply.send({
      ...tracker,
      date_changes: dateChanges || [],
      notifications: notifications || [],
    });
  }

  async confirmOnTime(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { purchaseOrderId } = followupPurchaseOrderParamsSchemaRuntime.parse(request.params);

    const ownSupplierId = await this.resolveSupplierId(user.sub);
    if (!ownSupplierId) {
      return reply.forbidden('Usuário sem fornecedor associado');
    }

    const { data: tracker } = await this.app.supabase
      .from('follow_up_trackers')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .eq('supplier_id', ownSupplierId)
      .single();

    if (!tracker) {
      return reply.notFound('Follow-up não encontrado para este pedido');
    }
    if (['ATRASADO', 'ENCERRADO', 'CONCLUIDO', 'CANCELADO'].includes(tracker.status)) {
      return reply.conflict('Follow-up já encerrado ou atrasado');
    }

    const now = new Date().toISOString();
    const { error: updateError } = await this.app.supabase
      .from('follow_up_trackers')
      .update({
        supplier_response_type: 'confirmed_on_time',
        status: 'CONCLUIDO',
        completed_reason: 'supplier_confirmed_on_time',
        approved_by: user.sub,
        approved_at: now,
      })
      .eq('id', tracker.id);

    if (updateError) {
      request.log.error(updateError);
      return reply.internalServerError('Falha ao confirmar prazo');
    }

    const comprasEmails = await this.resolveComprasEmails();
    if (comprasEmails.length > 0) {
      await this.app.supabase.from('notification_logs').insert({
        type: NotificationType.CONFIRMATION_RECEIVED,
        recipient_email: comprasEmails[0],
        purchase_order_id: purchaseOrderId,
        follow_up_tracker_id: tracker.id,
        subject: `Confirmação recebida para pedido ${purchaseOrderId}`,
        body_snapshot: `Fornecedor confirmou entrega no prazo para o pedido ${purchaseOrderId}.`,
        status: 'sent',
        metadata: { compras_copy: comprasEmails, source: 'supplier_confirm' },
        triggered_by: user.sub,
      });
    }

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'followup_confirmation_received',
      actor_id: user.sub,
      entity_type: 'follow_up_tracker',
      entity_id: tracker.id,
      metadata: { purchaseOrderId },
    });

    return reply.send({ status: 'confirmed', followup_tracking_id: tracker.id });
  }

  async suggestDate(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { purchaseOrderId } = followupPurchaseOrderParamsSchemaRuntime.parse(request.params);
    const { suggested_date, reason } = suggestDateBodySchemaRuntime.parse(request.body);
    const suggestedDate = new Date(suggested_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(suggestedDate.getTime()) || suggestedDate <= today) {
      return reply.unprocessableEntity('A nova data deve ser futura');
    }

    const ownSupplierId = await this.resolveSupplierId(user.sub);
    if (!ownSupplierId) {
      return reply.forbidden('Usuário sem fornecedor associado');
    }

    const { data: tracker } = await this.app.supabase
      .from('follow_up_trackers')
      .select('*')
      .eq('purchase_order_id', purchaseOrderId)
      .eq('supplier_id', ownSupplierId)
      .single();

    if (!tracker) {
      return reply.notFound('Follow-up não encontrado para este pedido');
    }

    if (new Date(suggested_date) <= new Date(tracker.order_date)) {
      return reply.unprocessableEntity('Data sugerida deve ser maior que a data do pedido');
    }

    const now = new Date().toISOString();
    const { data: dateChange, error: dcError } = await this.app.supabase
      .from('follow_up_date_changes')
      .insert({
        follow_up_tracker_id: tracker.id,
        previous_date: tracker.promised_date_current,
        suggested_date,
        suggested_by: user.sub,
        suggested_at: now,
        decision: 'pending',
        reason: reason || null,
      })
      .select('id')
      .single();

    if (dcError || !dateChange) {
      request.log.error(dcError);
      return reply.internalServerError('Falha ao registrar sugestão');
    }

    const { error: updateError } = await this.app.supabase
      .from('follow_up_trackers')
      .update({
        status: 'PAUSADO',
        supplier_response_type: 'suggested_new_date',
        suggested_date,
        suggested_date_status: 'pending_approval',
        paused_at: now,
      })
      .eq('id', tracker.id);

    if (updateError) {
      request.log.error(updateError);
      return reply.internalServerError('Falha ao atualizar follow-up');
    }

    const comprasEmails = await this.resolveComprasEmails();
    if (comprasEmails.length > 0) {
      await this.app.supabase.from('notification_logs').insert({
        type: NotificationType.NEW_DATE_PENDING,
        recipient_email: comprasEmails[0],
        purchase_order_id: purchaseOrderId,
        follow_up_tracker_id: tracker.id,
        subject: `Nova data pendente de aprovação - pedido ${purchaseOrderId}`,
        body_snapshot: `Fornecedor sugeriu nova data ${suggested_date}. ${reason || ''}`.trim(),
        status: 'sent',
        metadata: { compras_copy: comprasEmails, suggested_date, reason: reason || null },
        triggered_by: user.sub,
      });
    }

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'followup_new_date_suggested',
      actor_id: user.sub,
      entity_type: 'follow_up_tracker',
      entity_id: tracker.id,
      metadata: { purchaseOrderId, suggested_date, reason: reason || null },
    });

    return reply.send({ status: 'pending_approval', date_change_id: dateChange.id });
  }

  async approveDate(request: FastifyRequest, reply: FastifyReply) {
    return this.decideDateChange(request, reply, 'approved');
  }

  async rejectDate(request: FastifyRequest, reply: FastifyReply) {
    return this.decideDateChange(request, reply, 'rejected');
  }

  async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user!;
    const { purchaseOrderId } = followupPurchaseOrderParamsSchemaRuntime.parse(request.params);

    const { data: tracker } = await this.app.supabase
      .from('follow_up_trackers')
      .select('id, supplier_id')
      .eq('purchase_order_id', purchaseOrderId)
      .single();

    if (!tracker) {
      return reply.notFound('Follow-up não encontrado');
    }

    if (user.role === UserRole.FORNECEDOR) {
      const ownSupplierId = await this.resolveSupplierId(user.sub);
      if (!ownSupplierId || ownSupplierId !== tracker.supplier_id) {
        return reply.forbidden('Acesso negado');
      }
    }

    const { data, error } = await this.app.supabase
      .from('notification_logs')
      .select('*')
      .eq('follow_up_tracker_id', tracker.id)
      .order('created_at', { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Erro ao listar notificações');
    }

    return reply.send(data || []);
  }

  private async decideDateChange(
    request: FastifyRequest,
    reply: FastifyReply,
    decision: 'approved' | 'rejected',
  ) {
    const user = request.user!;
    const { dateChangeId } = dateChangeParamsSchemaRuntime.parse(request.params);
    const { reason } = dateDecisionBodySchemaRuntime.parse(request.body);

    const { data: dateChange } = await this.app.supabase
      .from('follow_up_date_changes')
      .select('*')
      .eq('id', dateChangeId)
      .single();

    if (!dateChange) {
      return reply.notFound('Solicitação de data não encontrada');
    }
    if (dateChange.decision && dateChange.decision !== 'pending') {
      return reply.conflict('Solicitação já foi decidida');
    }

    const now = new Date().toISOString();
    await this.app.supabase
      .from('follow_up_date_changes')
      .update({
        decision,
        decided_by: user.sub,
        decided_at: now,
        reason: reason || dateChange.reason || null,
      })
      .eq('id', dateChangeId);

    const { data: tracker } = await this.app.supabase
      .from('follow_up_trackers')
      .select('*')
      .eq('id', dateChange.follow_up_tracker_id)
      .single();

    if (!tracker) {
      return reply.notFound('Tracker não encontrado');
    }

    if (decision === 'approved') {
      const holidays = await this.resolveHolidays();
      const orderDate = new Date(tracker.order_date);
      const promisedDate = new Date(dateChange.suggested_date);
      const totalBusinessDays = Math.max(1, this.countBusinessDays(orderDate, promisedDate, holidays));
      const firstReminderDay = Math.max(1, Math.floor(totalBusinessDays / 2));
      const nextNotificationDate = this.addBusinessDays(orderDate, firstReminderDay, holidays);

      await this.app.supabase
        .from('follow_up_trackers')
        .update({
          promised_date_current: dateChange.suggested_date,
          suggested_date_status: 'approved',
          status: 'ATIVO',
          approved_by: user.sub,
          approved_at: now,
          next_notification_date: nextNotificationDate.toISOString().slice(0, 10),
          current_notification_number: 0,
          supplier_response_type: 'none',
          paused_at: null,
        })
        .eq('id', tracker.id);

      await this.app.supabase.from('audit_logs').insert({
        event_type: 'followup_new_date_approved',
        actor_id: user.sub,
        entity_type: 'follow_up_tracker',
        entity_id: tracker.id,
        metadata: { previousDate: dateChange.previous_date, newDate: dateChange.suggested_date, reason: reason || null },
      });

      return reply.send({ status: 'approved', new_promised_date: dateChange.suggested_date });
    }

    await this.app.supabase
      .from('follow_up_trackers')
      .update({
        suggested_date_status: 'rejected',
        status: 'ATIVO',
        paused_at: null,
      })
      .eq('id', tracker.id);

    await this.app.supabase.from('audit_logs').insert({
      event_type: 'followup_new_date_rejected',
      actor_id: user.sub,
      entity_type: 'follow_up_tracker',
      entity_id: tracker.id,
      metadata: { previousDate: dateChange.previous_date, rejectedDate: dateChange.suggested_date, reason: reason || null },
    });

    return reply.send({ status: 'rejected' });
  }
}
