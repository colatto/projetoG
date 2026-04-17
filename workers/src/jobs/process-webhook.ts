import PgBoss from 'pg-boss';
import { OrderClient } from '@projetog/integration-sienge';
import { mapOrderItemsToLocal, mapOrderToLocal } from '@projetog/integration-sienge';
import {
  IntegrationDirection,
  IntegrationEntityType,
  IntegrationEventType,
  WebhookStatus,
  WebhookType,
} from '@projetog/domain';
import { sanitizeForLog } from '@projetog/shared';
import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';
import { reconcileOrderFromApi, reconcileQuotationFromApi } from './sienge-reconcile.js';

const JOB_NAME = 'sienge:process-webhook';

interface ProcessWebhookJobData {
  webhookEventId: string;
  webhookType: WebhookType;
  payload: Record<string, unknown>;
}

interface ProcessResult {
  entityType: IntegrationEntityType | null;
  entityId: string | null;
  summary: Record<string, unknown>;
  divergenceMessages?: string[];
}

interface WorkerContext {
  correlationId: string;
  source: 'worker';
}

export async function processWebhook(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const { webhookEventId, webhookType, payload } = job.data as ProcessWebhookJobData;
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const context = { correlationId, source: 'worker' as const };

  console.log(
    `[${JOB_NAME}] Processing webhook ${webhookEventId} (type: ${webhookType}). CorrelationId: ${correlationId}`,
  );

  await supabase
    .from('webhook_events')
    .update({ status: WebhookStatus.PROCESSING })
    .eq('id', webhookEventId);

  try {
    const result = await dispatchWebhook(webhookType, payload, supabase, siengeClient, context);

    await supabase
      .from('webhook_events')
      .update({
        status: WebhookStatus.PROCESSED,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', webhookEventId);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.WEBHOOK_PROCESSED,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/webhooks/sienge',
      http_method: 'POST',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({ webhookEventId, webhookType }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog(result.summary) as unknown as import('@projetog/shared').Json,
      related_entity_type: result.entityType ?? resolveEntityType(webhookType),
      related_entity_id:
        result.entityId ?? extractEntityIdFromPayload(webhookType, payload) ?? webhookEventId,
      retry_count: 0,
      max_retries: 0,
    });

    if (result.divergenceMessages && result.divergenceMessages.length > 0) {
      await registerReconciliationDivergence(supabase, result, context.correlationId);
    }

    console.log(
      `[${JOB_NAME}] Webhook ${webhookEventId} processed successfully. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    await supabase
      .from('webhook_events')
      .update({
        status: WebhookStatus.FAILED,
        processed_at: new Date().toISOString(),
        error_message: err.message ?? 'Unknown error',
      })
      .eq('id', webhookEventId);

    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.WEBHOOK_FAILED,
      direction: IntegrationDirection.INBOUND,
      endpoint: '/webhooks/sienge',
      http_method: 'POST',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      request_payload: sanitizeForLog({ webhookEventId, webhookType }) as unknown as import('@projetog/shared').Json,
      related_entity_type: resolveEntityType(webhookType),
      related_entity_id: extractEntityIdFromPayload(webhookType, payload) ?? webhookEventId,
      retry_count: 0,
      max_retries: 3,
    });

    console.error(
      `[${JOB_NAME}] Webhook ${webhookEventId} failed: ${err.message}. CorrelationId: ${correlationId}`,
    );

    throw error;
  }
}

async function dispatchWebhook(
  webhookType: WebhookType,
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  switch (webhookType) {
    case WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION:
      return handleOrderGenerated(payload, supabase, siengeClient, context);
    case WebhookType.PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED:
      return handleNegotiationAuthChanged(payload, supabase, siengeClient, context);
    case WebhookType.PURCHASE_ORDER_ITEM_MODIFIED:
      return handleOrderItemModified(payload, supabase, siengeClient, context);
    case WebhookType.PURCHASE_ORDER_AUTHORIZATION_CHANGED:
      return handleOrderAuthChanged(payload, supabase, siengeClient, context);
    case WebhookType.PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED:
      return handleOrderFinancialUpdated(payload, supabase, siengeClient, context);
    default:
      console.info(
        `[${JOB_NAME}] Webhook type ${webhookType} has no explicit processing pipeline, acknowledging securely. CorrelationId: ${context.correlationId}`,
      );
      return {
        entityType: resolveEntityType(webhookType),
        entityId: extractEntityIdFromPayload(webhookType, payload),
        summary: {
          webhookType,
          skipped: true,
          reason: 'No processing pipeline implemented for this webhook type',
        },
      };
  }
}

async function handleOrderGenerated(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  const purchaseOrderId = requireNumber(payload, 'purchaseOrderId');
  const purchaseQuotationId =
    typeof payload.purchaseQuotationId === 'number' ? payload.purchaseQuotationId : null;
  const supplierId = typeof payload.supplierId === 'number' ? payload.supplierId : null;
  const expectedQuotationIds = extractQuotationIds(payload);

  const result = await reconcileOrderFromApi(purchaseOrderId, supabase, siengeClient, context, {
    expectedQuotationIds,
  });

  // PRD-02 §6.7: fechamento automático da cotação
  if (purchaseQuotationId && supplierId) {
    // Vencedor
    await supabase
      .from('supplier_negotiations')
      .update({
        status: 'FORNECEDOR_FECHADO',
        closed_order_id: purchaseOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq('purchase_quotation_id', purchaseQuotationId)
      .eq('supplier_id', supplierId);

    // Demais fornecedores
    await supabase
      .from('supplier_negotiations')
      .update({
        status: 'ENCERRADA',
        updated_at: new Date().toISOString(),
      })
      .eq('purchase_quotation_id', purchaseQuotationId)
      .neq('supplier_id', supplierId);
  }

  return {
    entityType: IntegrationEntityType.ORDER,
    entityId: String(purchaseOrderId),
    divergenceMessages: result.divergenceMessages,
    summary: {
      ...result.summary,
      webhookType: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
      expectedQuotationIds,
      purchaseQuotationId,
      supplierId,
    },
  };
}

async function handleNegotiationAuthChanged(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  const purchaseQuotationId = requireNumber(payload, 'purchaseQuotationId');

  const result = await reconcileQuotationFromApi(
    purchaseQuotationId,
    supabase,
    siengeClient,
    context,
  );

  return {
    entityType: IntegrationEntityType.QUOTATION,
    entityId: String(purchaseQuotationId),
    divergenceMessages: result.divergenceMessages,
    summary: {
      ...result.summary,
      webhookType: WebhookType.PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED,
    },
  };
}

async function handleOrderItemModified(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  const purchaseOrderId = requireNumber(payload, 'purchaseOrderId');
  const orderClient = new OrderClient(siengeClient);

  const items = await orderClient.getItems(purchaseOrderId, context);
  const localItems = mapOrderItemsToLocal(purchaseOrderId, items);

  for (const item of localItems) {
    await supabase.from('purchase_order_items').upsert(
      {
        purchase_order_id: item.purchaseOrderId,
        item_number: item.itemNumber,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        purchase_quotation_id: item.purchaseQuotationId,
        purchase_quotation_item_id: item.purchaseQuotationItemId,
      },
      { onConflict: 'purchase_order_id,item_number' },
    );
  }

  return {
    entityType: IntegrationEntityType.ORDER,
    entityId: String(purchaseOrderId),
    summary: {
      webhookType: WebhookType.PURCHASE_ORDER_ITEM_MODIFIED,
      updatedItemCount: localItems.length,
    },
  };
}

async function handleOrderAuthChanged(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  const purchaseOrderId = requireNumber(payload, 'purchaseOrderId');
  const orderClient = new OrderClient(siengeClient);

  const order = await orderClient.getById(purchaseOrderId, context);
  const localOrder = mapOrderToLocal(order);

  await supabase
    .from('purchase_orders')
    .update({
      authorized: localOrder.authorized,
      disapproved: localOrder.disapproved,
      sienge_status: localOrder.siengeStatus,
    })
    .eq('id', purchaseOrderId);

  return {
    entityType: IntegrationEntityType.ORDER,
    entityId: String(purchaseOrderId),
    summary: {
      webhookType: WebhookType.PURCHASE_ORDER_AUTHORIZATION_CHANGED,
      authorized: localOrder.authorized,
      disapproved: localOrder.disapproved,
      siengeStatus: localOrder.siengeStatus,
    },
  };
}

async function handleOrderFinancialUpdated(
  payload: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: WorkerContext,
): Promise<ProcessResult> {
  const purchaseOrderId = requireNumber(payload, 'purchaseOrderId');
  const orderClient = new OrderClient(siengeClient);

  const order = await orderClient.getById(purchaseOrderId, context);
  const localOrder = mapOrderToLocal(order);

  await supabase
    .from('purchase_orders')
    .update({
      sienge_status: localOrder.siengeStatus,
      consistent: localOrder.consistent,
    })
    .eq('id', purchaseOrderId);

  return {
    entityType: IntegrationEntityType.ORDER,
    entityId: String(purchaseOrderId),
    summary: {
      webhookType: WebhookType.PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED,
      siengeStatus: localOrder.siengeStatus,
      consistent: localOrder.consistent,
    },
  };
}

function extractQuotationIds(payload: Record<string, unknown>): number[] {
  const collected = new Set<number>();
  const directId = coerceNumber(payload.purchaseQuotationId);
  if (directId !== null) {
    collected.add(directId);
  }

  const purchaseQuotations = payload.purchaseQuotations;
  if (Array.isArray(purchaseQuotations)) {
    for (const item of purchaseQuotations) {
      if (item && typeof item === 'object') {
        const itemId = coerceNumber((item as Record<string, unknown>).purchaseQuotationId);
        if (itemId !== null) {
          collected.add(itemId);
        }
      }
    }
  }

  return [...collected];
}

function requireNumber(payload: Record<string, unknown>, key: string): number {
  const value = coerceNumber(payload[key]);
  if (value === null) {
    throw new Error(`Missing ${key} in webhook payload`);
  }
  return value;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function resolveEntityType(webhookType: WebhookType): IntegrationEntityType | null {
  switch (webhookType) {
    case WebhookType.PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED:
      return IntegrationEntityType.QUOTATION;
    case WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION:
    case WebhookType.PURCHASE_ORDER_ITEM_MODIFIED:
    case WebhookType.PURCHASE_ORDER_AUTHORIZATION_CHANGED:
    case WebhookType.PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED:
      return IntegrationEntityType.ORDER;
    default:
      return null;
  }
}

function extractEntityIdFromPayload(
  webhookType: WebhookType,
  payload: Record<string, unknown>,
): string | null {
  if (webhookType === WebhookType.PURCHASE_QUOTATION_NEGOTIATION_AUTHORIZATION_CHANGED) {
    const id = coerceNumber(payload.purchaseQuotationId);
    return id !== null ? String(id) : null;
  }

  if (
    webhookType === WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION ||
    webhookType === WebhookType.PURCHASE_ORDER_ITEM_MODIFIED ||
    webhookType === WebhookType.PURCHASE_ORDER_AUTHORIZATION_CHANGED ||
    webhookType === WebhookType.PURCHASE_ORDER_FINANCIAL_FORECAST_UPDATED
  ) {
    const id = coerceNumber(payload.purchaseOrderId);
    return id !== null ? String(id) : null;
  }

  const keysToTry = [
    'purchaseOrderId',
    'purchaseQuotationId',
    'contractId',
    'contractNumber',
    'measurementId',
    'clearingId',
    'documentId',
    'id',
  ];
  for (const key of keysToTry) {
    const val = coerceNumber(payload[key]);
    if (val !== null) return String(val);
  }

  return null;
}

async function registerReconciliationDivergence(
  supabase: ReturnType<typeof getSupabase>,
  result: ProcessResult,
  correlationId: string,
): Promise<void> {
  await supabase.from('integration_events').insert({
    event_type: IntegrationEventType.RECONCILIATION_DIVERGENCE,
    direction: IntegrationDirection.INBOUND,
    endpoint: '/webhooks/sienge',
    http_method: 'POST',
    http_status: 200,
    status: 'success',
    request_payload: sanitizeForLog({
      entityType: result.entityType,
      entityId: result.entityId,
      source: 'webhook',
      correlationId,
    }) as unknown as import('@projetog/shared').Json,
    response_payload: sanitizeForLog({
      divergences: result.divergenceMessages,
    }) as unknown as import('@projetog/shared').Json,
    related_entity_type: result.entityType,
    related_entity_id: result.entityId,
    retry_count: 0,
    max_retries: 0,
  });
}
