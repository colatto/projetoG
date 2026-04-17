# Contexto do Projeto

Documento-base para agentes e mantenedores. Atualizado para refletir o estado real do codebase em `2026-04-17`.

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

- SPA React funcional para autenticação, recuperação de senha, gestão administrativa de usuários e monitoramento de eventos de integração
- API Fastify com JWT próprio, RBAC, CRUD administrativo de usuários, webhooks Sienge e endpoints de integração
- workers com polling de cotações, pedidos e entregas, reconciliação por webhook, retry de eventos e escrita outbound de negociação
- schema Supabase com tabelas operacionais, RLS, triggers de `updated_at` e migrações PRD-07
- pacote de integração Sienge com clientes HTTP, paginação, rate limiting, retry, mapeadores e criptografia de credenciais

## Módulos reais

| Módulo                        | Estado                    | Responsabilidade principal                       |
| ----------------------------- | ------------------------- | ------------------------------------------------ |
| `apps/web`                    | implementado parcialmente | SPA do portal/backoffice                         |
| `apps/api`                    | implementado parcialmente | auth, RBAC, webhooks, integração e orquestração  |
| `workers`                     | implementado parcialmente | polling, reconciliação, retry e jobs assíncronos |
| `packages/domain`             | implementado parcialmente | entidades e enums centrais                       |
| `packages/integration-sienge` | implementado parcialmente | cliente e adaptação do ERP                       |
| `packages/shared`             | implementado parcialmente | schemas, tipos e utilitários                     |
| `supabase`                    | implementado parcialmente | banco, auth, migrações e seed                    |

## Capacidades confirmadas no código

### `apps/web`

- `/login`
- `/esqueci-senha`
- `/reset-password`
- `/admin/users`
- `/admin/users/new`
- `/admin/users/:id`
- `/admin/integration`
- `ProtectedRoute` com checagem por perfil
- `AuthContext` com persistência de token em `localStorage`

### `apps/api`

- `GET /health`
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

Agendamentos observados:

- `*/15 * * * *`: sincronização de cotações, pedidos e entregas
- `0 * * * *`: retry de integração
- `0 11 * * *`: follow-up diário

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
- `supplier_negotiations`
- `purchase_orders`
- `deliveries`
- `purchase_invoices`
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

Em `2026-04-17`:

- `pnpm -r run test`: OK
- `pnpm -r run build`: OK
- `pnpm -r run lint`: falha

Falhas de lint concentram-se em:

- `apps/api`: `no-unused-vars` e `no-explicit-any`
- `workers`: `no-unused-vars`, `prefer-const` e `no-explicit-any`

## Auditoria de dependências

`pnpm audit` retornou 12 vulnerabilidades:

- 2 críticas em `fast-jwt` via `@fastify/jwt`
- 2 altas em `fastify`/`fast-jwt`
- 8 moderadas em `vite`, `follow-redirects` e `@fastify/static`

Atualizações seguras de curto prazo já identificadas:

- `fastify 5.8.4 -> 5.8.5`
- `prettier 3.8.1 -> 3.8.3`
- `react-router-dom 7.14.0 -> 7.14.1`
- `typescript-eslint 8.58.1 -> 8.58.2`
- `@supabase/supabase-js 2.102.1 -> 2.103.3`

Atualizações de maior impacto a planejar:

- `@fastify/jwt 9.1.0 -> 10.0.0`
- `pg-boss 9.0.3 -> 12.15.0`
- `zod 3.x -> 4.x` fora do pacote de integração
- `vitest 1/2 -> 4`
- `eslint 9 -> 10`

## Riscos atuais confirmados

- existem arquivos `.env` versionados em `apps/api`, `apps/web` e `workers`; tratar como incidente de governança e rotacionar segredos fora da documentação
- não existe manifesto de deploy para API ou workers no repositório
- o pacote `apps/` ainda mantém artefatos do template Vite e não representa um produto executável
- a estratégia formal de branching/code review não está documentada; o que existe hoje é um gate de CI em `pull_request` e `push` para `main`

## Mudanças recentes já incorporadas ao codebase

### Histórico Git observado

- `2026-04-10` `ada641a`: início da implementação do PRD-07, com tipos Sienge e migração de integração
- `2026-04-16` `0fb49dd`: entrada dos módulos de integração/webhooks, entidades de domínio, workers e mapeadores
- `2026-04-16` `44669cd`: expansão forte de cobertura de testes, runbooks e melhorias em sync cursor/retries

### Working tree atual ainda não commitado

- UI administrativa de eventos de integração no frontend
- persistência do payload completo de webhook
- correção do `http_method` outbound para `POST`
- extração correta de `payload.data` ao reprocessar webhooks
- janela explícita de datas em health check e sync de cotações
- utilitário de notificações operacionais para `Compras`

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
