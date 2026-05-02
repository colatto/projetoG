import { z } from 'zod';
import { NotificationType } from '@projetog/domain';

// start_date / end_date filtram por created_at (campo presente em todo log;
// sent_at é nulo em falhas, e o controller já ordena por created_at).
export const notificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  quotation_id: z.coerce.number().optional(),
  supplier_id: z.coerce.number().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  status: z.enum(['sent', 'failed', 'bounced']).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .optional(),
  export: z.enum(['csv']).optional(),
});
export type NotificationLogsQueryDto = z.infer<typeof notificationLogsQuerySchema>;

export const notificationTemplateUpdateBodySchema = z.object({
  subject_template: z.string().min(1),
  body_template: z.string().min(1),
});
export type NotificationTemplateUpdateBodyDto = z.infer<
  typeof notificationTemplateUpdateBodySchema
>;

export const notificationTemplateIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type NotificationTemplateIdParamDto = z.infer<typeof notificationTemplateIdParamSchema>;
