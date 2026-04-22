import { OrderOperationalStatus } from '../enums/order-operational-status.js';

export interface OrderStatusCalculationParams {
  totalQuantityOrdered: number;
  totalQuantityDelivered: number;
  hasDivergence: boolean;
  hasAvaria: boolean;
  hasReposicao: boolean;
  isCancelled: boolean;
  promisedDate: Date | string | null;
  referenceDate?: Date;
}

export class OrderStatusEngine {
  /**
   * Calculates the operational status of an order based on the rules from PRD-05.
   * Order of precedence:
   * 1. CANCELADO
   * 2. EM_AVARIA
   * 3. DIVERGENCIA
   * 4. REPOSICAO
   * 5. ENTREGUE
   * 6. ATRASADO
   * 7. PARCIALMENTE_ENTREGUE
   * 8. PENDENTE
   */
  static calculateStatus(params: OrderStatusCalculationParams): OrderOperationalStatus {
    const {
      totalQuantityOrdered,
      totalQuantityDelivered,
      hasDivergence,
      hasAvaria,
      hasReposicao,
      isCancelled,
      promisedDate,
      referenceDate = new Date(),
    } = params;

    // 1. CANCELADO (Devolução total, maior precedência)
    if (isCancelled) {
      return OrderOperationalStatus.CANCELADO;
    }

    // 2. EM_AVARIA
    if (hasAvaria) {
      return OrderOperationalStatus.EM_AVARIA;
    }

    // 3. DIVERGENCIA
    if (hasDivergence) {
      return OrderOperationalStatus.DIVERGENCIA;
    }

    // 4. REPOSICAO
    if (hasReposicao) {
      return OrderOperationalStatus.REPOSICAO;
    }

    // 5. ENTREGUE
    const isFullyDelivered =
      totalQuantityDelivered >= totalQuantityOrdered && totalQuantityOrdered > 0;
    if (isFullyDelivered) {
      return OrderOperationalStatus.ENTREGUE;
    }

    // Check if late
    let isLate = false;
    if (promisedDate) {
      // Use YYYY-MM-DD string comparison to avoid timezone shifts
      const promisedStr =
        typeof promisedDate === 'string'
          ? promisedDate.split('T')[0]
          : promisedDate.toISOString().split('T')[0];
      const refStr = referenceDate.toISOString().split('T')[0];

      if (refStr > promisedStr) {
        isLate = true;
      }
    }

    // 6. ATRASADO
    if (isLate) {
      return OrderOperationalStatus.ATRASADO;
    }

    // 7. PARCIALMENTE_ENTREGUE
    if (totalQuantityDelivered > 0) {
      return OrderOperationalStatus.PARCIALMENTE_ENTREGUE;
    }

    // 8. PENDENTE
    return OrderOperationalStatus.PENDENTE;
  }
}
