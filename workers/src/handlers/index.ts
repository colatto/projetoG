import PgBoss from 'pg-boss';
import { processFollowUp } from '../jobs/follow-up.js';
import { processSiengePolling } from '../jobs/sienge-polling.js';
import { processSiengeReconcile } from '../jobs/sienge-reconcile.js';
import { processRetryIntegration } from '../jobs/retry-integration.js';

export async function registerHandlers(boss: PgBoss) {
  // Registering all workers to their specific queues
  await boss.work('follow-up', async (job: unknown) => processFollowUp(job));
  await boss.work('sienge:polling', async (job: unknown) => processSiengePolling(job));
  await boss.work('sienge:reconcile', async (job: unknown) => processSiengeReconcile(job));
  await boss.work('integration:retry', async (job: unknown) => processRetryIntegration(job));

  console.log('All job handlers registered.');
}
