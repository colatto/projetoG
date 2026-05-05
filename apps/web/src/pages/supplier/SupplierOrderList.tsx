import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusLabel, getOrderStatusBadgeClass, formatDate } from '../orders-helpers';
import '../orders.css';

type PurchaseOrderRow = {
  id: number;
  sienge_purchase_order_id: number;
  supplier_id: number;
  local_status: string;
  created_at: string;
  last_delivery_date: string | null;
  total_quantity_ordered: string;
  total_quantity_delivered: string;
  pending_quantity: string;
  has_divergence: boolean;
  promised_date_current?: string | null;
  building_name?: string | null;
  building_id?: number | null;
};

export default function SupplierOrderList() {
  const [data, setData] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/orders');
      setData(res.data ?? []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar pedidos'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Meus Pedidos</h1>
          <p className="o-page-subtitle">Acompanhe as entregas e status de faturamento</p>
        </div>
      </div>

      {loading && <div className="o-loading">Carregando pedidos…</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Status</th>
                <th>Obra</th>
                <th>Data Prometida</th>
                <th>Criado em</th>
                <th>Última Ent.</th>
                <th>Total Pedido</th>
                <th>Total Faturado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/supplier/orders/${o.id}`} style={{ fontWeight: 600 }}>
                      #{o.sienge_purchase_order_id}
                    </Link>
                  </td>
                  <td>
                    <span className={getOrderStatusBadgeClass(o.local_status)}>
                      {getOrderStatusLabel(o.local_status)}
                    </span>
                    {o.has_divergence && <span style={{ marginLeft: 8, color: '#c2410c' }}>⚠</span>}
                    {o.local_status === 'ATRASADO' && (
                      <span
                        style={{
                          marginLeft: 4,
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        🔴
                      </span>
                    )}
                    {(o.local_status === 'EM_AVARIA' || o.local_status === 'REPOSICAO') && (
                      <span style={{ marginLeft: 4, fontSize: '0.75rem' }}>🛠️</span>
                    )}
                  </td>
                  <td>{o.building_name ?? (o.building_id ? `Obra #${o.building_id}` : '—')}</td>
                  <td>{formatDate(o.promised_date_current)}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{formatDate(o.last_delivery_date)}</td>
                  <td>{Number(o.total_quantity_ordered).toFixed(2)}</td>
                  <td>{Number(o.total_quantity_delivered).toFixed(2)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className="o-empty">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
