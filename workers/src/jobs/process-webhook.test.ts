import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEntityType, WebhookType, IntegrationEventType } from '@projetog/domain';

const reconcileOrderFromApiMock = vi.fn();
const reconcileQuotationFromApiMock = vi.fn();

vi.mock('./sienge-reconcile.js', () => ({
  reconcileOrderFromApi: reconcileOrderFromApiMock,
  reconcileQuotationFromApi: reconcileQuotationFromApiMock,
}));

const webhookEventsUpdateMock = vi.fn();
const integrationEventsInsertMock = vi.fn();

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === 'webhook_events') {
      return {
        update: vi.fn(() => ({
          eq: webhookEventsUpdateMock,
        })),
      };
    }
    if (table === 'integration_events') {
      return {
        insert: integrationEventsInsertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
};

vi.mock('../supabase.js', () => ({
  getSupabase: () => supabaseMock,
}));

vi.mock('../sienge.js', () => ({
  getSiengeClient: vi.fn().mockResolvedValue({}),
}));

const { processWebhook } = await import('./process-webhook.js');

describe('processWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookEventsUpdateMock.mockResolvedValue({ error: null });
    integrationEventsInsertMock.mockResolvedValue({ error: null });
  });

  it('should process PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION successfully', async () => {
    reconcileOrderFromApiMock.mockResolvedValue({
      divergenceMessages: [],
      summary: { synced: true },
    });

    const job = {
      id: 'job-1',
      data: {
        webhookEventId: 'wh-1',
        webhookType: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: { purchaseOrderId: 100, purchaseQuotations: [{ purchaseQuotationId: 200 }] },
      },
    };

    await processWebhook(job as never);

    // Verify webhook status updates
    expect(webhookEventsUpdateMock).toHaveBeenCalledWith('id', 'wh-1');
    expect(supabaseMock.from).toHaveBeenCalledWith('webhook_events');

    // Verify it called the correct reconcile function
    expect(reconcileOrderFromApiMock).toHaveBeenCalledWith(
      100,
      supabaseMock,
      expect.any(Object),
      expect.any(Object),
      { expectedQuotationIds: [200] },
    );

    // Verify success integration event
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.WEBHOOK_PROCESSED,
        status: 'success',
        related_entity_type: 'order',
        related_entity_id: '100',
      }),
    );
  });

  it('should handle unmapped webhook types gracefully', async () => {
    const job = {
      id: 'job-2',
      data: {
        webhookEventId: 'wh-2',
        webhookType: 'UNKNOWN_WEBHOOK' as WebhookType,
        payload: { someId: 999 },
      },
    };

    await processWebhook(job as never);

    expect(webhookEventsUpdateMock).toHaveBeenCalledWith('id', 'wh-2');

    // Should log success event but indicate skipped
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        response_payload: expect.objectContaining({ skipped: true }),
      }),
    );
  });

  it('should process CONTRACT_AUTHORIZED as ACK-only without reconcile', async () => {
    const job = {
      id: 'job-contract-auth',
      data: {
        webhookEventId: 'wh-contract-a',
        webhookType: WebhookType.CONTRACT_AUTHORIZED,
        payload: { documentId: 'D1', contractNumber: 42, consistent: true },
      },
    };

    await processWebhook(job as never);

    expect(reconcileOrderFromApiMock).not.toHaveBeenCalled();
    expect(reconcileQuotationFromApiMock).not.toHaveBeenCalled();
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.WEBHOOK_PROCESSED,
        related_entity_type: IntegrationEntityType.CONTRACT,
        related_entity_id: '42',
        response_payload: expect.objectContaining({
          ackPipeline: true,
          contractNumber: 42,
          consistent: true,
        }),
      }),
    );
  });

  it('should process CONTRACT_UNAUTHORIZED as ACK-only', async () => {
    const job = {
      id: 'job-contract-unauth',
      data: {
        webhookEventId: 'wh-contract-u',
        webhookType: WebhookType.CONTRACT_UNAUTHORIZED,
        payload: { documentId: 'D2', contractNumber: 99, consistent: false, disapproved: true },
      },
    };

    await processWebhook(job as never);

    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        related_entity_type: IntegrationEntityType.CONTRACT,
        related_entity_id: '99',
        response_payload: expect.objectContaining({
          disapproved: true,
        }),
      }),
    );
  });

  it('should process MEASUREMENT_AUTHORIZED as ACK-only', async () => {
    const job = {
      id: 'job-meas-auth',
      data: {
        webhookEventId: 'wh-meas-a',
        webhookType: WebhookType.MEASUREMENT_AUTHORIZED,
        payload: {
          documentId: 'D3',
          contractNumber: 1,
          measurementNumber: 700,
          buildingId: 55,
        },
      },
    };

    await processWebhook(job as never);

    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        related_entity_type: IntegrationEntityType.MEASUREMENT,
        related_entity_id: '700',
        response_payload: expect.objectContaining({
          measurementNumber: 700,
          buildingId: 55,
        }),
      }),
    );
  });

  it('should process MEASUREMENT_UNAUTHORIZED as ACK-only', async () => {
    const job = {
      id: 'job-meas-unauth',
      data: {
        webhookEventId: 'wh-meas-u',
        webhookType: WebhookType.MEASUREMENT_UNAUTHORIZED,
        payload: {
          documentId: 'D4',
          contractNumber: 2,
          measurementNumber: 701,
          buildingId: 56,
        },
      },
    };

    await processWebhook(job as never);

    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        related_entity_type: IntegrationEntityType.MEASUREMENT,
        related_entity_id: '701',
      }),
    );
  });

  it('should process CLEARING_FINISHED as ACK-only', async () => {
    const job = {
      id: 'job-clear-f',
      data: {
        webhookEventId: 'wh-clear-f',
        webhookType: WebhookType.CLEARING_FINISHED,
        payload: {
          documentId: 'D5',
          contractNumber: 3,
          measurementNumber: 900,
          buildingId: 77,
        },
      },
    };

    await processWebhook(job as never);

    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        related_entity_type: IntegrationEntityType.CLEARING,
        related_entity_id: '900',
      }),
    );
  });

  it('should process CLEARING_DELETED as ACK-only using documentId when measurement missing', async () => {
    const job = {
      id: 'job-clear-d',
      data: {
        webhookEventId: 'wh-clear-d',
        webhookType: WebhookType.CLEARING_DELETED,
        payload: {
          documentId: 'DOC-X',
          contractNumber: 4,
          buildingId: 88,
        },
      },
    };

    await processWebhook(job as never);

    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        related_entity_type: IntegrationEntityType.CLEARING,
        related_entity_id: 'DOC-X',
      }),
    );
  });

  it('should handle reconcile errors and log failure integration event', async () => {
    reconcileOrderFromApiMock.mockRejectedValue(new Error('Reconciliation failed'));

    const job = {
      id: 'job-3',
      data: {
        webhookEventId: 'wh-3',
        webhookType: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: { purchaseOrderId: 100 },
      },
    };

    await expect(processWebhook(job as never)).rejects.toThrow('Reconciliation failed');

    // Verify failed integration event
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.WEBHOOK_FAILED,
        status: 'failure',
        error_message: 'Reconciliation failed',
      }),
    );
  });
});
