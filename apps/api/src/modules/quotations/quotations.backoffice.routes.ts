import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  quotationsQuerySchema,
  quotationIdParamSchema,
  quotationSendBodySchema,
  quotationSupplierParamSchema,
  quotationReviewBodySchema,
  type QuotationsQueryDto,
  type QuotationIdParamDto,
  type QuotationSendBodyDto,
  type QuotationSupplierParamDto,
  type QuotationReviewBodyDto,
} from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { QuotationsController } from './quotations.controller.js';

export default async function quotationsBackofficeRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const audit = new AuditService(fastify);
  const controller = new QuotationsController(audit);

  app.addHook('preValidation', fastify.authenticate);
  app.addHook('preValidation', fastify.verifyRole([UserRole.COMPRAS, UserRole.ADMINISTRADOR]));

  app.get(
    '/',
    { schema: { querystring: quotationsQuerySchema } },
    async (request, reply) =>
      controller.listBackoffice(
        request as typeof request & { query: QuotationsQueryDto },
        reply,
      ),
  );

  app.get(
    '/:quotation_id',
    { schema: { params: quotationIdParamSchema } },
    async (request, reply) =>
      controller.getBackofficeById(
        request as typeof request & { params: QuotationIdParamDto },
        reply,
      ),
  );

  app.post(
    '/:quotation_id/send',
    { schema: { params: quotationIdParamSchema, body: quotationSendBodySchema } },
    async (request, reply) =>
      controller.sendQuotation(
        request as typeof request & { params: QuotationIdParamDto; body: QuotationSendBodyDto },
        reply,
      ),
  );

  app.post(
    '/:quotation_id/suppliers/:supplier_id/review',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS])],
      schema: { params: quotationSupplierParamSchema, body: quotationReviewBodySchema },
    },
    async (request, reply) =>
      controller.reviewSupplierResponse(
        request as typeof request & { params: QuotationSupplierParamDto; body: QuotationReviewBodyDto },
        reply,
      ),
  );

  app.post(
    '/:quotation_id/suppliers/:supplier_id/retry-integration',
    {
      preValidation: [fastify.verifyRole([UserRole.COMPRAS])],
      schema: { params: quotationSupplierParamSchema },
    },
    async (request, reply) =>
      controller.retryIntegration(
        request as typeof request & { params: QuotationSupplierParamDto },
        reply,
      ),
  );
}

