import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { UserRole, UserStatus } from '@projetog/domain';
import type { FastifyInstance } from 'fastify';

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      admin: { updateUserById: vi.fn() },
    },
    from: mockFrom,
  }),
}));

function createThenableBuilder(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  for (const m of ['select', 'order', 'eq', 'gte', 'lt', 'range']) {
    b[m] = vi.fn(() => b);
  }
  b.then = (onFulfilled?: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
  return b;
}

function buildTestApp() {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-audit-routes';
  return buildApp({ boss: null });
}

async function token(app: FastifyInstance, role: UserRole) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-0000000000aa',
    email: 'audit@grf.com.br',
    name: 'Audit',
    role,
    status: UserStatus.ATIVO,
  });
}

describe('Audit routes (PRD-09)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without auth for GET /api/backoffice/audit', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/backoffice/audit' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for FORNECEDOR', async () => {
    const t = await token(app, UserRole.FORNECEDOR);
    const res = await app.inject({
      method: 'GET',
      url: '/api/backoffice/audit',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 200 and pagination for COMPRAS', async () => {
    const row = {
      id: '00000000-0000-0000-0000-000000000001',
      event_type: 'quotation.sent',
      event_timestamp: '2026-05-01T12:00:00.000Z',
      actor_id: '00000000-0000-0000-0000-0000000000aa',
      actor_type: 'user',
      purchase_quotation_id: 1,
      purchase_order_id: null,
      supplier_id: null,
      summary: 'test',
      metadata: {},
      entity_type: null,
      entity_id: null,
      target_user_id: null,
      created_at: '2026-05-01T12:00:00.000Z',
    };
    const listChain = createThenableBuilder({
      data: [row],
      count: 1,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'audit_logs') {
        return { select: vi.fn(() => listChain) };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const t = await token(app, UserRole.COMPRAS);
    const res = await app.inject({
      method: 'GET',
      url: '/api/backoffice/audit?page=1&limit=10',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.pagination.total).toBe(1);
    expect(body.data).toHaveLength(1);
  });

  it('returns 404 for unknown audit id', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'audit_logs') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const t = await token(app, UserRole.ADMINISTRADOR);
    const res = await app.inject({
      method: 'GET',
      url: '/api/backoffice/audit/00000000-0000-0000-0000-00000000dead',
      headers: { authorization: `Bearer ${t}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
