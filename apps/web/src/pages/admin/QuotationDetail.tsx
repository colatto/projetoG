import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';

type SupplierNegotiation = {
  id: string;
  supplier_id: number;
  status: string;
  read_at: string | null;
  sent_at: string | null;
  latest_response_id: string | null;
  closed_order_id: number | null;
  quotation_responses?: Array<{
    id: string;
    version: number;
    review_status: string;
    integration_status: string;
    submitted_at: string;
    reviewed_at: string | null;
  }>;
};

type QuotationDetailDto = {
  id: number;
  sent_at: string | null;
  end_at: string | null;
  end_date: string | null;
  purchase_quotation_items?: Array<{ id: number; description: string | null; quantity: number | null; unit: string | null }>;
  supplier_negotiations?: SupplierNegotiation[];
};

export default function QuotationDetail() {
  const { id } = useParams();
  const quotationId = useMemo(() => Number(id), [id]);
  const [data, setData] = useState<QuotationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/quotations/${quotationId}`);
        setData(res.data.data);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Erro ao carregar cotação');
      } finally {
        setLoading(false);
      }
    };
    if (!Number.isNaN(quotationId)) load();
  }, [quotationId]);

  const onSend = async () => {
    if (!data) return;
    try {
      setSending(true);
      const endAt = data.end_at ?? (data.end_date ? new Date(`${data.end_date}T23:59:59.999Z`).toISOString() : null);
      const res = await api.post(`/quotations/${quotationId}/send`, { end_at: endAt ?? new Date(Date.now() + 7 * 86400000).toISOString() });
      alert(`Enviada. Fornecedores enviados: ${res.data.suppliers_sent}`);
      const reload = await api.get(`/quotations/${quotationId}`);
      setData(reload.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao enviar');
    } finally {
      setSending(false);
    }
  };

  const review = async (supplierId: number, action: 'approve' | 'reject' | 'request_correction') => {
    try {
      const notes = window.prompt('Observações (opcional):') ?? undefined;
      const res = await api.post(`/quotations/${quotationId}/suppliers/${supplierId}/review`, { action, notes });
      alert(res.data.message ?? 'OK');
      const reload = await api.get(`/quotations/${quotationId}`);
      setData(reload.data.data);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao revisar');
    }
  };

  const retryIntegration = async (supplierId: number) => {
    try {
      const res = await api.post(`/quotations/${quotationId}/suppliers/${supplierId}/retry-integration`);
      alert(res.data.message ?? 'Reprocessamento enfileirado');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao reprocessar');
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div style={{ padding: 12, background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>;
  if (!data) return <div>Não encontrado.</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Cotação #{data.id}</h2>
          <div style={{ color: 'var(--color-gray-600)' }}>
            Enviada: {data.sent_at ? 'Sim' : 'Não'} | Fim: {data.end_at ?? data.end_date ?? '-'}
          </div>
        </div>
        <button
          onClick={onSend}
          disabled={sending || !!data.sent_at}
          style={{
            background: data.sent_at ? 'var(--color-gray-200)' : 'var(--color-primary)',
            color: data.sent_at ? 'var(--color-gray-700)' : 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: data.sent_at ? 'not-allowed' : 'pointer',
          }}
        >
          {data.sent_at ? 'Enviada' : sending ? 'Enviando...' : 'Enviar cotação'}
        </button>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontWeight: 700 }}>Itens</h3>
      <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: 12 }}>ItemId</th>
              <th style={{ padding: 12 }}>Descrição</th>
              <th style={{ padding: 12 }}>Qtd</th>
              <th style={{ padding: 12 }}>Un</th>
            </tr>
          </thead>
          <tbody>
            {(data.purchase_quotation_items ?? []).map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: 12 }}>{it.id}</td>
                <td style={{ padding: 12 }}>{it.description ?? '-'}</td>
                <td style={{ padding: 12 }}>{it.quantity ?? '-'}</td>
                <td style={{ padding: 12 }}>{it.unit ?? '-'}</td>
              </tr>
            ))}
            {(data.purchase_quotation_items ?? []).length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 16, color: 'var(--color-gray-500)' }}>
                  Itens ainda não disponíveis localmente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontWeight: 700 }}>Fornecedores</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {(data.supplier_negotiations ?? []).map((sn) => {
          const latest = (sn.quotation_responses ?? []).slice().sort((a, b) => b.version - a.version)[0];
          return (
            <div key={sn.id} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Fornecedor {sn.supplier_id}</div>
                  <div style={{ color: 'var(--color-gray-600)', fontSize: 12 }}>
                    Status: {sn.status} | Lida: {sn.read_at ? 'Sim' : 'Não'}
                  </div>
                </div>
                {sn.closed_order_id && <div style={{ fontSize: 12 }}>Pedido: {sn.closed_order_id}</div>}
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                Última resposta: {latest ? `v${latest.version} (${latest.review_status}/${latest.integration_status})` : '—'}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => review(sn.supplier_id, 'approve')}
                  style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
                >
                  Aprovar
                </button>
                <button
                  onClick={() => review(sn.supplier_id, 'reject')}
                  style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
                >
                  Reprovar
                </button>
                <button
                  onClick={() => review(sn.supplier_id, 'request_correction')}
                  style={{ background: '#f59e0b', color: 'black', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
                >
                  Solicitar correção
                </button>
                <button
                  onClick={() => retryIntegration(sn.supplier_id)}
                  style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}
                >
                  Retry integração
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

