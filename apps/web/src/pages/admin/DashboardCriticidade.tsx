import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';

type CriticalityPayload = {
  total_urgentes: number;
  total_padrao: number;
  itens: Array<{
    item_identifier: string;
    item_description?: string | null;
    building_id?: number | null;
    criticidade: 'urgente' | 'padrao';
    prazo_obra_dias_uteis?: number | null;
    media_historica_dias_uteis?: number | null;
  }>;
};

export default function DashboardCriticidade() {
  const [buildingId, setBuildingId] = useState('');
  const [itemIdentifier, setItemIdentifier] = useState('');
  const [data, setData] = useState<CriticalityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/criticidade', {
        params: {
          building_id: buildingId ? Number(buildingId) : undefined,
          item_identifier: itemIdentifier || undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar dashboard de criticidade'));
    } finally {
      setLoading(false);
    }
  }, [buildingId, itemIdentifier]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Dashboard de Criticidade</h1>
          <p className="o-page-subtitle">Itens classificados por criticidade operacional</p>
        </div>
      </div>

      <DashboardFilters
        buildingId={buildingId}
        setBuildingId={setBuildingId}
        itemIdentifier={itemIdentifier}
        setItemIdentifier={setItemIdentifier}
      />

      {loading && <div className="o-loading">Carregando...</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="q-notice">
            Urgentes: {data.total_urgentes} | Padrão: {data.total_padrao}
          </div>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th>Obra</th>
                  <th>Prazo obra (dias úteis)</th>
                  <th>Média histórica</th>
                  <th>Criticidade</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((row) => (
                  <tr key={`${row.item_identifier}-${row.building_id || 'n/a'}`}>
                    <td>{row.item_identifier}</td>
                    <td>{row.item_description || '—'}</td>
                    <td>{row.building_id || '—'}</td>
                    <td>{row.prazo_obra_dias_uteis ?? '—'}</td>
                    <td>{row.media_historica_dias_uteis ?? '—'}</td>
                    <td>
                      <span
                        className={
                          row.criticidade === 'urgente'
                            ? 'status-badge status-danger'
                            : 'status-badge'
                        }
                      >
                        {row.criticidade}
                      </span>
                    </td>
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
