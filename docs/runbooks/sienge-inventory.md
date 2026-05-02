# Inventário de Implementações - Integração Sienge

Este documento atesta a entrega das especificações do PRD-07 e fornece os insumos completos para que a equipe técnica proceda com as validações automatizadas de código, ao mesmo tempo que instrui os gerentes de projeto a alinharem a agenda de testes integrados com os usuários-chave do Sienge.

## 1. Funcionalidades Implementadas

Todos os itens previstos como "Inclusos neste PRD" (§2.1 e §4 a §7) foram integralmente desenvolvidos, compreendendo:

- **Estruturas de banco de dados fundamentais**: Criação e aplicação das tabelas `sienge_credentials`, `integration_events`, `webhook_events` e `sienge_sync_cursor`.
- **Segurança e Rate Limit**: Mecanismo de autenticação _Basic_ para webhooks e controle estrito de limite de taxa para chamadas (Rate Limit).
- **Leitura (Inbound)**: Clientes HTTP isolados e resilientes para leitura de Cotações, Credores, Pedidos, Notas Fiscais e Requisitos de Entrega.
- **Escrita (Outbound)**: Clientes HTTP para escrita controlada de Respostas de Cotação, contemplando o sequenciamento correto de Criação, Atualização, Adição de Itens e Autorização.
- **Webhooks**: Controlador receptor de webhooks idempotente (utilizando a chave `x-sienge-id`) e otimizado para latência ultrabaixa (tempo de resposta garantido inferior a `2,5s`).
- **Workers Assíncronos**: Implementação dos jobs via `pg-boss` para reconciliação de dados via leitura periódica da API REST e reprocessamento automático de falhas (Retries), respeitando estritamente os intervalos de negócio (24h).
- **Auditoria e Traceability**: Sistema de log unificado (`integration_events`) para auditoria estruturada de todas as requisições, sejam elas _inbound_ ou _outbound_.

## 2. Itens Dependentes de Validação Externa

As funcionalidades abaixo ainda exigem evidência em ambiente real do cliente ou ação conjunta com Sienge (detalhes e comandos em `docs/runbooks/sienge-homologation.md`, atualizado **2026-05-02**):

| Área                                          | Estado (2026-05-02)                                 | Instrumentação no repo                                           |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| Mapeamento fornecedor/credor + e-mail RN-05   | §17.1 validado; §17.2 parcial (confirmação Compras) | `supplier-mapping.integration.ts`                                |
| Disparo de webhooks críticos                  | Pendente disparo pontual cliente/Sienge             | `webhook-history.integration.ts` (histórico Supabase)            |
| Mapa de cotação / RN-10                       | Leitura API disponível; cenário completo com UI     | `quotation-map-supplier.integration.ts`                          |
| Escrita negociação (sequência POST/PUT/PATCH) | Pendente — mutação real                             | Nenhum script readonly                                           |
| Múltiplas cotações por pedido                 | Amostragem automatizada                             | `multi-quotation-orders.integration.ts`                          |
| Cobertura `deliveries-attended` × DB local    | Relatório cobertos/órfãos                           | `deliveries-attended-coverage.integration.ts`                    |
| Tipagem `openQuantity`                        | Amostras parametrizáveis                            | `delivery-requirements-types.integration.ts`                     |
| Webhooks ACK-only (contrato/medição/clearing) | Pipeline tipado em worker + API                     | `handleAckOnlyEvent` — ver `workers/src/jobs/process-webhook.ts` |

---

**Status**: Código entregue; homologação §17 com **scripts readonly** versionados, **runner consolidado** (`homologation-checklist.integration.ts`) e checklist vivo no runbook. Itens que dependem de mutação ou de disparo pelo Sienge permanecem **pendentes de sessão com cliente**.
