import { FastifyInstance } from 'fastify';
import { AuditLogProps } from '@projetog/domain';
import { Database } from '@projetog/shared';

type InsertAuditLog = Database['public']['Tables']['audit_logs']['Insert'];

export class AuditService {
  constructor(private fastify: FastifyInstance) {}

  public async log(params: Omit<AuditLogProps, 'id' | 'createdAt'>): Promise<void> {
    const logEntry: InsertAuditLog = {
      event_type: params.eventType,
      actor_id: params.actorId || null,
      target_user_id: params.targetUserId || null,
      metadata: params.metadata || {},
    };

    const { error } = await this.fastify.supabase
      .from('audit_logs')
      .insert(logEntry);

    if (error) {
      this.fastify.log.error({ err: error, context: 'AuditService' }, 'Falha ao registrar log de auditoria');
      // Não propagar o erro para evitar que uma falha de auditoria indisponibilize rotas de leitura
      // Mas registrar como erro severo (ou reportar para APM/Sentry no futuro)
    }
  }
}
