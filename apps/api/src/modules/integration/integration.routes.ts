import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { IntegrationController } from './integration.controller.js';
import { UserRole } from '@projetog/domain';
import {
  integrationEventsQuerySchema,
  integrationEventIdParamSchema,
  IntegrationEventIdParamDto,
  IntegrationEventsQueryDto,
  SiengeCredentialsBodyDto,
  WriteNegotiationBodyDto,
} from '@projetog/shared';

/**
 * Integration events routes.
 * Mounted at /api/integration — requires JWT + RBAC.
 *
 * PRD-07 §6.6, §10
 */
export default async function integrationRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const controller = new IntegrationController();

  // All routes require authentication
  app.addHook('preValidation', fastify.authenticate);

  /**
   * GET /api/integration/events
   * Lists integration events with filters and pagination.
   * Accessible to Compras and Administrador.
   */
  app.get(
    '/events',
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

  /**
   * POST /api/integration/events/:id/retry
   * Manually retries a failed integration event.
   * Only accessible to Compras.
   */
  app.post(
    '/events/:id/retry',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS])],
      schema: { params: integrationEventIdParamSchema },
    },
    async (request, reply) =>
      controller.retryEvent(
        request as typeof request & { params: IntegrationEventIdParamDto },
        reply,
      ),
  );

  /**
   * GET /api/integration/credentials
   * Retrieves active Sienge integration credentials.
   */
  app.get(
    '/credentials',
    {
      preValidation: [fastify.verifyRole([UserRole.ADMINISTRADOR])],
    },
    async (request, reply) => controller.getCredentials(request, reply),
  );

  /**
   * PUT /api/integration/credentials
   * Updates and activates new Sienge integration credentials.
   */
  app.put(
    '/credentials',
    {
      preValidation: [fastify.verifyRole([UserRole.ADMINISTRADOR])],
      schema: {
        body: (await import('@projetog/shared')).siengeCredentialsBodySchema,
      },
    },
    async (request, reply) =>
      controller.updateCredentials(
        request as typeof request & { Body: SiengeCredentialsBodyDto },
        reply,
      ),
  );

  /**
   * POST /api/integration/negotiations/write
   * Enqueues an approved negotiation to be written back to Sienge.
   */
  app.post(
    '/negotiations/write',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS])],
      schema: {
        body: (await import('@projetog/shared')).writeNegotiationBodySchema,
      },
    },
    async (request, reply) =>
      controller.writeNegotiation(
        request as typeof request & { Body: WriteNegotiationBodyDto },
        reply,
      ),
  );
}
