import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IntegrationDirection,
  IntegrationEventStatus,
  IntegrationEventType,
  UserRole,
} from '@projetog/domain';
import { api } from '../../lib/api';
import IntegrationStatusBadge from '../../components/ui/IntegrationStatusBadge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_LIMIT = 20;

interface IntegrationEventRow {
  id: string;
  event_type: string;
  status: string;
  direction: string;
  endpoint: string;
  created_at: string;
  error_message?: string | null;
  related_entity_id?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
  next_retry_at?: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

function formatEventType(eventType: string) {
  const labels: Record<string, string> = {
    supplier_invalid_map: 'Fornecedor inválido',
    write_negotiation: 'Escrita de cotação',
    authorize_negotiation: 'Autorização de negociação',
    sync_quotations: 'Sync de cotações',
    sync_creditor: 'Sync de credores',
    sync_orders: 'Sync de pedidos',
    sync_deliveries: 'Sync de entregas',
    webhook_received: 'Webhook recebido',
    webhook_processed: 'Webhook processado',
    webhook_failed: 'Webhook com falha',
    reconciliation_divergence: 'Divergência de reconciliação',
    integration_retry: 'Reprocessamento de integração',
  };
  return labels[eventType] ?? eventType;
}

function formatDateForApiBoundary(dateStr: string, endOfDay: boolean): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(Date.UTC(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  return dt.toISOString();
}

export default function IntegrationEvents() {
  const { user } = useAuth();
  const canManualRetry = user?.role === UserRole.COMPRAS;

  const [events, setEvents] = useState<IntegrationEventRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: PAGE_LIMIT,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [retryTargetId, setRetryTargetId] = useState<string | null>(null);
  const [retryLoadingId, setRetryLoadingId] = useState<string | null>(null);
  const lastManualRetryAtMs = useRef(0);

  const filtersRef = useRef({
    statusFilter,
    eventTypeFilter,
    directionFilter,
    dateFrom,
    dateTo,
  });
  filtersRef.current = {
    statusFilter,
    eventTypeFilter,
    directionFilter,
    dateFrom,
    dateTo,
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((pagination.total || 0) / PAGE_LIMIT)),
    [pagination.total],
  );

  function buildParamsFromFilters(
    page: number,
    f: {
      statusFilter: string;
      eventTypeFilter: string;
      directionFilter: string;
      dateFrom: string;
      dateTo: string;
    },
  ) {
    const params: Record<string, string | number> = {
      page,
      limit: PAGE_LIMIT,
    };
    if (f.statusFilter) params.status = f.statusFilter;
    if (f.eventTypeFilter) params.event_type = f.eventTypeFilter;
    if (f.directionFilter) params.direction = f.directionFilter;
    if (f.dateFrom) params.date_from = formatDateForApiBoundary(f.dateFrom, false);
    if (f.dateTo) params.date_to = formatDateForApiBoundary(f.dateTo, true);
    return params;
  }

  const loadEvents = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/integration/events', {
        params: buildParamsFromFilters(page, filtersRef.current),
      });

      setEvents(response.data.data ?? []);
      setPagination({
        total: response.data.pagination?.total ?? 0,
        page: response.data.pagination?.page ?? page,
        limit: response.data.pagination?.limit ?? PAGE_LIMIT,
      });
    } catch (err) {
      console.error('Falha ao carregar eventos de integração', err);
      setError('Não foi possível carregar os eventos de integração.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega apenas na montagem
  }, []);

  function handleApplyFilters() {
    void loadEvents(1);
  }

  function handleClearFilters() {
    setStatusFilter('');
    setEventTypeFilter('');
    setDirectionFilter('');
    setDateFrom('');
    setDateTo('');
    filtersRef.current = {
      statusFilter: '',
      eventTypeFilter: '',
      directionFilter: '',
      dateFrom: '',
      dateTo: '',
    };
    void loadEvents(1);
  }

  function handlePrevPage() {
    const p = pagination.page;
    if (p <= 1) return;
    void loadEvents(p - 1);
  }

  function handleNextPage() {
    const p = pagination.page;
    if (p >= totalPages) return;
    void loadEvents(p + 1);
  }

  async function confirmRetry(id: string) {
    const now = Date.now();
    if (now - lastManualRetryAtMs.current < 30_000) {
      setError('Aguarde 30 segundos entre reprocessamentos manuais (PRD-09).');
      setRetryTargetId(null);
      return;
    }
    lastManualRetryAtMs.current = now;
    setRetryLoadingId(id);
    setRetryTargetId(null);
    try {
      await api.post(`/integration/events/${id}/retry`);
      await loadEvents(pagination.page);
    } catch (e) {
      console.error(e);
      setError('Não foi possível reprocessar o evento. Verifique suas permissões.');
    } finally {
      setRetryLoadingId(null);
    }
  }

  const statusOptions = Object.values(IntegrationEventStatus);
  const eventTypeOptions = Object.values(IntegrationEventType);
  const directionOptions = Object.values(IntegrationDirection);

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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Monitor de Integração</h1>
          <p style={{ color: 'var(--color-gray-500)', maxWidth: 720 }}>
            Acompanhe o status operacional da integração com o Sienge, incluindo falhas,
            reprocessamentos e ocorrências de fornecedor inválido no mapa de cotação.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={() => void loadEvents(pagination.page)} disabled={isLoading}>
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Status
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status"
            >
              <option value="">Todos</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Tipo de evento
            <select
              className="input"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              aria-label="Tipo de evento"
            >
              <option value="">Todos</option>
              {eventTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {formatEventType(t)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Direção
            <select
              className="input"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              aria-label="Direção"
            >
              <option value="">Todas</option>
              {directionOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Data inicial
            <input
              className="input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Data inicial"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
            Data final
            <input
              className="input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Data final"
            />
          </label>
          <Button type="button" variant="primary" onClick={handleApplyFilters} disabled={isLoading}>
            Aplicar filtros
          </Button>
          <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isLoading}>
            Limpar
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <IntegrationStatusBadge status="pending" />
        <IntegrationStatusBadge status="success" />
        <IntegrationStatusBadge status="failure" />
        <IntegrationStatusBadge status="retry_scheduled" />
        <IntegrationStatusBadge status="supplier_invalid_map" />
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
            Carregando eventos de integração...
          </div>
        ) : events.length === 0 ? (
          <div style={{ padding: '1.5rem', color: 'var(--color-gray-500)' }}>
            Nenhum evento de integração encontrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Status</th>
                  <th>Direção</th>
                  <th>Entidade</th>
                  <th>Tentativas</th>
                  <th>Próximo retry</th>
                  <th>Endpoint</th>
                  <th>Erro</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatEventType(event.event_type)}</td>
                    <td>
                      <IntegrationStatusBadge
                        status={
                          event.event_type === 'supplier_invalid_map'
                            ? 'supplier_invalid_map'
                            : event.status
                        }
                      />
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{event.direction}</td>
                    <td>{event.related_entity_id ?? '—'}</td>
                    <td>
                      {event.retry_count ?? 0}/{event.max_retries ?? 0}
                    </td>
                    <td>
                      {event.next_retry_at
                        ? new Date(event.next_retry_at).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {event.endpoint}
                    </td>
                    <td>{event.error_message ?? '—'}</td>
                    <td>{new Date(event.created_at).toLocaleString('pt-BR')}</td>
                    <td>
                      {canManualRetry &&
                      (event.status === 'failure' || event.status === 'retry_scheduled') ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRetryTargetId(event.id)}
                          disabled={retryLoadingId === event.id}
                          isLoading={retryLoadingId === event.id}
                        >
                          Reprocessar
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && pagination.total > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderTop: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span style={{ color: 'var(--color-gray-600)', fontSize: '0.875rem' }}>
              Página {pagination.page} de {totalPages} ({pagination.total} registros)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={handlePrevPage}
                disabled={pagination.page <= 1 || isLoading}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleNextPage}
                disabled={pagination.page >= totalPages || isLoading}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {retryTargetId ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="retry-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h2 id="retry-modal-title" style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>
              Reprocessar integração
            </h2>
            <p style={{ color: 'var(--color-gray-600)', marginBottom: '1.25rem' }}>
              Tem certeza que deseja reprocessar este evento? Uma nova tentativa será enfileirada.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button type="button" variant="outline" onClick={() => setRetryTargetId(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void confirmRetry(retryTargetId)}
                disabled={!!retryLoadingId}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
