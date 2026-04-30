import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import { DashboardEvolutionChart } from './DashboardEvolutionChart';
import '../orders.css';
import './dashboard-prd.css';

type DelayPayload = {
  total_atrasados: number;
  taxa_atraso: number;
  atrasos_por_fornecedor: Array<{
    supplier_id: number;
    supplier_name: string;
    total_atrasados: number;
    taxa_atraso: number;
  }>;
  atrasos_por_obra: Array<{
    building_id: number;
    building_name: string | null;
    total_atrasados: number;
  }>;
  evolucao_diaria: Array<{ data: string; total_atrasados: number; taxa_atraso: number }>;
};

export default function DashboardAtrasos() {
  const [dataInicio, setDataInicio] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [supplierId, setSupplierId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [data, setData] = useState<DelayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/atrasos', {
        params: {
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          building_id: buildingId ? Number(buildingId) : undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar dashboard de atrasos'));
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
          <h1 className="o-page-title">Dashboard de Atrasos</h1>
          <p className="o-page-subtitle">Pedidos atrasados e taxa de atraso</p>
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
          <div className="q-notice q-notice--error">
            Total atrasados: {data.total_atrasados} | Taxa: {data.taxa_atraso}%
          </div>

          <DashboardEvolutionChart
            title="Evolução diária (pedidos atrasados)"
            data={data.evolucao_diaria}
            yKey="total_atrasados"
            yLabel="Atrasados"
            color="#dc2626"
          />

          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Total atrasados</th>
                  <th>Taxa atraso</th>
                </tr>
              </thead>
              <tbody>
                {data.atrasos_por_fornecedor.map((row) => (
                  <tr key={row.supplier_id}>
                    <td>{row.supplier_name}</td>
                    <td>{row.total_atrasados}</td>
                    <td>{row.taxa_atraso}%</td>
                  </tr>
                ))}
                {data.atrasos_por_fornecedor.length === 0 && (
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
            <h2 className="dashboard-chart__title">Atrasos por obra</h2>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Total atrasados</th>
                </tr>
              </thead>
              <tbody>
                {(data.atrasos_por_obra || []).map((row) => (
                  <tr key={row.building_id}>
                    <td>{row.building_name || `Obra ${row.building_id}`}</td>
                    <td>{row.total_atrasados}</td>
                  </tr>
                ))}
                {(data.atrasos_por_obra || []).length === 0 && (
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
