/** Quotation status display helpers — PRD-02 §8 */

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
