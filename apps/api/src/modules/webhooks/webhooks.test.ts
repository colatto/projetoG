import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { IntegrationEventType, WebhookType } from '@projetog/domain';
import { FastifyInstance } from 'fastify';

const mockFrom = vi.fn();
const mockBossSend = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      admin: {
        updateUserById: vi.fn(),
      },
    },
    from: mockFrom,
  }),
}));

function buildTestApp() {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.SIENGE_WEBHOOK_SECRET = 'webhook-secret';

  return buildApp({
    boss: {
      send: mockBossSend,
    },
  });
}

describe('Webhook Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should accept a valid Sienge webhook, persist it and enqueue async processing', async () => {
    const duplicateLookup = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const webhookInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'webhook-event-id' },
          error: null,
        }),
      }),
    });
    const integrationInsert = vi.fn().mockResolvedValue({ error: null });
    mockBossSend.mockResolvedValueOnce('job-id');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: duplicateLookup,
            })),
          })),
          insert: webhookInsert,
        };
      }

      if (table === 'integration_events') {
        return { insert: integrationInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/sienge',
      headers: {
        'x-sienge-id': 'delivery-001',
        'x-sienge-event': WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        'x-sienge-hook-id': 'hook-123',
        'x-sienge-tenant': 'tenant-a',
      },
      payload: {
        type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        data: {
          purchaseOrderId: 321,
          purchaseQuotationId: 654,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'received' });
    expect(duplicateLookup).toHaveBeenCalled();
    expect(webhookInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        webhook_type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: {
          type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
          data: {
            purchaseOrderId: 321,
            purchaseQuotationId: 654,
          },
        },
        sienge_delivery_id: 'delivery-001',
        sienge_event: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        sienge_hook_id: 'hook-123',
        sienge_tenant: 'tenant-a',
        status: 'received',
      }),
    );
    expect(integrationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.WEBHOOK_RECEIVED,
        direction: 'inbound',
      }),
    );
    expect(mockBossSend).toHaveBeenCalledWith(
      'sienge:process-webhook',
      {
        webhookEventId: 'webhook-event-id',
        webhookType: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: {
          purchaseOrderId: 321,
          purchaseQuotationId: 654,
        },
      },
      expect.objectContaining({
        retryLimit: 3,
      }),
    );
  });

  it('should reject webhook requests without the required Sienge headers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/sienge',
      payload: {
        type: WebhookType.PURCHASE_ORDER_ITEM_MODIFIED,
        data: { purchaseOrderId: 123 },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
  });

  it('should reject webhook requests when an optional secret is provided with the wrong value', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/sienge',
      headers: {
        'x-sienge-id': 'delivery-002',
        'x-sienge-event': WebhookType.PURCHASE_ORDER_ITEM_MODIFIED,
        'x-webhook-secret': 'wrong-secret',
      },
      payload: {
        type: WebhookType.PURCHASE_ORDER_ITEM_MODIFIED,
        data: { purchaseOrderId: 123 },
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
  });

  it('should persist CONTRACT_AUTHORIZED with contract entity type on WEBHOOK_RECEIVED', async () => {
    const duplicateLookup = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const webhookInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'webhook-contract-id' },
          error: null,
        }),
      }),
    });
    const integrationInsert = vi.fn().mockResolvedValue({ error: null });
    mockBossSend.mockResolvedValueOnce('job-id');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: duplicateLookup,
            })),
          })),
          insert: webhookInsert,
        };
      }

      if (table === 'integration_events') {
        return { insert: integrationInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/sienge',
      headers: {
        'x-sienge-id': 'delivery-contract-001',
        'x-sienge-event': WebhookType.CONTRACT_AUTHORIZED,
      },
      payload: {
        type: WebhookType.CONTRACT_AUTHORIZED,
        data: {
          documentId: 'DOC-42',
          contractNumber: 100,
          consistent: true,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(integrationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.WEBHOOK_RECEIVED,
        related_entity_type: 'contract',
      }),
    );
    expect(mockBossSend).toHaveBeenCalledWith(
      'sienge:process-webhook',
      expect.objectContaining({
        webhookType: WebhookType.CONTRACT_AUTHORIZED,
        payload: {
          documentId: 'DOC-42',
          contractNumber: 100,
          consistent: true,
        },
      }),
      expect.any(Object),
    );
  });

  it('should acknowledge duplicate deliveries without persisting or enqueueing again', async () => {
    const duplicateLookup = vi.fn().mockResolvedValue({
      data: { id: 'existing-webhook-id', status: 'processed' },
      error: null,
    });
    const webhookInsert = vi.fn();
    const integrationInsert = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'webhook_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: duplicateLookup,
            })),
          })),
          insert: webhookInsert,
        };
      }

      if (table === 'integration_events') {
        return { insert: integrationInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/sienge',
      headers: {
        'x-sienge-id': 'delivery-003',
        'x-sienge-event': WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
      },
      payload: {
        type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        data: {
          purchaseOrderId: 321,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'duplicate' });
    expect(webhookInsert).not.toHaveBeenCalled();
    expect(integrationInsert).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
  });
});
