# PRD-09 — Retenção da trilha de auditoria (RN-13)

## Requisito

O PRD-09 e o PRDGlobal definem retenção padrão de **1 ano** para eventos da trilha operacional (`audit_logs`), após o qual os registros **podem** ser arquivados (não são apagados durante a operação normal).

## Estado atual (V1)

- A tabela `audit_logs` permanece **append-only** na aplicação (sem endpoints de edição/remoção).
- **Não há job automático de arquivamento** no repositório; após 1 ano, a política deve ser aplicada por **rotina operacional** (export + partição/arquivo externo) ou por evolução futura do produto.

## Próximos passos recomendados

1. Definir destino de arquivo (S3, bucket interno, cold storage) e formato (JSON Lines / Parquet).
2. Agendar job mensal que:
   - seleciona `event_timestamp < now() - interval '1 year'`;
   - exporta em lote;
   - opcionalmente move para tabela `audit_logs_archive` ou remove (somente com aprovação formal de governança).
3. Manter índices em `event_timestamp` para janelas de exclusão eficientes (já criados na migração PRD-09).

## Referências

- [docs/prd/prd-09-backoffice-auditoria-e-operacao.md](../prd/prd-09-backoffice-auditoria-e-operacao.md) (RN-13, §4.1)
- Migração `20260503120000_prd09_audit_logs_operational.sql`
