import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('Metrics plugin', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  });

  it('deve expor metricas sem quebrar o bootstrap da aplicacao', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('projetog_api_process_cpu_user_seconds_total');
  });
});
