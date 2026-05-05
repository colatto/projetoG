import { randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import {
  IntegrationDirection,
  IntegrationEntityType,
  IntegrationEventStatus,
  IntegrationEventType,
} from '@projetog/domain';
import type {
  QuotationsQueryDto,
  QuotationIdParamDto,
  QuotationSendBodyDto,
  QuotationSupplierParamDto,
  QuotationReviewBodyDto,
  QuotationRespondBodyDto,
  Json,
  Database,
} from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';

type Supabase = FastifyInstance['supabase'];
type DeliveryInsert = Database['public']['Tables']['quotation_response_item_deliveries']['Insert'];

function asIsoOrNull(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  return s.length ? s : null;
}

async function getProfileSupplierId(supabase: Supabase, profileId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('supplier_id')
    .eq('id', profileId)
    .single();
  if (error) return null;
  return (data?.supplier_id as number | null) ?? null;
}

import { NotificationService } from '../notifications/notification.service.js';

/** PRD-09 RN-08 — negotiation statuses that require backoffice action (quotation slice). */
const QUOTATION_REQUIRE_ACTION_STATUSES = [
  'AGUARDANDO_REVISAO',
  'CORRECAO_SOLICITADA',
  'FORNECEDOR_INVALIDO_MAPA',
  'AGUARDANDO_REENVIO_SIENGE',
] as const;

export class QuotationsController {
  constructor(
    private audit: AuditService,
    private notificationService: NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Backoffice
  // ─────────────────────────────────────────────────────────────

  async listBackoffice(
    request: FastifyRequest<{ Querystring: QuotationsQueryDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const {
      status,
      supplier_id,
      date_from,
      date_to,
      require_action,
      page = 1,
      limit = 20,
    } = request.query;

    const negotiationInner = !!(status || supplier_id || require_action);

    const selectQuery = `
      id,
      public_id,
      quotation_date,
      response_date,
      end_date,
      end_at,
      sent_at,
      buyer_id,
      sienge_status,
      consistency,
      supplier_negotiations${negotiationInner ? '!inner' : ''} (
        id,
        supplier_id,
        status,
        read_at,
        sent_at,
        closed_order_id,
        latest_response_id,
        sienge_negotiation_id,
        sienge_negotiation_number,
        suppliers ( name )
      )
    `;

    let q = supabase.from('purchase_quotations').select(selectQuery, { count: 'exact' });

    if (date_from) q = q.gte('quotation_date', date_from);
    if (date_to) q = q.lte('quotation_date', date_to);
    if (require_action) {
      if (status) {
        if (
          !QUOTATION_REQUIRE_ACTION_STATUSES.includes(
            status as (typeof QUOTATION_REQUIRE_ACTION_STATUSES)[number],
          )
        ) {
          return reply.code(200).send({
            data: [],
            pagination: { total: 0, page, limit },
          });
        }
        q = q.eq('supplier_negotiations.status', status);
      } else {
        q = q.in('supplier_negotiations.status', [...QUOTATION_REQUIRE_ACTION_STATUSES]);
      }
    } else if (status) {
      q = q.eq('supplier_negotiations.status', status);
    }
    if (supplier_id) q = q.eq('supplier_negotiations.supplier_id', supplier_id);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    q = q.range(from, to).order('quotation_date', { ascending: false });

    const { data, count, error } = await q;
    if (error) {
      request.log.error({ err: error }, 'Failed to list quotations');
      return reply.code(500).send({ message: 'Erro ao listar cotações', error: error.message });
    }

    return reply.code(200).send({
      data: data ?? [],
      pagination: { total: count ?? 0, page, limit },
    });
  }

  async getBackofficeById(
    request: FastifyRequest<{ Params: QuotationIdParamDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const quotationId = request.params.quotation_id;

    const { data, error } = await supabase
      .from('purchase_quotations')
      .select(
        `
        *,
        purchase_quotation_items (*),
        supplier_negotiations (
          *,
          quotation_responses (
            *,
            quotation_response_items (
              *,
              quotation_response_item_deliveries (*)
            )
          )
        )
      `,
      )
      .eq('id', quotationId)
      .single();

    if (error || !data) {
      return reply.code(404).send({ message: 'Cotação não encontrada' });
    }

    return reply.code(200).send({ data });
  }

  async sendQuotation(
    request: FastifyRequest<{ Params: QuotationIdParamDto; Body: QuotationSendBodyDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const actorId = request.user.sub;
    const quotationId = request.params.quotation_id;
    const { end_at, end_date } = request.body ?? {};

    const { data: quotation, error: qError } = await supabase
      .from('purchase_quotations')
      .select('id, sent_at, end_at, end_date')
      .eq('id', quotationId)
      .single();

    if (qError || !quotation) {
      return reply.code(404).send({ message: 'Cotação não encontrada' });
    }

    if (quotation.sent_at) {
      return reply.code(409).send({ message: 'Cotação já foi enviada' });
    }

    const resolvedEndAt = end_at
      ? new Date(end_at).toISOString()
      : end_date
        ? new Date(`${end_date}T23:59:59.999Z`).toISOString()
        : quotation.end_at
          ? String(quotation.end_at)
          : quotation.end_date
            ? new Date(`${quotation.end_date}T23:59:59.999Z`).toISOString()
            : null;

    if (!resolvedEndAt) {
      return reply.code(422).send({ message: 'end_at (ou end_date) é obrigatório para envio' });
    }

    const { data: negotiations, error: nError } = await supabase
      .from('supplier_negotiations')
      .select('id, supplier_id')
      .eq('purchase_quotation_id', quotationId);

    if (nError || !negotiations?.length) {
      return reply.code(422).send({ message: 'Cotação não possui fornecedores para envio' });
    }

    const supplierIds = Array.from(new Set(negotiations.map((n) => n.supplier_id)));

    const [{ data: supplierProfiles }, { data: suppliers }] = await Promise.all([
      supabase
        .from('profiles')
        .select('supplier_id, role')
        .in('supplier_id', supplierIds)
        .eq('role', 'fornecedor'),
      supabase.from('suppliers').select('id, access_status').in('id', supplierIds),
    ]);

    const activeSupplierIds = new Set(
      (suppliers ?? []).filter((s) => s.access_status !== 'BLOCKED').map((s) => s.id as number),
    );
    const withAccessSupplierIds = new Set(
      (supplierProfiles ?? []).map((p) => p.supplier_id as number),
    );

    const eligibleSupplierIds = supplierIds.filter(
      (id) => activeSupplierIds.has(id) && withAccessSupplierIds.has(id),
    );

    if (!eligibleSupplierIds.length) {
      return reply.code(422).send({
        message: 'Nenhum fornecedor com acesso ativo disponível para envio',
      });
    }

    const nowIso = new Date().toISOString();

    // Update quotation (sent_at/sent_by/end_at)
    const { error: updateQuotationError } = await supabase
      .from('purchase_quotations')
      .update({
        sent_at: nowIso,
        sent_by: actorId,
        end_at: resolvedEndAt,
        updated_at: nowIso,
      })
      .eq('id', quotationId);

    if (updateQuotationError) {
      request.log.error({ err: updateQuotationError }, 'Failed to update quotation send status');
      return reply.code(500).send({ message: 'Erro ao enviar cotação' });
    }

    const eligibleNegotiationIds = negotiations
      .filter((n) => eligibleSupplierIds.includes(n.supplier_id as number))
      .map((n) => n.id);

    const { error: updateNegotiationsError } = await supabase
      .from('supplier_negotiations')
      .update({ sent_at: nowIso, updated_at: nowIso })
      .in('id', eligibleNegotiationIds);

    if (updateNegotiationsError) {
      request.log.warn(
        { err: updateNegotiationsError },
        'Failed to set sent_at per supplier_negotiation',
      );
    }

    await this.audit.registerEvent({
      eventType: 'quotation.sent',
      actorId,
      actorType: 'user',
      purchaseQuotationId: quotationId,
      summary: `Envio da cotação ${quotationId} a ${eligibleSupplierIds.length} fornecedor(es)`,
      metadata: {
        purchase_quotation_id: quotationId,
        suppliers_sent: eligibleSupplierIds.length,
      },
    });

    // PRD-03: Enqueue notification emails for eligible suppliers
    try {
      await this.notificationService.sendQuotationNotification(
        quotationId,
        eligibleSupplierIds,
        actorId,
      );
    } catch (notifyError) {
      request.log.warn({ err: notifyError }, 'Failed to enqueue quotation notifications');
      // Non-blocking: notification failure must not block quotation send
    }

    return reply.code(200).send({
      message: 'Cotação enviada com sucesso',
      sent_at: nowIso,
      suppliers_sent: eligibleSupplierIds.length,
      suppliers_skipped: supplierIds.length - eligibleSupplierIds.length,
    });
  }

  async reviewSupplierResponse(
    request: FastifyRequest<{ Params: QuotationSupplierParamDto; Body: QuotationReviewBodyDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const boss = request.server.boss;
    const actorId = request.user.sub;
    const { quotation_id, supplier_id } = request.params;
    const { action, notes } = request.body;

    const { data: negotiation, error: nError } = await supabase
      .from('supplier_negotiations')
      .select('id, latest_response_id')
      .eq('purchase_quotation_id', quotation_id)
      .eq('supplier_id', supplier_id)
      .single();

    if (nError || !negotiation) {
      return reply.code(404).send({ message: 'Fornecedor/cotação não encontrados' });
    }

    const responseQuery = supabase
      .from('quotation_responses')
      .select('id, review_status, integration_status, supplier_answer_date, validity, seller')
      .eq('supplier_negotiation_id', negotiation.id)
      .order('version', { ascending: false })
      .limit(1);

    const { data: latestResponse, error: rError } = negotiation.latest_response_id
      ? await supabase
          .from('quotation_responses')
          .select('id, review_status, integration_status, supplier_answer_date, validity, seller')
          .eq('id', negotiation.latest_response_id)
          .maybeSingle()
      : await responseQuery.maybeSingle();

    if (rError || !latestResponse) {
      return reply.code(422).send({ message: 'Não existe resposta pendente para revisar' });
    }

    if (latestResponse.review_status !== 'pending') {
      return reply.code(422).send({ message: 'A resposta não está pendente de revisão' });
    }

    const reviewStatus =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'correction_requested';

    const negotiationStatus =
      action === 'approve' ? 'APROVADA' : action === 'reject' ? 'REPROVADA' : 'CORRECAO_SOLICITADA';

    const nowIso = new Date().toISOString();

    const { error: updRespError } = await supabase
      .from('quotation_responses')
      .update({
        review_status: reviewStatus,
        reviewed_by: actorId,
        reviewed_at: nowIso,
        review_notes: asIsoOrNull(notes) ? notes : null,
        updated_at: nowIso,
      })
      .eq('id', latestResponse.id);

    if (updRespError) {
      request.log.error({ err: updRespError }, 'Failed to update quotation response review');
      return reply.code(500).send({ message: 'Erro ao revisar resposta' });
    }

    const { error: updNegError } = await supabase
      .from('supplier_negotiations')
      .update({ status: negotiationStatus, updated_at: nowIso })
      .eq('id', negotiation.id);

    if (updNegError) {
      request.log.warn({ err: updNegError }, 'Failed to update supplier_negotiations status');
    }

    const reviewSummary =
      reviewStatus === 'approved'
        ? `Aprovação da resposta do fornecedor ${supplier_id} na cotação ${quotation_id}`
        : reviewStatus === 'rejected'
          ? `Reprovação da resposta do fornecedor ${supplier_id} na cotação ${quotation_id}`
          : `Solicitação de correção ao fornecedor ${supplier_id} na cotação ${quotation_id}`;

    await this.audit.registerEvent({
      eventType: `quotation.response.${reviewStatus}`,
      actorId,
      actorType: 'user',
      purchaseQuotationId: quotation_id,
      supplierId: supplier_id,
      summary: reviewSummary,
      metadata: {
        purchase_quotation_id: quotation_id,
        supplier_id,
        quotation_response_id: latestResponse.id,
      },
    });

    if (action !== 'approve') {
      return reply.code(200).send({ review_status: reviewStatus, reviewed_at: nowIso });
    }

    if (!boss) {
      return reply.code(503).send({ message: 'Fila de integração indisponível no momento' });
    }

    // Build outbound payload from the approved response
    const { data: responseItems, error: itemsError } = await supabase
      .from('quotation_response_items')
      .select(
        `
        id,
        purchase_quotation_item_id,
        unit_price,
        negotiated_quantity,
        quotation_response_item_deliveries (
          delivery_number,
          delivery_date
        )
      `,
      )
      .eq('quotation_response_id', latestResponse.id);

    if (itemsError || !responseItems?.length) {
      return reply.code(422).send({ message: 'Resposta aprovada não possui itens' });
    }

    const jobItems = responseItems.map((it) => {
      const deliveries =
        (it.quotation_response_item_deliveries as Array<{
          delivery_number: number;
          delivery_date: string;
        }> | null) ?? [];

      deliveries.sort((a, b) => a.delivery_number - b.delivery_number);
      const firstDeliveryDate = deliveries[0]?.delivery_date;
      return {
        purchaseQuotationItemId: it.purchase_quotation_item_id,
        unitPrice: it.unit_price,
        quantity: it.negotiated_quantity,
        deliveryDate: firstDeliveryDate,
      };
    });

    if (jobItems.some((i) => !i.deliveryDate)) {
      return reply.code(422).send({ message: 'Itens da resposta não possuem data de entrega' });
    }

    const idempotencyKey = randomUUID();
    const eventParams = {
      event_type: IntegrationEventType.WRITE_NEGOTIATION,
      direction: IntegrationDirection.OUTBOUND,
      endpoint: `/purchase-quotations/${quotation_id}/suppliers/${supplier_id}/negotiations`,
      http_method: 'POST',
      status: IntegrationEventStatus.PENDING,
      request_payload: {
        purchaseQuotationId: quotation_id,
        supplierId: supplier_id,
        idempotencyKey,
        quotationResponseId: latestResponse.id,
        supplierAnswerDate: latestResponse.supplier_answer_date,
        validity: latestResponse.validity,
        seller: latestResponse.seller,
        items: jobItems,
      } as unknown as Json,
      related_entity_type: IntegrationEntityType.QUOTATION,
      related_entity_id: String(quotation_id),
      idempotency_key: idempotencyKey,
      retry_count: 0,
      max_retries: 2,
    };

    const { data: event, error: insertEventError } = await supabase
      .from('integration_events')
      .insert(eventParams)
      .select('id')
      .single();

    if (insertEventError) {
      if (insertEventError.code === '23505') {
        return reply.code(409).send({ message: 'Integração duplicada por idempotency_key' });
      }
      request.log.error({ err: insertEventError }, 'Failed to create integration event');
      return reply.code(500).send({ message: 'Erro ao registrar evento de integração' });
    }

    await supabase
      .from('quotation_responses')
      .update({ integration_status: 'pending' })
      .eq('id', latestResponse.id);

    await boss.send(
      'sienge:outbound-negotiation',
      {
        purchaseQuotationId: quotation_id,
        supplierId: supplier_id,
        idempotencyKey,
        quotationResponseId: latestResponse.id,
        supplierAnswerDate: latestResponse.supplier_answer_date,
        validity: latestResponse.validity,
        seller: latestResponse.seller,
        items: jobItems,
        integrationEventId: event.id,
      },
      { retryLimit: 0, expireInHours: 1 },
    );

    return reply.code(202).send({
      message: 'Resposta aprovada e enviada para integração assíncrona',
      data: { integration_event_id: event.id },
    });
  }

  async retryIntegration(
    request: FastifyRequest<{ Params: QuotationSupplierParamDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const boss = request.server.boss;
    const actorId = request.user.sub;
    const { quotation_id, supplier_id } = request.params;

    if (!boss) {
      return reply.code(503).send({ message: 'Fila de integração indisponível no momento' });
    }

    const { data: negotiation, error: nError } = await supabase
      .from('supplier_negotiations')
      .select('id, latest_response_id')
      .eq('purchase_quotation_id', quotation_id)
      .eq('supplier_id', supplier_id)
      .single();

    if (nError || !negotiation?.latest_response_id) {
      return reply.code(404).send({ message: 'Resposta não encontrada para reprocessamento' });
    }

    const { data: resp } = await supabase
      .from('quotation_responses')
      .select('id, review_status, integration_status, supplier_answer_date, validity, seller')
      .eq('id', negotiation.latest_response_id)
      .single();

    if (!resp || resp.review_status !== 'approved') {
      return reply.code(422).send({ message: 'Apenas respostas aprovadas podem ser reintegradas' });
    }

    if (resp.integration_status !== 'failed') {
      return reply.code(409).send({ message: 'Resposta não está em falha de integração' });
    }

    // Delegate: create new integration_event + enqueue outbound as in approve
    // (reuse reviewSupplierResponse approve path would require refactor; keep explicit here)
    const { data: responseItems } = await supabase
      .from('quotation_response_items')
      .select(
        `
        id,
        purchase_quotation_item_id,
        unit_price,
        negotiated_quantity,
        quotation_response_item_deliveries (
          delivery_number,
          delivery_date
        )
      `,
      )
      .eq('quotation_response_id', resp.id);

    const items = (responseItems ?? []).map((it) => {
      const deliveries = (
        (it.quotation_response_item_deliveries as Array<{
          delivery_number: number;
          delivery_date: string;
        }> | null) ?? []
      ).sort((a, b) => a.delivery_number - b.delivery_number);
      return {
        purchaseQuotationItemId: it.purchase_quotation_item_id,
        unitPrice: it.unit_price,
        quantity: it.negotiated_quantity,
        deliveryDate: deliveries[0]?.delivery_date,
      };
    });

    if (!items.length || items.some((i) => !i.deliveryDate)) {
      return reply
        .code(422)
        .send({ message: 'Resposta não possui itens/datas de entrega válidos' });
    }

    const idempotencyKey = randomUUID();
    const { data: event } = await supabase
      .from('integration_events')
      .insert({
        event_type: IntegrationEventType.WRITE_NEGOTIATION,
        direction: IntegrationDirection.OUTBOUND,
        endpoint: `/purchase-quotations/${quotation_id}/suppliers/${supplier_id}/negotiations`,
        http_method: 'POST',
        status: IntegrationEventStatus.PENDING,
        request_payload: {
          purchaseQuotationId: quotation_id,
          supplierId: supplier_id,
          idempotencyKey,
          quotationResponseId: resp.id,
          supplierAnswerDate: resp.supplier_answer_date,
          validity: resp.validity,
          seller: resp.seller,
          items,
        } as unknown as Json,
        related_entity_type: IntegrationEntityType.QUOTATION,
        related_entity_id: String(quotation_id),
        idempotency_key: idempotencyKey,
        retry_count: 0,
        max_retries: 2,
      })
      .select('id')
      .single();

    if (!event?.id) {
      return reply.code(500).send({ message: 'Erro ao registrar reprocessamento' });
    }

    await supabase
      .from('quotation_responses')
      .update({ integration_status: 'pending' })
      .eq('id', resp.id);

    await boss.send(
      'sienge:outbound-negotiation',
      {
        purchaseQuotationId: quotation_id,
        supplierId: supplier_id,
        idempotencyKey,
        quotationResponseId: resp.id,
        supplierAnswerDate: resp.supplier_answer_date,
        validity: resp.validity,
        seller: resp.seller,
        items,
        integrationEventId: event.id,
      },
      { retryLimit: 0, expireInHours: 1 },
    );

    await this.audit.registerEvent({
      eventType: 'quotation.integration.retry',
      actorId,
      actorType: 'user',
      purchaseQuotationId: quotation_id,
      supplierId: supplier_id,
      summary: `Reprocessamento de integração da cotação ${quotation_id} (fornecedor ${supplier_id})`,
      metadata: {
        purchase_quotation_id: quotation_id,
        supplier_id,
        integration_event_id: event.id,
      },
    });

    return reply
      .code(202)
      .send({ message: 'Reprocessamento enfileirado', data: { integration_event_id: event.id } });
  }

  // ─────────────────────────────────────────────────────────────
  // Supplier portal
  // ─────────────────────────────────────────────────────────────

  /**
   * RN-26 status priority for operational ordering in the supplier portal.
   * Lower number = higher priority in the list.
   * abertas pendentes > correção solicitada > em revisão > encerradas/integradas/sem resposta
   */
  private static readonly SUPPLIER_STATUS_PRIORITY: Record<string, number> = {
    AGUARDANDO_RESPOSTA: 0,
    CORRECAO_SOLICITADA: 1,
    AGUARDANDO_REVISAO: 2,
    APROVADA: 3,
    AGUARDANDO_REENVIO_SIENGE: 4,
    INTEGRADA_SIENGE: 5,
    SEM_RESPOSTA: 6,
    REPROVADA: 7,
    FORNECEDOR_FECHADO: 8,
    FORNECEDOR_INVALIDO_MAPA: 8,
    ENCERRADA: 9,
  };

  async listSupplier(request: FastifyRequest, reply: FastifyReply) {
    const supabase = request.server.supabase;
    const supplierId = await getProfileSupplierId(supabase, request.user.sub);
    if (!supplierId) return reply.code(403).send({ message: 'Perfil de fornecedor inválido' });

    const { data, error } = await supabase
      .from('supplier_negotiations')
      .select(
        `
        id,
        supplier_id,
        status,
        read_at,
        sent_at,
        closed_order_id,
        latest_response_id,
        purchase_quotation_id,
        purchase_quotations (
          id,
          public_id,
          quotation_date,
          response_date,
          end_date,
          end_at,
          sent_at
        )
      `,
      )
      .eq('supplier_id', supplierId);

    if (error) {
      request.log.error({ err: error }, 'Failed to list supplier quotations');
      return reply.code(500).send({ message: 'Erro ao listar cotações' });
    }

    // RN-26: Sort by operational priority, then by end_date ascending (most urgent first)
    const sorted = (data ?? []).sort((a, b) => {
      const priorityA = QuotationsController.SUPPLIER_STATUS_PRIORITY[a.status as string] ?? 99;
      const priorityB = QuotationsController.SUPPLIER_STATUS_PRIORITY[b.status as string] ?? 99;

      if (priorityA !== priorityB) return priorityA - priorityB;

      // Secondary sort: end_date ascending (most urgent deadline first)
      const pqA = a.purchase_quotations as {
        end_date?: string | null;
        end_at?: string | null;
      } | null;
      const pqB = b.purchase_quotations as {
        end_date?: string | null;
        end_at?: string | null;
      } | null;
      const endA = pqA?.end_at ?? pqA?.end_date ?? '';
      const endB = pqB?.end_at ?? pqB?.end_date ?? '';
      return endA.localeCompare(endB);
    });

    return reply.code(200).send({ data: sorted });
  }

  async getSupplierByQuotationId(
    request: FastifyRequest<{ Params: QuotationIdParamDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const supplierId = await getProfileSupplierId(supabase, request.user.sub);
    if (!supplierId) return reply.code(403).send({ message: 'Perfil de fornecedor inválido' });

    const quotationId = request.params.quotation_id;
    const { data, error } = await supabase
      .from('supplier_negotiations')
      .select(
        `
        *,
        purchase_quotations (*, purchase_quotation_items (*)),
        quotation_responses (
          *,
          quotation_response_items (*, quotation_response_item_deliveries(*))
        )
      `,
      )
      .eq('supplier_id', supplierId)
      .eq('purchase_quotation_id', quotationId)
      .single();

    if (error || !data) {
      return reply.code(404).send({ message: 'Cotação não encontrada' });
    }

    return reply.code(200).send({ data });
  }

  async markRead(request: FastifyRequest<{ Params: QuotationIdParamDto }>, reply: FastifyReply) {
    const supabase = request.server.supabase;
    const actorId = request.user.sub;
    const supplierId = await getProfileSupplierId(supabase, actorId);
    if (!supplierId) return reply.code(403).send({ message: 'Perfil de fornecedor inválido' });

    const quotationId = request.params.quotation_id;
    const { data: negotiation, error } = await supabase
      .from('supplier_negotiations')
      .select('id, read_at')
      .eq('supplier_id', supplierId)
      .eq('purchase_quotation_id', quotationId)
      .single();

    if (error || !negotiation) return reply.code(404).send({ message: 'Cotação não encontrada' });
    if (negotiation.read_at)
      return reply.code(409).send({ message: 'Cotação já marcada como lida' });

    const nowIso = new Date().toISOString();
    const { error: updError } = await supabase
      .from('supplier_negotiations')
      .update({ read_at: nowIso, updated_at: nowIso })
      .eq('id', negotiation.id);

    if (updError) return reply.code(500).send({ message: 'Erro ao marcar leitura' });

    await this.audit.registerEvent({
      eventType: 'quotation.read',
      actorId,
      actorType: 'user',
      purchaseQuotationId: quotationId,
      supplierId,
      summary: `Leitura da cotação ${quotationId} pelo fornecedor ${supplierId}`,
      metadata: { purchase_quotation_id: quotationId, supplier_id: supplierId },
    });

    return reply.code(200).send({ read_at: nowIso });
  }

  async respond(
    request: FastifyRequest<{ Params: QuotationIdParamDto; Body: QuotationRespondBodyDto }>,
    reply: FastifyReply,
  ) {
    const supabase = request.server.supabase;
    const actorId = request.user.sub;
    const supplierId = await getProfileSupplierId(supabase, actorId);
    if (!supplierId) return reply.code(403).send({ message: 'Perfil de fornecedor inválido' });

    const quotationId = request.params.quotation_id;

    const { data: negotiation, error: nError } = await supabase
      .from('supplier_negotiations')
      .select('id, status, latest_response_id')
      .eq('supplier_id', supplierId)
      .eq('purchase_quotation_id', quotationId)
      .single();

    if (nError || !negotiation) return reply.code(404).send({ message: 'Cotação não encontrada' });

    const { data: quotation } = await supabase
      .from('purchase_quotations')
      .select('end_at, end_date, sent_at')
      .eq('id', quotationId)
      .single();

    const endAt = quotation?.end_at
      ? new Date(String(quotation.end_at))
      : quotation?.end_date
        ? new Date(`${quotation.end_date}T23:59:59.999Z`)
        : null;

    if (!quotation?.sent_at) {
      return reply.code(422).send({ message: 'Cotação ainda não foi enviada' });
    }

    if (endAt && endAt.getTime() < Date.now()) {
      return reply.code(422).send({ message: 'Prazo da cotação encerrado' });
    }

    // block editing after approval/integration (simplificado: se existe resposta aprovada, não permite nova)
    if (negotiation.latest_response_id) {
      const { data: latest } = await supabase
        .from('quotation_responses')
        .select('review_status')
        .eq('id', negotiation.latest_response_id)
        .maybeSingle();
      if (latest?.review_status === 'approved') {
        return reply.code(422).send({ message: 'Resposta já aprovada; não é possível reenviar' });
      }
    }

    // Determine version
    const { data: latestVersionRow } = await supabase
      .from('quotation_responses')
      .select('version')
      .eq('supplier_negotiation_id', negotiation.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latestVersionRow?.version ?? 0) + 1;

    // Insert response
    const nowIso = new Date().toISOString();
    const { data: insertedResponse, error: insRespErr } = await supabase
      .from('quotation_responses')
      .insert({
        supplier_negotiation_id: negotiation.id,
        version: nextVersion,
        supplier_answer_date: request.body.supplierAnswerDate,
        validity: request.body.validity ?? null,
        seller: request.body.seller ?? null,
        discount: request.body.discount ?? null,
        freight_type: request.body.freightType ?? null,
        freight_type_for_order: request.body.freightTypeForOrder ?? null,
        freight_price: request.body.freightPrice ?? null,
        other_expenses: request.body.otherExpenses ?? null,
        apply_ipi_freight: request.body.applyIpiFreight ?? null,
        internal_notes: request.body.internalNotes ?? null,
        supplier_notes: request.body.supplierNotes ?? null,
        payment_terms: request.body.paymentTerms ?? null,
        review_status: 'pending',
        integration_status: 'not_sent',
        integration_attempts: 0,
        submitted_by: actorId,
        submitted_at: nowIso,
      })
      .select('id')
      .single();

    if (insRespErr || !insertedResponse) {
      request.log.error({ err: insRespErr }, 'Failed to insert quotation response');
      return reply.code(500).send({ message: 'Erro ao registrar resposta' });
    }

    // Insert items
    const itemsToInsert = request.body.items.map((it) => ({
      quotation_response_id: insertedResponse.id,
      purchase_quotation_item_id: it.purchaseQuotationItemId,
      quotation_item_number: it.quotationItemNumber,
      detail_id: it.detailId ?? null,
      trademark_id: it.trademarkId ?? null,
      quoted_quantity: it.quotedQuantity,
      negotiated_quantity: it.negotiatedQuantity,
      unit_price: it.unitPrice,
      discount: it.discount ?? null,
      discount_percentage: it.discountPercentage ?? null,
      increase_percentage: it.increasePercentage ?? null,
      ipi_tax_percentage: it.ipiTaxPercentage ?? null,
      iss_tax_percentage: it.issTaxPercentage ?? null,
      icms_tax_percentage: it.icmsTaxPercentage ?? null,
      freight_unit_price: it.freightUnitPrice ?? null,
      selected_option: it.selectedOption ?? null,
      internal_notes: it.internalNotes ?? null,
      supplier_notes: it.supplierNotes ?? null,
    }));

    const { data: insertedItems, error: insItemsErr } = await supabase
      .from('quotation_response_items')
      .insert(itemsToInsert)
      .select('id, purchase_quotation_item_id');

    if (insItemsErr || !insertedItems?.length) {
      await supabase.from('quotation_responses').delete().eq('id', insertedResponse.id);
      return reply.code(500).send({ message: 'Erro ao registrar itens da resposta' });
    }

    const itemIdByPurchaseQuotationItemId = new Map<number, string>();
    for (const row of insertedItems) {
      itemIdByPurchaseQuotationItemId.set(
        row.purchase_quotation_item_id as number,
        row.id as string,
      );
    }

    // Insert deliveries
    const deliveriesToInsert: DeliveryInsert[] = [];
    for (const it of request.body.items) {
      const itemId = itemIdByPurchaseQuotationItemId.get(it.purchaseQuotationItemId);
      if (!itemId) continue;
      it.deliveries.forEach((d, idx) => {
        deliveriesToInsert.push({
          quotation_response_item_id: itemId,
          delivery_number: idx + 1,
          delivery_date: d.deliveryDate,
          delivery_quantity: d.deliveryQuantity,
        });
      });
    }

    const { error: insDelErr } = await supabase
      .from('quotation_response_item_deliveries')
      .insert(deliveriesToInsert);

    if (insDelErr) {
      await supabase.from('quotation_responses').delete().eq('id', insertedResponse.id);
      return reply.code(500).send({ message: 'Erro ao registrar entregas' });
    }

    // Update negotiation pointers/status
    await supabase
      .from('supplier_negotiations')
      .update({
        status: 'AGUARDANDO_REVISAO',
        latest_response_id: insertedResponse.id,
        updated_at: nowIso,
      })
      .eq('id', negotiation.id);

    await this.audit.registerEvent({
      eventType: 'quotation.response.submitted',
      actorId,
      actorType: 'user',
      purchaseQuotationId: quotationId,
      supplierId,
      summary: `Resposta do fornecedor ${supplierId} na cotação ${quotationId} (versão ${nextVersion})`,
      metadata: {
        purchase_quotation_id: quotationId,
        supplier_id: supplierId,
        quotation_response_id: insertedResponse.id,
        version: nextVersion,
      },
    });

    return reply.code(201).send({ response_id: insertedResponse.id, version: nextVersion });
  }
}
