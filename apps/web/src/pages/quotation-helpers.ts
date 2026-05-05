/** Quotation status display helpers — PRD-02 §8 */

/** PRDGlobal §9.9 / PRD-02 RN-30 — full wording for alerts (detail). */
export const INVALID_SUPPLIER_MAP_ALERT_MESSAGE = 'Fornecedor inválido no mapa de cotação';

/**
 * Aggregated status for one quotation row (multiple supplier_negotiations).
 * RN-30 first; integration retry next; then pipeline states (PRD-09 RN-08).
 */
const BACKOFFICE_DOMINANT_NEGOTIATION_STATUS_ORDER: readonly string[] = [
  'FORNECEDOR_INVALIDO_MAPA',
  'AGUARDANDO_REENVIO_SIENGE',
  'AGUARDANDO_RESPOSTA',
  'CORRECAO_SOLICITADA',
  'AGUARDANDO_REVISAO',
  'REPROVADA',
  'APROVADA',
  'INTEGRADA_SIENGE',
  'SEM_RESPOSTA',
  'FORNECEDOR_FECHADO',
  'ENCERRADA',
];

export function getDominantNegotiationStatus(statuses: string[]): string {
  if (!statuses.length) return 'SEM_RESPOSTA';
  const set = new Set(statuses);
  for (const s of BACKOFFICE_DOMINANT_NEGOTIATION_STATUS_ORDER) {
    if (set.has(s)) return s;
  }
  return statuses[0];
}

/** Secondary chip when invalid-map exists but dominant differs (defensive / future tweaks). */
export function shouldShowInvalidMapMixedChip(statuses: string[], dominant: string): boolean {
  return statuses.includes('FORNECEDOR_INVALIDO_MAPA') && dominant !== 'FORNECEDOR_INVALIDO_MAPA';
}

/** Visible cell text + tooltip for §14.1 supplier visibility (one row per quotation). */
export function formatSupplierNamesCell(names: string[]): { title: string; primary: string } {
  const filtered = names.map((n) => n.trim()).filter(Boolean);
  if (!filtered.length) return { title: '', primary: '—' };
  const title = filtered.join(', ');
  if (filtered.length === 1) return { title, primary: filtered[0] };
  return { title, primary: `${filtered[0]} +${filtered.length - 1}` };
}

export function quotationRowHasClosedSupplier(
  negotiations: Array<{ status: string; closed_order_id: number | null }>,
): boolean {
  return negotiations.some((n) => n.status === 'FORNECEDOR_FECHADO' || n.closed_order_id != null);
}

const STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_RESPOSTA: 'Aguardando resposta',
  CORRECAO_SOLICITADA: 'Correção solicitada',
  AGUARDANDO_REVISAO: 'Aguardando revisão',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
  AGUARDANDO_REENVIO_SIENGE: 'Aguard. reenvio',
  INTEGRADA_SIENGE: 'Integrada',
  SEM_RESPOSTA: 'Sem resposta',
  FORNECEDOR_FECHADO: 'Forn. fechado',
  FORNECEDOR_INVALIDO_MAPA: 'Forn. inválido',
  ENCERRADA: 'Encerrada',
};

const STATUS_CSS: Record<string, string> = {
  AGUARDANDO_RESPOSTA: 'badge-aguardando-resposta',
  CORRECAO_SOLICITADA: 'badge-correcao-solicitada',
  AGUARDANDO_REVISAO: 'badge-aguardando-revisao',
  APROVADA: 'badge-aprovada',
  REPROVADA: 'badge-reprovada',
  AGUARDANDO_REENVIO_SIENGE: 'badge-aguardando-revisao',
  INTEGRADA_SIENGE: 'badge-integrada-sienge',
  SEM_RESPOSTA: 'badge-sem-resposta',
  FORNECEDOR_FECHADO: 'badge-fornecedor-fechado',
  FORNECEDOR_INVALIDO_MAPA: 'badge-fornecedor-invalido',
  ENCERRADA: 'badge-encerrada',
};

const REVIEW_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  correction_requested: 'Correção solicitada',
};

const REVIEW_CSS: Record<string, string> = {
  pending: 'badge-pending',
  approved: 'badge-approved',
  rejected: 'badge-rejected',
  correction_requested: 'badge-correction-requested',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusBadgeClass(status: string): string {
  return `badge-status ${STATUS_CSS[status] ?? 'badge-sem-resposta'}`;
}

export function getReviewLabel(status: string): string {
  return REVIEW_LABELS[status] ?? status;
}

export function getReviewBadgeClass(status: string): string {
  return `badge-status ${REVIEW_CSS[status] ?? 'badge-pending'}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Returns a CSS class for deadline urgency.
 * - urgent: < 24h remaining
 * - soon: < 72h remaining
 */
export function getDeadlineClass(
  endAt: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const end = endAt ? new Date(endAt) : endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;
  if (!end) return '';
  const hoursLeft = (end.getTime() - Date.now()) / 3600000;
  if (hoursLeft < 0) return 'deadline-urgent';
  if (hoursLeft < 24) return 'deadline-urgent';
  if (hoursLeft < 72) return 'deadline-soon';
  return '';
}

/** Whether the negotiation status is terminal (read-only) */
export function isTerminalStatus(status: string): boolean {
  return [
    'APROVADA',
    'INTEGRADA_SIENGE',
    'SEM_RESPOSTA',
    'FORNECEDOR_FECHADO',
    'FORNECEDOR_INVALIDO_MAPA',
    'ENCERRADA',
  ].includes(status);
}
