import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { UserRole } from '@projetog/domain';
import {
  quotationIdParamSchema,
  quotationRespondBodySchema,
  type QuotationIdParamDto,
  type QuotationRespondBodyDto,
} from '@projetog/shared';
import { AuditService } from '../audit/audit.service.js';
import { QuotationsController } from './quotations.controller.js';

export default async function supplierQuotationsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const audit = new AuditService(fastify);
  const controller = new QuotationsController(audit);

  app.addHook('preValidation', fastify.authenticate);
  app.addHook('preValidation', fastify.verifyRole([UserRole.FORNECEDOR]));

  app.get('/', async (request, reply) => controller.listSupplier(request, reply));

  app.get(
    '/:quotation_id',
    { schema: { params: quotationIdParamSchema } },
    async (request, reply) =>
      controller.getSupplierByQuotationId(
        request as typeof request & { params: QuotationIdParamDto },
        reply,
      ),
  );

  app.post(
    '/:quotation_id/read',
    { schema: { params: quotationIdParamSchema } },
    async (request, reply) =>
      controller.markRead(request as typeof request & { params: QuotationIdParamDto }, reply),
  );

  app.post(
    '/:quotation_id/respond',
    { schema: { params: quotationIdParamSchema, body: quotationRespondBodySchema } },
    async (request, reply) =>
      controller.respond(
        request as typeof request & { params: QuotationIdParamDto; body: QuotationRespondBodyDto },
        reply,
      ),
  );
}
