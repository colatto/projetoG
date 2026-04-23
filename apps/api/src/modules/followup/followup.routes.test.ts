import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('blocks unauthenticated access to followup list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/followup/orders' });
    expect(response.statusCode).toBe(401);
  });

  it('returns list ordered by operational priority', async () => {
    supabase.table('follow_up_trackers')._mockResolvedValue({
      data: [
        {
          id: 't1',
          purchase_order_id: 101,
          status: 'ATIVO',
          promised_date_current: '2026-04-15',
          updated_at: '2026-04-21T10:00:00.000Z',
          purchase_orders: { local_status: 'PENDENTE' },
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
    expect(payload.data.map((row: { purchase_order_id: number }) => row.purchase_order_id)).toEqual([102, 101]);
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
});
