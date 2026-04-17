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

  return {
    recipientCount: recipients.length,
    recipients,
  };
}
