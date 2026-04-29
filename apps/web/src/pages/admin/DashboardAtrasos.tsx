import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';

type DelayPayload = {
  total_atrasados: number;
  taxa_atraso: number;
  atrasos_por_fornecedor: Array<{
    supplier_id: number;
    supplier_name: string;
    total_atrasados: number;
    taxa_atraso: number;
  }>;
};

export default function DashboardAtrasos() {
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
  }, [supplierId, buildingId]);

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
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
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
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
