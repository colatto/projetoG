import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationEventStatus, IntegrationEventType } from '@projetog/domain';
import { createSupabaseMock } from '../test-utils/supabase.js';
import { createPgBossMock } from '../test-utils/pg-boss.js';

const { supabaseClient, getTableMocks, fromMock } = createSupabaseMock();
const { mocks: bossMocks, ...bossClient } = createPgBossMock();

vi.mock('../supabase.js', () => ({
  getSupabase: () => supabaseClient,
}));

vi.mock('../boss.js', () => ({
  getBoss: () => bossClient,
}));

const { processRetryIntegration } = await import('./retry-integration.js');

describe('processRetryIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTableMocks('integration_events').updateEq.mockResolvedValue({ error: null });
    bossMocks.send.mockResolvedValue('job-id-123');
  });

  it('should skip if no events to retry', async () => {
    getTableMocks('integration_events').selectEqLte.mockResolvedValue({ data: [], error: null });

    await processRetryIntegration({ id: 'job-1' } as never);

    expect(bossMocks.send).not.toHaveBeenCalled();
    expect(getTableMocks('integration_events').updateEq).not.toHaveBeenCalled();
  });

  it('should re-enqueue valid events and update their status', async () => {
    getTableMocks('integration_events').selectEqLte.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          event_type: IntegrationEventType.WRITE_NEGOTIATION,
          status: IntegrationEventStatus.RETRY_SCHEDULED,
          request_payload: { foo: 'bar' },
        },
      ],
      error: null,
    });

    await processRetryIntegration({ id: 'job-2' } as never);

    // Assert boss send
    expect(bossMocks.send).toHaveBeenCalledWith(
      'sienge:outbound-negotiation',
      { foo: 'bar', integrationEventId: 'event-1', actorId: 'system-retry' },
      { retryLimit: 0, expireInHours: 1 }
    );

    // Assert status update
    expect(fromMock).toHaveBeenCalledWith('integration_events');
    expect(getTableMocks('integration_events').updateEq).toHaveBeenCalledWith('id', 'event-1');
  });

  it('should ignore unhandled event types', async () => {
    getTableMocks('integration_events').selectEqLte.mockResolvedValue({
      data: [
        {
          id: 'event-2',
          event_type: 'UNKNOWN_TYPE',
          status: IntegrationEventStatus.RETRY_SCHEDULED,
        },
      ],
      error: null,
    });

    await processRetryIntegration({ id: 'job-3' } as never);

    expect(bossMocks.send).not.toHaveBeenCalled();
    expect(getTableMocks('integration_events').updateEq).not.toHaveBeenCalled();
  });

  it('should handle enqueue errors without crashing the whole job', async () => {
    getTableMocks('integration_events').selectEqLte.mockResolvedValue({
      data: [
        {
          id: 'event-3',
          event_type: IntegrationEventType.WRITE_NEGOTIATION,
          status: IntegrationEventStatus.RETRY_SCHEDULED,
        },
        {
          id: 'event-4',
          event_type: IntegrationEventType.AUTHORIZE_NEGOTIATION,
          status: IntegrationEventStatus.RETRY_SCHEDULED,
        },
      ],
      error: null,
    });

    // Make the first one fail
    bossMocks.send.mockRejectedValueOnce(new Error('Queue Error'));
    bossMocks.send.mockResolvedValueOnce('job-id-456');

    await processRetryIntegration({ id: 'job-4' } as never);

    expect(bossMocks.send).toHaveBeenCalledTimes(2);
    
    // Only the successful one should be updated
    expect(getTableMocks('integration_events').updateEq).toHaveBeenCalledTimes(1);
    expect(getTableMocks('integration_events').updateEq).toHaveBeenCalledWith('id', 'event-4');
  });
});
