import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '@projetog/domain';
import '../orders.css';

export default function DamageCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [description, setDescription] = useState('');
  const [affectedQuantity, setAffectedQuantity] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('');
  const [suggestedActionNotes, setSuggestedActionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupplier = user?.role === UserRole.FORNECEDOR;
  const backPath = isSupplier ? '/supplier/damages' : '/admin/damages';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      await api.post('/damages', {
        purchase_order_id: Number(purchaseOrderId),
        purchase_order_item_number: Number(itemNumber),
        description,
        affected_quantity: affectedQuantity ? Number(affectedQuantity) : undefined,
        suggested_action: isSupplier && suggestedAction ? suggestedAction : undefined,
        suggested_action_notes: isSupplier && suggestedActionNotes ? suggestedActionNotes : undefined,
      });

      navigate(backPath);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao registrar avaria'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link to={backPath} className="btn btn-outline btn-sm">
          ← Voltar
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Registrar Avaria</h1>
          <p className="o-page-subtitle">Registre a ocorrência e, se aplicável, a sugestão inicial</p>
        </div>
      </div>

      {error && <div className="q-notice q-notice--error">{error}</div>}

      <form className="o-detail-section" onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="o-detail-grid">
          <div className="form-group">
            <label className="form-label">Pedido (ID)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              required
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Item do pedido</label>
            <input
              className="form-input"
              type="number"
              min={1}
              required
              value={itemNumber}
              onChange={(e) => setItemNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Descrição da avaria</label>
          <textarea
            className="form-input"
            rows={4}
            minLength={10}
            maxLength={2000}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Quantidade afetada (opcional)</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            min={0}
            value={affectedQuantity}
            onChange={(e) => setAffectedQuantity(e.target.value)}
          />
        </div>

        {isSupplier && (
          <>
            <div className="form-group">
              <label className="form-label">Sugestão de ação corretiva (opcional)</label>
              <select
                className="form-input"
                value={suggestedAction}
                onChange={(e) => setSuggestedAction(e.target.value)}
              >
                <option value="">Sem sugestão</option>
                <option value="cancelamento_parcial">Cancelamento parcial</option>
                <option value="cancelamento_total">Cancelamento total</option>
                <option value="reposicao">Reposição</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observações da sugestão</label>
              <textarea
                className="form-input"
                rows={3}
                maxLength={1000}
                value={suggestedActionNotes}
                onChange={(e) => setSuggestedActionNotes(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="modal-actions">
          <Link to={backPath} className="btn btn-outline">
            Cancelar
          </Link>
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Registrar Avaria'}
          </button>
        </div>
      </form>
    </div>
  );
}
