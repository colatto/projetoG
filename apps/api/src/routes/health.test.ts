import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';

describe('Health Route', () => {
  beforeEach(() => {
    // Ensure env vars needed by plugins are set for test
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  });

  it('deve retornar HTTP 200 e payload válido no endpoint de saúde rotineira', async () => {
    const app = buildApp();

    // .inject simula um request completo de rede pelo framework, sem subir listeners reais
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    // A validação de body.json() prova que o parse interno do Fastify foi efetuado.
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
    expect(body.version).toBe('1.0.0');
  });
});
