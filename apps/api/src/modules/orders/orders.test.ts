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
  });

  afterEach(async () => {
    await context.app.close();
  });

  it('GET /api/orders should list orders for ADMIN', async () => {
    context.supabase
      .table('purchase_orders')
      ._mockResolvedValue({ data: [{ id: 100 }], error: null });

    const token = await generateTestToken(context.app, { role: UserRole.ADMINISTRADOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/orders?search=100',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual([{ id: 100 }]);
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
