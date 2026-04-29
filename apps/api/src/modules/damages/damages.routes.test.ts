import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTestApp,
  generateTestToken,
  TestAppContext,
} from '../../test/quotation-test-helpers.js';
import { UserRole } from '@projetog/domain';

describe('damages routes', () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await buildTestApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.app.close();
  });

  function mockSupplierProfile(supplierId = 777) {
    context.supabase.table('profiles').single.mockResolvedValue({
      data: { supplier_id: supplierId },
      error: null,
    });
  }

  it('creates damage for compras', async () => {
    context.supabase.table('purchase_orders').single.mockResolvedValue({
      data: { id: 10, supplier_id: 777, building_id: 55, local_status: 'PENDENTE' },
      error: null,
    });
    context.supabase.table('purchase_order_items').single.mockResolvedValue({
      data: { id: 'item-1' },
      error: null,
    });
    context.supabase.table('damages').single.mockResolvedValue({
      data: { id: 'damage-1', status: 'REGISTRADA', created_at: '2026-04-28T12:00:00Z' },
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/damages',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        purchase_order_id: 10,
        purchase_order_item_number: 1,
        description: 'Material danificado durante o recebimento.',
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = JSON.parse(response.payload);
    expect(payload.id).toBe('damage-1');
    expect(payload.status).toBe('registrada');
  });

  it('fornecedor can suggest action', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000101',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: null,
      },
      error: null,
    });
    context.supabase.table('profiles').single.mockResolvedValue({
      data: { supplier_id: 777 },
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000101/suggest',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        suggested_action: 'reposicao',
        suggested_action_notes: 'Iremos repor o item',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload).status).toBe('sugestao_pendente');
  });

  it('compras resolves action and creates replacement for reposicao', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000102',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: null,
      },
      error: null,
    });
    context.supabase.table('damage_replacements').single.mockResolvedValue({
      data: { id: 'replacement-1' },
      error: null,
    });
    context.supabase.table('purchase_orders').single.mockResolvedValue({
      data: { local_status: 'EM_AVARIA' },
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000102/resolve',
      headers: { Authorization: `Bearer ${token}` },
      payload: { final_action: 'reposicao', final_action_notes: 'Aprovar reposição' },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.final_action).toBe('reposicao');
    expect(payload.replacement_id).toBe('replacement-1');
  });

  it('fornecedor informs replacement date successfully', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000103',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: 'REPOSICAO',
      },
      error: null,
    });
    mockSupplierProfile(777);
    context.supabase.table('damage_replacements').single.mockResolvedValue({
      data: { id: 'replacement-2', replacement_status: 'AGUARDANDO_DATA' },
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000103/replacement/date',
      headers: { Authorization: `Bearer ${token}` },
      payload: { new_promised_date: '2099-01-10' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      replacement_id: 'replacement-2',
      replacement_status: 'em_andamento',
      new_promised_date: '2099-01-10',
    });
  });

  it('rejects replacement date in past', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000103/replacement/date',
      headers: { Authorization: `Bearer ${token}` },
      payload: { new_promised_date: '2000-01-10' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('fornecedor cannot inform replacement date for another supplier', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000103',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: 'REPOSICAO',
      },
      error: null,
    });
    mockSupplierProfile(888);

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000103/replacement/date',
      headers: { Authorization: `Bearer ${token}` },
      payload: { new_promised_date: '2099-01-10' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('fornecedor cannot suggest action when final action already exists', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000101',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: 'REPOSICAO',
      },
      error: null,
    });
    mockSupplierProfile(777);

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000101/suggest',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        suggested_action: 'reposicao',
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('fornecedor can list only own damages', async () => {
    context.supabase.table('profiles').single.mockResolvedValue({
      data: { supplier_id: 777 },
      error: null,
    });
    context.supabase.table('damages')._mockResolvedValue({
      data: [{ id: 'damage-1', status: 'REGISTRADA' }],
      count: 1,
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/damages?page=1&per_page=20',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(context.supabase.table('damages').eq).toHaveBeenCalledWith('supplier_id', 777);
    expect(JSON.parse(response.payload).data).toHaveLength(1);
  });

  it('supports building_id filter when listing damages', async () => {
    context.supabase.table('damages')._mockResolvedValue({
      data: [{ id: 'damage-1', status: 'REGISTRADA', building_id: 55 }],
      count: 1,
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/damages?building_id=55&page=1&per_page=20',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(context.supabase.table('damages').eq).toHaveBeenCalledWith('building_id', 55);
  });

  it('blocks fornecedor from audit endpoint', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/damages/00000000-0000-0000-0000-000000000101/audit',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
  });

  it('compras can cancel replacement', async () => {
    context.supabase.table('damages').single.mockResolvedValue({
      data: {
        id: '00000000-0000-0000-0000-000000000104',
        purchase_order_id: 10,
        supplier_id: 777,
        final_action: 'REPOSICAO',
      },
      error: null,
    });
    context.supabase.table('damage_replacements').single.mockResolvedValue({
      data: { id: 'replacement-3', replacement_status: 'EM_ANDAMENTO' },
      error: null,
    });

    const token = await generateTestToken(context.app, { role: UserRole.COMPRAS });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000104/replacement/cancel',
      headers: { Authorization: `Bearer ${token}` },
      payload: { cancellation_reason: 'Fornecedor não cumpriu nova data' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      replacement_id: 'replacement-3',
      replacement_status: 'cancelado',
      damage_status: 'cancelamento_aplicado',
    });
  });

  it('fornecedor cannot cancel replacement endpoint', async () => {
    const token = await generateTestToken(context.app, { role: UserRole.FORNECEDOR });
    const response = await context.app.inject({
      method: 'PATCH',
      url: '/api/damages/00000000-0000-0000-0000-000000000104/replacement/cancel',
      headers: { Authorization: `Bearer ${token}` },
      payload: { cancellation_reason: 'x' },
    });

    expect(response.statusCode).toBe(403);
  });
});
