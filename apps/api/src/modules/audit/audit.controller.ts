import { FastifyReply, FastifyRequest } from 'fastify';
import type { AuditEventIdParamDto, AuditEventsListQueryDto } from '@projetog/shared';

export class AuditController {
  async list(
    request: FastifyRequest<{ Querystring: AuditEventsListQueryDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const {
      page,
      limit,
      event_type,
      purchase_quotation_id,
      purchase_order_id,
      supplier_id,
      actor_id,
      date_start,
      date_end,
    } = request.query;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = supabase
      .from('audit_logs')
      .select(
        'id, event_type, event_timestamp, actor_id, actor_type, purchase_quotation_id, purchase_order_id, supplier_id, summary, metadata, entity_type, entity_id, target_user_id, created_at',
        { count: 'exact' },
      )
      .order('event_timestamp', { ascending: false });

    if (event_type) q = q.eq('event_type', event_type);
    if (purchase_quotation_id) q = q.eq('purchase_quotation_id', purchase_quotation_id);
    if (purchase_order_id) q = q.eq('purchase_order_id', purchase_order_id);
    if (supplier_id) q = q.eq('supplier_id', supplier_id);
    if (actor_id) q = q.eq('actor_id', actor_id);
    if (date_start) q = q.gte('event_timestamp', date_start);
    if (date_end) q = q.lt('event_timestamp', date_end);

    q = q.range(from, to);

    const { data, error, count } = await q;

    if (error) {
      request.log.error({ err: error }, 'audit list failed');
      return reply.code(500).send({ message: 'Erro ao listar auditoria' });
    }

    return reply.send({
      data: data ?? [],
      pagination: { total: count ?? 0, page, limit },
    });
  }

  async getById(
    request: FastifyRequest<{ Params: AuditEventIdParamDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const { audit_event_id } = request.params;

    const { data: row, error } = await supabase
      .from('audit_logs')
      .select(
        'id, event_type, event_timestamp, actor_id, actor_type, purchase_quotation_id, purchase_order_id, supplier_id, summary, metadata, entity_type, entity_id, target_user_id, created_at',
      )
      .eq('id', audit_event_id)
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'audit detail failed');
      return reply.code(500).send({ message: 'Erro ao buscar evento de auditoria' });
    }
    if (!row) {
      return reply.code(404).send({ message: 'Evento não encontrado' });
    }

    let actor_email: string | null = null;
    if (row.actor_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', row.actor_id)
        .maybeSingle();
      actor_email = profile?.email ?? null;
    }

    return reply.send({ data: { ...row, actor_email } });
  }
}
