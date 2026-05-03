import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  integrationEventIdParamSchema,
  integrationEventsQuerySchema,
  IntegrationEventIdParamDto,
  IntegrationEventsQueryDto,
} from '@projetog/shared';
import { IntegrationController } from './integration.controller.js';

/**
 * PRD-09 §7.5–7.6 — aliases under /api/backoffice/integrations (same handlers as /api/integration/events).
 */
export default async function integrationPrd09Routes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const controller = new IntegrationController();

  app.addHook('preValidation', fastify.authenticate);

  app.get(
    '/',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS, UserRole.ADMINISTRADOR])],
      schema: { querystring: integrationEventsQuerySchema },
    },
    async (request, reply) =>
      controller.listEvents(
        request as typeof request & { query: IntegrationEventsQueryDto },
        reply,
      ),
  );

  app.post(
    '/:id/retry',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS])],
      schema: { params: integrationEventIdParamSchema },
    },
    async (request, reply) =>
      controller.retryEvent(request as typeof request & { params: IntegrationEventIdParamDto }, reply),
  );
}
