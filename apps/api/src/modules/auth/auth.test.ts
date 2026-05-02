import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import { UserRole, UserStatus } from '@projetog/domain';

// Mock Supabase client responses
const mockSignInWithPassword = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockVerifyOtp = vi.fn();
const mockUpdateUserById = vi.fn();
const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
      verifyOtp: mockVerifyOtp,
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
    from: mockFrom,
  }),
}));

function buildTestApp() {
  // Ensure env vars needed by plugins are set for test
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';

  return buildApp();
}

// Helper: generate a valid JWT for authenticated requests
async function getAuthToken(
  app: ReturnType<typeof buildApp>,
  overrides?: Partial<{
    sub: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
  }>,
) {
  const payload = {
    sub: overrides?.sub ?? '00000000-0000-0000-0000-000000000001',
    email: overrides?.email ?? 'admin@grf.com.br',
    name: overrides?.name ?? 'Admin GRF',
    role: overrides?.role ?? UserRole.ADMINISTRADOR,
    status: overrides?.status ?? UserStatus.ATIVO,
  };
  return app.jwt.sign(payload);
}

describe('Auth Routes', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── POST /api/auth/login ────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should return 200, user data and token on valid credentials', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';

      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: 'admin@grf.com.br' },
          session: { access_token: 'supabase-token' },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: userId,
                  name: 'Admin GRF',
                  role: UserRole.ADMINISTRADOR,
                  status: UserStatus.ATIVO,
                  supplier_id: null,
                },
                error: null,
              }),
          }),
        }),
      });

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'admin@grf.com.br', password: 'password123' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user).toHaveProperty('id', userId);
      expect(body.user).toHaveProperty('email', 'admin@grf.com.br');
      expect(body.user).toHaveProperty('name', 'Admin GRF');
      expect(body.user).toHaveProperty('role', UserRole.ADMINISTRADOR);
      expect(body.session).toHaveProperty('access_token');
    });

    it('should allow GET /api/auth/me with JWT returned from login (auth chain)', async () => {
      const userId = '00000000-0000-0000-0000-000000000042';

      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: 'chain@grf.com.br' },
          session: { access_token: 'supabase-token' },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: userId,
                  name: 'Chain User',
                  role: UserRole.COMPRAS,
                  status: UserStatus.ATIVO,
                  supplier_id: null,
                },
                error: null,
              }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'chain@grf.com.br', password: 'password123' },
      });

      expect(loginRes.statusCode).toBe(200);
      const token = loginRes.json().session.access_token as string;
      expect(token).toBeTruthy();

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(meRes.statusCode).toBe(200);
      const meBody = meRes.json();
      expect(meBody.data).toMatchObject({
        id: userId,
        email: 'chain@grf.com.br',
        name: 'Chain User',
        role: UserRole.COMPRAS,
        status: UserStatus.ATIVO,
      });
    });

    it('should return 401 on invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      // AuditService insert mock for login_failed
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'wrong@grf.com.br', password: 'wrong' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 when user status is bloqueado', async () => {
      const userId = '00000000-0000-0000-0000-000000000002';

      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: userId, email: 'blocked@grf.com.br' },
          session: { access_token: 'supabase-token' },
        },
        error: null,
      });

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: userId,
                  name: 'Blocked User',
                  role: UserRole.COMPRAS,
                  status: UserStatus.BLOQUEADO,
                  supplier_id: null,
                },
                error: null,
              }),
          }),
        }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'blocked@grf.com.br', password: 'password123' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ── POST /api/auth/logout ───────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('should return success with a valid token', async () => {
      const token = await getAuthToken(app);

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── POST /api/auth/forgot-password ──────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('should always return success to not reveal email existence', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'any@grf.com.br' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });

    it('should still return success even if Supabase errors (security)', async () => {
      mockResetPasswordForEmail.mockResolvedValueOnce({
        error: { message: 'User not found' },
      });

      // AuditService insert mock
      mockFrom.mockReturnValueOnce({
        insert: () => Promise.resolve({ error: null }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'nonexistent@grf.com.br' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });
    });
  });

  // ── POST /api/auth/reset-password ─────────────────────────────────

  describe('POST /api/auth/reset-password', () => {
    it('should return 400 with invalid or expired token', async () => {
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Token expired' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'expired-token', new_password: 'newpassword123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('should return full user profile including name', async () => {
      const token = await getAuthToken(app, {
        sub: '00000000-0000-0000-0000-000000000001',
        email: 'admin@grf.com.br',
        name: 'Admin GRF',
        role: UserRole.ADMINISTRADOR,
        status: UserStatus.ATIVO,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveProperty('id', '00000000-0000-0000-0000-000000000001');
      expect(body.data).toHaveProperty('email', 'admin@grf.com.br');
      expect(body.data).toHaveProperty('name', 'Admin GRF');
      expect(body.data).toHaveProperty('role', UserRole.ADMINISTRADOR);
      expect(body.data).toHaveProperty('status', UserStatus.ATIVO);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 when user status is bloqueado', async () => {
      const token = await getAuthToken(app, {
        status: UserStatus.BLOQUEADO,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
