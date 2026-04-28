import { z } from 'zod';

export const damageActionSchema = z.enum([
  'cancelamento_parcial',
  'cancelamento_total',
  'reposicao',
]);
export type DamageActionDto = z.infer<typeof damageActionSchema>;

export const damageStatusSchema = z.enum([
  'registrada',
  'sugestao_pendente',
  'acao_definida',
  'em_reposicao',
  'cancelamento_aplicado',
  'resolvida',
]);
export type DamageStatusDto = z.infer<typeof damageStatusSchema>;

export const damageIdParamsSchema = z.object({
  damageId: z.string().uuid(),
});
export type DamageIdParamsDto = z.infer<typeof damageIdParamsSchema>;

export const createDamageBodySchema = z.object({
  purchase_order_id: z.coerce.number().int().positive(),
  purchase_order_item_number: z.coerce.number().int().positive(),
  description: z.string().min(10).max(2000),
  affected_quantity: z.coerce.number().positive().optional(),
  suggested_action: damageActionSchema.optional(),
  suggested_action_notes: z.string().max(1000).optional(),
});
export type CreateDamageBodyDto = z.infer<typeof createDamageBodySchema>;

export const suggestDamageActionBodySchema = z.object({
  suggested_action: damageActionSchema,
  suggested_action_notes: z.string().max(1000).optional(),
});
export type SuggestDamageActionBodyDto = z.infer<typeof suggestDamageActionBodySchema>;

export const resolveDamageBodySchema = z.object({
  final_action: damageActionSchema,
  final_action_notes: z.string().max(2000).optional(),
});
export type ResolveDamageBodyDto = z.infer<typeof resolveDamageBodySchema>;

export const informReplacementDateBodySchema = z.object({
  new_promised_date: z.string().min(10),
  notes: z.string().max(1000).optional(),
  replacement_scope: z.enum(['item', 'pedido']).optional(),
});
export type InformReplacementDateBodyDto = z.infer<typeof informReplacementDateBodySchema>;

export const cancelReplacementBodySchema = z.object({
  cancellation_reason: z.string().max(2000).optional(),
});
export type CancelReplacementBodyDto = z.infer<typeof cancelReplacementBodySchema>;

export const listDamagesQuerySchema = z.object({
  purchase_order_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  building_id: z.coerce.number().int().positive().optional(),
  status: damageStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional().default(20),
});
export type ListDamagesQueryDto = z.infer<typeof listDamagesQuerySchema>;
