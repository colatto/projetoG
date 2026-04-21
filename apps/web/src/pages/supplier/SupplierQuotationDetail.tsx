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
} from '../quotation-helpers';
import '../quotations.css';

type QuotationItem = {
  id: number;
  description: string | null;
  quantity: number | null;
  unit: string | null;
};

type ResponseVersion = {
  id: string;
  version: number;
  review_status: string;
  integration_status: string;
  submitted_at: string | null;
  review_notes: string | null;
  supplier_answer_date: string | null;
  validity: string | null;
  seller: string | null;
  discount: number | null;
  freight_type: string | null;
  freight_value: number | null;
  other_expenses: number | null;
  internal_notes: string | null;
  supplier_notes: string | null;
  payment_condition: string | null;
  quotation_response_items?: Array<{
    id: string;
    purchase_quotation_item_id: number;
    unit_price: number | null;
    negotiated_quantity: number | null;
    item_discount: number | null;
    ipi_percent: number | null;
    iss_percent: number | null;
    icms_percent: number | null;
    freight_per_unit: number | null;
    quotation_response_item_deliveries?: Array<{
      delivery_number: number;
      delivery_date: string;
      delivery_quantity: number;
    }>;
  }>;
};

type SupplierQuotationDetailDto = {
  id: string;
  status: string;
  read_at: string | null;
  latest_response_id: string | null;
  purchase_quotations: {
    id: number;
    sent_at: string | null;
    end_at: string | null;
    end_date: string | null;
    quotation_date: string | null;
    purchase_quotation_items: QuotationItem[];
  };
  quotation_responses?: ResponseVersion[];
};

type ItemFormValues = {
  negotiatedQuantity: number;
  unitPrice: number;
  deliveryDate: string;
  itemDiscount: number;
  ipiPercent: number;
  issPercent: number;
  icmsPercent: number;
  freightPerUnit: number;
};

type FormGlobals = {
  validity: string;
  seller: string;
  discount: number;
  freightType: string;
  freightValue: number;
  otherExpenses: number;
  internalNotes: string;
  supplierNotes: string;
  paymentCondition: string;
};

export default function SupplierQuotationDetail() {
  const { id } = useParams();
  const quotationId = useMemo(() => Number(id), [id]);
  const [data, setData] = useState<SupplierQuotationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: string; msg: string } | null>(null);

  const [itemForm, setItemForm] = useState<Record<number, ItemFormValues>>({});
  const [globals, setGlobals] = useState<FormGlobals>({
    validity: '',
    seller: '',
    discount: 0,
    freightType: '',
    freightValue: 0,
    otherExpenses: 0,
    internalNotes: '',
    supplierNotes: '',
    paymentCondition: '',
  });

  const reload = async () => {
    const res = await api.get(`/supplier/quotations/${quotationId}`);
    const dto = res.data.data as SupplierQuotationDetailDto;
    setData(dto);
    return dto;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const dto = await reload();

        const initial: Record<number, ItemFormValues> = {};
        const defaultDelivery = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        (dto.purchase_quotations.purchase_quotation_items ?? []).forEach((it) => {
          initial[it.id] = {
            negotiatedQuantity: Number(it.quantity ?? 0),
            unitPrice: 0,
            deliveryDate: defaultDelivery,
            itemDiscount: 0,
            ipiPercent: 0,
            issPercent: 0,
            icmsPercent: 0,
            freightPerUnit: 0,
          };
        });
        setItemForm(initial);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, 'Erro ao carregar cotação'));
      } finally {
        setLoading(false);
      }
    };
    if (!Number.isNaN(quotationId)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const markRead = async () => {
    try {
      setFeedback(null);
      await api.post(`/supplier/quotations/${quotationId}/read`);
      setFeedback({ type: 'success', msg: 'Leitura registrada com sucesso.' });
      await reload();
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: getApiErrorMessage(e, 'Erro ao marcar leitura') });
    }
  };

  const submit = async () => {
    if (!data) return;
    try {
      setSubmitting(true);
      setFeedback(null);

      const items = data.purchase_quotations.purchase_quotation_items.map((it, idx) => {
        const values = itemForm[it.id];
        return {
          purchaseQuotationItemId: it.id,
          quotationItemNumber: idx + 1,
          quotedQuantity: Number(it.quantity ?? 0),
          negotiatedQuantity: Number(values?.negotiatedQuantity ?? 0),
          unitPrice: Number(values?.unitPrice ?? 0),
          itemDiscount: values?.itemDiscount || undefined,
          ipiPercent: values?.ipiPercent || undefined,
          issPercent: values?.issPercent || undefined,
          icmsPercent: values?.icmsPercent || undefined,
          freightPerUnit: values?.freightPerUnit || undefined,
          deliveries: [
            {
              deliveryDate: String(values?.deliveryDate ?? ''),
              deliveryQuantity: Number(values?.negotiatedQuantity ?? 0),
            },
          ],
        };
      });

      const supplierAnswerDate = new Date().toISOString().slice(0, 10);
      const res = await api.post(`/supplier/quotations/${quotationId}/respond`, {
        supplierAnswerDate,
        validity: globals.validity || undefined,
        seller: globals.seller || undefined,
        discount: globals.discount || undefined,
        freightType: globals.freightType || undefined,
        freightValue: globals.freightValue || undefined,
        otherExpenses: globals.otherExpenses || undefined,
        internalNotes: globals.internalNotes || undefined,
        supplierNotes: globals.supplierNotes || undefined,
        paymentCondition: globals.paymentCondition || undefined,
        items,
      });
      setFeedback({
        type: 'success',
        msg: `Resposta enviada com sucesso. Versão: ${res.data.version}`,
      });
      await reload();
    } catch (e: unknown) {
      setFeedback({ type: 'error', msg: getApiErrorMessage(e, 'Erro ao enviar resposta') });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="q-loading">Carregando cotação…</div>;
  if (error) return <div className="q-notice q-notice--error">{error}</div>;
  if (!data) return <div className="q-empty">Cotação não encontrada.</div>;

  const pq = data.purchase_quotations;
  const items = pq.purchase_quotation_items ?? [];
  const responses = (data.quotation_responses ?? []).slice().sort((a, b) => b.version - a.version);
  const latest = responses[0];
  const isExpired = (() => {
    const end = pq.end_at
      ? new Date(pq.end_at)
      : pq.end_date
        ? new Date(`${pq.end_date}T23:59:59.999Z`)
        : null;
    return end ? end.getTime() < Date.now() : false;
  })();
  const isReadOnly =
    isTerminalStatus(data.status) || isExpired || latest?.review_status === 'approved';
  const showCorrectionNotice = latest?.review_status === 'correction_requested';

  return (
    <div>
      {/* Header */}
      <div className="q-page-header">
        <div>
          <p className="q-page-subtitle" style={{ marginBottom: '0.25rem' }}>
            <Link to="/supplier/quotations">← Voltar</Link>
          </p>
          <h1 className="q-page-title">Cotação #{quotationId}</h1>
          <p className="q-page-subtitle">
            Data: {formatDate(pq.quotation_date)} &nbsp;|&nbsp; Prazo:{' '}
            <span className={getDeadlineClass(pq.end_at, pq.end_date)}>
              {formatDate(pq.end_at ?? pq.end_date)}
            </span>
          </p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <span className={getStatusBadgeClass(data.status)}>{getStatusLabel(data.status)}</span>
          {!data.read_at && (
            <button className="btn btn-primary btn-sm" onClick={markRead}>
              Marcar como lida
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && <div className={`q-notice q-notice--${feedback.type}`}>{feedback.msg}</div>}

      {/* Correction notice */}
      {showCorrectionNotice && (
        <div className="q-notice q-notice--warning">
          <strong>⚠ Correção solicitada</strong>
          {latest.review_notes && <div style={{ marginTop: '0.25rem' }}>{latest.review_notes}</div>}
        </div>
      )}

      {/* Expired notice */}
      {isExpired && (
        <div className="q-notice q-notice--error">
          O prazo desta cotação expirou. Não é possível enviar ou alterar respostas.
        </div>
      )}

      {/* Response history */}
      {responses.length > 0 && (
        <div className="q-section">
          <h2 className="q-section__title">📋 Histórico de respostas</h2>
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
                {r.seller && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                    Vendedor: {r.seller}
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
        </div>
      )}

      {/* Response form */}
      <div className="q-section">
        <h2 className="q-section__title">
          {isReadOnly ? '📄 Detalhes da cotação' : '✏️ Responder cotação'}
        </h2>

        <div className={`q-response-form ${isReadOnly ? 'q-form-disabled' : ''}`}>
          {/* Global fields */}
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-gray-500)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              }}
            >
              Dados gerais da proposta
            </div>
            <div className="q-response-form__grid">
              <div className="form-group">
                <label className="form-label" htmlFor="f-validity">
                  Validade
                </label>
                <input
                  id="f-validity"
                  type="date"
                  className="form-input"
                  value={globals.validity}
                  onChange={(e) => setGlobals((g) => ({ ...g, validity: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-seller">
                  Vendedor
                </label>
                <input
                  id="f-seller"
                  type="text"
                  className="form-input"
                  value={globals.seller}
                  onChange={(e) => setGlobals((g) => ({ ...g, seller: e.target.value }))}
                  placeholder="Nome do vendedor"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-discount">
                  Desconto geral (%)
                </label>
                <input
                  id="f-discount"
                  type="number"
                  className="form-input"
                  value={globals.discount || ''}
                  onChange={(e) => setGlobals((g) => ({ ...g, discount: Number(e.target.value) }))}
                  min={0}
                  max={100}
                  step={0.01}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-freight-type">
                  Tipo de frete
                </label>
                <select
                  id="f-freight-type"
                  className="form-input"
                  value={globals.freightType}
                  onChange={(e) => setGlobals((g) => ({ ...g, freightType: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-freight-value">
                  Valor do frete (R$)
                </label>
                <input
                  id="f-freight-value"
                  type="number"
                  className="form-input"
                  value={globals.freightValue || ''}
                  onChange={(e) =>
                    setGlobals((g) => ({ ...g, freightValue: Number(e.target.value) }))
                  }
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-other-expenses">
                  Outras despesas (R$)
                </label>
                <input
                  id="f-other-expenses"
                  type="number"
                  className="form-input"
                  value={globals.otherExpenses || ''}
                  onChange={(e) =>
                    setGlobals((g) => ({ ...g, otherExpenses: Number(e.target.value) }))
                  }
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-payment">
                  Condição de pagamento
                </label>
                <input
                  id="f-payment"
                  type="text"
                  className="form-input"
                  value={globals.paymentCondition}
                  onChange={(e) => setGlobals((g) => ({ ...g, paymentCondition: e.target.value }))}
                  placeholder="Ex: 30/60/90 dias"
                />
              </div>
            </div>
            <div className="q-response-form__grid" style={{ marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="f-internal-notes">
                  Observações internas
                </label>
                <textarea
                  id="f-internal-notes"
                  className="form-input"
                  rows={2}
                  value={globals.internalNotes}
                  onChange={(e) => setGlobals((g) => ({ ...g, internalNotes: e.target.value }))}
                  placeholder="Visível apenas internamente"
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="f-supplier-notes">
                  Observações do fornecedor
                </label>
                <textarea
                  id="f-supplier-notes"
                  className="form-input"
                  rows={2}
                  value={globals.supplierNotes}
                  onChange={(e) => setGlobals((g) => ({ ...g, supplierNotes: e.target.value }))}
                  placeholder="Visível pelo comprador"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Per-item fields */}
          {items.map((it, idx) => {
            const values = itemForm[it.id] ?? {
              negotiatedQuantity: 0,
              unitPrice: 0,
              deliveryDate: '',
              itemDiscount: 0,
              ipiPercent: 0,
              issPercent: 0,
              icmsPercent: 0,
              freightPerUnit: 0,
            };

            const updateItem = (field: keyof ItemFormValues, val: number | string) => {
              setItemForm((prev) => ({
                ...prev,
                [it.id]: { ...values, [field]: val },
              }));
            };

            return (
              <div key={it.id} className="q-response-form__item">
                <div className="q-response-form__item-header">
                  Item {idx + 1} — {it.description ?? `#${it.id}`}
                  <span
                    style={{
                      fontWeight: 400,
                      color: 'var(--color-gray-500)',
                      marginLeft: '0.5rem',
                    }}
                  >
                    (Qtd solicitada: {it.quantity ?? '—'} {it.unit ?? ''})
                  </span>
                </div>
                <div className="q-response-form__grid">
                  <div className="form-group">
                    <label className="form-label">Qtd negociada</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.negotiatedQuantity || ''}
                      onChange={(e) => updateItem('negotiatedQuantity', Number(e.target.value))}
                      min={0}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço unitário (R$)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.unitPrice || ''}
                      onChange={(e) => updateItem('unitPrice', Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data de entrega</label>
                    <input
                      type="date"
                      className="form-input"
                      value={values.deliveryDate}
                      onChange={(e) => updateItem('deliveryDate', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Desconto item (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.itemDiscount || ''}
                      onChange={(e) => updateItem('itemDiscount', Number(e.target.value))}
                      min={0}
                      max={100}
                      step={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IPI (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.ipiPercent || ''}
                      onChange={(e) => updateItem('ipiPercent', Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ISS (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.issPercent || ''}
                      onChange={(e) => updateItem('issPercent', Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ICMS (%)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.icmsPercent || ''}
                      onChange={(e) => updateItem('icmsPercent', Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Frete unit. (R$)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={values.freightPerUnit || ''}
                      onChange={(e) => updateItem('freightPerUnit', Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Submit */}
          {!isReadOnly && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? 'Enviando…' : 'Enviar resposta'}
              </button>
            </div>
          )}

          {isReadOnly && !isExpired && (
            <div
              style={{
                marginTop: '1rem',
                fontSize: '0.8125rem',
                color: 'var(--color-gray-400)',
                fontStyle: 'italic',
              }}
            >
              Esta cotação está em modo somente leitura.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
