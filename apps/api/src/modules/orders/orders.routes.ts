import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ordersListQuerySchema } from '@projetog/shared';
import { OrdersController } from './orders.controller.js';
import { UserRole } from '@projetog/domain';

export const ordersRoutes: FastifyPluginAsync = async (app) => {
  const controller = new OrdersController(app);

  app.addHook('preValidation', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        querystring: ordersListQuerySchema,
      },
      preValidation: [
        app.verifyRole([
          UserRole.ADMINISTRADOR,
          UserRole.COMPRAS,
          UserRole.FORNECEDOR,
          UserRole.VISUALIZADOR_PEDIDOS,
        ]),
      ],
    },
    controller.listOrders.bind(controller),
  );

  app.get(
    '/:purchaseOrderId/deliveries',
    {
      schema: {
        params: z.object({
          purchaseOrderId: z.string(),
        }),
      },
      preValidation: [
        app.verifyRole([
          UserRole.ADMINISTRADOR,
          UserRole.COMPRAS,
          UserRole.FORNECEDOR,
          UserRole.VISUALIZADOR_PEDIDOS,
        ]),
      ],
    },
    controller.listOrderDeliveries.bind(controller),
  );

  app.post(
    '/:purchaseOrderId/cancel',
    {
      schema: {
        params: z.object({
          purchaseOrderId: z.string(),
        }),
        body: z.object({
          reason: z.string().min(3),
        }),
      },
      preValidation: [app.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS])],
    },
    controller.cancelOrder.bind(controller),
  );

  app.get(
    '/:purchaseOrderId/status-history',
    {
      schema: {
        params: z.object({
          purchaseOrderId: z.string(),
        }),
      },
      preValidation: [
        app.verifyRole([
          UserRole.ADMINISTRADOR,
          UserRole.COMPRAS,
          UserRole.FORNECEDOR,
          UserRole.VISUALIZADOR_PEDIDOS,
        ]),
      ],
    },
    controller.listStatusHistory.bind(controller),
  );

  app.post(
    '/:purchaseOrderId/avaria',
    {
      schema: {
        params: z.object({
          purchaseOrderId: z.string(),
        }),
        body: z.object({
          status: z.enum(['EM_AVARIA', 'REPOSICAO']),
          reason: z.string().min(3),
        }),
      },
      preValidation: [app.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS])],
    },
    controller.reportAvaria.bind(controller),
  );
};
