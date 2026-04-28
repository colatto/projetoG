export function getDamageStatusLabel(status: string): string {
  switch (status) {
    case 'registrada':
      return 'Registrada';
    case 'sugestao_pendente':
      return 'Sugestão pendente';
    case 'acao_definida':
      return 'Ação definida';
    case 'em_reposicao':
      return 'Em reposição';
    case 'cancelamento_aplicado':
      return 'Cancelamento aplicado';
    case 'resolvida':
      return 'Resolvida';
    default:
      return status;
  }
}

export function getDamageStatusBadgeClass(status: string): string {
  switch (status) {
    case 'em_reposicao':
      return 'badge badge-info';
    case 'cancelamento_aplicado':
      return 'badge badge-gray';
    case 'resolvida':
      return 'badge badge-success';
    case 'registrada':
    case 'sugestao_pendente':
    case 'acao_definida':
      return 'badge badge-purple';
    default:
      return 'badge badge-neutral';
  }
}
