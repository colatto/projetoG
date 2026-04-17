import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEventStatus, IntegrationEventType } from '@projetog/domain';
import { createSupabaseMock } from '../test-utils/supabase.js';
import { baseOutboundJobData } from '../test-utils/fixtures.js';

const listNegotiationsPagedMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const updateItemMock = vi.fn();
const authorizeMock = vi.fn();

const { supabaseClient, getTableMocks } = createSupabaseMock();

vi.mock('../supabase.js', () => ({
  getSupabase: () => supabaseClient,
}));

vi.mock('../sienge.js', () => ({
  getSiengeClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('@projetog/integration-sienge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@projetog/integration-sienge')>();
  return {
    ...actual,
    QuotationClient: vi.fn().mockImplementation(() => ({
      listNegotiationsPaged: listNegotiationsPagedMock,
    })),
    NegotiationClient: vi.fn().mockImplementation(() => ({
      create: createMock,
      update: updateMock,
      updateItem: updateItemMock,
      authorize: authorizeMock,
    })),
  };
});

const { processOutboundNegotiation } = await import('./outbound-negotiation.js');

describe('processOutboundNegotiation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getTableMocks('purchase_quotations').selectEqSingle.mockResolvedValue({
      data: { id: 10, quotation_date: '2026-04-01' },
      error: null,
    });

    getTableMocks('integration_events').updateEq.mockResolvedValue({ error: null });
    getTableMocks('integration_events').insertMock.mockResolvedValue({ error: null });
    getTableMocks('integration_events').selectEqSingle.mockResolvedValue({
      data: { retry_count: 0, max_retries: 2 },
      error: null,
    });

    getTableMocks('supplier_negotiations').updateEqEq.mockResolvedValue({ error: null });
    
    getTableMocks('audit_logs').insertMock.mockResolvedValue({ error: null });
  });

  it('should process outbound negotiation successfully when negotiation already exists', async () => {
    listNegotiationsPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseQuotationId: 10,
          suppliers: [
            {
              supplierId: 20,
              negotiations: [
                { negotiationId: 99, negotiationNumber: 999 },
              ],
            },
          ],
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    await processOutboundNegotiation({ id: 'job-1', data: baseOutboundJobData } as never);

    // Assert update
    expect(updateMock).toHaveBeenCalledWith(
      10,
      20,
      999,
      expect.objectContaining({ seller: 'John Doe' }),
      expect.any(Object)
    );

    // Assert item update
    expect(updateItemMock).toHaveBeenCalledWith(
      10,
      20,
      999,
      30,
      expect.objectContaining({ unitPrice: 100 }),
      expect.any(Object)
    );

    // Assert authorize
    expect(authorizeMock).toHaveBeenCalledWith(10, 20, expect.any(Object));

    // Assert event update success
    expect(getTableMocks('integration_events').update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IntegrationEventStatus.SUCCESS
      })
    );
    expect(getTableMocks('integration_events').updateEq).toHaveBeenCalledWith('id', 'evt-123');
  });

  it('should create negotiation if none exists, then update and authorize', async () => {
    // First call (check if exists)
    listNegotiationsPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseQuotationId: 10,
          suppliers: [{ supplierId: 20, negotiations: [] }],
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    // Second call (after create to fetch ID)
    listNegotiationsPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseQuotationId: 10,
          suppliers: [
            {
              supplierId: 20,
              negotiations: [{ negotiationId: 99, negotiationNumber: 999 }],
            },
          ],
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    await processOutboundNegotiation({ id: 'job-2', data: baseOutboundJobData } as never);

    // Assert create
    expect(createMock).toHaveBeenCalledWith(
      10,
      20,
      expect.objectContaining({ seller: 'John Doe' }),
      expect.any(Object)
    );

    // Assert update uses the newly created ID
    expect(updateMock).toHaveBeenCalledWith(
      10,
      20,
      999,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('should abort and flag if supplier is not found in the quotation map (RN-10)', async () => {
    listNegotiationsPagedMock.mockResolvedValueOnce({
      results: [
        {
          purchaseQuotationId: 10,
          suppliers: [{ supplierId: 999, negotiations: [] }], // Only supplier 999 is there
        },
      ],
      resultSetMetadata: { count: 1 },
    });

    await processOutboundNegotiation({ id: 'job-3', data: baseOutboundJobData } as never);

    expect(getTableMocks('integration_events').update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: IntegrationEventType.SUPPLIER_INVALID_MAP
      })
    );

    // Ensure we don't call Sienge mutations
    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('should schedule retry on failure if below max_retries with 24h window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T12:00:00.000Z'));

    listNegotiationsPagedMock.mockRejectedValue(new Error('API Down'));

    getTableMocks('integration_events').selectEqSingle.mockResolvedValue({
      data: { retry_count: 0, max_retries: 2 },
      error: null,
    });

    await processOutboundNegotiation({ id: 'job-4', data: baseOutboundJobData } as never);

    expect(getTableMocks('integration_events').update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IntegrationEventStatus.RETRY_SCHEDULED,
        retry_count: 1,
        error_message: 'API Down',
        next_retry_at: '2026-04-17T12:00:00.000Z', // 24 hours later
      })
    );
    expect(getTableMocks('integration_events').updateEq).toHaveBeenCalledWith('id', 'evt-123');

    vi.useRealTimers();
  });

  it('should mark as failure and audit log if retries exhausted', async () => {
    listNegotiationsPagedMock.mockRejectedValue(new Error('API Down'));

    getTableMocks('integration_events').selectEqSingle.mockResolvedValue({
      data: { retry_count: 2, max_retries: 2 },
      error: null,
    });

    await processOutboundNegotiation({ id: 'job-5', data: baseOutboundJobData } as never);

    expect(getTableMocks('audit_logs').insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'integration.failure_exhausted',
        entity_id: 'evt-123',
      })
    );
  });
});
