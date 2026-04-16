import { SiengeClient, RequestContext } from '../client.js';
import type {
  CreateNegotiationRequest,
  UpdateNegotiationRequest,
  UpdateNegotiationItemRequest,
} from '../types/sienge-types.js';

/**
 * Client for Sienge Negotiation write endpoints.
 * PRD-07 §7.2 — Write operations on purchase quotation negotiations.
 *
 * IMPORTANT: All write operations in this client must ONLY be invoked
 * after explicit approval by `Compras` (RN-12). The authorization step
 * in particular MUST NOT be called without prior manual approval.
 */
export class NegotiationClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Creates a new negotiation for a supplier on a quotation.
   * Endpoint: POST /purchase-quotations/{id}/suppliers/{supplierId}/negotiations
   *
   * CAUTION: Verify the supplier exists in the quotation map before calling (RN-10).
   * POST is NOT automatically retried at the HTTP level; retry is managed
   * by the business retry layer (Camada 3).
   */
  async create<T = unknown>(
    purchaseQuotationId: number,
    supplierId: number,
    body: CreateNegotiationRequest,
    context?: RequestContext,
  ): Promise<T> {
    return this.client.post<T>(
      `/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations`,
      body,
      context,
    );
  }

  /**
   * Updates an existing negotiation.
   * Endpoint: PUT /purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}
   *
   * PUT is treated as idempotent — automatic HTTP retry is enabled.
   */
  async update<T = unknown>(
    purchaseQuotationId: number,
    supplierId: number,
    negotiationNumber: number,
    body: UpdateNegotiationRequest,
    context?: RequestContext,
  ): Promise<T> {
    return this.client.put<T>(
      `/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations/${negotiationNumber}`,
      body,
      context,
    );
  }

  /**
   * Updates a specific item in a negotiation.
   * Endpoint: PUT /purchase-quotations/{id}/suppliers/{supplierId}/negotiations/{negotiationNumber}/items/{quotationItemNumber}
   *
   * PUT is treated as idempotent — automatic HTTP retry is enabled.
   */
  async updateItem<T = unknown>(
    purchaseQuotationId: number,
    supplierId: number,
    negotiationNumber: number,
    quotationItemNumber: number,
    body: UpdateNegotiationItemRequest,
    context?: RequestContext,
  ): Promise<T> {
    return this.client.put<T>(
      `/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations/${negotiationNumber}/items/${quotationItemNumber}`,
      body,
      context,
    );
  }

  /**
   * Authorizes the latest negotiation for a supplier on a quotation.
   * Endpoint: PATCH /purchase-quotations/{id}/suppliers/{supplierId}/negotiations/latest/authorize
   *
   * CRITICAL: This endpoint MUST ONLY be called after manual approval
   * by `Compras` (RN-12). PATCH is NOT automatically retried at the
   * HTTP level; retry is managed by the business retry layer (Camada 3).
   */
  async authorize<T = unknown>(
    purchaseQuotationId: number,
    supplierId: number,
    context?: RequestContext,
  ): Promise<T> {
    return this.client.patch<T>(
      `/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations/latest/authorize`,
      undefined,
      context,
    );
  }
}
