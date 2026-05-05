import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  auditEventIdParamSchema,
  auditEventsListQuerySchema,
  type AuditEventIdParamDto,
  type AuditEventsListQueryDto,
} from '@projetog/shared';
import { AuditController } from './audit.controller.js';

/**
 * PRD-09 §7.7–7.8 — operational audit trail (read-only).
 */
export const auditRoutes: FastifyPluginAsync = async (app) => {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const controller = new AuditController();

  typed.addHook('preValidation', app.authenticate);

  typed.get(
    '/',
    {
      schema: { querystring: auditEventsListQuerySchema },
      preValidation: [typed.verifyRole([UserRole.COMPRAS, UserRole.ADMINISTRADOR])],
    },
    async (request, reply) =>
      controller.list(request as FastifyRequest & { query: AuditEventsListQueryDto }, reply),
  );

  typed.get(
    '/:audit_event_id',
    {
      schema: { params: auditEventIdParamSchema },
      preValidation: [typed.verifyRole([UserRole.COMPRAS, UserRole.ADMINISTRADOR])],
    },
    async (request, reply) =>
      controller.getById(request as FastifyRequest & { params: AuditEventIdParamDto }, reply),
  );
};
