# Contexto do Projeto

Documento-base para agentes e mantenedores. Atualizado para refletir o estado real do codebase em `2026-05-03`.

## Ordem de consulta

1. `PRDGlobal.md`
2. `CLAUDE.md`
3. `docs/architecture.md`
4. `docs/decisions/*.md`
5. `docs/prd/*.md`
6. `docs/runbooks/*.md` (incluindo `docs/runbooks/typecheck-and-supabase-types.md`, `docs/runbooks/prd09-audit-retention.md`)
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

- SPA React funcional para autenticação, recuperação de senha, gestão administrativa de usuários, monitoramento de eventos de integração, trilha de auditoria operacional em `/admin/audit` (PRD-09), listagem e detalhe de cotações (backoffice e portal do fornecedor) com filtro "Exigem ação" no backoffice quando aplicável (PRD-09), gestão de templates e histórico de notificações (PRD-03), listagem e detalhe de pedidos (backoffice e portal do fornecedor, PRD-05), follow-up logístico com listagem, detalhe, aprovação de datas e ações de fornecedor (PRD-04), gestão de avarias com registro, sugestão de ação corretiva, decisão de Compras, reposição e badges de status (PRD-06), e dashboards analíticos com KPIs, ranking, lead time, atrasos, criticidade e avarias (PRD-08)
- API Fastify com JWT próprio, RBAC, CRUD administrativo de usuários, webhooks Sienge, endpoints de integração e aliases PRD-09 (`/api/backoffice/integrations`), fluxo completo de cotações (backoffice e fornecedor) com envio, resposta, revisão e retry de integração, leitura paginada da trilha em `/api/backoffice/audit` (PRD-09), módulo de entregas com validação e listagem pendente, módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05) e alias `/api/supplier-portal/orders`, módulo de notificações por e-mail com templates editáveis, logs e envio via Resend (PRD-03), módulo de follow-up logístico com listagem, detalhe, confirmação de prazo, sugestão/aprovação/reprovação de nova data e histórico de notificações (PRD-04), módulo de avarias com registro, sugestão, resolução, reposição, cancelamento de reposição, listagem, detalhe e auditoria completa com 11 eventos (PRD-06), e leitura de indicadores consolidados em `/api/dashboard/*` (PRD-08)
- workers com polling de cotações, pedidos e entregas (com recálculo automático de status de pedido via `OrderStatusEngine`, sinalização de follow-up e confirmação automática de reposição entregue PRD-06), reconciliação por webhook, retry de eventos, escrita outbound de negociação, verificação automática de expiração de cotações, job de envio de e-mail de notificação (`notification:send-email`) com alerta de sem resposta (PRD-03), follow-up scheduler diário com régua de notificações, detecção de atraso, encerramento automático e cálculo de dias úteis (PRD-04), e consolidação diária de snapshots do dashboard (`dashboard:consolidation`, PRD-08)
- schema Supabase com tabelas operacionais, RLS, triggers de `updated_at`, migrações cobrindo PRD-07, PRD-02 (respostas de cotação versionadas), PRD-05 (delivery_records, order_status_history, campos calculados em purchase_orders), PRD-03 (notification_templates, notification_logs com enums notification_type e notification_status), PRD-04 (extensão de follow_up_trackers, follow_up_date_changes, business_days_holidays, 4 novos tipos de notificação com templates seed), PRD-06 (extensão de damages, damage_replacements, damage_audit_logs com RLS e constraints), PRD-08 (`dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra`, `dashboard_criticidade_item`) e PRD-09 (colunas operacionais em `audit_logs`: summary, actor_type, event_timestamp, purchase_quotation_id, purchase_order_id, supplier_id + índices)
- `AuditService` centralizado com `registerEvent()`: summary obrigatório (fallback automático via `fallbackSummary()`), campos operacionais PRD-09, e enfileiramento via pg-boss (`audit:retry`) em caso de falha de escrita (§9.6)
- pacote de integração Sienge com clientes HTTP, paginação, rate limiting, retry, mapeadores e criptografia de credenciais
- pacote de domínio com `OrderStatusEngine` (regras de precedência de status PRD-05), `OrderOperationalStatus` enum, `NotificationType` / `NotificationStatus` enums (incluindo PRD-04: `FOLLOWUP_REMINDER`, `OVERDUE_ALERT`, `CONFIRMATION_RECEIVED`, `NEW_DATE_PENDING`), `TemplateRenderer` service, enums PRD-06 (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`) e testes unitários
- infraestrutura de deploy com Dockerfiles, manifests Kubernetes e pipelines CI/CD (build, security, deploy)

## Módulos reais

| Módulo                        | Estado                    | Responsabilidade principal                                                                                                                          |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`                    | implementado parcialmente | SPA do portal/backoffice com auth, users, integração, auditoria (PRD-09), cotações, pedidos, notificações, follow-up, avarias e dashboards (PRD-08) |
| `apps/api`                    | implementado parcialmente | auth, RBAC, webhooks, integração, auditoria PRD-09, cotações, entregas, pedidos, notificações, follow-up, avarias, dashboard e orquestração         |
| `workers`                     | implementado parcialmente | polling, reconciliação, retry, expire-check, recálculo de status, follow-up scheduler, envio de e-mail, dashboard consolidation e jobs              |
| `packages/domain`             | implementado parcialmente | entidades, enums centrais e serviços (TemplateRenderer, OrderStatusEngine)                                                                          |
| `packages/integration-sienge` | implementado parcialmente | cliente e adaptação do ERP                                                                                                                          |
| `packages/shared`             | implementado parcialmente | schemas, tipos e utilitários                                                                                                                        |
| `supabase`                    | implementado parcialmente | banco, auth, migrações e seed                                                                                                                       |

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
- `/admin/audit` (Administrador, Compras) — trilha de auditoria operacional (PRD-09)
- `/admin/quotations` (Administrador, Compras)
- `/admin/quotations/:id` (Administrador, Compras)
- `/admin/notifications` (Administrador, Compras) — layout com sub-rotas
- `/admin/notifications/templates` (Administrador, Compras) — gestão de templates
- `/admin/notifications/logs` (Administrador, Compras) — histórico de notificações
- `/admin/orders` (Administrador, Compras, Visualizador de Pedidos) — listagem de pedidos
- `/admin/orders/:purchaseOrderId` (Administrador, Compras, Visualizador de Pedidos) — detalhe de pedido
- `/admin/followup` (Administrador, Compras) — listagem de follow-up logístico
- `/admin/followup/:purchaseOrderId` (Administrador, Compras) — detalhe com aprovação/reprovação de datas (ações de decisão apenas Compras na UI)
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
- `GET /api/backoffice/integrations` (alias PRD-09 — mesma listagem que `integration/events`)
- `POST /api/backoffice/integrations/:id/retry` (alias PRD-09)
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
- `/api/supplier-portal/orders/*` → `/api/orders/*` (Fornecedor com RBAC)

Entregas e pedidos (PRD-05):

- `GET /api/deliveries/pending` (listar entregas pendentes de validação)
- `POST /api/deliveries/:id/validate` (validar entrega: OK / DIVERGENCIA)
- `GET /api/orders` (listar pedidos com status operacional; query `require_action`, `sort_priority`)
- `GET /api/orders/:purchaseOrderId/deliveries` (entregas de um pedido)
- `POST /api/orders/:purchaseOrderId/cancel` (cancelamento/devolução total)
- `GET /api/orders/:purchaseOrderId/status-history` (histórico de status)
- `POST /api/orders/:purchaseOrderId/avaria` (recepção de status EM_AVARIA / REPOSICAO — stub PRD-05 complementado pelo módulo damages PRD-06)

Alias backoffice de pedidos (PRD-09; espelha `/api/orders`):

- `GET /api/backoffice/orders` (listar pedidos com status operacional; query `require_action`, `sort_priority`)
- `GET /api/backoffice/orders/:purchaseOrderId/deliveries` (entregas de um pedido)
- `POST /api/backoffice/orders/:purchaseOrderId/cancel` (cancelamento/devolução total)
- `GET /api/backoffice/orders/:purchaseOrderId/status-history` (histórico de status)
- `POST /api/backoffice/orders/:purchaseOrderId/avaria` (recepção de status EM_AVARIA / REPOSICAO — stub PRD-05 complementado pelo módulo damages PRD-06)

Auditoria operacional transversal (PRD-09 — Compras, Administrador):

- `GET /api/backoffice/audit` (listagem paginada com filtros)
- `GET /api/backoffice/audit/:audit_event_id` (detalhe; somente leitura)

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
- `GET /api/dashboard/lead-time` — lead time agregado, por fornecedor/obra, evolução diária; filtros fornecedor/obra/pedido/item
- `GET /api/dashboard/atrasos` — totais e séries por fornecedor/obra; mesmos filtros + totais alinhados ao escopo quando há PO/item
- `GET /api/dashboard/criticidade` — itens por `snapshot_date` (opcional `data_referencia`); filtros obra/fornecedor/pedido/item
- `GET /api/dashboard/ranking-fornecedores` — ranking no período (última linha por fornecedor); filtros fornecedor/obra/pedido/item
- `GET /api/dashboard/avarias` — totais, por dimensão, ações corretivas e série diária; filtros dimensionais + contagens de `damages` filtradas

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
- `audit:retry` (deferred retry de eventos de auditoria via pg-boss — PRD-09 §9.6)

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

Em `2026-05-02` (última verificação local, pós-alinhamento Vitest e E2E):

- `pnpm -r run typecheck`: OK (workspaces com script)
- `pnpm -r run build`: OK (6 workspaces)
- `pnpm -r run test`: OK — `apps/api`: 168 testes, `workers`: 58 testes, `packages/domain`: 16 testes, `packages/integration-sienge`: 53 testes, `apps/web`: 53 testes (Vitest — inclui 6 cenários AuditTrail + 3 cenários OrderList §14.1)
- `pnpm --filter @projetog/web run test:e2e`: OK — 3 cenários Playwright (`login.spec.ts` + fluxos cross-módulo em `e2e/`)
- `pnpm -r run lint`: OK (todos os workspaces passam; `apps/web` mantém 1 warning conhecido em `UserCreate`)

Observação residual de lint:

- `apps/web`: 1 warning (`react-hooks/incompatible-library` em UserCreate por `watch()` do react-hook-form — não acionável)

## Auditoria de dependências

Executar `pnpm audit` na raiz (ou confiar no job [`.github/workflows/security.yml`](.github/workflows/security.yml), step `pnpm audit --audit-level=moderate`). O resultado depende do advisory feed do npm registry; em ambientes sem rede estável o comando pode falhar antes de retornar CVEs — repetir localmente ou inspecionar o log do workflow.

**Overrides em [`package.json`](package.json) raiz (`pnpm.overrides`):** `@fastify/static`, `fast-jwt`, `follow-redirects`. Esses pins **não** tratam `vite`/`esbuild`; vulnerabilidades eventualmente reportadas nessa cadeia costumam afetar **dependências de desenvolvimento/teste** (por exemplo `vitest` → `vite`). Mitigação: manter Vitest/Vite atualizados e rever o relatório do audit periodicamente.

## Matriz de versões (toolchain)

Política atual do monorepo:

| Pacote                  | Escopo                                                                                                                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`                | `^4.1.4` em `apps/api`, `apps/web`, `workers`, `packages/domain`, `packages/shared`, `packages/integration-sienge`                                                                                                                                                   |
| `typescript`            | `^5.6.0` em `apps/api`, `workers`, `packages/integration-sienge`; `~6.0.2` em `apps/web` (toolchain Vite)                                                                                                                                                            |
| `@supabase/supabase-js` | `^2.105.1` em `apps/api` e `workers` (alinhados)                                                                                                                                                                                                                     |
| `@types/node`           | `20.x` (workers), `22.x` (api), `24.x` (web), `25.x` (integration-sienge)                                                                                                                                                                                            |
| `zod`                   | **Duas linhas intencionais:** `^3.x` em `apps/api`, `apps/web`, `packages/shared`; `^4.x` apenas em `packages/integration-sienge` (schemas locais do pacote Sienge). Unificar exige spike de migração 3→4 no shared ou downgrade controlado no pacote de integração. |

## Testes E2E (Playwright)

- Código em [`apps/web/e2e/`](apps/web/e2e/): login mockado + jornadas **auth → pedidos** e **auth → monitor de integração** (`page.route` sobre `/api/*`, sem API real).
- Runbook: [`docs/runbooks/e2e-playwright-auth.md`](docs/runbooks/e2e-playwright-auth.md).
- CI: workflow dedicado [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) (Chromium + `pnpm --filter @projetog/web run test:e2e`).

## Infraestrutura de deploy

### CI/CD (GitHub Actions)

- `ci.yml`: format, lint, test, build em `push`/`pull_request` para `main`
- `e2e.yml`: Playwright (Chromium) em `apps/web` em `push`/`pull_request` para `main`
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

Limpa — nenhuma alteração pendente após execução das correções da meta-auditoria PRD-09.

> **Nota (2026-04-19):** saneamento de lint em `apps/web` concluído — helper `error-utils.ts`, eliminação de `any`, tipos concretos, `useMemo` para derivação de token e `useCallback` para deps de efeitos. Lint agora passa em todos os workspaces.

> **Nota (2026-04-21):** PRD-05 implementado (Fases 1–6). Inclui: migração de delivery_records e order_status_history, validação de entrega (OK/DIVERGENCIA), engine de cálculo de status com precedência (CANCELADO > EM_AVARIA > DIVERGENCIA > REPOSICAO > ENTREGUE > ATRASADO > PARCIALMENTE_ENTREGUE > PENDENTE), cancelamento de pedido com encerramento de régua de follow-up, recepção de status de avaria (stub para PRD-06), sinalização de follow-up após validação de entrega e recálculo de status no worker, testes de integração Phase 6.

> **Nota (2026-04-22):** PRD-03 implementado (Fases 1–5). Inclui: tabelas `notification_templates` e `notification_logs` com enums `notification_type`/`notification_status`, RLS service_role-only, seed de 3 templates default, enums e `TemplateRenderer` no domínio, `NotificationService` na API com envio de nova cotação, envio tardio e alerta de sem resposta, `ResendEmailProvider` com plugin Fastify, worker `notification:send-email` com retry, schemas Zod para validação de rotas, integração com `QuotationsController.sendQuotation`, hook de envio tardio em `UsersController.reactivate`, alerta de sem resposta via `sendNoResponseEmailAlert` no `quotation-expire-check`, telas de templates e logs no frontend, testes unitários e de integração.

> **Nota (2026-04-24 — auditoria completa PRD-04):** PRD-04 implementado (Fases 1–4). Todas as 25 regras de negócio (RN-01 a RN-25) estão implementadas e verificadas. Inclui: 2 migrações de banco (`20260423110000` + `20260423110001`) com extensão de `follow_up_trackers` (supplier_id, promised dates, notification tracking, supplier response, approval, paused_at, completed_reason), tabelas `follow_up_date_changes` e `business_days_holidays`, 4 novos tipos de notificação (`followup_reminder`, `overdue_alert`, `confirmation_received`, `new_date_pending`) com templates seed, enums PRD-04 no domínio, schemas Zod no shared, módulo API `followup` com 7 endpoints (listagem, detalhe, confirmação, sugestão/aprovação/reprovação de datas, histórico de notificações), RBAC e isolamento de fornecedor, auditoria completa de todos os 8 eventos do PRD, worker `follow-up` scheduler diário com régua de notificações sequenciais (1 por dia útil, Compras em cópia da 2ª em diante), detecção de atraso (D+1 útil), encerramento automático por entrega/cancelamento, utilitário de dias úteis com feriados, e telas frontend (backoffice: FollowUpList com filtros de status/fornecedor/obra e FollowUpDetail com timeline de notificações e aprovação de datas; fornecedor: SupplierFollowUpList com indicação de avaria/reposição e SupplierFollowUpDetail com histórico de notificações, confirmação e sugestão de data). Adicionalmente, as telas de pedidos PRD-05 foram implementadas no frontend (OrderList, OrderDetail, SupplierOrderList, SupplierOrderDetail).
>
> Testes existentes (30+ no escopo follow-up/recalc): API 11 (followup.routes.test.ts), worker 5 (follow-up.test.ts), utils business-days 5 (business-days.test.ts), utils order-status-recalc 4 (order-status-recalc.test.ts — encerramento de tracker por entrega total; **parcial PRD-04+PRD-05:** não encerra tracker; PRD-06 §14 coexistência damages + REPOSICAO), frontend 5 (FollowUpList.test.tsx ×2, FollowUpDetail.test.tsx ×1, SupplierFollowUpList.test.tsx ×1, SupplierFollowUpDetail.test.tsx ×1). Cenários sem cobertura de teste: cópia Compras Notificação 2+ (lógica existe, teste não valida), reinício end-to-end da régua após aprovação, concorrência scheduler/resposta, falha de e-mail. _Atualização 2026-05-02: o gap "isolamento de supplier em `listNotifications`" foi fechado — ver nota PRD-03/PRD-04 no rodapé do arquivo._
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
> - ~~**Migração — coluna `suggested_date`**~~ → **Resolvido em 2026-05-02.** Migração `20260502120000_prd04_follow_up_trackers_suggested_date.sql` declara `ADD COLUMN IF NOT EXISTS suggested_date` em `follow_up_trackers`, formalizando ownership PRD-04 §4.1 na timeline (coluna já existia no V1).
> - ~~**Fase 5 (integração com Módulo 5)**~~ → **Coberto por testes automatizados em worker (2026-05-02).** `order-status-recalc.test.ts` valida que entrega parcial não encerra `follow_up_trackers` e que entrega total sim; E2E Playwright browser permanece fora do escopo mínimo (ver PRD-04 §13 Fase 5).
> - ~~**Teste — isolamento supplier em listNotifications**~~ → **Resolvido em 2026-05-02.** `followup.routes.test.ts` cobre cross-supplier 403, `supplier_id` nulo 403 e supplier match 200 (ver nota PRD-03/PRD-04 no rodapé).

> **Nota (2026-04-23):** PRD-05 frontend implementado. As telas de pedidos e entregas — anteriormente listadas como pendentes — agora estão presentes: `/admin/orders`, `/admin/orders/:purchaseOrderId`, `/supplier/orders`, `/supplier/orders/:purchaseOrderId` com navegação no AdminLayout.

> **Nota (2026-04-28):** PRD-06 implementado (Fases 1–6). Todas as 21 regras de negócio (RN-01 a RN-21) estão implementadas e verificadas. Inclui: migração `20260428150000` com extensão de `damages` (10 colunas novas + constraints + índices), tabelas `damage_replacements` e `damage_audit_logs` com RLS por fornecedor, 4 enums no domínio (`DamageStatus`, `DamageAction`, `DamageReplacementStatus`, `DamageReplacementScope`), schemas Zod completos no shared (create, suggest, resolve, informDate, cancelReplacement, list, params), módulo API `damages` com 8 endpoints (POST criar, PATCH suggest, PATCH resolve, PATCH replacement/date, PATCH replacement/cancel, GET listar, GET detalhe, GET audit), RBAC (Fornecedor para sugestão e data; Compras para resolução e cancelamento; ambos para criação; Compras+Admin para audit), isolamento de fornecedor via `resolveSupplierId()`, auditoria completa com todos os 11 eventos do PRD §10 (`avaria_registrada`, `sugestao_enviada`, `sugestao_aceita`, `sugestao_recusada`, `acao_corretiva_definida`, `cancelamento_aplicado`, `reposicao_criada`, `data_reposicao_informada`, `reposicao_entregue`, `reposicao_cancelada`, `pedido_cancelado_total`), recálculo de status de pedido (`recomputeOrderStatusFromDamages`), cancelamento total com encerramento de régua de follow-up, reinício da régua ao informar data de reposição, integração worker `sync-deliveries.ts` para confirmação automática de reposição entregue, e telas frontend completas (backoffice: DamageList com filtros status/fornecedor/pedido/obra e badges coloridos roxo/azul/cinza/verde, DamageDetail com atalhos Aceitar/Recusar sugestão e timeline de auditoria; fornecedor: SupplierDamageList com badges, SupplierDamageDetail com sugestão, data de reposição e timeline de auditoria; compartilhado: DamageCreate com sugestão opcional para fornecedor). Testes: API 12 (damages.routes.test.ts), worker 1 (sync-deliveries.test.ts cenário de reposição entregue), frontend 2 (DamageList.test.tsx, SupplierDamageDetail.test.tsx).
>
> **Nota (2026-05-02 — lacunas PRD-06 6.1 e 6.2):** `damages.routes.test.ts` passa a cobrir 404/409 de `PATCH /api/damages/:damageId/replacement/cancel`, efeitos colaterais (`damage_audit_logs` com `reposicao_cancelada` e `cancelamento_aplicado`, `update` em `damages`, consulta de damages para recálculo) e precedência **EM_AVARIA** sobre **REPOSICAO** quando coexistem damages `EM_REPOSICAO` e `REGISTRADA` no mesmo pedido (PRD-06 §14). `recomputeOrderStatusFromDamages` e `workers/src/utils/order-status-recalc.ts` alinham `hasAvaria` / `hasReposicao` ao `OrderStatusEngine` (PRD-05 §7.3). `order-status-recalc.test.ts` +2 cenários. Documentação: [docs/prd/prd-06-avaria-e-acao-corretiva.md](docs/prd/prd-06-avaria-e-acao-corretiva.md) §14 (mitigação) e §15 (apêndice).

> **Nota (2026-04-30):** PRD-08 implementado (Fases 1–4). Inclui: migração `20260429153000_prd08_dashboard_indicators.sql` (tabelas `dashboard_snapshot`, `dashboard_snapshot_por_fornecedor`, `dashboard_snapshot_por_obra`, `dashboard_criticidade_item` com RLS service_role-only), worker `dashboard:consolidation` com consolidação diária atômica via `pg.Pool` (`dashboard-snapshot-pg.ts` com `BEGIN`/`COMMIT`/`ROLLBACK` explícito, zero `as any`, queries tipadas via `SupabaseClient<Database>`), criticidade por item com média histórica per-item excluindo pedido atual e mínimo de 2 amostras (RN-19), confiabilidade de fornecedor com janela de 3 meses (RN-20/21/22), cron `45 10 * * *` (07:45 BRT), auditoria em `audit_logs` (`dashboard.snapshot_created`/`dashboard.consolidation_error`), controller API com 7 endpoints GET (resumo, kpis, lead-time, atrasos, criticidade, ranking-fornecedores, avarias) com RBAC Compras+Administrador, schemas Zod de query params no shared, telas frontend (DashboardHome com cards operacionais usando paleta oficial #19B4BE/#324598/#dc2626/#7c3aed em gradientes, DashboardLeadTime/DashboardAtrasos/DashboardAvarias com gráficos de evolução via Recharts, DashboardCriticidade com badges urgente/padrão, DashboardRankingFornecedores com badges confiavel/atencao/critico, DashboardFilters e DashboardEvolutionChart como componentes reutilizáveis, dashboard-prd.css com estilos PRD), e 6 testes (3 RBAC + 3 lógica). Dependências adicionadas: `recharts` (^2.15.4) em `apps/web`, `pg` (^8.11.3) + `@types/pg` em `workers`.

> **Nota (2026-05-02 — lacunas PRD-08 8.1–8.3):** Paridade RN-02 nos filtros globais (API + `DashboardFilters` em todos os painéis); `dashboard.access` com insert best-effort; resumos rápidos cobertos por testes (`dashboard.routes.test.ts`, `DashboardHome.test.tsx`). Detalhes em [docs/prd/prd-08-dashboard-e-indicadores.md](docs/prd/prd-08-dashboard-e-indicadores.md) §12 e nota ao final da seção.

> **Nota (2026-05-02):** Lacunas residuais do PRD-03 (Notificações de Cotação) endereçadas. Cobre os dois gaps de baixa severidade documentados na revisão pré-PRD-09:
>
> - **Gap 3.1 — isolamento de supplier em `listNotifications`** (cita o método de PRD-04, mas afeta também a superfície PRD-03):
>   - PRD-03 — `apps/api/src/modules/notifications/notification.routes.test.ts` reescrito sobre o helper `createSupabaseChainMock` com 21 cenários: 401/403 para `FORNECEDOR` e `VISUALIZADOR_PEDIDOS` em `GET /api/notifications/logs`, `GET /api/notifications/templates` e `PUT /api/notifications/templates/:id`; sanity 200 para `COMPRAS` em `/logs`.
>   - PRD-04 — `apps/api/src/modules/followup/followup.routes.test.ts` ganhou 2 testes adicionais para `GET /api/followup/orders/:purchaseOrderId/notifications`: 403 quando o `profiles.supplier_id` é nulo e 200 quando o `supplier_id` do fornecedor coincide com o do tracker (o teste de cross-supplier 403 já existia desde o PRD-04 inicial).
> - **Gap 3.2 — filtros avançados nos logs de notificação** (PRD §7.5):
>   - `packages/shared/src/schemas/notifications.ts` recebe os filtros `type` (NotificationType nativeEnum), `start_date` e `end_date` (formato `YYYY-MM-DD`) com validação Zod;
>   - `NotificationsController.listLogs` aplica `type` (`eq`), `start_date` (`gte` em `created_at`) e `end_date` (`lt` em `created_at` exclusivo +1 dia) tanto no caminho regular quanto na exportação CSV;
>   - `apps/web/src/pages/admin/NotificationLogs.tsx` ganha barra de filtros (Tipo, Status, Data inicial, Data final, Cotação ID, Fornecedor ID) com botões Aplicar/Limpar; `handleExportCSV` repassa os filtros aplicados;
>   - `apps/web/src/pages/admin/NotificationLogs.test.tsx` (novo) cobre 5 cenários: render dos seis filtros, carga inicial sem filtros, aplicar com reset de página, limpar, e tradução PT-BR de tipo/status na linha.
>
> Resultado de qualidade: `apps/api` passa de ~144 para ~158 testes (≈+14 cenários novos no notifications + 2 no followup); `apps/web` ganha o arquivo `NotificationLogs.test.tsx` (5 testes). Nenhuma migração SQL foi necessária. Documentação (este `CLAUDE.md`, `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md` e o histórico do PRD-03) atualizada para refletir o fechamento dos gaps.

> **Nota (2026-05-02 — remediação PRD-07, 3 gaps):** (i) **Homologação §17:** scripts somente leitura em `packages/integration-sienge/src/__tests__/` (`webhook-history`, `quotation-map-supplier`, `multi-quotation-orders`, `deliveries-attended-coverage`, `delivery-requirements-types`) + runbook `docs/runbooks/sienge-homologation.md` com status/evidência/próximo passo por item; `docs/runbooks/sienge-inventory.md` §2 atualizado; `tsx` como devDependency do pacote para execução documentada via `pnpm --filter @projetog/integration-sienge exec tsx …`. (ii) **Webhooks ACK-only:** `IntegrationEntityType` estendido com `contract`, `measurement`, `clearing`; worker `handleAckOnlyEvent` em `workers/src/jobs/process-webhook.ts` + `WebhookController.ENTITY_TYPE_MAP` na API; testes em `process-webhook.test.ts` e `webhooks.test.ts`. (iii) **Monitoramento PRD-09 §8.5:** `/admin/integration` (`IntegrationEvents.tsx`) com filtros, paginação (`limit` 20), colunas de tentativas/próximo retry, botão **Reprocessar** (Compras) + modal; `IntegrationEvents.test.tsx`; `integration.test.ts` cobre `direction` + intervalo de datas. PRD filho §6.5/§11/Fase 7 atualizados em `docs/prd/prd-07-integracao-com-o-sienge.md`.

> **Nota (2026-05-02 — Fase 7 Homologação PRD-07):** Runner consolidado `homologation-checklist.integration.ts` criado em `packages/integration-sienge/src/__tests__/`. Executa todos os checks automatizados de §17 (§17.1, §17.3–17.5, §17.7–17.9) em sequência e produz relatório unificado com status `PASS`/`PARTIAL`/`SKIP`/`FAIL`/`MANUAL` por item. §17.2 e §17.6 marcados `MANUAL` (dependem de sessão presencial). Runbook `docs/runbooks/sienge-homologation.md` atualizado com instrução de execução do runner consolidado. Inventário `docs/runbooks/sienge-inventory.md` atualizado. Fase 7 do PRD-07 §13 marcada como ✅ concluída.

> **Nota (2026-05-03 — Execução meta-auditoria PRD-09):** Correções de compliance executadas após meta-auditoria do relatório PRD-09. 13 ações corretivas (AC-01 a AC-13) aplicadas:
>
> - **AC-01/AC-02 (inserts diretos → AuditService):** `OrdersController` (4 inserts) e `DashboardController` (1 insert com `as any`) migrados para `AuditService.registerEvent()`. Todos os call sites agora incluem `summary`, `actorType` e `purchaseOrderId` conforme RN-12. Zero inserts diretos remanescentes em `audit_logs` fora de `AuditService`.
> - **AC-03 (summary obrigatório):** `AuditService.fallbackSummary()` garante que nenhum evento de auditoria tenha `summary` NULL — gera descrição legível a partir do `eventType` quando o caller não fornece.
> - **AC-04 (OrderList.tsx §14.1):** Adicionadas 3 colunas faltantes: cotação vinculada (`purchase_quotation_id`), obra (`building_name`), data prometida (`promised_date_current`). Tabela agora exibe 10 colunas.
> - **AC-05 (SupplierOrderList.tsx §14.1):** Adicionados 4 campos: obra, data prometida, badge de atraso (🔴 para `ATRASADO`), badge de avaria (🛠️ para `EM_AVARIA`/`REPOSICAO`). Tabela agora exibe 8 colunas.
> - **AC-06 (resiliência §9.6):** `AuditService` enfileira via pg-boss (`audit:retry`, retryLimit: 3, retryDelay: 60s) quando o insert em `audit_logs` falha. Fallback é best-effort — se pg-boss também falhar, o erro é logado mas nunca bloqueia o caller.
> - **AC-07 (AuditTrail.test.tsx):** Expandido de 1 para 6 cenários: load, empty state, filtros, RN-12 fields, API error, metadata.
> - **AC-08 (OrderList.test.tsx):** Adicionado cenário verificando renderização dos 3 novos campos §14.1.
> - **AC-09–AC-13 (documentação):** Relatório `prd09_audit_report.md` corrigido com event types reais, gaps resolvidos (G-1 a G-8) e compliance recalculado de ~85% para ~95%.
>
> Compliance PRD-09 pós-correção: ~95%. Único gap residual: RN-13 (job de arquivamento automático), deferido para V2.0.

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
