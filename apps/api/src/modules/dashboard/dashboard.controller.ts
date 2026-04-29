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

export class DashboardController {
  constructor(private app: FastifyInstance) {}

  private async auditAccess(request: FastifyRequest, dashboard: string) {
    const userId = (request as any).user?.sub ?? null;
    await (this.app.supabase as any).from('audit_logs').insert({
      event_type: 'dashboard.access',
      actor_id: userId,
      entity_type: 'dashboard',
      entity_id: dashboard,
      metadata: {
        dashboard,
        query: request.query ?? {},
      },
    });
  }

  private sum(rows: any[], field: string): number {
    return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0);
  }

  private safeRate(numerator: number, denominator: number): number {
    if (!denominator) return 0;
    return Number(((numerator / denominator) * 100).toFixed(2));
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
      .lte('snapshot_date', period.endDate);
    if (query.supplier_id) {
      snapshotsQuery = (this.app.supabase as any)
        .from('dashboard_snapshot_por_fornecedor')
        .select('*')
        .eq('supplier_id', query.supplier_id)
        .gte('snapshot_date', period.startDate)
        .lte('snapshot_date', period.endDate);
    } else if (query.building_id) {
      snapshotsQuery = (this.app.supabase as any)
        .from('dashboard_snapshot_por_obra')
        .select('*')
        .eq('building_id', query.building_id)
        .gte('snapshot_date', period.startDate)
        .lte('snapshot_date', period.endDate);
    }
    const { data } = await snapshotsQuery;
    const rows = data || [];

    const cotacoesEnviadas = this.sum(rows, 'cotacoes_enviadas');
    const cotacoesRespondidas = this.sum(rows, 'cotacoes_respondidas');
    const cotacoesSemResposta = this.sum(rows, 'cotacoes_sem_resposta');
    const pedidosNoPrazo = this.sum(rows, 'pedidos_no_prazo');
    const pedidosAtrasados = this.sum(rows, 'pedidos_atrasados');
    const pedidosComAvaria = this.sum(rows, 'pedidos_com_avaria');
    const totalPedidosMonitorados = this.sum(rows, 'total_pedidos_monitorados');
    const leadRows = rows
      .map((row: any) => Number(row.lead_time_medio_dias_uteis))
      .filter((value: number) => Number.isFinite(value));
    const leadTimeMedio =
      leadRows.length > 0
        ? Number(
            (leadRows.reduce((acc: number, cur: number) => acc + cur, 0) / leadRows.length).toFixed(
              2,
            ),
          )
        : 0;

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
    const { data: supplierRows } = await baseQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRows } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('snapshot_date, lead_time_medio_dias_uteis')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    const leadValues = (globalRows || [])
      .map((row: any) => Number(row.lead_time_medio_dias_uteis))
      .filter((value: number) => Number.isFinite(value));
    const globalAvg =
      leadValues.length > 0
        ? Number(
            (
              leadValues.reduce((acc: number, cur: number) => acc + cur, 0) / leadValues.length
            ).toFixed(2),
          )
        : 0;

    await this.auditAccess(request, 'lead-time');
    return reply.send({
      lead_time_medio_global: globalAvg,
      lead_time_por_fornecedor: (supplierRows || []).map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
      })),
      lead_time_por_obra: (buildingRows || []).map((row: any) => ({
        building_id: row.building_id,
        building_name: row.building_name,
        lead_time_medio: row.lead_time_medio_dias_uteis ?? 0,
      })),
      evolucao_diaria: (globalRows || []).map((row: any) => ({
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
    const { data: supplierRows } = await supplierQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRows } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    const totalAtrasados = this.sum(globalRows || [], 'pedidos_atrasados');
    const totalMonitorados = this.sum(globalRows || [], 'total_pedidos_monitorados');

    await this.auditAccess(request, 'atrasos');
    return reply.send({
      total_atrasados: totalAtrasados,
      taxa_atraso: this.safeRate(totalAtrasados, totalMonitorados),
      atrasos_por_fornecedor: (supplierRows || []).map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        total_atrasados: row.pedidos_atrasados ?? 0,
        taxa_atraso: this.safeRate(
          row.pedidos_atrasados ?? 0,
          row.pedidos_no_prazo + row.pedidos_atrasados,
        ),
      })),
      atrasos_por_obra: (buildingRows || []).map((row: any) => ({
        building_id: row.building_id,
        building_name: row.building_name,
        total_atrasados: row.pedidos_atrasados ?? 0,
      })),
      evolucao_diaria: (globalRows || []).map((row: any) => ({
        data: row.snapshot_date,
        total_atrasados: row.pedidos_atrasados ?? 0,
        taxa_atraso: this.safeRate(row.pedidos_atrasados ?? 0, row.total_pedidos_monitorados ?? 0),
      })),
    });
  }

  async getCriticidade(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as DashboardCriticidadeQueryDto;
    let dataQuery = (this.app.supabase as any)
      .from('dashboard_criticidade_item')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (query.building_id) dataQuery = dataQuery.eq('building_id', query.building_id);
    if (query.item_identifier) dataQuery = dataQuery.eq('item_identifier', query.item_identifier);
    const { data } = await dataQuery;
    const rows = data || [];

    await this.auditAccess(request, 'criticidade');
    return reply.send({
      total_urgentes: rows.filter((row: any) => row.criticidade === 'urgente').length,
      total_padrao: rows.filter((row: any) => row.criticidade === 'padrao').length,
      itens: rows.map((row: any) => ({
        item_identifier: row.item_identifier,
        item_description: row.item_description,
        building_id: row.building_id,
        building_name: row.building_id ? `Obra ${row.building_id}` : null,
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

    await this.auditAccess(request, 'ranking-fornecedores');
    return reply.send({
      fornecedores: (data || []).map((row: any) => ({
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
    const { data: supplierRows } = await supplierQuery;

    let buildingQuery = (this.app.supabase as any)
      .from('dashboard_snapshot_por_obra')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate);
    if (query.building_id) buildingQuery = buildingQuery.eq('building_id', query.building_id);
    const { data: buildingRows } = await buildingQuery;

    const { data: globalRows } = await (this.app.supabase as any)
      .from('dashboard_snapshot')
      .select('*')
      .gte('snapshot_date', period.startDate)
      .lte('snapshot_date', period.endDate)
      .order('snapshot_date', { ascending: true });

    const { data: actions } = await (this.app.supabase as any)
      .from('damages')
      .select('final_action')
      .gte('created_at', `${period.startDate}T00:00:00.000Z`)
      .lte('created_at', `${period.endDate}T23:59:59.999Z`);

    const totalAvarias = this.sum(globalRows || [], 'pedidos_com_avaria');
    const totalMonitorados = this.sum(globalRows || [], 'total_pedidos_monitorados');

    await this.auditAccess(request, 'avarias');
    return reply.send({
      total_avarias: totalAvarias,
      taxa_avaria: this.safeRate(totalAvarias, totalMonitorados),
      avarias_por_fornecedor: (supplierRows || []).map((row: any) => ({
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        total_avarias: row.pedidos_com_avaria ?? 0,
        taxa_avaria: this.safeRate(
          row.pedidos_com_avaria ?? 0,
          row.pedidos_no_prazo + row.pedidos_atrasados,
        ),
      })),
      avarias_por_obra: (buildingRows || []).map((row: any) => ({
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
      evolucao_diaria: (globalRows || []).map((row: any) => ({
        data: row.snapshot_date,
        total_avarias: row.pedidos_com_avaria ?? 0,
      })),
    });
  }
}
