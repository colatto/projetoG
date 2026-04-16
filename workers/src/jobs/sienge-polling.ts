/**
 * @deprecated This generic stub has been replaced by specialized sync jobs:
 * - sync-quotations.ts (sienge:sync-quotations)
 * - sync-orders.ts (sienge:sync-orders)
 * - sync-deliveries.ts (sienge:sync-deliveries)
 *
 * This file is kept for backward compatibility with any references.
 * The handler is no longer registered in handlers/index.ts.
 */
import PgBoss from 'pg-boss';

export async function processSiengePolling(job: PgBoss.Job): Promise<void> {
  console.warn(
    `[sienge:polling] DEPRECATED: Generic polling stub invoked. Use specialized sync jobs instead. Job ID: ${job.id}`,
  );
}
