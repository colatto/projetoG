import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getDamageStatusBadgeClass, getDamageStatusLabel } from '../damages-helpers';
import '../orders.css';

type DamageRow = {
  id: string;
  purchase_order_id: number;
  item_number: number;
  supplier_id: number;
  building_id?: number | null;
  status: string;
  created_at: string;
  final_action?: string | null;
  suggested_action?: string | null;
};

const STATUS_OPTIONS = [
  '',
  'registrada',
  'sugestao_pendente',
  'acao_definida',
  'em_reposicao',
  'cancelamento_aplicado',
  'resolvida',
];

export default function DamageList() {
  const [rows, setRows] = useState<DamageRow[]>([]);
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | undefined> = {
        status: status || undefined,
        supplier_id: supplierId ? Number(supplierId) : undefined,
        purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : undefined,
        building_id: buildingId ? Number(buildingId) : undefined,
      };
      const res = await api.get('/damages', { params });
      setRows(res.data?.data || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar avarias'));
    } finally {
      setLoading(false);
    }
  }, [status, supplierId, purchaseOrderId, buildingId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Gestão de Avarias</h1>
          <p className="o-page-subtitle">Análise e decisão de ações corretivas</p>
        </div>
        <Link to="/admin/damages/new" className="btn btn-primary">
          Registrar Avaria
        </Link>
      </div>

      <div className="o-filters">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option || 'Todos'}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Fornecedor (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Pedido (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={purchaseOrderId}
            onChange={(e) => setPurchaseOrderId(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Obra (ID)</label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
          />
        </div>
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
                <th>Fornecedor</th>
                <th>Obra</th>
                <th>Status</th>
                <th>Sugestão</th>
                <th>Ação final</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/admin/damages/${row.id}`} style={{ fontWeight: 600 }}>
                      #{row.purchase_order_id}
                    </Link>
                  </td>
                  <td>{row.item_number}</td>
                  <td>#{row.supplier_id}</td>
                  <td>{row.building_id ? `#${row.building_id}` : '—'}</td>
                  <td>
                    <span className={getDamageStatusBadgeClass(row.status)}>
                      {getDamageStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.suggested_action || '—'}</td>
                  <td>{row.final_action || '—'}</td>
                  <td>{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="o-empty">
                    Nenhuma avaria encontrada.
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
