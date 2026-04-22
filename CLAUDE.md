# Contexto do Projeto

Documento-base para agentes e mantenedores. Atualizado para refletir o estado real do codebase em `2026-04-21`.

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

- SPA React funcional para autenticação, recuperação de senha, gestão administrativa de usuários, monitoramento de eventos de integração, listagem e detalhe de cotações (backoffice e portal do fornecedor)
- API Fastify com JWT próprio, RBAC, CRUD administrativo de usuários, webhooks Sienge, endpoints de integração, fluxo completo de cotações (backoffice e fornecedor) com envio, resposta, revisão e retry de integração, módulo de entregas com validação e listagem pendente, módulo de pedidos com listagem, detalhes de entregas, cancelamento, histórico de status e recepção de avaria/reposição (PRD-05)
- workers com polling de cotações, pedidos e entregas (com recálculo automático de status de pedido via `OrderStatusEngine` e sinalização de follow-up), reconciliação por webhook, retry de eventos, escrita outbound de negociação, e verificação automática de expiração de cotações
- schema Supabase com tabelas operacionais, RLS, triggers de `updated_at`, migrações PRD-07, PRD-02 (respostas de cotação versionadas) e PRD-05 (delivery_records, order_status_history, campos calculados em purchase_orders)
- pacote de integração Sienge com clientes HTTP, paginação, rate limiting, retry, mapeadores e criptografia de credenciais
- pacote de domínio com `OrderStatusEngine` (regras de precedência de status PRD-05), `OrderOperationalStatus` enum e testes unitários
- infraestrutura de deploy com Dockerfiles, manifests Kubernetes e pipelines CI/CD (build, security, deploy)

## Módulos reais

| Módulo                        | Estado                    | Responsabilidade principal                                                        |
| ----------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `apps/web`                    | implementado parcialmente | SPA do portal/backoffice com auth, users e cotações                               |
| `apps/api`                    | implementado parcialmente | auth, RBAC, webhooks, integração, cotações, entregas, pedidos e orquestração      |
| `workers`                     | implementado parcialmente | polling, reconciliação, retry, expire-check, recálculo de status de pedido e jobs |
| `packages/domain`             | implementado parcialmente | entidades e enums centrais                                                        |
| `packages/integration-sienge` | implementado parcialmente | cliente e adaptação do ERP                                                        |
| `packages/shared`             | implementado parcialmente | schemas, tipos e utilitários                                                      |
| `supabase`                    | implementado parcialmente | banco, auth, migrações e seed                                                     |

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
- `/supplier/quotations` (Fornecedor)
- `/supplier/quotations/:id` (Fornecedor)

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

Agendamentos observados:

- `*/15 * * * *`: sincronização de cotações, pedidos e entregas
- `0 * * * *`: retry de integração
- `0 11 * * *`: follow-up diário (08:00 BRT)
- `15 11 * * *`: expire-check de cotações (08:15 BRT)

Infraestrutura de suporte:

- `logger.ts`: logging estruturado
- `observability.ts`: métricas e monitoramento
- `operational-notifications.ts`: notificações operacionais para `Compras`
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
- `follow_up_trackers`
- `damages`
- `notifications`
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

Em `2026-04-21`:

- `pnpm -r run build`: OK (6 workspaces)
- `pnpm -r run test`: OK (testes passando em `apps/api`, `workers`, `packages/domain`)
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

### Working tree atual

Limpa — nenhuma alteração pendente.

> **Nota (2026-04-19):** saneamento de lint em `apps/web` concluído — helper `error-utils.ts`, eliminação de `any`, tipos concretos, `useMemo` para derivação de token e `useCallback` para deps de efeitos. Lint agora passa em todos os workspaces.

> **Nota (2026-04-21):** PRD-05 implementado (Fases 1–6). Inclui: migração de delivery_records e order_status_history, validação de entrega (OK/DIVERGENCIA), engine de cálculo de status com precedência (CANCELADO > EM_AVARIA > DIVERGENCIA > REPOSICAO > ENTREGUE > ATRASADO > PARCIALMENTE_ENTREGUE > PENDENTE), cancelamento de pedido com encerramento de régua de follow-up, recepção de status de avaria (stub para PRD-06), sinalização de follow-up após validação de entrega e recálculo de status no worker, testes de integração Phase 6.

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
