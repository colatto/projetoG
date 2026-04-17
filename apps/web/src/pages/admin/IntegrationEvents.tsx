import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import IntegrationStatusBadge from '../../components/ui/IntegrationStatusBadge';

interface IntegrationEventRow {
  id: string;
  event_type: string;
  status: string;
  direction: string;
  endpoint: string;
  created_at: string;
  error_message?: string | null;
  related_entity_id?: string | null;
}

function formatEventType(eventType: string) {
  switch (eventType) {
    case 'supplier_invalid_map':
      return 'Fornecedor inválido';
    case 'write_negotiation':
      return 'Escrita de cotação';
    case 'authorize_negotiation':
      return 'Autorização de negociação';
    case 'sync_quotations':
      return 'Sync de cotações';
    case 'sync_orders':
      return 'Sync de pedidos';
    case 'sync_deliveries':
      return 'Sync de entregas';
    case 'webhook_received':
      return 'Webhook recebido';
    case 'webhook_processed':
      return 'Webhook processado';
    case 'webhook_failed':
      return 'Webhook com falha';
    case 'reconciliation_divergence':
      return 'Divergência de reconciliação';
    default:
      return eventType;
  }
}

export default function IntegrationEvents() {
  const [events, setEvents] = useState<IntegrationEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/integration/events', {
        params: {
          page: 1,
          limit: 50,
        },
      });

      setEvents(response.data.data ?? []);
    } catch (err) {
      console.error('Falha ao carregar eventos de integração', err);
      setError('Não foi possível carregar os eventos de integração.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

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

        <button className="btn btn-secondary" onClick={loadEvents} disabled={isLoading}>
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </button>
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
                  <th>Endpoint</th>
                  <th>Erro</th>
                  <th>Criado em</th>
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
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {event.endpoint}
                    </td>
                    <td>{event.error_message ?? '—'}</td>
                    <td>{new Date(event.created_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
