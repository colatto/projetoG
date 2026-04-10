import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('Health Route', () => {
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
