import { z } from 'zod';
import {
  WebhookType,
  IntegrationEventType,
  IntegrationEventStatus,
  IntegrationDirection,
} from '@projetog/domain';

// ============================================================
// POST /webhooks/sienge — body
// ============================================================

export const webhookBodySchema = z.object({
  type: z.nativeEnum(WebhookType, {
    errorMap: () => ({ message: 'Tipo de webhook inválido' }),
  }),
  data: z.record(z.unknown()).default({}),
});

export type WebhookBodyDto = z.infer<typeof webhookBodySchema>;

// ============================================================
// GET /api/integration/events — query params
// ============================================================

export const integrationEventsQuerySchema = z.object({
  status: z.nativeEnum(IntegrationEventStatus).optional(),
  event_type: z.nativeEnum(IntegrationEventType).optional(),
  direction: z.nativeEnum(IntegrationDirection).optional(),
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  page: z.preprocess(
    (a) => (a ? parseInt(String(a), 10) : undefined),
    z.number().int().min(1).optional().default(1),
  ),
  limit: z.preprocess(
    (a) => (a ? parseInt(String(a), 10) : undefined),
    z.number().int().min(1).max(100).optional().default(20),
  ),
});

export type IntegrationEventsQueryDto = z.infer<typeof integrationEventsQuerySchema>;

// ============================================================
// POST /api/integration/events/:id/retry — params
// ============================================================

export const integrationEventIdParamSchema = z.object({
  id: z.string().uuid('ID de evento inválido'),
});

export type IntegrationEventIdParamDto = z.infer<typeof integrationEventIdParamSchema>;

// ============================================================
// PUT /api/integration/credentials — body
// ============================================================

export const siengeCredentialsBodySchema = z.object({
  subdomain: z.string().min(1, 'Subdomínio é obrigatório'),
  api_user: z.string().min(1, 'Usuário da API é obrigatório'),
  api_password: z.string().min(1, 'Senha da API é obrigatória'),
  rest_rate_limit: z.number().int().min(1).default(200),
  bulk_rate_limit: z.number().int().min(1).default(20),
});

export type SiengeCredentialsBodyDto = z.infer<typeof siengeCredentialsBodySchema>;

// ============================================================
// POST /api/integration/negotiations/write — body
// ============================================================

export const writeNegotiationBodySchema = z.object({
  purchaseQuotationId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
  supplierAnswerDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
  validity: z.number().int().min(0),
  seller: z.string().min(1),
  items: z
    .array(
      z.object({
        purchaseQuotationItemId: z.number().int().positive(),
        unitPrice: z.number().min(0),
        quantity: z.number().min(0),
        deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato deve ser YYYY-MM-DD'),
      }),
    )
    .min(1),
});

export type WriteNegotiationBodyDto = z.infer<typeof writeNegotiationBodySchema>;
