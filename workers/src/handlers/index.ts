import PgBoss from 'pg-boss';
import { processFollowUp } from '../jobs/follow-up.js';
import { processSyncQuotations } from '../jobs/sync-quotations.js';
import { processSyncOrders } from '../jobs/sync-orders.js';
import { processSyncDeliveries } from '../jobs/sync-deliveries.js';
import { processSiengeReconcile } from '../jobs/sienge-reconcile.js';
import { processRetryIntegration } from '../jobs/retry-integration.js';
import { processWebhook } from '../jobs/process-webhook.js';
import { processOutboundNegotiation } from '../jobs/outbound-negotiation.js';
import { processQuotationExpireCheck } from '../jobs/quotation-expire-check.js';
import { processDashboardConsolidation } from '../jobs/dashboard-consolidation.js';

/**
 * Job retry/expiration configuration per fronteira-integracao.md §9.3, Camada 2.
 * These are SendOptions — applied when scheduling/sending jobs, NOT when registering handlers.
 * pg-boss v9: boss.work() accepts WorkOptions (teamSize, polling); boss.schedule() accepts SendOptions (retry, expiry).
 */
const SEND_OPTIONS = {
  syncPolling: {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInHours: 1,
  },
  reconcile: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInHours: 1,
  },
  retry: {
    retryLimit: 1,
    expireInHours: 1,
  },
  followUp: {
    retryLimit: 2,
    retryDelay: 120,
    retryBackoff: true,
    expireInHours: 4,
  },
  processWebhook: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInHours: 1,
  },
  quotationExpireCheck: {
    retryLimit: 2,
    retryDelay: 120,
    retryBackoff: true,
    expireInHours: 4,
  },
} as const;

/**
 * Registers all job handlers and schedules cron jobs.
 * Called once at worker startup.
 *
 * PRD-07 §6.1-6.6, fronteira-integracao.md §6, §9.3
 */
export async function registerHandlers(boss: PgBoss): Promise<void> {
  // ── Register job processors ───────────────────────────────────

  // Sync jobs — specialized polling handlers (Sprint 4)
  await boss.work<object>('sienge:sync-quotations', async (job) => processSyncQuotations(job));

  await boss.work<object>('sienge:sync-orders', async (job) => processSyncOrders(job));

  await boss.work<object>('sienge:sync-deliveries', async (job) => processSyncDeliveries(job));

  // Reconcile — webhook-triggered re-reads (Sprint 5)
  await boss.work<object>('sienge:reconcile', async (job) => processSiengeReconcile(job));

  // Process webhook — async processing of received webhooks (Sprint 5)
  await boss.work<object>('sienge:process-webhook', async (job) => processWebhook(job));

  // Notification Email — sending emails asynchronously
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  await boss.work<any>('notification:send-email', async (job) => {
    const { processNotificationSendEmail } = await import('../jobs/notification-send-email.js');
    return processNotificationSendEmail(job);
  });

  // Outbound negotiation — writing approved quotation to Sienge
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  await boss.work<any>('sienge:outbound-negotiation', async (job) =>
    processOutboundNegotiation(job),
  );

  // Retry — business-layer retry cron (stub, Sprint 7)
  await boss.work<object>('integration:retry', async (job) => processRetryIntegration(job));

  // Follow-up — logistics follow-up (stub, PRD-04)
  await boss.work<object>('follow-up', async (job) => processFollowUp(job));

  // Quotation expire check — PRD-02 §6.6
  await boss.work<object>('quotation:expire-check', async (job) =>
    processQuotationExpireCheck(job),
  );

  await boss.work<object>('dashboard:consolidation', async (job) =>
    processDashboardConsolidation(job),
  );

  // ── Schedule cron jobs ────────────────────────────────────────
  // Uses singletonKey to prevent duplicate runs when cron fires before
  // the previous job completes (fronteira-integracao.md §9.3).
  // Retry/expiration options (SendOptions) are applied here at schedule time.

  await boss.schedule(
    'sienge:sync-quotations',
    '*/15 * * * *', // Every 15 minutes
    {},
    { singletonKey: 'sienge:sync-quotations:singleton', ...SEND_OPTIONS.syncPolling },
  );

  await boss.schedule(
    'sienge:sync-orders',
    '*/15 * * * *', // Every 15 minutes
    {},
    { singletonKey: 'sienge:sync-orders:singleton', ...SEND_OPTIONS.syncPolling },
  );

  await boss.schedule(
    'sienge:sync-deliveries',
    '*/15 * * * *', // Every 15 minutes
    {},
    { singletonKey: 'sienge:sync-deliveries:singleton', ...SEND_OPTIONS.syncPolling },
  );

  await boss.schedule(
    'integration:retry',
    '0 * * * *', // Every hour
    {},
    { singletonKey: 'integration:retry:singleton', ...SEND_OPTIONS.retry },
  );

  await boss.schedule(
    'follow-up',
    '0 11 * * *', // Daily at 08:00 BRT (11:00 UTC)
    {},
    { singletonKey: 'follow-up:singleton', ...SEND_OPTIONS.followUp },
  );

  await boss.schedule(
    'quotation:expire-check',
    '15 11 * * *', // Daily at 08:15 BRT (11:15 UTC)
    {},
    { singletonKey: 'quotation:expire-check:singleton', ...SEND_OPTIONS.quotationExpireCheck },
  );

  await boss.schedule(
    'dashboard:consolidation',
    '45 10 * * *', // Daily at 07:45 BRT (10:45 UTC)
    {},
    { singletonKey: 'dashboard:consolidation:singleton', ...SEND_OPTIONS.followUp },
  );

  console.log('[handlers] All job handlers registered and cron schedules configured.');
}
