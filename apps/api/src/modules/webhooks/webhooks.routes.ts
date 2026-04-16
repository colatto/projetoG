import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { WebhookController } from './webhooks.controller.js';
import { webhookBodySchema } from '@projetog/shared';

/**
 * Webhook routes for Sienge integration.
 * Mounted at /webhooks — NO JWT authentication (external webhook).
 * Authentication is via x-webhook-secret header validated against SIENGE_WEBHOOK_SECRET env var.
 *
 * PRD-07 §6.5, §9.2
 */
export default async function webhookRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const controller = new WebhookController();

  const webhookSecret = process.env.SIENGE_WEBHOOK_SECRET;

  function getHeaderValue(value: string | string[] | undefined): string | undefined {
    const normalized = Array.isArray(value) ? value[0] : value;
    if (!normalized) {
      return undefined;
    }

    const trimmed = normalized.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * POST /webhooks/sienge
   *
   * Receives webhooks from Sienge. No JWT.
   * Validates the official x-sienge-* headers and accepts x-webhook-secret
   * only as an optional backward-compatible guard.
   */
  app.post(
    '/sienge',
    {
      schema: {
        body: webhookBodySchema,
      },
      // preValidation for the official Sienge delivery headers.
      preValidation: async (request, reply) => {
        const deliveryId = getHeaderValue(
          request.headers['x-sienge-id'] as string | string[] | undefined,
        );
        const eventName = getHeaderValue(
          request.headers['x-sienge-event'] as string | string[] | undefined,
        );
        const secret = getHeaderValue(
          request.headers['x-webhook-secret'] as string | string[] | undefined,
        );

        if (!deliveryId || !eventName) {
          request.log.warn(
            {
              hasDeliveryId: !!deliveryId,
              hasEventName: !!eventName,
            },
            'Missing required Sienge webhook headers',
          );
          return reply.code(400).send({ message: 'Missing required Sienge webhook headers' });
        }

        if (secret && webhookSecret && secret !== webhookSecret) {
          request.log.warn({ hasSecret: !!secret }, 'Invalid webhook secret');
          return reply.code(401).send({ message: 'Invalid webhook secret' });
        }
      },
    },
    async (request, reply) => controller.receiveWebhook(request, reply),
  );
}
