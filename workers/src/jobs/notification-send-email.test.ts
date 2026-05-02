import { describe, it, expect, vi } from 'vitest';
import type { Job } from 'pg-boss';
import { processNotificationSendEmail } from './notification-send-email.js';
import type { SendEmailJobData } from './notification-send-email.js';

const { fromMock, resendSendMock } = vi.hoisted(() => ({
  fromMock: vi.fn().mockReturnThis(),
  resendSendMock: vi.fn().mockResolvedValue({ data: { id: 'msg-123' }, error: null }),
}));

vi.mock('../supabase.js', () => ({
  getSupabase: vi.fn(() => ({
    from: fromMock,
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return {
      emails: {
        send: resendSendMock,
      },
    };
  }),
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

    await expect(processNotificationSendEmail(job as Job<SendEmailJobData>)).resolves.not.toThrow();
  });

  it('marks log as failed when provider returns error', async () => {
    resendSendMock.mockResolvedValueOnce({ data: null, error: { message: 'provider down' } });
    const job = {
      id: 'job-id-2',
      name: 'notification:send-email',
      data: {
        notificationLogId: 'log-999',
        recipientEmail: 'test@example.com',
        subject: 'Subject Test',
        htmlBody: '<p>HTML Test</p>',
      },
    };

    await expect(processNotificationSendEmail(job as Job<SendEmailJobData>)).rejects.toThrow(
      'Email sending failed: provider down',
    );
    expect(fromMock).toHaveBeenCalledWith('notification_logs');
    expect(fromMock).toHaveBeenCalledWith('audit_logs');
  });
});
