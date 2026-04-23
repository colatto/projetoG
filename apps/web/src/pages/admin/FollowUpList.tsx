import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusBadgeClass, getOrderStatusLabel } from '../orders-helpers';
import '../orders.css';

type FollowUpRow = {
  id: string;
  purchase_order_id: number;
  supplier_id: number;
  status: string;
  promised_date_current: string;
  order_date: string;
  current_notification_number: number;
  purchase_orders?: { local_status?: string } | null;
  suppliers?: { name?: string } | null;
};

const STATUS_OPTIONS = ['', 'ATIVO', 'PAUSADO', 'CONCLUIDO', 'ATRASADO', 'ENCERRADO'];

export default function FollowUpList() {
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/followup/orders', { params: { status: status || undefined } });
      setRows(res.data?.data || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar follow-ups'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Follow-up Logístico</h1>
          <p className="o-page-subtitle">Acompanhamento de cobranças, respostas e atrasos</p>
        </div>
      </div>

      <div className="o-filters">
        <div className="form-group">
          <label className="form-label" htmlFor="followup-status">
            Status
          </label>
          <select
            id="followup-status"
            className="form-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option || 'Todos'}
              </option>
            ))}
          </select>
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
                <th>Fornecedor</th>
                <th>Status</th>
                <th>Data Pedido</th>
                <th>Data Prometida</th>
                <th>Notificação Atual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/followup/${row.purchase_order_id}`} style={{ fontWeight: 600 }}>
                      #{row.purchase_order_id}
                    </Link>
                  </td>
                  <td>{row.suppliers?.name || `#${row.supplier_id}`}</td>
                  <td>
                    <span className={getOrderStatusBadgeClass(row.purchase_orders?.local_status || row.status)}>
                      {getOrderStatusLabel(row.purchase_orders?.local_status || row.status)}
                    </span>
                  </td>
                  <td>{new Date(row.order_date).toLocaleDateString('pt-BR')}</td>
                  <td>{new Date(row.promised_date_current).toLocaleDateString('pt-BR')}</td>
                  <td>{row.current_notification_number}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="o-empty">
                    Nenhum follow-up encontrado.
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
