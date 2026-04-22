import type { SupabaseClient } from '@supabase/supabase-js';
import { UserRole, UserStatus } from '@projetog/domain';
import type { Database, Json } from '@projetog/shared';

interface NotifyComprasInput {
  type: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

interface NotifyComprasResult {
  recipientCount: number;
  recipients: string[];
}

type WorkerSupabase = SupabaseClient<Database>;

/**
 * Persists operational notifications for all active `Compras` users.
 */
export async function notifyComprasAboutOperationalIssue(
  supabase: WorkerSupabase,
  input: NotifyComprasInput,
): Promise<NotifyComprasResult> {
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role, status');

  if (profilesError) {
    throw new Error(`Failed to resolve Compras recipients: ${profilesError.message}`);
  }

  const recipients = (profiles ?? [])
    .filter((profile) => profile.role === UserRole.COMPRAS && profile.status === UserStatus.ATIVO)
    .map((profile) => profile.email.trim())
    .filter((email) => email.length > 0);

  if (recipients.length === 0) {
    return { recipientCount: 0, recipients: [] };
  }

  const { error: notificationsError } = await supabase.from('notifications').insert(
    recipients.map((recipientEmail) => ({
      type: input.type,
      recipient_email: recipientEmail,
      status: 'SENT',
      sent_at: new Date().toISOString(),
    })),
  );

  if (notificationsError) {
    throw new Error(`Failed to persist operational notifications: ${notificationsError.message}`);
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    event_type: 'integration.notification_dispatched',
    actor_id: null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: {
      notification_type: input.type,
      recipients,
      correlation_id: input.correlationId,
      ...input.metadata,
    } as Json,
  });

  if (auditError) {
    console.warn(
      `[operational-notifications] Failed to audit notification dispatch for ${input.type}: ${auditError.message}`,
    );
  }

  return { recipientCount: recipients.length, recipients };
}

import { getBoss } from './boss.js';
import { NotificationType, NotificationStatus, TemplateRenderer } from '@projetog/domain';

export async function sendNoResponseEmailAlert(
  supabase: WorkerSupabase,
  quotationId: number,
  supplierIds: number[],
): Promise<void> {
  try {
    const { data: template } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('type', NotificationType.NO_RESPONSE_ALERT)
      .eq('is_active', true)
      .single();

    if (!template) {
      console.warn('Template NO_RESPONSE_ALERT not found');
      return;
    }

    const { data: suppliers } = await supabase
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

    const { valid } = TemplateRenderer.validateTemplatePlaceholders(
      template.body_template,
      template.mandatory_placeholders as string[],
    );
    if (!valid) {
      console.warn('Template NO_RESPONSE_ALERT is missing mandatory placeholders');
      return;
    }

    const subject = TemplateRenderer.renderTemplate(template.subject_template, placeholders);
    const body = TemplateRenderer.renderTemplate(template.body_template, placeholders);

    const comprasEmail = process.env.COMPRAS_EMAIL || 'compras@grfincorporadora.com';

    const { data: logEntry } = await supabase
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
        triggered_by: null,
      })
      .select('id')
      .single();

    if (logEntry) {
      await getBoss().send('notification:send-email', {
        notificationLogId: logEntry.id,
        recipientEmail: comprasEmail,
        subject,
        htmlBody: body,
      });
    }
  } catch (err: any) {
    console.error(`Failed to send no-response email alert: ${err.message}`);
  }
}
