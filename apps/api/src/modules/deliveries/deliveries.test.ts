import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildTestApp, generateTestToken, TestAppContext } from '../../test/quotation-test-helpers.js';
import { UserRole } from '@projetog/domain';

describe('Deliveries Module', () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await buildTestApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('GET /api/deliveries/pending should return 401 if unauthorized', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/deliveries/pending',
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/deliveries/pending should return 403 if not ADMIN or COMPRAS', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/deliveries/pending',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /api/deliveries/pending should list pending deliveries for COMPRAS', async () => {
    context.supabase.table('deliveries')._mockResolvedValue({ data: [{ id: 1 }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/deliveries/pending',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([{ id: 1 }]);
  });

  it('POST /api/deliveries/:id/validate should validate delivery', async () => {
    context.supabase.table('deliveries').single.mockResolvedValueOnce({ data: { id: 1, validation_status: 'AGUARDANDO_VALIDACAO', purchase_order_id: 100 }, error: null });
    context.supabase.table('purchase_orders').single.mockResolvedValue({ data: { id: 100, local_status: 'PARCIALMENTE_ENTREGUE' }, error: null });

    const token = await generateTestToken(context.app, { role: UserRole.ADMINISTRADOR });
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/deliveries/1/validate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { status: 'OK', notes: 'All good' },
    });

    expect(response.statusCode).toBe(200);
    expect(context.supabase.table('deliveries').update).toHaveBeenCalled();
  });
});
