/**
 * Test helpers for API integration tests using fastify.inject().
 *
 * Provides a Fastify app instance with:
 * - Mocked Supabase (chainable from() calls)
 * - Real auth plugin with known JWT secret
 * - pg-boss stub
 * - All quotation routes registered
 */
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { vi } from 'vitest';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import quotationsBackofficeRoutes from '../modules/quotations/quotations.backoffice.routes.js';
import supplierQuotationsRoutes from '../modules/quotations/quotations.supplier.routes.js';

export const TEST_JWT_SECRET = 'test-secret-for-vitest';

// ─── Supabase Mock ───────────────────────────────────────────

type ChainReturn = Record<string, ReturnType<typeof vi.fn>>;

/**
 * Creates a deeply chainable supabase mock.
 * Every method returns `this` (the chain object) so that
 * .select().eq().eq().single() etc. all work.
 */
export function createSupabaseChainMock() {
  const tables = new Map<string, ChainReturn>();

  function getChain(table: string): ChainReturn {
    if (tables.has(table)) return tables.get(table)!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};

    // Default response when the chain is awaited
    let _resolveValue: unknown = { data: [], error: null, count: 0 };

    // Every method returns the chain itself for chaining
    const methods = [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'neq',
      'in',
      'is',
      'not',
      'or',
      'order',
      'limit',
      'range',
      'single',
      'maybeSingle',
      'lte',
      'gte',
      'lt',
      'gt',
      'like',
      'ilike',
      'filter',
      'match',
      'contains',
      'containedBy',
      'textSearch',
      'csv',
    ];

    for (const method of methods) {
      chain[method] = vi.fn(() => chain);
    }

    // Make the chain thenable (Supabase's PostgREST builder is a PromiseLike)
    chain.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      return Promise.resolve(_resolveValue).then(onFulfilled, onRejected);
    };

    /**
     * Configure what `await chain` returns.
     * Call this to set up mock responses for queries that end without .single().
     */
    chain._mockResolvedValue = (value: unknown) => {
      _resolveValue = value;
    };

    // .single() should resolve to { data, error } — override thenable for that call
    const originalSingle = chain.single;
    chain.single = vi.fn((...args: unknown[]) => {
      const result = originalSingle(...args);
      // If single was given a mockResolvedValueOnce, it returns a promise
      // Otherwise return the chain (which is thenable)
      return result;
    });
    chain.single.mockResolvedValue({ data: null, error: null });

    tables.set(table, chain);
    return chain;
  }

  const fromFn = vi.fn((table: string) => getChain(table));

  const rpcFn = vi.fn().mockResolvedValue({ data: null, error: null });

  const client = {
    from: fromFn,
    rpc: rpcFn,
  };

  return {
    client,
    fromFn,
    rpcFn,
    /** Get the chain mock for a specific table to configure responses */
    table: (name: string) => getChain(name),
    /** Reset all table mocks */
    reset: () => tables.clear(),
  };
}

// ─── Token Generation ────────────────────────────────────────

export interface TestTokenPayload {
  sub?: string;
  email?: string;
  role?: UserRole;
  name?: string;
  supplier_id?: number;
}

export async function generateTestToken(
  app: FastifyInstance,
  payload: TestTokenPayload = {},
): Promise<string> {
  return app.jwt.sign({
    sub: payload.sub ?? 'test-user-id',
    email: payload.email ?? 'test@test.com',
    name: payload.name ?? 'Test User',
    role: payload.role ?? UserRole.COMPRAS,
    app_metadata: { role: payload.role ?? UserRole.COMPRAS },
  });
}

// ─── App Builder ─────────────────────────────────────────────

export interface TestAppContext {
  app: FastifyInstance;
  supabase: ReturnType<typeof createSupabaseChainMock>;
  bossMock: { send: ReturnType<typeof vi.fn> };
}

export async function buildTestApp(): Promise<TestAppContext> {
  const supabase = createSupabaseChainMock();
  const bossMock = { send: vi.fn().mockResolvedValue('job-id-1') };

  const app = Fastify({ logger: false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(sensible);

  // JWT
  app.register(fastifyJwt, {
    secret: TEST_JWT_SECRET,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  // Auth decorators
  app.decorate('authenticate', async function (request: import('fastify').FastifyRequest) {
    await request.jwtVerify();
  });

  app.decorate('verifyRole', function (allowedRoles: UserRole[]) {
    return async function (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply,
    ) {
      await request.jwtVerify();
      const role = request.user.role || (request.user.app_metadata?.role as UserRole);
      if (!role || !allowedRoles.includes(role)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    };
  });

  // Supabase mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('supabase', supabase.client as any);

  // pg-boss mock
  app.decorate('boss', bossMock);

  // Quotation routes (static imports)
  app.register(quotationsBackofficeRoutes, { prefix: '/api/quotations' });
  app.register(supplierQuotationsRoutes, { prefix: '/api/supplier/quotations' });

  // Deliveries and orders (lazy load for test so we don't need imports up top if not needed)
  app.register((await import('../modules/deliveries/index.js')).deliveriesRoutes, {
    prefix: '/api/deliveries',
  });
  app.register((await import('../modules/orders/index.js')).ordersRoutes, {
    prefix: '/api/orders',
  });
  app.register((await import('../modules/damages/index.js')).damagesRoutes, {
    prefix: '/api/damages',
  });

  await app.ready();

  return { app, supabase, bossMock };
}
