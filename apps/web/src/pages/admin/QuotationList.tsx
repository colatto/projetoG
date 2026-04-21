import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import {
  getStatusLabel,
  getStatusBadgeClass,
  formatDate,
  getDeadlineClass,
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
  { value: 'ENCERRADA', label: 'Encerrada' },
];

export default function QuotationList() {
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, limit };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('/quotations', { params });
      setData(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar cotações'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  /** Derive dominant status from supplier negotiations */
  function getDominantStatus(negotiations: SupplierNeg[]): string {
    if (!negotiations.length) return 'SEM_RESPOSTA';
    const statuses = negotiations.map((n) => n.status);
    // Priority: pending > correction > review > terminal
    if (statuses.includes('AGUARDANDO_RESPOSTA')) return 'AGUARDANDO_RESPOSTA';
    if (statuses.includes('CORRECAO_SOLICITADA')) return 'CORRECAO_SOLICITADA';
    if (statuses.includes('AGUARDANDO_REVISAO')) return 'AGUARDANDO_REVISAO';
    if (statuses.includes('APROVADA')) return 'APROVADA';
    if (statuses.includes('INTEGRADA_SIENGE')) return 'INTEGRADA_SIENGE';
    return statuses[0];
  }

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
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setStatusFilter('');
            setDateFrom('');
            setDateTo('');
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
                  const dominantStatus = getDominantStatus(negs);
                  const readCount = negs.filter((n) => n.read_at).length;
                  const responseCount = negs.filter((n) => n.latest_response_id).length;
                  const orderIds = negs
                    .filter((n) => n.closed_order_id)
                    .map((n) => n.closed_order_id);
                  const supplierNames = negs
                    .map((n) => n.suppliers?.name ?? `#${n.supplier_id}`)
                    .join(', ');

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
                        <span className={getStatusBadgeClass(dominantStatus)}>
                          {getStatusLabel(dominantStatus)}
                        </span>
                      </td>
                      <td title={supplierNames}>
                        <span style={{ fontSize: '0.8125rem' }}>
                          {negs.length > 0 ? `${negs.length} forn.` : '—'}
                        </span>
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
                        {orderIds.length > 0 ? orderIds.map((oid) => `#${oid}`).join(', ') : '—'}
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
