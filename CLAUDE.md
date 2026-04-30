# Contexto do Projeto

Documento-base para agentes e mantenedores. Atualizado para refletir o estado real do codebase em `2026-04-29`.

## Ordem de consulta

1. `PRDGlobal.md`
2. `CLAUDE.md`
3. `docs/architecture.md`
4. `docs/decisions/*.md`
5. `docs/prd/*.md`
6. `docs/runbooks/*.md` (incluindo `docs/runbooks/typecheck-and-supabase-types.md`)
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

- SPA React funcional para autenticação, recuperação de senha, gestão administrativa de usuários, monitoramento de eventos de integração, listagem e detalhe de cotações (backoffice e portal do fornecedor), gestão de templates e histórico de notificações (PRD-03), listagem e detalhe de pedidos (backoffice e portal do fornecedor, PRD-05), follow-up logístico com listagem, detalhe, aprovação de datas e ações de fornecedor (PRD-04), gestão de avarias com registro, sugestão de ação corretiva, decisão de Compras, reposição e badges de status (PRD-06), e dashboards analíticos com KPIs, ranking, lead time, atrasos, criticidade e avarias (PRD-08)
- API Fastify com JWT próprio, RBAC, CRUD administrativo de usuários, webhooks Sienge, endpoints de integração, fluxo completo de cotações (backoffice e fornecedor) com envio, resposta, revisão e retry de integração, módulo de entregas com validação e listagem pendente, módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05), módulo de notificações por e-mail com templates editáveis, logs e envio via Resend (PRD-03), módulo de follow-up logístico com listagem, detalhe, confirmação de prazo, sugestão/aprovação/reprovação de nova data e histórico de notificações (PRD-04), módulo de avarias com registro, sugestão, resolução, reposição, cancelamento de reposição, listagem, detalhe e auditoria completa com 11 eventos (PRD-06), e leitura de indicadores consolidados em `/api/dashboard/*` (PRD-08)
- workers com polling de cotações, pedidos e entregas (com recálculo automático de status de pedido via `OrderStatusEngine`, sinalização de follow-up e confirmação automática de reposição entregue PRD-06), reconciliação por webhook, retry de eventos, escrita outbound de negociação, verificação automática de expiração de cotações, job de envio de e-mail de notificação (`notification:send-email`) com alerta de sem resposta (PRD-03), follow-up scheduler diário com régua de notificações, detecção de atraso, encerramento automático e cálculo de dias úteis (PRD-04), e consolidação diária de snapshots do dashboard (`dashboard:consolidation`, PRD-08)
- schema Supabase com tabelas operacionais, RLS, triggers de `updated_at`, migrações cobrindo PRD-07, PRD-02 (respostas de cotação versionadas), PRD-05 (delivery_records, order_status_history, campos calculados em purchase_orders), PRD-03 (notification_templates, notification_logs com enums notification_type e notification_status), PRD-04 (extensão de follow_up_trackers, follow_up_date_changes, business_days_holidays, 4 novos tipos de notificação com templates seed), PRD-06 (extensão de damages, damage_replacements, damage_audit_logs com RLS e constraints) e PRD-08 (`dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra`, `dashboard_criticidade_item`)
- pacote de integração Sienge com clientes HTTP, paginação, rate limiting, retry, mapeadores e criptografia de credenciais
- pacote de domínio com `OrderStatusEngine` (regras de precedência de status PRD-05), `OrderOperationalStatus` enum, `NotificationType` / `NotificationStatus` enums (incluindo PRD-04: `FOLLOWUP_REMINDER`, `OVERDUE_ALERT`, `CONFIRMATION_RECEIVED`, `NEW_DATE_PENDING`), `TemplateRenderer` service, enums PRD-06 (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`) e testes unitários
- infraestrutura de deploy com Dockerfiles, manifests Kubernetes e pipelines CI/CD (build, security, deploy)

## Módulos reais

| Módulo                        | Estado                    | Responsabilidade principal                                                                                                             |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                    | implementado parcialmente | SPA do portal/backoffice com auth, users, cotações, pedidos, notificações, follow-up, avarias e dashboards (PRD-08)                    |
| `apps/api`                    | implementado parcialmente | auth, RBAC, webhooks, integração, cotações, entregas, pedidos, notificações, follow-up, avarias, dashboard e orquestração              |
| `workers`                     | implementado parcialmente | polling, reconciliação, retry, expire-check, recálculo de status, follow-up scheduler, envio de e-mail, dashboard consolidation e jobs |
| `packages/domain`             | implementado parcialmente | entidades, enums centrais e serviços (TemplateRenderer, OrderStatusEngine)                                                             |
| `packages/integration-sienge` | implementado parcialmente | cliente e adaptação do ERP                                                                                                             |
| `packages/shared`             | implementado parcialmente | schemas, tipos e utilitários                                                                                                           |
| `supabase`                    | implementado parcialmente | banco, auth, migrações e seed                                                                                                          |

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
- `/admin/damages` (Administrador, Compras) — gestão de avarias com filtros e badges
- `/admin/damages/new` (Administrador, Compras) — registro de avaria
- `/admin/damages/:damageId` (Administrador, Compras) — detalhe com decisão de ação corretiva e timeline de auditoria
- `/admin/dashboard` (Administrador, Compras) — hub de dashboards PRD-08
- `/admin/dashboard/lead-time` — lead time por fornecedor/obra e evolução diária
- `/admin/dashboard/atrasos` — atrasos por fornecedor/obra e evolução diária
- `/admin/dashboard/criticidade` — criticidade por item (snapshot)
- `/admin/dashboard/ranking-fornecedores` — ranking com período e confiabilidade
- `/admin/dashboard/avarias` — avarias por fornecedor/obra e evolução diária
- `/supplier/quotations` (Fornecedor)
- `/supplier/quotations/:id` (Fornecedor)
- `/supplier/orders` (Fornecedor) — listagem de pedidos do fornecedor
- `/supplier/orders/:purchaseOrderId` (Fornecedor) — detalhe de pedido do fornecedor
- `/supplier/followup` (Fornecedor) — listagem de follow-ups do fornecedor
- `/supplier/followup/:purchaseOrderId` (Fornecedor) — detalhe com ações de confirmação e sugestão de data
- `/supplier/damages` (Fornecedor) — listagem de avarias do fornecedor com badges
- `/supplier/damages/new` (Fornecedor) — registro de avaria com sugestão de ação corretiva
- `/supplier/damages/:damageId` (Fornecedor) — detalhe com sugestão de ação, data de reposição e timeline de auditoria

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
- `POST /api/orders/:purchaseOrderId/avaria` (recepção de status EM_AVARIA / REPOSICAO — stub PRD-05 complementado pelo módulo damages PRD-06)

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

Avarias e ação corretiva (PRD-06):

- `POST /api/damages` (registrar avaria — Fornecedor, Compras)
- `PATCH /api/damages/:damageId/suggest` (sugerir ação corretiva — Fornecedor)
- `PATCH /api/damages/:damageId/resolve` (definir ação corretiva final — Compras)
- `PATCH /api/damages/:damageId/replacement/date` (informar data de reposição — Fornecedor)
- `PATCH /api/damages/:damageId/replacement/cancel` (cancelar reposição — Compras)
- `GET /api/damages` (listar avarias com filtros e paginação)
- `GET /api/damages/:damageId` (detalhe da avaria com reposição e auditoria)
- `GET /api/damages/:damageId/audit` (histórico de auditoria — Compras, Administrador)

Dashboard e indicadores (PRD-08 — Compras, Administrador):

- `GET /api/dashboard/resumo` — resumos rápidos (snapshot + contagens ao vivo)
- `GET /api/dashboard/kpis` — KPIs com período e filtros fornecedor/obra
- `GET /api/dashboard/lead-time` — lead time agregado, por fornecedor/obra, evolução diária; filtros pedido/item
- `GET /api/dashboard/atrasos` — totais e séries por fornecedor/obra
- `GET /api/dashboard/criticidade` — itens por `snapshot_date` (opcional `data_referencia`)
- `GET /api/dashboard/ranking-fornecedores` — ranking no período (última linha por fornecedor)
- `GET /api/dashboard/avarias` — totais, por dimensão, ações corretivas e série diária

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
- `dashboard:consolidation`

Agendamentos observados:

- `*/15 * * * *`: sincronização de cotações, pedidos e entregas
- `0 * * * *`: retry de integração
- `0 11 * * *`: follow-up diário (08:00 BRT)
- `15 11 * * *`: expire-check de cotações (08:15 BRT)
- `45 10 * * *`: consolidação diária do dashboard (07:45 BRT)

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
- `damages` (PRD-06: extensão com reported_by_profile, suggested_action_notes, suggested_at, final_action, final_action_notes, final_action_decided_by, final_action_decided_at, affected_quantity, supplier_id, building_id; constraints de status, ação e quantidade; índices)
- `damage_replacements` (PRD-06: reposição de avaria com replacement_status, replacement_scope, new_promised_date; RLS por fornecedor; trigger updated_at)
- `damage_audit_logs` (PRD-06: trilha de auditoria específica de avaria com 11 tipos de evento; RLS por fornecedor)
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
- manutenção de tipos: seguir o fluxo obrigatório em `docs/runbooks/typecheck-and-supabase-types.md` para manter os contratos alinhados ao Supabase

## Estado dos checks

Em `2026-04-28`:

- `pnpm -r run build`: OK (6 workspaces)
- `pnpm -r run test`: OK — `apps/api`: 112+ testes (16 arquivos), `workers`: 34 testes (10 arquivos), `packages/domain`: 16 testes (2 arquivos), `apps/web`: testes de DamageList e SupplierDamageDetail incluídos
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
- `2026-04-28`: implementação do PRD-06 (Avaria e Ação Corretiva, Fases 1–6) — migração `20260428150000_prd06_damages_and_corrective_actions.sql` (extensão de `damages` com 10 novas colunas, tabelas `damage_replacements` e `damage_audit_logs` com RLS, constraints e índices), enums PRD-06 no domínio (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`), schemas Zod de avaria no shared, módulo API `damages` (controller com 595+ linhas, routes com 8 endpoints, RBAC, isolamento de fornecedor, auditoria completa com 11 eventos §10, cancelamento de reposição), integração worker `sync-deliveries.ts` para confirmação automática de reposição entregue, telas frontend (backoffice: DamageList com filtros status/fornecedor/pedido/obra e badges coloridos, DamageDetail com atalhos Aceitar/Recusar sugestão e timeline de auditoria; fornecedor: SupplierDamageList com badges, SupplierDamageDetail com sugestão, data de reposição e timeline de auditoria; compartilhado: DamageCreate para registro), helper `damages-helpers.ts` para mapeamento de badges, e 15 testes (API 12, worker 1, frontend 2)

### Working tree atual

Limpa — nenhuma alteração pendente.

> **Nota (2026-04-19):** saneamento de lint em `apps/web` concluído — helper `error-utils.ts`, eliminação de `any`, tipos concretos, `useMemo` para derivação de token e `useCallback` para deps de efeitos. Lint agora passa em todos os workspaces.

> **Nota (2026-04-21):** PRD-05 implementado (Fases 1–6). Inclui: migração de delivery_records e order_status_history, validação de entrega (OK/DIVERGENCIA), engine de cálculo de status com precedência (CANCELADO > EM_AVARIA > DIVERGENCIA > REPOSICAO > ENTREGUE > ATRASADO > PARCIALMENTE_ENTREGUE > PENDENTE), cancelamento de pedido com encerramento de régua de follow-up, recepção de status de avaria (stub para PRD-06), sinalização de follow-up após validação de entrega e recálculo de status no worker, testes de integração Phase 6.

> **Nota (2026-04-22):** PRD-03 implementado (Fases 1–5). Inclui: tabelas `notification_templates` e `notification_logs` com enums `notification_type`/`notification_status`, RLS service_role-only, seed de 3 templates default, enums e `TemplateRenderer` no domínio, `NotificationService` na API com envio de nova cotação, envio tardio e alerta de sem resposta, `ResendEmailProvider` com plugin Fastify, worker `notification:send-email` com retry, schemas Zod para validação de rotas, integração com `QuotationsController.sendQuotation`, hook de envio tardio em `UsersController.reactivate`, alerta de sem resposta via `sendNoResponseEmailAlert` no `quotation-expire-check`, telas de templates e logs no frontend, testes unitários e de integração.

> **Nota (2026-04-24 — auditoria completa PRD-04):** PRD-04 implementado (Fases 1–4). Todas as 25 regras de negócio (RN-01 a RN-25) estão implementadas e verificadas. Inclui: 2 migrações de banco (`20260423110000` + `20260423110001`) com extensão de `follow_up_trackers` (supplier_id, promised dates, notification tracking, supplier response, approval, paused_at, completed_reason), tabelas `follow_up_date_changes` e `business_days_holidays`, 4 novos tipos de notificação (`followup_reminder`, `overdue_alert`, `confirmation_received`, `new_date_pending`) com templates seed, enums PRD-04 no domínio, schemas Zod no shared, módulo API `followup` com 7 endpoints (listagem, detalhe, confirmação, sugestão/aprovação/reprovação de datas, histórico de notificações), RBAC e isolamento de fornecedor, auditoria completa de todos os 8 eventos do PRD, worker `follow-up` scheduler diário com régua de notificações sequenciais (1 por dia útil, Compras em cópia da 2ª em diante), detecção de atraso (D+1 útil), encerramento automático por entrega/cancelamento, utilitário de dias úteis com feriados, e telas frontend (backoffice: FollowUpList com filtros de status/fornecedor/obra e FollowUpDetail com timeline de notificações e aprovação de datas; fornecedor: SupplierFollowUpList com indicação de avaria/reposição e SupplierFollowUpDetail com histórico de notificações, confirmação e sugestão de data). Adicionalmente, as telas de pedidos PRD-05 foram implementadas no frontend (OrderList, OrderDetail, SupplierOrderList, SupplierOrderDetail).
>
> Testes existentes (27 total): API 11 (followup.routes.test.ts), worker 5 (follow-up.test.ts), utils business-days 5 (business-days.test.ts), utils order-status-recalc 1 (order-status-recalc.test.ts — encerramento de tracker por entrega), frontend 5 (FollowUpList.test.tsx ×2, FollowUpDetail.test.tsx ×1, SupplierFollowUpList.test.tsx ×1, SupplierFollowUpDetail.test.tsx ×1). Cenários sem cobertura de teste: cópia Compras Notificação 2+ (lógica existe, teste não valida), reinício end-to-end da régua após aprovação, integração de entrega parcial com PRD-05, concorrência scheduler/resposta, falha de e-mail, isolamento de supplier em `listNotifications`.
>
> **Correção (2026-04-24):** quatro gaps anteriormente documentados foram verificados como falsos na auditoria de código:
>
> - ~~RN-13/14: tracker CONCLUIDO não é reativado~~ → **Falso.** O worker `processTracker()` verifica overdue **antes** de checar status CONCLUIDO, marcando como ATRASADO corretamente. Teste `marks confirmed tracker as overdue` valida isso.
> - ~~decideDateChange('approved') usa dias corridos~~ → **Falso.** O controller usa `this.countBusinessDays()` e `this.addBusinessDays()` com suporte a feriados e fins de semana.
> - ~~Frontend não exibe histórico de notificações~~ → **Falso.** `FollowUpDetail.tsx` (L119-155) renderiza "Timeline de Notificações" e `SupplierFollowUpDetail.tsx` (L118-152) renderiza "Histórico de Notificações" com dados do endpoint de detalhe.
> - ~~Frontend backoffice sem filtros de fornecedor e obra~~ → **Falso.** `FollowUpList.tsx` (L83-110) possui inputs para `Fornecedor (ID)` e `Obra (ID)` que parametrizam a chamada à API com `supplier_id` e `building_id`.
>
> Gaps reais remanescentes (não bloqueantes para V1.0):
>
> - **Migração — coluna `suggested_date`**: a migração PRD-04 não declara `ADD COLUMN suggested_date` em `follow_up_trackers`, mas a coluna existe no schema inicial (V1 linha 205). O controller faz update com ela corretamente — a funcionalidade opera sem problemas, mas a coluna carece de ownership formal na migração PRD-04;
> - **Fase 5 (integração com Módulo 5)**: lógica de entrega parcial/encerramento existe (testada em `order-status-recalc.test.ts`), mas sem testes integrados end-to-end entre follow-up e fluxo de delivery;
> - **Teste — isolamento supplier em listNotifications**: não há teste verificando que `FORNECEDOR` recebe `403` ao consultar notificações de outro fornecedor.

> **Nota (2026-04-23):** PRD-05 frontend implementado. As telas de pedidos e entregas — anteriormente listadas como pendentes — agora estão presentes: `/admin/orders`, `/admin/orders/:purchaseOrderId`, `/supplier/orders`, `/supplier/orders/:purchaseOrderId` com navegação no AdminLayout.

> **Nota (2026-04-28):** PRD-06 implementado (Fases 1–6). Todas as 21 regras de negócio (RN-01 a RN-21) estão implementadas e verificadas. Inclui: migração `20260428150000` com extensão de `damages` (10 colunas novas + constraints + índices), tabelas `damage_replacements` e `damage_audit_logs` com RLS por fornecedor, 4 enums no domínio (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`), schemas Zod completos no shared (create, suggest, resolve, informDate, cancelReplacement, list, params), módulo API `damages` com 8 endpoints (POST criar, PATCH suggest, PATCH resolve, PATCH replacement/date, PATCH replacement/cancel, GET listar, GET detalhe, GET audit), RBAC (Fornecedor para sugestão e data; Compras para resolução e cancelamento; ambos para criação; Compras+Admin para audit), isolamento de fornecedor via `resolveSupplierId()`, auditoria completa com todos os 11 eventos do PRD §10 (`avaria_registrada`, `sugestao_enviada`, `sugestao_aceita`, `sugestao_recusada`, `acao_corretiva_definida`, `cancelamento_aplicado`, `reposicao_criada`, `data_reposicao_informada`, `reposicao_entregue`, `reposicao_cancelada`, `pedido_cancelado_total`), recálculo de status de pedido (`recomputeOrderStatusFromDamages`), cancelamento total com encerramento de régua de follow-up, reinício da régua ao informar data de reposição, integração worker `sync-deliveries.ts` para confirmação automática de reposição entregue, e telas frontend completas (backoffice: DamageList com filtros status/fornecedor/pedido/obra e badges coloridos roxo/azul/cinza/verde, DamageDetail com atalhos Aceitar/Recusar sugestão e timeline de auditoria; fornecedor: SupplierDamageList com badges, SupplierDamageDetail com sugestão, data de reposição e timeline de auditoria; compartilhado: DamageCreate com sugestão opcional para fornecedor). Testes: API 12 (damages.routes.test.ts), worker 1 (sync-deliveries.test.ts cenário de reposição entregue), frontend 2 (DamageList.test.tsx, SupplierDamageDetail.test.tsx).

## Diretriz para alterações futuras

Antes de alterar código ou documentação, validar impacto em:

- contratos com Sienge
- auditoria e rastreabilidade
- RBAC
- isolamento por fornecedor
- sync assíncrono e reprocessamento
- fronteira entre web, API, Supabase e workers
- validação de contratos TypeScript contra banco (ver `docs/runbooks/typecheck-and-supabase-types.md`)

## Proibições absolutas

- não mover lógica crítica para o frontend
- não escrever no Sienge sem aprovação prévia de `Compras`
- não duplicar regras entre frontend, API, workers e domínio
- não criar integrações fora de `packages/integration-sienge`
- não remover trilha de auditoria de eventos críticos
- não assumir que a documentação antiga ainda representa o runtime sem verificar o código
