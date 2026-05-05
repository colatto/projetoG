import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusBadgeClass, getOrderStatusLabel } from '../orders-helpers';
import '../orders.css';

type FollowUpRow = {
  id: string;
  purchase_order_id: number;
  status: string;
  order_date: string;
  building_id?: number | null;
  promised_date_current: string;
  current_notification_number: number;
  purchase_orders?: { local_status?: string } | null;
};

export default function SupplierFollowUpList() {
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/followup/orders');
      setRows(res.data?.data || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar follow-ups'));
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
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Meus Follow-ups</h1>
          <p className="o-page-subtitle">Confirme prazos ou sugira nova data para seus pedidos</p>
        </div>
      </div>

      {loading && <div className="o-loading">Carregando follow-ups…</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Status</th>
                <th>Data Pedido</th>
                <th>Data Prometida</th>
                <th>Obra</th>
                <th>Avaria/Reposição</th>
                <th>Notificação Atual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link
                      to={`/supplier/followup/${row.purchase_order_id}`}
                      style={{ fontWeight: 600 }}
                    >
                      #{row.purchase_order_id}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={getOrderStatusBadgeClass(
                        row.purchase_orders?.local_status || row.status,
                      )}
                    >
                      {getOrderStatusLabel(row.purchase_orders?.local_status || row.status)}
                    </span>
                  </td>
                  <td>{new Date(row.order_date).toLocaleDateString('pt-BR')}</td>
                  <td>{new Date(row.promised_date_current).toLocaleDateString('pt-BR')}</td>
                  <td>{row.building_id || '—'}</td>
                  <td>
                    {['EM_AVARIA', 'REPOSICAO'].includes(row.purchase_orders?.local_status || '')
                      ? 'Sim'
                      : 'Não'}
                  </td>
                  <td>{row.current_notification_number}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="o-empty">
                    Nenhum follow-up ativo no momento.
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
