import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getDamageStatusBadgeClass, getDamageStatusLabel } from '../damages-helpers';
import '../orders.css';

type SupplierDamageDetailData = {
  id: string;
  purchase_order_id: number;
  item_number: number;
  status: string;
  description: string;
  suggested_action?: string | null;
  final_action?: string | null;
  damage_audit_logs?: Array<{
    id: string;
    event_type: string;
    created_at: string;
    actor_profile?: string | null;
  }>;
  damage_replacements?: Array<{
    id: string;
    replacement_status: string;
    new_promised_date: string;
  }>;
};

export default function SupplierDamageDetail() {
  const { damageId } = useParams<{ damageId: string }>();
  const [data, setData] = useState<SupplierDamageDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestedAction, setSuggestedAction] = useState('reposicao');
  const [suggestionNotes, setSuggestionNotes] = useState('');
  const [replacementDate, setReplacementDate] = useState('');
  const [replacementNotes, setReplacementNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/damages/${damageId}`);
      setData(res.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar avaria'));
    } finally {
      setLoading(false);
    }
  }, [damageId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const sendSuggestion = async () => {
    try {
      setSubmitting(true);
      await api.patch(`/damages/${damageId}/suggest`, {
        suggested_action: suggestedAction,
        suggested_action_notes: suggestionNotes || undefined,
      });
      setSuggestionNotes('');
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao enviar sugestão'));
    } finally {
      setSubmitting(false);
    }
  };

  const informDate = async () => {
    try {
      setSubmitting(true);
      await api.patch(`/damages/${damageId}/replacement/date`, {
        new_promised_date: replacementDate,
        notes: replacementNotes || undefined,
      });
      setReplacementDate('');
      setReplacementNotes('');
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao informar data de reposição'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="o-loading">Carregando avaria…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="o-empty">Avaria não encontrada.</div>;

  const canSuggest = !data.final_action;
  const canInformDate = data.status === 'em_reposicao';
  const replacement = data.damage_replacements?.[0];

  return (
    <div>
      <div className="mb-4">
        <Link to="/supplier/damages" className="btn btn-outline btn-sm">
          ← Voltar
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Avaria #{data.id.slice(0, 8)}</h1>
          <p className="o-page-subtitle">
            Pedido #{data.purchase_order_id} · Item {data.item_number}
          </p>
        </div>
        <span className={getDamageStatusBadgeClass(data.status)}>
          {getDamageStatusLabel(data.status)}
        </span>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-grid">
          <div className="o-detail-item">
            <div className="label">Descrição</div>
            <div className="value">{data.description}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Sugestão enviada</div>
            <div className="value">{data.suggested_action || '—'}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Ação final de Compras</div>
            <div className="value">{data.final_action || 'Pendente'}</div>
          </div>
        </div>
      </div>

      {canSuggest && (
        <div className="o-detail-section">
          <div className="o-detail-header">
            <h2 style={{ fontSize: '1.125rem' }}>Sugerir ação corretiva</h2>
          </div>
          <div className="form-group" style={{ maxWidth: 420 }}>
            <label className="form-label">Ação sugerida</label>
            <select
              className="form-input"
              value={suggestedAction}
              onChange={(e) => setSuggestedAction(e.target.value)}
            >
              <option value="reposicao">Reposição</option>
              <option value="cancelamento_parcial">Cancelamento parcial</option>
              <option value="cancelamento_total">Cancelamento total</option>
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: 720 }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-input"
              rows={3}
              value={suggestionNotes}
              onChange={(e) => setSuggestionNotes(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={submitting} onClick={sendSuggestion}>
            {submitting ? 'Enviando...' : 'Enviar sugestão'}
          </button>
        </div>
      )}

      {canInformDate && (
        <div className="o-detail-section">
          <div className="o-detail-header">
            <h2 style={{ fontSize: '1.125rem' }}>Informar data de reposição</h2>
          </div>
          {replacement && (
            <p className="o-page-subtitle" style={{ marginBottom: 12 }}>
              Status da reposição: {replacement.replacement_status}
            </p>
          )}
          <div className="form-group" style={{ maxWidth: 420 }}>
            <label className="form-label">Nova data prometida</label>
            <input
              className="form-input"
              type="date"
              value={replacementDate}
              onChange={(e) => setReplacementDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ maxWidth: 720 }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-input"
              rows={3}
              value={replacementNotes}
              onChange={(e) => setReplacementNotes(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={submitting || !replacementDate}
            onClick={informDate}
          >
            {submitting ? 'Enviando...' : 'Confirmar nova data'}
          </button>
        </div>
      )}

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Histórico de Auditoria</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Evento</th>
                <th>Perfil</th>
              </tr>
            </thead>
            <tbody>
              {(data.damage_audit_logs || []).map((audit) => (
                <tr key={audit.id}>
                  <td>{new Date(audit.created_at).toLocaleString('pt-BR')}</td>
                  <td>{audit.event_type}</td>
                  <td>{audit.actor_profile || 'sistema'}</td>
                </tr>
              ))}
              {(data.damage_audit_logs || []).length === 0 && (
                <tr>
                  <td colSpan={3} className="o-empty">
                    Sem eventos de auditoria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
