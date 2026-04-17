import PgBoss from 'pg-boss';
import { IntegrationEventStatus, IntegrationEventType } from '@projetog/domain';
import { getSupabase } from '../supabase.js';
import { getBoss } from '../boss.js';

const JOB_NAME = 'integration:retry';

export async function processRetryIntegration(job: PgBoss.Job) {
  const correlationId = job.id;
  const supabase = getSupabase();
  const boss = getBoss();

  console.log(`[${JOB_NAME}] Starting integration retry check. CorrelationId: ${correlationId}`);

  const { data: events, error } = await supabase
    .from('integration_events')
    .select('*')
    .eq('status', IntegrationEventStatus.RETRY_SCHEDULED)
    .lte('next_retry_at', new Date().toISOString());

  if (error) {
    console.error(`[${JOB_NAME}] Error fetching retry_scheduled events: ${error.message}`);
    return;
  }

  if (!events || events.length === 0) {
    return;
  }

  console.log(`[${JOB_NAME}] Found ${events.length} events to retry.`);

  for (const event of events) {
    let targetJob = '';
    let payload = (event.request_payload as Record<string, unknown>) || {};

    switch (event.event_type) {
      case IntegrationEventType.WRITE_NEGOTIATION:
      case IntegrationEventType.AUTHORIZE_NEGOTIATION:
        targetJob = 'sienge:outbound-negotiation';
        payload = {
          ...payload,
          integrationEventId: event.id,
          actorId: 'system-retry',
        };
        break;
      // Outros jobs (por exemplo webhooks) podem ser mapeados aqui
      default:
        console.warn(`[${JOB_NAME}] Unhandled retry event_type: ${event.event_type}`);
        continue;
    }

    try {
      await boss.send(targetJob, payload, {
        retryLimit: 0,
        expireInHours: 1,
      });

      await supabase
        .from('integration_events')
        .update({
          status: IntegrationEventStatus.PENDING,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      console.log(`[${JOB_NAME}] Successfully retried event ${event.id} -> ${targetJob}`);
    } catch (enqueueError) {
      console.error(`[${JOB_NAME}] Failed to re-enqueue event ${event.id}:`, enqueueError);
    }
  }
}
