import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { IntegrationEventType, UserRole, UserStatus, WebhookType } from '@projetog/domain';

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

  return buildApp({
    boss: {
      send: mockBossSend,
    },
  });
}

async function getAuthToken(app: ReturnType<typeof buildApp>, role: UserRole) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000001',
    email: 'compras@grf.com.br',
    name: 'Compras',
    role,
    status: UserStatus.ATIVO,
  });
}

function createAwaitableBuilder<T extends object>(result: T) {
  const builder = {
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    range: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (value: T) => unknown) => Promise.resolve(result).then(resolve),
  };

  return builder;
}

describe('Integration Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list integration events for Compras with filters and pagination', async () => {
    const listBuilder = createAwaitableBuilder({
      data: [
        {
          id: 'integration-event-id',
          event_type: IntegrationEventType.WEBHOOK_RECEIVED,
          status: 'success',
        },
      ],
      count: 1,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'integration_events') {
        return {
          select: vi.fn(() => listBuilder),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const app = buildTestApp();
    await app.ready();
    const token = await getAuthToken(app, UserRole.COMPRAS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/integration/events?status=success&page=1&limit=10',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        {
          id: 'integration-event-id',
          event_type: IntegrationEventType.WEBHOOK_RECEIVED,
          status: 'success',
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        limit: 10,
      },
    });
    expect(listBuilder.eq).toHaveBeenCalledWith('status', 'success');
    expect(listBuilder.range).toHaveBeenCalledWith(0, 9);
    expect(listBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('should forbid retry for non-Compras roles', async () => {
    const app = buildTestApp();
    await app.ready();
    const token = await getAuthToken(app, UserRole.ADMINISTRADOR);

    const response = await app.inject({
      method: 'POST',
      url: '/api/integration/events/00000000-0000-0000-0000-000000000010/retry',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should reset and re-enqueue a failed webhook integration event for Compras', async () => {
    const selectSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'integration-event-id',
        event_type: IntegrationEventType.WEBHOOK_FAILED,
        direction: 'inbound',
        endpoint: '/webhooks/sienge',
        http_method: 'POST',
        http_status: 500,
        request_payload: null,
        response_payload: null,
        status: 'failure',
        error_message: 'boom',
        retry_count: 3,
        max_retries: 3,
        next_retry_at: null,
        related_entity_type: 'order',
        related_entity_id: 'webhook-event-id',
        idempotency_key: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    const webhookSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'webhook-event-id',
        webhook_type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: {
          type: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
          data: { purchaseOrderId: 123, purchaseQuotationId: 456 },
        },
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const integrationUpdate = vi.fn(() => ({ eq: updateEq }));
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mockBossSend.mockResolvedValueOnce('job-id');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'integration_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: selectSingle,
            })),
          })),
          update: integrationUpdate,
        };
      }

      if (table === 'webhook_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: webhookSingle,
            })),
          })),
        };
      }

      if (table === 'audit_logs') {
        return {
          insert: auditInsert,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const app = buildTestApp();
    await app.ready();
    const token = await getAuthToken(app, UserRole.COMPRAS);

    const response = await app.inject({
      method: 'POST',
      url: '/api/integration/events/00000000-0000-0000-0000-000000000010/retry',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updateEq).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000010');
    expect(mockBossSend).toHaveBeenCalledWith(
      'sienge:process-webhook',
      expect.objectContaining({
        integrationEventId: '00000000-0000-0000-0000-000000000010',
        webhookEventId: 'webhook-event-id',
        webhookType: WebhookType.PURCHASE_ORDER_GENERATED_FROM_NEGOCIATION,
        payload: { purchaseOrderId: 123, purchaseQuotationId: 456 },
        retriggeredBy: '00000000-0000-0000-0000-000000000001',
      }),
      expect.objectContaining({
        retryLimit: 3,
      }),
    );
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'integration.manual_retry',
        entity_type: 'integration_event',
      }),
    );
  });

  it('should enqueue an outbound negotiation with a valid integration event HTTP method', async () => {
    const integrationInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'evt-write-123' },
          error: null,
        }),
      }),
    });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mockBossSend.mockResolvedValueOnce('job-id');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'integration_events') {
        return { insert: integrationInsert };
      }

      if (table === 'audit_logs') {
        return { insert: auditInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const app = buildTestApp();
    await app.ready();
    const token = await getAuthToken(app, UserRole.COMPRAS);

    const response = await app.inject({
      method: 'POST',
      url: '/api/integration/negotiations/write',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        purchaseQuotationId: 321,
        supplierId: 654,
        idempotencyKey: 'idem-123',
        supplierAnswerDate: '2026-04-17',
        validity: 15,
        seller: 'Comprador Teste',
        items: [
          {
            purchaseQuotationItemId: 77,
            unitPrice: 99.9,
            quantity: 10,
            deliveryDate: '2026-04-20',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(integrationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/purchase-quotations/321/suppliers/654/negotiations',
        http_method: 'POST',
      }),
    );
    expect(mockBossSend).toHaveBeenCalledWith(
      'sienge:outbound-negotiation',
      expect.objectContaining({
        integrationEventId: 'evt-write-123',
        purchaseQuotationId: 321,
        supplierId: 654,
      }),
      expect.objectContaining({
        retryLimit: 0,
      }),
    );
  });
});
