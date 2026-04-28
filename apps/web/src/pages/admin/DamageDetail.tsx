import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getDamageStatusBadgeClass, getDamageStatusLabel } from '../damages-helpers';
import '../orders.css';

type DamageDetailData = {
  id: string;
  purchase_order_id: number;
  item_number: number;
  supplier_id: number;
  status: string;
  description: string;
  suggested_action?: string | null;
  suggested_action_notes?: string | null;
  final_action?: string | null;
  final_action_notes?: string | null;
  damage_audit_logs?: Array<{
    id: string;
    event_type: string;
    created_at: string;
    actor_profile?: string | null;
  }>;
};

export default function DamageDetail() {
  const { damageId } = useParams<{ damageId: string }>();
  const [data, setData] = useState<DamageDetailData | null>(null);
  const [finalAction, setFinalAction] = useState('reposicao');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    load();
  }, [load]);

  const resolveDamage = async (actionOverride?: string) => {
    const actionToSend = actionOverride ?? finalAction;
    try {
      setSubmitting(true);
      await api.patch(`/damages/${damageId}/resolve`, {
        final_action: actionToSend,
        final_action_notes: notes || undefined,
      });
      await load();
    } catch (err: unknown) {
      alert(getApiErrorMessage(err, 'Erro ao definir ação corretiva'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="o-loading">Carregando avaria…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="o-empty">Avaria não encontrada.</div>;

  const canResolve = !data.final_action;

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/damages" className="btn btn-outline btn-sm">
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
        <span className={getDamageStatusBadgeClass(data.status)}>{getDamageStatusLabel(data.status)}</span>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-grid">
          <div className="o-detail-item">
            <div className="label">Fornecedor</div>
            <div className="value">#{data.supplier_id}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Sugestão do fornecedor</div>
            <div className="value">{data.suggested_action || '—'}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Ação final</div>
            <div className="value">{data.final_action || 'Pendente'}</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="label">Descrição</div>
          <div className="value">{data.description}</div>
        </div>
        {data.suggested_action_notes && (
          <div style={{ marginTop: 12 }}>
            <div className="label">Observações da sugestão</div>
            <div className="value">{data.suggested_action_notes}</div>
          </div>
        )}
      </div>

      {canResolve && (
        <div className="o-detail-section">
          <div className="o-detail-header">
            <h2 style={{ fontSize: '1.125rem' }}>Definir Ação Corretiva</h2>
          </div>
          <div className="form-group" style={{ maxWidth: 420 }}>
            <label className="form-label">Ação final</label>
            <select
              className="form-input"
              value={finalAction}
              onChange={(e) => setFinalAction(e.target.value)}
            >
              <option value="reposicao">Reposição</option>
              <option value="cancelamento_parcial">Cancelamento parcial</option>
              <option value="cancelamento_total">Cancelamento total</option>
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: 720 }}>
            <label className="form-label">Justificativa</label>
            <textarea
              className="form-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {data.suggested_action && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => resolveDamage(data.suggested_action)}
              >
                Aceitar sugestão
              </button>
              <button
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => resolveDamage()}
              >
                Recusar e definir outra
              </button>
            </div>
          )}
          <button className="btn btn-primary" disabled={submitting} onClick={() => resolveDamage()}>
            {submitting ? 'Salvando...' : 'Confirmar ação corretiva'}
          </button>
        </div>
      )}

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Timeline de Auditoria</h2>
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
