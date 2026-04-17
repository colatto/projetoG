import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { DeliveryRequirementClient } from '../../clients/delivery-requirement-client.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SiengeClient } from '../../client.js';
import type { SiengeDeliveryRequirement } from '../../types/sienge-types.js';

describe('DeliveryRequirementClient', () => {
  let mockSiengeClient: Mocked<SiengeClient>;
  let deliveryRequirementClient: DeliveryRequirementClient;

  beforeEach(() => {
    mockSiengeClient = {
      paginateAll: vi.fn(),
    } as unknown as Mocked<SiengeClient>;

    deliveryRequirementClient = new DeliveryRequirementClient(mockSiengeClient);
  });

  it('should call paginateAll with the expected endpoint path', async () => {
    const mockRequirements = [{ openQuantity: 10 }] as SiengeDeliveryRequirement[];
    mockSiengeClient.paginateAll.mockResolvedValue(mockRequirements);

    const result = await deliveryRequirementClient.get(321, 7);

    expect(mockSiengeClient.paginateAll).toHaveBeenCalledWith(
      '/purchase-requests/321/items/7/delivery-requirements',
      {},
      undefined,
    );
    expect(result).toEqual(mockRequirements);
  });

  it('should forward the request context to paginateAll', async () => {
    const context = { correlationId: 'delivery-requirements-1', source: 'test-suite' };

    await deliveryRequirementClient.get(321, 7, context);

    expect(mockSiengeClient.paginateAll).toHaveBeenCalledWith(
      '/purchase-requests/321/items/7/delivery-requirements',
      {},
      context,
    );
  });
});
