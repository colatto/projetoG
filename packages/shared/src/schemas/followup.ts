import { z } from 'zod';

export const followupOrdersQuerySchema = z.object({
  status: z.string().optional(),
  supplier_id: z.coerce.number().optional(),
  building_id: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type FollowupOrdersQueryDto = z.infer<typeof followupOrdersQuerySchema>;

export const followupPurchaseOrderParamsSchema = z.object({
  purchaseOrderId: z.coerce.number().int().positive(),
});
export type FollowupPurchaseOrderParamsDto = z.infer<typeof followupPurchaseOrderParamsSchema>;

export const suggestDateBodySchema = z.object({
  suggested_date: z.string().min(10),
  reason: z.string().max(1000).optional(),
});
export type SuggestDateBodyDto = z.infer<typeof suggestDateBodySchema>;

export const dateChangeParamsSchema = z.object({
  dateChangeId: z.string().uuid(),
});
export type DateChangeParamsDto = z.infer<typeof dateChangeParamsSchema>;

export const dateDecisionBodySchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type DateDecisionBodyDto = z.infer<typeof dateDecisionBodySchema>;
