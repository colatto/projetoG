import { z } from 'zod';

export const notificationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  quotation_id: z.coerce.number().optional(),
  supplier_id: z.coerce.number().optional(),
  status: z.enum(['sent', 'failed', 'bounced']).optional(),
  export: z.enum(['csv']).optional(),
});
export type NotificationLogsQueryDto = z.infer<typeof notificationLogsQuerySchema>;

export const notificationTemplateUpdateBodySchema = z.object({
  subject_template: z.string().min(1),
  body_template: z.string().min(1),
});
export type NotificationTemplateUpdateBodyDto = z.infer<typeof notificationTemplateUpdateBodySchema>;

export const notificationTemplateIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type NotificationTemplateIdParamDto = z.infer<typeof notificationTemplateIdParamSchema>;
