import { describe, it, expect, vi } from 'vitest';
import { processNotificationSendEmail } from './notification-send-email.js';

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null }),
    },
  })),
}));

describe('processNotificationSendEmail', () => {
  it('should successfully send an email', async () => {
    const job = {
      id: 'job-id',
      name: 'notification:send-email',
      data: {
        notificationLogId: 'log-123',
        recipientEmail: 'test@example.com',
        subject: 'Subject Test',
        htmlBody: '<p>HTML Test</p>',
      },
    };

    await expect(processNotificationSendEmail(job as any)).resolves.not.toThrow();
  });
});
