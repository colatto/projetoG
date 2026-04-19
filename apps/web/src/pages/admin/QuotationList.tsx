import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';

type QuotationRow = {
  id: number;
  quotation_date: string | null;
  end_at: string | null;
  end_date: string | null;
  sent_at: string | null;
  supplier_negotiations?: Array<{
    supplier_id: number;
    status: string;
    read_at: string | null;
    latest_response_id: string | null;
    closed_order_id: number | null;
  }>;
};

export default function QuotationList() {
  const [data, setData] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/quotations', { params: { page: 1, limit: 50 } });
        setData(res.data.data ?? []);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, 'Erro ao carregar cotações'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Cotações</h2>

      {loading && <div>Carregando...</div>}
      {error && (
        <div style={{ padding: 12, background: '#fff1f2', border: '1px solid #fecdd3' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: 12 }}>ID</th>
                <th style={{ padding: 12 }}>Data</th>
                <th style={{ padding: 12 }}>Fim</th>
                <th style={{ padding: 12 }}>Enviada</th>
                <th style={{ padding: 12 }}>Fornecedores</th>
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 12 }}>
                    <Link
                      to={`/admin/quotations/${q.id}`}
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {q.id}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>{q.quotation_date ?? '-'}</td>
                  <td style={{ padding: 12 }}>{q.end_at ?? q.end_date ?? '-'}</td>
                  <td style={{ padding: 12 }}>{q.sent_at ? 'Sim' : 'Não'}</td>
                  <td style={{ padding: 12 }}>{q.supplier_negotiations?.length ?? 0}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 16, color: 'var(--color-gray-500)' }}>
                    Nenhuma cotação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
