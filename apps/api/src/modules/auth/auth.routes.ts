import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AuthController } from './auth.controller.js';
import { AuditService } from '../audit/audit.service.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@projetog/shared';

export default async function authRoutes(fastify: FastifyInstance) {
  // Use zod type provider
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  const auditService = new AuditService(fastify);
  const controller = new AuthController(auditService);

  app.post(
    '/login',
    {
      schema: {
        body: loginSchema,
      },
    },
    controller.login.bind(controller),
  );

  app.post(
    '/logout',
    {
      preValidation: [fastify.authenticate],
    },
    controller.logout.bind(controller),
  );

  app.post(
    '/forgot-password',
    {
      schema: {
        body: forgotPasswordSchema,
      },
    },
    controller.forgotPassword.bind(controller),
  );

  app.post(
    '/reset-password',
    {
      schema: {
        body: resetPasswordSchema,
      },
    },
    controller.resetPassword.bind(controller),
  );

  app.get(
    '/me',
    {
      preValidation: [fastify.authenticate],
    },
    controller.me.bind(controller),
  );
}
