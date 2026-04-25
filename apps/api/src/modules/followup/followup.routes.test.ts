import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import { createSupabaseChainMock } from '../../test/quotation-test-helpers.js';
import { followupRoutes } from './followup.routes.js';

async function getToken(app: FastifyInstance, role: UserRole, sub = '00000000-0000-0000-0000-000000000099') {
  return app.jwt.sign({
    sub,
    email: 'user@grf.com.br',
    name: 'User',
    role,
    app_metadata: { role },
  });
}

describe('FollowUp Routes', () => {
  let app: FastifyInstance;
  let supabase: ReturnType<typeof createSupabaseChainMock>;

  beforeEach(async () => {
    supabase = createSupabaseChainMock();
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(sensible);
    app.register(fastifyJwt, { secret: 'test-secret-followup' });

    app.decorate('authenticate', async function (request) {
      await request.jwtVerify();
    });
    app.decorate('verifyRole', function (allowedRoles: UserRole[]) {
      return async function (request, reply) {
        await request.jwtVerify();
        if (!allowedRoles.includes(request.user.role)) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('supabase', supabase.client as any);
    app.decorate('boss', { send: vi.fn().mockResolvedValue('job-id') });
    app.register(followupRoutes, { prefix: '/api/followup' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('blocks unauthenticated access to followup list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/followup/orders' });
    expect(response.statusCode).toBe(401);
  });

  it('returns list ordered by operational priority', async () => {
    supabase.table('follow_up_trackers')._mockResolvedValue({
      data: [
        {
          id: 't0',
          purchase_order_id: 100,
          status: 'ATIVO',
          promised_date_current: '2026-04-15',
          updated_at: '2026-04-22T10:00:00.000Z',
          purchase_orders: { local_status: 'DIVERGENCIA' },
        },
        {
          id: 't1',
          purchase_order_id: 101,
          status: 'ATIVO',
          promised_date_current: '2026-04-15',
          updated_at: '2026-04-21T10:00:00.000Z',
          purchase_orders: { local_status: 'PENDENTE' },
        },
        {
          id: 't3',
          purchase_order_id: 103,
          status: 'ATIVO',
          promised_date_current: '2026-04-14',
          updated_at: '2026-04-21T11:00:00.000Z',
          purchase_orders: { local_status: 'EM_AVARIA' },
        },
        {
          id: 't2',
          purchase_order_id: 102,
          status: 'ATRASADO',
          promised_date_current: '2026-04-10',
          updated_at: '2026-04-20T10:00:00.000Z',
          purchase_orders: { local_status: 'ATRASADO' },
        },
      ],
      error: null,
    });

    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'GET',
      url: '/api/followup/orders',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.data.map((row: { purchase_order_id: number }) => row.purchase_order_id)).toEqual([
      102, 100, 103, 101,
    ]);
  });

  it('applies supplier_id and building_id filters in list query', async () => {
    supabase.table('follow_up_trackers')._mockResolvedValue({ data: [], error: null });
    supabase.table('order_quotation_links')._mockResolvedValue({ data: [], error: null });

    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'GET',
      url: '/api/followup/orders?supplier_id=77&building_id=12',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('follow_up_trackers').eq).toHaveBeenCalledWith('supplier_id', 77);
    expect(supabase.table('follow_up_trackers').eq).toHaveBeenCalledWith('building_id', 12);
  });

  it('allows supplier to confirm on-time delivery', async () => {
    supabase.table('profiles').single.mockResolvedValueOnce({ data: { supplier_id: 77 }, error: null });
    supabase.table('profiles')._mockResolvedValue({ data: [{ email: 'compras@grf.com' }], error: null });
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: { id: 'trk-1', purchase_order_id: 123, supplier_id: 77, status: 'ATIVO' },
      error: null,
    });

    const token = await getToken(app, UserRole.FORNECEDOR);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/orders/123/confirm',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('follow_up_trackers').update).toHaveBeenCalled();
    expect(supabase.table('notification_logs').insert).toHaveBeenCalled();
  });

  it('blocks COMPRAS from supplier-only confirm endpoint', async () => {
    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/orders/123/confirm',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows supplier to suggest new date and pauses tracker', async () => {
    supabase.table('profiles').single.mockResolvedValueOnce({ data: { supplier_id: 77 }, error: null });
    supabase.table('profiles')._mockResolvedValue({ data: [{ email: 'compras@grf.com' }], error: null });
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: {
        id: 'trk-2',
        purchase_order_id: 123,
        supplier_id: 77,
        order_date: '2026-04-01',
        promised_date_current: '2026-04-10',
      },
      error: null,
    });
    supabase.table('follow_up_date_changes').single.mockResolvedValueOnce({
      data: { id: 'dc-1' },
      error: null,
    });

    const token = await getToken(app, UserRole.FORNECEDOR);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/orders/123/suggest-date',
      headers: { authorization: `Bearer ${token}` },
      payload: { suggested_date: '2099-04-20', reason: 'Fornecedor solicitou extensão' },
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('follow_up_date_changes').insert).toHaveBeenCalled();
    expect(supabase.table('follow_up_trackers').update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PAUSADO',
        supplier_response_type: 'suggested_new_date',
        suggested_date_status: 'pending_approval',
      }),
    );
  });

  it('rejects invalid suggested date in suggest-date endpoint', async () => {
    const token = await getToken(app, UserRole.FORNECEDOR);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/orders/123/suggest-date',
      headers: { authorization: `Bearer ${token}` },
      payload: { suggested_date: '2020-01-01' },
    });

    expect(response.statusCode).toBe(422);
  });

  it('approves date change and recalculates next notification in business days', async () => {
    supabase.table('follow_up_date_changes').single.mockResolvedValueOnce({
      data: {
        id: 'dc-2',
        follow_up_tracker_id: 'trk-3',
        previous_date: '2026-04-05',
        suggested_date: '2026-04-11',
        decision: 'pending',
        reason: null,
      },
      error: null,
    });
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: {
        id: 'trk-3',
        order_date: '2026-04-01',
      },
      error: null,
    });
    supabase.table('business_days_holidays')._mockResolvedValue({ data: [], error: null });

    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/date-changes/00000000-0000-4000-8000-000000000002/approve',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('follow_up_trackers').update).toHaveBeenCalledWith(
      expect.objectContaining({
        suggested_date_status: 'approved',
        status: 'ATIVO',
        current_notification_number: 0,
        next_notification_date: '2026-04-06',
      }),
    );
  });

  it('rejects date change request', async () => {
    supabase.table('follow_up_date_changes').single.mockResolvedValueOnce({
      data: {
        id: 'dc-3',
        follow_up_tracker_id: 'trk-4',
        previous_date: '2026-04-05',
        suggested_date: '2026-04-14',
        decision: 'pending',
        reason: null,
      },
      error: null,
    });
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: {
        id: 'trk-4',
        order_date: '2026-04-01',
      },
      error: null,
    });

    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'POST',
      url: '/api/followup/date-changes/00000000-0000-4000-8000-000000000003/reject',
      headers: { authorization: `Bearer ${token}` },
      payload: { reason: 'Data incompatível' },
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('follow_up_trackers').update).toHaveBeenCalledWith(
      expect.objectContaining({
        suggested_date_status: 'rejected',
        status: 'ATIVO',
      }),
    );
  });

  it('returns follow-up notifications for authorized compras user', async () => {
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: { id: 'trk-55', supplier_id: 77 },
      error: null,
    });
    supabase.table('notification_logs')._mockResolvedValue({
      data: [
        {
          id: 'n-1',
          follow_up_tracker_id: 'trk-55',
          subject: 'Notificação 1',
        },
      ],
      error: null,
    });

    const token = await getToken(app, UserRole.COMPRAS);
    const response = await app.inject({
      method: 'GET',
      url: '/api/followup/orders/123/notifications',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveLength(1);
    expect(payload[0].subject).toBe('Notificação 1');
  });

  it('blocks supplier from reading notifications of another supplier order', async () => {
    supabase.table('follow_up_trackers').single.mockResolvedValueOnce({
      data: { id: 'trk-77', supplier_id: 77 },
      error: null,
    });
    supabase.table('profiles').single.mockResolvedValueOnce({
      data: { supplier_id: 88 },
      error: null,
    });

    const token = await getToken(app, UserRole.FORNECEDOR);
    const response = await app.inject({
      method: 'GET',
      url: '/api/followup/orders/123/notifications',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toEqual(
      expect.objectContaining({
        message: 'Acesso negado',
      }),
    );
    expect(supabase.table('notification_logs').select).not.toHaveBeenCalled();
  });
});
