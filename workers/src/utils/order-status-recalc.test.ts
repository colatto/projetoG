import { describe, expect, it, vi } from 'vitest';
import { recalculateOrderStatus } from './order-status-recalc.js';

describe('recalculateOrderStatus', () => {
  it('closes active follow-up tracker when order is delivered with no pending quantity', async () => {
    const followUpSingleMock = vi.fn().mockResolvedValue({ data: { id: 'trk-1' }, error: null });
    const followUpSelectMock = vi.fn(() => ({ single: followUpSingleMock }));
    const followUpNeqMock = vi.fn(() => ({ select: followUpSelectMock }));
    const followUpEqMock = vi.fn(() => ({ neq: followUpNeqMock }));
    const followUpUpdateMock = vi.fn(() => ({ eq: followUpEqMock }));

    const supabase = {
      from: vi.fn((table: string) => {
        switch (table) {
          case 'purchase_orders':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 123,
                      local_status: 'PARCIALMENTE_ENTREGUE',
                      last_delivery_date: null,
                      total_quantity_ordered: 10,
                      total_quantity_delivered: 5,
                      pending_quantity: 5,
                      has_divergence: false,
                      date: '2026-04-20',
                    },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
            };
          case 'delivery_schedules':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [{ scheduled_date: '2026-04-22' }],
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          case 'purchase_order_items':
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ quantity: 10 }],
                  error: null,
                }),
              })),
            };
          case 'deliveries':
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      delivered_quantity: 10,
                      validation_status: 'OK',
                      delivery_date: '2026-04-21',
                    },
                  ],
                  error: null,
                }),
              })),
            };
          case 'damages':
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                })),
              })),
            };
          case 'order_status_history':
          case 'audit_logs':
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          case 'follow_up_trackers':
            return {
              update: followUpUpdateMock,
            };
          default:
            throw new Error(`Unexpected table ${table}`);
        }
      }),
    };

    await recalculateOrderStatus(supabase as never, 123);

    expect(followUpUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ENCERRADO' }),
    );
    expect(followUpEqMock).toHaveBeenCalledWith('purchase_order_id', 123);
  });
});
