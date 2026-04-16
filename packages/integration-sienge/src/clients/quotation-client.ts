import { SiengeClient, RequestContext } from '../client.js';
import type { SiengePaginatedResponse, SiengeQuotationNegotiation } from '../types/sienge-types.js';

export interface ListNegotiationsFilters {
  quotationNumber?: string;
  supplierId?: number;
  buyerId?: string;
  startDate?: string;
  endDate?: string;
  authorized?: boolean;
  status?: string;
  consistency?: string;
}

/**
 * Client for Sienge Purchase Quotation endpoints.
 * PRD-07 §7.1 — `/purchase-quotations/all/negotiations`
 */
export class QuotationClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Lists all quotation negotiations with automatic pagination.
   * Endpoint: GET /purchase-quotations/all/negotiations
   */
  async listNegotiations(
    filters: ListNegotiationsFilters = {},
    context?: RequestContext,
  ): Promise<SiengeQuotationNegotiation[]> {
    return this.client.paginateAll<SiengeQuotationNegotiation>(
      '/purchase-quotations/all/negotiations',
      filters as Record<string, unknown>,
      context,
    );
  }

  /**
   * Lists a single page of quotation negotiations.
   * Useful when only a specific range is needed.
   */
  async listNegotiationsPaged(
    filters: ListNegotiationsFilters & { limit?: number; offset?: number } = {},
    context?: RequestContext,
  ): Promise<SiengePaginatedResponse<SiengeQuotationNegotiation>> {
    const { limit = 100, offset = 0, ...restFilters } = filters;
    return this.client.get<SiengePaginatedResponse<SiengeQuotationNegotiation>>(
      '/purchase-quotations/all/negotiations',
      context,
      { params: { ...restFilters, limit, offset } },
    );
  }
}
