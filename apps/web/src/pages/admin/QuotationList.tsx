import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { useAuth } from '../../contexts/AuthContext';
import { canUseQuotationsRequireActionFilter } from '../../lib/rbac-ui';
import {
  getStatusLabel,
  getStatusBadgeClass,
  formatDate,
  getDeadlineClass,
  getDominantNegotiationStatus,
  shouldShowInvalidMapMixedChip,
  formatSupplierNamesCell,
  quotationRowHasClosedSupplier,
} from '../quotation-helpers';
import '../quotations.css';

type SupplierNeg = {
  supplier_id: number;
  status: string;
  read_at: string | null;
  latest_response_id: string | null;
  closed_order_id: number | null;
  suppliers?: { name: string } | null;
};

type QuotationRow = {
  id: number;
  public_id: string | null;
  quotation_date: string | null;
  end_at: string | null;
  end_date: string | null;
  sent_at: string | null;
  supplier_negotiations?: SupplierNeg[];
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'AGUARDANDO_RESPOSTA', label: 'Aguardando resposta' },
  { value: 'CORRECAO_SOLICITADA', label: 'Correção solicitada' },
  { value: 'AGUARDANDO_REVISAO', label: 'Aguardando revisão' },
  { value: 'APROVADA', label: 'Aprovada' },
  { value: 'INTEGRADA_SIENGE', label: 'Integrada' },
  { value: 'SEM_RESPOSTA', label: 'Sem resposta' },
  { value: 'FORNECEDOR_INVALIDO_MAPA', label: 'Fornecedor inválido no mapa' },
  { value: 'FORNECEDOR_FECHADO', label: 'Fornecedor fechado' },
  { value: 'AGUARDANDO_REENVIO_SIENGE', label: 'Aguard. reenvio Sienge' },
  { value: 'ENCERRADA', label: 'Encerrada' },
];

export default function QuotationList() {
  const { user } = useAuth();
  const allowRequireAction = canUseQuotationsRequireActionFilter(user?.role);

  const [data, setData] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [requireActionOnly, setRequireActionOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | boolean> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) params.date_to = `${dateTo}T23:59:59.999Z`;
      if (allowRequireAction && requireActionOnly) params.require_action = true;

      const res = await api.get('/quotations', { params });
      setData(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar cotações'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFrom, dateTo, requireActionOnly, allowRequireAction]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="q-page-header">
        <div>
          <h1 className="q-page-title">Cotações</h1>
          <p className="q-page-subtitle">
            {total} cotaç{total === 1 ? 'ão' : 'ões'} encontrada{total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="q-filters">
        <div className="form-group">
          <label className="form-label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="form-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="filter-date-from">
            De
          </label>
          <input
            id="filter-date-from"
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="filter-date-to">
            Até
          </label>
          <input
            id="filter-date-to"
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {allowRequireAction && (
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={requireActionOnly}
                onChange={(e) => {
                  setRequireActionOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Exigem ação
            </label>
          </div>
        )}
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setStatusFilter('');
            setDateFrom('');
            setDateTo('');
            setRequireActionOnly(false);
            setPage(1);
          }}
        >
          Limpar
        </button>
      </div>

      {loading && <div className="q-loading">Carregando cotações…</div>}

      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data</th>
                  <th>Prazo</th>
                  <th>Status</th>
                  <th>Fornecedores</th>
                  <th>Leitura</th>
                  <th>Resposta</th>
                  <th>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {data.map((q) => {
                  const negs = q.supplier_negotiations ?? [];
                  const statuses = negs.map((n) => n.status);
                  const dominantStatus = getDominantNegotiationStatus(statuses);
                  const showInvalidMixedChip = shouldShowInvalidMapMixedChip(statuses, dominantStatus);
                  const readCount = negs.filter((n) => n.read_at).length;
                  const responseCount = negs.filter((n) => n.latest_response_id).length;
                  const orderIds = negs
                    .filter((n) => n.closed_order_id)
                    .map((n) => n.closed_order_id);
                  const nameParts = negs.map((n) => n.suppliers?.name ?? `#${n.supplier_id}`);
                  const supplierCell = formatSupplierNamesCell(nameParts);
                  const hasClosedSupplier = quotationRowHasClosedSupplier(negs);

                  return (
                    <tr key={q.id} className="q-table-row">
                      <td>
                        <Link to={`/admin/quotations/${q.id}`} style={{ fontWeight: 600 }}>
                          #{q.id}
                        </Link>
                      </td>
                      <td>{formatDate(q.quotation_date)}</td>
                      <td className={getDeadlineClass(q.end_at, q.end_date)}>
                        {formatDate(q.end_at ?? q.end_date)}
                      </td>
                      <td>
                        <div className="q-status-cell">
                          <span className={getStatusBadgeClass(dominantStatus)}>
                            {getStatusLabel(dominantStatus)}
                          </span>
                          {showInvalidMixedChip && (
                            <span
                              className="q-chip-invalid-map"
                              title="Contém fornecedor inválido no mapa de cotação"
                            >
                              Mapa inválido
                            </span>
                          )}
                        </div>
                      </td>
                      <td title={supplierCell.title}>
                        <span style={{ fontSize: '0.8125rem' }}>{supplierCell.primary}</span>
                        {negs.length > 1 && (
                          <span style={{ color: 'var(--color-gray-400)', fontSize: '0.75rem' }}>
                            {' '}
                            ({negs.length})
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="read-indicator">
                          <span
                            className={`read-dot ${readCount === negs.length && negs.length > 0 ? 'read-dot--yes' : 'read-dot--no'}`}
                          />
                          {readCount}/{negs.length}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem' }}>
                          {responseCount}/{negs.length}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {hasClosedSupplier && (
                            <span className="q-chip-fornecedor-fechado">Fechado</span>
                          )}
                          <span style={{ fontSize: '0.8125rem' }}>
                            {orderIds.length > 0
                              ? orderIds.map((oid) => `#${oid}`).join(', ')
                              : '—'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="q-empty">
                      Nenhuma cotação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="q-pagination">
              <button
                className="q-pagination__btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              <span className="q-pagination__info">
                {page} / {totalPages}
              </span>
              <button
                className="q-pagination__btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
