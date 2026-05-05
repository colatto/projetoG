import type { Job } from 'pg-boss';
import type { Database } from '@projetog/shared';
import { getSupabase } from '../supabase.js';

export type AuditRetryJobData = Database['public']['Tables']['audit_logs']['Insert'];

const JOB_NAME = 'audit:retry';

/**
 * PRD-09 §9.6 — deferred insert into audit_logs when the API enqueue path fired.
 */
export async function processAuditRetry(job: Job<AuditRetryJobData>): Promise<void> {
  const payload = job.data;

  if (!payload?.event_type) {
    console.error(`[${JOB_NAME}] Missing event_type on job ${job.id}`);
    throw new Error('audit:retry payload missing event_type');
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('audit_logs').insert(payload);

  if (error) {
    console.error(`[${JOB_NAME}] Insert failed for job ${job.id}: ${error.message}`, {
      code: error.code,
      event_type: payload.event_type,
    });
    throw new Error(`audit:retry insert failed: ${error.message}`);
  }

  console.log(`[${JOB_NAME}] Replay persisted`, {
    jobId: job.id,
    event_type: payload.event_type,
  });
}
