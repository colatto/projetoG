import { z } from 'zod';

/** Query params for GET /api/orders (PRD-09 §7.2 — canonical route; alias /api/backoffice/orders). */
export const ordersListQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  require_action: z.coerce.boolean().optional().default(false),
  sort_priority: z.coerce.boolean().optional().default(true),
});

export type OrdersListQuery = z.infer<typeof ordersListQuerySchema>;
