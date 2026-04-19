import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, UserStatus } from '@projetog/domain';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyRole: (
      allowedRoles: UserRole[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
      name?: string;
      role?: UserRole;
      status?: UserStatus;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    };
  }
}

export interface AuthPluginOptions {
  jwtSecret: string;
}

const SUPPORTED_CRIT_HEADERS = new Set(['b64']);

function hasUnsupportedCriticalHeaders(token: string, fastify: FastifyRequest['server']): boolean {
  const decoded = fastify.jwt.decode<{ header?: Record<string, unknown> }>(token, {
    complete: true,
  });
  const header = decoded && typeof decoded === 'object' ? decoded.header : undefined;
  const crit = header?.crit;

  if (!Array.isArray(crit)) {
    return false;
  }

  return crit.some((entry) => typeof entry !== 'string' || !SUPPORTED_CRIT_HEADERS.has(entry));
}

export const authPlugin = fp<AuthPluginOptions>(async (fastify, opts) => {
  if (!opts.jwtSecret) {
    throw new Error('JWT Secret is required');
  }

  fastify.register(fastifyJwt, {
    secret: opts.jwtSecret,
    sign: {
      algorithm: 'HS256',
    },
    verify: {
      algorithms: ['HS256'],
    },
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.server.jwt.lookupToken(request);
      if (token && hasUnsupportedCriticalHeaders(token, request.server)) {
        reply
          .code(401)
          .send({ error: 'Unauthorized', message: 'JWT com cabeçalho crítico não suportado' });
        return;
      }

      await request.jwtVerify();

      // Validação de status ativo
      const userStatus = request.user.status || request.user.app_metadata?.status;
      if (userStatus && userStatus !== UserStatus.ATIVO) {
        reply.code(403).send({ error: 'Forbidden', message: 'Acesso bloqueado ou inativo' });
      }
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('verifyRole', function (allowedRoles: UserRole[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const token = request.server.jwt.lookupToken(request);
        if (token && hasUnsupportedCriticalHeaders(token, request.server)) {
          reply
            .code(401)
            .send({ error: 'Unauthorized', message: 'JWT com cabeçalho crítico não suportado' });
          return;
        }

        await request.jwtVerify();
        const role = request.user.role || (request.user.app_metadata?.role as UserRole);

        if (!role || !allowedRoles.includes(role)) {
          reply
            .code(403)
            .send({ error: 'Forbidden', message: 'Você não tem permissão para esta operação' });
        }
      } catch (err) {
        reply.send(err);
      }
    };
  });
});
