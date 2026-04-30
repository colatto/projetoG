
import PgBoss from 'pg-boss';
import { getSupabase } from '../supabase.js';
import { countBusinessDays, holidaysToSet } from '../utils/business-days.js';
import {
  replaceDashboardSnapshotBundle,
  type DashboardBuildingRow,
  type DashboardCriticalityRow,
  type DashboardGlobalRow,
  type DashboardSupplierRow,
} from './dashboard-snapshot-pg.js';

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dayRange(targetDate: string) {
  return {
    start: `${targetDate}T00:00:00.000Z`,
    end: `${targetDate}T23:59:59.999Z`,
  };
}

function reliability(hasDelay: boolean, hasDamage: boolean): 'confiavel' | 'atencao' | 'critico' {
  if (hasDelay && hasDamage) return 'critico';
  if (hasDelay || hasDamage) return 'atencao';
  return 'confiavel';
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

/** RN-19: need at least two historical deliveries (other orders) to compare criticidade. */
const MIN_HISTORY_SAMPLES = 2;

/**
 * Prazo restante (proxy PRD-08): dias úteis da data de referência até `last_delivery_date` do pedido
 * da linha (entrega confirmada / planejada no pedido). Quando não houver data, null → Padrão.
 */
function remainingBusinessDaysToDelivery(
  order: { last_delivery_date?: string | null } | undefined,
  holidaySet: Set<string>,
): number | null {
  if (!order?.last_delivery_date) return null;
  const n = countBusinessDays(new Date(), new Date(order.last_delivery_date), holidaySet);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export async function processDashboardConsolidation(job: PgBoss.Job): Promise<void> {
  const supabase = getSupabase();
  const snapshotDate = toDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const { start, end } = dayRange(snapshotDate);
  const referenceNow = new Date().toISOString();

  try {
    const { data: holidaysRows } = await supabase
      .from('business_days_holidays')
      .select('holiday_date');
    const holidaySet = holidaysToSet(holidaysRows || []);

    // supplier_answer_date may exist in DB but not in generated types (stale types).
    // Define runtime shape explicitly for the select columns used.
    type NegotiationRow = {
      id: string;
      supplier_id: number;
      status: string;
      sent_at: string | null;
      supplier_answer_date: string | null;
      updated_at: string | null;
    };

    const [ordersRes, negotiationsRes, integrationsRes, damagesRes] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, supplier_id, building_id, local_status, date, last_delivery_date')
        .lte('created_at', end),
      supabase
        .from('supplier_negotiations')
        .select('id, supplier_id, status, sent_at, supplier_answer_date, updated_at')
        .lte('created_at', end) as unknown as { data: NegotiationRow[] | null; error: unknown },
      supabase
        .from('integration_events')
        .select('id, status, created_at')
        .gte('created_at', start)
        .lte('created_at', end),
      supabase
        .from('damages')
        .select('id, purchase_order_id, supplier_id, building_id, created_at, status')
        .lte('created_at', end),
    ]);

    const orders = ordersRes.data || [];
    const negotiations: NegotiationRow[] = negotiationsRes.data || [];
    const integrations = integrationsRes.data || [];
    const damages = damagesRes.data || [];
    type OrderRow = (typeof orders)[number];
    const ordersById = new Map<number, OrderRow>(orders.map((o) => [o.id, o]));

    const sentInDay = negotiations.filter(
      (n) => n.sent_at && n.sent_at >= start && n.sent_at <= end,
    );
    const respondedInDay = negotiations.filter(
      (n) =>
        n.supplier_answer_date && n.supplier_answer_date >= start && n.supplier_answer_date <= end,
    );
    const noResponseInDay = negotiations.filter(
      (n) =>
        String(n.status || '').toUpperCase() === 'SEM_RESPOSTA' &&
        (n.updated_at ?? '') >= start &&
        (n.updated_at ?? '') <= end,
    );

    const trackedStatuses = new Set([
      'PENDENTE', 'PARCIALMENTE_ENTREGUE', 'ATRASADO', 'ENTREGUE',
      'EM_AVARIA', 'REPOSICAO', 'DIVERGENCIA',
    ]);
    const trackedOrders = orders.filter((o) =>
      trackedStatuses.has(String(o.local_status || '').toUpperCase()),
    );
    const delayedOrders = trackedOrders.filter(
      (o) => String(o.local_status).toUpperCase() === 'ATRASADO',
    );
    const onTimeOrders = trackedOrders.filter(
      (o) => String(o.local_status).toUpperCase() === 'ENTREGUE',
    );
    const ordersWithDamage = new Set(
      damages
        .filter((d) => (d.created_at ?? '') >= start && (d.created_at ?? '') <= end)
        .map((d) => d.purchase_order_id),
    );

    const leadTimeDays = onTimeOrders
      .map((order) => {
        if (!order.date || !order.last_delivery_date) return null;
        return countBusinessDays(
          new Date(order.date),
          new Date(order.last_delivery_date),
          holidaySet,
        );
      })
      .filter((value): value is number => typeof value === 'number' && value >= 0);
    const leadTimeAvg =
      leadTimeDays.length > 0
        ? Number(
            (
              leadTimeDays.reduce((acc: number, cur: number) => acc + cur, 0) / leadTimeDays.length
            ).toFixed(2),
          )
        : null;

    const supplierIds: number[] = [
      ...new Set(orders.map((o) => Number(o.supplier_id)).filter(Number.isFinite)),
    ];
    let supplierNames = new Map<number, string>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);
      supplierNames = new Map(
        (suppliers || []).map((s) => [s.id, s.name || `Fornecedor ${s.id}`]),
      );
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoIso = threeMonthsAgo.toISOString();
    const delays3mBySupplier = new Map<number, boolean>();
    const damages3mBySupplier = new Map<number, boolean>();
    for (const order of orders) {
      if (!order.supplier_id) continue;
      if (
        String(order.local_status || '').toUpperCase() === 'ATRASADO' &&
        (order.date ?? '') >= threeMonthsAgoIso
      ) {
        delays3mBySupplier.set(order.supplier_id, true);
      }
    }
    for (const damage of damages) {
      if (!damage.supplier_id) continue;
      if ((damage.created_at ?? '') >= threeMonthsAgoIso) {
        damages3mBySupplier.set(damage.supplier_id, true);
      }
    }

    const damagesInDayBySupplier = (supplierId: number) =>
      damages.filter(
        (d) =>
          d.supplier_id === supplierId && (d.created_at ?? '') >= start && (d.created_at ?? '') <= end,
      );
    const pedidosComAvariaNoDia = (supplierId: number) =>
      new Set(damagesInDayBySupplier(supplierId).map((d) => d.purchase_order_id)).size;

    const supplierSnapshotRows: DashboardSupplierRow[] = supplierIds.map((supplierId) => {
      const supplierOrders = trackedOrders.filter((o) => o.supplier_id === supplierId);
      const supplierNegotiations = negotiations.filter((n) => n.supplier_id === supplierId);
      const supplierLeadTime = supplierOrders
        .map((order) => {
          if (!order.date || !order.last_delivery_date) return null;
          return countBusinessDays(
            new Date(order.date),
            new Date(order.last_delivery_date),
            holidaySet,
          );
        })
        .filter((value): value is number => typeof value === 'number');
      const supplierLeadAvg = mean(supplierLeadTime);

      return {
        snapshot_date: snapshotDate,
        supplier_id: supplierId,
        supplier_name: supplierNames.get(supplierId) || `Fornecedor ${supplierId}`,
        cotacoes_enviadas: supplierNegotiations.filter((n) => n.sent_at).length,
        cotacoes_respondidas: supplierNegotiations.filter((n) => n.supplier_answer_date)
          .length,
        pedidos_no_prazo: supplierOrders.filter(
          (o) => String(o.local_status).toUpperCase() === 'ENTREGUE',
        ).length,
        pedidos_atrasados: supplierOrders.filter(
          (o) => String(o.local_status).toUpperCase() === 'ATRASADO',
        ).length,
        pedidos_com_avaria: pedidosComAvariaNoDia(supplierId),
        lead_time_medio_dias_uteis: supplierLeadAvg,
        confiabilidade: reliability(
          delays3mBySupplier.get(supplierId) === true,
          damages3mBySupplier.get(supplierId) === true,
        ),
        created_at: referenceNow,
      };
    });

    const buildingIds: number[] = [
      ...new Set(orders.map((o) => Number(o.building_id)).filter(Number.isFinite)),
    ];

    // Note: no `buildings` reference table exists in the DB (Sienge stores building_id only).
    // building_name defaults to `Obra ${id}`. A future buildings sync from Sienge can populate names.

    const buildingSnapshotRows: DashboardBuildingRow[] = buildingIds.map((buildingId) => {
      const rows = trackedOrders.filter((o) => o.building_id === buildingId);
      const rowLead = rows
        .map((order) => {
          if (!order.date || !order.last_delivery_date) return null;
          return countBusinessDays(
            new Date(order.date),
            new Date(order.last_delivery_date),
            holidaySet,
          );
        })
        .filter((value): value is number => typeof value === 'number');
      const rowLeadAvg = mean(rowLead);

      const damagesObraDia = damages.filter(
        (d) =>
          d.building_id === buildingId && (d.created_at ?? '') >= start && (d.created_at ?? '') <= end,
      );

      return {
        snapshot_date: snapshotDate,
        building_id: buildingId,
        building_name: `Obra ${buildingId}`,
        pedidos_no_prazo: rows.filter(
          (o) => String(o.local_status).toUpperCase() === 'ENTREGUE',
        ).length,
        pedidos_atrasados: rows.filter(
          (o) => String(o.local_status).toUpperCase() === 'ATRASADO',
        ).length,
        pedidos_com_avaria: new Set(damagesObraDia.map((d) => d.purchase_order_id)).size,
        lead_time_medio_dias_uteis: rowLeadAvg,
        created_at: referenceNow,
      };
    });

    type OrderItemRow = { purchase_order_id: number; item_number: number; description: string | null };
    const allOrderItems: OrderItemRow[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: page } = await supabase
        .from('purchase_order_items')
        .select('purchase_order_id, item_number, description')
        .range(from, from + pageSize - 1);
      const chunk = (page || []) as unknown as OrderItemRow[];
      allOrderItems.push(...chunk);
      if (chunk.length < pageSize) break;
    }

    const leadSamplesByItem = new Map<string, { orderId: number; lead: number }[]>();
    for (const item of allOrderItems) {
      const key = String(item.item_number);
      const order = ordersById.get(item.purchase_order_id);
      if (!order) continue;
      if (String(order.local_status || '').toUpperCase() !== 'ENTREGUE') continue;
      if (!order.date || !order.last_delivery_date) continue;
      const lead = countBusinessDays(
        new Date(order.date),
        new Date(order.last_delivery_date),
        holidaySet,
      );
      if (typeof lead !== 'number' || lead < 0 || !Number.isFinite(lead)) continue;
      if (!leadSamplesByItem.has(key)) leadSamplesByItem.set(key, []);
      leadSamplesByItem.get(key)!.push({ orderId: order.id, lead });
    }

    const criticalityRows: DashboardCriticalityRow[] = allOrderItems.map((item) => {
      const order = ordersById.get(item.purchase_order_id);
      const key = String(item.item_number);
      const samples = leadSamplesByItem.get(key) || [];
      const others = samples.filter((s) => s.orderId !== item.purchase_order_id).map((s) => s.lead);
      const avgHistory = others.length >= MIN_HISTORY_SAMPLES ? mean(others) : null;
      const remainingDays = remainingBusinessDaysToDelivery(order, holidaySet);
      const isUrgent =
        typeof remainingDays === 'number' &&
        avgHistory !== null &&
        remainingDays < avgHistory;

      return {
        snapshot_date: snapshotDate,
        item_identifier: key,
        item_description: item.description ?? null,
        building_id: order?.building_id ?? null,
        prazo_obra_dias_uteis: remainingDays,
        media_historica_dias_uteis: avgHistory,
        criticidade: isUrgent ? 'urgente' : 'padrao',
        created_at: referenceNow,
      };
    });

    const globalRow: DashboardGlobalRow = {
      snapshot_date: snapshotDate,
      cotacoes_enviadas: sentInDay.length,
      cotacoes_respondidas: respondedInDay.length,
      cotacoes_sem_resposta: noResponseInDay.length,
      pedidos_no_prazo: onTimeOrders.length,
      pedidos_atrasados: delayedOrders.length,
      pedidos_com_avaria: ordersWithDamage.size,
      total_pedidos_monitorados: trackedOrders.length,
      lead_time_medio_dias_uteis: leadTimeAvg,
      created_at: referenceNow,
    };

    await replaceDashboardSnapshotBundle(
      snapshotDate,
      globalRow,
      supplierSnapshotRows,
      buildingSnapshotRows,
      criticalityRows,
    );

    await supabase.from('audit_logs').insert({
      event_type: 'dashboard.snapshot_created',
      entity_type: 'dashboard_snapshot',
      entity_id: snapshotDate,
      metadata: {
        jobId: job.id,
        snapshot_date: snapshotDate,
        supplier_rows: supplierSnapshotRows.length,
        building_rows: buildingSnapshotRows.length,
        criticality_rows: criticalityRows.length,
        integration_failures: integrations.filter((event) => event.status === 'failure')
          .length,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await supabase.from('audit_logs').insert({
      event_type: 'dashboard.consolidation_error',
      entity_type: 'dashboard_snapshot',
      entity_id: snapshotDate,
      metadata: {
        jobId: job.id,
        snapshot_date: snapshotDate,
        error: msg,
      },
    });
    throw error;
  }
}
