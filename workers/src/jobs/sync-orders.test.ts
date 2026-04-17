import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncResourceType, SyncStatus } from '@projetog/domain';

const listPagedMock = vi.fn();
const getItemsMock = vi.fn();
const getDeliverySchedulesMock = vi.fn();

const cursorSingleMock = vi.fn();
const cursorUpdateEqMock = vi.fn();
const purchaseOrdersUpsertMock = vi.fn();
const purchaseOrderItemsUpsertMock = vi.fn();
const deliverySchedulesUpsertMock = vi.fn();
const orderQuotationLinksUpsertMock = vi.fn();
const integrationEventsInsertMock = vi.fn();

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
      case 'purchase_orders':
        return {
          upsert: purchaseOrdersUpsertMock,
        };
      case 'purchase_order_items':
        return {
          upsert: purchaseOrderItemsUpsertMock,
        };
      case 'delivery_schedules':
        return {
          upsert: deliverySchedulesUpsertMock,
        };
      case 'order_quotation_links':
        return {
          upsert: orderQuotationLinksUpsertMock,
        };
      case 'integration_events':
        return {
          insert: integrationEventsInsertMock,
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
    OrderClient: vi.fn().mockImplementation(() => ({
      listPaged: listPagedMock,
      getItems: getItemsMock,
      getDeliverySchedules: getDeliverySchedulesMock,
    })),
  };
});

const { processSyncOrders } = await import('./sync-orders.js');

describe('processSyncOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cursorSingleMock.mockResolvedValue({
      data: { sync_status: SyncStatus.IDLE, last_offset: 0 },
      error: null,
    });
    cursorUpdateEqMock.mockResolvedValue({ error: null });

    purchaseOrdersUpsertMock.mockResolvedValue({ error: null });
    purchaseOrderItemsUpsertMock.mockResolvedValue({ error: null });
    deliverySchedulesUpsertMock.mockResolvedValue({ error: null });
    orderQuotationLinksUpsertMock.mockResolvedValue({ error: null });
    integrationEventsInsertMock.mockResolvedValue({ error: null });
  });

  it('should process sync orders successfully', async () => {
    listPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseOrderId: 1,
          formattedPurchaseOrderId: 'PO-1',
          supplierId: 10,
          purchaseQuotations: [{ purchaseQuotationId: 100 }],
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    getItemsMock.mockResolvedValue([{ purchaseOrderItemNumber: 1, quantity: 5 }]);
    getDeliverySchedulesMock.mockResolvedValue([{ sheduledDate: '2026-04-10', sheduledQuantity: 5 }]);

    await processSyncOrders({ id: 'job-1' } as never);

    // Assert cursor running update
    expect(supabaseMock.from).toHaveBeenCalledWith('sienge_sync_cursor');
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.ORDERS);

    // Assert order upsert
    expect(purchaseOrdersUpsertMock).toHaveBeenCalled();
    expect(purchaseOrdersUpsertMock.mock.calls[0][0].id).toBe(1);

    // Assert items upsert
    expect(getItemsMock).toHaveBeenCalledWith(1, expect.any(Object));
    expect(purchaseOrderItemsUpsertMock).toHaveBeenCalled();
    expect(purchaseOrderItemsUpsertMock.mock.calls[0][0].item_number).toBe(1);

    // Assert schedules upsert
    expect(getDeliverySchedulesMock).toHaveBeenCalledWith(1, 1, expect.any(Object));
    expect(deliverySchedulesUpsertMock).toHaveBeenCalled();
    expect(deliverySchedulesUpsertMock.mock.calls[0][0].scheduled_date).toBe('2026-04-10');

    // Assert links upsert
    expect(orderQuotationLinksUpsertMock).toHaveBeenCalled();
    expect(orderQuotationLinksUpsertMock.mock.calls[0][0].purchase_quotation_id).toBe(100);

    // Assert final cursor update
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.ORDERS);
  });

  it('should handle partial failures gracefully (e.g. failing to fetch items)', async () => {
    listPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseOrderId: 1,
          formattedPurchaseOrderId: 'PO-1',
          supplierId: 10,
          purchaseQuotations: [{ purchaseQuotationId: 100 }],
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    getItemsMock.mockRejectedValue(new Error('API Error fetching items'));

    await processSyncOrders({ id: 'job-2' } as never);

    // Assert order upsert happened
    expect(purchaseOrdersUpsertMock).toHaveBeenCalled();

    // Assert items upsert did NOT happen
    expect(purchaseOrderItemsUpsertMock).not.toHaveBeenCalled();

    // Assert links upsert still happened (because it's not dependent on items)
    expect(orderQuotationLinksUpsertMock).toHaveBeenCalled();
  });

  it('should handle total failure gracefully', async () => {
    listPagedMock.mockRejectedValue(new Error('Total API failure'));

    await expect(processSyncOrders({ id: 'job-3' } as never)).rejects.toThrow('Total API failure');

    expect(purchaseOrdersUpsertMock).not.toHaveBeenCalled();
    
    // Assert error event is logged
    expect(integrationEventsInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failure',
      error_message: expect.stringContaining('Total API failure'),
    }));
    
    // Assert cursor is set to error
    expect(cursorUpdateEqMock).toHaveBeenCalledWith('resource_type', SyncResourceType.ORDERS);
  });
});
