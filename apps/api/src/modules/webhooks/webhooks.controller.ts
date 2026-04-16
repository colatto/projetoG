import { FastifyRequest, FastifyReply } from 'fastify';
import {
  WebhookType,
  WebhookEvent,
  IntegrationEventType,
  IntegrationDirection,
  IntegrationEntityType,
} from '@projetog/domain';
import { sanitizeForLog, Json } from '@projetog/shared';

/**
 * Controller for Sienge webhook reception.
 * Validates secret, persists webhook_events, logs integration_event,
 * and enqueues async processing via pg-boss.
 *
 * PRD-07 §6.5, §9.2
 */
export class WebhookController {
  /**
   * Maps webhook types to their related entity type for integration event tracking.
   */
  private static readonly ENTITY_TYPE_MAP: Partial<Record<WebhookType, IntegrationEntityType>> = {
    [WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION]: IntegrationEntityType.ORDER,
    [WebhookType.PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED]:
      IntegrationEntityType.QUOTATION,
    [WebhookType.PURCHASE_ORDER_AUTHORIZATION_CHANGED]: IntegrationEntityType.ORDER,
    [WebhookType.PURCHASE_ORDER_ITEM_MODIFIED]: IntegrationEntityType.ORDER,
    [WebhookType.PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED]: IntegrationEntityType.ORDER,
  };

  async receiveWebhook(request: FastifyRequest, reply: FastifyReply) {
    const body = (request.body || {}) as Record<string, unknown>;
    const type = body.type as WebhookType;
    const data = (body.data || {}) as Record<string, unknown>;

    const supabase = request.server.supabase;
    const boss = request.server.boss;
    const siengeDeliveryId = WebhookController.getHeaderValue(request.headers['x-sienge-id']);

    let fallbackTenant: string | undefined;
    if (typeof data.tenant === 'string') {
      fallbackTenant = data.tenant;
    } else if (typeof body.tenant === 'string') {
      fallbackTenant = body.tenant;
    }

    let fallbackHookId: string | undefined;
    if (typeof data.hookId === 'string') {
      fallbackHookId = data.hookId;
    } else if (typeof body.hookId === 'string') {
      fallbackHookId = body.hookId;
    }

    const siengeTenant =
      WebhookController.getHeaderValue(request.headers['x-sienge-tenant']) ?? fallbackTenant;
    const siengeHookId =
      WebhookController.getHeaderValue(request.headers['x-sienge-hook-id']) ?? fallbackHookId;

    const siengeEvent = WebhookController.getHeaderValue(request.headers['x-sienge-event']);

    if (!siengeDeliveryId || !siengeEvent) {
      return reply.code(400).send({ message: 'Missing required Sienge webhook headers' });
    }

    if (siengeEvent !== type) {
      request.log.warn(
        { bodyType: type, siengeEvent, siengeDeliveryId },
        'Sienge webhook header does not match body type',
      );
      return reply.code(400).send({ message: 'Sienge webhook event mismatch' });
    }

    const { data: existingWebhook, error: existingWebhookError } = await supabase
      .from('webhook_events')
      .select('id, status')
      // @ts-expect-error - fields missing in database.types.ts
      .eq('sienge_delivery_id', siengeDeliveryId)
      .maybeSingle();

    if (existingWebhookError) {
      request.log.error(
        { err: existingWebhookError, siengeDeliveryId },
        'Failed to check existing webhook delivery',
      );
      return reply.code(500).send({ message: 'Erro ao validar entrega do webhook' });
    }

    if (existingWebhook) {
      request.log.info(
        { siengeDeliveryId, webhookEventId: existingWebhook.id, status: existingWebhook.status },
        'Duplicate Sienge webhook delivery received',
      );
      return reply.code(200).send({ status: 'duplicate' });
    }

    const webhookEventRecord = new WebhookEvent({
      webhookType: type,
      payload: data,
      siengeDeliveryId,
      siengeHookId,
      siengeEvent,
      siengeTenant,
    }).toRecord();

    request.log.info(
      {
        webhookType: type,
        siengeDeliveryId,
        siengeHookId,
        siengeTenant,
        payload: sanitizeForLog(data),
      },
      'Webhook received from Sienge',
    );

    // ── 1. Persist webhook event (status: received) ──────────────
    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        webhook_type: webhookEventRecord.webhook_type as string,
        payload: webhookEventRecord.payload as Json,
        sienge_delivery_id: webhookEventRecord.sienge_delivery_id as string | null,
        sienge_hook_id: webhookEventRecord.sienge_hook_id as string | null,
        sienge_event: webhookEventRecord.sienge_event as string | null,
        sienge_tenant: webhookEventRecord.sienge_tenant as string | null,
        status: webhookEventRecord.status as string,
        processed_at: webhookEventRecord.processed_at as string | null,
        error_message: webhookEventRecord.error_message as string | null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('id')
      .single();

    if (insertError || !webhookEvent) {
      request.log.error({ err: insertError }, 'Failed to persist webhook event');
      return reply.code(500).send({ message: 'Erro ao registrar webhook' });
    }

    const webhookEventId = webhookEvent.id;

    // ── 2. Register integration event (inbound) ──────────────────
    const entityType = WebhookController.ENTITY_TYPE_MAP[type] ?? null;

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.WEBHOOK_RECEIVED,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/webhooks/sienge',
      http_method: 'POST',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({
        type,
        data,
        siengeDeliveryId,
        siengeHookId,
        siengeTenant,
      }) as Json,
      related_entity_type: entityType,
      related_entity_id: webhookEventId,
      retry_count: 0,
      max_retries: 0,
    });

    // ── 3. Enqueue processing job ────────────────────────────────
    try {
      if (!boss) {
        throw new Error('pg-boss publisher is not configured');
      }

      await boss.send(
        'sienge:process-webhook',
        {
          webhookEventId,
          webhookType: type,
          payload: data,
        },
        {
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
          expireInHours: 1,
        },
      );

      request.log.info(
        { webhookEventId, jobName: 'sienge:process-webhook' },
        'Webhook enqueued for async processing',
      );
    } catch (enqueueError: unknown) {
      request.log.error(
        { err: enqueueError, webhookEventId },
        'Failed to enqueue webhook processing job',
      );
      // Still return 200 — the webhook is persisted and can be reprocessed
    }

    // ── 4. Immediate response ────────────────────────────────────
    return reply.code(200).send({ status: 'received' });
  }

  private static getHeaderValue(value: string | string[] | undefined): string | undefined {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized) {
      return undefined;
    }

    const trimmed = normalized.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
