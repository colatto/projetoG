import { SiengeClient, RequestContext } from '../client.js';
import type { SiengeDeliveryRequirement } from '../types/sienge-types.js';

/**
 * Client for Sienge Delivery Requirement endpoints.
 * PRD-07 §7.1 — `/purchase-requests/{id}/items/{itemNumber}/delivery-requirements`
 */
export class DeliveryRequirementClient {
  constructor(private readonly client: SiengeClient) {}

  /**
   * Gets delivery requirements for a specific purchase request item.
   * Endpoint: GET /purchase-requests/{id}/items/{itemNumber}/delivery-requirements
   *
   * Note: The `openQuantity` field may return as number or string
   * depending on Sienge environment (§17.9 — pending homologation).
   */
  async get(
    purchaseRequestId: number,
    purchaseRequestItemNumber: number,
    context?: RequestContext,
  ): Promise<SiengeDeliveryRequirement[]> {
    return this.client.paginateAll<SiengeDeliveryRequirement>(
      `/purchase-requests/${purchaseRequestId}/items/${purchaseRequestItemNumber}/delivery-requirements`,
      {},
      context,
    );
  }
}
