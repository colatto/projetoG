import PgBoss from 'pg-boss';
import { NegotiationClient, QuotationClient } from '@projetog/integration-sienge';
import { IntegrationEventType, IntegrationEventStatus, OutboundNegotiationPayload } from '@projetog/domain';
import { getSupabase } from '../supabase.js';
import { getSiengeClient } from '../sienge.js';

const JOB_NAME = 'sienge:outbound-negotiation';

interface OutboundJobData extends OutboundNegotiationPayload {
  integrationEventId: string;
}

export async function processOutboundNegotiation(job: PgBoss.Job<OutboundJobData>): Promise<void> {
  const payload = job.data;
  const correlationId = job.id;
  const context = { correlationId, source: 'worker' as const };
  const supabase = getSupabase();
  const siengeClient = await getSiengeClient(supabase);
  const quotationClient = new QuotationClient(siengeClient);
  const negotiationClient = new NegotiationClient(siengeClient);

  console.log(`[${JOB_NAME}] Starting outbound for Quotation: ${payload.purchaseQuotationId}. CorrelationId: ${correlationId}`);

  try {
    // 1. Fetch local quotation to get the quotationNumber
    const { data: localQuotation, error: qError } = await supabase
      .from('purchase_quotations')
      .select('id, quotation_date')
      .eq('id', payload.purchaseQuotationId)
      .single();

    if (qError || !localQuotation) {
      throw new Error(`Quotation local não encontrada: ${payload.purchaseQuotationId}`);
    }

    // Since our database might not store 'quotationNumber' natively if it differs from ID (or maybe ID is the number?),
    // wait, PRD-07 §4.5 says purchaseQuotationId is the PK. In Sienge, `purchaseQuotationId` is often used to get it,
    // but the filter is `quotationNumber`. Actually, `QuotationClient.listNegotiationsPaged` can just be queried.
    // Let's get the mapping for this quotation directly from Sienge to validate the supplier. 
    // We can filter by `purchaseQuotationId` if it is supported, or we just fetch the quotation negotiations and find our supplier.
    // Sienge Quotaion negotiations endpoint doesn't allow ID filter.
    // Wait! `listNegotiationsPaged` takes `quotationNumber`, but we might only have `purchaseQuotationId`.
    // Wait! A `quotationNumber` is usually derived or same. However, maybe filtering by `supplierId` and sorting by date?
    // Let's simply fetch without `quotationNumber` filter but filter by `supplierId` and `startDate` maybe? No, let's just make the call logic resilient.
    // Or we fetch all for this `supplierId`.
    
    const { results } = await quotationClient.listNegotiationsPaged({ supplierId: payload.supplierId }, context);

    const quotationList = results.find((q) => q.purchaseQuotationId === payload.purchaseQuotationId);
    const supplierData = quotationList?.suppliers?.find((s) => s.supplierId === payload.supplierId);

    if (!quotationList || !supplierData) {
      // PRD-07 §9.9 (RN-10): Fornecedor inválido no mapa de cotação.
      await supabase.from('integration_events').update({
        status: IntegrationEventStatus.FAILURE,
        event_type: IntegrationEventType.SUPPLIER_INVALID_MAP,
        error_message: 'Fornecedor removido do mapa de cotação do Sienge.',
        updated_at: new Date().toISOString()
      }).eq('id', payload.integrationEventId);

      await supabase.from('supplier_negotiations').update({
        status: 'fornecedor_invalido',
        updated_at: new Date().toISOString()
      }).eq('purchase_quotation_id', payload.purchaseQuotationId).eq('supplier_id', payload.supplierId);

      console.warn(`[${JOB_NAME}] Supplier ${payload.supplierId} invalid in quotation ${payload.purchaseQuotationId}.`);
      return; 
    }

    let negotiationNumber: number | null = null;
    let negotiationId: number | null = null;

    // We assume the negotiation hasn't been created / authorized if we reach here, OR we pick the latest.
    const latestNegotiation = supplierData.negotiations?.length 
      ? supplierData.negotiations[supplierData.negotiations.length - 1] 
      : null;

    if (!latestNegotiation) {
      // Create via Sienge
      console.log(`[${JOB_NAME}] Creating negotiation for Quotation: ${payload.purchaseQuotationId}`);
      // As per Sienge docs, POST /negotiations response doesn't give the whole structure directly, but it creates the resource.
      // Wait, let's look at PRD: Create returns Negotiation created.
      await negotiationClient.create<unknown>(
        payload.purchaseQuotationId,
        payload.supplierId,
        {
          supplierAnswerDate: payload.supplierAnswerDate,
          validity: payload.validity,
          seller: payload.seller
        },
        context
      );
      
      // Unfortunately, Sienge might not return the ID directly in body if empty or Location header. 
      // We will re-fetch the negotiation summary to get the negotiationNumber.
      const { results: newResults } = await quotationClient.listNegotiationsPaged({ supplierId: payload.supplierId }, context);
      const updatedList = newResults.find((q) => q.purchaseQuotationId === payload.purchaseQuotationId);
      const updatedSupplier = updatedList?.suppliers?.find((s) => s.supplierId === payload.supplierId);
      const createdNeg = updatedSupplier?.negotiations?.length ? updatedSupplier.negotiations[updatedSupplier.negotiations.length - 1] : null;

      if (!createdNeg) {
        throw new Error('Failed to retrieve negotiationNumber after creation.');
      }
      negotiationNumber = createdNeg.negotiationNumber;
      negotiationId = createdNeg.negotiationId;
    } else {
      negotiationNumber = latestNegotiation.negotiationNumber;
      negotiationId = latestNegotiation.negotiationId;
    }

    console.log(`[${JOB_NAME}] Updating negotiation ${negotiationNumber}...`);
    // Update Negotiation
    await negotiationClient.update(
      payload.purchaseQuotationId,
      payload.supplierId,
      negotiationNumber,
      {
        supplierAnswerDate: payload.supplierAnswerDate,
        validity: payload.validity,
        seller: payload.seller
      },
      context
    );

    console.log(`[${JOB_NAME}] Updating items...`);
    // Update Items
    for (const item of payload.items) {
      await negotiationClient.updateItem(
        payload.purchaseQuotationId,
        payload.supplierId,
        negotiationNumber,
        item.purchaseQuotationItemId, 
        {
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          deliveryDate: item.deliveryDate
        },
        context
      );
    }

    console.log(`[${JOB_NAME}] Authorizing...`);
    // Authorize
    await negotiationClient.authorize(
      payload.purchaseQuotationId,
      payload.supplierId,
      context
    );

    // Save success inside our tables
    await supabase.from('supplier_negotiations').update({
      sienge_negotiation_id: negotiationId,
      sienge_negotiation_number: negotiationNumber,
      status: 'escrita_concluida', // Example end status
      updated_at: new Date().toISOString()
    }).eq('purchase_quotation_id', payload.purchaseQuotationId).eq('supplier_id', payload.supplierId);

    // Update the Integration Event for WRITE_NEGOTIATION
    await supabase.from('integration_events').update({
      status: IntegrationEventStatus.SUCCESS,
      updated_at: new Date().toISOString()
    }).eq('id', payload.integrationEventId);

    // Audit the Authorize specifically
    await supabase.from('integration_events').insert({
      event_type: IntegrationEventType.AUTHORIZE_NEGOTIATION,
      direction: 'outbound',
      endpoint: '/purchase-quotations/.../negotiations/latest/authorize',
      http_method: 'PATCH',
      status: IntegrationEventStatus.SUCCESS,
      related_entity_type: 'quotation',
      related_entity_id: String(payload.purchaseQuotationId),
      retry_count: 0,
      max_retries: 0,
    });

    console.log(`[${JOB_NAME}] Completed successfully. CorrelationId: ${correlationId}`);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[${JOB_NAME}] Failed: ${err.message}. CorrelationId: ${correlationId}`);

    const { data: event } = await supabase
      .from('integration_events')
      .select('retry_count, max_retries')
      .eq('id', payload.integrationEventId)
      .single();

    const retryCount = event?.retry_count ?? 0;
    const maxRetries = event?.max_retries ?? 2;

    if (retryCount < maxRetries) {
      const nextRetryAt = new Date();
      nextRetryAt.setHours(nextRetryAt.getHours() + 24);

      await supabase.from('integration_events').update({
        status: IntegrationEventStatus.RETRY_SCHEDULED,
        error_message: err.message ?? 'Unknown error',
        retry_count: retryCount + 1,
        next_retry_at: nextRetryAt.toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', payload.integrationEventId);

      console.log(`[${JOB_NAME}] Scheduled retry ${retryCount + 1}/${maxRetries} for event ${payload.integrationEventId}.`);
    } else {
      await supabase.from('integration_events').update({
        status: IntegrationEventStatus.FAILURE,
        error_message: err.message ?? 'Unknown error',
        retry_count: retryCount + 1,
        next_retry_at: null,
        updated_at: new Date().toISOString()
      }).eq('id', payload.integrationEventId);

      await supabase.from('audit_logs').insert({
        event_type: 'integration.failure_exhausted',
        actor_id: payload.actorId,
        entity_type: 'integration_event',
        entity_id: payload.integrationEventId,
        metadata: { error: err.message } as unknown as import('@projetog/shared').Json
      });

      console.error(`[${JOB_NAME}] Exhausted retries for event ${payload.integrationEventId}. Marked as FAILURE.`);
    }
  }
}
