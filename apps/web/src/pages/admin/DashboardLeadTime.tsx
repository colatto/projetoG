import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';

type LeadTimePayload = {
  lead_time_medio_global: number;
  lead_time_por_fornecedor: Array<{
    supplier_id: number;
    supplier_name: string;
    lead_time_medio: number;
  }>;
  lead_time_por_obra: Array<{
    building_id: number;
    building_name: string;
    lead_time_medio: number;
  }>;
  evolucao_diaria: Array<{ data: string; lead_time_medio: number }>;
};

export default function DashboardLeadTime() {
  const [supplierId, setSupplierId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [itemIdentifier, setItemIdentifier] = useState('');
  const [data, setData] = useState<LeadTimePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/lead-time', {
        params: {
          supplier_id: supplierId ? Number(supplierId) : undefined,
          building_id: buildingId ? Number(buildingId) : undefined,
          purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : undefined,
          item_identifier: itemIdentifier || undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar dashboard de lead time'));
    } finally {
      setLoading(false);
    }
  }, [supplierId, buildingId, purchaseOrderId, itemIdentifier]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Dashboard de Lead Time</h1>
          <p className="o-page-subtitle">Média de dias úteis entre pedido e entrega</p>
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
            Lead time médio global: {data.lead_time_medio_global} dias úteis
          </div>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Lead time médio</th>
                </tr>
              </thead>
              <tbody>
                {data.lead_time_por_fornecedor.map((row) => (
                  <tr key={row.supplier_id}>
                    <td>{row.supplier_name}</td>
                    <td>{row.lead_time_medio}</td>
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
