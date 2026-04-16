import { SiengeClient, RequestContext } from '../client.js';
import type {
  SiengePaginatedResponse,
  SiengePurchaseOrder,
  SiengePurchaseOrderItem,
  SiengeDeliverySchedule,
} from '../types/sienge-types.js';

export interface ListOrdersFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  authorized?: boolean;
  supplierId?: number;
  buildingId?: number;
  buyerId?: string;
  consistency?: string;
}

/**
 * Client for Sienge Purchase Order endpoints.
 * PRD-07 §7.1 — `/purchase-orders`
 */
export class OrderClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Lists purchase orders with automatic pagination.
   * Endpoint: GET /purchase-orders
   */
  async list(
    filters: ListOrdersFilters = {},
    context?: RequestContext,
  ): Promise<SiengePurchaseOrder[]> {
    return this.client.paginateAll<SiengePurchaseOrder>(
      '/purchase-orders',
      filters as Record<string, unknown>,
      context,
    );
  }

  /**
   * Lists a single page of purchase orders.
   */
  async listPaged(
    filters: ListOrdersFilters & { limit?: number; offset?: number } = {},
    context?: RequestContext,
  ): Promise<SiengePaginatedResponse<SiengePurchaseOrder>> {
    const { limit = 100, offset = 0, ...restFilters } = filters;
    return this.client.get<SiengePaginatedResponse<SiengePurchaseOrder>>(
      '/purchase-orders',
      context,
      { params: { ...restFilters, limit, offset } },
    );
  }

  /**
   * Gets a single purchase order by ID.
   * Endpoint: GET /purchase-orders/{id}
   */
  async getById(purchaseOrderId: number, context?: RequestContext): Promise<SiengePurchaseOrder> {
    return this.client.get<SiengePurchaseOrder>(`/purchase-orders/${purchaseOrderId}`, context);
  }

  /**
   * Gets items of a purchase order.
   * Endpoint: GET /purchase-orders/{id}/items
   */
  async getItems(
    purchaseOrderId: number,
    context?: RequestContext,
  ): Promise<SiengePurchaseOrderItem[]> {
    return this.client.paginateAll<SiengePurchaseOrderItem>(
      `/purchase-orders/${purchaseOrderId}/items`,
      {},
      context,
    );
  }

  /**
   * Gets delivery schedules for a specific item of a purchase order.
   * Endpoint: GET /purchase-orders/{id}/items/{itemNumber}/delivery-schedules
   *
   * Note: The response respects the Sienge typo (RN-11):
   * `sheduledDate` and `sheduledQuantity` (without the 'c').
   */
  async getDeliverySchedules(
    purchaseOrderId: number,
    itemNumber: number,
    context?: RequestContext,
  ): Promise<SiengeDeliverySchedule[]> {
    return this.client.paginateAll<SiengeDeliverySchedule>(
      `/purchase-orders/${purchaseOrderId}/items/${itemNumber}/delivery-schedules`,
      {},
      context,
    );
  }
}
