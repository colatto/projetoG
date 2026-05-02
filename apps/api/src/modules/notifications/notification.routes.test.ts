import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { UserRole, NotificationType } from '@projetog/domain';
import { createSupabaseChainMock } from '../../test/quotation-test-helpers.js';
import notificationsRoutes from './notifications.routes.js';

const TEST_JWT_SECRET = 'test-secret-notifications';

async function getToken(
  app: FastifyInstance,
  role: UserRole,
  sub = '00000000-0000-0000-0000-000000000099',
) {
  return app.jwt.sign({
    sub,
    email: 'user@grf.com.br',
    name: 'User',
    role,
    app_metadata: { role },
  });
}

describe('Notification Routes', () => {
  let app: FastifyInstance;
  let supabase: ReturnType<typeof createSupabaseChainMock>;

  beforeEach(async () => {
    supabase = createSupabaseChainMock();
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.register(sensible);
    app.register(fastifyJwt, { secret: TEST_JWT_SECRET });

    app.decorate('authenticate', async function (request) {
      await request.jwtVerify();
    });
    app.decorate('verifyRole', function (allowedRoles: UserRole[]) {
      return async function (request, reply) {
        await request.jwtVerify();
        const role = request.user.role || (request.user.app_metadata?.role as UserRole);
        if (!role || !allowedRoles.includes(role)) {
          return reply.code(403).send({ error: 'Forbidden' });
        }
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.decorate('supabase', supabase.client as any);
    app.decorate('boss', { send: vi.fn().mockResolvedValue('job-id') });
    app.register(notificationsRoutes, { prefix: '/api/notifications' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ────────────────────────────────────────────────────────────
  // Gap 3.1 — RBAC
  // ────────────────────────────────────────────────────────────

  describe('RBAC — GET /api/notifications/logs', () => {
    it('blocks unauthenticated users (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
      });
      expect(response.statusCode).toBe(401);
    });

    it('blocks FORNECEDOR (403)', async () => {
      const token = await getToken(app, UserRole.FORNECEDOR);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('blocks VISUALIZADOR_PEDIDOS (403)', async () => {
      const token = await getToken(app, UserRole.VISUALIZADOR_PEDIDOS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('allows COMPRAS (200) and returns paginated payload', async () => {
      supabase.table('notification_logs')._mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.pagination).toEqual({ total: 0, page: 1, per_page: 20 });
    });
  });

  describe('RBAC — GET /api/notifications/templates', () => {
    it('blocks unauthenticated users (401)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/templates',
      });
      expect(response.statusCode).toBe(401);
    });

    it('blocks FORNECEDOR (403)', async () => {
      const token = await getToken(app, UserRole.FORNECEDOR);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/templates',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('blocks VISUALIZADOR_PEDIDOS (403)', async () => {
      const token = await getToken(app, UserRole.VISUALIZADOR_PEDIDOS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/templates',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('RBAC — PUT /api/notifications/templates/:id', () => {
    const validTemplateId = '11111111-1111-1111-1111-111111111111';
    const validBody = {
      subject_template: 'Nova cotação {{quotationId}}',
      body_template: 'Olá, sua cotação {{quotationId}} chegou via {{link}}.',
    };

    it('blocks unauthenticated users (401)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/templates/${validTemplateId}`,
        payload: validBody,
      });
      expect(response.statusCode).toBe(401);
    });

    it('blocks FORNECEDOR (403)', async () => {
      const token = await getToken(app, UserRole.FORNECEDOR);
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/templates/${validTemplateId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: validBody,
      });
      expect(response.statusCode).toBe(403);
    });

    it('blocks VISUALIZADOR_PEDIDOS (403)', async () => {
      const token = await getToken(app, UserRole.VISUALIZADOR_PEDIDOS);
      const response = await app.inject({
        method: 'PUT',
        url: `/api/notifications/templates/${validTemplateId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: validBody,
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────
  // Gap 3.2 — Filtros avançados
  // ────────────────────────────────────────────────────────────

  describe('Filters — GET /api/notifications/logs', () => {
    function setupEmptyLogs() {
      supabase.table('notification_logs')._mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });
    }

    it('does not apply any filter when no query params are sent', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);

      const chain = supabase.table('notification_logs');
      expect(chain.eq).not.toHaveBeenCalledWith('quotation_id', expect.anything());
      expect(chain.eq).not.toHaveBeenCalledWith('recipient_supplier_id', expect.anything());
      expect(chain.eq).not.toHaveBeenCalledWith('type', expect.anything());
      expect(chain.eq).not.toHaveBeenCalledWith('status', expect.anything());
      expect(chain.gte).not.toHaveBeenCalled();
      expect(chain.lt).not.toHaveBeenCalled();
    });

    it('applies quotation_id filter', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?quotation_id=42',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').eq).toHaveBeenCalledWith('quotation_id', 42);
    });

    it('applies supplier_id filter on recipient_supplier_id', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?supplier_id=77',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').eq).toHaveBeenCalledWith(
        'recipient_supplier_id',
        77,
      );
    });

    it('applies type filter', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: `/api/notifications/logs?type=${NotificationType.NEW_QUOTATION}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').eq).toHaveBeenCalledWith(
        'type',
        NotificationType.NEW_QUOTATION,
      );
    });

    it('applies status filter', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?status=failed',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').eq).toHaveBeenCalledWith('status', 'failed');
    });

    it('applies start_date as gte on created_at', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?start_date=2026-04-01',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').gte).toHaveBeenCalledWith(
        'created_at',
        '2026-04-01T00:00:00.000Z',
      );
    });

    it('applies end_date as lt on created_at with +1 day exclusive', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?end_date=2026-04-30',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(supabase.table('notification_logs').lt).toHaveBeenCalledWith(
        'created_at',
        '2026-05-01T00:00:00.000Z',
      );
    });

    it('combines multiple filters in a single request', async () => {
      setupEmptyLogs();
      const token = await getToken(app, UserRole.COMPRAS);
      const url =
        `/api/notifications/logs?type=${NotificationType.NEW_QUOTATION}` +
        '&status=sent&start_date=2026-04-01&end_date=2026-04-30&quotation_id=10&supplier_id=5';
      await app.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      });

      const chain = supabase.table('notification_logs');
      expect(chain.eq).toHaveBeenCalledWith('quotation_id', 10);
      expect(chain.eq).toHaveBeenCalledWith('recipient_supplier_id', 5);
      expect(chain.eq).toHaveBeenCalledWith('type', NotificationType.NEW_QUOTATION);
      expect(chain.eq).toHaveBeenCalledWith('status', 'sent');
      expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-04-01T00:00:00.000Z');
      expect(chain.lt).toHaveBeenCalledWith('created_at', '2026-05-01T00:00:00.000Z');
    });

    it('rejects invalid status value with 400', async () => {
      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?status=invalid_status',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects invalid date format with 400', async () => {
      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?start_date=01-04-2026',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects invalid type value with 400', async () => {
      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?type=not_a_valid_type',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns CSV format when export=csv is requested', async () => {
      supabase.table('notification_logs')._mockResolvedValue({
        data: [
          {
            id: 'log-1',
            type: 'new_quotation',
            recipient_email: 'forn@x.com',
            quotation_id: 1,
            subject: 'Hello',
            status: 'sent',
            created_at: '2026-04-15T10:00:00.000Z',
            sent_at: '2026-04-15T10:00:01.000Z',
          },
        ],
        error: null,
        count: 1,
      });

      const token = await getToken(app, UserRole.COMPRAS);
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs?export=csv&type=new_quotation',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.body).toContain('ID,Type,Recipient');
      expect(response.body).toContain('log-1');
      // Filtros aplicados também no ramo de export
      expect(supabase.table('notification_logs').eq).toHaveBeenCalledWith('type', 'new_quotation');
    });
  });
});
