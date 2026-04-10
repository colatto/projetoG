import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole, UserStatus } from '@projetog/domain';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyRole: (allowedRoles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      email: string;
      role?: UserRole;
      status?: UserStatus;
      app_metadata?: any;
      user_metadata?: any;
    };
  }
}

export interface AuthPluginOptions {
  jwtSecret: string;
}

export const authPlugin = fp<AuthPluginOptions>(async (fastify, opts) => {
  if (!opts.jwtSecret) {
    throw new Error('JWT Secret is required');
  }

  fastify.register(fastifyJwt, {
    secret: opts.jwtSecret,
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
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
        await request.jwtVerify();
        const role = request.user.role || request.user.app_metadata?.role as UserRole;
        
        if (!role || !allowedRoles.includes(role)) {
          reply.code(403).send({ error: 'Forbidden', message: 'Você não tem permissão para esta operação' });
        }
      } catch (err) {
        reply.send(err);
      }
    };
  });
});
