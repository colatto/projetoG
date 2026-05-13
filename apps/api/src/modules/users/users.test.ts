import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import { UserRole, UserStatus } from '@projetog/domain';

// Mock Supabase client
const mockFrom = vi.fn();
const mockInviteUserByEmail = vi.fn();
const mockAuthAdminUpdateUser = vi.fn();
const mockAuthAdminDeleteUser = vi.fn();
const mockAuthAdminGenerateLink = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      admin: {
        inviteUserByEmail: mockInviteUserByEmail,
        updateUserById: mockAuthAdminUpdateUser,
        deleteUser: mockAuthAdminDeleteUser,
        generateLink: mockAuthAdminGenerateLink,
      },
    },
    from: mockFrom,
  }),
}));

function buildTestApp() {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-for-users-tests';
  process.env.FRONTEND_URL = 'https://grf.ruatrez.com';

  return buildApp();
}

// Helper: generate a valid Admin JWT
async function getAdminToken(app: ReturnType<typeof buildApp>) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000099',
    email: 'admin@grf.com.br',
    name: 'Admin GRF',
    role: UserRole.ADMINISTRADOR,
    status: UserStatus.ATIVO,
  });
}

// Helper: generate a Compras JWT (non-admin)
async function getComprasToken(app: ReturnType<typeof buildApp>) {
  return app.jwt.sign({
    sub: '00000000-0000-0000-0000-000000000088',
    email: 'compras@grf.com.br',
    name: 'Compras GRF',
    role: UserRole.COMPRAS,
    status: UserStatus.ATIVO,
  });
}

// Mock helper for chainable Supabase queries
function mockSupabaseQuery(data: unknown, error: unknown = null, count?: number) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data, error });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  // For list queries with count
  chain.then = undefined;
  if (count !== undefined) {
    // Override for paginated queries — return data+count when awaited
    chain.order = vi.fn().mockReturnValue({
      ...chain,
      then: (resolve: (val: unknown) => void) => resolve({ data, count, error }),
    });
  }
  return chain;
}

describe('Users Routes — RBAC & Lifecycle', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── RBAC ─────────────────────────────────────────────────────────

  describe('RBAC enforcement', () => {
    it('should return 401 without authentication token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for Compras role on admin-only endpoints', async () => {
      const token = await getComprasToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ── POST /api/users (create) ────────────────────────────────────

  describe('POST /api/users', () => {
    it('should create an internal user and return 201', async () => {
      const token = await getAdminToken(app);
      const newUserId = '00000000-0000-0000-0000-000000000010';

      // Check email conflict — return null (no conflict)
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // inviteUserByEmail
      mockInviteUserByEmail.mockResolvedValueOnce({
        data: { user: { id: newUserId } },
        error: null,
      });

      // Profile insert
      const createdProfile = {
        id: newUserId,
        email: 'compras-new@grf.com.br',
        name: 'Compras New',
        role: UserRole.COMPRAS,
        status: UserStatus.PENDENTE,
        supplier_id: null,
      };
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(createdProfile));

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Compras New',
          email: 'compras-new@grf.com.br',
          role: UserRole.COMPRAS,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data).toHaveProperty('id', newUserId);
      expect(body.data).toHaveProperty('role', UserRole.COMPRAS);
      expect(mockInviteUserByEmail).toHaveBeenCalledWith('compras-new@grf.com.br', {
        redirectTo: 'https://grf.ruatrez.com/reset-password',
      });
    });

    it('should return 400 for duplicate email', async () => {
      const token = await getAdminToken(app);

      // Check email conflict — return existing user
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({ id: '00000000-0000-0000-0000-000000000011' }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Duplicate',
          email: 'existing@grf.com.br',
          role: UserRole.COMPRAS,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('E-mail');
    });

    it('should return 400 for fornecedor without supplier_id', async () => {
      const token = await getAdminToken(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Fornecedor Test',
          email: 'fornecedor@test.com',
          role: UserRole.FORNECEDOR,
          // supplier_id intentionally missing
        },
      });

      // Zod validation catches this before controller
      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for duplicate supplier_id among fornecedores', async () => {
      const token = await getAdminToken(app);

      // Check email conflict — no conflict
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // Check supplier_id conflict — existing fornecedor found
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({ id: '00000000-0000-0000-0000-000000000012' }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Fornecedor Dup',
          email: 'fornecedor-dup@test.com',
          role: UserRole.FORNECEDOR,
          supplier_id: 12345,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('Fornecedor');
    });

    it('should return 500 and cleanup auth user when profile insert returns null (RLS block)', async () => {
      const token = await getAdminToken(app);
      const newUserId = '00000000-0000-0000-0000-000000000013';

      // Check email conflict — no conflict
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // inviteUserByEmail
      mockInviteUserByEmail.mockResolvedValueOnce({
        data: { user: { id: newUserId } },
        error: null,
      });

      // Profile insert — returns null data (simulating silent RLS block)
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // Auth cleanup (deleteUser) after failed profile insert
      mockAuthAdminDeleteUser.mockResolvedValueOnce({ error: null });

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Ghost User',
          email: 'ghost@grf.com.br',
          role: UserRole.COMPRAS,
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().message).toContain('dados não persistidos');
      // Verify cleanup: auth user should be deleted to avoid orphan
      expect(mockAuthAdminDeleteUser).toHaveBeenCalledWith(newUserId);
    });

    it('should return 500 and cleanup auth user when profile insert fails with error', async () => {
      const token = await getAdminToken(app);
      const newUserId = '00000000-0000-0000-0000-000000000014';

      // Check email conflict — no conflict
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // inviteUserByEmail
      mockInviteUserByEmail.mockResolvedValueOnce({
        data: { user: { id: newUserId } },
        error: null,
      });

      // Profile insert — returns database error
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null, { message: 'FK violation' }));

      // Auth cleanup (deleteUser) after failed profile insert
      mockAuthAdminDeleteUser.mockResolvedValueOnce({ error: null });

      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Error User',
          email: 'error@grf.com.br',
          role: UserRole.COMPRAS,
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json().message).toContain('Erro ao registrar perfil local');
      expect(mockAuthAdminDeleteUser).toHaveBeenCalledWith(newUserId);
    });
  });

  // ── GET /api/users/:id ──────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('should return 404 for non-existent user', async () => {
      const token = await getAdminToken(app);

      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null, { message: 'Not found' }));

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/00000000-0000-0000-0000-000000000099',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/users/:id ────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    it('should update user name and return updated data', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000020';

      // Fetch existing user
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          name: 'Old Name',
          email: 'user@grf.com.br',
          role: UserRole.COMPRAS,
          status: UserStatus.ATIVO,
          original_email: null,
        }),
      );

      // Update profile
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          name: 'New Name',
          email: 'user@grf.com.br',
          role: UserRole.COMPRAS,
          status: UserStatus.ATIVO,
        }),
      );

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/users/${userId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveProperty('name', 'New Name');
    });

    it('should preserve original_email when changing fornecedor email', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000021';

      // Fetch existing user — fornecedor with no previous email change
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          name: 'Fornecedor',
          email: 'original@supplier.com',
          role: UserRole.FORNECEDOR,
          status: UserStatus.ATIVO,
          original_email: null,
        }),
      );

      // Check email uniqueness — no conflict
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // Auth update email
      mockAuthAdminUpdateUser.mockResolvedValueOnce({ error: null });

      // Update profile — returned data should include original_email
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          name: 'Fornecedor',
          email: 'new@supplier.com',
          original_email: 'original@supplier.com',
          role: UserRole.FORNECEDOR,
          status: UserStatus.ATIVO,
        }),
      );

      // AuditService insert mocks (email_changed + edited)
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/users/${userId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'new@supplier.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveProperty('original_email', 'original@supplier.com');
    });
  });

  // ── POST /api/users/:id/block ───────────────────────────────────

  describe('POST /api/users/:id/block', () => {
    it('should block an active user', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000030';

      // Fetch user status
      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.ATIVO }));

      // Update to blocked
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          status: UserStatus.BLOQUEADO,
          blocked_at: new Date().toISOString(),
        }),
      );

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/block`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveProperty('status', UserStatus.BLOQUEADO);
    });

    it('should return 409 when user is already blocked', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000031';

      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.BLOQUEADO }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/block`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  // ── POST /api/users/:id/reactivate ──────────────────────────────

  describe('POST /api/users/:id/reactivate', () => {
    it('should reactivate a blocked user', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000040';

      // Fetch user status
      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.BLOQUEADO }));

      // Update to ativo
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({
          id: userId,
          status: UserStatus.ATIVO,
          blocked_at: null,
          blocked_by: null,
        }),
      );

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/reactivate`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toHaveProperty('status', UserStatus.ATIVO);
    });

    it('should return 409 when user is not blocked', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000041';

      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.ATIVO }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/reactivate`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  // ── DELETE /api/users/:id ───────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('should soft-delete user (set status to removido)', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000050';

      // Fetch user status
      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.ATIVO }));

      // Auth delete
      mockAuthAdminDeleteUser.mockResolvedValueOnce({ error: null });

      // Update status
      mockFrom.mockReturnValueOnce(mockSupabaseQuery(null));

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/${userId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });

    it('should return 409 for already removed user', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000051';

      mockFrom.mockReturnValueOnce(mockSupabaseQuery({ status: UserStatus.REMOVIDO }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/users/${userId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  // ── POST /api/users/:id/reset-password (admin) ─────────────────

  describe('POST /api/users/:id/reset-password', () => {
    it('should send reset link for active user', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000060';

      // Fetch user
      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({ email: 'target@grf.com.br', status: UserStatus.ATIVO }),
      );

      // Generate recovery link
      mockAuthAdminGenerateLink.mockResolvedValueOnce({ error: null });

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/reset-password`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
      expect(mockAuthAdminGenerateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email: 'target@grf.com.br',
        options: {
          redirectTo: 'https://grf.ruatrez.com/reset-password',
        },
      });
    });

    it('should return 403 for removed user', async () => {
      const token = await getAdminToken(app);
      const userId = '00000000-0000-0000-0000-000000000061';

      mockFrom.mockReturnValueOnce(
        mockSupabaseQuery({ email: 'removed@grf.com.br', status: UserStatus.REMOVIDO }),
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/users/${userId}/reset-password`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
