import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { DashboardFilters } from './DashboardFilters';
import '../orders.css';
import './dashboard-prd.css';

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

function confiabilidadeClass(c: 'confiavel' | 'atencao' | 'critico') {
  if (c === 'confiavel') return 'badge-confiavel';
  if (c === 'atencao') return 'badge-atencao';
  return 'badge-critico';
}

export default function DashboardRankingFornecedores() {
  const [dataInicio, setDataInicio] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [supplierId, setSupplierId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [itemIdentifier, setItemIdentifier] = useState('');
  const [data, setData] = useState<RankingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/ranking-fornecedores', {
        params: {
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          supplier_id: supplierId ? Number(supplierId) : undefined,
          building_id: buildingId ? Number(buildingId) : undefined,
          purchase_order_id: purchaseOrderId ? Number(purchaseOrderId) : undefined,
          item_identifier: itemIdentifier || undefined,
        },
      });
      setData(response.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar ranking de fornecedores'));
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, supplierId, buildingId, purchaseOrderId, itemIdentifier]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="o-page-header">
        <div>
          <h1 className="o-page-title">Ranking de Fornecedores</h1>
          <p className="o-page-subtitle">Desempenho operacional por fornecedor</p>
        </div>
      </div>

      <div className="dashboard-period o-filters">
        <div className="form-group">
          <label className="form-label">Data início</label>
          <input
            className="form-input"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Data fim</label>
          <input
            className="form-input"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      <DashboardFilters
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        buildingId={buildingId}
        setBuildingId={setBuildingId}
        purchaseOrderId={purchaseOrderId}
        setPurchaseOrderId={setPurchaseOrderId}
        itemIdentifier={itemIdentifier}
        setItemIdentifier={setItemIdentifier}
      />

      {loading && <div className="o-loading">Carregando...</div>}
      {error && <div className="q-notice q-notice--error">{error}</div>}

      {!loading && !error && data && (
        <div className="table-wrapper">
          <table className="dashboard-table">
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
                  <td>
                    <span className={confiabilidadeClass(row.confiabilidade)}>{row.confiabilidade}</span>
                  </td>
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
