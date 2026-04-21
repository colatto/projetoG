/**
 * Tests for quotation-expire-check worker job.
 *
 * Validates:
 * - Expired quotations with no response → status set to SEM_RESPOSTA
 * - Non-expired quotations are not affected
 * - Audit logs are generated
 * - Compras notifications are dispatched
 * - DB errors propagate correctly
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Mock Setup ───────────────────────────────────────────────

// Build a deeply chainable mock for the supabase client
function createChainMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const methods = ['select', 'update', 'insert', 'eq', 'not', 'in', 'is', 'order'];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  // Default thenable behavior
  let _resolve: unknown = { data: [], error: null };
  chain.then = (onF?: (v: unknown) => unknown, onR?: (r: unknown) => unknown) =>
    Promise.resolve(_resolve).then(onF, onR);
  chain._setResolve = (val: unknown) => { _resolve = val; };
  return chain;
}

let purchaseQuotationsChain = createChainMock();
let supplierNegotiationsChain = createChainMock();
let auditLogsChain = createChainMock();

const mockFrom = vi.fn((table: string) => {
  if (table === 'purchase_quotations') return purchaseQuotationsChain;
  if (table === 'supplier_negotiations') return supplierNegotiationsChain;
  if (table === 'audit_logs') return auditLogsChain;
  return createChainMock();
});

const mockSupabase = { from: mockFrom };

vi.mock('../../supabase.js', () => ({
  getSupabase: () => mockSupabase,
}));

const mockNotify = vi.fn().mockResolvedValue(undefined);
vi.mock('../../operational-notifications.js', () => ({
  notifyComprasAboutOperationalIssue: (...args: unknown[]) => mockNotify(...args),
}));

// Import AFTER mocks
import { processQuotationExpireCheck } from '../../jobs/quotation-expire-check.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeJob(id = 'job-1'): any {
  return { id, name: 'quotation:expire-check', data: {} };
}

// ─── Tests ────────────────────────────────────────────────────

describe('quotation-expire-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purchaseQuotationsChain = createChainMock();
    supplierNegotiationsChain = createChainMock();
    auditLogsChain = createChainMock();
    // Re-wire mockFrom to use fresh chains
    mockFrom.mockImplementation((table: string) => {
      if (table === 'purchase_quotations') return purchaseQuotationsChain;
      if (table === 'supplier_negotiations') return supplierNegotiationsChain;
      if (table === 'audit_logs') return auditLogsChain;
      return createChainMock();
    });
  });

  it('should skip when no expired quotations exist', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    purchaseQuotationsChain._setResolve({
      data: [{ id: 1, end_at: tomorrow, end_date: null, sent_at: '2026-04-01T00:00:00Z' }],
      error: null,
    });

    await processQuotationExpireCheck(makeJob());

    // Should NOT have called from('supplier_negotiations').update()
    expect((supplierNegotiationsChain.update as Mock).mock.calls.length).toBe(0);
  });

  it('should mark SEM_RESPOSTA for expired quotations without response', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    purchaseQuotationsChain._setResolve({
      data: [{ id: 10, end_at: yesterday, end_date: null, sent_at: '2026-04-01T00:00:00Z' }],
      error: null,
    });

    // supplier_negotiations update chain resolves with affected rows
    supplierNegotiationsChain._setResolve({
      data: [
        { purchase_quotation_id: 10, supplier_id: 20 },
        { purchase_quotation_id: 10, supplier_id: 30 },
      ],
      error: null,
    });

    auditLogsChain._setResolve({ data: null, error: null });

    await processQuotationExpireCheck(makeJob());

    // Should have called update with SEM_RESPOSTA
    expect(supplierNegotiationsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SEM_RESPOSTA' }),
    );

    // Should have inserted audit logs
    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(auditLogsChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'quotation_expired_no_response',
          entity_id: '10',
        }),
      ]),
    );

    // Should have notified Compras
    expect(mockNotify).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        type: 'QUOTATION_EXPIRED_NO_RESPONSE',
        entityType: 'purchase_quotation',
        entityId: '10',
      }),
    );
  });

  it('should handle end_date fallback (date-only field)', async () => {
    purchaseQuotationsChain._setResolve({
      data: [{ id: 5, end_at: null, end_date: '2026-01-01', sent_at: '2025-12-20T00:00:00Z' }],
      error: null,
    });

    supplierNegotiationsChain._setResolve({
      data: [{ purchase_quotation_id: 5, supplier_id: 40 }],
      error: null,
    });
    auditLogsChain._setResolve({ data: null, error: null });

    await processQuotationExpireCheck(makeJob());

    expect(supplierNegotiationsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SEM_RESPOSTA' }),
    );
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it('should not fail when notifications throw', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    purchaseQuotationsChain._setResolve({
      data: [{ id: 10, end_at: yesterday, end_date: null, sent_at: '2026-04-01T00:00:00Z' }],
      error: null,
    });

    supplierNegotiationsChain._setResolve({
      data: [{ purchase_quotation_id: 10, supplier_id: 20 }],
      error: null,
    });
    auditLogsChain._setResolve({ data: null, error: null });

    mockNotify.mockRejectedValueOnce(new Error('Notification service unavailable'));

    // Should NOT throw — notification errors are caught
    await expect(processQuotationExpireCheck(makeJob())).resolves.not.toThrow();
  });

  it('should throw on database query failure', async () => {
    purchaseQuotationsChain._setResolve({
      data: null,
      error: { message: 'Connection refused' },
    });

    await expect(processQuotationExpireCheck(makeJob())).rejects.toThrow(
      /Failed to list quotations/,
    );
  });

  it('should throw on update failure', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    purchaseQuotationsChain._setResolve({
      data: [{ id: 10, end_at: yesterday, end_date: null, sent_at: '2026-04-01T00:00:00Z' }],
      error: null,
    });

    supplierNegotiationsChain._setResolve({
      data: null,
      error: { message: 'Permission denied' },
    });

    await expect(processQuotationExpireCheck(makeJob())).rejects.toThrow(
      /Failed to update supplier_negotiations/,
    );
  });
});
