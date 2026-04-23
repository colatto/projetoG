import { beforeEach, describe, expect, it, vi } from 'vitest';

const bossSendMock = vi.fn().mockResolvedValue('job-id');

const followUpTrackersUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const followUpTrackersInsertMock = vi.fn().mockResolvedValue({ error: null });
const followUpTrackersMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
const notificationLogsSingleMock = vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null });
const notificationLogsSelectMock = vi.fn(() => ({ single: notificationLogsSingleMock }));
const notificationLogsInsertMock = vi.fn(() => ({ select: notificationLogsSelectMock }));

const supplierContactsLimitMock = vi
  .fn()
  .mockResolvedValue({ data: [{ email: 'supplier@example.com' }], error: null });
const supplierContactsOrderMock = vi.fn(() => ({ limit: supplierContactsLimitMock }));
const supplierContactsEqMock = vi.fn(() => ({ order: supplierContactsOrderMock }));
const supplierContactsSelectMock = vi.fn(() => ({ eq: supplierContactsEqMock }));

const templatesSingleMock = vi.fn().mockResolvedValue({
  data: {
    id: 'tpl-1',
    version: 1,
    subject_template: 'Pedido {{purchaseOrderId}} {{notificationNumber}} {{promisedDate}}',
    body_template: '<p>{{purchaseOrderId}} {{notificationNumber}} {{promisedDate}}</p>',
  },
  error: null,
});
const templatesEqSecondMock = vi.fn(() => ({ single: templatesSingleMock }));
const templatesEqFirstMock = vi.fn(() => ({ eq: templatesEqSecondMock }));
const templatesSelectMock = vi.fn(() => ({ eq: templatesEqFirstMock }));

const purchaseOrdersInMock = vi.fn().mockResolvedValue({ data: [], error: null });
const purchaseOrdersSingleMock = vi
  .fn()
  .mockResolvedValue({ data: { id: 1, local_status: 'PENDENTE', pending_quantity: 5 }, error: null });
const purchaseOrdersEqMock = vi.fn(() => ({ single: purchaseOrdersSingleMock }));
const purchaseOrdersSelectMock = vi.fn((columns: string) => {
  if (columns.includes('supplier_id')) {
    return { in: purchaseOrdersInMock };
  }
  return { eq: purchaseOrdersEqMock };
});

const deliverySchedulesInMock = vi.fn().mockResolvedValue({ data: [], error: null });
const deliverySchedulesSelectMock = vi.fn(() => ({ in: deliverySchedulesInMock }));

const trackersInMock = vi.fn().mockResolvedValue({
  data: [
    {
      id: 'trk-1',
      purchase_order_id: 1,
      supplier_id: 10,
      order_date: '2026-04-01',
      promised_date_current: '2026-04-01',
      status: 'ATIVO',
      current_notification_number: 1,
      supplier_response_type: 'none',
      next_notification_date: '2026-04-01',
    },
  ],
  error: null,
});
const trackersSelectMock = vi.fn((columns: string) => {
  if (columns === '*') {
    return { in: trackersInMock };
  }
  return {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => ({ maybeSingle: followUpTrackersMaybeSingleMock })),
      })),
    })),
  };
});
const trackersUpdateMock = vi.fn(() => ({ eq: followUpTrackersUpdateEqMock }));

const holidaysSelectMock = vi.fn().mockResolvedValue({ data: [], error: null });

const supabaseMock = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'business_days_holidays':
        return { select: holidaysSelectMock };
      case 'purchase_orders':
        return { select: purchaseOrdersSelectMock };
      case 'follow_up_trackers':
        return {
          select: trackersSelectMock,
          update: trackersUpdateMock,
          insert: followUpTrackersInsertMock,
        };
      case 'delivery_schedules':
        return { select: deliverySchedulesSelectMock };
      case 'notification_templates':
        return { select: templatesSelectMock };
      case 'supplier_contacts':
        return { select: supplierContactsSelectMock };
      case 'notification_logs':
        return { insert: notificationLogsInsertMock };
      default:
        throw new Error(`Unexpected table ${table}`);
    }
  }),
};

vi.mock('../supabase.js', () => ({
  getSupabase: () => supabaseMock,
}));

vi.mock('../boss.js', () => ({
  getBoss: () => ({ send: bossSendMock }),
}));

const { processFollowUp } = await import('./follow-up.js');

describe('processFollowUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purchaseOrdersInMock.mockResolvedValue({ data: [], error: null });
    deliverySchedulesInMock.mockResolvedValue({ data: [], error: null });
    followUpTrackersMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    trackersInMock.mockResolvedValue({
      data: [
        {
          id: 'trk-1',
          purchase_order_id: 1,
          supplier_id: 10,
          order_date: '2026-04-01',
          promised_date_current: '2026-04-01',
          status: 'ATIVO',
          current_notification_number: 1,
          supplier_response_type: 'none',
          next_notification_date: '2026-04-01',
        },
      ],
      error: null,
    });
  });

  it('marks overdue tracker and enqueues email notification', async () => {
    await processFollowUp({ id: 'job-followup' } as never);

    expect(followUpTrackersUpdateEqMock).toHaveBeenCalled();
    expect(notificationLogsInsertMock).toHaveBeenCalled();
    expect(bossSendMock).toHaveBeenCalledWith(
      'notification:send-email',
      expect.objectContaining({
        notificationLogId: 'log-1',
        recipientEmail: 'supplier@example.com',
      }),
    );
  });

  it('closes tracker when order has no pending quantity', async () => {
    purchaseOrdersSingleMock.mockResolvedValueOnce({
      data: { id: 1, local_status: 'PARCIALMENTE_ENTREGUE', pending_quantity: 0 },
      error: null,
    });

    await processFollowUp({ id: 'job-followup' } as never);

    expect(trackersUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ENCERRADO',
        completed_reason: 'delivered_total',
      }),
    );
    expect(notificationLogsInsertMock).not.toHaveBeenCalled();
  });

  it('bootstraps promised date from latest delivery schedule', async () => {
    purchaseOrdersInMock.mockResolvedValueOnce({
      data: [{ id: 999, supplier_id: 10, date: '2026-04-01', building_id: 5, local_status: 'PENDENTE' }],
      error: null,
    });
    deliverySchedulesInMock.mockResolvedValueOnce({
      data: [
        { purchase_order_id: 999, scheduled_date: '2026-04-20' },
        { purchase_order_id: 999, scheduled_date: '2026-04-10' },
      ],
      error: null,
    });
    trackersInMock.mockResolvedValueOnce({ data: [], error: null });

    await processFollowUp({ id: 'job-followup' } as never);

    expect(followUpTrackersInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        purchase_order_id: 999,
        promised_date_original: '2026-04-20',
        promised_date_current: '2026-04-20',
        current_delivery_date: '2026-04-20',
      }),
    );
  });
});
