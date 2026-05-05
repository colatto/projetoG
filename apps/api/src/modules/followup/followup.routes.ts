import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  dateChangeParamsSchema,
  dateDecisionBodySchema,
  followupOrdersQuerySchema,
  followupPurchaseOrderParamsSchema,
  suggestDateBodySchema,
} from '@projetog/shared';
import { FollowupController } from './followup.controller.js';

export const followupRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const controller = new FollowupController(app);
  typedApp.addHook('preValidation', app.authenticate);

  typedApp.get(
    '/orders',
    {
      schema: { querystring: followupOrdersQuerySchema },
      preValidation: [
        typedApp.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS, UserRole.FORNECEDOR]),
      ],
    },
    controller.listOrders.bind(controller),
  );

  typedApp.get(
    '/orders/:purchaseOrderId',
    {
      schema: { params: followupPurchaseOrderParamsSchema },
      preValidation: [
        typedApp.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS, UserRole.FORNECEDOR]),
      ],
    },
    controller.getOrderDetail.bind(controller),
  );

  typedApp.post(
    '/orders/:purchaseOrderId/confirm',
    {
      schema: { params: followupPurchaseOrderParamsSchema },
      preValidation: [typedApp.verifyRole([UserRole.FORNECEDOR])],
    },
    controller.confirmOnTime.bind(controller),
  );

  typedApp.post(
    '/orders/:purchaseOrderId/suggest-date',
    {
      schema: { params: followupPurchaseOrderParamsSchema, body: suggestDateBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.FORNECEDOR])],
    },
    controller.suggestDate.bind(controller),
  );

  typedApp.post(
    '/date-changes/:dateChangeId/approve',
    {
      schema: { params: dateChangeParamsSchema, body: dateDecisionBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.COMPRAS])],
    },
    controller.approveDate.bind(controller),
  );

  typedApp.post(
    '/date-changes/:dateChangeId/reject',
    {
      schema: { params: dateChangeParamsSchema, body: dateDecisionBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.COMPRAS])],
    },
    controller.rejectDate.bind(controller),
  );

  typedApp.get(
    '/orders/:purchaseOrderId/notifications',
    {
      schema: { params: followupPurchaseOrderParamsSchema },
      preValidation: [
        typedApp.verifyRole([UserRole.ADMINISTRADOR, UserRole.COMPRAS, UserRole.FORNECEDOR]),
      ],
    },
    controller.listNotifications.bind(controller),
  );
};
