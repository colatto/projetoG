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

export default function NotificationLogs() {
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 20;

  async function loadLogs() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/notifications/logs', {
        params: {
          page,
          limit,
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
    loadLogs();
  }, [page]);

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/notifications/logs', {
        params: { export: 'csv' },
        responseType: 'blob', // Important for file download
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
                        {log.type}
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
                        {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falha' : log.status}
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
