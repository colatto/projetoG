import { describe, expect, it } from 'vitest';
import { OrderOperationalStatus } from '@projetog/domain';
import { getOrderStatusBadgeClass, getOrderStatusLabel } from './orders-helpers';

/** RN-10 (PRD-09) — subset aplicável a status operacional de pedido (local_status). */
const EXPECTED_BADGE: Record<string, string> = {
  [OrderOperationalStatus.ATRASADO]: 'badge badge-error',
  [OrderOperationalStatus.DIVERGENCIA]: 'badge badge-orange',
  [OrderOperationalStatus.EM_AVARIA]: 'badge badge-purple',
  [OrderOperationalStatus.REPOSICAO]: 'badge badge-info',
  [OrderOperationalStatus.ENTREGUE]: 'badge badge-success',
  [OrderOperationalStatus.PARCIALMENTE_ENTREGUE]: 'badge badge-warning',
  [OrderOperationalStatus.CANCELADO]: 'badge badge-gray',
  [OrderOperationalStatus.PENDENTE]: 'badge badge-neutral',
};

describe('orders-helpers', () => {
  it('maps each order operational status to the RN-10 badge class', () => {
    for (const status of Object.keys(EXPECTED_BADGE)) {
      expect(getOrderStatusBadgeClass(status)).toBe(EXPECTED_BADGE[status]);
    }
  });

  it('returns neutral badge for unknown status values', () => {
    expect(getOrderStatusBadgeClass('UNKNOWN_STATUS')).toBe('badge badge-neutral');
  });

  it('returns Portuguese labels for known statuses', () => {
    expect(getOrderStatusLabel(OrderOperationalStatus.PENDENTE)).toBe('Pendente');
    expect(getOrderStatusLabel(OrderOperationalStatus.ENTREGUE)).toBe('Entregue');
    expect(getOrderStatusLabel(OrderOperationalStatus.ATRASADO)).toBe('Atrasado');
  });
});
