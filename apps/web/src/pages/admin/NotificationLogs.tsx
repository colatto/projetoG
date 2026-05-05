import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface NotificationLogRow {
  id: string;
  type: string;
  status: string;
  quotation_id: number;
  subject: string;
  recipient_email: string;
  created_at: string;
  sent_at: string | null;
  notification_templates?: { type: string } | null;
  suppliers?: { name: string } | null;
  profiles?: { name: string } | null;
}

interface FiltersState {
  type: string;
  status: string;
  start_date: string;
  end_date: string;
  quotation_id: string;
  supplier_id: string;
}

const EMPTY_FILTERS: FiltersState = {
  type: '',
  status: '',
  start_date: '',
  end_date: '',
  quotation_id: '',
  supplier_id: '',
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_quotation: 'Nova cotação',
  quotation_reminder: 'Lembrete de cotação',
  no_response_alert: 'Alerta sem resposta',
  followup_reminder: 'Follow-up — lembrete',
  overdue_alert: 'Follow-up — atraso',
  confirmation_received: 'Follow-up — confirmação',
  new_date_pending: 'Follow-up — nova data',
};

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviado',
  failed: 'Falha',
  bounced: 'Bounced',
};

function buildParamsFromFilters(filters: FiltersState): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  if (filters.quotation_id) params.quotation_id = Number(filters.quotation_id);
  if (filters.supplier_id) params.supplier_id = Number(filters.supplier_id);
  return params;
}

export default function NotificationLogs() {
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(EMPTY_FILTERS);

  const limit = 20;

  async function loadLogs() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/notifications/logs', {
        params: {
          page,
          limit,
          ...buildParamsFromFilters(appliedFilters),
        },
      });

      setLogs(response.data.data ?? []);
      setTotal(response.data.pagination?.total ?? 0);
    } catch (err) {
      console.error('Falha ao carregar logs de notificação', err);
      setError('Não foi possível carregar os logs de notificação.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadLogs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/notifications/logs', {
        params: {
          export: 'csv',
          ...buildParamsFromFilters(appliedFilters),
        },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'notification_logs.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Falha ao exportar CSV', err);
      alert('Falha ao exportar CSV de notificações.');
    }
  };

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Logs de Notificação</h1>
          <p style={{ color: 'var(--color-gray-500)', maxWidth: 720 }}>
            Histórico de envio de notificações para fornecedores e Compras (PRD-03).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={loadLogs} disabled={isLoading}>
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div
        aria-label="Filtros de logs"
        style={{
          backgroundColor: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem 1.25rem',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Tipo</span>
            <select
              className="input"
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Status</span>
            <select
              className="input"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Data inicial</span>
            <input
              className="input"
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Data final</span>
            <input
              className="input"
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Cotação ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={filters.quotation_id}
              onChange={(e) => setFilters((f) => ({ ...f, quotation_id: e.target.value }))}
              placeholder="ex.: 12345"
            />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
            <span>Fornecedor ID</span>
            <input
              className="input"
              type="number"
              min={1}
              value={filters.supplier_id}
              onChange={(e) => setFilters((f) => ({ ...f, supplier_id: e.target.value }))}
              placeholder="ex.: 7788"
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleClearFilters} disabled={isLoading}>
            Limpar
          </button>
          <button className="btn btn-primary" onClick={handleApplyFilters} disabled={isLoading}>
            Aplicar filtros
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        {error ? (
          <div style={{ padding: '1.5rem', color: '#991b1b' }}>{error}</div>
        ) : isLoading ? (
          <div style={{ padding: '1.5rem', color: 'var(--color-gray-500)' }}>
            Carregando logs de notificação...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--color-gray-500)' }}>
            Nenhum log de notificação encontrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Destinatário</th>
                  <th>Cotação ID</th>
                  <th>Assunto</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-gray-100)',
                          fontSize: '0.85rem',
                        }}
                      >
                        {NOTIFICATION_TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </td>
                    <td>{log.recipient_email}</td>
                    <td>{log.quotation_id || '—'}</td>
                    <td>{log.subject}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          backgroundColor:
                            log.status === 'sent'
                              ? '#dcfce7'
                              : log.status === 'failed'
                                ? '#fee2e2'
                                : '#f3f4f6',
                          color:
                            log.status === 'sent'
                              ? '#166534'
                              : log.status === 'failed'
                                ? '#991b1b'
                                : '#374151',
                        }}
                      >
                        {STATUS_LABELS[log.status] ?? log.status}
                      </span>
                    </td>
                    <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td>{log.sent_at ? new Date(log.sent_at).toLocaleString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
          Total de {total} registros
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
