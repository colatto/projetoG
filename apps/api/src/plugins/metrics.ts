import fp from 'fastify-plugin';
import { Registry, collectDefaultMetrics, contentType } from 'prom-client';

let metricsRegistry: Registry | null = null;

function getMetricsRegistry() {
  if (metricsRegistry) {
    return metricsRegistry;
  }

  metricsRegistry = new Registry();
  collectDefaultMetrics({
    prefix: 'projetog_api_',
    register: metricsRegistry,
  });

  return metricsRegistry;
}

export const metricsPlugin = fp(async (fastify) => {
  const registry = getMetricsRegistry();

  fastify.get('/metrics', async (_request, reply) => {
    reply.header('content-type', registry.contentType || contentType);
    return registry.metrics();
  });
});
