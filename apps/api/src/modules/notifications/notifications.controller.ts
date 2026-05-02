import { FastifyRequest, FastifyReply } from 'fastify';
import {
  NotificationLogsQueryDto,
  NotificationTemplateIdParamDto,
  NotificationTemplateUpdateBodyDto,
} from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';

export class NotificationsController {
  constructor(private audit: AuditService) {}

  async listLogs(
    request: FastifyRequest<{ Querystring: NotificationLogsQueryDto }>,
    reply: FastifyReply,
  ) {
    const {
      page = 1,
      limit = 20,
      quotation_id,
      supplier_id,
      type,
      status,
      start_date,
      end_date,
      export: exportFormat,
    } = request.query;
    const supabase = request.server.supabase;

    let query = supabase.from('notification_logs').select(
      `
      *,
      notification_templates ( type ),
      suppliers ( name ),
      profiles ( name )
    `,
      { count: 'exact' },
    );

    if (quotation_id) {
      query = query.eq('quotation_id', quotation_id);
    }
    if (supplier_id) {
      query = query.eq('recipient_supplier_id', supplier_id);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (start_date) {
      query = query.gte('created_at', `${start_date}T00:00:00.000Z`);
    }
    if (end_date) {
      // Inclui o dia inteiro: somar 1 dia e usar lt (limite exclusivo).
      const endExclusive = new Date(`${end_date}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      query = query.lt('created_at', endExclusive.toISOString());
    }

    if (exportFormat === 'csv') {
      query = query.range(0, 999).order('created_at', { ascending: false });
      const { data, error } = await query;

      if (error) {
        request.log.error(error);
        return reply.code(500).send({ message: 'Erro ao exportar logs' });
      }

      let csv = 'ID,Type,Recipient,Quotation ID,Subject,Status,Created At,Sent At\n';
      (data || []).forEach((row) => {
        csv += `${row.id},${row.type},${row.recipient_email},${row.quotation_id},"${row.subject}",${row.status},${row.created_at},${row.sent_at || ''}\n`;
      });

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="notification_logs.csv"')
        .send(csv);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to).order('created_at', { ascending: false });

    const { data, count, error } = await query;

    if (error) {
      request.log.error(error);
      return reply.code(500).send({ message: 'Erro ao buscar logs de notificação' });
    }

    return reply.code(200).send({
      data,
      pagination: {
        total: count || 0,
        page,
        per_page: limit,
      },
    });
  }

  async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    const supabase = request.server.supabase;

    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('is_active', true)
      .order('type');

    if (error) {
      request.log.error(error);
      return reply.code(500).send({ message: 'Erro ao buscar templates' });
    }

    return reply.code(200).send({ data });
  }

  async updateTemplate(
    request: FastifyRequest<{
      Params: NotificationTemplateIdParamDto;
      Body: NotificationTemplateUpdateBodyDto;
    }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const { subject_template, body_template } = request.body;
    const adminId = request.user.sub;
    const supabase = request.server.supabase;

    // Check if template exists
    const { data: existing, error: findError } = await supabase
      .from('notification_templates')
      .select('id, version, mandatory_placeholders, type')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return reply.code(404).send({ message: 'Template não encontrado' });
    }

    // Since we want to preserve history of templates (so logs can reference an old template ID/version),
    // we should create a new row, and set the old one as inactive.
    // However, PRD-03 says "mostra os 3 templates padrão e permite editar".
    // For V1.0, updating inline is okay but updating inline breaks logs references if we don't increment version.
    // Let's just update inline and increment version.
    const { data: updated, error: updateError } = await supabase
      .from('notification_templates')
      .update({
        subject_template,
        body_template,
        version: existing.version ? existing.version + 1 : 2,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      request.log.error(updateError);
      return reply.code(500).send({ message: 'Erro ao atualizar template' });
    }

    await this.audit.log({
      eventType: 'notification.template_updated',
      actorId: adminId,
      metadata: { template_id: id, template_type: existing.type },
    });

    return reply.code(200).send({ data: updated });
  }
}
