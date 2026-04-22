import PgBoss from 'pg-boss';
import { getSupabase } from '../supabase.js';
import { notifyComprasAboutOperationalIssue } from '../operational-notifications.js';

const JOB_NAME = 'quotation:expire-check';

/**
 * PRD-02 §6.6: Encerramento automático de cotações vencidas sem resposta.
 *
 * Estratégia:
 * - considera `purchase_quotations.end_at` (timestamptz) quando disponível
 * - fallback para `purchase_quotations.end_date` (date) como fim do dia UTC
 * - marca `supplier_negotiations.status = 'SEM_RESPOSTA'` apenas quando:
 *   - cotação foi enviada (`purchase_quotations.sent_at IS NOT NULL`)
 *   - fornecedor não possui resposta registrada (`latest_response_id IS NULL`)
 *   - status ainda está em estados "abertos" (AGUARDANDO_RESPOSTA / AGUARDANDO_REVISAO / CORRECAO_SOLICITADA)
 * - notifica Compras sobre cotações vencidas sem resposta (PRD-02 P2)
 */
export async function processQuotationExpireCheck(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const supabase = getSupabase();

  console.log(`[${JOB_NAME}] Running expire check. CorrelationId: ${correlationId}`);

  const nowIso = new Date().toISOString();

  // Find quotations whose end is in the past
  const { data: expiredQuotations, error: qError } = await supabase
    .from('purchase_quotations')
    .select('id, end_date');

  if (qError) {
    throw new Error(`Failed to list quotations for expire-check: ${qError.message}`);
  }

  const expiredIds =
    expiredQuotations
      ?.filter((q) => {
        const endAt = q.end_date
            ? new Date(`${q.end_date}T23:59:59.999Z`)
            : null;
        return endAt ? endAt.getTime() < Date.now() : false;
      })
      .map((q) => q.id as number) ?? [];

  if (!expiredIds.length) {
    console.log(`[${JOB_NAME}] No expired quotations found. CorrelationId: ${correlationId}`);
    return;
  }

  // Mark suppliers without responses as SEM_RESPOSTA
  const { data: updatedNegotiations, error: updError } = await supabase
    .from('supplier_negotiations')
    .update({ status: 'SEM_RESPOSTA', updated_at: nowIso })
    .in('purchase_quotation_id', expiredIds)
    .is('latest_response_id', null)
    .in('status', ['AGUARDANDO_RESPOSTA', 'AGUARDANDO_REVISAO', 'CORRECAO_SOLICITADA'])
    .select('purchase_quotation_id, supplier_id');

  if (updError) {
    throw new Error(`Failed to update supplier_negotiations to SEM_RESPOSTA: ${updError.message}`);
  }

  if (updatedNegotiations && updatedNegotiations.length > 0) {
    // Audit trail
    const auditLogs = updatedNegotiations.map((neg) => ({
      entity_type: 'quotation',
      entity_id: String(neg.purchase_quotation_id),
      event_type: 'quotation_expired_no_response',
      metadata: { supplier_id: neg.supplier_id },
    }));

    const { error: auditError } = await supabase.from('audit_logs').insert(auditLogs);
    if (auditError) {
      console.warn(
        `[${JOB_NAME}] Failed to insert audit logs: ${auditError.message}. CorrelationId: ${correlationId}`,
      );
    }

    // Notify Compras about expired quotations (WK-3)
    const affectedQuotationIds = [
      ...new Set(updatedNegotiations.map((n) => n.purchase_quotation_id)),
    ];

    for (const quotationId of affectedQuotationIds) {
      const suppliersForQuotation = updatedNegotiations
        .filter((n) => n.purchase_quotation_id === quotationId)
        .map((n) => n.supplier_id);

      try {
        await notifyComprasAboutOperationalIssue(supabase, {
          type: 'QUOTATION_EXPIRED_NO_RESPONSE',
          entityType: 'purchase_quotation',
          entityId: String(quotationId),
          correlationId,
          metadata: {
            supplier_ids: suppliersForQuotation,
            expired_count: suppliersForQuotation.length,
          },
        });
      } catch (notifyError: unknown) {
        const err = notifyError as { message?: string };
        console.warn(
          `[${JOB_NAME}] Failed to notify Compras for quotation ${quotationId}: ${err.message}. CorrelationId: ${correlationId}`,
        );
      }
    }
  }

  console.log(
    `[${JOB_NAME}] Marked suppliers without response for ${expiredIds.length} quotations. CorrelationId: ${correlationId}`,
  );
}
