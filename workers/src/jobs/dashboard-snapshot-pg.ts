import pg from 'pg';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for atomic dashboard snapshot writes.');
    }
    pool = new pg.Pool({ connectionString, max: 3 });
  }
  return pool;
}

export type DashboardGlobalRow = {
  snapshot_date: string;
  cotacoes_enviadas: number;
  cotacoes_respondidas: number;
  cotacoes_sem_resposta: number;
  pedidos_no_prazo: number;
  pedidos_atrasados: number;
  pedidos_com_avaria: number;
  total_pedidos_monitorados: number;
  lead_time_medio_dias_uteis: number | null;
  created_at: string;
};

export type DashboardSupplierRow = {
  snapshot_date: string;
  supplier_id: number;
  supplier_name: string;
  cotacoes_enviadas: number;
  cotacoes_respondidas: number;
  pedidos_no_prazo: number;
  pedidos_atrasados: number;
  pedidos_com_avaria: number;
  lead_time_medio_dias_uteis: number | null;
  confiabilidade: string;
  created_at: string;
};

export type DashboardBuildingRow = {
  snapshot_date: string;
  building_id: number;
  building_name: string | null;
  pedidos_no_prazo: number;
  pedidos_atrasados: number;
  pedidos_com_avaria: number;
  lead_time_medio_dias_uteis: number | null;
  created_at: string;
};

export type DashboardCriticalityRow = {
  snapshot_date: string;
  item_identifier: string;
  item_description: string | null;
  building_id: number | null;
  prazo_obra_dias_uteis: number | null;
  media_historica_dias_uteis: number | null;
  criticidade: string;
  created_at: string;
};

/**
 * Deletes existing rows for snapshot_date and inserts the new bundle in one transaction.
 */
export async function replaceDashboardSnapshotBundle(
  snapshotDate: string,
  globalRow: DashboardGlobalRow,
  supplierRows: DashboardSupplierRow[],
  buildingRows: DashboardBuildingRow[],
  criticalityRows: DashboardCriticalityRow[],
): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM public.dashboard_criticidade_item WHERE snapshot_date = $1', [
      snapshotDate,
    ]);
    await client.query('DELETE FROM public.dashboard_snapshot_por_obra WHERE snapshot_date = $1', [
      snapshotDate,
    ]);
    await client.query(
      'DELETE FROM public.dashboard_snapshot_por_fornecedor WHERE snapshot_date = $1',
      [snapshotDate],
    );
    await client.query('DELETE FROM public.dashboard_snapshot WHERE snapshot_date = $1', [
      snapshotDate,
    ]);

    await client.query(
      `INSERT INTO public.dashboard_snapshot (
        snapshot_date, cotacoes_enviadas, cotacoes_respondidas, cotacoes_sem_resposta,
        pedidos_no_prazo, pedidos_atrasados, pedidos_com_avaria, total_pedidos_monitorados,
        lead_time_medio_dias_uteis, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz)`,
      [
        globalRow.snapshot_date,
        globalRow.cotacoes_enviadas,
        globalRow.cotacoes_respondidas,
        globalRow.cotacoes_sem_resposta,
        globalRow.pedidos_no_prazo,
        globalRow.pedidos_atrasados,
        globalRow.pedidos_com_avaria,
        globalRow.total_pedidos_monitorados,
        globalRow.lead_time_medio_dias_uteis,
        globalRow.created_at,
      ],
    );

    for (const r of supplierRows) {
      await client.query(
        `INSERT INTO public.dashboard_snapshot_por_fornecedor (
          snapshot_date, supplier_id, supplier_name, cotacoes_enviadas, cotacoes_respondidas,
          pedidos_no_prazo, pedidos_atrasados, pedidos_com_avaria, lead_time_medio_dias_uteis,
          confiabilidade, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz)`,
        [
          r.snapshot_date,
          r.supplier_id,
          r.supplier_name,
          r.cotacoes_enviadas,
          r.cotacoes_respondidas,
          r.pedidos_no_prazo,
          r.pedidos_atrasados,
          r.pedidos_com_avaria,
          r.lead_time_medio_dias_uteis,
          r.confiabilidade,
          r.created_at,
        ],
      );
    }

    for (const r of buildingRows) {
      await client.query(
        `INSERT INTO public.dashboard_snapshot_por_obra (
          snapshot_date, building_id, building_name, pedidos_no_prazo, pedidos_atrasados,
          pedidos_com_avaria, lead_time_medio_dias_uteis, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)`,
        [
          r.snapshot_date,
          r.building_id,
          r.building_name,
          r.pedidos_no_prazo,
          r.pedidos_atrasados,
          r.pedidos_com_avaria,
          r.lead_time_medio_dias_uteis,
          r.created_at,
        ],
      );
    }

    for (const r of criticalityRows) {
      await client.query(
        `INSERT INTO public.dashboard_criticidade_item (
          snapshot_date, item_identifier, item_description, building_id,
          prazo_obra_dias_uteis, media_historica_dias_uteis, criticidade, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz)`,
        [
          r.snapshot_date,
          r.item_identifier,
          r.item_description,
          r.building_id,
          r.prazo_obra_dias_uteis,
          r.media_historica_dias_uteis,
          r.criticidade,
          r.created_at,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
