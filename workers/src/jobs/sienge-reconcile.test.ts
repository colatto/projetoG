import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEntityType, IntegrationEventType } from '@projetog/domain';

const getByIdMock = vi.fn();
const getItemsMock = vi.fn();
const listNegotiationsMock = vi.fn();

const purchaseOrdersSingleMock = vi.fn();

const purchaseOrdersUpsertMock = vi.fn();
const purchaseOrderItemsUpsertMock = vi.fn();
const orderQuotationLinksUpsertMock = vi.fn();
const purchaseQuotationsUpsertMock = vi.fn();
const supplierNegotiationsEqMock3 = vi.fn();
const suppliersMaybeSingleMock = vi.fn();
const suppliersUpsertMock = vi.fn();

const integrationEventsInsertMock = vi.fn();
const profilesSelectMock = vi.fn();
const notificationsInsertMock = vi.fn();

const supabaseMock = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'purchase_orders':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: purchaseOrdersSingleMock,
            })),
          })),
          upsert: purchaseOrdersUpsertMock,
        };
      case 'purchase_order_items':
        return {
          upsert: purchaseOrderItemsUpsertMock,
        };
      case 'order_quotation_links':
        return {
          upsert: orderQuotationLinksUpsertMock,
        };
      case 'purchase_quotations':
        return {
          upsert: purchaseQuotationsUpsertMock,
        };
      case 'supplier_negotiations':
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: supplierNegotiationsEqMock3,
              })),
            })),
          })),
        };
      case 'integration_events':
        return {
          insert: integrationEventsInsertMock,
        };
      case 'profiles':
        return {
          select: profilesSelectMock,
        };
      case 'notifications':
        return {
          insert: notificationsInsertMock,
        };
      case 'audit_logs':
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      case 'suppliers':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: suppliersMaybeSingleMock,
            })),
          })),
          upsert: suppliersUpsertMock,
        };
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  }),
};

vi.mock('../supabase.js', () => ({
  getSupabase: () => supabaseMock,
}));

vi.mock('../sienge.js', () => ({
  getSiengeClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('@projetog/integration-sienge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@projetog/integration-sienge')>();
  return {
    ...actual,
    OrderClient: vi.fn(function OrderClientMock() {
      return {
        getById: getByIdMock,
        getItems: getItemsMock,
      };
    }),
    QuotationClient: vi.fn(function QuotationClientMock() {
      return {
        listNegotiations: listNegotiationsMock,
      };
    }),
    CreditorClient: vi.fn(function CreditorClientMock() {
      return {
        getById: vi.fn().mockRejectedValue(new Error('Not available in test')),
      };
    }),
  };
});

const { processSiengeReconcile } = await import('./sienge-reconcile.js');

describe('sienge-reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    purchaseOrdersSingleMock.mockResolvedValue({
      data: { sienge_status: 'PENDING', authorized: false },
      error: null,
    });
    purchaseOrdersUpsertMock.mockResolvedValue({ error: null });
    purchaseOrderItemsUpsertMock.mockResolvedValue({ error: null });
    orderQuotationLinksUpsertMock.mockResolvedValue({ error: null });
    purchaseQuotationsUpsertMock.mockResolvedValue({ error: null });
    supplierNegotiationsEqMock3.mockResolvedValue({ error: null });
    integrationEventsInsertMock.mockResolvedValue({ error: null });
    // Supplier already exists in DB (no stub needed)
    suppliersMaybeSingleMock.mockResolvedValue({ data: { id: 10 }, error: null });
    suppliersUpsertMock.mockResolvedValue({ error: null });
    profilesSelectMock.mockResolvedValue({
      data: [
        {
          id: 'compras-1',
          email: 'compras@grf.com.br',
          role: 'compras',
          status: 'ativo',
        },
      ],
      error: null,
    });
    notificationsInsertMock.mockResolvedValue({ error: null });
  });

  describe('processSiengeReconcile', () => {
    it('should run order reconciliation successfully', async () => {
      getByIdMock.mockResolvedValue({
        // Real API uses `id`, not `purchaseOrderId`
        id: 100,
        status: 'PENDING',
        authorized: false,
        supplierId: 10,
        purchaseQuotations: [],
      });
      getItemsMock.mockResolvedValue([]);

      await processSiengeReconcile({
        id: 'job-1',
        data: { entityType: 'order', entityId: 100, reason: 'test' },
      } as never);

      expect(integrationEventsInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: IntegrationEventType.SYNC_ORDERS,
          status: 'success',
          related_entity_type: IntegrationEntityType.ORDER,
          related_entity_id: '100',
        }),
      );
    });

    it('should log divergence if existing data differs from API', async () => {
      // Existing data is PENDING/false
      purchaseOrdersSingleMock.mockResolvedValue({
        data: { sienge_status: 'PENDING', authorized: false },
        error: null,
      });

      // API returns APPROVED/true
      getByIdMock.mockResolvedValue({
        id: 100,
        status: 'APPROVED',
        authorized: true,
        supplierId: 10,
        purchaseQuotations: [{ purchaseQuotationId: 999 }],
      });
      getItemsMock.mockResolvedValue([]);

      await processSiengeReconcile({
        id: 'job-2',
        data: { entityType: 'order', entityId: 100, reason: 'test', expectedQuotationIds: [999] },
      } as never);

      // Verify divergence was logged
      expect(integrationEventsInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: IntegrationEventType.RECONCILIATION_DIVERGENCE,
          response_payload: expect.objectContaining({
            divergences: ['sienge_status: PENDING -> APPROVED', 'authorized: false -> true'],
          }),
        }),
      );
      expect(notificationsInsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'RECONCILIATION_DIVERGENCE',
            recipient_email: 'compras@grf.com.br',
          }),
        ]),
      );
    });

    it('should log divergence if expected quotation is missing from API links', async () => {
      getByIdMock.mockResolvedValue({
        id: 100,
        status: 'PENDING',
        authorized: false,
        supplierId: 10,
        purchaseQuotations: [{ purchaseQuotationId: 888 }], // Only has 888
      });
      getItemsMock.mockResolvedValue([]);

      await processSiengeReconcile({
        id: 'job-3',
        data: { entityType: 'order', entityId: 100, reason: 'test', expectedQuotationIds: [999] }, // Expected 999
      } as never);

      // Verify divergence was logged
      expect(integrationEventsInsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: IntegrationEventType.RECONCILIATION_DIVERGENCE,
          response_payload: expect.objectContaining({
            divergences: ['webhook link(s) missing from API confirmation: 999'],
          }),
        }),
      );
    });
  });
});
