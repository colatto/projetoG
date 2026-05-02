import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { UserRole } from '@projetog/domain';
import { canOperateOrderDeliveries } from '../../lib/rbac-ui';
import { useAuth } from '../../contexts/AuthContext';
import { getOrderStatusLabel, getOrderStatusBadgeClass, formatDate } from '../orders-helpers';
import '../orders.css';

type DeliveryRecord = {
  id: number;
  invoice_sequential_number: number;
  delivery_date: string | null;
  delivered_quantity: string;
  validation_status: string;
  validation_notes: string | null;
  validated_at: string | null;
};

type OrderStatusHistory = {
  id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
  changed_by_system: boolean;
};

type PurchaseOrderRow = {
  id: number;
  sienge_purchase_order_id: number;
  supplier_id: number;
  local_status: string;
  created_at: string;
  last_delivery_date: string | null;
  total_quantity_ordered: string;
  total_quantity_delivered: string;
  pending_quantity: string;
  has_divergence: boolean;
  suppliers?: { name: string } | null;
};

export default function OrderDetail() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const { user } = useAuth();
  const allowDeliveryActions = canOperateOrderDeliveries(user?.role);
  const isViewer = user?.role === UserRole.VISUALIZADOR_PEDIDOS;

  const [order, setOrder] = useState<PurchaseOrderRow | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [validatingDelivery, setValidatingDelivery] = useState<DeliveryRecord | null>(null);
  const [validationStatus, setValidationStatus] = useState<'OK' | 'DIVERGENCIA'>('OK');
  const [validationNotes, setValidationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resOrder = await api.get(`/orders`);
      const o = resOrder.data.find((x: PurchaseOrderRow) => x.id === Number(purchaseOrderId));
      if (!o) throw new Error('Pedido não encontrado');
      setOrder(o);

      const resDel = await api.get(`/orders/${purchaseOrderId}/deliveries`);
      setDeliveries(resDel.data ?? []);

      const resHist = await api.get(`/orders/${purchaseOrderId}/status-history`);
      setHistory(resHist.data ?? []);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar detalhe do pedido'));
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openValidationModal = (delivery: DeliveryRecord) => {
    setValidatingDelivery(delivery);
    setValidationStatus('OK');
    setValidationNotes('');
    setValidateModalOpen(true);
  };

  const handleValidationSubmit = async () => {
    if (!validatingDelivery) return;
    try {
      setSubmitting(true);
      await api.post(`/deliveries/${validatingDelivery.id}/validate`, {
        status: validationStatus,
        notes: validationNotes,
      });
      setValidateModalOpen(false);
      await loadData();
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, 'Erro ao validar entrega'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="o-loading">Carregando detalhes…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!order) return <div className="o-empty">Pedido não encontrado.</div>;

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/orders" className="btn btn-outline btn-sm">
          ← Voltar para lista
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Pedido #{order.sienge_purchase_order_id}</h1>
          <p className="o-page-subtitle">
            Fornecedor: {order.suppliers?.name ?? `#${order.supplier_id}`}
            {isViewer ? ' · Somente leitura' : ''}
          </p>
        </div>
        <div>
          <span className={getOrderStatusBadgeClass(order.local_status)}>
            {getOrderStatusLabel(order.local_status)}
          </span>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Resumo Físico</h2>
        </div>
        <div className="o-detail-grid">
          <div className="o-detail-item">
            <div className="label">Total Pedido</div>
            <div className="value">{Number(order.total_quantity_ordered).toFixed(2)}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Faturado</div>
            <div className="value">{Number(order.total_quantity_delivered).toFixed(2)}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Pendente</div>
            <div className="value">{Number(order.pending_quantity).toFixed(2)}</div>
          </div>
          <div className="o-detail-item">
            <div className="label">Última Entrega</div>
            <div className="value">{formatDate(order.last_delivery_date)}</div>
          </div>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Entregas Realizadas</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>NF (Seq)</th>
                <th>Data</th>
                <th>Qtd</th>
                <th>Status</th>
                {allowDeliveryActions ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>{d.invoice_sequential_number}</td>
                  <td>{formatDate(d.delivery_date)}</td>
                  <td>{Number(d.delivered_quantity).toFixed(2)}</td>
                  <td>
                    {d.validation_status === 'AGUARDANDO_VALIDACAO' && (
                      <span className="badge badge-warning">Aguardando Validação</span>
                    )}
                    {d.validation_status === 'DIVERGENCIA' && (
                      <span className="badge badge-orange">Divergência</span>
                    )}
                    {d.validation_status === 'OK' && (
                      <span className="badge badge-success">OK</span>
                    )}
                  </td>
                  {allowDeliveryActions ? (
                    <td>
                      {(d.validation_status === 'AGUARDANDO_VALIDACAO' ||
                        d.validation_status === 'DIVERGENCIA') && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openValidationModal(d)}
                        >
                          Revisar
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={allowDeliveryActions ? 5 : 4} className="o-empty">
                    Nenhuma entrega registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="o-detail-section">
        <div className="o-detail-header">
          <h2 style={{ fontSize: '1.125rem' }}>Histórico de Status</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Status</th>
                <th>Motivo</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleString('pt-BR')}</td>
                  <td>
                    <span className={getOrderStatusBadgeClass(h.new_status)}>
                      {getOrderStatusLabel(h.new_status)}
                    </span>
                  </td>
                  <td>{h.reason || '—'}</td>
                  <td>{h.changed_by_system ? 'Sistema' : 'Manual'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="o-empty">
                    Sem histórico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {allowDeliveryActions && validateModalOpen && validatingDelivery && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">
              Validar Entrega (NF {validatingDelivery.invoice_sequential_number})
            </h3>

            <div className="form-group">
              <label className="form-label">Ação</label>
              <select
                className="form-input"
                value={validationStatus}
                onChange={(e) => setValidationStatus(e.target.value as 'OK' | 'DIVERGENCIA')}
              >
                <option value="OK">Validar (OK)</option>
                <option value="DIVERGENCIA">Registrar Divergência</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Observações (opcional)</label>
              <textarea
                className="form-input"
                rows={3}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => setValidateModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={handleValidationSubmit}
              >
                {submitting ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
