import PgBoss from 'pg-boss';
import { NotificationType } from '@projetog/domain';
import { getSupabase } from '../supabase.js';
import { getBoss } from '../boss.js';
import { addBusinessDays, countBusinessDays, holidaysToSet } from '../utils/business-days.js';

type FollowUpTracker = {
  id: string;
  purchase_order_id: number;
  supplier_id: number;
  order_date: string;
  promised_date_current: string;
  status: string;
  current_notification_number: number;
  supplier_response_type: string | null;
  next_notification_date: string | null;
};

const ACTIVE_STATUSES = ['ATIVO', 'NOVA_DATA_APROVADA'] as const;

/**
 * Follow-up logistics daily worker.
 *
 * Responsibilities:
 * - create/normalize follow-up trackers for imported orders
 * - schedule and send sequential reminder notifications
 * - copy Compras from notification 2 onward
 * - mark overdue when promised date has expired and no delivery confirmation exists
 */
export async function processFollowUp(job: PgBoss.Job): Promise<void> {
  const supabase = getSupabase();
  const correlationId = job.id;
  console.log(`[follow-up] start ${correlationId}`);

  const holidaysResponse = await (supabase as any)
    .from('business_days_holidays')
    .select('holiday_date');
  const holidaySet = holidaysToSet(holidaysResponse.data || []);

  await ensureTrackers(supabase as any, holidaySet);

  const { data: trackers, error: trackersError } = await (supabase as any)
    .from('follow_up_trackers')
    .select('*')
    .in('status', [...ACTIVE_STATUSES, 'PAUSADO', 'ATRASADO', 'CONCLUIDO']);

  if (trackersError) {
    throw new Error(`Failed to list follow-up trackers: ${trackersError.message}`);
  }

  for (const tracker of (trackers || []) as FollowUpTracker[]) {
    if (tracker.status === 'PAUSADO') {
      continue;
    }
    await processTracker(supabase as any, tracker, holidaySet);
  }

  console.log(`[follow-up] finish ${correlationId}`);
}

async function ensureTrackers(supabase: any, holidays: Set<string>) {
  const { data: orders, error } = await supabase
    .from('purchase_orders')
    .select('id, supplier_id, date, building_id, local_status')
    .in('local_status', ['PENDENTE', 'PARCIALMENTE_ENTREGUE', 'ATRASADO', 'DIVERGENCIA', 'REPOSICAO']);

  if (error) {
    throw new Error(`Failed to list orders for follow-up bootstrap: ${error.message}`);
  }

  const orderIds = (orders || []).map((order: { id: number }) => order.id);
  const promisedDateByOrderId = new Map<number, string>();
  if (orderIds.length > 0) {
    const { data: schedules, error: schedulesError } = await supabase
      .from('delivery_schedules')
      .select('purchase_order_id, scheduled_date')
      .in('purchase_order_id', orderIds);

    if (schedulesError) {
      throw new Error(`Failed to list delivery schedules for follow-up bootstrap: ${schedulesError.message}`);
    }

    for (const schedule of schedules || []) {
      const purchaseOrderId = Number(schedule.purchase_order_id);
      const scheduledDate = schedule.scheduled_date;
      if (!purchaseOrderId || !scheduledDate) continue;

      const current = promisedDateByOrderId.get(purchaseOrderId);
      if (!current || scheduledDate > current) {
        promisedDateByOrderId.set(purchaseOrderId, scheduledDate);
      }
    }
  }

  for (const order of orders || []) {
    const { data: existing } = await supabase
      .from('follow_up_trackers')
      .select('id, status')
      .eq('purchase_order_id', order.id)
      .eq('supplier_id', order.supplier_id)
      .in('status', [
        'ATIVO',
        'PAUSADO',
        'NOVA_DATA_APROVADA',
        'NOVA_DATA_SUGERIDA',
        'CONCLUIDO',
        'ATRASADO',
      ])
      .maybeSingle();

    if (existing) continue;

    const promisedDateIso = promisedDateByOrderId.get(order.id) || order.date;
    const orderDate = new Date(order.date);
    const promisedDate = new Date(promisedDateIso);
    const totalBusinessDays = Math.max(1, countBusinessDays(orderDate, promisedDate, holidays));
    const firstReminderDay = Math.max(1, Math.floor(totalBusinessDays / 2));
    const nextNotification = addBusinessDays(orderDate, firstReminderDay, holidays).toISOString().slice(0, 10);

    await supabase.from('follow_up_trackers').insert({
      purchase_order_id: order.id,
      supplier_id: order.supplier_id,
      item_number: 1,
      base_date: order.date,
      current_delivery_date: promisedDateIso,
      order_date: order.date,
      promised_date_original: promisedDateIso,
      promised_date_current: promisedDateIso,
      building_id: order.building_id,
      status: order.local_status === 'ATRASADO' ? 'ATRASADO' : 'ATIVO',
      supplier_response_type: 'none',
      current_notification_number: 0,
      next_notification_date: nextNotification,
    });
  }
}

async function processTracker(supabase: any, tracker: FollowUpTracker, holidays: Set<string>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const promised = new Date(tracker.promised_date_current);
  promised.setHours(0, 0, 0, 0);

  const { data: order } = await supabase
    .from('purchase_orders')
    .select('id, local_status, pending_quantity')
    .eq('id', tracker.purchase_order_id)
    .single();
  if (!order) return;

  // Follow-up must end when there is no pending quantity or order finished/cancelled.
  if (
    ['ENTREGUE', 'CANCELADO'].includes(order.local_status) ||
    Number(order.pending_quantity || 0) <= 0
  ) {
    await supabase
      .from('follow_up_trackers')
      .update({
        status: 'ENCERRADO',
        completed_reason: Number(order.pending_quantity || 0) <= 0 ? 'delivered_total' : 'order_closed',
      })
      .eq('id', tracker.id);
    return;
  }

  const overdueThreshold = addBusinessDays(promised, 1, holidays);
  if (today >= overdueThreshold) {
    await supabase
      .from('follow_up_trackers')
      .update({ status: 'ATRASADO', next_notification_date: null })
      .eq('id', tracker.id);
    await sendReminderNotification(supabase, tracker, NotificationType.OVERDUE_ALERT, true);
    return;
  }

  // Confirmed trackers stay silent until overdue threshold.
  if (tracker.status === 'CONCLUIDO' || tracker.supplier_response_type === 'confirmed_on_time') {
    return;
  }

  if (!tracker.next_notification_date) return;
  const nextNotification = new Date(tracker.next_notification_date);
  nextNotification.setHours(0, 0, 0, 0);
  if (today < nextNotification) return;

  const nextNumber = (tracker.current_notification_number || 0) + 1;
  await sendReminderNotification(supabase, tracker, NotificationType.FOLLOWUP_REMINDER, nextNumber >= 2, nextNumber);

  const nextDate = addBusinessDays(today, 1, holidays).toISOString().slice(0, 10);
  await supabase
    .from('follow_up_trackers')
    .update({
      current_notification_number: nextNumber,
      last_notification_sent_at: new Date().toISOString(),
      next_notification_date: nextDate,
    })
    .eq('id', tracker.id)
    .eq('current_notification_number', tracker.current_notification_number)
    .in('status', [...ACTIVE_STATUSES, 'ATRASADO', 'CONCLUIDO']);
}

async function sendReminderNotification(
  supabase: any,
  tracker: FollowUpTracker,
  type: NotificationType,
  copyCompras = false,
  notificationNumber?: number,
) {
  const { data: template } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('type', type)
    .eq('is_active', true)
    .single();
  if (!template) return;

  const { data: contacts } = await supabase
    .from('supplier_contacts')
    .select('email, is_primary')
    .eq('supplier_id', tracker.supplier_id)
    .order('is_primary', { ascending: false })
    .limit(1);
  const supplierEmail = contacts?.[0]?.email;
  if (!supplierEmail) return;

  const comprasEmail = process.env.COMPRAS_EMAIL || 'compras@grfincorporadora.com';
  const finalSubject = template.subject_template
    .replace('{{purchaseOrderId}}', String(tracker.purchase_order_id))
    .replace('{{notificationNumber}}', String(notificationNumber || 0))
    .replace('{{promisedDate}}', tracker.promised_date_current);
  const finalBody = template.body_template
    .replaceAll('{{purchaseOrderId}}', String(tracker.purchase_order_id))
    .replaceAll('{{notificationNumber}}', String(notificationNumber || 0))
    .replaceAll('{{promisedDate}}', tracker.promised_date_current);

  const { data: logEntry } = await supabase
    .from('notification_logs')
    .insert({
      template_id: template.id,
      template_version: template.version,
      type,
      recipient_email: supplierEmail,
      recipient_supplier_id: tracker.supplier_id,
      purchase_order_id: tracker.purchase_order_id,
      follow_up_tracker_id: tracker.id,
      subject: finalSubject,
      body_snapshot: finalBody,
      status: 'sent',
      metadata: {
        copied_to_compras: copyCompras,
        compras_email: copyCompras ? comprasEmail : null,
        notification_number: notificationNumber || null,
      },
      triggered_by: null,
    })
    .select('id')
    .single();

  if (logEntry) {
    try {
      await getBoss().send('notification:send-email', {
        notificationLogId: logEntry.id,
        recipientEmail: supplierEmail,
        subject: finalSubject,
        htmlBody: finalBody,
      });
    } catch (error: any) {
      await supabase
        .from('notification_logs')
        .update({
          status: 'failed',
          error_message: error?.message || 'Failed to enqueue email notification',
        })
        .eq('id', logEntry.id);
      throw error;
    }
  }
}
