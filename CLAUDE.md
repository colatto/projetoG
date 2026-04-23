# Contexto do Projeto

Documento-base para agentes e mantenedores. Atualizado para refletir o estado real do codebase em `2026-04-23`.

## Ordem de consulta

1. `PRDGlobal.md`
2. `CLAUDE.md`
3. `docs/architecture.md`
4. `docs/decisions/*.md`
5. `docs/prd/*.md`
6. `docs/runbooks/*.md`
7. `apps/*/CLAUDE.md`, `packages/*/CLAUDE.md`, `workers/CLAUDE.md`

## Objetivo do produto

Construir uma aplicação web para a GRF com:

- portal do fornecedor
- backoffice interno
- workflow de cotação
- follow-up logístico
- gestão de avarias
- dashboards
- integração com Sienge

## Estado atual do monorepo

O repositório não está mais em fase de scaffold. Hoje ele já contém:

- SPA React funcional para autenticação, recuperação de senha, gestão administrativa de usuários, monitoramento de eventos de integração, listagem e detalhe de cotações (backoffice e portal do fornecedor), gestão de templates e histórico de notificações (PRD-03), listagem e detalhe de pedidos (backoffice e portal do fornecedor, PRD-05), e follow-up logístico com listagem, detalhe, aprovação de datas e ações de fornecedor (PRD-04)
- API Fastify com JWT próprio, RBAC, CRUD administrativo de usuários, webhooks Sienge, endpoints de integração, fluxo completo de cotações (backoffice e fornecedor) com envio, resposta, revisão e retry de integração, módulo de entregas com validação e listagem pendente, módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05), módulo de notificações por e-mail com templates editáveis, logs e envio via Resend (PRD-03), e módulo de follow-up logístico com listagem, detalhe, confirmação de prazo, sugestão/aprovação/reprovação de nova data e histórico de notificações (PRD-04)
- workers com polling de cotações, pedidos e entregas (com recálculo automático de status de pedido via `OrderStatusEngine` e sinalização de follow-up), reconciliação por webhook, retry de eventos, escrita outbound de negociação, verificação automática de expiração de cotações, job de envio de e-mail de notificação (`notification:send-email`) com alerta de sem resposta (PRD-03), e follow-up scheduler diário com régua de notificações, detecção de atraso, encerramento automático e cálculo de dias úteis (PRD-04)
- schema Supabase com tabelas operacionais, RLS, triggers de `updated_at`, 15 migrações cobrindo PRD-07, PRD-02 (respostas de cotação versionadas), PRD-05 (delivery_records, order_status_history, campos calculados em purchase_orders), PRD-03 (notification_templates, notification_logs com enums notification_type e notification_status) e PRD-04 (extensão de follow_up_trackers, follow_up_date_changes, business_days_holidays, 4 novos tipos de notificação com templates seed)
- pacote de integração Sienge com clientes HTTP, paginação, rate limiting, retry, mapeadores e criptografia de credenciais
- pacote de domínio com `OrderStatusEngine` (regras de precedência de status PRD-05), `OrderOperationalStatus` enum, `NotificationType` / `NotificationStatus` enums (incluindo PRD-04: `FOLLOWUP_REMINDER`, `OVERDUE_ALERT`, `CONFIRMATION_RECEIVED`, `NEW_DATE_PENDING`), `TemplateRenderer` service e testes unitários
- infraestrutura de deploy com Dockerfiles, manifests Kubernetes e pipelines CI/CD (build, security, deploy)

## Módulos reais

| Módulo                        | Estado                    | Responsabilidade principal                                                                                    |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/web`                    | implementado parcialmente | SPA do portal/backoffice com auth, users, cotações, pedidos, notificações e follow-up                         |
| `apps/api`                    | implementado parcialmente | auth, RBAC, webhooks, integração, cotações, entregas, pedidos, notificações, follow-up e orquestração         |
| `workers`                     | implementado parcialmente | polling, reconciliação, retry, expire-check, recálculo de status, follow-up scheduler, envio de e-mail e jobs |
| `packages/domain`             | implementado parcialmente | entidades, enums centrais e serviços (TemplateRenderer, OrderStatusEngine)                                    |
| `packages/integration-sienge` | implementado parcialmente | cliente e adaptação do ERP                                                                                    |
| `packages/shared`             | implementado parcialmente | schemas, tipos e utilitários                                                                                  |
| `supabase`                    | implementado parcialmente | banco, auth, migrações e seed                                                                                 |

## Capacidades confirmadas no código

### `apps/web`

Rotas públicas:

- `/login`
- `/esqueci-senha`
- `/reset-password`

Rotas protegidas (layout administrativo):

- `/` (dashboard placeholder)
- `/admin/users` (Administrador)
- `/admin/users/new` (Administrador)
- `/admin/users/:id` (Administrador)
- `/admin/integration` (Administrador, Compras)
- `/admin/quotations` (Administrador, Compras)
- `/admin/quotations/:id` (Administrador, Compras)
- `/admin/notifications` (Administrador, Compras) — layout com sub-rotas
- `/admin/notifications/templates` (Administrador, Compras) — gestão de templates
- `/admin/notifications/logs` (Administrador, Compras) — histórico de notificações
- `/admin/orders` (Administrador, Compras, Visualizador de Pedidos) — listagem de pedidos
- `/admin/orders/:purchaseOrderId` (Administrador, Compras, Visualizador de Pedidos) — detalhe de pedido
- `/admin/followup` (Administrador, Compras, Visualizador de Pedidos) — listagem de follow-up logístico
- `/admin/followup/:purchaseOrderId` (Administrador, Compras, Visualizador de Pedidos) — detalhe com aprovação/reprovação de datas
- `/supplier/quotations` (Fornecedor)
- `/supplier/quotations/:id` (Fornecedor)
- `/supplier/orders` (Fornecedor) — listagem de pedidos do fornecedor
- `/supplier/orders/:purchaseOrderId` (Fornecedor) — detalhe de pedido do fornecedor
- `/supplier/followup` (Fornecedor) — listagem de follow-ups do fornecedor
- `/supplier/followup/:purchaseOrderId` (Fornecedor) — detalhe com ações de confirmação e sugestão de data

Componentes:

- `ProtectedRoute` com checagem por perfil
- `AuthContext` com persistência de token em `localStorage`
- `AdminLayout` com navegação lateral por perfil
- componentes UI: `Button`, `Input`, `IntegrationStatusBadge`

### `apps/api`

- `GET /health`
- `GET /docs` (Swagger UI)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/users...`
- `POST /api/users/:id/block`
- `POST /api/users/:id/reactivate`
- `POST /api/users/:id/reset-password`
- `POST /webhooks/sienge`
- `GET /api/integration/events`
- `POST /api/integration/events/:id/retry`
- `GET/PUT /api/integration/credentials`
- `POST /api/integration/negotiations/write`
- `GET /api/quotations` (backoffice — lista)
- `GET /api/quotations/:quotation_id` (backoffice — detalhe)
- `POST /api/quotations/:quotation_id/send` (enviar cotação)
- `POST /api/quotations/:quotation_id/suppliers/:supplier_id/review` (revisar resposta)
- `POST /api/quotations/:quotation_id/suppliers/:supplier_id/retry-integration` (retry)
- `GET /api/supplier/quotations` (portal fornecedor — lista)
- `GET /api/supplier/quotations/:quotation_id` (portal fornecedor — detalhe)
- `POST /api/supplier/quotations/:quotation_id/read` (marcar leitura)
- `POST /api/supplier/quotations/:quotation_id/respond` (responder cotação)

Aliases de compatibilidade (PRD-09):

- `/api/backoffice/quotations/*` → `/api/quotations/*`
- `/api/supplier-portal/quotations/*` → `/api/supplier/quotations/*`

Entregas e pedidos (PRD-05):

- `GET /api/deliveries/pending` (listar entregas pendentes de validação)
- `POST /api/deliveries/:id/validate` (validar entrega: OK / DIVERGENCIA)
- `GET /api/orders` (listar pedidos com status operacional)
- `GET /api/orders/:purchaseOrderId/deliveries` (entregas de um pedido)
- `POST /api/orders/:purchaseOrderId/cancel` (cancelamento/devolução total)
- `GET /api/orders/:purchaseOrderId/status-history` (histórico de status)
- `POST /api/orders/:purchaseOrderId/avaria` (recepção de status EM_AVARIA / REPOSICAO do módulo 6)

Notificações (PRD-03):

- `GET /api/notifications/logs` (listar logs com filtros e exportação CSV)
- `GET /api/notifications/templates` (listar templates ativos)
- `PUT /api/notifications/templates/:id` (atualizar template com validação de placeholders)

Follow-up logístico (PRD-04):

- `GET /api/followup/orders` (listar pedidos em follow-up com filtros e paginação)
- `GET /api/followup/orders/:purchaseOrderId` (detalhe com date_changes e notifications)
- `POST /api/followup/orders/:purchaseOrderId/confirm` (fornecedor confirma entrega no prazo)
- `POST /api/followup/orders/:purchaseOrderId/suggest-date` (fornecedor sugere nova data)
- `POST /api/followup/date-changes/:dateChangeId/approve` (Compras aprova nova data)
- `POST /api/followup/date-changes/:dateChangeId/reject` (Compras reprova nova data)
- `GET /api/followup/orders/:purchaseOrderId/notifications` (histórico de notificações do follow-up)

### `workers`

Jobs registrados:

- `sienge:sync-quotations`
- `sienge:sync-orders`
- `sienge:sync-deliveries`
- `sienge:reconcile`
- `sienge:process-webhook`
- `sienge:outbound-negotiation`
- `integration:retry`
- `follow-up`
- `quotation:expire-check`
- `notification:send-email`

Agendamentos observados:

- `*/15 * * * *`: sincronização de cotações, pedidos e entregas
- `0 * * * *`: retry de integração
- `0 11 * * *`: follow-up diário (08:00 BRT)
- `15 11 * * *`: expire-check de cotações (08:15 BRT)

Infraestrutura de suporte:

- `logger.ts`: logging estruturado
- `observability.ts`: métricas e monitoramento
- `operational-notifications.ts`: notificações operacionais para `Compras` e envio de alerta por e-mail de cotação sem resposta (PRD-03)
- `utils/business-days.ts`: cálculo de dias úteis (addBusinessDays, countBusinessDays) com suporte a feriados (PRD-04)
- `utils/order-status-recalc.ts`: recálculo de status de pedido com sinalização de follow-up (PRD-05)
- `test-utils/`: fixtures, mocks de pg-boss e supabase

## Regras obrigatórias

- regras críticas ficam no backend e/ou no domínio, nunca no frontend
- o Sienge é a fonte principal de verdade dos dados operacionais mestres
- nenhuma resposta de cotação volta ao Sienge sem aprovação manual de `Compras`
- integrações precisam de idempotência, retry, rastreabilidade e reprocessamento
- o sistema deve manter trilha de auditoria persistida
- webhooks são gatilhos de reconciliação, não substitutos de leitura detalhada via API

## Perfis oficiais

| Perfil                    | Pode                                                                                   | Não pode                                               |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `Fornecedor`              | acessar próprios dados, responder cotação, sugerir nova data, registrar avaria         | aprovar própria resposta ou acessar dados de terceiros |
| `Compras`                 | revisar integrações, aprovar/reprovar respostas, validar entregas, tratar divergências | gerir acessos e parametrizações administrativas        |
| `Administrador`           | criar/editar/bloquear/remover acessos e parametrizar integração                        | aprovar resposta de cotação                            |
| `Visualizador de Pedidos` | consultar pedidos e entregas                                                           | alterar dados ou acessar rotas administrativas         |

## Entidades e identificadores centrais

Entidades principais:

- `profiles`
- `suppliers`
- `supplier_contacts`
- `purchase_quotations`
- `purchase_quotation_items`
- `supplier_negotiations`
- `supplier_negotiation_items`
- `quotation_responses`
- `quotation_response_items`
- `quotation_response_item_deliveries`
- `purchase_orders` (inclui campos calculados PRD-05: `total_quantity_ordered`, `total_quantity_delivered`, `pending_quantity`, `has_divergence`, `last_delivery_date`)
- `purchase_order_items`
- `delivery_schedules`
- `deliveries` (inclui campos PRD-05: `delivery_item_number`, `attended_number`, `validated_by`, `validated_at`, `validation_notes`, `sienge_synced_at`, coluna `validation_status` renomeada de `status`)
- `order_status_history` (PRD-05: histórico append-only de transições de status de pedido com RLS)
- `purchase_invoices`
- `invoice_items`
- `order_quotation_links`
- `invoice_order_links`
- `follow_up_trackers` (PRD-04: extensão com supplier_id, order_date, promised_date_original, promised_date_current, notification tracking, supplier response, approval fields, building_id, paused_at, completed_reason)
- `follow_up_date_changes` (PRD-04: histórico de sugestões de nova data com decisão e auditoria)
- `business_days_holidays` (PRD-04: feriados para cálculo de dias úteis)
- `damages`
- `notifications`
- `notification_templates` (PRD-03: templates editáveis com placeholders obrigatórios, índice parcial único por tipo ativo)
- `notification_logs` (PRD-03: registro de cada e-mail enviado com snapshot de corpo, status e auditoria)
- `audit_logs`
- `integration_events`
- `webhook_events`
- `sienge_sync_cursor`
- `sienge_credentials`

Identificadores mínimos persistidos:

- `purchaseQuotationId`
- `supplierId`
- `negotiationId` ou `negotiationNumber`
- `purchaseOrderId`
- `purchaseOrderItemNumber`
- `purchaseQuotationItemId`
- `sequentialNumber`
- `invoiceItemNumber`
- `creditorId` quando homologado

## Variáveis de ambiente observadas

### Frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

### API

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SIENGE_BASE_URL`
- `SIENGE_API_KEY`
- `SIENGE_API_SECRET`
- `SIENGE_WEBHOOK_SECRET`
- `SIENGE_ENCRYPTION_KEY`
- `JWT_SECRET`
- `PORT`
- `NODE_ENV`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `DATABASE_URL` opcional para publicar jobs via `pg-boss`

### Workers

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SIENGE_BASE_URL`
- `SIENGE_API_KEY`
- `SIENGE_API_SECRET`
- `SIENGE_ENCRYPTION_KEY`
- `NODE_ENV`
- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `COMPRAS_EMAIL`

## Convenções observadas

- linguagem principal: TypeScript
- backend/workers com `strict: true`
- frontend com TypeScript menos restritivo que backend/workers
- ESLint 9 Flat Config por workspace
- Prettier unificado na raiz
- Husky + `lint-staged` no pre-commit
- `kebab-case` para arquivos, `PascalCase` para componentes/classes, `camelCase` para símbolos
- mensagens de usuário em português; identificadores e mensagens técnicas em inglês
- convenção de commit observada no histórico: `feat|fix|docs|test|refactor|chore`, mas sem validação automática de commit message

## Estado dos checks

Em `2026-04-23`:

- `pnpm -r run build`: OK (6 workspaces)
- `pnpm -r run test`: OK — `apps/api`: 88 testes (14 arquivos), `workers`: 33 testes (9 arquivos), `packages/domain`: 16 testes (2 arquivos)
- `pnpm -r run lint`: OK (todos os workspaces passam)

Observação residual de lint:

- `apps/web`: 1 warning (`react-hooks/incompatible-library` em UserCreate por `watch()` do react-hook-form — não acionável)

## Auditoria de dependências

`pnpm audit` retornou 3 vulnerabilidades moderadas:

- 2 em `vite` transitivo via `vitest` (`apps/api` e `workers`): path traversal em `.map` (≤6.4.1)
- 1 em `esbuild` transitivo via `vitest > vite` (`apps/api`): leitura arbitrária no dev server (≤0.24.2)

Mitigações já aplicadas via `pnpm.overrides` no `package.json` raiz:

- `@fastify/static`: `9.1.1`
- `fast-jwt`: `6.2.1`
- `follow-redirects`: `1.16.0`

Heterogeneidade de versões observada entre workspaces:

- `vitest`: `1.4.0` (workers), `2.1.0` (api), `4.1.4` (web, domain, integration-sienge, shared)
- `typescript`: `5.4.3` (workers), `5.6.0` (api), `6.0.2` (web)
- `@types/node`: `20.x` (workers), `22.x` (api), `24.x` (web), `25.x` (integration-sienge)
- `zod`: `3.23.8` (api, shared), `3.25.76` (web), `4.3.6` (integration-sienge)
- `@supabase/supabase-js`: `2.39.0` (workers), `2.45.0` (api)

## Infraestrutura de deploy

### CI/CD (GitHub Actions)

- `ci.yml`: format, lint, test, build em `push`/`pull_request` para `main`
- `deploy.yml`: build Docker + push GHCR + deploy K8s via `workflow_dispatch` ou `push` para `main`
- `security.yml`: `pnpm audit`, gitleaks e dependency review em PRs

### Containers

- `apps/api/Dockerfile`: imagem de produção da API
- `workers/Dockerfile`: imagem de produção dos workers

### Kubernetes

- `deploy/k8s/`: manifests com deployments, services, configmaps e secrets para API e workers
- Kustomization para aplicação declarativa

### Templates do repositório

- `.github/ISSUE_TEMPLATE/`: templates para bug report e feature request
- `.github/PULL_REQUEST_TEMPLATE.md`: checklist de PR

## Riscos atuais confirmados

- existem arquivos `.env` versionados em `apps/api`, `apps/web` e `workers`; tratar como incidente de governança e rotacionar segredos fora da documentação
- a estratégia formal de branching/code review não está documentada; o que existe hoje é um gate de CI em `pull_request` e `push` para `main`
- heterogeneidade de versões de dependências entre workspaces pode causar comportamentos inesperados

## Mudanças recentes já incorporadas ao codebase

### Histórico Git observado

- `2026-04-10` `ada641a`: início da implementação do PRD-07, com tipos Sienge e migração de integração
- `2026-04-16` `0fb49dd`: entrada dos módulos de integração/webhooks, entidades de domínio, workers e mapeadores
- `2026-04-16` `44669cd`: expansão forte de cobertura de testes, runbooks e melhorias em sync cursor/retries
- `2026-04-17` `ce3d828`: atualização de banco de dados (migração PRD-02)
- `2026-04-17` `855e118`: instalação do lint-staged, deploy workflows, K8s manifests, módulo de cotações (PRD-02), templates de PR/issue, plugin de métricas, portal do fornecedor
- `2026-04-21`: implementação completa do PRD-05 (Entrega, Divergência e Status de Pedido) — migração `20260421223710_prd05_delivery_records.sql`, módulos API `deliveries` e `orders`, `OrderStatusEngine` e `OrderOperationalStatus` no domínio, utilitário `order-status-recalc` nos workers, sinalização de follow-up, testes unitários e de integração Phase 6
- `2026-04-22`: implementação do PRD-03 (Notificações de Cotação) — migração `20260422145434_prd03_notification_templates_and_logs.sql`, enums `NotificationType`/`NotificationStatus` e `TemplateRenderer` no domínio, módulo API `notifications` (service, controller, routes, email-provider), plugin Fastify `email.ts` com Resend, worker job `notification:send-email`, integração no `QuotationsController.sendQuotation`, hook de envio tardio em `users.reactivate`, alerta de sem resposta via `sendNoResponseEmailAlert` no expire-check, schemas Zod no shared, telas frontend (NotificationTemplates, NotificationLogs, NotificationsLayout, AdminLayout atualizado), testes unitários e de integração
- `2026-04-23`: implementação do PRD-04 (Follow-up Logístico, Fases 1–4) — migração `20260423110000_prd04_followup_logistico.sql` (extensão de follow_up_trackers, follow_up_date_changes, business_days_holidays, 4 novos tipos de notificação com templates seed), NotificationType PRD-04 enums no domínio, schemas Zod de follow-up no shared, módulo API `followup` (controller, routes com 7 endpoints, RBAC, isolamento de fornecedor, auditoria, notificações), worker `follow-up.ts` completo (ensureTrackers, processTracker, régua de notificações, detecção de atraso, encerramento automático, integração com notification:send-email), utilitário `business-days.ts`, telas frontend (FollowUpList, FollowUpDetail no backoffice; SupplierFollowUpList, SupplierFollowUpDetail no portal do fornecedor), e telas de pedidos PRD-05 (OrderList, OrderDetail, SupplierOrderList, SupplierOrderDetail com navegação no AdminLayout)

### Working tree atual

Limpa — nenhuma alteração pendente.

> **Nota (2026-04-19):** saneamento de lint em `apps/web` concluído — helper `error-utils.ts`, eliminação de `any`, tipos concretos, `useMemo` para derivação de token e `useCallback` para deps de efeitos. Lint agora passa em todos os workspaces.

> **Nota (2026-04-21):** PRD-05 implementado (Fases 1–6). Inclui: migração de delivery_records e order_status_history, validação de entrega (OK/DIVERGENCIA), engine de cálculo de status com precedência (CANCELADO > EM_AVARIA > DIVERGENCIA > REPOSICAO > ENTREGUE > ATRASADO > PARCIALMENTE_ENTREGUE > PENDENTE), cancelamento de pedido com encerramento de régua de follow-up, recepção de status de avaria (stub para PRD-06), sinalização de follow-up após validação de entrega e recálculo de status no worker, testes de integração Phase 6.

> **Nota (2026-04-22):** PRD-03 implementado (Fases 1–5). Inclui: tabelas `notification_templates` e `notification_logs` com enums `notification_type`/`notification_status`, RLS service_role-only, seed de 3 templates default, enums e `TemplateRenderer` no domínio, `NotificationService` na API com envio de nova cotação, envio tardio e alerta de sem resposta, `ResendEmailProvider` com plugin Fastify, worker `notification:send-email` com retry, schemas Zod para validação de rotas, integração com `QuotationsController.sendQuotation`, hook de envio tardio em `UsersController.reactivate`, alerta de sem resposta via `sendNoResponseEmailAlert` no `quotation-expire-check`, telas de templates e logs no frontend, testes unitários e de integração.

> **Nota (2026-04-23):** PRD-04 implementado (Fases 1–4). Inclui: 2 migrações de banco (`20260423110000` + `20260423110001`) com extensão de `follow_up_trackers` (supplier_id, promised dates, notification tracking, supplier response, approval, paused_at, completed_reason), tabelas `follow_up_date_changes` e `business_days_holidays`, 4 novos tipos de notificação (`followup_reminder`, `overdue_alert`, `confirmation_received`, `new_date_pending`) com templates seed, enums PRD-04 no domínio, schemas Zod no shared, módulo API `followup` com 7 endpoints (listagem, detalhe, confirmação, sugestão/aprovação/reprovação de datas, histórico de notificações), RBAC e isolamento de fornecedor, auditoria completa, worker `follow-up` scheduler diário com régua de notificações sequenciais (1 por dia útil, Compras em cópia da 2ª em diante), detecção de atraso (D+1 útil), encerramento automático por entrega/cancelamento, utilitário de dias úteis com feriados, e telas frontend (backoffice: FollowUpList/FollowUpDetail com aprovação; fornecedor: SupplierFollowUpList/SupplierFollowUpDetail com confirmação e sugestão de data). Adicionalmente, as telas de pedidos PRD-05 foram implementadas no frontend (OrderList, OrderDetail, SupplierOrderList, SupplierOrderDetail).
>
> Testes existentes (14 testes): API 4 (followup.routes.test.ts), worker 3 (follow-up.test.ts), utils 5 (business-days.test.ts), frontend 2 (FollowUpList.test.tsx, SupplierFollowUpDetail.test.tsx). Cenários não cobertos: sugestão de data, aprovação/reprovação, reinício de régua, cópia Compras Notificação 2+, entrega parcial.
>
> Gaps conhecidos de lógica (não bloqueantes para V1.0):
>
> - **RN-13/14**: após confirmação do fornecedor (tracker `CONCLUIDO`), se a data prometida vencer sem entrega confirmada, o tracker não é reativado automaticamente para monitoramento de atraso;
> - **decideDateChange('approved')** calcula `nextNotificationDate` com dias corridos em vez de dias úteis (inconsistente com `ensureTrackers()` que usa `countBusinessDays`);
> - Listas frontend faltam campos do PRD: obra, saldo pendente, cotação vinculada (backoffice), data do pedido e indicação de avaria/reposição (portal do fornecedor).

> **Nota (2026-04-23):** PRD-05 frontend implementado. As telas de pedidos e entregas — anteriormente listadas como pendentes — agora estão presentes: `/admin/orders`, `/admin/orders/:purchaseOrderId`, `/supplier/orders`, `/supplier/orders/:purchaseOrderId` com navegação no AdminLayout.

## Diretriz para alterações futuras

Antes de alterar código ou documentação, validar impacto em:

- contratos com Sienge
- auditoria e rastreabilidade
- RBAC
- isolamento por fornecedor
- sync assíncrono e reprocessamento
- fronteira entre web, API, Supabase e workers

## Proibições absolutas

- não mover lógica crítica para o frontend
- não escrever no Sienge sem aprovação prévia de `Compras`
- não duplicar regras entre frontend, API, workers e domínio
- não criar integrações fora de `packages/integration-sienge`
- não remover trilha de auditoria de eventos críticos
- não assumir que a documentação antiga ainda representa o runtime sem verificar o código
