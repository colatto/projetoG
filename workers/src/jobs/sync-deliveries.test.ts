import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncResourceType, SyncStatus } from '@projetog/domain';

const getDeliveriesAttendedMock = vi.fn();
const getByIdMock = vi.fn();
const getItemsMock = vi.fn();

const cursorSingleMock = vi.fn();
const cursorUpdateEqMock = vi.fn();
const deliveriesUpsertMock = vi.fn();
const purchaseInvoicesUpsertMock = vi.fn();
const invoiceItemsUpsertMock = vi.fn();
const invoiceOrderLinksUpsertMock = vi.fn();
const integrationEventsInsertMock = vi.fn();
// Mock for purchase_orders.select('id').order() — returns array of order IDs
const purchaseOrdersSelectOrderMock = vi.fn();

type QueryResult = { data: unknown; error?: unknown };
type ChainableQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (resolve: (value: QueryResult) => unknown) => unknown;
};

let damageReplacementsSelectResult: QueryResult = { data: [], error: null };
const damageReplacementsUpdateInMock = vi.fn();
let damagesSelectResult: QueryResult = { data: [], error: null };
const damagesUpdateInMock = vi.fn();
const damageAuditInsertMock = vi.fn();

const createChainableQuery = (resolvedValue: QueryResult): ChainableQuery => {
  const chainable = {
    select: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    neq: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    single: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: (value: QueryResult) => unknown) => resolve(resolvedValue),
  } as ChainableQuery;
  return chainable;
};

const supabaseMock = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'sienge_sync_cursor':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: cursorSingleMock,
            })),
          })),
          update: vi.fn(() => ({
            eq: cursorUpdateEqMock,
          })),
        };
      case 'deliveries':
        return {
          upsert: deliveriesUpsertMock,
          select: vi.fn(() => createChainableQuery({ data: [] })),
        };
      case 'purchase_invoices':
        return {
          upsert: purchaseInvoicesUpsertMock,
        };
      case 'invoice_items':
        return {
          upsert: invoiceItemsUpsertMock,
        };
      case 'invoice_order_links':
        return {
          upsert: invoiceOrderLinksUpsertMock,
        };
      case 'integration_events':
        return {
          insert: integrationEventsInsertMock,
        };
      case 'damage_replacements':
        return {
          select: vi.fn(() => createChainableQuery(damageReplacementsSelectResult)),
          update: vi.fn(() => ({
            in: damageReplacementsUpdateInMock,
          })),
        };
      case 'damages':
        return {
          select: vi.fn(() => createChainableQuery(damagesSelectResult)),
          update: vi.fn(() => ({
            in: damagesUpdateInMock,
          })),
        };
      case 'damage_audit_logs':
        return {
          insert: damageAuditInsertMock,
        };
      case 'purchase_order_items':
        return {
          select: vi.fn(() => createChainableQuery({ data: { quantity: 10 } })),
        };
      case 'purchase_orders':
        return {
          select: vi.fn(() => ({
            // Support both patterns:
            // 1. .select('id').order() — returns array (used by new iteration approach)
            order: purchaseOrdersSelectOrderMock,
            // 2. .select('...').eq() — returns single (used by recalculateOrderStatus)
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, date: '2026-04-10', local_status: 'PENDENTE' },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn() })),
        };
      case 'delivery_schedules':
        return {
          select: vi.fn(() => createChainableQuery({ data: [] })),
        };
      case 'order_status_history':
      case 'audit_logs':
        return {
          insert: vi.fn(),
        };
      case 'follow_up_trackers':
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
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
    InvoiceClient: vi.fn(function InvoiceClientMock() {
      return {
        getDeliveriesAttended: getDeliveriesAttendedMock,
        getById: getByIdMock,
        getItems: getItemsMock,
      };
    }),
  };
});

const { processSyncDeliveries } = await import('./sync-deliveries.js');

describe('processSyncDeliveries', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cursorSingleMock.mockResolvedValue({
      data: { sync_status: SyncStatus.IDLE, last_offset: 0 },
      error: null,
    });
    cursorUpdateEqMock.mockResolvedValue({ error: null });

    // Default: one order exists in DB for iteration
    purchaseOrdersSelectOrderMock.mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    });

    // deliveriesUpsertMock returns a chainable with .select().single()
    deliveriesUpsertMock.mockImplementation(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'delivery-uuid-1' },
          error: null,
        }),
      })),
    }));
    purchaseInvoicesUpsertMock.mockResolvedValue({ error: null });
    invoiceItemsUpsertMock.mockResolvedValue({ error: null });
    invoiceOrderLinksUpsertMock.mockResolvedValue({ error: null });
    integrationEventsInsertMock.mockResolvedValue({ error: null });
    damageReplacementsSelectResult = { data: [], error: null };
    damageReplacementsUpdateInMock.mockResolvedValue({ data: null, error: null });
    damagesSelectResult = { data: [], error: null };
    damagesUpdateInMock.mockResolvedValue({ data: null, error: null });
    damageAuditInsertMock.mockResolvedValue({ error: null });
  });

  it('should process sync deliveries successfully', async () => {
    getDeliveriesAttendedMock.mockResolvedValueOnce([
      {
        purchaseOrderId: 1,
        purchaseOrderItemNumber: 2,
        sequentialNumber: 10,
        invoiceItemNumber: 20,
        quantity: 5,
      },
    ]);

    getByIdMock.mockResolvedValue({
      sequentialNumber: 10,
      supplierId: 100,
    });

    getItemsMock.mockResolvedValue([{ invoiceItemNumber: 20, quantity: 5 }]);

    await processSyncDeliveries({ id: 'job-1' } as never);

    // Assert cursor running update
    expect(supabaseMock.from).toHaveBeenCalledWith('sienge_sync_cursor');
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.DELIVERIES);

    // Assert delivery upsert
    expect(deliveriesUpsertMock).toHaveBeenCalled();
    expect(deliveriesUpsertMock.mock.calls[0][0].purchase_order_id).toBe(1);

    // Assert invoice upsert
    expect(getByIdMock).toHaveBeenCalledWith(10, expect.any(Object));
    expect(purchaseInvoicesUpsertMock).toHaveBeenCalled();
    expect(purchaseInvoicesUpsertMock.mock.calls[0][0].sequential_number).toBe(10);

    // Assert invoice items upsert
    expect(getItemsMock).toHaveBeenCalledWith(10, expect.any(Object));
    expect(invoiceItemsUpsertMock).toHaveBeenCalled();
    expect(invoiceItemsUpsertMock.mock.calls[0][0].item_number).toBe(20);

    // Assert links upsert
    expect(invoiceOrderLinksUpsertMock).toHaveBeenCalled();
    expect(invoiceOrderLinksUpsertMock.mock.calls[0][0].sequential_number).toBe(10);

    // Assert final cursor update
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.DELIVERIES);
  });

  it('should handle partial failures gracefully (e.g. failing to fetch invoice details)', async () => {
    getDeliveriesAttendedMock.mockResolvedValueOnce([
      {
        purchaseOrderId: 1,
        purchaseOrderItemNumber: 2,
        sequentialNumber: 10,
        invoiceItemNumber: 20,
        quantity: 5,
      },
    ]);

    getByIdMock.mockRejectedValue(new Error('API Error fetching invoice'));

    await processSyncDeliveries({ id: 'job-2' } as never);

    // Assert delivery upsert happened
    expect(deliveriesUpsertMock).toHaveBeenCalled();

    // Assert invoice upsert did NOT happen
    expect(purchaseInvoicesUpsertMock).not.toHaveBeenCalled();

    // Assert links upsert still happened
    expect(invoiceOrderLinksUpsertMock).toHaveBeenCalled();
  });

  it('should handle total failure gracefully (no orders in DB)', async () => {
    // No orders in DB — delivery sync should skip gracefully
    purchaseOrdersSelectOrderMock.mockResolvedValue({
      data: [],
      error: null,
    });

    await processSyncDeliveries({ id: 'job-3' } as never);

    expect(deliveriesUpsertMock).not.toHaveBeenCalled();

    // Cursor should be set back to IDLE (not ERROR)
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.DELIVERIES);
  });

  it('should handle API failure for a specific order without crashing', async () => {
    getDeliveriesAttendedMock.mockRejectedValue(new Error('Order API failure'));

    await processSyncDeliveries({ id: 'job-3b' } as never);

    expect(deliveriesUpsertMock).not.toHaveBeenCalled();

    // Assert event is logged with failure status
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failure',
      }),
    );
  });

  it('marks replacement as delivered and audits reposicao_entregue', async () => {
    getDeliveriesAttendedMock.mockResolvedValueOnce([
      {
        purchaseOrderId: 1,
        purchaseOrderItemNumber: 2,
        sequentialNumber: 10,
        invoiceItemNumber: 20,
        quantity: 5,
      },
    ]);

    getByIdMock.mockResolvedValue({
      sequentialNumber: 10,
      supplierId: 100,
    });
    getItemsMock.mockResolvedValue([{ invoiceItemNumber: 20, quantity: 5 }]);

    damagesSelectResult = {
      data: [{ id: 'damage-1' }],
      error: null,
    };
    damageReplacementsSelectResult = {
      data: [{ id: 'replacement-1', damage_id: 'damage-1' }],
      error: null,
    };

    await processSyncDeliveries({ id: 'job-4' } as never);

    expect(damageReplacementsUpdateInMock).toHaveBeenCalledWith('id', ['replacement-1']);
    expect(damagesUpdateInMock).toHaveBeenCalledWith('id', ['damage-1']);
    expect(damageAuditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        damage_id: 'damage-1',
        event_type: 'reposicao_entregue',
        actor_profile: 'sistema',
        purchase_order_id: 1,
      }),
    );
  });
});
