import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  cancelReplacementBodySchema,
  createDamageBodySchema,
  damageIdParamsSchema,
  informReplacementDateBodySchema,
  listDamagesQuerySchema,
  resolveDamageBodySchema,
  suggestDamageActionBodySchema,
} from '@projetog/shared';
import { UserRole } from '@projetog/domain';
import { DamagesController } from './damages.controller.js';

export const damagesRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const controller = new DamagesController(app);
  typedApp.addHook('preValidation', app.authenticate);

  typedApp.post(
    '/',
    {
      schema: { body: createDamageBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.FORNECEDOR, UserRole.COMPRAS])],
    },
    controller.createDamage.bind(controller),
  );

  typedApp.patch(
    '/:damageId/suggest',
    {
      schema: { params: damageIdParamsSchema, body: suggestDamageActionBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.FORNECEDOR])],
    },
    controller.suggestAction.bind(controller),
  );

  typedApp.patch(
    '/:damageId/resolve',
    {
      schema: { params: damageIdParamsSchema, body: resolveDamageBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.COMPRAS])],
    },
    controller.resolveAction.bind(controller),
  );

  typedApp.patch(
    '/:damageId/replacement/date',
    {
      schema: { params: damageIdParamsSchema, body: informReplacementDateBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.FORNECEDOR])],
    },
    controller.informReplacementDate.bind(controller),
  );

  typedApp.patch(
    '/:damageId/replacement/cancel',
    {
      schema: { params: damageIdParamsSchema, body: cancelReplacementBodySchema },
      preValidation: [typedApp.verifyRole([UserRole.COMPRAS])],
    },
    controller.cancelReplacement.bind(controller),
  );

  typedApp.get(
    '/',
    {
      schema: { querystring: listDamagesQuerySchema },
      preValidation: [
        typedApp.verifyRole([UserRole.FORNECEDOR, UserRole.COMPRAS, UserRole.ADMINISTRADOR]),
      ],
    },
    controller.listDamages.bind(controller),
  );

  typedApp.get(
    '/:damageId',
    {
      schema: { params: damageIdParamsSchema },
      preValidation: [
        typedApp.verifyRole([UserRole.FORNECEDOR, UserRole.COMPRAS, UserRole.ADMINISTRADOR]),
      ],
    },
    controller.getDamage.bind(controller),
  );

  typedApp.get(
    '/:damageId/audit',
    {
      schema: { params: damageIdParamsSchema },
      preValidation: [typedApp.verifyRole([UserRole.COMPRAS, UserRole.ADMINISTRADOR])],
    },
    controller.listAudit.bind(controller),
  );
};
