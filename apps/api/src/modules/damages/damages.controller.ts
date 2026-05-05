import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CancelReplacementBodyDto,
  CreateDamageBodyDto,
  InformReplacementDateBodyDto,
  Json,
  ListDamagesQueryDto,
  ResolveDamageBodyDto,
  SuggestDamageActionBodyDto,
} from '@projetog/shared';
import {
  DamageAction,
  DamageReplacementScope,
  DamageReplacementStatus,
  DamageStatus,
  UserRole,
} from '@projetog/domain';
import { AuditService } from '../audit/audit.service.js';

type AuthenticatedRequest = FastifyRequest;
type JsonObject = { [key: string]: Json | undefined };

function mapActionToDb(action?: string | null): DamageAction | null {
  if (!action) return null;
  if (action === 'cancelamento_parcial') return DamageAction.CANCELAMENTO_PARCIAL;
  if (action === 'cancelamento_total') return DamageAction.CANCELAMENTO_TOTAL;
  return DamageAction.REPOSICAO;
}

function mapStatusFromDb(status: DamageStatus): string {
  switch (status) {
    case DamageStatus.REGISTRADA:
      return 'registrada';
    case DamageStatus.SUGESTAO_PENDENTE:
      return 'sugestao_pendente';
    case DamageStatus.ACAO_DEFINIDA:
      return 'acao_definida';
    case DamageStatus.EM_REPOSICAO:
      return 'em_reposicao';
    case DamageStatus.CANCELAMENTO_APLICADO:
      return 'cancelamento_aplicado';
    default:
      return 'resolvida';
  }
}

export class DamagesController {
  private readonly audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private async resolveSupplierId(profileId: string): Promise<number | null> {
    const { data } = await this.app.supabase
      .from('profiles')
      .select('supplier_id')
      .eq('id', profileId)
      .single();
    return data?.supplier_id ?? null;
  }

  private async notifyCompras(type: string, metadata: JsonObject) {
    const { data: comprasProfiles } = await this.app.supabase
      .from('profiles')
      .select('email, role, status')
      .eq('role', UserRole.COMPRAS)
      .eq('status', 'ativo');

    const now = new Date().toISOString();
    const rows = (comprasProfiles || []).map((profile) => ({
      type,
      recipient_email: profile.email,
      status: 'SENT',
      sent_at: now,
    }));

    if (rows.length > 0) {
      await this.app.supabase.from('notifications').insert(rows);
    }

    await this.audit.registerEvent({
      eventType: 'damage_notification_dispatched',
      actorType: 'system',
      entityType: 'damage',
      entityId: String(metadata.damageId || ''),
      summary: 'Notificação operacional de avaria enviada',
      metadata: metadata as Record<string, unknown>,
    });
  }

  private async appendDamageAudit(input: {
    damageId: string;
    eventType: string;
    actorUserId?: string | null;
    actorProfile?: 'fornecedor' | 'compras' | 'sistema' | null;
    details?: JsonObject;
    purchaseOrderId: number;
    supplierId: number;
  }) {
    await this.app.supabase.from('damage_audit_logs').insert({
      damage_id: input.damageId,
      event_type: input.eventType,
      actor_user_id: input.actorUserId ?? null,
      actor_profile: input.actorProfile ?? null,
      details: input.details ?? {},
      purchase_order_id: input.purchaseOrderId,
      supplier_id: input.supplierId,
    });
  }

  private async recomputeOrderStatusFromDamages(purchaseOrderId: number, actorId: string | null) {
    const { data: order } = await this.app.supabase
      .from('purchase_orders')
      .select('local_status')
      .eq('id', purchaseOrderId)
      .single();

    if (!order) return;

    const { data: activeDamages } = await this.app.supabase
      .from('damages')
      .select('status, final_action')
      .eq('purchase_order_id', purchaseOrderId)
      .in('status', [
        DamageStatus.REGISTRADA,
        DamageStatus.SUGESTAO_PENDENTE,
        DamageStatus.ACAO_DEFINIDA,
        DamageStatus.EM_REPOSICAO,
      ]);

    // PRD-06 §14 + OrderStatusEngine (PRD-05): EM_AVARIA precede REPOSICAO.
    // hasAvaria = decisão pendente; hasReposicao = reposição em andamento (sem pendência).
    const hasAvaria = (activeDamages || []).some((d) =>
      [
        DamageStatus.REGISTRADA,
        DamageStatus.SUGESTAO_PENDENTE,
        DamageStatus.ACAO_DEFINIDA,
      ].includes(d.status as DamageStatus),
    );
    const hasReposicao = (activeDamages || []).some((d) => d.status === DamageStatus.EM_REPOSICAO);

    const targetStatus = hasAvaria ? 'EM_AVARIA' : hasReposicao ? 'REPOSICAO' : null;
    if (!targetStatus || targetStatus === order.local_status) return;

    await this.app.supabase
      .from('purchase_orders')
      .update({ local_status: targetStatus })
      .eq('id', purchaseOrderId);

    await this.app.supabase.from('order_status_history').insert({
      purchase_order_id: purchaseOrderId,
      previous_status: order.local_status,
      new_status: targetStatus,
      reason: 'Atualização por fluxo de avaria (PRD-06)',
      changed_by: actorId,
      changed_by_system: actorId ? false : true,
    });
  }

  async createDamage(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const body = request.body as CreateDamageBodyDto;

    const { data: order } = await this.app.supabase
      .from('purchase_orders')
      .select('id, supplier_id, building_id, local_status')
      .eq('id', body.purchase_order_id)
      .single();
    if (!order) return reply.notFound('Pedido não encontrado');

    const { data: item } = await this.app.supabase
      .from('purchase_order_items')
      .select('id')
      .eq('purchase_order_id', body.purchase_order_id)
      .eq('item_number', body.purchase_order_item_number)
      .single();
    if (!item) return reply.notFound('Item do pedido não encontrado');

    if (user.role === UserRole.FORNECEDOR) {
      const ownSupplierId = await this.resolveSupplierId(user.sub);
      if (!ownSupplierId || ownSupplierId !== order.supplier_id) {
        return reply.forbidden('Acesso negado ao pedido');
      }
    }

    const suggestedAction = mapActionToDb(body.suggested_action ?? null);
    const now = new Date().toISOString();
    const initialStatus = suggestedAction
      ? DamageStatus.SUGESTAO_PENDENTE
      : DamageStatus.REGISTRADA;

    const { data: created, error } = await this.app.supabase
      .from('damages')
      .insert({
        purchase_order_id: body.purchase_order_id,
        item_number: body.purchase_order_item_number,
        reported_by: user.sub,
        reported_by_profile: user.role === UserRole.FORNECEDOR ? 'fornecedor' : 'compras',
        description: body.description,
        affected_quantity: body.affected_quantity ?? null,
        suggested_action: suggestedAction,
        suggested_action_notes: body.suggested_action_notes ?? null,
        suggested_at: suggestedAction ? now : null,
        supplier_id: order.supplier_id,
        building_id: order.building_id ?? null,
        status: initialStatus,
      })
      .select('id, status, created_at')
      .single();

    if (error || !created) {
      request.log.error(error);
      return reply.internalServerError('Falha ao registrar avaria');
    }

    await this.appendDamageAudit({
      damageId: created.id,
      eventType: 'avaria_registrada',
      actorUserId: user.sub,
      actorProfile: user.role === UserRole.FORNECEDOR ? 'fornecedor' : 'compras',
      details: {
        purchase_order_item_number: body.purchase_order_item_number,
        suggested_action: body.suggested_action ?? null,
      },
      purchaseOrderId: body.purchase_order_id,
      supplierId: order.supplier_id,
    });

    if (body.suggested_action) {
      await this.appendDamageAudit({
        damageId: created.id,
        eventType: 'sugestao_enviada',
        actorUserId: user.sub,
        actorProfile: 'fornecedor',
        details: { suggested_action: body.suggested_action },
        purchaseOrderId: body.purchase_order_id,
        supplierId: order.supplier_id,
      });
      await this.notifyCompras('DAMAGE_SUGGESTION_PENDING', {
        damageId: created.id,
        purchaseOrderId: body.purchase_order_id,
      });
    }

    await this.recomputeOrderStatusFromDamages(body.purchase_order_id, user.sub);

    await this.audit.registerEvent({
      eventType: 'damage_registered',
      actorId: user.sub,
      actorType: 'user',
      purchaseOrderId: body.purchase_order_id,
      supplierId: order.supplier_id,
      entityType: 'damage',
      entityId: created.id,
      summary: `Registro de avaria no pedido ${body.purchase_order_id}`,
      metadata: {
        purchaseOrderId: body.purchase_order_id,
        itemNumber: body.purchase_order_item_number,
        status: created.status,
      },
    });

    return reply.code(201).send({
      id: created.id,
      status: mapStatusFromDb(created.status as DamageStatus),
      created_at: created.created_at,
    });
  }

  async suggestAction(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const { damageId } = request.params as { damageId: string };
    const body = request.body as SuggestDamageActionBodyDto;

    const { data: damage } = await this.app.supabase
      .from('damages')
      .select('id, purchase_order_id, supplier_id, final_action, suggested_action')
      .eq('id', damageId)
      .single();
    if (!damage) return reply.notFound('Avaria não encontrada');

    const ownSupplierId = await this.resolveSupplierId(user.sub);
    if (!ownSupplierId || ownSupplierId !== damage.supplier_id) {
      return reply.forbidden('Acesso negado');
    }
    if (damage.final_action) {
      return reply.conflict('Ação corretiva final já definida');
    }

    const now = new Date().toISOString();
    const action = mapActionToDb(body.suggested_action);
    const { error } = await this.app.supabase
      .from('damages')
      .update({
        suggested_action: action,
        suggested_action_notes: body.suggested_action_notes ?? null,
        suggested_at: now,
        status: DamageStatus.SUGESTAO_PENDENTE,
      })
      .eq('id', damageId);

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Falha ao registrar sugestão');
    }

    await this.appendDamageAudit({
      damageId,
      eventType: 'sugestao_enviada',
      actorUserId: user.sub,
      actorProfile: 'fornecedor',
      details: { suggested_action: body.suggested_action },
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    await this.notifyCompras('DAMAGE_SUGGESTION_PENDING', {
      damageId,
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    return reply.send({
      id: damageId,
      status: 'sugestao_pendente',
      suggested_at: now,
    });
  }

  async resolveAction(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const { damageId } = request.params as { damageId: string };
    const body = request.body as ResolveDamageBodyDto;

    const { data: damage } = await this.app.supabase
      .from('damages')
      .select('id, purchase_order_id, supplier_id, final_action, suggested_action')
      .eq('id', damageId)
      .single();
    if (!damage) return reply.notFound('Avaria não encontrada');
    if (damage.final_action) return reply.conflict('Ação corretiva final já definida');

    const finalAction = mapActionToDb(body.final_action);
    const now = new Date().toISOString();
    const damageStatus =
      finalAction === DamageAction.REPOSICAO
        ? DamageStatus.EM_REPOSICAO
        : DamageStatus.CANCELAMENTO_APLICADO;

    const { error } = await this.app.supabase
      .from('damages')
      .update({
        final_action: finalAction,
        approved_action: finalAction,
        final_action_notes: body.final_action_notes ?? null,
        final_action_decided_by: user.sub,
        final_action_decided_at: now,
        status: damageStatus,
      })
      .eq('id', damageId);

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Falha ao definir ação corretiva');
    }

    let replacementId: string | null = null;
    if (finalAction === DamageAction.REPOSICAO) {
      const { data: replacement } = await this.app.supabase
        .from('damage_replacements')
        .insert({
          damage_id: damageId,
          informed_by: user.sub,
          informed_at: now,
          new_promised_date: new Date(now).toISOString().slice(0, 10),
          replacement_status: DamageReplacementStatus.AGUARDANDO_DATA,
          replacement_scope: DamageReplacementScope.ITEM,
          notes: 'Aguardando fornecedor informar nova data prometida.',
        })
        .select('id')
        .single();
      replacementId = replacement?.id ?? null;
    }

    await this.appendDamageAudit({
      damageId,
      eventType: 'acao_corretiva_definida',
      actorUserId: user.sub,
      actorProfile: 'compras',
      details: { final_action: body.final_action, replacement_id: replacementId },
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    await this.audit.registerEvent({
      eventType: 'corrective_action_defined',
      actorId: user.sub,
      actorType: 'user',
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
      entityType: 'damage',
      entityId: damageId,
      summary: `Ação corretiva definida: ${body.final_action} (avaria ${damageId})`,
      metadata: {
        final_action: body.final_action,
        replacement_id: replacementId,
      },
    });

    if (damage.suggested_action) {
      const suggestionAccepted = damage.suggested_action === finalAction;
      await this.appendDamageAudit({
        damageId,
        eventType: suggestionAccepted ? 'sugestao_aceita' : 'sugestao_recusada',
        actorUserId: user.sub,
        actorProfile: 'compras',
        details: suggestionAccepted
          ? undefined
          : {
              suggested_action: String(damage.suggested_action).toLowerCase(),
              final_action: body.final_action,
            },
        purchaseOrderId: damage.purchase_order_id,
        supplierId: damage.supplier_id,
      });
    }

    if (finalAction === DamageAction.REPOSICAO) {
      await this.appendDamageAudit({
        damageId,
        eventType: 'reposicao_criada',
        actorUserId: user.sub,
        actorProfile: 'compras',
        details: {
          replacement_id: replacementId,
          replacement_scope: 'item',
        },
        purchaseOrderId: damage.purchase_order_id,
        supplierId: damage.supplier_id,
      });
    } else {
      await this.appendDamageAudit({
        damageId,
        eventType: 'cancelamento_aplicado',
        actorUserId: user.sub,
        actorProfile: 'compras',
        details: { cancellation_scope: body.final_action },
        purchaseOrderId: damage.purchase_order_id,
        supplierId: damage.supplier_id,
      });
    }

    if (finalAction === DamageAction.CANCELAMENTO_TOTAL) {
      const { data: order } = await this.app.supabase
        .from('purchase_orders')
        .select('local_status')
        .eq('id', damage.purchase_order_id)
        .single();

      await this.app.supabase
        .from('purchase_orders')
        .update({ local_status: 'CANCELADO' })
        .eq('id', damage.purchase_order_id);

      await this.app.supabase
        .from('follow_up_trackers')
        .update({ status: 'ENCERRADO' })
        .eq('purchase_order_id', damage.purchase_order_id)
        .neq('status', 'ENCERRADO');

      await this.app.supabase.from('order_status_history').insert({
        purchase_order_id: damage.purchase_order_id,
        previous_status: order?.local_status ?? null,
        new_status: 'CANCELADO',
        reason: 'Cancelamento total por ação corretiva de avaria',
        changed_by: user.sub,
        changed_by_system: false,
      });

      await this.appendDamageAudit({
        damageId,
        eventType: 'pedido_cancelado_total',
        actorUserId: user.sub,
        actorProfile: 'compras',
        details: { final_action: body.final_action },
        purchaseOrderId: damage.purchase_order_id,
        supplierId: damage.supplier_id,
      });
    } else {
      await this.recomputeOrderStatusFromDamages(damage.purchase_order_id, user.sub);
    }

    return reply.send({
      id: damageId,
      status: mapStatusFromDb(damageStatus),
      final_action: body.final_action,
      final_action_decided_at: now,
      replacement_id: replacementId,
    });
  }

  async informReplacementDate(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const { damageId } = request.params as { damageId: string };
    const body = request.body as InformReplacementDateBodyDto;
    const date = new Date(body.new_promised_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date <= today) {
      return reply.unprocessableEntity('A nova data deve ser futura');
    }

    const { data: damage } = await this.app.supabase
      .from('damages')
      .select('id, purchase_order_id, supplier_id, final_action')
      .eq('id', damageId)
      .single();
    if (!damage) return reply.notFound('Avaria não encontrada');
    if (damage.final_action !== DamageAction.REPOSICAO) {
      return reply.conflict('Avaria não está em fluxo de reposição');
    }

    const ownSupplierId = await this.resolveSupplierId(user.sub);
    if (!ownSupplierId || ownSupplierId !== damage.supplier_id) {
      return reply.forbidden('Acesso negado');
    }

    const { data: replacement } = await this.app.supabase
      .from('damage_replacements')
      .select('id, replacement_status')
      .eq('damage_id', damageId)
      .single();
    if (!replacement) return reply.notFound('Reposição não encontrada');
    if (
      replacement.replacement_status === DamageReplacementStatus.ENTREGUE ||
      replacement.replacement_status === DamageReplacementStatus.CANCELADO
    ) {
      return reply.conflict('Reposição já finalizada');
    }

    await this.app.supabase
      .from('damage_replacements')
      .update({
        new_promised_date: body.new_promised_date,
        informed_by: user.sub,
        informed_at: new Date().toISOString(),
        replacement_status: DamageReplacementStatus.EM_ANDAMENTO,
        replacement_scope:
          body.replacement_scope === 'pedido'
            ? DamageReplacementScope.PEDIDO
            : DamageReplacementScope.ITEM,
        notes: body.notes ?? null,
      })
      .eq('id', replacement.id);

    await this.app.supabase
      .from('damages')
      .update({ status: DamageStatus.EM_REPOSICAO })
      .eq('id', damageId);

    await this.recomputeOrderStatusFromDamages(damage.purchase_order_id, user.sub);

    await this.app.supabase
      .from('follow_up_trackers')
      .update({
        status: 'ATIVO',
        promised_date_current: body.new_promised_date,
        current_notification_number: 0,
        next_notification_date: body.new_promised_date,
        paused_at: null,
      })
      .eq('purchase_order_id', damage.purchase_order_id);

    await this.appendDamageAudit({
      damageId,
      eventType: 'data_reposicao_informada',
      actorUserId: user.sub,
      actorProfile: 'fornecedor',
      details: { new_promised_date: body.new_promised_date },
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    return reply.send({
      replacement_id: replacement.id,
      replacement_status: 'em_andamento',
      new_promised_date: body.new_promised_date,
    });
  }

  async cancelReplacement(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const { damageId } = request.params as { damageId: string };
    const body = request.body as CancelReplacementBodyDto;

    const { data: damage } = await this.app.supabase
      .from('damages')
      .select('id, purchase_order_id, supplier_id, final_action')
      .eq('id', damageId)
      .single();
    if (!damage) return reply.notFound('Avaria não encontrada');
    if (damage.final_action !== DamageAction.REPOSICAO) {
      return reply.conflict('Avaria não está em fluxo de reposição');
    }

    const { data: replacement } = await this.app.supabase
      .from('damage_replacements')
      .select('id, replacement_status')
      .eq('damage_id', damageId)
      .single();
    if (!replacement) return reply.notFound('Reposição não encontrada');
    if (replacement.replacement_status === DamageReplacementStatus.ENTREGUE) {
      return reply.conflict('Reposição já finalizada');
    }
    if (replacement.replacement_status === DamageReplacementStatus.CANCELADO) {
      return reply.conflict('Reposição já cancelada');
    }

    await this.app.supabase
      .from('damage_replacements')
      .update({
        replacement_status: DamageReplacementStatus.CANCELADO,
        notes: body.cancellation_reason ?? null,
      })
      .eq('id', replacement.id);

    await this.app.supabase
      .from('damages')
      .update({
        status: DamageStatus.CANCELAMENTO_APLICADO,
        final_action_notes: body.cancellation_reason ?? null,
      })
      .eq('id', damageId);

    await this.appendDamageAudit({
      damageId,
      eventType: 'reposicao_cancelada',
      actorUserId: user.sub,
      actorProfile: 'compras',
      details: { cancellation_reason: body.cancellation_reason ?? null },
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    await this.appendDamageAudit({
      damageId,
      eventType: 'cancelamento_aplicado',
      actorUserId: user.sub,
      actorProfile: 'compras',
      details: { cancellation_scope: 'cancelamento_parcial' },
      purchaseOrderId: damage.purchase_order_id,
      supplierId: damage.supplier_id,
    });

    await this.recomputeOrderStatusFromDamages(damage.purchase_order_id, user.sub);

    return reply.send({
      replacement_id: replacement.id,
      replacement_status: 'cancelado',
      damage_status: 'cancelamento_aplicado',
    });
  }

  async listDamages(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const query = request.query as ListDamagesQueryDto;
    const page = query.page ?? 1;
    const perPage = query.per_page ?? 20;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let supplierFilter = query.supplier_id;
    if (user.role === UserRole.FORNECEDOR) {
      supplierFilter = (await this.resolveSupplierId(user.sub)) ?? undefined;
    }

    let dbQuery = this.app.supabase
      .from('damages')
      .select('*, damage_replacements(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.purchase_order_id) dbQuery = dbQuery.eq('purchase_order_id', query.purchase_order_id);
    if (supplierFilter) dbQuery = dbQuery.eq('supplier_id', supplierFilter);
    if (query.building_id) dbQuery = dbQuery.eq('building_id', query.building_id);
    if (query.status) dbQuery = dbQuery.eq('status', query.status.toUpperCase());

    const { data, count, error } = await dbQuery;
    if (error) {
      request.log.error(error);
      return reply.internalServerError('Erro ao listar avarias');
    }

    const normalized = (data || []).map((row) => ({
      ...row,
      status: mapStatusFromDb(row.status as DamageStatus),
    }));

    return reply.send({
      data: normalized,
      pagination: {
        total: count ?? 0,
        page,
        per_page: perPage,
      },
    });
  }

  async getDamage(request: AuthenticatedRequest, reply: FastifyReply) {
    const user = request.user;
    const { damageId } = request.params as { damageId: string };

    const { data: damage, error } = await this.app.supabase
      .from('damages')
      .select('*, damage_replacements(*), damage_audit_logs(*)')
      .eq('id', damageId)
      .single();

    if (error || !damage) return reply.notFound('Avaria não encontrada');
    if (user.role === UserRole.FORNECEDOR) {
      const ownSupplierId = await this.resolveSupplierId(user.sub);
      if (!ownSupplierId || ownSupplierId !== damage.supplier_id) {
        return reply.forbidden('Acesso negado');
      }
    }

    return reply.send({
      ...damage,
      status: mapStatusFromDb(damage.status as DamageStatus),
    });
  }

  async listAudit(request: AuthenticatedRequest, reply: FastifyReply) {
    const { damageId } = request.params as { damageId: string };
    const { data, error } = await this.app.supabase
      .from('damage_audit_logs')
      .select('*')
      .eq('damage_id', damageId)
      .order('created_at', { ascending: false });

    if (error) {
      request.log.error(error);
      return reply.internalServerError('Erro ao listar auditoria');
    }

    return reply.send(data || []);
  }
}
