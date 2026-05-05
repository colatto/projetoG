import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { getOrderStatusLabel, getOrderStatusBadgeClass, formatDate } from '../orders-helpers';
import '../orders.css';

type DeliveryRecord = {
  id: number;
  invoice_sequential_number: number;
  delivery_date: string | null;
  delivered_quantity: string;
  validation_status: string;
};

type OrderStatusHistory = {
  id: string;
  previous_status: string | null;
  new_status: string;
  created_at: string;
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
};

export default function SupplierOrderDetail() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();

  const [order, setOrder] = useState<PurchaseOrderRow | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  if (loading) return <div className="o-loading">Carregando detalhes…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!order) return <div className="o-empty">Pedido não encontrado.</div>;

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div className="mb-4">
        <Link to="/supplier/orders" className="btn btn-outline btn-sm">
          ← Voltar para lista
        </Link>
      </div>

      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Pedido #{order.sienge_purchase_order_id}</h1>
          <p className="o-page-subtitle">Acompanhamento logístico</p>
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
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={4} className="o-empty">
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
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={2} className="o-empty">
                    Sem histórico.
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
