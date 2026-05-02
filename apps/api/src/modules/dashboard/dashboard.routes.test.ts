import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('GET /resumo returns summary shape and records dashboard.access audit', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot')._mockResolvedValue({
      data: {
        snapshot_date: '2026-05-02',
        pedidos_atrasados: 9,
        pedidos_com_avaria: 2,
      },
      error: null,
    });
    supabase.table('supplier_negotiations')._mockResolvedValue({ count: 14, error: null });
    supabase.table('integration_events')._mockResolvedValue({ count: 6, error: null });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      cotacoes_abertas: 14,
      cotacoes_aguardando_revisao: 14,
      pedidos_atrasados: 9,
      pedidos_em_avaria: 2,
      falhas_integracao: 6,
      data_snapshot: '2026-05-02',
    });

    expect(supabase.table('audit_logs').insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'dashboard.access',
        entity_type: 'dashboard',
        entity_id: 'resumo',
        actor_id: '00000000-0000-0000-0000-000000000077',
        metadata: expect.objectContaining({ dashboard: 'resumo' }),
      }),
    );
  });

  it('GET /lead-time records dashboard.access with entity_id lead-time', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot_por_fornecedor')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-02',
          supplier_id: 3,
          supplier_name: 'X',
          lead_time_medio_dias_uteis: 5,
          pedidos_atrasados: 0,
          pedidos_no_prazo: 1,
        },
      ],
      error: null,
    });
    supabase.table('dashboard_snapshot_por_obra')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-02',
          building_id: 8,
          building_name: 'Obra',
          lead_time_medio_dias_uteis: 6,
          pedidos_atrasados: 0,
          pedidos_no_prazo: 1,
        },
      ],
      error: null,
    });
    supabase.table('dashboard_snapshot')._mockResolvedValue({
      data: [{ snapshot_date: '2026-04-02', lead_time_medio_dias_uteis: 7 }],
      error: null,
    });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/lead-time?data_inicio=2026-04-01&data_fim=2026-04-05',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(supabase.table('audit_logs').insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'dashboard.access',
        entity_id: 'lead-time',
        actor_id: '00000000-0000-0000-0000-000000000077',
      }),
    );
  });

  it('GET /atrasos scopes headline to purchase_order_id and clears evolution series', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot_por_fornecedor')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-10',
          supplier_id: 5,
          supplier_name: 'A',
          pedidos_atrasados: 22,
          pedidos_no_prazo: 40,
        },
        {
          snapshot_date: '2026-04-10',
          supplier_id: 9,
          supplier_name: 'B',
          pedidos_atrasados: 4,
          pedidos_no_prazo: 10,
        },
      ],
      error: null,
    });
    supabase.table('dashboard_snapshot_por_obra')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-10',
          building_id: 77,
          building_name: 'BR',
          pedidos_atrasados: 999,
          pedidos_no_prazo: 1,
        },
      ],
      error: null,
    });
    supabase.table('dashboard_snapshot')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-10',
          pedidos_atrasados: 999,
          total_pedidos_monitorados: 500,
        },
      ],
      error: null,
    });
    supabase.table('purchase_orders')._mockResolvedValue({
      data: { id: 55, supplier_id: 5, building_id: 77 },
      error: null,
    });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/atrasos?data_inicio=2026-04-01&data_fim=2026-04-15&purchase_order_id=55',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.total_atrasados).toBe(22);
    expect(body.taxa_atraso).toBe(
      Number((((22 / 62) * 100).toFixed(2))),
    );
    expect(body.atrasos_por_fornecedor).toHaveLength(1);
    expect(body.atrasos_por_obra).toHaveLength(1);
    expect(body.evolucao_diaria).toEqual([]);
  });

  it('filters ranking suppliers when supplier_id query is set', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot_por_fornecedor')._mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-10',
          supplier_id: 5,
          supplier_name: 'ACME',
          cotacoes_enviadas: 1,
          cotacoes_respondidas: 1,
          pedidos_no_prazo: 2,
          pedidos_atrasados: 1,
          pedidos_com_avaria: 0,
          lead_time_medio_dias_uteis: 10,
          confiabilidade: 'confiavel',
        },
        {
          snapshot_date: '2026-04-10',
          supplier_id: 99,
          supplier_name: 'OTHER',
          cotacoes_enviadas: 3,
          cotacoes_respondidas: 3,
          pedidos_no_prazo: 1,
          pedidos_atrasados: 0,
          pedidos_com_avaria: 0,
          lead_time_medio_dias_uteis: 3,
          confiabilidade: 'confiavel',
        },
      ],
      error: null,
    });
    supabase.table('audit_logs')._mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/ranking-fornecedores?data_inicio=2026-04-01&data_fim=2026-04-15&supplier_id=99',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.fornecedores).toHaveLength(1);
    expect(body.fornecedores[0].supplier_id).toBe(99);
  });

  it('returns 400 when criticidade supplier_id does not match purchase_order_id', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('purchase_orders')._mockResolvedValue({
      data: { supplier_id: 100 },
      error: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/criticidade?purchase_order_id=1&supplier_id=200',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toMatch(/Fornecedor não corresponde ao pedido/);
  });

  it('returns 200 from resumo when audit_logs insert fails (best-effort audit)', async () => {
    const token = await getRoleToken(app, UserRole.COMPRAS);
    supabase.table('dashboard_snapshot')._mockResolvedValue({
      data: {
        snapshot_date: '2026-05-02',
        pedidos_atrasados: 1,
        pedidos_com_avaria: 0,
      },
      error: null,
    });
    supabase.table('supplier_negotiations')._mockResolvedValue({ count: 0, error: null });
    supabase.table('integration_events')._mockResolvedValue({ count: 0, error: null });

    const origFrom = supabase.client.from.bind(supabase.client);
    supabase.client.from = vi.fn((table: string) => {
      if (table === 'audit_logs') {
        return {
          insert: vi.fn(() => Promise.reject(new Error('audit down'))),
        };
      }
      return origFrom(table);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo',
      headers: { authorization: `Bearer ${token}` },
    });

    supabase.client.from = origFrom;

    expect(response.statusCode).toBe(200);
  });
});
