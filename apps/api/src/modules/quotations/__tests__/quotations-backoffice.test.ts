/**
 * Integration tests for quotation backoffice API endpoints.
 * Tests: listBackoffice, getBackofficeById, sendQuotation, reviewSupplierResponse, retryIntegration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { UserRole } from '@projetog/domain';
import {
  buildTestApp,
  generateTestToken,
  type TestAppContext,
} from '../../../test/quotation-test-helpers.js';

describe('Quotations Backoffice API', () => {
  let ctx: TestAppContext;
  let comprasToken: string;
  let fornecedorToken: string;

  beforeAll(async () => {
    ctx = await buildTestApp();
    comprasToken = await generateTestToken(ctx.app, { role: UserRole.COMPRAS });
    fornecedorToken = await generateTestToken(ctx.app, { role: UserRole.FORNECEDOR });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.supabase.reset();
  });

  // ─── Auth & RBAC ─────────────────────────────────────────────

  describe('RBAC', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject Fornecedor role on backoffice routes', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations',
        headers: { authorization: `Bearer ${fornecedorToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET / (listBackoffice) ─────────────────────────────────

  describe('GET /api/quotations', () => {
    it('should return paginated list on success', async () => {
      const mockData = [
        { id: 1, quotation_date: '2026-04-01', end_at: null, end_date: '2026-04-20', sent_at: null },
      ];
      const table = ctx.supabase.table('purchase_quotations');
      // The chain is awaited directly — use _mockResolvedValue
      table._mockResolvedValue({ data: mockData, error: null, count: 1 });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations?page=1&limit=20',
        headers: { authorization: `Bearer ${comprasToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(1);
    });

    it('should handle database error gracefully', async () => {
      const table = ctx.supabase.table('purchase_quotations');
      table._mockResolvedValue({
        data: null,
        error: { message: 'Database unavailable' },
        count: null,
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations',
        headers: { authorization: `Bearer ${comprasToken}` },
      });

      expect(res.statusCode).toBe(500);
    });
  });

  // ─── GET /:quotation_id (getBackofficeById) ──────────────────

  describe('GET /api/quotations/:quotation_id', () => {
    it('should return quotation detail on success', async () => {
      const table = ctx.supabase.table('purchase_quotations');
      table.single.mockResolvedValueOnce({
        data: {
          id: 10,
          quotation_date: '2026-04-01',
          end_at: null,
          end_date: '2026-04-20',
          sent_at: null,
          supplier_negotiations: [],
          purchase_quotation_items: [],
        },
        error: null,
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations/10',
        headers: { authorization: `Bearer ${comprasToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.id).toBe(10);
    });

    it('should return 404 for non-existent quotation', async () => {
      const table = ctx.supabase.table('purchase_quotations');
      table.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/quotations/999',
        headers: { authorization: `Bearer ${comprasToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /:quotation_id/send ───────────────────────────────

  describe('POST /api/quotations/:quotation_id/send', () => {
    it('should send quotation with valid end_date', async () => {
      const pqTable = ctx.supabase.table('purchase_quotations');
      const snTable = ctx.supabase.table('supplier_negotiations');
      const profilesTable = ctx.supabase.table('profiles');
      const suppliersTable = ctx.supabase.table('suppliers');
      const auditTable = ctx.supabase.table('audit_logs');

      // 1. select quotation by id → .single()
      pqTable.single.mockResolvedValueOnce({
        data: { id: 10, sent_at: null, end_at: null, end_date: null },
        error: null,
      });

      // 2. select negotiations → await chain (thenable)
      snTable._mockResolvedValue({
        data: [
          { id: 'neg-1', supplier_id: 20 },
          { id: 'neg-2', supplier_id: 30 },
        ],
        error: null,
      });

      // 3. Promise.all: profiles and suppliers (thenable)
      profilesTable._mockResolvedValue({
        data: [{ supplier_id: 20, role: 'fornecedor' }],
        error: null,
      });
      suppliersTable._mockResolvedValue({
        data: [{ id: 20, access_status: 'ACTIVE' }, { id: 30, access_status: 'BLOCKED' }],
        error: null,
      });

      // 4. update quotation → thenable
      // The update chain is also awaited
      // pqTable already has _mockResolvedValue set to success from default

      // 5. audit
      auditTable.insert.mockResolvedValueOnce({ data: null, error: null });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/send',
        headers: { authorization: `Bearer ${comprasToken}` },
        payload: { end_date: '2026-05-01' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.sent_at).toBeDefined();
      expect(body.suppliers_sent).toBe(1);
      expect(body.suppliers_skipped).toBe(1);
    });

    it('should reject send for already-sent quotation (409)', async () => {
      const pqTable = ctx.supabase.table('purchase_quotations');
      pqTable.single.mockResolvedValueOnce({
        data: { id: 10, sent_at: '2026-04-10T00:00:00Z', end_at: null, end_date: null },
        error: null,
      });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/send',
        headers: { authorization: `Bearer ${comprasToken}` },
        payload: { end_date: '2026-05-01' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('should reject send without end_date (422)', async () => {
      const pqTable = ctx.supabase.table('purchase_quotations');
      pqTable.single.mockResolvedValueOnce({
        data: { id: 10, sent_at: null, end_at: null, end_date: null },
        error: null,
      });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/send',
        headers: { authorization: `Bearer ${comprasToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(422);
    });

    it('should reject when no negotiations exist (422)', async () => {
      const pqTable = ctx.supabase.table('purchase_quotations');
      const snTable = ctx.supabase.table('supplier_negotiations');

      pqTable.single.mockResolvedValueOnce({
        data: { id: 10, sent_at: null, end_at: null, end_date: null },
        error: null,
      });

      // No negotiations
      snTable._mockResolvedValue({ data: [], error: null });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/send',
        headers: { authorization: `Bearer ${comprasToken}` },
        payload: { end_date: '2026-05-01' },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  // ─── POST /:quotation_id/suppliers/:supplier_id/review ──────

  describe('POST /api/quotations/:quotation_id/suppliers/:supplier_id/review', () => {
    it('should reject non-Compras role', async () => {
      const adminToken = await generateTestToken(ctx.app, { role: UserRole.ADMINISTRADOR });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/suppliers/20/review',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { action: 'approve' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /:quotation_id/suppliers/:supplier_id/retry-integration

  describe('POST /api/quotations/:quotation_id/suppliers/:supplier_id/retry-integration', () => {
    it('should reject non-Compras role', async () => {
      const adminToken = await generateTestToken(ctx.app, { role: UserRole.ADMINISTRADOR });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotations/10/suppliers/20/retry-integration',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
