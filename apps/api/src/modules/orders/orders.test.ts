import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildTestApp,
  generateTestToken,
  TestAppContext,
} from '../../test/quotation-test-helpers.js';
import { UserRole } from '@projetog/domain';

describe('Orders Module', () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await buildTestApp();
    vi.clearAllMocks();
    context.supabase.table('follow_up_trackers')._mockResolvedValue({ data: [], error: null });
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('GET /api/orders should list orders for ADMIN', async () => {
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 100, local_status: 'PENDENTE', created_at: '2026-01-01' }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.ADMINISTRADOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders?search=100',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([
      { id: 100, local_status: 'PENDENTE', created_at: '2026-01-01' },
    ]);
  });

  it('GET /api/supplier-portal/orders mirrors GET /api/orders for FORNECEDOR', async () => {
    context.supabase
      .table('profiles')
      .single.mockResolvedValue({ data: { supplier_id: 10 }, error: null });
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 7, supplier_id: 10, local_status: 'PENDENTE' }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/supplier-portal/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/backoffice/orders mirrors GET /api/orders', async () => {
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 7, local_status: 'ENTREGUE', created_at: '2026-02-01' }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/backoffice/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([
      { id: 7, local_status: 'ENTREGUE', created_at: '2026-02-01' },
    ]);
  });

  it('GET /api/orders should filter by supplier for FORNECEDOR', async () => {
    context.supabase
      .table('profiles')
      .single.mockResolvedValue({ data: { supplier_id: 10 }, error: null });
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 100, supplier_id: 10 }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/orders should list orders for VISUALIZADOR_PEDIDOS', async () => {
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 55, local_status: 'PENDENTE', created_at: '2026-01-02' }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.VISUALIZADOR_PEDIDOS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([
      { id: 55, local_status: 'PENDENTE', created_at: '2026-01-02' },
    ]);
  });

  it('GET /api/orders require_action=true applies local_status filter for COMPRAS', async () => {
    const po = context.supabase.table('purchase_orders');
    po._mockResolvedValue({ data: [{ id: 1, local_status: 'ATRASADO', created_at: '2026-01-01' }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders?require_action=true',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(po.in).toHaveBeenCalledWith('local_status', [
      'ATRASADO',
      'DIVERGENCIA',
      'EM_AVARIA',
      'REPOSICAO',
    ]);
  });

  it('GET /api/orders require_action=true returns 403 for VISUALIZADOR_PEDIDOS', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.VISUALIZADOR_PEDIDOS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders?require_action=true',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('GET /api/orders sorts by operational priority (RN-09) when sort_priority default', async () => {
    context.supabase.table('purchase_orders')._mockResolvedValue({
      data: [
        { id: 10, local_status: 'DIVERGENCIA', created_at: '2026-01-01' },
        { id: 20, local_status: 'ATRASADO', created_at: '2026-01-02' },
        { id: 30, local_status: 'PENDENTE', created_at: '2026-01-03' },
      ],
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload) as { id: number }[];
    expect(payload.map((r) => r.id)).toEqual([20, 10, 30]);
  });

  it('GET /api/orders tier 4 pending_approval via follow_up_tracker before plain PENDENTE', async () => {
    context.supabase.table('purchase_orders')._mockResolvedValue({
      data: [
        { id: 101, local_status: 'PENDENTE', created_at: '2026-01-01' },
        { id: 102, local_status: 'PENDENTE', created_at: '2026-01-02' },
      ],
      error: null,
    });
    context.supabase.table('follow_up_trackers')._mockResolvedValue({
      data: [
        {
          purchase_order_id: 102,
          status: 'ATIVO',
          suggested_date_status: 'pending_approval',
          promised_date_current: '2026-04-10',
          updated_at: '2026-04-20T10:00:00.000Z',
        },
      ],
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload) as { id: number }[];
    expect(payload.map((r) => r.id)).toEqual([102, 101]);
  });

  it('GET /api/orders sort_priority=false sorts by created_at descending', async () => {
    context.supabase.table('purchase_orders')._mockResolvedValue({
      data: [
        { id: 1, local_status: 'ENTREGUE', created_at: '2026-01-01' },
        { id: 2, local_status: 'PENDENTE', created_at: '2026-06-01' },
      ],
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders?sort_priority=false',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload) as { id: number }[];
    expect(payload.map((r) => r.id)).toEqual([2, 1]);
  });

  it('POST /api/orders/:purchaseOrderId/cancel should return 403 for VISUALIZADOR_PEDIDOS', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.VISUALIZADOR_PEDIDOS });
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/orders/1/cancel',
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: 'Should not work' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('POST /api/orders/:purchaseOrderId/cancel should cancel order', async () => {
    context.supabase
      .table('purchase_orders')
      .single.mockResolvedValue({ data: { local_status: 'EM_ANDAMENTO' }, error: null });

    const token = await generateTestToken(context.app, { role: UserRole.ADMINISTRADOR });
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/orders/1/cancel',
      headers: { Authorization: `Bearer ${token}` },
      payload: { reason: 'Test cancel' },
    });

    expect(response.statusCode).toBe(200);
    expect(context.supabase.table('purchase_orders').update).toHaveBeenCalled();
  });
});
