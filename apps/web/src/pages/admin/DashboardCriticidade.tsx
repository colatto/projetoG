import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';
import './dashboard-prd.css';

type CriticalityPayload = {
  data_snapshot?: string | null;
  total_urgentes: number;
  total_padrao: number;
  itens: Array<{
    item_identifier: string;
    item_description?: string | null;
    building_id?: number | null;
    building_name?: string | null;
    criticidade: 'urgente' | 'padrao';
    prazo_obra_dias_uteis?: number | null;
    media_historica_dias_uteis?: number | null;
  }>;
};

export default function DashboardCriticidade() {
  const [dataReferencia, setDataReferencia] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
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
          data_referencia: dataReferencia || undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          building_id: buildingId ? Number(buildingId) : undefined,
          purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : undefined,
          item_identifier: itemIdentifier || undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar dashboard de criticidade'));
    } finally {
      setLoading(false);
    }
  }, [dataReferencia, supplierId, buildingId, purchaseOrderId, itemIdentifier]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Dashboard de Criticidade</h1>
          <p className="o-page-subtitle">Itens classificados por criticidade operacional</p>
        </div>
      </div>

      <div className="dashboard-period o-filters">
        <div className="form-group">
          <label className="form-label">Data do snapshot (opcional)</label>
          <input
            className="form-input"
            type="date"
            value={dataReferencia}
            onChange={(e) => setDataReferencia(e.target.value)}
          />
        </div>
      </div>

      <DashboardFilters
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        buildingId={buildingId}
        setBuildingId={setBuildingId}
        purchaseOrderId={purchaseOrderId}
        setPurchaseOrderId={setPurchaseOrderId}
        itemIdentifier={itemIdentifier}
        setItemIdentifier={setItemIdentifier}
      />

      {loading && <div className="o-loading">Carregando...</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="q-notice">
            {data.data_snapshot
              ? `Snapshot: ${data.data_snapshot} — `
              : 'Nenhum snapshot disponível. '}
            Urgentes: {data.total_urgentes} | Padrão: {data.total_padrao}
          </div>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
            Prazo obra (dias úteis): proxy até a data de entrega do pedido da linha. Média histórica:
            média de lead times de outros pedidos entregues com o mesmo item (mín. 2 amostras; caso
            contrário, Padrão — RN-19).
          </p>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="dashboard-table">
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
                  <tr key={`${row.item_identifier}-${row.building_id ?? 'n'}-${row.item_description ?? ''}`}>
                    <td>{row.item_identifier}</td>
                    <td>{row.item_description || '—'}</td>
                    <td>
                      {row.building_name ||
                        (row.building_id != null ? `Obra ${row.building_id}` : '—')}
                    </td>
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
                {data.itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="o-empty">
                      Nenhum item para os filtros selecionados.
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
