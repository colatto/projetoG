import PgBoss from 'pg-boss';
import { OrderClient, QuotationClient } from '@projetog/integration-sienge';
import {
  extractOrderQuotationLinks,
  mapOrderItemsToLocal,
  mapOrderToLocal,
  mapQuotationToLocal,
} from '@projetog/integration-sienge';
import {
  IntegrationDirection,
  IntegrationEntityType,
  IntegrationEventType,
} from '@projetog/domain';
import { sanitizeForLog } from '@projetog/shared';
import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';
import { notifyComprasAboutOperationalIssue } from '../operational-notifications.js';

const JOB_NAME = 'sienge:reconcile';

interface ReconcileJobData {
  entityType: 'order' | 'quotation';
  entityId: number;
  reason: string;
  correlationId?: string;
  expectedQuotationIds?: number[];
}

interface ReconcileContext {
  correlationId: string;
  source: 'worker';
}

interface ReconciliationResult {
  entityType: 'order' | 'quotation';
  entityId: number;
  endpoint: string;
  relatedEntityType: IntegrationEntityType;
  divergenceMessages: string[];
  summary: Record<string, unknown>;
}

export async function processSiengeReconcile(job: PgBoss.Job): Promise<void> {
  const jobData = (job.data ?? {}) as Partial<ReconcileJobData>;
  const correlationId = jobData.correlationId ?? job.id;
  const entityType = jobData.entityType;
  const entityId = jobData.entityId;
  const reason = jobData.reason ?? 'scheduled';

  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const context = { correlationId, source: 'worker' as const };

  console.log(
    `[${JOB_NAME}] Starting reconciliation. Entity: ${entityType}/${entityId}, Reason: ${reason}. CorrelationId: ${correlationId}`,
  );

  try {
    let result: ReconciliationResult;

    if (entityType === 'order' && entityId) {
      result = await reconcileOrderFromApi(entityId, supabase, siengeClient, context, {
        expectedQuotationIds: jobData.expectedQuotationIds,
      });
    } else if (entityType === 'quotation' && entityId) {
      result = await reconcileQuotationFromApi(entityId, supabase, siengeClient, context);
    } else {
      console.warn(
        `[${JOB_NAME}] No valid entity for reconciliation. CorrelationId: ${correlationId}`,
      );
      return;
    }

    await supabase.from('integration_events').insert({
      event_type:
        result.entityType === 'order'
          ? IntegrationEventType.SYNC_ORDERS
          : IntegrationEventType.SYNC_QUOTATIONS,
      direction: IntegrationDirection.INBOUND,
      endpoint: result.endpoint,
      http_method: 'GET',
      http_status: 200,
      status: 'success',
      request_payload: sanitizeForLog({
        entityType,
        entityId,
        reason,
      }) as unknown as import('@projetog/shared').Json,
      response_payload: sanitizeForLog(
        result.summary,
      ) as unknown as import('@projetog/shared').Json,
      related_entity_type: result.relatedEntityType,
      related_entity_id: String(result.entityId),
      retry_count: 0,
      max_retries: 3,
    });

    if (result.divergenceMessages.length > 0) {
      await registerReconciliationDivergence(supabase, result, reason, correlationId);
    }

    console.log(
      `[${JOB_NAME}] Reconciliation completed for ${entityType}/${entityId}. CorrelationId: ${correlationId}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };

    await supabase.from('integration_events').insert({
      event_type:
        entityType === 'quotation'
          ? IntegrationEventType.SYNC_QUOTATIONS
          : IntegrationEventType.SYNC_ORDERS,
      direction: IntegrationDirection.INBOUND,
      endpoint:
        entityType === 'order'
          ? `/purchase-orders/${entityId}`
          : `/purchase-quotations/${entityId}/negotiations`,
      http_method: 'GET',
      status: 'failure',
      error_message: err.message ?? 'Unknown error',
      request_payload: sanitizeForLog({
        entityType,
        entityId,
        reason,
      }) as unknown as import('@projetog/shared').Json,
      related_entity_type:
        entityType === 'quotation' ? IntegrationEntityType.QUOTATION : IntegrationEntityType.ORDER,
      related_entity_id: entityId ? String(entityId) : null,
      retry_count: 0,
      max_retries: 3,
    });

    console.error(
      `[${JOB_NAME}] Reconciliation failed for ${entityType}/${entityId}: ${err.message}. CorrelationId: ${correlationId}`,
    );

    throw error;
  }
}

export async function reconcileOrderFromApi(
  purchaseOrderId: number,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: ReconcileContext,
  options: { expectedQuotationIds?: number[] } = {},
): Promise<ReconciliationResult> {
  const orderClient = new OrderClient(siengeClient);
  const expectedQuotationIds = [...new Set((options.expectedQuotationIds ?? []).filter(Boolean))];

  const { data: existingOrder } = await supabase
    .from('purchase_orders')
    .select('sienge_status, authorized')
    .eq('id', purchaseOrderId)
    .single();

  const order = await orderClient.getById(purchaseOrderId, context);
  const localOrder = mapOrderToLocal(order);

  await supabase.from('purchase_orders').upsert(
    {
      id: localOrder.id,
      formatted_purchase_order_id: localOrder.formattedPurchaseOrderId,
      supplier_id: localOrder.supplierId,
      buyer_id: localOrder.buyerId,
      building_id: localOrder.buildingId,
      sienge_status: localOrder.siengeStatus,
      local_status: localOrder.localStatus,
      authorized: localOrder.authorized,
      disapproved: localOrder.disapproved,
      delivery_late: localOrder.deliveryLate,
      consistent: localOrder.consistent,
      date: localOrder.date,
    },
    { onConflict: 'id' },
  );

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

  const apiQuotationIds = extractOrderQuotationLinks(order).map((link) => link.purchaseQuotationId);
  const quotationIdsToPersist = [...new Set([...expectedQuotationIds, ...apiQuotationIds])];

  for (const purchaseQuotationId of quotationIdsToPersist) {
    await supabase.from('order_quotation_links').upsert(
      {
        purchase_order_id: purchaseOrderId,
        purchase_quotation_id: purchaseQuotationId,
      },
      { onConflict: 'purchase_order_id,purchase_quotation_id' },
    );
  }

  const divergenceMessages: string[] = [];
  if (existingOrder) {
    if (existingOrder.sienge_status !== localOrder.siengeStatus) {
      divergenceMessages.push(
        `sienge_status: ${existingOrder.sienge_status} -> ${localOrder.siengeStatus}`,
      );
    }
    if (existingOrder.authorized !== localOrder.authorized) {
      divergenceMessages.push(
        `authorized: ${existingOrder.authorized} -> ${localOrder.authorized}`,
      );
    }
  }

  const missingInApi = expectedQuotationIds.filter(
    (purchaseQuotationId) => !apiQuotationIds.includes(purchaseQuotationId),
  );
  if (missingInApi.length > 0) {
    divergenceMessages.push(
      `webhook link(s) missing from API confirmation: ${missingInApi.join(', ')}`,
    );
  }

  return {
    entityType: 'order',
    entityId: purchaseOrderId,
    endpoint: `/purchase-orders/${purchaseOrderId}`,
    relatedEntityType: IntegrationEntityType.ORDER,
    divergenceMessages,
    summary: {
      reconciledOrderId: purchaseOrderId,
      itemCount: localItems.length,
      persistedQuotationLinks: quotationIdsToPersist,
      divergenceCount: divergenceMessages.length,
    },
  };
}

export async function reconcileQuotationFromApi(
  purchaseQuotationId: number,
  supabase: ReturnType<typeof getSupabase>,
  siengeClient: Awaited<ReturnType<typeof getSiengeClient>>,
  context: ReconcileContext,
): Promise<ReconciliationResult> {
  const quotationClient = new QuotationClient(siengeClient);

  const allNegotiations = await quotationClient.listNegotiations({}, context);
  const negotiations = allNegotiations.filter(
    (negotiation) => negotiation.purchaseQuotationId === purchaseQuotationId,
  );

  for (const negotiation of negotiations) {
    const localQuotation = mapQuotationToLocal(negotiation);
    await supabase.from('purchase_quotations').upsert(
      {
        id: localQuotation.id,
        quotation_date: localQuotation.quotationDate,
        response_date: localQuotation.responseDate,
        buyer_id: localQuotation.buyerId,
        consistency: localQuotation.consistency,
        sienge_status: localQuotation.siengeStatus,
      },
      { onConflict: 'id' },
    );

    for (const supplier of negotiation.suppliers) {
      for (const neg of supplier.negotiations) {
        await supabase
          .from('supplier_negotiations')
          .update({
            status: neg.authorized ? 'INTEGRADA_SIENGE' : 'AGUARDANDO_RESPOSTA',
            delivery_date: neg.supplierAnswerDate ?? null,
            sienge_negotiation_id: neg.negotiationId,
            sienge_negotiation_number: neg.negotiationNumber,
          })
          .eq('purchase_quotation_id', negotiation.purchaseQuotationId)
          .eq('supplier_id', supplier.supplierId)
          .eq('sienge_negotiation_id', neg.negotiationId);
      }
    }
  }

  return {
    entityType: 'quotation',
    entityId: purchaseQuotationId,
    endpoint: `/purchase-quotations/${purchaseQuotationId}/negotiations`,
    relatedEntityType: IntegrationEntityType.QUOTATION,
    divergenceMessages: [],
    summary: {
      reconciledQuotationId: purchaseQuotationId,
      negotiationCount: negotiations.length,
    },
  };
}

async function registerReconciliationDivergence(
  supabase: ReturnType<typeof getSupabase>,
  result: ReconciliationResult,
  reason: string,
  correlationId: string,
): Promise<void> {
  await supabase.from('integration_events').insert({
    event_type: IntegrationEventType.RECONCILIATION_DIVERGENCE,
    direction: IntegrationDirection.INBOUND,
    endpoint: result.endpoint,
    http_method: 'GET',
    http_status: 200,
    status: 'success',
    request_payload: sanitizeForLog({
      entityType: result.entityType,
      entityId: result.entityId,
      reason,
    }) as unknown as import('@projetog/shared').Json,
    response_payload: sanitizeForLog({
      divergences: result.divergenceMessages,
    }) as unknown as import('@projetog/shared').Json,
    related_entity_type: result.relatedEntityType,
    related_entity_id: String(result.entityId),
    retry_count: 0,
    max_retries: 0,
  });

  try {
    await notifyComprasAboutOperationalIssue(supabase, {
      type: 'RECONCILIATION_DIVERGENCE',
      entityType: result.relatedEntityType,
      entityId: String(result.entityId),
      correlationId,
      metadata: {
        reason,
        divergences: result.divergenceMessages,
      },
    });
  } catch (notificationError: unknown) {
    const err = notificationError as { message?: string };
    console.warn(
      `[${JOB_NAME}] Failed to notify Compras about reconciliation divergence: ${err.message}. CorrelationId: ${correlationId}`,
    );
  }
}
