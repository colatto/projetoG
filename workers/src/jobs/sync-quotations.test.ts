import { beforeEach, describe, expect, it, vi } from 'vitest';

const listNegotiationsMock = vi.fn();
const getCreditorByIdMock = vi.fn();
const mapQuotationToLocalMock = vi.fn();
const mapSupplierNegotiationsToLocalMock = vi.fn();
const mapNegotiationItemsToLocalMock = vi.fn();
const extractCreditorEmailMock = vi.fn();

const cursorSingleMock = vi.fn();
const cursorUpdateEqMock = vi.fn();
const purchaseQuotationsUpsertMock = vi.fn();
const supplierNegotiationsSingleMock = vi.fn();
const supplierNegotiationsSelectMock = vi.fn();
const supplierNegotiationsUpsertMock = vi.fn();
const purchaseQuotationItemsUpsertMock = vi.fn();
const supplierNegotiationItemsUpsertMock = vi.fn();
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
      case 'purchase_quotations':
        return {
          upsert: purchaseQuotationsUpsertMock,
        };
      case 'supplier_negotiations':
        return {
          upsert: supplierNegotiationsUpsertMock,
        };
      case 'purchase_quotation_items':
        return {
          upsert: purchaseQuotationItemsUpsertMock,
        };
      case 'supplier_negotiation_items':
        return {
          upsert: supplierNegotiationItemsUpsertMock,
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

vi.mock('@projetog/integration-sienge', () => ({
  QuotationClient: vi.fn().mockImplementation(() => ({
    listNegotiations: listNegotiationsMock,
  })),
  CreditorClient: vi.fn().mockImplementation(() => ({
    getById: getCreditorByIdMock,
  })),
  mapQuotationToLocal: mapQuotationToLocalMock,
  mapSupplierNegotiationsToLocal: mapSupplierNegotiationsToLocalMock,
  mapNegotiationItemsToLocal: mapNegotiationItemsToLocalMock,
  extractCreditorEmail: extractCreditorEmailMock,
}));

const { processSyncQuotations } = await import('./sync-quotations.js');

describe('processSyncQuotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cursorSingleMock.mockResolvedValue({
      data: { sync_status: 'idle' },
      error: null,
    });
    cursorUpdateEqMock.mockResolvedValue({ error: null });

    purchaseQuotationsUpsertMock.mockResolvedValue({ error: null });

    supplierNegotiationsSingleMock.mockResolvedValue({
      data: { id: 'supplier-negotiation-1' },
      error: null,
    });
    supplierNegotiationsSelectMock.mockReturnValue({
      single: supplierNegotiationsSingleMock,
    });
    supplierNegotiationsUpsertMock.mockReturnValue({
      select: supplierNegotiationsSelectMock,
    });

    purchaseQuotationItemsUpsertMock.mockResolvedValue({ error: null });
    supplierNegotiationItemsUpsertMock.mockResolvedValue({ error: null });
    integrationEventsInsertMock.mockResolvedValue({ error: null });

    listNegotiationsMock.mockResolvedValue([
      {
        purchaseQuotationId: 101,
        suppliers: [
          {
            supplierId: 202,
            creditorId: 303,
            negotiations: [
              {
                negotiationId: 404,
                negotiationNumber: 505,
                items: [
                  {
                    purchaseQuotationItemId: 606,
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    mapQuotationToLocalMock.mockReturnValue({
      id: 101,
      quotationDate: '2026-04-01',
      responseDate: '2026-04-10',
      buyerId: 'buyer-1',
      consistency: 'CONSISTENT',
      siengeStatus: 'OPEN',
    });

    mapSupplierNegotiationsToLocalMock.mockReturnValue([
      {
        purchaseQuotationId: 101,
        supplierId: 202,
        siengeNegotiationId: 404,
        siengeNegotiationNumber: 505,
        status: 'pending',
        deliveryDate: '2026-04-20',
      },
    ]);

    mapNegotiationItemsToLocalMock.mockReturnValue([
      {
        purchaseQuotationItemId: 606,
        quantity: 12,
        unitPrice: 99.5,
        deliveryDate: '2026-04-25',
      },
    ]);

    getCreditorByIdMock.mockResolvedValue({ contacts: [] });
    extractCreditorEmailMock.mockReturnValue({
      email: 'supplier@example.com',
      hasValidEmail: true,
    });
  });

  it('persists quotation item stubs and keeps negotiated values on supplier negotiation items', async () => {
    await processSyncQuotations({ id: 'job-1' } as never);

    expect(purchaseQuotationItemsUpsertMock).toHaveBeenCalledWith(
      {
        id: 606,
        purchase_quotation_id: 101,
      },
      { onConflict: 'id' },
    );

    expect(supplierNegotiationItemsUpsertMock).toHaveBeenCalledWith(
      {
        supplier_negotiation_id: 'supplier-negotiation-1',
        purchase_quotation_item_id: 606,
        quantity: 12,
        unit_price: 99.5,
        delivery_date: '2026-04-25',
      },
      { onConflict: 'supplier_negotiation_id,purchase_quotation_item_id' },
    );

    expect(mapNegotiationItemsToLocalMock).toHaveBeenCalledWith([
      {
        purchaseQuotationItemId: 606,
      },
    ]);
  });
});
