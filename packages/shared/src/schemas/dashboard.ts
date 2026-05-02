import { z } from 'zod';

export const dashboardDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const dashboardResumoQuerySchema = z.object({
  data_referencia: dashboardDateSchema.optional(),
});
export type DashboardResumoQueryDto = z.infer<typeof dashboardResumoQuerySchema>;

export const dashboardKpisQuerySchema = z.object({
  data_inicio: dashboardDateSchema.optional(),
  data_fim: dashboardDateSchema.optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  building_id: z.coerce.number().int().positive().optional(),
});
export type DashboardKpisQueryDto = z.infer<typeof dashboardKpisQuerySchema>;

export const dashboardLeadTimeQuerySchema = dashboardKpisQuerySchema.extend({
  purchase_order_id: z.coerce.number().int().positive().optional(),
  item_identifier: z.string().min(1).max(100).optional(),
});
export type DashboardLeadTimeQueryDto = z.infer<typeof dashboardLeadTimeQuerySchema>;

export const dashboardAtrasosQuerySchema = dashboardLeadTimeQuerySchema;
export type DashboardAtrasosQueryDto = z.infer<typeof dashboardAtrasosQuerySchema>;

export const dashboardCriticidadeQuerySchema = z.object({
  data_referencia: dashboardDateSchema.optional(),
  building_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  purchase_order_id: z.coerce.number().int().positive().optional(),
  item_identifier: z.string().min(1).max(100).optional(),
});
export type DashboardCriticidadeQueryDto = z.infer<typeof dashboardCriticidadeQuerySchema>;

export const dashboardRankingFornecedoresQuerySchema = dashboardLeadTimeQuerySchema;
export type DashboardRankingFornecedoresQueryDto = z.infer<
  typeof dashboardRankingFornecedoresQuerySchema
>;

export const dashboardAvariasQuerySchema = dashboardLeadTimeQuerySchema;
export type DashboardAvariasQueryDto = z.infer<typeof dashboardAvariasQuerySchema>;
