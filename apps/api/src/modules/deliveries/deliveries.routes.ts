import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DeliveriesController } from './deliveries.controller.js';
import { UserRole } from '@projetog/domain';

export const deliveriesRoutes: FastifyPluginAsync = async (app) => {
  const controller = new DeliveriesController(app);

  app.addHook('preValidation', app.authenticate);

  app.get(
    '/pending',
    {
      schema: {
        querystring: z.object({
          status: z.string().optional(),
        }),
      },
      preValidation: [app.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS])],
    },
    controller.listPending.bind(controller),
  );

  app.post(
    '/:id/validate',
    {
      schema: {
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          status: z.enum(['OK', 'DIVERGENCIA']),
          notes: z.string().optional(),
        }),
      },
      preValidation: [app.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS])],
    },
    controller.validateDelivery.bind(controller),
  );
};
