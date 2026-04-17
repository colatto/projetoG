import React from 'react';

interface IntegrationStatusBadgeProps {
  status: 'pending' | 'success' | 'failure' | 'retry_scheduled' | 'supplier_invalid_map' | string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pendente de integração',
    className: 'badge-warning',
  },
  success: {
    label: 'Integrado com sucesso',
    className: 'badge-success',
  },
  failure: {
    label: 'Falha de integração',
    className: 'badge-error',
  },
  retry_scheduled: {
    label: 'Reprocessamento agendado',
    className: 'badge-warning',
  },
  supplier_invalid_map: {
    label: 'Fornecedor inválido no mapa de cotação',
    className: 'badge-error',
  },
};

export default function IntegrationStatusBadge({ status }: IntegrationStatusBadgeProps) {
  const meta = STATUS_META[status] ?? {
    label: status,
    className: 'badge-gray',
  };

  return <span className={`badge ${meta.className}`}>{meta.label}</span>;
}
