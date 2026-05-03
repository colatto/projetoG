/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  DashboardAtrasosQueryDto,
  DashboardAvariasQueryDto,
  DashboardCriticidadeQueryDto,
  DashboardKpisQueryDto,
  DashboardLeadTimeQueryDto,
  DashboardRankingFornecedoresQueryDto,
  DashboardResumoQueryDto,
} from '@projetog/shared';

import { AuditService } from '../audit/audit.service.js';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod(inputStart?: string, inputEnd?: string) {
  const end = inputEnd ? new Date(`${inputEnd}T00:00:00.000Z`) : new Date();
  const start = inputStart ? new Date(`${inputStart}T00:00:00.000Z`) : new Date(end);
  if (!inputStart) {
    start.setDate(end.getDate() - 30);
  }

  const startDate = toIsoDate(start);
  const endDate = toIsoDate(end);
  if (startDate > endDate) {
    throw new Error('Período inválido (data_inicio > data_fim).');
  }
  return { startDate, endDate };
}

/** One row per supplier_id: row from the latest snapshot_date in the set. */
function aggregateLatestPerSupplier<T extends { supplier_id: number; snapshot_date: string }>(
  rows: T[],
): T[] {
  const bySup = new Map<number, T>();
  for (const row of rows) {
    const existing = bySup.get(row.supplier_id);
    if (!existing || String(row.snapshot_date) > String(existing.snapshot_date)) {
      bySup.set(row.supplier_id, row);
    }
  }
  return Array.from(bySup.values()).sort(
    (a: any, b: any) => (b.pedidos_atrasados ?? 0) - (a.pedidos_atrasados ?? 0),
  );
}

/** One row per building_id: row from the latest snapshot_date in the set. */
function aggregateLatestPerBuilding<T extends { building_id: number; snapshot_date: string }>(
  rows: T[],
): T[] {
  const byB = new Map<number, T>();
  for (const row of rows) {
    const existing = byB.get(row.building_id);
    if (!existing || String(row.snapshot_date) > String(existing.snapshot_date)) {
      byB.set(row.building_id, row);
    }
  }
  return Array.from(byB.values()).sort((a: any, b: any) => a.building_id - b.building_id);
}

/** Latest global snapshot row in range (by snapshot_date). */
function pickLatestGlobalRow(rows: any[]): any | null {
  if (!rows.length) return null;
  return rows.reduce((best: any, row: any) =>
    String(row.snapshot_date) > String(best.snapshot_date) ? row : best,
  rows[0]);
}

type DashboardDimensionalQuery = {
  supplier_id?: number;
  building_id?: number;
  purchase_order_id?: number;
  item_identifier?: string;
};

export class DashboardController {
  private audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private async auditAccess(request: FastifyRequest, dashboard: string) {
    const userId = (request as any).user?.sub ?? null;
    await this.audit.registerEvent({
      eventType: 'dashboard.access',
      actorId: userId,
      actorType: 'user',
      entityType: 'dashboard',
      entityId: dashboard,
      summary: `Acesso ao dashboard ${dashboard}`,
      metadata: {
        dashboard,
        query: request.query ?? {},
      },
    });
  }

  /**
   * Narrows supplier/building snapshot aggregates to the PO and/or item scope (same rules as lead time).
   */
  private async narrowAggregatesByPurchaseOrderAndItem(
    supplierAgg: any[],
    buildingAgg: any[],
    purchase_order_id?: number,
    item_identifier?: string,
  ): Promise<{ supplierAgg: any[]; buildingAgg: any[] }> {
    let sAgg = supplierAgg;
    let bAgg = buildingAgg;
    const orderId = purchase_order_id;
    if (orderId) {
      const { data: poRow } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('id, supplier_id, building_id')
        .eq('id', orderId)
        .maybeSingle();
      if (!poRow || Number(poRow.id) !== Number(orderId)) {
        return { supplierAgg: [], buildingAgg: [] };
      }
      sAgg = sAgg.filter((r: any) => r.supplier_id === poRow.supplier_id);
      bAgg = bAgg.filter((r: any) => r.building_id === poRow.building_id);
    }
    if (item_identifier) {
      let itemQ = (this.app.supabase as any)
        .from('purchase_order_items')
        .select('purchase_order_id, item_number')
        .eq('item_number', item_identifier);
      if (orderId) itemQ = itemQ.eq('purchase_order_id', orderId);
      const { data: itemRows } = await itemQ.limit(2000);
      const orderIds = new Set((itemRows || []).map((r: any) => r.purchase_order_id));
      if (orderIds.size === 0) {
        return { supplierAgg: [], buildingAgg: [] };
      }
      const { data: ordersForItems } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('id, supplier_id, building_id')
        .in('id', Array.from(orderIds));
      const supIds = new Set((ordersForItems || []).map((o: any) => o.supplier_id));
      const bIds = new Set((ordersForItems || []).map((o: any) => o.building_id));
      sAgg = sAgg.filter((r: any) => supIds.has(r.supplier_id));
      bAgg = bAgg.filter((r: any) => bIds.has(r.building_id));
    }
    return { supplierAgg: sAgg, buildingAgg: bAgg };
  }

  /** Headline totals: scoped when any dashboard dimension filter is active; else latest global snapshot. */
  private headlineFromSnapshots(
    query: DashboardDimensionalQuery,
    supplierAgg: any[],
    buildingAgg: any[],
    globalRows: any[],
    metric: 'atrasos' | 'avaria',
  ): { primary: number; monitorBase: number } {
    const scoped =
      !!query.supplier_id ||
      !!query.building_id ||
      !!query.purchase_order_id ||
      !!query.item_identifier;
    const field = metric === 'atrasos' ? 'pedidos_atrasados' : 'pedidos_com_avaria';
    const sumMonitor = (rows: any[]) =>
      rows.reduce(
        (acc, r) => acc + (Number(r.pedidos_no_prazo) || 0) + (Number(r.pedidos_atrasados) || 0),
        0,
      );
    if (scoped) {
      if (query.supplier_id) {
        if (!supplierAgg.length) return { primary: 0, monitorBase: 0 };
        const primary = supplierAgg.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
        return { primary, monitorBase: sumMonitor(supplierAgg) };
      }
      if (query.building_id) {
        if (!buildingAgg.length) return { primary: 0, monitorBase: 0 };
        const primary = buildingAgg.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
        return { primary, monitorBase: sumMonitor(buildingAgg) };
      }
      if (!supplierAgg.length && !buildingAgg.length) return { primary: 0, monitorBase: 0 };
      const primary = supplierAgg.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
      const base = sumMonitor(supplierAgg);
      return { primary, monitorBase: base };
    }
    const latestGlobal = pickLatestGlobalRow(globalRows || []);
    const primary = Number(latestGlobal?.[field]) || 0;
    const monitorBase = Number(latestGlobal?.total_pedidos_monitorados) || 0;
    return { primary, monitorBase };
  }

  private async allowedRankingSupplierIds(query: DashboardDimensionalQuery): Promise<Set<number> | null> {
    const constraints: Set<number>[] = [];
    if (query.supplier_id) constraints.push(new Set([Number(query.supplier_id)]));
    if (query.building_id) {
      const { data: rows } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('supplier_id')
        .eq('building_id', query.building_id)
        .limit(5000);
      const supplierIds = (rows || [])
        .map((r: any) => Number(r.supplier_id))
        .filter((id: number): id is number => Number.isFinite(id));
      const s = new Set<number>(supplierIds);
      constraints.push(s);
    }
    if (query.purchase_order_id) {
      const { data: po } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', query.purchase_order_id)
        .maybeSingle();
      if (!po) return new Set();
      constraints.push(new Set([Number(po.supplier_id)]));
    }
    if (query.item_identifier) {
      let itemQ = (this.app.supabase as any)
        .from('purchase_order_items')
        .select('purchase_order_id')
        .eq('item_number', query.item_identifier)
        .limit(2000);
      if (query.purchase_order_id) itemQ = itemQ.eq('purchase_order_id', query.purchase_order_id);
      const { data: itemRows } = await itemQ;
      const ids = [...new Set((itemRows || []).map((r: any) => r.purchase_order_id))];
      if (!ids.length) return new Set();
      const { data: orders } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('supplier_id')
        .in('id', ids)
        .limit(5000);
      const orderSupplierIds = (orders || [])
        .map((o: any) => Number(o.supplier_id))
        .filter((id: number): id is number => Number.isFinite(id));
      constraints.push(new Set<number>(orderSupplierIds));
    }
    if (!constraints.length) return null;
    let acc = constraints[0];
    for (let i = 1; i < constraints.length; i++) {
      acc = new Set([...acc].filter((id) => constraints[i].has(id)));
    }
    return acc;
  }

  private evolutionSeriesScoped(globalRows: any[], query: DashboardDimensionalQuery) {
    if (query.purchase_order_id || query.item_identifier) return [];
    return globalRows || [];
  }

  private appendDamageDimensionalFilters(chain: any, query: DashboardDimensionalQuery) {
    let q = chain;
    if (query.purchase_order_id) q = q.eq('purchase_order_id', query.purchase_order_id);
    if (query.item_identifier) q = q.eq('item_number', query.item_identifier);
    if (query.supplier_id) q = q.eq('supplier_id', query.supplier_id);
    if (query.building_id) q = q.eq('building_id', query.building_id);
    return q;
  }

  private sum(rows: any[], field: string): number {
    return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
  }

  private safeRate(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Number(((numerator / denominator) * 100).toFixed(2));
  }

  /** Latest snapshot_date that exists in dashboard_snapshot (any row). */
  private async resolveLatestSnapshotDate(): Promise<string | null> {
    const { data } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.snapshot_date ?? null;
  }

  async getResumo(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardResumoQueryDto;
    const dateFilter = query.data_referencia;

    const snapshotQuery = (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1);

    const { data: snapshot } = dateFilter
      ? await (this.app.supabase as any)
          .from('dashboard_snapshot')
          .select('*')
          .eq('snapshot_date', dateFilter)
          .maybeSingle()
      : await snapshotQuery.maybeSingle();

    if (!snapshot) {
      return reply.code(404).send({ message: 'Nenhum snapshot disponível.' });
    }

    const [openNegotiations, waitingReview, integrationFailures] = await Promise.all([
      (this.app.supabase as any)
        .from('supplier_negotiations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['ENVIADA', 'ABERTA', 'EM_NEGOCIACAO']),
      (this.app.supabase as any)
        .from('supplier_negotiations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'AGUARDANDO_REVISAO'),
      (this.app.supabase as any)
        .from('integration_events')
        .select('id', { count: 'exact', head: true })
        .in('status', ['failure', 'retry_scheduled']),
    ]);

    await this.auditAccess(request, 'resumo');
    return reply.send({
      cotacoes_abertas: openNegotiations.count ?? 0,
      cotacoes_aguardando_revisao: waitingReview.count ?? 0,
      pedidos_atrasados: snapshot.pedidos_atrasados ?? 0,
      pedidos_em_avaria: snapshot.pedidos_com_avaria ?? 0,
      falhas_integracao: integrationFailures.count ?? 0,
      data_snapshot: snapshot.snapshot_date,
    });
  }

  async getKpis(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardKpisQueryDto;
    let period;
    try {
      period = defaultPeriod(query.data_inicio, query.data_fim);
    } catch (error: any) {
      return reply.badRequest(error.message);
    }

    let snapshotsQuery = (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });
    if (query.supplier_id) {
      snapshotsQuery = (this.app.supabase as any)
        .from('dashboard_snapshot_por_fornecedor')
        .select('*')
        .eq('supplier_id', query.supplier_id)
        .gte('snapshot_date', period.startDate)
        .lte('snapshot_date', period.endDate)
        .order('snapshot_date', { ascending: true });
    } else if (query.building_id) {
      snapshotsQuery = (this.app.supabase as any)
        .from('dashboard_snapshot_por_obra')
        .select('*')
        .eq('building_id', query.building_id)
        .gte('snapshot_date', period.startDate)
        .lte('snapshot_date', period.endDate)
        .order('snapshot_date', { ascending: true });
    }
    const { data } = await snapshotsQuery;
    const rows = data || [];

    let cotacoesEnviadas = 0;
    let cotacoesRespondidas = 0;
    let cotacoesSemResposta = 0;
    let pedidosNoPrazo = 0;
    let pedidosAtrasados = 0;
    let pedidosComAvaria = 0;
    let totalPedidosMonitorados = 0;
    let leadTimeMedio = 0;

    if (query.supplier_id || query.building_id) {
      const latest = rows.length ? rows[rows.length - 1] : null;
      cotacoesEnviadas = latest?.cotacoes_enviadas ?? 0;
      cotacoesRespondidas = latest?.cotacoes_respondidas ?? 0;
      cotacoesSemResposta = latest?.cotacoes_sem_resposta ?? 0;
      pedidosNoPrazo = latest?.pedidos_no_prazo ?? 0;
      pedidosAtrasados = latest?.pedidos_atrasados ?? 0;
      pedidosComAvaria = latest?.pedidos_com_avaria ?? 0;
      const sumPrazo =
        (latest?.pedidos_no_prazo ?? 0) + (latest?.pedidos_atrasados ?? 0);
      totalPedidosMonitorados =
        typeof latest?.total_pedidos_monitorados === 'number'
          ? latest.total_pedidos_monitorados
          : sumPrazo;
      const lt = Number(latest?.lead_time_medio_dias_uteis);
      leadTimeMedio = Number.isFinite(lt) ? lt : 0;
    } else {
      cotacoesEnviadas = this.sum(rows, 'cotacoes_enviadas');
      cotacoesRespondidas = this.sum(rows, 'cotacoes_respondidas');
      cotacoesSemResposta = this.sum(rows, 'cotacoes_sem_resposta');
      const latestGlobal = pickLatestGlobalRow(rows);
      pedidosNoPrazo = latestGlobal?.pedidos_no_prazo ?? 0;
      pedidosAtrasados = latestGlobal?.pedidos_atrasados ?? 0;
      pedidosComAvaria = latestGlobal?.pedidos_com_avaria ?? 0;
      totalPedidosMonitorados = latestGlobal?.total_pedidos_monitorados ?? 0;
      const leadRows = rows
        .map((row: any) => Number(row.lead_time_medio_dias_uteis))
        .filter((value: number) => Number.isFinite(value));
      leadTimeMedio =
        leadRows.length > 0
          ? Number(
              (leadRows.reduce((acc: number, cur: number) => acc + cur, 0) / leadRows.length).toFixed(
                2,
              ),
            )
          : 0;
    }

    await this.auditAccess(request, 'kpis');
    return reply.send({
      cotacoes_enviadas: cotacoesEnviadas,
      cotacoes_respondidas: cotacoesRespondidas,
      cotacoes_sem_resposta: cotacoesSemResposta,
      pedidos_no_prazo: pedidosNoPrazo,
      pedidos_atrasados: pedidosAtrasados,
      pedidos_com_avaria: pedidosComAvaria,
      taxa_resposta_cotacao: this.safeRate(cotacoesRespondidas, cotacoesEnviadas),
      taxa_cotacoes_sem_resposta: this.safeRate(cotacoesSemResposta, cotacoesEnviadas),
      taxa_pedidos_no_prazo: this.safeRate(pedidosNoPrazo, totalPedidosMonitorados),
      taxa_atraso: this.safeRate(pedidosAtrasados, totalPedidosMonitorados),
      taxa_avaria: this.safeRate(pedidosComAvaria, totalPedidosMonitorados),
      lead_time_medio_dias_uteis: leadTimeMedio,
      total_pedidos_monitorados: totalPedidosMonitorados,
      periodo: {
        data_inicio: period.startDate,
        data_fim: period.endDate,
      },
    });
  }

  async getLeadTime(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardLeadTimeQueryDto;
    let period;
    try {
      period = defaultPeriod(query.data_inicio, query.data_fim);
    } catch (error: any) {
      return reply.badRequest(error.message);
    }

    let baseQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_fornecedor')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.supplier_id) baseQuery = baseQuery.eq('supplier_id', query.supplier_id);
    const { data: supplierRowsRaw } = await baseQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRowsRaw } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('snapshot_date, lead_time_medio_dias_uteis')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    let supplierAgg = aggregateLatestPerSupplier(supplierRowsRaw || []);
    let buildingAgg = aggregateLatestPerBuilding(buildingRowsRaw || []);
    const narrowed = await this.narrowAggregatesByPurchaseOrderAndItem(
      supplierAgg,
      buildingAgg,
      query.purchase_order_id,
      query.item_identifier,
    );
    supplierAgg = narrowed.supplierAgg;
    buildingAgg = narrowed.buildingAgg;

    let globalAvg: number;
    if (query.purchase_order_id || query.item_identifier) {
      const vals = supplierAgg
        .map((row: any) => Number(row.lead_time_medio_dias_uteis))
        .filter((value: number) => Number.isFinite(value));
      globalAvg =
        vals.length > 0
          ? Number((vals.reduce((acc: number, cur: number) => acc + cur, 0) / vals.length).toFixed(2))
          : 0;
    } else {
      const leadValues = (globalRows || [])
        .map((row: any) => Number(row.lead_time_medio_dias_uteis))
        .filter((value: number) => Number.isFinite(value));
      globalAvg =
        leadValues.length > 0
          ? Number(
              (
                leadValues.reduce((acc: number, cur: number) => acc + cur, 0) / leadValues.length
              ).toFixed(2),
            )
          : 0;
    }

    const globalSeries = this.evolutionSeriesScoped(globalRows || [], query);

    await this.auditAccess(request, 'lead-time');
    return reply.send({
      lead_time_medio_global: globalAvg,
      lead_time_por_fornecedor: supplierAgg.map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
      })),
      lead_time_por_obra: buildingAgg.map((row: any) => ({
        building_id: row.building_id,
        building_name: row.building_name,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
      })),
      evolucao_diaria: globalSeries.map((row: any) => ({
        data: row.snapshot_date,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
      })),
    });
  }

  async getAtrasos(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardAtrasosQueryDto;
    let period;
    try {
      period = defaultPeriod(query.data_inicio, query.data_fim);
    } catch (error: any) {
      return reply.badRequest(error.message);
    }

    let supplierQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_fornecedor')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.supplier_id) supplierQuery = supplierQuery.eq('supplier_id', query.supplier_id);
    const { data: supplierRowsRaw } = await supplierQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRowsRaw } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    let supplierAgg = aggregateLatestPerSupplier(supplierRowsRaw || []);
    let buildingAgg = aggregateLatestPerBuilding(buildingRowsRaw || []);
    const narrowedA = await this.narrowAggregatesByPurchaseOrderAndItem(
      supplierAgg,
      buildingAgg,
      query.purchase_order_id,
      query.item_identifier,
    );
    supplierAgg = narrowedA.supplierAgg;
    buildingAgg = narrowedA.buildingAgg;

    const { primary: totalAtrasados, monitorBase: totalMonitorados } = this.headlineFromSnapshots(
      query,
      supplierAgg,
      buildingAgg,
      globalRows || [],
      'atrasos',
    );

    const series = this.evolutionSeriesScoped(globalRows || [], query);

    await this.auditAccess(request, 'atrasos');
    return reply.send({
      total_atrasados: totalAtrasados,
      taxa_atraso: this.safeRate(totalAtrasados, totalMonitorados),
      atrasos_por_fornecedor: supplierAgg.map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        total_atrasados: row.pedidos_atrasados ?? 0,
        taxa_atraso: this.safeRate(
          row.pedidos_atrasados ?? 0,
          (row.pedidos_no_prazo ?? 0) + (row.pedidos_atrasados ?? 0),
        ),
      })),
      atrasos_por_obra: buildingAgg.map((row: any) => ({
        building_id: row.building_id,
        building_name: row.building_name,
        total_atrasados: row.pedidos_atrasados ?? 0,
      })),
      evolucao_diaria: series.map((row: any) => ({
        data: row.snapshot_date,
        total_atrasados: row.pedidos_atrasados ?? 0,
        taxa_atraso: this.safeRate(row.pedidos_atrasados ?? 0, row.total_pedidos_monitorados ?? 0),
      })),
    });
  }

  async getCriticidade(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardCriticidadeQueryDto;
    if (query.purchase_order_id && query.supplier_id) {
      const { data: poCheck } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('supplier_id')
        .eq('id', query.purchase_order_id)
        .maybeSingle();
      if (!poCheck) {
        return reply.badRequest('Pedido não encontrado.');
      }
      if (Number(poCheck.supplier_id) !== Number(query.supplier_id)) {
        return reply.badRequest('Fornecedor não corresponde ao pedido informado.');
      }
    }
    const snapshotDate =
      query.data_referencia ?? (await this.resolveLatestSnapshotDate());
    if (!snapshotDate) {
      await this.auditAccess(request, 'criticidade');
      return reply.send({
        data_snapshot: null,
        total_urgentes: 0,
        total_padrao: 0,
        itens: [],
      });
    }

    let dataQuery = (this.app.supabase as any)
      .from('dashboard_criticidade_item')
      .select('*')
      .eq('snapshot_date', snapshotDate)
      .order('item_identifier', { ascending: true })
      .limit(5000);
    if (query.building_id) dataQuery = dataQuery.eq('building_id', query.building_id);
    if (query.item_identifier) dataQuery = dataQuery.eq('item_identifier', query.item_identifier);
    const { data } = await dataQuery;
    let rows = data || [];

    if (query.purchase_order_id) {
      const { data: poRow } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('id, building_id')
        .eq('id', query.purchase_order_id)
        .maybeSingle();
      if (!poRow) {
        await this.auditAccess(request, 'criticidade');
        return reply.badRequest('Pedido não encontrado.');
      }
      const { data: poItems } = await (this.app.supabase as any)
        .from('purchase_order_items')
        .select('item_number')
        .eq('purchase_order_id', query.purchase_order_id)
        .limit(2000);
      const nums = new Set((poItems || []).map((r: any) => String(r.item_number)));
      rows = rows.filter((r: any) => {
        if (!nums.has(String(r.item_identifier))) return false;
        if (r.building_id != null && Number(r.building_id) !== Number(poRow.building_id)) {
          return false;
        }
        return true;
      });
    }

    if (query.supplier_id) {
      const { data: poIds } = await (this.app.supabase as any)
        .from('purchase_orders')
        .select('id')
        .eq('supplier_id', query.supplier_id)
        .limit(5000);
      const ids = (poIds || []).map((r: any) => r.id);
      if (!ids.length) {
        rows = [];
      } else {
        const { data: poItems } = await (this.app.supabase as any)
          .from('purchase_order_items')
          .select('item_number')
          .in('purchase_order_id', ids)
          .limit(10000);
        const allowed = new Set((poItems || []).map((r: any) => String(r.item_number)));
        rows = rows.filter((r: any) => allowed.has(String(r.item_identifier)));
      }
    }

    const buildingIds = [
      ...new Set(
        rows.map((r: any) => r.building_id).filter((id: unknown) => typeof id === 'number'),
      ),
    ] as number[];
    const buildingNameById = new Map<number, string>();
    if (buildingIds.length > 0) {
      const { data: oba } = await (this.app.supabase as any)
        .from('dashboard_snapshot_por_obra')
        .select('building_id, building_name')
        .eq('snapshot_date', snapshotDate)
        .in('building_id', buildingIds);
      for (const r of oba || []) {
        if (r.building_id != null && r.building_name) {
          buildingNameById.set(r.building_id, r.building_name);
        }
      }
    }

    await this.auditAccess(request, 'criticidade');
    return reply.send({
      data_snapshot: snapshotDate,
      total_urgentes: rows.filter((row: any) => row.criticidade === 'urgente').length,
      total_padrao: rows.filter((row: any) => row.criticidade === 'padrao').length,
      itens: rows.map((row: any) => ({
        item_identifier: row.item_identifier,
        item_description: row.item_description,
        building_id: row.building_id,
        building_name:
          row.building_id != null
            ? buildingNameById.get(row.building_id) ?? `Obra ${row.building_id}`
            : null,
        prazo_obra_dias_uteis: row.prazo_obra_dias_uteis,
        media_historica_dias_uteis: row.media_historica_dias_uteis,
        criticidade: row.criticidade,
      })),
    });
  }

  async getRankingFornecedores(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardRankingFornecedoresQueryDto;
    let period;
    try {
      period = defaultPeriod(query.data_inicio, query.data_fim);
    } catch (error: any) {
      return reply.badRequest(error.message);
    }

    const { data } = await (this.app.supabase as any)
      .from('dashboard_snapshot_por_fornecedor')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('pedidos_atrasados', { ascending: false });

    let aggregated = aggregateLatestPerSupplier(data || []);
    const allowed = await this.allowedRankingSupplierIds(query);
    if (allowed !== null) {
      aggregated = aggregated.filter((row: any) => allowed.has(Number(row.supplier_id)));
    }

    await this.auditAccess(request, 'ranking-fornecedores');
    return reply.send({
      fornecedores: aggregated.map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        cotacoes_enviadas: row.cotacoes_enviadas,
        cotacoes_respondidas: row.cotacoes_respondidas,
        taxa_resposta: this.safeRate(row.cotacoes_respondidas, row.cotacoes_enviadas),
        pedidos_no_prazo: row.pedidos_no_prazo,
        pedidos_atrasados: row.pedidos_atrasados,
        pedidos_com_avaria: row.pedidos_com_avaria,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
        confiabilidade: row.confiabilidade,
      })),
    });
  }

  async getAvarias(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardAvariasQueryDto;
    let period;
    try {
      period = defaultPeriod(query.data_inicio, query.data_fim);
    } catch (error: any) {
      return reply.badRequest(error.message);
    }

    let supplierQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_fornecedor')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.supplier_id) supplierQuery = supplierQuery.eq('supplier_id', query.supplier_id);
    const { data: supplierRowsRaw } = await supplierQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRowsRaw } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    let damagesActions = (this.app.supabase as any)
      .from('damages')
      .select('final_action')
      .gte('created_at', `${period.startDate}T00:00:00.000Z`)
      .lte('created_at', `${period.endDate}T23:59:59.999Z`);
    damagesActions = this.appendDamageDimensionalFilters(damagesActions, query);

    let damagesCount = (this.app.supabase as any)
      .from('damages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${period.startDate}T00:00:00.000Z`)
      .lte('created_at', `${period.endDate}T23:59:59.999Z`);
    damagesCount = this.appendDamageDimensionalFilters(damagesCount, query);

    const [{ data: actions }, { count: damageEventsCount }] = await Promise.all([
      damagesActions,
      damagesCount,
    ]);

    let supplierAgg = aggregateLatestPerSupplier(supplierRowsRaw || []);
    let buildingAgg = aggregateLatestPerBuilding(buildingRowsRaw || []);
    const narrowedAv = await this.narrowAggregatesByPurchaseOrderAndItem(
      supplierAgg,
      buildingAgg,
      query.purchase_order_id,
      query.item_identifier,
    );
    supplierAgg = narrowedAv.supplierAgg;
    buildingAgg = narrowedAv.buildingAgg;

    const { primary: pedidosComAvariaPonto, monitorBase: totalMonitorados } =
      this.headlineFromSnapshots(query, supplierAgg, buildingAgg, globalRows || [], 'avaria');

    const seriesAv = this.evolutionSeriesScoped(globalRows || [], query);

    await this.auditAccess(request, 'avarias');
    return reply.send({
      total_avarias: damageEventsCount ?? 0,
      taxa_avaria: this.safeRate(pedidosComAvariaPonto, totalMonitorados),
      avarias_por_fornecedor: supplierAgg.map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        total_avarias: row.pedidos_com_avaria ?? 0,
        taxa_avaria: this.safeRate(
          row.pedidos_com_avaria ?? 0,
          (row.pedidos_no_prazo ?? 0) + (row.pedidos_atrasados ?? 0),
        ),
      })),
      avarias_por_obra: buildingAgg.map((row: any) => ({
        building_id: row.building_id,
        building_name: row.building_name,
        total_avarias: row.pedidos_com_avaria ?? 0,
      })),
      avarias_por_acao_corretiva: {
        cancelamentos: (actions || []).filter((row: any) =>
          ['CANCELAMENTO_PARCIAL', 'CANCELAMENTO_TOTAL'].includes(
            String(row.final_action || '').toUpperCase(),
          ),
        ).length,
        reposicoes: (actions || []).filter(
          (row: any) => String(row.final_action || '').toUpperCase() === 'REPOSICAO',
        ).length,
      },
      evolucao_diaria: seriesAv.map((row: any) => ({
        data: row.snapshot_date,
        total_avarias: row.pedidos_com_avaria ?? 0,
      })),
    });
  }
}

