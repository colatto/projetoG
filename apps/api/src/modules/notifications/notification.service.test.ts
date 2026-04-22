import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { NotificationService } from './notification.service.js';
import { NotificationType } from '@projetog/domain';

function mockSupabaseQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.then = (resolve: (val: unknown) => void) => resolve({ data, error });
  return chain;
}

describe('NotificationService', () => {
  let service: NotificationService;
  let mockFastify: any;
  let mockFrom: any;

  beforeEach(() => {
    mockFrom = vi.fn((table: string) => {
      // Default behavior
      return mockSupabaseQuery(null);
    });

    mockFastify = {
      supabase: {
        from: mockFrom,
      },
      boss: {
        send: vi.fn(),
      },
      log: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    };
    service = new NotificationService(mockFastify as unknown as FastifyInstance);
  });

  it('should skip if template is not found', async () => {
    vi.spyOn(service, 'getActiveTemplate').mockResolvedValueOnce(null);

    await service.sendQuotationNotification(1, [100], 'actor-id');

    expect(mockFastify.log.error).toHaveBeenCalledWith('Template new_quotation not found');
  });

  it('should log FAILED if supplier has no email', async () => {
    vi.spyOn(service, 'getActiveTemplate').mockResolvedValueOnce({
      id: 'tpl-id',
      version: 1,
      subject_template: 'Test',
      body_template: 'Test',
      mandatory_placeholders: [],
      type: NotificationType.NEW_QUOTATION,
    } as any);

    // Mock getSupplierEmail to return null
    vi.spyOn(service, 'getSupplierEmail').mockResolvedValueOnce(null);

    // Mock insert log (for the FAILED insert, it doesn't chain select().single())
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_logs') {
        const chain: any = {};
        chain.insert = vi.fn().mockResolvedValue({ error: null });
        return chain;
      }
      return mockSupabaseQuery(null);
    });

    await service.sendQuotationNotification(1, [100], 'actor-id');

    expect(mockFastify.boss.send).not.toHaveBeenCalled();
    // Verify FAILED log was inserted
    expect(mockFrom).toHaveBeenCalledWith('notification_logs');
  });

  it('should successfully enqueue notification when all validations pass', async () => {
    vi.spyOn(service, 'getActiveTemplate').mockResolvedValueOnce({
      id: 'tpl-id',
      version: 1,
      subject_template: 'Test {{quotationId}}',
      body_template: 'Test {{quotationId}}',
      mandatory_placeholders: ['quotationId'],
      type: NotificationType.NEW_QUOTATION,
    } as any);

    // Mock getSupplierEmail helper
    vi.spyOn(service, 'getSupplierEmail').mockResolvedValueOnce('test@example.com');

    // Mock insert log (which calls .select('id').single())
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_logs') {
        return mockSupabaseQuery({ id: 'log-id' });
      }
      return mockSupabaseQuery(null);
    });

    await service.sendQuotationNotification(1, [100], 'actor-id');

    expect(mockFastify.boss.send).toHaveBeenCalledWith('notification:send-email', {
      notificationLogId: 'log-id',
      recipientEmail: 'test@example.com',
      subject: 'Test 1',
      htmlBody: 'Test 1',
    }, expect.any(Object));
  });
});
