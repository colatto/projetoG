/* eslint-disable @typescript-eslint/no-explicit-any */
import PgBoss from 'pg-boss';
import { getSupabase } from '../supabase.js';
import { countBusinessDays, holidaysToSet } from '../utils/business-days.js';

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

export async function processDashboardConsolidation(job: PgBoss.Job): Promise<void> {
  const supabase = getSupabase();
  const snapshotDate = toDateOnly(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const { start, end } = dayRange(snapshotDate);
  const referenceNow = new Date().toISOString();

  try {
    const { data: holidaysRows } = await (supabase as any)
      .from('business_days_holidays')
      .select('holiday_date');
    const holidaySet = holidaysToSet(holidaysRows || []);

    const [ordersRes, negotiationsRes, integrationsRes, damagesRes] = await Promise.all([
      (supabase as any)
        .from('purchase_orders')
        .select('id, supplier_id, building_id, local_status, date, last_delivery_date')
        .lte('created_at', end),
      (supabase as any)
        .from('supplier_negotiations')
        .select('id, supplier_id, status, sent_at, supplier_answer_date, updated_at')
        .lte('created_at', end),
      (supabase as any)
        .from('integration_events')
        .select('id, status, created_at')
        .gte('created_at', start)
        .lte('created_at', end),
      (supabase as any)
        .from('damages')
        .select('id, purchase_order_id, supplier_id, building_id, created_at, status')
        .lte('created_at', end),
    ]);

    const orders: any[] = ordersRes.data || [];
    const negotiations: any[] = negotiationsRes.data || [];
    const integrations: any[] = integrationsRes.data || [];
    const damages: any[] = damagesRes.data || [];

    const sentInDay = negotiations.filter(
      (n: any) => n.sent_at && n.sent_at >= start && n.sent_at <= end,
    );
    const respondedInDay = negotiations.filter(
      (n: any) =>
        n.supplier_answer_date && n.supplier_answer_date >= start && n.supplier_answer_date <= end,
    );
    const noResponseInDay = negotiations.filter(
      (n: any) =>
        String(n.status || '').toUpperCase() === 'SEM_RESPOSTA' &&
        n.updated_at >= start &&
        n.updated_at <= end,
    );

    const trackedOrders = orders.filter((o: any) =>
      [
        'PENDENTE',
        'PARCIALMENTE_ENTREGUE',
        'ATRASADO',
        'ENTREGUE',
        'EM_AVARIA',
        'REPOSICAO',
        'DIVERGENCIA',
      ].includes(String(o.local_status || '').toUpperCase()),
    );
    const delayedOrders = trackedOrders.filter(
      (o: any) => String(o.local_status).toUpperCase() === 'ATRASADO',
    );
    const onTimeOrders = trackedOrders.filter(
      (o: any) => String(o.local_status).toUpperCase() === 'ENTREGUE',
    );
    const ordersWithDamage = new Set(
      damages
        .filter((d: any) => d.created_at >= start && d.created_at <= end)
        .map((d: any) => d.purchase_order_id),
    );

    const leadTimeDays = onTimeOrders
      .map((order: any) => {
        if (!order.date || !order.last_delivery_date) return null;
        return countBusinessDays(
          new Date(order.date),
          new Date(order.last_delivery_date),
          holidaySet,
        );
      })
      .filter((value: number | null): value is number => typeof value === 'number' && value >= 0);
    const leadTimeAvg =
      leadTimeDays.length > 0
        ? Number(
            (
              leadTimeDays.reduce((acc: number, cur: number) => acc + cur, 0) / leadTimeDays.length
            ).toFixed(2),
          )
        : null;

    const supplierIds: number[] = [
      ...new Set(orders.map((o: any) => Number(o.supplier_id)).filter(Number.isFinite)),
    ];
    let supplierNames = new Map<number, string>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await (supabase as any)
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds);
      supplierNames = new Map(
        (suppliers || []).map((s: any) => [s.id, s.name || `Fornecedor ${s.id}`]),
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
        order.date >= threeMonthsAgoIso
      ) {
        delays3mBySupplier.set(order.supplier_id, true);
      }
    }
    for (const damage of damages) {
      if (!damage.supplier_id) continue;
      if (damage.created_at >= threeMonthsAgoIso) {
        damages3mBySupplier.set(damage.supplier_id, true);
      }
    }

    const supplierSnapshotRows = supplierIds.map((supplierId) => {
      const supplierOrders = trackedOrders.filter((o: any) => o.supplier_id === supplierId);
      const supplierNegotiations = negotiations.filter((n: any) => n.supplier_id === supplierId);
      const supplierLeadTime = supplierOrders
        .map((order: any) => {
          if (!order.date || !order.last_delivery_date) return null;
          return countBusinessDays(
            new Date(order.date),
            new Date(order.last_delivery_date),
            holidaySet,
          );
        })
        .filter((value: number | null): value is number => typeof value === 'number');
      const supplierLeadAvg =
        supplierLeadTime.length > 0
          ? Number(
              (
                supplierLeadTime.reduce((acc: number, cur: number) => acc + cur, 0) /
                supplierLeadTime.length
              ).toFixed(2),
            )
          : null;

      return {
        snapshot_date: snapshotDate,
        supplier_id: supplierId,
        supplier_name: supplierNames.get(supplierId) || `Fornecedor ${supplierId}`,
        cotacoes_enviadas: supplierNegotiations.filter((n: any) => n.sent_at).length,
        cotacoes_respondidas: supplierNegotiations.filter((n: any) => n.supplier_answer_date)
          .length,
        pedidos_no_prazo: supplierOrders.filter(
          (o: any) => String(o.local_status).toUpperCase() === 'ENTREGUE',
        ).length,
        pedidos_atrasados: supplierOrders.filter(
          (o: any) => String(o.local_status).toUpperCase() === 'ATRASADO',
        ).length,
        pedidos_com_avaria: damages.filter((d: any) => d.supplier_id === supplierId).length,
        lead_time_medio_dias_uteis: supplierLeadAvg,
        confiabilidade: reliability(
          delays3mBySupplier.get(supplierId) === true,
          damages3mBySupplier.get(supplierId) === true,
        ),
        created_at: referenceNow,
      };
    });

    const buildingIds: number[] = [
      ...new Set(orders.map((o: any) => Number(o.building_id)).filter(Number.isFinite)),
    ];
    const buildingSnapshotRows = buildingIds.map((buildingId) => {
      const rows = trackedOrders.filter((o: any) => o.building_id === buildingId);
      const rowLead = rows
        .map((order: any) => {
          if (!order.date || !order.last_delivery_date) return null;
          return countBusinessDays(
            new Date(order.date),
            new Date(order.last_delivery_date),
            holidaySet,
          );
        })
        .filter((value: number | null): value is number => typeof value === 'number');
      const rowLeadAvg =
        rowLead.length > 0
          ? Number(
              (rowLead.reduce((acc: number, cur: number) => acc + cur, 0) / rowLead.length).toFixed(
                2,
              ),
            )
          : null;

      return {
        snapshot_date: snapshotDate,
        building_id: buildingId,
        building_name: `Obra ${buildingId}`,
        pedidos_no_prazo: rows.filter(
          (o: any) => String(o.local_status).toUpperCase() === 'ENTREGUE',
        ).length,
        pedidos_atrasados: rows.filter(
          (o: any) => String(o.local_status).toUpperCase() === 'ATRASADO',
        ).length,
        pedidos_com_avaria: damages.filter((d: any) => d.building_id === buildingId).length,
        lead_time_medio_dias_uteis: rowLeadAvg,
        created_at: referenceNow,
      };
    });

    const { data: orderItems } = await (supabase as any)
      .from('purchase_order_items')
      .select('purchase_order_id, item_number, description')
      .limit(1000);

    const criticalityRows = (orderItems || []).map((item: any) => {
      const order = orders.find((o: any) => o.id === item.purchase_order_id);
      const avgHistory = leadTimeAvg;
      const remainingDays = order?.last_delivery_date
        ? countBusinessDays(new Date(), new Date(order.last_delivery_date), holidaySet)
        : null;
      const isUrgent =
        typeof remainingDays === 'number' && typeof avgHistory === 'number'
          ? remainingDays < avgHistory
          : false;

      return {
        snapshot_date: snapshotDate,
        item_identifier: String(item.item_number),
        item_description: item.description ?? null,
        building_id: order?.building_id ?? null,
        prazo_obra_dias_uteis: remainingDays,
        media_historica_dias_uteis: avgHistory,
        criticidade: isUrgent ? 'urgente' : 'padrao',
        created_at: referenceNow,
      };
    });

    await (supabase as any).from('dashboard_snapshot').delete().eq('snapshot_date', snapshotDate);
    await (supabase as any)
      .from('dashboard_snapshot_por_fornecedor')
      .delete()
      .eq('snapshot_date', snapshotDate);
    await (supabase as any)
      .from('dashboard_snapshot_por_obra')
      .delete()
      .eq('snapshot_date', snapshotDate);
    await (supabase as any)
      .from('dashboard_criticidade_item')
      .delete()
      .eq('snapshot_date', snapshotDate);

    await (supabase as any).from('dashboard_snapshot').insert({
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
    });

    if (supplierSnapshotRows.length > 0) {
      await (supabase as any)
        .from('dashboard_snapshot_por_fornecedor')
        .insert(supplierSnapshotRows);
    }
    if (buildingSnapshotRows.length > 0) {
      await (supabase as any).from('dashboard_snapshot_por_obra').insert(buildingSnapshotRows);
    }
    if (criticalityRows.length > 0) {
      await (supabase as any).from('dashboard_criticidade_item').insert(criticalityRows);
    }

    await (supabase as any).from('audit_logs').insert({
      event_type: 'dashboard.snapshot_created',
      entity_type: 'dashboard_snapshot',
      entity_id: snapshotDate,
      metadata: {
        jobId: job.id,
        snapshot_date: snapshotDate,
        supplier_rows: supplierSnapshotRows.length,
        building_rows: buildingSnapshotRows.length,
        criticality_rows: criticalityRows.length,
        integration_failures: integrations.filter((event: any) => event.status === 'failure')
          .length,
      },
    });
  } catch (error: any) {
    await (supabase as any).from('audit_logs').insert({
      event_type: 'dashboard.consolidation_error',
      entity_type: 'dashboard_snapshot',
      entity_id: snapshotDate,
      metadata: {
        jobId: job.id,
        snapshot_date: snapshotDate,
        error: error?.message ?? 'Unknown error',
      },
    });
    throw error;
  }
}
