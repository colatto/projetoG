import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusBadgeClass, getOrderStatusLabel } from '../orders-helpers';
import '../orders.css';

type FollowUpDetailData = {
  purchase_order_id: number;
  status: string;
  order_date: string;
  promised_date_current: string;
  suggested_date_status: string | null;
  notifications?: Array<{
    id: string;
    created_at?: string | null;
    subject?: string | null;
    status?: string | null;
  }>;
  purchase_orders?: { local_status?: string } | null;
};

export default function SupplierFollowUpDetail() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const [data, setData] = useState<FollowUpDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/followup/orders/${purchaseOrderId}`);
      setData(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar detalhe do follow-up'));
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmOnTime = async () => {
    try {
      setSubmitting(true);
      await api.post(`/followup/orders/${purchaseOrderId}/confirm`);
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao confirmar entrega no prazo'));
    } finally {
      setSubmitting(false);
    }
  };

  const suggestNewDate = async () => {
    try {
      setSubmitting(true);
      await api.post(`/followup/orders/${purchaseOrderId}/suggest-date`, {
        suggested_date: suggestedDate,
        reason: reason || undefined,
      });
      setSuggestedDate('');
      setReason('');
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao sugerir nova data'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="o-loading">Carregando follow-up…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="o-empty">Follow-up não encontrado.</div>;
  const operationalStatus = data.purchase_orders?.local_status || data.status;

  return (
    <div>
      <div className="mb-4">
        <Link to="/supplier/followup" className="btn btn-outline btn-sm">
          ← Voltar para lista
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Follow-up do Pedido #{data.purchase_order_id}</h1>
          <p className="o-page-subtitle">Responda à cobrança logística</p>
        </div>
        <div className={getOrderStatusBadgeClass(operationalStatus)}>
          {getOrderStatusLabel(operationalStatus)}
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-grid">
          <div className="o-detail-item">
            <div className="label">Data do pedido</div>
            <div className="value">{new Date(data.order_date).toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Data prometida atual</div>
            <div className="value">
              {new Date(data.promised_date_current).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="o-detail-item">
            <div className="label">Status da sugestão</div>
            <div className="value">{data.suggested_date_status || '—'}</div>
          </div>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Histórico de Notificações</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Assunto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.notifications || []).map((notification) => (
                <tr key={notification.id}>
                  <td>
                    {notification.created_at
                      ? new Date(notification.created_at).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td>{notification.subject || '—'}</td>
                  <td>{notification.status || '—'}</td>
                </tr>
              ))}
              {(data.notifications || []).length === 0 && (
                <tr>
                  <td colSpan={3} className="o-empty">
                    Nenhuma notificação recebida até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Ações do fornecedor</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button className="btn btn-primary" disabled={submitting} onClick={confirmOnTime}>
            Confirmarei entrega no prazo
          </button>
        </div>

        <div className="form-group" style={{ maxWidth: 420 }}>
          <label className="form-label">Sugerir nova data</label>
          <input
            type="date"
            className="form-input"
            value={suggestedDate}
            onChange={(e) => setSuggestedDate(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ maxWidth: 420 }}>
          <label className="form-label">Justificativa (opcional)</label>
          <textarea
            className="form-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          className="btn btn-outline"
          disabled={submitting || !suggestedDate}
          onClick={suggestNewDate}
        >
          Enviar sugestão de data
        </button>
      </div>
    </div>
  );
}
