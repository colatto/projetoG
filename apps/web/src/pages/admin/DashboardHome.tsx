import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import '../orders.css';

type DashboardSummary = {
  cotacoes_abertas: number;
  cotacoes_aguardando_revisao: number;
  pedidos_atrasados: number;
  pedidos_em_avaria: number;
  falhas_integracao: number;
  data_snapshot: string;
};

const links = [
  { to: '/admin/dashboard/lead-time', label: 'Lead Time' },
  { to: '/admin/dashboard/atrasos', label: 'Atrasos' },
  { to: '/admin/dashboard/criticidade', label: 'Criticidade' },
  { to: '/admin/dashboard/ranking-fornecedores', label: 'Ranking de Fornecedores' },
  { to: '/admin/dashboard/avarias', label: 'Avarias' },
];

export default function DashboardHome() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/dashboard/resumo');
        setSummary(response.data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Erro ao carregar resumos rápidos do dashboard'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Dashboard e Indicadores</h1>
          <p className="o-page-subtitle">Visão analítica consolidada da operação</p>
        </div>
      </div>

      {loading && <div className="o-loading">Carregando resumos rápidos…</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && summary && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div className="q-notice">Cotações abertas: {summary.cotacoes_abertas}</div>
            <div className="q-notice">
              Aguardando revisão: {summary.cotacoes_aguardando_revisao}
            </div>
            <div className="q-notice q-notice--error">
              Pedidos atrasados: {summary.pedidos_atrasados}
            </div>
            <div className="q-notice">Pedidos em avaria: {summary.pedidos_em_avaria}</div>
            <div className="q-notice q-notice--error">
              Falhas de integração: {summary.falhas_integracao}
            </div>
          </div>

          <p style={{ marginBottom: '1.25rem', color: 'var(--color-gray-500)' }}>
            Dados consolidados em: {new Date(summary.data_snapshot).toLocaleDateString('pt-BR')}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="btn btn-primary">
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
