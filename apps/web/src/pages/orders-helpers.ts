import { OrderOperationalStatus } from '@projetog/domain';

export function getOrderStatusLabel(status: string): string {
  switch (status) {
    case OrderOperationalStatus.PENDENTE:
      return 'Pendente';
    case OrderOperationalStatus.PARCIALMENTE_ENTREGUE:
      return 'Parcialmente Entregue';
    case OrderOperationalStatus.ENTREGUE:
      return 'Entregue';
    case OrderOperationalStatus.ATRASADO:
      return 'Atrasado';
    case OrderOperationalStatus.DIVERGENCIA:
      return 'Divergência';
    case OrderOperationalStatus.EM_AVARIA:
      return 'Em Avaria';
    case OrderOperationalStatus.REPOSICAO:
      return 'Reposição';
    case OrderOperationalStatus.CANCELADO:
      return 'Cancelado';
    default:
      return status;
  }
}

export function getOrderStatusBadgeClass(status: string): string {
  switch (status) {
    case OrderOperationalStatus.ENTREGUE:
      return 'badge badge-success'; // Verde
    case OrderOperationalStatus.PARCIALMENTE_ENTREGUE:
      return 'badge badge-warning'; // Amarelo
    case OrderOperationalStatus.ATRASADO:
      return 'badge badge-error'; // Vermelho
    case OrderOperationalStatus.DIVERGENCIA:
      return 'badge badge-orange'; // Laranja
    case OrderOperationalStatus.EM_AVARIA:
      return 'badge badge-purple'; // Roxo
    case OrderOperationalStatus.REPOSICAO:
      return 'badge badge-info'; // Azul
    case OrderOperationalStatus.CANCELADO:
      return 'badge badge-gray'; // Cinza
    case OrderOperationalStatus.PENDENTE:
    default:
      return 'badge badge-neutral'; // Default light gray
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR').format(d);
  } catch {
    return dateStr;
  }
}
