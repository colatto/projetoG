import PgBoss from 'pg-boss';
import { getSupabase } from '../supabase.js';

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
 *   - status ainda está em estados “abertos” (AGUARDANDO_RESPOSTA / AGUARDANDO_REVISAO / CORRECAO_SOLICITADA)
 */
export async function processQuotationExpireCheck(job: PgBoss.Job): Promise<void> {
  const correlationId = job.id;
  const supabase = getSupabase();

  console.log(`[${JOB_NAME}] Running expire check. CorrelationId: ${correlationId}`);

  const nowIso = new Date().toISOString();

  // Find quotations whose end is in the past and were sent
  const { data: expiredQuotations, error: qError } = await supabase
    .from('purchase_quotations')
    .select('id, end_at, end_date, sent_at')
    .not('sent_at', 'is', null);

  if (qError) {
    throw new Error(`Failed to list quotations for expire-check: ${qError.message}`);
  }

  const expiredIds =
    expiredQuotations
      ?.filter((q) => {
        const endAt = q.end_at
          ? new Date(String(q.end_at))
          : q.end_date
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
  const { error: updError } = await supabase
    .from('supplier_negotiations')
    .update({ status: 'SEM_RESPOSTA', updated_at: nowIso })
    .in('purchase_quotation_id', expiredIds)
    .is('latest_response_id', null)
    .in('status', ['AGUARDANDO_RESPOSTA', 'AGUARDANDO_REVISAO', 'CORRECAO_SOLICITADA']);

  if (updError) {
    throw new Error(`Failed to update supplier_negotiations to SEM_RESPOSTA: ${updError.message}`);
  }

  console.log(
    `[${JOB_NAME}] Marked suppliers without response for ${expiredIds.length} quotations. CorrelationId: ${correlationId}`,
  );
}

