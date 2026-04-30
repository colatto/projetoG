import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { serializerCompiler } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import { createSupabaseChainMock } from '../../test/quotation-test-helpers.js';
import { dashboardRoutes } from './dashboard.routes.js';

async function getRoleToken(app: FastifyInstance, role: UserRole) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000077',
    email: 'user@grf.com.br',
    name: 'User GRF',
    role,
    status: 'ATIVO',
    app_metadata: { role },
  });
}

describe('Dashboard Routes', () => {
  let app: FastifyInstance;
  let supabase: ReturnType<typeof createSupabaseChainMock>;

  beforeEach(async () => {
    supabase = createSupabaseChainMock();
    app = Fastify({ logger: false });
    app.setValidatorCompiler(serializerCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(sensible);
    app.register(fastifyJwt, { secret: 'test-jwt-secret-dashboard' });
    app.decorate('authenticate', async function (request) {
      await request.jwtVerify();
    });
    app.decorate('verifyRole', function (allowedRoles: UserRole[]) {
      return async function (request: { user: { role: UserRole } }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
        await request.jwtVerify();
        if (!allowedRoles.includes(request.user.role)) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('supabase', supabase.client as any);
    app.decorate('boss', null);
    app.register(dashboardRoutes, { prefix: '/api/dashboard' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo',
    });
    expect(response.statusCode).toBe(401);
  });

  it('returns 403 for FORNECEDOR role', async () => {
    const token = await getRoleToken(app, UserRole.FORNECEDOR);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('returns 403 for VISUALIZADOR_PEDIDOS role', async () => {
    const token = await getRoleToken(app, UserRole.VISUALIZADOR_PEDIDOS);
    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/kpis',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('aggregates ranking to one row per supplier (latest snapshot in period)', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot_por_fornecedor')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-01',
          supplier_id: 5,
          supplier_name: 'ACME',
          cotacoes_enviadas: 1,
          cotacoes_respondidas: 1,
          pedidos_no_prazo: 2,
          pedidos_atrasados: 3,
          pedidos_com_avaria: 0,
          lead_time_medio_dias_uteis: 10,
          confiabilidade: 'atencao',
        },
        {
          snapshot_date: '2026-04-10',
          supplier_id: 5,
          supplier_name: 'ACME',
          cotacoes_enviadas: 2,
          cotacoes_respondidas: 2,
          pedidos_no_prazo: 4,
          pedidos_atrasados: 1,
          pedidos_com_avaria: 1,
          lead_time_medio_dias_uteis: 8,
          confiabilidade: 'critico',
        },
      ],
      error: null,
    });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/ranking-fornecedores?data_inicio=2026-04-01&data_fim=2026-04-15',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.fornecedores).toHaveLength(1);
    expect(body.fornecedores[0].supplier_id).toBe(5);
    expect(body.fornecedores[0].pedidos_atrasados).toBe(1);
    expect(body.fornecedores[0].pedidos_no_prazo).toBe(4);
    expect(body.fornecedores[0].confiabilidade).toBe('critico');
  });

  it('filters criticidade by snapshot_date and returns data_snapshot', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot')._mockResolvedValue({
      data: { snapshot_date: '2026-04-10' },
      error: null,
    });
    supabase.table('dashboard_criticidade_item')._mockResolvedValue({
      data: [
        {
          item_identifier: '99',
          item_description: 'Cimento',
          building_id: 7,
          prazo_obra_dias_uteis: 5,
          media_historica_dias_uteis: 10,
          criticidade: 'padrao',
        },
      ],
      error: null,
    });
    supabase.table('dashboard_snapshot_por_obra')._mockResolvedValue({
      data: [{ building_id: 7, building_name: 'Torre Norte' }],
      error: null,
    });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/criticidade',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data_snapshot).toBe('2026-04-10');
    expect(body.itens).toHaveLength(1);
    expect(body.itens[0].building_name).toBe('Torre Norte');
  });

  it('returns empty criticidade when no snapshots exist', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot')._mockResolvedValue({ data: null, error: null });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/criticidade',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data_snapshot).toBeNull();
    expect(body.itens).toEqual([]);
  });
});
