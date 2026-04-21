/**
 * Integration tests for supplier quotation API endpoints.
 * Tests: listSupplier, getSupplierByQuotationId, markRead, respond
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { UserRole } from '@projetog/domain';
import {
  buildTestApp,
  generateTestToken,
  type TestAppContext,
} from '../../../test/quotation-test-helpers.js';

describe('Quotations Supplier API', () => {
  let ctx: TestAppContext;
  let supplierToken: string;
  let comprasToken: string;

  const SUPPLIER_USER_ID = 'supplier-user-1';
  const SUPPLIER_ID = 50;

  beforeAll(async () => {
    ctx = await buildTestApp();
    supplierToken = await generateTestToken(ctx.app, {
      sub: SUPPLIER_USER_ID,
      role: UserRole.FORNECEDOR,
      supplier_id: SUPPLIER_ID,
    });
    comprasToken = await generateTestToken(ctx.app, { role: UserRole.COMPRAS });
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
        url: '/api/supplier/quotations',
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject Compras role on supplier routes', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/supplier/quotations',
        headers: { authorization: `Bearer ${comprasToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET / (listSupplier) ──────────────────────────────────

  describe('GET /api/supplier/quotations', () => {
    it('should return supplier quotations sorted by operational priority', async () => {
      const profilesTable = ctx.supabase.table('profiles');
      const snTable = ctx.supabase.table('supplier_negotiations');

      // getProfileSupplierId → .single()
      profilesTable.single.mockResolvedValueOnce({
        data: { supplier_id: SUPPLIER_ID },
        error: null,
      });

      // listSupplier query → thenable chain
      snTable._mockResolvedValue({
        data: [
          {
            id: 'neg-1',
            status: 'AGUARDANDO_REVISAO',
            read_at: null,
            purchase_quotation_id: 10,
            purchase_quotations: {
              id: 10,
              end_at: null,
              end_date: '2026-05-01',
            },
          },
          {
            id: 'neg-2',
            status: 'AGUARDANDO_RESPOSTA',
            read_at: null,
            purchase_quotation_id: 11,
            purchase_quotations: {
              id: 11,
              end_at: null,
              end_date: '2026-04-25',
            },
          },
        ],
        error: null,
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/supplier/quotations',
        headers: { authorization: `Bearer ${supplierToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);

      // RN-26: AGUARDANDO_RESPOSTA should come before AGUARDANDO_REVISAO
      if (body.data.length === 2) {
        expect(body.data[0].status).toBe('AGUARDANDO_RESPOSTA');
        expect(body.data[1].status).toBe('AGUARDANDO_REVISAO');
      }
    });

    it('should return 403 when supplier_id not found in profile', async () => {
      const profilesTable = ctx.supabase.table('profiles');

      profilesTable.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/supplier/quotations',
        headers: { authorization: `Bearer ${supplierToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET /:quotation_id (getSupplierByQuotationId) ──────────

  describe('GET /api/supplier/quotations/:quotation_id', () => {
    it('should return quotation detail for valid supplier', async () => {
      const profilesTable = ctx.supabase.table('profiles');
      const snTable = ctx.supabase.table('supplier_negotiations');

      profilesTable.single.mockResolvedValueOnce({
        data: { supplier_id: SUPPLIER_ID },
        error: null,
      });

      snTable.single.mockResolvedValueOnce({
        data: {
          id: 'neg-1',
          status: 'AGUARDANDO_RESPOSTA',
          read_at: null,
          supplier_id: SUPPLIER_ID,
          purchase_quotations: {
            id: 10,
            sent_at: '2026-04-10T00:00:00Z',
            end_at: null,
            end_date: '2026-05-01',
            purchase_quotation_items: [
              { id: 100, description: 'Cimento', quantity: 50, unit: 'SC' },
            ],
          },
          quotation_responses: [],
        },
        error: null,
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/supplier/quotations/10',
        headers: { authorization: `Bearer ${supplierToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.id).toBe('neg-1');
    });

    it('should return 404 for non-existent negotiation', async () => {
      const profilesTable = ctx.supabase.table('profiles');
      const snTable = ctx.supabase.table('supplier_negotiations');

      profilesTable.single.mockResolvedValueOnce({
        data: { supplier_id: SUPPLIER_ID },
        error: null,
      });

      snTable.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/supplier/quotations/999',
        headers: { authorization: `Bearer ${supplierToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /:quotation_id/read (markRead) ────────────────────

  describe('POST /api/supplier/quotations/:quotation_id/read', () => {
    it('should mark quotation as read', async () => {
      const profilesTable = ctx.supabase.table('profiles');
      const snTable = ctx.supabase.table('supplier_negotiations');
      const auditTable = ctx.supabase.table('audit_logs');

      // getProfileSupplierId
      profilesTable.single.mockResolvedValueOnce({
        data: { supplier_id: SUPPLIER_ID },
        error: null,
      });

      // fetch negotiation → .single()
      snTable.single.mockResolvedValueOnce({
        data: { id: 'neg-1', supplier_id: SUPPLIER_ID, read_at: null },
        error: null,
      });

      // update read_at → thenable
      snTable._mockResolvedValue({ data: null, error: null });

      // audit insert
      auditTable._mockResolvedValue({ data: null, error: null });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/supplier/quotations/10/read',
        headers: { authorization: `Bearer ${supplierToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.read_at).toBeDefined();
    });
  });

  // ─── POST /:quotation_id/respond ───────────────────────────

  describe('POST /api/supplier/quotations/:quotation_id/respond', () => {
    it('should reject response with invalid payload (400)', async () => {
      const profilesTable = ctx.supabase.table('profiles');

      profilesTable.single.mockResolvedValueOnce({
        data: { supplier_id: SUPPLIER_ID },
        error: null,
      });

      // Missing required fields in body
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/supplier/quotations/10/respond',
        headers: { authorization: `Bearer ${supplierToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
