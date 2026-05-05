import { createServer, Server } from 'node:http';
import { Registry, Gauge, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({
  prefix: 'projetog_workers_',
  register: registry,
});

const readyGauge = new Gauge({
  name: 'projetog_workers_ready',
  help: 'Worker readiness state',
  registers: [registry],
});

let server: Server | null = null;
let ready = false;

export function setWorkerReady(state: boolean) {
  ready = state;
  readyGauge.set(state ? 1 : 0);
}

export async function startObservabilityServer(port: number) {
  if (server) {
    return;
  }

  server = createServer(async (request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (request.url === '/ready') {
      response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: ready ? 'ready' : 'starting' }));
      return;
    }

    if (request.url === '/metrics') {
      response.writeHead(200, { 'content-type': registry.contentType });
      response.end(await registry.metrics());
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  const host = process.env.HOST ?? '0.0.0.0';

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(port, host, () => resolve());
  });
}

export async function stopObservabilityServer() {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}
