import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import { DashboardEvolutionChart } from './DashboardEvolutionChart';
import '../orders.css';
import './dashboard-prd.css';

type DamagePayload = {
  total_avarias: number;
  taxa_avaria: number;
  avarias_por_fornecedor: Array<{
    supplier_id: number;
    supplier_name: string;
    total_avarias: number;
    taxa_avaria: number;
  }>;
  avarias_por_obra?: Array<{
    building_id: number;
    building_name: string | null;
    total_avarias: number;
  }>;
  evolucao_diaria?: Array<{ data: string; total_avarias: number }>;
  avarias_por_acao_corretiva: { cancelamentos: number; reposicoes: number };
};

export default function DashboardAvarias() {
  const [dataInicio, setDataInicio] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [supplierId, setSupplierId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [data, setData] = useState<DamagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/avarias', {
        params: {
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          building_id: buildingId ? Number(buildingId) : undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar dashboard de avarias'));
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, supplierId, buildingId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Dashboard de Avarias</h1>
          <p className="o-page-subtitle">Avarias por fornecedor, obra e ação corretiva</p>
        </div>
      </div>

      <div className="dashboard-period o-filters">
        <div className="form-group">
          <label className="form-label">Data início</label>
          <input
            className="form-input"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Data fim</label>
          <input
            className="form-input"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      <DashboardFilters
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        buildingId={buildingId}
        setBuildingId={setBuildingId}
      />

      {loading && <div className="o-loading">Carregando...</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="q-notice">
            Registros de avaria no período: {data.total_avarias} | Taxa (pedidos com avaria / base):{' '}
            {data.taxa_avaria}% | Cancelamentos: {data.avarias_por_acao_corretiva.cancelamentos} |
            Reposições: {data.avarias_por_acao_corretiva.reposicoes}
          </div>

          <DashboardEvolutionChart
            title="Evolução diária (pedidos com avaria no snapshot)"
            data={data.evolucao_diaria || []}
            yKey="total_avarias"
            yLabel="Pedidos com avaria"
            color="#7c3aed"
          />

          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Pedidos com avaria (snapshot)</th>
                  <th>Taxa avaria</th>
                </tr>
              </thead>
              <tbody>
                {data.avarias_por_fornecedor.map((row) => (
                  <tr key={row.supplier_id}>
                    <td>{row.supplier_name}</td>
                    <td>{row.total_avarias}</td>
                    <td>{row.taxa_avaria}%</td>
                  </tr>
                ))}
                {data.avarias_por_fornecedor.length === 0 && (
                  <tr>
                    <td colSpan={3} className="o-empty">
                      Nenhum fornecedor no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
            <h2 className="dashboard-chart__title">Avarias por obra (pedidos distintos no dia)</h2>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Pedidos com avaria</th>
                </tr>
              </thead>
              <tbody>
                {(data.avarias_por_obra || []).map((row) => (
                  <tr key={row.building_id}>
                    <td>{row.building_name || `Obra ${row.building_id}`}</td>
                    <td>{row.total_avarias}</td>
                  </tr>
                ))}
                {(data.avarias_por_obra || []).length === 0 && (
                  <tr>
                    <td colSpan={2} className="o-empty">
                      Nenhuma obra no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
