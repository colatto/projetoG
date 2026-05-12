import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Metrics plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://lkfevrdhofxlmwjfhnru.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('deve expor metricas sem quebrar o bootstrap da aplicacao', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('projetog_api_process_cpu_user_seconds_total');
  });
});
