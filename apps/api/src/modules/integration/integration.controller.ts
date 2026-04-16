import { FastifyRequest, FastifyReply } from 'fastify';
import {
  IntegrationEvent,
  IntegrationDirection,
  IntegrationEntityType,
  IntegrationEventStatus,
  IntegrationEventType,
} from '@projetog/domain';
import {
  Json,
  IntegrationEventIdParamDto,
  IntegrationEventsQueryDto,
  SiengeCredentialsBodyDto,
  WriteNegotiationBodyDto,
} from '@projetog/shared';
import { encryptSiengeCredential, decryptSiengeCredential } from '@projetog/integration-sienge';

interface RetryTarget {
  jobName: string;
  payload: Record<string, unknown>;
}

/**
 * Controller for integration events management.
 * Provides listing and manual retry capabilities for Compras/Admin roles.
 *
 * PRD-07 §6.6, §10
 */
export class IntegrationController {
  /**
   * Lists integration events with optional filters, pagination, and sorting.
   */
  async listEvents(
    request: FastifyRequest<{ Querystring: IntegrationEventsQueryDto }>,
    reply: FastifyReply,
  ) {
    const {
      status,
      event_type,
      direction,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = request.query;

    const supabase = request.server.supabase;

    let dbQuery = supabase.from('integration_events').select('*', { count: 'exact' });

    // ── Apply filters ─────────────────────────────────────────
    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (event_type) {
      dbQuery = dbQuery.eq('event_type', event_type);
    }

    if (direction) {
      dbQuery = dbQuery.eq('direction', direction);
    }

    if (date_from) {
      dbQuery = dbQuery.gte('created_at', date_from);
    }

    if (date_to) {
      dbQuery = dbQuery.lte('created_at', date_to);
    }

    // ── Pagination ────────────────────────────────────────────
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    dbQuery = dbQuery.range(from, to).order('created_at', { ascending: false });

    const { data, count, error } = await dbQuery;

    if (error) {
      request.log.error(error, 'Failed to list integration events');
      return reply.code(500).send({
        message: 'Erro ao buscar eventos de integração',
        error: error.message,
      });
    }

    return reply.code(200).send({
      data,
      pagination: {
        total: count || 0,
        page,
        limit,
      },
    });
  }

  /**
   * Manually retries a failed integration event.
   * Resets retry_count to 0 and re-enqueues the appropriate job.
   * Only accessible to Compras role.
   */
  async retryEvent(
    request: FastifyRequest<{ Params: IntegrationEventIdParamDto }>,
    reply: FastifyReply,
  ) {
    const { id } = request.params;
    const supabase = request.server.supabase;
    const boss = request.server.boss;
    const actorId = request.user.sub;

    // ── 1. Fetch the event ───────────────────────────────────
    const { data: event, error: fetchError } = await supabase
      .from('integration_events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return reply.code(404).send({ message: 'Evento de integração não encontrado' });
    }

    // ── 2. Validate the event can be retried ─────────────────
    if (event.status !== 'failure' && event.status !== 'retry_scheduled') {
      return reply.code(409).send({
        message: `Evento com status '${event.status}' não pode ser reprocessado`,
      });
    }

    const retryTarget = await IntegrationController.resolveRetryTarget(event, supabase);
    if (!retryTarget) {
      return reply.code(409).send({
        message: `Evento do tipo '${event.event_type}' não possui reprocessamento manual suportado`,
      });
    }

    if (!boss) {
      return reply.code(503).send({
        message: 'Fila de integração indisponível no momento',
      });
    }

    // ── 3. Reset for manual retry ────────────────────────────
    const integrationEvent = new IntegrationEvent({
      id: event.id,
      eventType: event.event_type as IntegrationEventType,
      direction: event.direction as IntegrationDirection,
      endpoint: event.endpoint,
      httpMethod: event.http_method,
      httpStatus: event.http_status ?? undefined,
      requestPayload: (event.request_payload as Record<string, unknown> | null) ?? undefined,
      responsePayload: (event.response_payload as Record<string, unknown> | null) ?? undefined,
      status: event.status as IntegrationEventStatus,
      errorMessage: event.error_message ?? undefined,
      retryCount: event.retry_count,
      maxRetries: event.max_retries,
      nextRetryAt: event.next_retry_at ? new Date(event.next_retry_at) : undefined,
      relatedEntityType: (event.related_entity_type as IntegrationEntityType | null) ?? undefined,
      relatedEntityId: event.related_entity_id ?? undefined,
      idempotencyKey: event.idempotency_key ?? undefined,
      createdAt: event.created_at ? new Date(event.created_at) : undefined,
      updatedAt: event.updated_at ? new Date(event.updated_at) : undefined,
    });
    integrationEvent.resetForManualRetry();
    const retryRecord = integrationEvent.toRecord();

    const { error: updateError } = await supabase
      .from('integration_events')
      .update({
        status: retryRecord.status as string,
        retry_count: retryRecord.retry_count as number,
        error_message: retryRecord.error_message as string | null,
        next_retry_at: retryRecord.next_retry_at as string | null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      request.log.error(updateError, 'Failed to reset integration event for retry');
      return reply.code(500).send({ message: 'Erro ao reprocessar evento' });
    }

    // ── 4. Re-enqueue appropriate job ────────────────────────
    try {
      await boss.send(
        retryTarget.jobName,
        {
          ...retryTarget.payload,
          integrationEventId: id,
          eventType: event.event_type,
          retriggeredBy: actorId,
        },
        {
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
          expireInHours: 1,
        },
      );

      request.log.info(
        { eventId: id, jobName: retryTarget.jobName, actorId },
        'Integration event re-enqueued for manual retry',
      );
    } catch (enqueueError: unknown) {
      request.log.error({ err: enqueueError, eventId: id }, 'Failed to enqueue retry job');
      return reply.code(500).send({ message: 'Erro ao enfileirar reprocessamento' });
    }

    // ── 5. Register audit for manual retry ───────────────────
    await supabase.from('audit_logs').insert({
      event_type: 'integration.manual_retry',
      actor_id: actorId,
      entity_type: 'integration_event',
      entity_id: id,
      metadata: { integration_event_id: id, event_type: event.event_type } as unknown as Json,
    });

    return reply.code(200).send({
      message: 'Evento enfileirado para reprocessamento',
      data: { id, status: 'retry_scheduled' },
    });
  }

  /**
   * Retrieves current active Sienge credentials (without the password).
   */
  async getCredentials(request: FastifyRequest, reply: FastifyReply) {
    const supabase = request.server.supabase;

    const { data, error } = await supabase
      .from('sienge_credentials')
      .select('id, subdomain, api_user, rest_rate_limit, bulk_rate_limit, updated_at')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      request.log.error(error, 'Failed to fetch credentials');
      return reply.code(500).send({ message: 'Erro ao buscar credenciais', error: error.message });
    }

    if (!data) {
      return reply.code(404).send({ message: 'Nenhuma credencial ativa encontrada' });
    }

    let username = '***REDACTED***';
    try {
      username = decryptSiengeCredential(data.api_user);
    } catch {
      // Ignore
    }

    return reply.code(200).send({
      id: data.id,
      subdomain: data.subdomain,
      api_user: username,
      rest_rate_limit: data.rest_rate_limit,
      bulk_rate_limit: data.bulk_rate_limit,
      updated_at: data.updated_at,
    });
  }

  /**
   * Updates or activates new Sienge credentials.
   * This deactivates the current credentials and inserts a new active row.
   */
  async updateCredentials(
    request: FastifyRequest<{ Body: SiengeCredentialsBodyDto }>,
    reply: FastifyReply,
  ) {
    const { subdomain, api_user, api_password, rest_rate_limit, bulk_rate_limit } = request.body;
    const supabase = request.server.supabase;
    const actorId = request.user.sub;

    const encryptedUser = encryptSiengeCredential(api_user);
    const encryptedPassword = encryptSiengeCredential(api_password);

    // Deactivate previous credentials
    await supabase.from('sienge_credentials').update({ is_active: false }).eq('is_active', true);

    const { data, error } = await supabase
      .from('sienge_credentials')
      .insert({
        subdomain,
        api_user: encryptedUser,
        api_password: encryptedPassword,
        rest_rate_limit,
        bulk_rate_limit,
        is_active: true,
      })
      .select('id, subdomain, rest_rate_limit, bulk_rate_limit, updated_at')
      .single();

    if (error) {
      request.log.error(error, 'Failed to update credentials');
      return reply.code(500).send({ message: 'Erro ao atualizar credenciais', error: error.message });
    }

    // Register audit
    await supabase.from('audit_logs').insert({
      event_type: 'integration.credentials_updated',
      actor_id: actorId,
      entity_type: 'sienge_credentials',
      entity_id: data.id,
      metadata: { subdomain, rest_rate_limit, bulk_rate_limit } as unknown as Json,
    });

    return reply.code(200).send({
      message: 'Credenciais atualizadas com sucesso',
      data,
    });
  }

  /**
   * Enqueues an approved negotiation to be written to Sienge.
   * Registers the integration_event and delegates effectively to the worker.
   */
  async writeNegotiation(
    request: FastifyRequest<{ Body: WriteNegotiationBodyDto }>,
    reply: FastifyReply,
  ) {
    const payload = request.body;
    const supabase = request.server.supabase;
    const boss = request.server.boss;
    const actorId = request.user.sub;

    if (!boss) {
      return reply.code(503).send({
        message: 'Fila de integração indisponível no momento',
      });
    }

    // Persist intent in integration_events
    const eventParams = {
      event_type: IntegrationEventType.WRITE_NEGOTIATION,
      direction: IntegrationDirection.OUTBOUND,
      endpoint: '/purchase-quotations/.../negotiations',
      http_method: 'POST/PUT/PATCH',
      status: IntegrationEventStatus.PENDING,
      request_payload: payload as unknown as Json,
      related_entity_type: IntegrationEntityType.QUOTATION,
      related_entity_id: String(payload.purchaseQuotationId),
      idempotency_key: payload.idempotencyKey,
      retry_count: 0,
      max_retries: 2, // as per PRD-07 §6.4
    };

    const { data: event, error: insertError } = await supabase
      .from('integration_events')
      .insert(eventParams)
      .select('id')
      .single();

    if (insertError) {
      // Check if duplicate idempotency key
      if (insertError.code === '23505') {
        return reply.code(409).send({
          message: 'Uma integração com esta chave de idempotência já está em andamento ou foi concluída.',
        });
      }
      request.log.error(insertError, 'Failed to insert WRITE_NEGOTIATION event');
      return reply.code(500).send({ message: 'Erro ao registrar evento de integração' });
    }

    // Format the payload exactly for the worker
    const jobPayload = {
      purchaseQuotationId: payload.purchaseQuotationId,
      supplierId: payload.supplierId,
      idempotencyKey: payload.idempotencyKey,
      items: payload.items,
      supplierAnswerDate: payload.supplierAnswerDate,
      validity: payload.validity,
      seller: payload.seller,
      actorId,
      integrationEventId: event.id,
    };

    try {
      await boss.send('sienge:outbound-negotiation', jobPayload, {
        retryLimit: 0, // Retries are handled by integration_events polling
        expireInHours: 1,
      });

      request.log.info(
        { eventId: event.id, quotationId: payload.purchaseQuotationId, supplierId: payload.supplierId },
        'Outbound negotiation enqueued',
      );
    } catch (enqueueError: unknown) {
      request.log.error({ err: enqueueError, eventId: event.id }, 'Failed to enqueue outbound negotiation');
      // Mark event as failed since it couldn't be queued
      await supabase.from('integration_events').update({ status: 'failure', error_message: 'Falha ao enfileirar job' }).eq('id', event.id);
      return reply.code(500).send({ message: 'Erro ao enfileirar envio para o Sienge' });
    }

    // Audit the action
    await supabase.from('audit_logs').insert({
      event_type: 'integration.outbound_enqueued',
      actor_id: actorId,
      entity_type: 'purchase_quotations',
      entity_id: String(payload.purchaseQuotationId),
      metadata: { supplier_id: payload.supplierId, integration_event_id: event.id } as unknown as Json,
    });

    return reply.code(202).send({
      message: 'Envio assíncrono para o Sienge iniciado',
      data: { eventId: event.id },
    });
  }

  /**
   * Resolves the pg-boss job name from an integration event type.
   */
  private static async resolveRetryTarget(
    event: {
      event_type: string;
      related_entity_id: string | null;
      request_payload?: unknown | null;
    },
    supabase: FastifyRequest['server']['supabase'],
  ): Promise<RetryTarget | null> {
    switch (event.event_type) {
      case IntegrationEventType.SYNC_QUOTATIONS:
        return { jobName: 'sienge:sync-quotations', payload: {} };
      case IntegrationEventType.SYNC_ORDERS:
        return { jobName: 'sienge:sync-orders', payload: {} };
      case IntegrationEventType.SYNC_DELIVERIES:
        return { jobName: 'sienge:sync-deliveries', payload: {} };
      case IntegrationEventType.WEBHOOK_RECEIVED:
      case IntegrationEventType.WEBHOOK_FAILED:
      case IntegrationEventType.WEBHOOK_PROCESSED: {
        if (!event.related_entity_id) {
          return null;
        }

        const { data: webhookEvent, error } = await supabase
          .from('webhook_events')
          .select('id, webhook_type, payload')
          .eq('id', event.related_entity_id)
          .single();

        if (error || !webhookEvent) {
          return null;
        }

        return {
          jobName: 'sienge:process-webhook',
          payload: {
            webhookEventId: webhookEvent.id,
            webhookType: webhookEvent.webhook_type,
            payload: webhookEvent.payload as Record<string, unknown>,
          },
        };
      }
      case IntegrationEventType.WRITE_NEGOTIATION:
      case IntegrationEventType.AUTHORIZE_NEGOTIATION:
        return {
          jobName: 'sienge:outbound-negotiation',
          payload: (event.request_payload as Record<string, unknown>) || {},
        };
      case IntegrationEventType.INTEGRATION_RETRY:
      case IntegrationEventType.RECONCILIATION_DIVERGENCE:
      case IntegrationEventType.SYNC_CREDITOR:
      default:
        return null;
    }
  }
}

