import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';

type SupplierQuotationRow = {
  id: string;
  status: string;
  read_at: string | null;
  purchase_quotation_id: number;
  purchase_quotations?: {
    id: number;
    quotation_date: string | null;
    end_at: string | null;
    end_date: string | null;
    sent_at: string | null;
  };
};

export default function SupplierQuotationList() {
  const [data, setData] = useState<SupplierQuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/supplier/quotations');
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
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Minhas cotações</h2>

      {loading && <div>Carregando...</div>}
      {error && (
        <div style={{ padding: 12, background: '#fff1f2', border: '1px solid #fecdd3' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: 12 }}>Cotação</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Prazo</th>
                <th style={{ padding: 12 }}>Lida</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sn) => (
                <tr key={sn.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 12 }}>
                    <Link
                      to={`/supplier/quotations/${sn.purchase_quotation_id}`}
                      style={{ color: 'var(--color-primary)' }}
                    >
                      #{sn.purchase_quotation_id}
                    </Link>
                  </td>
                  <td style={{ padding: 12 }}>{sn.status}</td>
                  <td style={{ padding: 12 }}>
                    {sn.purchase_quotations?.end_at ?? sn.purchase_quotations?.end_date ?? '-'}
                  </td>
                  <td style={{ padding: 12 }}>{sn.read_at ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: 'var(--color-gray-500)' }}>
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

