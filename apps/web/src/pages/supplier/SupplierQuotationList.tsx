import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import {
  getStatusLabel,
  getStatusBadgeClass,
  formatDate,
  getDeadlineClass,
} from '../quotation-helpers';
import '../quotations.css';

type SupplierQuotationRow = {
  id: string;
  status: string;
  read_at: string | null;
  latest_response_id: string | null;
  purchase_quotation_id: number;
  purchase_quotations?: {
    id: number;
    public_id: string | null;
    quotation_date: string | null;
    end_at: string | null;
    end_date: string | null;
    sent_at: string | null;
  } | null;
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
      <div className="q-page-header">
        <div>
          <h1 className="q-page-title">Minhas cotações</h1>
          <p className="q-page-subtitle">
            {data.length} cotaç{data.length === 1 ? 'ão' : 'ões'} disponíve
            {data.length === 1 ? 'l' : 'is'}
          </p>
        </div>
      </div>

      {loading && <div className="q-loading">Carregando cotações…</div>}

      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cotação</th>
                <th>Data</th>
                <th>Prazo</th>
                <th>Status</th>
                <th>Leitura</th>
                <th>Resposta</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sn) => {
                const pq = sn.purchase_quotations;
                const deadlineClass = pq ? getDeadlineClass(pq.end_at, pq.end_date) : '';

                return (
                  <tr key={sn.id} className="q-table-row">
                    <td>
                      <Link
                        to={`/supplier/quotations/${sn.purchase_quotation_id}`}
                        style={{ fontWeight: 600 }}
                      >
                        #{sn.purchase_quotation_id}
                      </Link>
                    </td>
                    <td>{formatDate(pq?.quotation_date)}</td>
                    <td className={deadlineClass}>{formatDate(pq?.end_at ?? pq?.end_date)}</td>
                    <td>
                      <span className={getStatusBadgeClass(sn.status)}>
                        {getStatusLabel(sn.status)}
                      </span>
                    </td>
                    <td>
                      <span className="read-indicator">
                        <span
                          className={`read-dot ${sn.read_at ? 'read-dot--yes' : 'read-dot--no'}`}
                        />
                        {sn.read_at ? 'Lida' : 'Não lida'}
                      </span>
                    </td>
                    <td>
                      {sn.latest_response_id ? (
                        <span className="badge-status badge-approved">Enviada</span>
                      ) : (
                        <span style={{ color: 'var(--color-gray-400)', fontSize: '0.8125rem' }}>
                          Pendente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="q-empty">
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
