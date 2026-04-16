import { SiengeClient, RequestContext } from '../client.js';
import type {
  SiengePaginatedResponse,
  SiengePurchaseInvoice,
  SiengeInvoiceItem,
  SiengeDeliveryAttended,
} from '../types/sienge-types.js';

export interface ListInvoicesFilters {
  companyId?: number;
  supplierId?: number;
  documentId?: string;
  series?: string;
  number?: string;
  startDate?: string;
  endDate?: string;
}

export interface ListDeliveriesAttendedFilters {
  billId?: number;
  sequentialNumber?: number;
  purchaseOrderId?: number;
  invoiceItemNumber?: number;
  purchaseOrderItemNumber?: number;
}

/**
 * Client for Sienge Purchase Invoice endpoints.
 * PRD-07 §7.1 — `/purchase-invoices`
 */
export class InvoiceClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Lists purchase invoices with automatic pagination.
   * Endpoint: GET /purchase-invoices
   */
  async list(
    filters: ListInvoicesFilters = {},
    context?: RequestContext,
  ): Promise<SiengePurchaseInvoice[]> {
    return this.client.paginateAll<SiengePurchaseInvoice>(
      '/purchase-invoices',
      filters as Record<string, unknown>,
      context,
    );
  }

  /**
   * Lists a single page of purchase invoices.
   */
  async listPaged(
    filters: ListInvoicesFilters & { limit?: number; offset?: number } = {},
    context?: RequestContext,
  ): Promise<SiengePaginatedResponse<SiengePurchaseInvoice>> {
    const { limit = 100, offset = 0, ...restFilters } = filters;
    return this.client.get<SiengePaginatedResponse<SiengePurchaseInvoice>>(
      '/purchase-invoices',
      context,
      { params: { ...restFilters, limit, offset } },
    );
  }

  /**
   * Gets a single purchase invoice by sequential number.
   * Endpoint: GET /purchase-invoices/{sequentialNumber}
   */
  async getById(
    sequentialNumber: number,
    context?: RequestContext,
  ): Promise<SiengePurchaseInvoice> {
    return this.client.get<SiengePurchaseInvoice>(
      `/purchase-invoices/${sequentialNumber}`,
      context,
    );
  }

  /**
   * Gets items of a purchase invoice.
   * Endpoint: GET /purchase-invoices/{sequentialNumber}/items
   */
  async getItems(sequentialNumber: number, context?: RequestContext): Promise<SiengeInvoiceItem[]> {
    return this.client.paginateAll<SiengeInvoiceItem>(
      `/purchase-invoices/${sequentialNumber}/items`,
      {},
      context,
    );
  }

  /**
   * Gets deliveries attended (linked to invoices and purchase orders).
   * Endpoint: GET /purchase-invoices/deliveries-attended
   *
   * This is the primary endpoint for the NF→PO→Quotation linkage chain (§9.7).
   */
  async getDeliveriesAttended(
    filters: ListDeliveriesAttendedFilters = {},
    context?: RequestContext,
  ): Promise<SiengeDeliveryAttended[]> {
    return this.client.paginateAll<SiengeDeliveryAttended>(
      '/purchase-invoices/deliveries-attended',
      filters as Record<string, unknown>,
      context,
    );
  }

  /**
   * Gets a single page of deliveries attended.
   */
  async getDeliveriesAttendedPaged(
    filters: ListDeliveriesAttendedFilters & { limit?: number; offset?: number } = {},
    context?: RequestContext,
  ): Promise<SiengePaginatedResponse<SiengeDeliveryAttended>> {
    const { limit = 100, offset = 0, ...restFilters } = filters;
    return this.client.get<SiengePaginatedResponse<SiengeDeliveryAttended>>(
      '/purchase-invoices/deliveries-attended',
      context,
      { params: { ...restFilters, limit, offset } },
    );
  }
}
