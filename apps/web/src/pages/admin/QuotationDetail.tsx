import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import {
  getStatusLabel,
  getStatusBadgeClass,
  getReviewLabel,
  getReviewBadgeClass,
  formatDate,
  formatDateTime,
  getDeadlineClass,
  isTerminalStatus,
  INVALID_SUPPLIER_MAP_ALERT_MESSAGE,
} from '../quotation-helpers';
import '../quotations.css';

type ResponseItem = {
  id: string;
  purchase_quotation_item_id: number;
  unit_price: number | null;
  negotiated_quantity: number | null;
  quotation_response_item_deliveries?: Array<{
    delivery_number: number;
    delivery_date: string;
    delivery_quantity: number;
  }>;
};

type QuotationResponse = {
  id: string;
  version: number;
  review_status: string;
  integration_status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  supplier_answer_date: string | null;
  validity: string | null;
  seller: string | null;
  quotation_response_items?: ResponseItem[];
};

type SupplierNegotiation = {
  id: string;
  supplier_id: number;
  status: string;
  read_at: string | null;
  sent_at: string | null;
  latest_response_id: string | null;
  closed_order_id: number | null;
  sienge_negotiation_id: number | null;
  sienge_negotiation_number: number | null;
  suppliers?: { name: string } | null;
  quotation_responses?: QuotationResponse[];
};

type NotificationLog = {
  id: string;
  recipient_supplier_id: number | null;
  sent_at: string | null;
  status: string;
  type: string;
};

type QuotationDetailDto = {
  id: number;
  public_id: string | null;
  quotation_date: string | null;
  response_date: string | null;
  sent_at: string | null;
  sent_by: string | null;
  end_at: string | null;
  end_date: string | null;
  sienge_status: string | null;
  purchase_quotation_items?: Array<{
    id: number;
    description: string | null;
    quantity: number | null;
    unit: string | null;
  }>;
  supplier_negotiations?: SupplierNegotiation[];
};

export default function QuotationDetail() {
  const { id } = useParams();
  const quotationId = useMemo(() => Number(id), [id]);
  const [data, setData] = useState<QuotationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [endDateInput, setEndDateInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: string; msg: string } | null>(null);

  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);

  const reload = async () => {
    const res = await api.get(`/quotations/${quotationId}`);
    setData(res.data.data);

    try {
      const logsRes = await api.get(`/notifications/logs`, {
        params: { quotation_id: quotationId, limit: 100 },
      });
      setNotificationLogs(logsRes.data.data || []);
    } catch (e) {
      console.warn('Could not load notification logs', e);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await reload();
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, 'Erro ao carregar cotação'));
      } finally {
        setLoading(false);
      }
    };
    if (!Number.isNaN(quotationId)) {
      queueMicrotask(() => {
        void load();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const onSend = async () => {
    if (!data) return;
    try {
      setSending(true);
      setFeedback(null);
      const endAt = endDateInput
        ? new Date(`${endDateInput}T23:59:59.999Z`).toISOString()
        : (data.end_at ??
          (data.end_date ? new Date(`${data.end_date}T23:59:59.999Z`).toISOString() : null));
      if (!endAt) {
        setFeedback({ type: 'error', msg: 'Defina um prazo antes de enviar.' });
        return;
      }
      const res = await api.post(`/quotations/${quotationId}/send`, { end_at: endAt });
      setFeedback({
        type: 'success',
        msg: `Enviada com sucesso! ${res.data.suppliers_sent} fornecedor(es), ${res.data.suppliers_skipped} ignorado(s).`,
      });
      await reload();
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: getApiErrorMessage(e, 'Erro ao enviar') });
    } finally {
      setSending(false);
    }
  };

  const review = async (
    supplierId: number,
    action: 'approve' | 'reject' | 'request_correction',
  ) => {
    const labels = {
      approve: 'Aprovar',
      reject: 'Reprovar',
      request_correction: 'Solicitar correção',
    };
    const notes = window.prompt(`${labels[action]} — Observações (opcional):`) ?? undefined;
    try {
      setFeedback(null);
      await api.post(`/quotations/${quotationId}/suppliers/${supplierId}/review`, {
        action,
        notes,
      });
      setFeedback({
        type: 'success',
        msg: `${labels[action]} registrado com sucesso.`,
      });
      await reload();
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: getApiErrorMessage(e, 'Erro ao revisar') });
    }
  };

  const retryIntegration = async (supplierId: number) => {
    try {
      setFeedback(null);
      await api.post(`/quotations/${quotationId}/suppliers/${supplierId}/retry-integration`);
      setFeedback({ type: 'info', msg: 'Reprocessamento enfileirado.' });
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: getApiErrorMessage(e, 'Erro ao reprocessar') });
    }
  };

  if (loading) return <div className="q-loading">Carregando cotação…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="q-empty">Cotação não encontrada.</div>;

  const isSent = !!data.sent_at;
  const items = data.purchase_quotation_items ?? [];
  const negotiations = data.supplier_negotiations ?? [];

  return (
    <div>
      {/* Header */}
      <div className="q-page-header">
        <div>
          <p className="q-page-subtitle" style={{ marginBottom: '0.25rem' }}>
            <Link to="/admin/quotations">← Voltar</Link>
          </p>
          <h1 className="q-page-title">Cotação #{data.id}</h1>
          <p className="q-page-subtitle">
            Data: {formatDate(data.quotation_date)} &nbsp;|&nbsp; Prazo:{' '}
            <span className={getDeadlineClass(data.end_at, data.end_date)}>
              {formatDate(data.end_at ?? data.end_date)}
            </span>
            &nbsp;|&nbsp; Sienge: {data.sienge_status ?? '—'}
          </p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'flex-end' }}>
          {!isSent && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="send-end-date">
                Prazo de envio
              </label>
              <input
                id="send-end-date"
                type="date"
                className="form-input"
                value={endDateInput || (data.end_date ?? '')}
                onChange={(e) => setEndDateInput(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          )}
          <button
            className={`btn ${isSent ? 'btn-outline' : 'btn-primary'}`}
            onClick={onSend}
            disabled={sending || isSent}
          >
            {isSent
              ? `Enviada em ${formatDateTime(data.sent_at)}`
              : sending
                ? 'Enviando…'
                : 'Enviar cotação'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && <div className={`q-notice q-notice--${feedback.type}`}>{feedback.msg}</div>}

      {/* Items table */}
      <div className="q-section">
        <h2 className="q-section__title">📦 Itens da cotação</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Unidade</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="q-table-row">
                  <td style={{ fontWeight: 600 }}>{it.id}</td>
                  <td>{it.description ?? '—'}</td>
                  <td>{it.quantity ?? '—'}</td>
                  <td>{it.unit ?? '—'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="q-empty">
                    Itens não disponíveis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suppliers */}
      <div className="q-section">
        <h2 className="q-section__title">👥 Fornecedores ({negotiations.length})</h2>
        <div className="q-suppliers-grid">
          {negotiations.map((sn) => {
            const responses = (sn.quotation_responses ?? [])
              .slice()
              .sort((a, b) => b.version - a.version);
            const latest = responses[0];
            const hasResponse = !!latest;
            const canReview = hasResponse && latest.review_status === 'pending';
            const showRetry =
              hasResponse &&
              latest.integration_status === 'error' &&
              latest.review_status === 'approved';
            const supplierName = sn.suppliers?.name ?? `Fornecedor #${sn.supplier_id}`;

            return (
              <div key={sn.id} className="q-supplier-card">
                {/* Card header */}
                <div className="q-supplier-card__header">
                  <div>
                    <div className="q-supplier-card__name">{supplierName}</div>
                    <div className="q-supplier-card__meta">
                      ID: {sn.supplier_id}
                      {sn.sienge_negotiation_number && ` · Neg. #${sn.sienge_negotiation_number}`}
                    </div>
                  </div>
                  <span className={getStatusBadgeClass(sn.status)}>
                    {getStatusLabel(sn.status)}
                  </span>
                </div>

                {sn.status === 'FORNECEDOR_INVALIDO_MAPA' && (
                  <div
                    className="q-notice q-notice--error"
                    style={{ marginTop: '0.5rem', marginBottom: 0 }}
                  >
                    <strong>Atenção:</strong> {INVALID_SUPPLIER_MAP_ALERT_MESSAGE}. O envio ao
                    Sienge foi bloqueado para este fornecedor; verifique o mapa da cotação no Sienge
                    antes de novas tentativas.
                  </div>
                )}

                {/* Read + order info */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-gray-600)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span className="read-indicator">
                      <span
                        className={`read-dot ${sn.read_at ? 'read-dot--yes' : 'read-dot--no'}`}
                      />
                      {sn.read_at ? `Lida ${formatDateTime(sn.read_at)}` : 'Não lida'}
                    </span>
                    {sn.closed_order_id && <span>Pedido #{sn.closed_order_id}</span>}
                  </div>

                  {/* Notification status */}
                  {(() => {
                    const supplierNotifications = notificationLogs.filter(
                      (log) => log.recipient_supplier_id === sn.supplier_id,
                    );
                    return (
                      supplierNotifications.length > 0 && (
                        <div style={{ marginTop: '0.25rem' }}>
                          {supplierNotifications.map((log) => (
                            <div
                              key={log.id}
                              style={{
                                fontSize: '0.75rem',
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor:
                                    log.status === 'sent'
                                      ? '#22c55e'
                                      : log.status === 'failed'
                                        ? '#ef4444'
                                        : '#9ca3af',
                                }}
                              />
                              <span>
                                {log.type === 'NEW_QUOTATION'
                                  ? 'Convite'
                                  : log.type === 'NO_RESPONSE_ALERT'
                                    ? 'Alerta'
                                    : log.type}{' '}
                                e-mail{' '}
                                {log.status === 'sent'
                                  ? 'enviado'
                                  : log.status === 'failed'
                                    ? 'falhou'
                                    : 'pendente'}
                                {log.sent_at && ` em ${formatDateTime(log.sent_at)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    );
                  })()}
                </div>

                {/* Response history */}
                {responses.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-gray-500)',
                        marginBottom: '0.375rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      Respostas ({responses.length})
                    </div>
                    <div className="q-version-list">
                      {responses.map((r) => (
                        <div
                          key={r.id}
                          className={`q-version-item ${r.id === latest.id ? 'q-version-item--latest' : ''}`}
                        >
                          <strong>v{r.version}</strong>
                          <span className={getReviewBadgeClass(r.review_status)}>
                            {getReviewLabel(r.review_status)}
                          </span>
                          {r.integration_status && r.integration_status !== 'pending' && (
                            <span
                              className={`badge-status ${r.integration_status === 'success' ? 'badge-approved' : 'badge-rejected'}`}
                            >
                              Int: {r.integration_status}
                            </span>
                          )}
                          <span
                            style={{
                              color: 'var(--color-gray-400)',
                              fontSize: '0.75rem',
                              marginLeft: 'auto',
                            }}
                          >
                            {formatDateTime(r.submitted_at)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Review notes */}
                    {latest.review_notes && (
                      <div
                        className={`q-notice ${latest.review_status === 'correction_requested' ? 'q-notice--warning' : 'q-notice--info'}`}
                        style={{ marginTop: '0.5rem', marginBottom: 0 }}
                      >
                        <strong>Obs. revisão:</strong> {latest.review_notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions — conditional on status */}
                {(canReview || showRetry) && (
                  <div className="q-supplier-card__actions">
                    {canReview && (
                      <>
                        <button
                          className="btn btn-sm btn-approve"
                          onClick={() => review(sn.supplier_id, 'approve')}
                        >
                          ✓ Aprovar
                        </button>
                        <button
                          className="btn btn-sm btn-reject"
                          onClick={() => review(sn.supplier_id, 'reject')}
                        >
                          ✕ Reprovar
                        </button>
                        <button
                          className="btn btn-sm btn-correction"
                          onClick={() => review(sn.supplier_id, 'request_correction')}
                        >
                          ↺ Solicitar correção
                        </button>
                      </>
                    )}
                    {showRetry && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => retryIntegration(sn.supplier_id)}
                      >
                        ↻ Retry integração
                      </button>
                    )}
                  </div>
                )}

                {/* Terminal status info */}
                {isTerminalStatus(sn.status) && !canReview && !showRetry && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.75rem',
                      color: 'var(--color-gray-400)',
                      fontStyle: 'italic',
                    }}
                  >
                    Negociação finalizada
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
