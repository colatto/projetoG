import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { AuditService } from './audit.service.js';

// Mock Supabase client
const mockInsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      admin: {
        inviteUserByEmail: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
        generateLink: vi.fn(),
      },
    },
    from: mockFrom,
  }),
}));

function buildTestApp() {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-for-audit-tests';

  return buildApp();
}

describe('AuditService', () => {
  let app: ReturnType<typeof buildApp>;
  let auditService: AuditService;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildTestApp();
    await app.ready();
    auditService = new AuditService(app);
  });

  it('should persist audit log with event_type, actor_id, target_user_id and metadata', async () => {
    mockFrom.mockReturnValueOnce({
      insert: mockInsert.mockResolvedValueOnce({ error: null }),
    });

    await auditService.log({
      eventType: 'user.created',
      actorId: '00000000-0000-0000-0000-000000000001',
      targetUserId: '00000000-0000-0000-0000-000000000002',
      metadata: { role: 'compras', email: 'compras@grf.com.br' },
    });

    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: 'user.created',
      actor_id: '00000000-0000-0000-0000-000000000001',
      target_user_id: '00000000-0000-0000-0000-000000000002',
      metadata: { role: 'compras', email: 'compras@grf.com.br' },
    });
  });

  it('should persist log with null actor_id for system events', async () => {
    mockFrom.mockReturnValueOnce({
      insert: mockInsert.mockResolvedValueOnce({ error: null }),
    });

    await auditService.log({
      eventType: 'password.reset_requested',
      metadata: { email: 'user@grf.com.br', ip: '127.0.0.1' },
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'password.reset_requested',
        actor_id: null,
        target_user_id: null,
      }),
    );
  });

  it('should NOT propagate errors to avoid breaking main operations (resilience)', async () => {
    mockFrom.mockReturnValueOnce({
      insert: mockInsert.mockResolvedValueOnce({
        error: { message: 'Database connection lost' },
      }),
    });

    // Should not throw — the service swallows the error and logs it
    await expect(
      auditService.log({
        eventType: 'user.login',
        actorId: '00000000-0000-0000-0000-000000000001',
      }),
    ).resolves.toBeUndefined();
  });
});
