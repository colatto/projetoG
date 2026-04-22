import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  notificationLogsQuerySchema,
  notificationTemplateIdParamSchema,
  notificationTemplateUpdateBodySchema,
} from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsController } from './notifications.controller.js';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const audit = new AuditService(fastify);
  const controller = new NotificationsController(audit);

  app.addHook('preValidation', fastify.authenticate);
  // Both Compras and Admin can see and manage notifications
  app.addHook('preValidation', fastify.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS]));

  app.get(
    '/logs',
    { schema: { querystring: notificationLogsQuerySchema } },
    controller.listLogs.bind(controller),
  );

  app.get('/templates', controller.listTemplates.bind(controller));

  app.put(
    '/templates/:id',
    {
      schema: {
        params: notificationTemplateIdParamSchema,
        body: notificationTemplateUpdateBodySchema,
      },
    },
    controller.updateTemplate.bind(controller),
  );
}
