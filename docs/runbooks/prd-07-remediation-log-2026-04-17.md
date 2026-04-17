# PRD-07 - Log de Remediação e Fechamento

## 1. Escopo

- **PRD / módulo**: `PRD-07 - Integração com o Sienge`
- **Janela da execução**: `2026-04-17 10:13:37 -03` até `2026-04-17 10:20:02 -03`
- **Responsável técnico**: Codex (implementação e validação local)
- **Ambiente validado**: monorepo local + ambiente real do Sienge via scripts de integração somente leitura

## 2. Resumo executivo

Todos os achados de implementação identificados na auditoria anterior foram tratados em ordem de prioridade. O lote original teve `7/7` achados de código remediados e fechados. Durante a validação live foi identificado um novo risco operacional no consumo do endpoint de cotações sem janela explícita de datas; esse achado adicional também foi corrigido e validado no mesmo ciclo.

Itens ainda dependentes de homologação externa permanecem rastreados em [sienge-homologation.md](/home/colatto/repo/x/projetoG/docs/runbooks/sienge-homologation.md), mas não bloqueiam mais o fechamento dos gaps de implementação tratados neste ciclo.

## 3. Status por achado

| ID   | Prioridade | Status                | Causa raiz                                                                                                                                                                                | Solução implementada                                                                                                        | Evidência de fechamento                                                                                                                                           |
| ---- | ---------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Crítica    | **Fechado**           | O endpoint outbound gravava `http_method: 'POST/PUT/PATCH'`, violando o `CHECK` do banco em `integration_events`.                                                                         | `writeNegotiation` passou a persistir `http_method: 'POST'` e o `endpoint` específico da negociação.                        | Teste `apps/api/src/modules/integration/integration.test.ts` validando inserção correta do evento; `@projetog/api` `40/40` testes aprovados.                      |
| F-02 | Alta       | **Fechado**           | O worker de outbound encerrava falhas definitivas sem notificar `Compras`.                                                                                                                | Inclusão de `notifyComprasAboutOperationalIssue(...)` no esgotamento de retries.                                            | Teste `workers/src/jobs/outbound-negotiation.test.ts`; `notifications.insert` e `audit_logs.insert` validados; `@projetog/workers` `26/26`.                       |
| F-03 | Alta       | **Fechado**           | Divergências de reconciliação eram apenas registradas em `integration_events`, sem alerta operacional.                                                                                    | Inclusão de notificação para `Compras` no fluxo de `sienge-reconcile`.                                                      | Teste `workers/src/jobs/sienge-reconcile.test.ts` validando envio de notificação.                                                                                 |
| F-04 | Alta       | **Fechado**           | O webhook persistia apenas `data`, contrariando o requisito de armazenar o payload integral recebido.                                                                                     | `webhook_events.payload` e `integration_events.request_payload` passaram a armazenar o `body` completo.                     | Teste `apps/api/src/modules/webhooks/webhooks.test.ts`; `@projetog/api` `40/40`.                                                                                  |
| F-05 | Média      | **Fechado**           | O worker outbound podia reexecutar evento já bem-sucedido, porque não havia guarda de idempotência no início do processamento.                                                            | Verificação do status atual do `integration_event` e short-circuit quando `status === success`.                             | Teste `workers/src/jobs/outbound-negotiation.test.ts` cobrindo reexecução duplicada.                                                                              |
| F-06 | Média      | **Fechado**           | O setup operacional não listava todas as variáveis exigidas por API, workers e criptografia.                                                                                              | Atualização de `apps/api/.env.example`, criação de `workers/.env.example` e ajuste do runbook `docs/runbooks/setup.md`.     | Arquivos revisados e build/testes mantidos íntegros.                                                                                                              |
| F-07 | Média      | **Fechado**           | Não existiam os componentes visuais mínimos previstos no PRD para monitorar status de integração e fornecedor inválido.                                                                   | Criação de `IntegrationStatusBadge`, página administrativa de eventos e navegação em `AdminLayout`.                         | `@projetog/web` build concluído com sucesso.                                                                                                                      |
| F-08 | Média      | **Fechado em código** | O cliente `DeliveryRequirementClient` existia sem cobertura explícita, o que deixava a implementação auxiliar sem evidência automatizada.                                                 | Inclusão de teste unitário dedicado para o endpoint `delivery-requirements`.                                                | Novo teste `packages/integration-sienge/src/__tests__/clients/delivery-requirement-client.spec.ts`; `@projetog/integration-sienge` `53/53`.                       |
| F-09 | Alta       | **Fechado**           | Durante a validação live, o endpoint `/purchase-quotations/all/negotiations` respondeu `400` quando chamado sem janela explícita de datas; o worker fazia isso na primeira sincronização. | `sync-quotations`, `outbound-negotiation` e `health-check.integration.ts` passaram a usar `startDate`/`endDate` explícitos. | Health check live passou a retornar `495` cotações; novos testes em `workers/src/jobs/sync-quotations.test.ts` e `workers/src/jobs/outbound-negotiation.test.ts`. |

## 4. Análise detalhada e fechamento

### F-01 - Persistência inválida do verbo HTTP outbound

- **Causa raiz**: o controlador consolidava múltiplos verbos em um único campo persistido, incompatível com a constraint da tabela.
- **Implementação**:
  - Ajuste em `apps/api/src/modules/integration/integration.controller.ts`
  - Persistência do `endpoint` real `/purchase-quotations/{id}/suppliers/{supplierId}/negotiations`
  - Persistência do `http_method` como `POST`
- **Validação**:
  - Teste automatizado específico para a criação do `integration_event`
  - Suite `@projetog/api`: `40/40`
- **Confirmação de fechamento**: não há mais violação estrutural ao inserir o evento outbound.

### F-02 - Ausência de notificação em falha definitiva outbound

- **Causa raiz**: o fluxo de retry encerrava em `failure` sem roteamento da ocorrência para usuários operacionais.
- **Implementação**:
  - Novo módulo `workers/src/operational-notifications.ts`
  - Notificação para usuários ativos com papel `Compras`
  - Auditoria de disparo em `audit_logs`
- **Validação**:
  - Teste do job validando inserção em `notifications`
  - Suite `@projetog/workers`: `26/26`
- **Confirmação de fechamento**: falhas definitivas agora geram trilha operacional auditável.

### F-03 - Ausência de notificação em divergência de reconciliação

- **Causa raiz**: divergências eram observáveis apenas por leitura técnica do banco.
- **Implementação**:
  - Encapsulamento do alerta operacional no fluxo `registerReconciliationDivergence`
  - Notificação com tipo `RECONCILIATION_DIVERGENCE`
- **Validação**:
  - Teste de reconciliação ajustado para exigir `notifications.insert`
- **Confirmação de fechamento**: a divergência passou a ser sinalizada para a operação.

### F-04 - Persistência incompleta do webhook

- **Causa raiz**: apenas `body.data` era salvo, perdendo contexto do `type` e demais campos do envelope.
- **Implementação**:
  - Persistência do `body` completo em `webhook_events.payload`
  - `integration_events.request_payload` alinhado ao payload integral
- **Validação**:
  - Teste do webhook atualizado
  - Reprocessamento manual de eventos ajustado para extrair corretamente `payload.data` quando necessário
- **Confirmação de fechamento**: o registro inbound preserva o contrato completo recebido do Sienge.

### F-05 - Idempotência outbound parcial

- **Causa raiz**: a unicidade existia na origem, mas o worker não protegia a reexecução de evento já concluído.
- **Implementação**:
  - Leitura inicial do `integration_event`
  - Encerramento antecipado para `status = success`
- **Validação**:
  - Teste específico para duplicidade
- **Confirmação de fechamento**: reprocessamento redundante não dispara novas mutações no Sienge.

### F-06 - Inconsistência entre runtime e documentação operacional

- **Causa raiz**: variáveis críticas não estavam refletidas nos arquivos de exemplo nem no runbook de setup.
- **Implementação**:
  - Inclusão de `SIENGE_API_SECRET`, `SIENGE_WEBHOOK_SECRET`, `SIENGE_ENCRYPTION_KEY`
  - Criação de `workers/.env.example`
  - Revisão de `docs/runbooks/setup.md`
- **Validação**:
  - Conferência estática dos artefatos e manutenção do build/testes
- **Confirmação de fechamento**: setup local e operacional agora representa o runtime real exigido.

### F-07 - Ausência de UI operacional mínima

- **Causa raiz**: o PRD previa componentes visuais reutilizáveis, mas o backoffice não expunha nenhum monitor para o módulo.
- **Implementação**:
  - Novo badge `apps/web/src/components/ui/IntegrationStatusBadge.tsx`
  - Nova tela `apps/web/src/pages/admin/IntegrationEvents.tsx`
  - Inclusão da rota em `apps/web/src/App.tsx`
  - Inclusão do item de navegação em `apps/web/src/pages/admin/AdminLayout.tsx`
- **Validação**:
  - `@projetog/web build` concluído com sucesso
- **Confirmação de fechamento**: a operação passou a ter uma superfície mínima de monitoramento e status.

### F-08 - Cobertura insuficiente do cliente `delivery-requirements`

- **Causa raiz**: o endpoint auxiliar estava implementado, mas sem prova automatizada do contrato local.
- **Implementação**:
  - Novo teste unitário dedicado em `packages/integration-sienge/src/__tests__/clients/delivery-requirement-client.spec.ts`
- **Validação**:
  - `@projetog/integration-sienge` `53/53`
- **Confirmação de fechamento**: a implementação local está coberta; a homologação real do comportamento de `openQuantity` continua rastreada no item `17.9`.

### F-09 - Janela de datas obrigatória para leitura de cotações

- **Causa raiz**: o contrato real do endpoint de cotações exige contexto temporal explícito; a primeira sincronização local consultava sem `startDate`/`endDate`.
- **Implementação**:
  - `workers/src/jobs/sync-quotations.ts`: uso de janela padrão de 6 meses ou reprocessamento incremental com `last_synced_at`
  - `workers/src/jobs/outbound-negotiation.ts`: lookup do mapa de cotação com janela baseada em `quotation_date`
  - `packages/integration-sienge/src/__tests__/health-check.integration.ts`: health check alinhado ao contrato real
- **Validação**:
  - Testes unitários cobrindo a nova janela explícita
  - Health check live: endpoint acessível com `495` registros no recorte validado
- **Confirmação de fechamento**: a primeira sincronização de cotações não depende mais de comportamento implícito do ERP.

## 5. Validação executada

### Automação local

- `2026-04-17 10:15 BRT` - `pnpm --filter @projetog/api test` -> `40/40`
- `2026-04-17 10:15 BRT` - `pnpm --filter @projetog/web build` -> sucesso
- `2026-04-17 10:18 BRT` - `pnpm --filter @projetog/integration-sienge test` -> `53/53`
- `2026-04-17 10:19 BRT` - `pnpm --filter @projetog/workers test` -> `26/26`

### Validação em ambiente real do Sienge

- `2026-04-17 10:20 BRT` - `health-check.integration.ts`
  - `GET /creditors?limit=1` acessível
  - `GET /purchase-quotations/all/negotiations?startDate=2025-10-17&endDate=2026-04-17&limit=1` acessível
  - Total observado no recorte: `495` cotações
- `2026-04-17 10:20 BRT` - `supplier-mapping.integration.ts`
  - `40/40` `supplierId` resolveram em `GET /creditors/{supplierId}`
  - `40/40` com correspondência nominal exata
  - `35/40` com e-mail em `contacts[]`
  - `5/40` sem e-mail, permanecendo bloqueáveis pela RN-05

## 6. Log cronológico de atividades

| Timestamp (BRT)       | Responsável | Atividade                                                                                             | Evidência                                                                                                                                 |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-04-17 10:13:37` | Codex       | Consolidação do estado do workspace e confirmação dos achados abertos                                 | `git status --short` e inspeção do código alterado                                                                                        |
| `2026-04-17 10:14:56` | Codex       | Verificação da disponibilidade local de credenciais/envs para validação real                          | `apps/api/.env` e `workers/.env` presentes                                                                                                |
| `2026-04-17 10:15:13` | Codex       | Validação inicial local de API, workers, web e pacote de integração                                   | suites aprovadas e build do frontend concluído                                                                                            |
| `2026-04-17 10:15:50` | Codex       | Execução do primeiro health check live                                                                | credores acessíveis; endpoint de cotações expôs necessidade de janela de datas                                                            |
| `2026-04-17 10:18:26` | Codex       | Implementação da correção de janela explícita para cotações e adição de cobertura do cliente auxiliar | alterações em `sync-quotations`, `outbound-negotiation`, `health-check.integration.ts` e novo teste `delivery-requirement-client.spec.ts` |
| `2026-04-17 10:19:04` | Codex       | Revalidação do worker após o ajuste do contrato de cotações                                           | `@projetog/workers` `26/26`                                                                                                               |
| `2026-04-17 10:20:02` | Codex       | Fechamento documental e atualização do runbook de homologação                                         | este documento + atualização de `sienge-homologation.md`                                                                                  |

## 7. Fechamento

- **Achados de implementação originalmente auditados**: `Fechados`
- **Achado adicional descoberto durante a validação**: `Fechado`
- **Pendências remanescentes**: apenas homologações externas ainda listadas em `docs/runbooks/sienge-homologation.md`
- **Conclusão**: o lote de remediação do PRD-07 foi concluído com sucesso no código, validado localmente e parcialmente confirmado em ambiente real do Sienge.
