import { FastifyInstance } from 'fastify';
import { Database } from '@projetog/shared';
import { NotificationType, NotificationStatus, TemplateRenderer } from '@projetog/domain';

type NotificationTemplate = Database['public']['Tables']['notification_templates']['Row'];

export class NotificationService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Retrieves the currently active template for a given notification type.
   */
  private async getActiveTemplate(type: NotificationType): Promise<NotificationTemplate> {
    const { data, error } = await this.fastify.supabase
      .from('notification_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      this.fastify.log.error({ err: error, type }, 'Failed to fetch active notification template');
      throw new Error(`Template not found for type: ${type}`);
    }

    return data;
  }

  /**
   * Resolves the primary email for a supplier.
   * Priority:
   * 1. Contact with is_primary = true
   * 2. First contact with a valid email
   */
  private async getSupplierEmail(supplierId: number): Promise<string | null> {
    const { data, error } = await this.fastify.supabase
      .from('supplier_contacts')
      .select('email, is_primary')
      .eq('supplier_id', supplierId)
      .order('is_primary', { ascending: false });

    if (error || !data || data.length === 0) {
      return null;
    }

    return data[0].email;
  }

  /**
   * Sends a new quotation notification to eligible suppliers.
   */
  public async sendQuotationNotification(
    quotationId: number,
    supplierIds: number[],
    triggeredBy: string,
  ): Promise<void> {
    try {
      const template = await this.getActiveTemplate(NotificationType.NEW_QUOTATION);
      if (!template) {
        this.fastify.log.error('Template new_quotation not found');
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const link = `${frontendUrl}/supplier/quotations/${quotationId}`;

      const placeholders = {
        quotationId: quotationId.toString(),
        link,
      };

      // Ensure template is valid
      const { valid, missing } = TemplateRenderer.validateTemplatePlaceholders(
        template.body_template,
        template.mandatory_placeholders as string[],
      );
      if (!valid) {
        this.fastify.log.error(
          { templateId: template.id, missing },
          'Template is missing mandatory placeholders. Aborting send.',
        );
        return;
      }

      const subject = TemplateRenderer.renderTemplate(template.subject_template, placeholders);
      const body = TemplateRenderer.renderTemplate(template.body_template, placeholders);

      for (const supplierId of supplierIds) {
        // Resolve email
        const email = await this.getSupplierEmail(supplierId);

        if (!email) {
          // Log failed attempt if no email is found (RN-08)
          await this.fastify.supabase.from('notification_logs').insert({
            template_id: template.id,
            template_version: template.version,
            type: NotificationType.NEW_QUOTATION,
            recipient_email: 'unknown@example.com',
            recipient_supplier_id: supplierId,
            quotation_id: quotationId,
            subject: subject,
            body_snapshot: body,
            status: NotificationStatus.FAILED,
            error_message: 'No contact email found for supplier',
            triggered_by: triggeredBy,
          });
          continue;
        }

        // Insert pending log
        const { data: logEntry, error: logError } = await this.fastify.supabase
          .from('notification_logs')
          .insert({
            template_id: template.id,
            template_version: template.version,
            type: NotificationType.NEW_QUOTATION,
            recipient_email: email,
            recipient_supplier_id: supplierId,
            quotation_id: quotationId,
            subject: subject,
            body_snapshot: body,
            status: NotificationStatus.SENT, // Assuming SENT for now, worker updates on failure
            triggered_by: triggeredBy,
          })
          .select('id')
          .single();

        if (logError || !logEntry) {
          this.fastify.log.error(
            { err: logError, supplierId },
            'Failed to insert notification_log',
          );
          continue;
        }

        // We temporarily mark it as "sent" or we could use another status if we added "pending".
        // Actually, since it's async, let's enqueue to pg-boss.
        await this.fastify.boss?.send(
          'notification:send-email',
          {
            notificationLogId: logEntry.id,
            recipientEmail: email,
            subject,
            htmlBody: body,
          },
          {
            retryLimit: 3,
            retryDelay: 60,
            retryBackoff: true,
            expireInHours: 1,
          },
        );
      }
    } catch (err) {
      this.fastify.log.error({ err, quotationId }, 'Failed to process quotation notifications');
    }
  }

  /**
   * Checks for active quotations for a newly activated supplier and sends notifications.
   * Useful when a supplier account is approved after a quotation was already broadcasted.
   */
  public async sendPendingQuotationsNotification(
    supplierId: number,
    triggeredBy: string,
  ): Promise<void> {
    try {
      const { data: negotiations, error } = await this.fastify.supabase
        .from('supplier_negotiations')
        .select('purchase_quotation_id')
        .eq('supplier_id', supplierId)
        .in('status', ['AGUARDANDO_RESPOSTA', 'AGUARDANDO_REVISAO', 'CORRECAO_SOLICITADA']);

      if (error || !negotiations) {
        this.fastify.log.error(
          { err: error, supplierId },
          'Failed to fetch pending negotiations for supplier',
        );
        return;
      }

      for (const neg of negotiations) {
        // Re-use the sendQuotationNotification logic for each active quotation
        await this.sendQuotationNotification(
          Number(neg.purchase_quotation_id),
          [supplierId],
          triggeredBy,
        );
      }
    } catch (err) {
      this.fastify.log.error(
        { err, supplierId },
        'Failed to process pending quotations notification',
      );
    }
  }

  /**
   * Sends an alert to Compras when a quotation expires with suppliers who didn't respond.
   */
  public async sendNoResponseAlert(quotationId: number, supplierIds: number[]): Promise<void> {
    try {
      const template = await this.getActiveTemplate(NotificationType.NO_RESPONSE_ALERT);

      // Fetch supplier names
      const { data: suppliers } = await this.fastify.supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);

      const supplierListHtml = (suppliers || [])
        .map((s) => `<li>${s.name} (ID: ${s.id})</li>`)
        .join('');

      const placeholders = {
        quotationId: quotationId.toString(),
        supplierList: supplierListHtml || '<li>Nenhum fornecedor identificado</li>',
      };

      const { valid, missing } = TemplateRenderer.validateTemplatePlaceholders(
        template.body_template,
        template.mandatory_placeholders as string[],
      );
      if (!valid) {
        this.fastify.log.error(
          { missing },
          'Template NO_RESPONSE_ALERT is missing mandatory placeholders',
        );
        return;
      }

      const subject = TemplateRenderer.renderTemplate(template.subject_template, placeholders);
      const body = TemplateRenderer.renderTemplate(template.body_template, placeholders);

      // Send to Compras team email (or a default internal email)
      const comprasEmail = process.env.COMPRAS_EMAIL || 'compras@grfincorporadora.com';

      // Insert log
      const { data: logEntry } = await this.fastify.supabase
        .from('notification_logs')
        .insert({
          template_id: template.id,
          template_version: template.version,
          type: NotificationType.NO_RESPONSE_ALERT,
          recipient_email: comprasEmail,
          quotation_id: quotationId,
          subject: subject,
          body_snapshot: body,
          status: NotificationStatus.SENT,
          triggered_by: null, // System
        })
        .select('id')
        .single();

      if (logEntry) {
        await this.fastify.boss?.send('notification:send-email', {
          notificationLogId: logEntry.id,
          recipientEmail: comprasEmail,
          subject,
          htmlBody: body,
        });
      }
    } catch (err) {
      this.fastify.log.error({ err, quotationId }, 'Failed to send no-response alert');
    }
  }
}
