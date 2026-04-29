import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';

type DamagePayload = {
  total_avarias: number;
  taxa_avaria: number;
  avarias_por_fornecedor: Array<{
    supplier_id: number;
    supplier_name: string;
    total_avarias: number;
    taxa_avaria: number;
  }>;
  avarias_por_acao_corretiva: { cancelamentos: number; reposicoes: number };
};

export default function DashboardAvarias() {
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
  }, [supplierId, buildingId]);

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
            Total avarias: {data.total_avarias} | Taxa: {data.taxa_avaria}% | Cancelamentos:{' '}
            {data.avarias_por_acao_corretiva.cancelamentos} | Reposições:{' '}
            {data.avarias_por_acao_corretiva.reposicoes}
          </div>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Total avarias</th>
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
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
