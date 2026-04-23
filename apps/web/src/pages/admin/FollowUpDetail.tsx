import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusBadgeClass, getOrderStatusLabel } from '../orders-helpers';
import '../orders.css';

type DateChange = {
  id: string;
  suggested_date: string;
  previous_date: string;
  decision: string | null;
  reason: string | null;
};

type FollowUpDetailData = {
  id: string;
  purchase_order_id: number;
  status: string;
  supplier_id: number;
  order_date: string;
  promised_date_current: string;
  current_notification_number: number;
  date_changes: DateChange[];
  purchase_orders?: { local_status?: string } | null;
};

export default function FollowUpDetail() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const [data, setData] = useState<FollowUpDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  const decide = async (dateChangeId: string, action: 'approve' | 'reject') => {
    try {
      setSubmittingId(dateChangeId);
      await api.post(`/followup/date-changes/${dateChangeId}/${action}`, { reason: reason || undefined });
      setReason('');
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao decidir nova data'));
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) return <div className="o-loading">Carregando follow-up…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="o-empty">Follow-up não encontrado.</div>;

  const pendingChanges = data.date_changes.filter((change) => change.decision === 'pending');
  const operationalStatus = data.purchase_orders?.local_status || data.status;

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/followup" className="btn btn-outline btn-sm">
          ← Voltar para lista
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Follow-up do Pedido #{data.purchase_order_id}</h1>
          <p className="o-page-subtitle">Gestão de decisões e histórico de notificações</p>
        </div>
        <div className={getOrderStatusBadgeClass(operationalStatus)}>
          {getOrderStatusLabel(operationalStatus)}
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-grid">
          <div className="o-detail-item">
            <div className="label">Fornecedor</div>
            <div className="value">#{data.supplier_id}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Data do pedido</div>
            <div className="value">{new Date(data.order_date).toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Data prometida atual</div>
            <div className="value">{new Date(data.promised_date_current).toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Notificação atual</div>
            <div className="value">{data.current_notification_number}</div>
          </div>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Sugestões de Nova Data</h2>
        </div>
        <div className="form-group" style={{ maxWidth: 480 }}>
          <label className="form-label">Justificativa da decisão (opcional)</label>
          <textarea
            className="form-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data anterior</th>
                <th>Data sugerida</th>
                <th>Decisão</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.date_changes.map((change) => (
                <tr key={change.id}>
                  <td>{new Date(change.previous_date).toLocaleDateString('pt-BR')}</td>
                  <td>{new Date(change.suggested_date).toLocaleDateString('pt-BR')}</td>
                  <td>{change.decision || 'pending'}</td>
                  <td>
                    {change.decision === 'pending' ? (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={submittingId === change.id}
                          onClick={() => decide(change.id, 'approve')}
                        >
                          Aprovar
                        </button>{' '}
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={submittingId === change.id}
                          onClick={() => decide(change.id, 'reject')}
                        >
                          Reprovar
                        </button>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.date_changes.length === 0 && (
                <tr>
                  <td colSpan={4} className="o-empty">
                    Nenhuma sugestão registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pendingChanges.length > 0 && (
          <p style={{ marginTop: 12, color: '#92400e' }}>
            Existem {pendingChanges.length} sugestão(ões) aguardando decisão de Compras.
          </p>
        )}
      </div>
    </div>
  );
}
