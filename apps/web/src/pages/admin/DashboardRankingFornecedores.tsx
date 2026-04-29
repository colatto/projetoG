import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import '../orders.css';

type RankingPayload = {
  fornecedores: Array<{
    supplier_id: number;
    supplier_name: string;
    cotacoes_enviadas: number;
    cotacoes_respondidas: number;
    taxa_resposta: number;
    pedidos_no_prazo: number;
    pedidos_atrasados: number;
    pedidos_com_avaria: number;
    lead_time_medio: number;
    confiabilidade: 'confiavel' | 'atencao' | 'critico';
  }>;
};

export default function DashboardRankingFornecedores() {
  const [data, setData] = useState<RankingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/dashboard/ranking-fornecedores');
        setData(response.data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Erro ao carregar ranking de fornecedores'));
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
          <h1 className="o-page-title">Ranking de Fornecedores</h1>
          <p className="o-page-subtitle">Desempenho operacional por fornecedor</p>
        </div>
      </div>

      {loading && <div className="o-loading">Carregando...</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && data && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Cotações enviadas</th>
                <th>Cotações respondidas</th>
                <th>Taxa de resposta</th>
                <th>No prazo</th>
                <th>Atrasados</th>
                <th>Com avaria</th>
                <th>Lead time</th>
                <th>Confiabilidade</th>
              </tr>
            </thead>
            <tbody>
              {data.fornecedores.map((row) => (
                <tr key={row.supplier_id}>
                  <td>{row.supplier_name}</td>
                  <td>{row.cotacoes_enviadas}</td>
                  <td>{row.cotacoes_respondidas}</td>
                  <td>{row.taxa_resposta}%</td>
                  <td>{row.pedidos_no_prazo}</td>
                  <td>{row.pedidos_atrasados}</td>
                  <td>{row.pedidos_com_avaria}</td>
                  <td>{row.lead_time_medio}</td>
                  <td>{row.confiabilidade}</td>
                </tr>
              ))}
              {data.fornecedores.length === 0 && (
                <tr>
                  <td colSpan={9} className="o-empty">
                    Nenhum dado encontrado.
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
