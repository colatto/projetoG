import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import '../orders.css';
import './dashboard-prd.css';

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
    queueMicrotask(() => {
      void load();
    });
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
          <div className="dashboard-cards">
            <div className="dashboard-card dashboard-card--turquesa">
              <span className="dashboard-card__label">Cotações abertas</span>
              <span className="dashboard-card__value">{summary.cotacoes_abertas}</span>
            </div>
            <div className="dashboard-card dashboard-card--azul">
              <span className="dashboard-card__label">Aguardando revisão</span>
              <span className="dashboard-card__value">{summary.cotacoes_aguardando_revisao}</span>
            </div>
            <div className="dashboard-card dashboard-card--vermelho">
              <span className="dashboard-card__label">Pedidos atrasados</span>
              <span className="dashboard-card__value">{summary.pedidos_atrasados}</span>
            </div>
            <div className="dashboard-card dashboard-card--roxo">
              <span className="dashboard-card__label">Pedidos em avaria</span>
              <span className="dashboard-card__value">{summary.pedidos_em_avaria}</span>
            </div>
            <div className="dashboard-card dashboard-card--vermelho">
              <span className="dashboard-card__label">Falhas de integração</span>
              <span className="dashboard-card__value">{summary.falhas_integracao}</span>
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
