import { vi } from 'vitest';

export function createPgBossMock() {
  const bossSendMock = vi.fn().mockResolvedValue('job-id-123');
  const bossWorkMock = vi.fn().mockResolvedValue(undefined);
  const bossCompleteMock = vi.fn().mockResolvedValue(undefined);
  const bossFailMock = vi.fn().mockResolvedValue(undefined);

  return {
    send: bossSendMock,
    work: bossWorkMock,
    complete: bossCompleteMock,
    fail: bossFailMock,
    mocks: {
      send: bossSendMock,
      work: bossWorkMock,
      complete: bossCompleteMock,
      fail: bossFailMock,
    },
  };
}
