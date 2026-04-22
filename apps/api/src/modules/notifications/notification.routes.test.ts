import { describe, it, expect, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { UserRole, UserStatus } from '@projetog/domain';

async function getFornecedorToken(app: ReturnType<typeof buildApp>) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000088',
    email: 'fornecedor@grf.com.br',
    name: 'Fornecedor GRF',
    role: UserRole.FORNECEDOR,
    status: UserStatus.ATIVO,
  });
}

describe('Notification Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp({ boss: null as any });
    await app.ready();
  });

  describe('GET /api/notifications/templates', () => {
    it('should block unauthenticated users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/templates',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should block FORNECEDOR', async () => {
      const token = await getFornecedorToken(app);
      
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/templates',
        headers: { authorization: `Bearer ${token}` },
      });
      
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/notifications/logs', () => {
    it('should block unauthenticated users', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/notifications/logs',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
