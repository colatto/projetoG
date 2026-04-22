import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderStatusEngine } from '../order-status-engine.js';
import { OrderOperationalStatus } from '../../enums/order-operational-status.js';

describe('OrderStatusEngine', () => {
  const baseParams = {
    totalQuantityOrdered: 100,
    totalQuantityDelivered: 0,
    hasDivergence: false,
    hasAvaria: false,
    hasReposicao: false,
    isCancelled: false,
    promisedDate: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return PENDENTE for new order without deliveries', () => {
    expect(OrderStatusEngine.calculateStatus(baseParams)).toBe(OrderOperationalStatus.PENDENTE);
  });

  it('should return PARCIALMENTE_ENTREGUE when some items are delivered', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        totalQuantityDelivered: 50,
      }),
    ).toBe(OrderOperationalStatus.PARCIALMENTE_ENTREGUE);
  });

  it('should return ENTREGUE when all items are delivered', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        totalQuantityDelivered: 100,
      }),
    ).toBe(OrderOperationalStatus.ENTREGUE);
  });

  it('should return ATRASADO if promisedDate is in the past', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        promisedDate: '2026-04-09T00:00:00Z',
      }),
    ).toBe(OrderOperationalStatus.ATRASADO);
  });

  it('should not return ATRASADO if promisedDate is today', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        promisedDate: '2026-04-10T00:00:00Z',
      }),
    ).toBe(OrderOperationalStatus.PENDENTE);
  });

  it('should prioritize CANCELADO over all other status', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        isCancelled: true,
        hasAvaria: true,
        hasDivergence: true,
        totalQuantityDelivered: 100,
      }),
    ).toBe(OrderOperationalStatus.CANCELADO);
  });

  it('should prioritize EM_AVARIA over DIVERGENCIA and others', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        hasAvaria: true,
        hasDivergence: true,
        totalQuantityDelivered: 100,
      }),
    ).toBe(OrderOperationalStatus.EM_AVARIA);
  });

  it('should prioritize DIVERGENCIA over REPOSICAO and others', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        hasDivergence: true,
        hasReposicao: true,
        totalQuantityDelivered: 100,
      }),
    ).toBe(OrderOperationalStatus.DIVERGENCIA);
  });

  it('should prioritize REPOSICAO over ENTREGUE', () => {
    expect(
      OrderStatusEngine.calculateStatus({
        ...baseParams,
        hasReposicao: true,
        totalQuantityDelivered: 100,
      }),
    ).toBe(OrderOperationalStatus.REPOSICAO);
  });
});
