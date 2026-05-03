import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRole } from '@projetog/domain';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { canUseOrdersRequireActionFilter } from '../../lib/rbac-ui';
import { useAuth } from '../../contexts/AuthContext';
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
  suppliers?: { name: string } | null;
  building_id?: number;
  building_name?: string | null;
  promised_date_current?: string | null;
  purchase_quotation_id?: number | null;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'PARCIALMENTE_ENTREGUE', label: 'Parcialmente Entregue' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'ATRASADO', label: 'Atrasado' },
  { value: 'DIVERGENCIA', label: 'Divergência' },
  { value: 'EM_AVARIA', label: 'Em Avaria' },
  { value: 'REPOSICAO', label: 'Reposição' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export default function OrderList() {
  const { user } = useAuth();
  const allowRequireAction = canUseOrdersRequireActionFilter(user?.role);
  const isViewer = user?.role === UserRole.VISUALIZADOR_PEDIDOS;

  const [data, setData] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [requireActionOnly, setRequireActionOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | boolean> = {
        sort_priority: true,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (allowRequireAction && requireActionOnly) params.require_action = true;

      const res = await api.get('/orders', { params });
      setData(res.data ?? []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar pedidos'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, requireActionOnly, allowRequireAction]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">{isViewer ? 'Consulta de Pedidos' : 'Pedidos'}</h1>
          <p className="o-page-subtitle">
            {isViewer
              ? 'Somente leitura — consulta de pedidos e entregas.'
              : 'Gestão e acompanhamento logístico'}
          </p>
        </div>
      </div>

      <div className="o-filters">
        {allowRequireAction ? (
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              id="filter-require-action"
              type="checkbox"
              checked={requireActionOnly}
              onChange={(e) => setRequireActionOnly(e.target.checked)}
            />
            <label className="form-label" htmlFor="filter-require-action" style={{ marginBottom: 0 }}>
              Exigem ação
            </label>
          </div>
        ) : null}

        <div className="form-group">
          <label className="form-label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="filter-search">
            Busca (Nº)
          </label>
          <input
            id="filter-search"
            type="text"
            className="form-input"
            placeholder="Nº Sienge"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setStatusFilter('');
            setSearch('');
            setRequireActionOnly(false);
          }}
        >
          Limpar
        </button>
      </div>

      {loading && <div className="o-loading">Carregando pedidos…</div>}

      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Cotação</th>
                <th>Fornecedor</th>
                <th>Obra</th>
                <th>Status</th>
                <th>Data Prometida</th>
                <th>Criado em</th>
                <th>Última Ent.</th>
                <th>Faturado</th>
                <th>Pendente</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/admin/orders/${o.id}`} style={{ fontWeight: 600 }}>
                      #{o.sienge_purchase_order_id}
                    </Link>
                  </td>
                  <td>{o.purchase_quotation_id ? `#${o.purchase_quotation_id}` : '—'}</td>
                  <td>{o.suppliers?.name ?? `#${o.supplier_id}`}</td>
                  <td>{o.building_name ?? (o.building_id ? `Obra #${o.building_id}` : '—')}</td>
                  <td>
                    <span className={getOrderStatusBadgeClass(o.local_status)}>
                      {getOrderStatusLabel(o.local_status)}
                    </span>
                    {o.has_divergence && <span style={{ marginLeft: 8, color: '#c2410c' }}>⚠</span>}
                  </td>
                  <td>{formatDate(o.promised_date_current)}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{formatDate(o.last_delivery_date)}</td>
                  <td>{Number(o.total_quantity_delivered).toFixed(2)}</td>
                  <td>{Number(o.pending_quantity).toFixed(2)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="o-empty">
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
