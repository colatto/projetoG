import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncResourceType, SyncStatus } from '@projetog/domain';

const getDeliveriesAttendedPagedMock = vi.fn();
const getByIdMock = vi.fn();
const getItemsMock = vi.fn();

const cursorSingleMock = vi.fn();
const cursorUpdateEqMock = vi.fn();
const deliveriesUpsertMock = vi.fn();
const purchaseInvoicesUpsertMock = vi.fn();
const invoiceItemsUpsertMock = vi.fn();
const invoiceOrderLinksUpsertMock = vi.fn();
const integrationEventsInsertMock = vi.fn();

const createChainableQuery = (resolvedValue: any) => {
  const chainable: any = {
    select: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    neq: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => chainable),
    in: vi.fn(() => chainable),
    single: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any) => resolve(resolvedValue),
  };
  return chainable;
};

// Chainable mock for upsert that supports .select().single()
const createUpsertChain = (resolvedValue: any) => {
  const singleMock = vi.fn().mockResolvedValue(resolvedValue);
  const selectMock = vi.fn(() => ({ single: singleMock }));
  const upsertFn = vi.fn(() => ({ select: selectMock, error: null }));
  return upsertFn;
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
      case 'purchase_order_items':
        return {
          select: vi.fn(() => createChainableQuery({ data: { quantity: 10 } })),
        };
      case 'purchase_orders':
        return {
          select: vi.fn(() => createChainableQuery({ data: { id: 1, date: '2026-04-10' } })),
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
    InvoiceClient: vi.fn().mockImplementation(() => ({
      getDeliveriesAttendedPaged: getDeliveriesAttendedPagedMock,
      getById: getByIdMock,
      getItems: getItemsMock,
    })),
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
  });

  it('should process sync deliveries successfully', async () => {
    getDeliveriesAttendedPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseOrderId: 1,
          purchaseOrderItemNumber: 2,
          sequentialNumber: 10,
          invoiceItemNumber: 20,
          quantity: 5,
        },
      ],
      resultSetMetadata: { count: 1 },
    });

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
    getDeliveriesAttendedPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseOrderId: 1,
          purchaseOrderItemNumber: 2,
          sequentialNumber: 10,
          invoiceItemNumber: 20,
          quantity: 5,
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    getByIdMock.mockRejectedValue(new Error('API Error fetching invoice'));

    await processSyncDeliveries({ id: 'job-2' } as never);

    // Assert delivery upsert happened
    expect(deliveriesUpsertMock).toHaveBeenCalled();

    // Assert invoice upsert did NOT happen
    expect(purchaseInvoicesUpsertMock).not.toHaveBeenCalled();

    // Assert links upsert still happened
    expect(invoiceOrderLinksUpsertMock).toHaveBeenCalled();
  });

  it('should handle total failure gracefully', async () => {
    getDeliveriesAttendedPagedMock.mockRejectedValue(new Error('Total API failure'));

    await expect(processSyncDeliveries({ id: 'job-3' } as never)).rejects.toThrow(
      'Total API failure',
    );

    expect(deliveriesUpsertMock).not.toHaveBeenCalled();

    // Assert error event is logged
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failure',
        error_message: expect.stringContaining('Total API failure'),
      }),
    );

    // Assert cursor is set to error
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.DELIVERIES);
  });
});
