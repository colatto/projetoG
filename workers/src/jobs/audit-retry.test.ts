import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'pg-boss';
import { processAuditRetry, type AuditRetryJobData } from './audit-retry.js';

const insertMock = vi.fn();

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}));

function makeJob(data: AuditRetryJobData): Job<AuditRetryJobData> {
  return {
    id: 'audit-retry-job-1',
    name: 'audit:retry',
    data,
  } as Job<AuditRetryJobData>;
}

describe('processAuditRetry', () => {
  beforeEach(() => {
    insertMock.mockReset();
  });

  it('inserts audit row from job payload', async () => {
    insertMock.mockResolvedValueOnce({ error: null });

    const payload: AuditRetryJobData = {
      event_type: 'dashboard.access',
      summary: 'Test summary',
      actor_type: 'user',
      event_timestamp: new Date().toISOString(),
      metadata: {},
    };

    await expect(processAuditRetry(makeJob(payload))).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalledWith(payload);
  });

  it('throws when Supabase insert fails so pg-boss can retry', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'connection reset', code: 'XX000' } });

    const payload: AuditRetryJobData = {
      event_type: 'orders.cancel',
      summary: 'Cancel',
      actor_type: 'user',
      event_timestamp: new Date().toISOString(),
    };

    await expect(processAuditRetry(makeJob(payload))).rejects.toThrow(
      'audit:retry insert failed: connection reset',
    );
  });

  it('throws when event_type is missing', async () => {
    await expect(processAuditRetry(makeJob({} as AuditRetryJobData))).rejects.toThrow(
      'audit:retry payload missing event_type',
    );
    expect(insertMock).not.toHaveBeenCalled();
  });
});
