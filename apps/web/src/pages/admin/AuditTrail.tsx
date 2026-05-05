import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/error-utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type AuditRow = {
  id: string;
  event_type: string;
  event_timestamp: string;
  actor_id: string | null;
  actor_type: string;
  purchase_quotation_id: number | null;
  purchase_order_id: number | null;
  supplier_id: number | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
};

export default function AuditTrail() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const [eventType, setEventType] = useState('');
  const [purchaseQuotationId, setPurchaseQuotationId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [actorId, setActorId] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page, limit };
      if (eventType.trim()) params.event_type = eventType.trim();
      if (purchaseQuotationId.trim()) params.purchase_quotation_id = Number(purchaseQuotationId);
      if (purchaseOrderId.trim()) params.purchase_order_id = Number(purchaseOrderId);
      if (supplierId.trim()) params.supplier_id = Number(supplierId);
      if (actorId.trim()) params.actor_id = actorId.trim();
      if (dateStart) params.date_start = new Date(dateStart).toISOString();
      if (dateEnd) params.date_end = new Date(dateEnd).toISOString();

      const res = await api.get('/backoffice/audit', { params });
      setRows(res.data.data ?? []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Erro ao carregar auditoria'));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    eventType,
    purchaseQuotationId,
    purchaseOrderId,
    supplierId,
    actorId,
    dateStart,
    dateEnd,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#324598' }}>
        Trilha de auditoria
      </h1>
      <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>
        Eventos operacionais registrados no sistema (somente leitura).
      </p>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          marginBottom: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        }}
      >
        <Input
          label="Tipo de evento"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        />
        <Input
          label="Cotação (ID)"
          value={purchaseQuotationId}
          onChange={(e) => setPurchaseQuotationId(e.target.value)}
        />
        <Input
          label="Pedido (ID)"
          value={purchaseOrderId}
          onChange={(e) => setPurchaseOrderId(e.target.value)}
        />
        <Input
          label="Fornecedor (ID)"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        />
        <Input label="Ator (UUID)" value={actorId} onChange={(e) => setActorId(e.target.value)} />
        <Input
          label="Data inicial"
          type="datetime-local"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
        />
        <Input
          label="Data final"
          type="datetime-local"
          value={dateEnd}
          onChange={(e) => setDateEnd(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Button type="button" onClick={() => void load()}>
          Aplicar filtros
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setEventType('');
            setPurchaseQuotationId('');
            setPurchaseOrderId('');
            setSupplierId('');
            setActorId('');
            setDateStart('');
            setDateEnd('');
            setPage(1);
          }}
        >
          Limpar
        </Button>
      </div>

      {error && (
        <p style={{ color: '#dc2626', marginBottom: '1rem' }} role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Carregando…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#324598', color: '#fff' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Data/hora</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Tipo</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Ator</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cotação</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Pedido</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fornecedor</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Resumo</th>
                <th style={{ padding: '0.5rem' }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: expandedId === r.id ? '#ecfeff' : undefined,
                    }}
                  >
                    <td style={{ padding: '0.5rem' }}>
                      {new Date(r.event_timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.event_type}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {r.actor_type}
                      {r.actor_id ? ` · ${r.actor_id.slice(0, 8)}…` : ''}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{r.purchase_quotation_id ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.purchase_order_id ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.supplier_id ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{r.summary ?? '—'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                      >
                        {expandedId === r.id ? 'Ocultar' : 'Detalhes'}
                      </Button>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '0.75rem', background: '#f8fafc' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                          {JSON.stringify(r.metadata ?? {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ marginTop: '1rem', color: '#64748b' }}>Nenhum evento encontrado.</p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span style={{ fontSize: '0.875rem' }}>
          Página {page} de {totalPages} ({total} eventos)
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
