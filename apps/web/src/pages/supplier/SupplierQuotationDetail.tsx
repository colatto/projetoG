import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';

type QuotationItem = {
  id: number; // purchaseQuotationItemId (Sienge)
  description: string | null;
  quantity: number | null;
  unit: string | null;
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
    purchase_quotation_items: QuotationItem[];
  };
  quotation_responses?: Array<{
    id: string;
    version: number;
    review_status: string;
    integration_status: string;
  }>;
};

export default function SupplierQuotationDetail() {
  const { id } = useParams();
  const quotationId = useMemo(() => Number(id), [id]);
  const [data, setData] = useState<SupplierQuotationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<
    Record<number, { negotiatedQuantity: number; unitPrice: number; deliveryDate: string }>
  >({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/supplier/quotations/${quotationId}`);
        const dto = res.data.data as SupplierQuotationDetailDto;
        setData(dto);

        const initial: Record<
          number,
          { negotiatedQuantity: number; unitPrice: number; deliveryDate: string }
        > = {};
        const today = new Date();
        const defaultDelivery = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
        (dto.purchase_quotations.purchase_quotation_items ?? []).forEach((it) => {
          initial[it.id] = {
            negotiatedQuantity: Number(it.quantity ?? 0),
            unitPrice: 0,
            deliveryDate: defaultDelivery,
          };
        });
        setForm(initial);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, 'Erro ao carregar cotação'));
      } finally {
        setLoading(false);
      }
    };
    if (!Number.isNaN(quotationId)) load();
  }, [quotationId]);

  const markRead = async () => {
    try {
      const res = await api.post(`/supplier/quotations/${quotationId}/read`);
      alert(`Leitura registrada em ${res.data.read_at}`);
      const reload = await api.get(`/supplier/quotations/${quotationId}`);
      setData(reload.data.data);
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, 'Erro ao marcar leitura'));
    }
  };

  const submit = async () => {
    if (!data) return;
    try {
      setSubmitting(true);
      const items = data.purchase_quotations.purchase_quotation_items.map((it, idx) => {
        const values = form[it.id];
        return {
          purchaseQuotationItemId: it.id,
          quotationItemNumber: idx + 1,
          quotedQuantity: Number(it.quantity ?? 0),
          negotiatedQuantity: Number(values?.negotiatedQuantity ?? 0),
          unitPrice: Number(values?.unitPrice ?? 0),
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
        items,
      });
      alert(`Resposta enviada. Versão: ${res.data.version}`);
      const reload = await api.get(`/supplier/quotations/${quotationId}`);
      setData(reload.data.data);
    } catch (e: unknown) {
      alert(getApiErrorMessage(e, 'Erro ao enviar resposta'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error)
    return (
      <div style={{ padding: 12, background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>
    );
  if (!data) return <div>Não encontrado.</div>;

  const endAt = data.purchase_quotations.end_at ?? data.purchase_quotations.end_date ?? '-';
  const latest = (data.quotation_responses ?? []).slice().sort((a, b) => b.version - a.version)[0];

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Cotação #{quotationId}</h2>
          <div style={{ color: 'var(--color-gray-600)' }}>
            Status: {data.status} | Prazo: {endAt}
          </div>
          <div style={{ color: 'var(--color-gray-600)', fontSize: 12 }}>
            Última resposta:{' '}
            {latest
              ? `v${latest.version} (${latest.review_status}/${latest.integration_status})`
              : '—'}
          </div>
        </div>
        <button
          onClick={markRead}
          disabled={!!data.read_at}
          style={{
            background: data.read_at ? 'var(--color-gray-200)' : 'var(--color-primary)',
            color: data.read_at ? 'var(--color-gray-700)' : 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: data.read_at ? 'not-allowed' : 'pointer',
          }}
        >
          {data.read_at ? 'Já lida' : 'Marcar como lida'}
        </button>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontWeight: 700 }}>Responder</h3>
      <div
        style={{
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: 14,
        }}
      >
        {(data.purchase_quotations.purchase_quotation_items ?? []).map((it, idx) => {
          const values = form[it.id] ?? { negotiatedQuantity: 0, unitPrice: 0, deliveryDate: '' };
          return (
            <div
              key={it.id}
              style={{
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Item {idx + 1} — {it.description ?? `#${it.id}`}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                <label style={{ fontSize: 12, color: 'var(--color-gray-700)' }}>
                  Quantidade negociada
                  <input
                    type="number"
                    value={values.negotiatedQuantity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [it.id]: { ...values, negotiatedQuantity: Number(e.target.value) },
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </label>
                <label style={{ fontSize: 12, color: 'var(--color-gray-700)' }}>
                  Preço unitário
                  <input
                    type="number"
                    value={values.unitPrice}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [it.id]: { ...values, unitPrice: Number(e.target.value) },
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </label>
                <label style={{ fontSize: 12, color: 'var(--color-gray-700)' }}>
                  Data de entrega
                  <input
                    type="date"
                    value={values.deliveryDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [it.id]: { ...values, deliveryDate: e.target.value },
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </label>
              </div>
            </div>
          );
        })}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Enviando...' : 'Enviar resposta'}
        </button>
      </div>
    </div>
  );
}
