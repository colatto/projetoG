import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { UserRole, UserStatus } from '@projetog/domain';

async function getRoleToken(app: ReturnType<typeof buildApp>, role: UserRole) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000077',
    email: 'user@grf.com.br',
    name: 'User GRF',
    role,
    status: UserStatus.ATIVO,
  });
}

describe('Dashboard Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = buildApp({ boss: null });
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
});
