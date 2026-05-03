import { z } from 'zod';

// ============================================================
// GET /api/backoffice/audit — PRD-09 §7.7 (IDs numéricos Sienge/GRF)
// ============================================================

export const auditEventsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  event_type: z.string().min(1).optional(),
  purchase_quotation_id: z.coerce.number().int().positive().optional(),
  purchase_order_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  actor_id: z.string().uuid().optional(),
  date_start: z.string().datetime({ offset: true }).optional(),
  date_end: z.string().datetime({ offset: true }).optional(),
});

export type AuditEventsListQueryDto = z.infer<typeof auditEventsListQuerySchema>;

export const auditEventIdParamSchema = z.object({
  audit_event_id: z.string().uuid('audit_event_id inválido'),
});

export type AuditEventIdParamDto = z.infer<typeof auditEventIdParamSchema>;
