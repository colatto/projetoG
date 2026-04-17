import { IntegrationEventType, IntegrationEventStatus } from '@projetog/domain';

export const mockIntegrationEvent = {
  id: 'evt-123',
  event_type: IntegrationEventType.WRITE_NEGOTIATION,
  status: IntegrationEventStatus.PENDING,
  retry_count: 0,
  max_retries: 2,
  request_payload: {},
  error_message: null,
  next_retry_at: null,
};

export const baseOutboundJobData = {
  integrationEventId: mockIntegrationEvent.id,
  actorId: 'user-1',
  purchaseQuotationId: 10,
  supplierId: 20,
  supplierAnswerDate: '2026-04-20',
  validity: 15,
  seller: 'John Doe',
  items: [
    {
      purchaseQuotationItemId: 30,
      unitPrice: 100,
      quantity: 5,
      deliveryDate: '2026-04-25',
    },
  ],
};

export const baseWebhookPayload = {
  webhookEventId: 'wh-evt-456',
  payload: {
    data: { id: 999 },
    timestamp: '2026-04-16T12:00:00Z',
  }
};
