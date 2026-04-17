import 'dotenv/config';
import { getBoss } from './boss.js';
import { registerHandlers } from './handlers/index.js';
import { installConsoleJsonLogger } from './logger.js';
import { setWorkerReady, startObservabilityServer, stopObservabilityServer } from './observability.js';

installConsoleJsonLogger();

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  setWorkerReady(false);
  console.log('Worker shutdown requested', { signal });

  try {
    await stopObservabilityServer();
    await getBoss().stop();
    process.exit(0);
  } catch (error) {
    console.error('Failed during worker shutdown', error);
    process.exit(1);
  }
}

async function start() {
  console.log('Worker process starting...');

  try {
    const observabilityPort = process.env.WORKER_METRICS_PORT
      ? Number.parseInt(process.env.WORKER_METRICS_PORT, 10)
      : 9080;

    await startObservabilityServer(observabilityPort);
    console.log('Worker observability server started', { port: observabilityPort });

    const boss = getBoss();

    // start() checks if pgboss schema exists, creates it if not, and starts the internal queues
    await boss.start();
    console.log('pg-boss started successfully.');

    // Register handlers where jobs hook up to processor functions
    await registerHandlers(boss);

    console.log('Worker is now listening for jobs.');
    setWorkerReady(true);

    // Graceful shutdown
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    setWorkerReady(false);
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

start();
