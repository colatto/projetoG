import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookType, WebhookStatus, IntegrationEventType } from '@projetog/domain';

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
      { expectedQuotationIds: [200] }
    );

    // Verify success integration event
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: IntegrationEventType.WEBHOOK_PROCESSED,
      status: 'success',
      related_entity_type: 'order',
      related_entity_id: '100',
    }));
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
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      response_payload: expect.objectContaining({ skipped: true }),
    }));
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
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      event_type: IntegrationEventType.WEBHOOK_FAILED,
      status: 'failure',
      error_message: 'Reconciliation failed',
    }));
  });
});
