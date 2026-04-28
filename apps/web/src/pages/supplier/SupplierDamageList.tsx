import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getDamageStatusBadgeClass, getDamageStatusLabel } from '../damages-helpers';
import '../orders.css';

type SupplierDamageRow = {
  id: string;
  purchase_order_id: number;
  item_number: number;
  status: string;
  created_at: string;
  final_action?: string | null;
};

export default function SupplierDamageList() {
  const [rows, setRows] = useState<SupplierDamageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/damages');
      setRows(res.data?.data || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar avarias'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Minhas Avarias</h1>
          <p className="o-page-subtitle">Registre ocorrências e acompanhe ações corretivas</p>
        </div>
        <Link to="/supplier/damages/new" className="btn btn-primary">
          Registrar Avaria
        </Link>
      </div>

      {loading && <div className="o-loading">Carregando avarias…</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Item</th>
                <th>Status</th>
                <th>Ação final</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/supplier/damages/${row.id}`} style={{ fontWeight: 600 }}>
                      #{row.purchase_order_id}
                    </Link>
                  </td>
                  <td>{row.item_number}</td>
                  <td>
                    <span className={getDamageStatusBadgeClass(row.status)}>
                      {getDamageStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.final_action || 'Pendente'}</td>
                  <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="o-empty">
                    Nenhuma avaria registrada.
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
