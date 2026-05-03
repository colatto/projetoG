import { FastifyInstance } from 'fastify';
import type { AuditLogWriteParams } from '@projetog/domain';
import { Database } from '@projetog/shared';

type InsertAuditLog = Database['public']['Tables']['audit_logs']['Insert'];

function toIsoTimestamp(v: Date | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  return v.toISOString();
}

export class AuditService {
  constructor(private fastify: FastifyInstance) {}

  /**
   * PRD-09 §7.9 — persist operational audit (append-only). Non-blocking on failure.
   * Alias: `registerEvent` matches PRD naming.
   */
  public async registerEvent(params: AuditLogWriteParams): Promise<void> {
    const ts = toIsoTimestamp(params.eventTimestamp) ?? new Date().toISOString();
    const logEntry: InsertAuditLog = {
      event_type: params.eventType,
      actor_id: params.actorId ?? null,
      target_user_id: params.targetUserId ?? null,
      metadata: (params.metadata ?? {}) as InsertAuditLog['metadata'],
      summary: params.summary ?? null,
      actor_type: params.actorType ?? 'user',
      event_timestamp: ts,
      purchase_quotation_id: params.purchaseQuotationId ?? null,
      purchase_order_id: params.purchaseOrderId ?? null,
      supplier_id: params.supplierId ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
    };

    const { error } = await this.fastify.supabase.from('audit_logs').insert(logEntry);

    if (error) {
      this.fastify.log.error(
        { err: error, context: 'AuditService' },
        'Falha ao registrar log de auditoria',
      );
    }
  }

  /** @deprecated Prefer `registerEvent`; kept for call sites using the older name. */
  public async log(params: AuditLogWriteParams): Promise<void> {
    return this.registerEvent(params);
  }
}
