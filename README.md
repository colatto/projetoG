# projetoG

[![CI](https://github.com/colatto/projetoG/actions/workflows/ci.yml/badge.svg)](https://github.com/colatto/projetoG/actions/workflows/ci.yml)
[![Security](https://github.com/colatto/projetoG/actions/workflows/security.yml/badge.svg)](https://github.com/colatto/projetoG/actions/workflows/security.yml)
[![Hostinger API bundle](https://github.com/colatto/projetoG/actions/workflows/hostinger-api-bundle-artifact.yml/badge.svg)](https://github.com/colatto/projetoG/actions/workflows/hostinger-api-bundle-artifact.yml)
![License](https://img.shields.io/badge/license-not%20defined-lightgrey)

Monorepo da GRF para portal do fornecedor, backoffice interno e integracao operacional com o Sienge.

## Estado Atual

Atualizado em `2026-05-05`.

O projeto ja ultrapassou a fase de bootstrap e possui frontend, API, workers, banco Supabase, integracao Sienge e CI/CD. Build, lint e testes passam em todos os workspaces. Deploy de API e workers em producao documenta-se como **bundles Node 20** (Hostinger «Setup Node.js App»).

| Area            | Estado                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Funcionalidades | PRD-01 a PRD-09 implementados no codigo (PRD-09: auditoria operacional, aliases HTTP e UX transversal) |
| Testes          | Passam em todos os workspaces                                                                          |
| Build           | Passa em todos os workspaces                                                                           |
| Lint            | Passa em todos os workspaces                                                                           |
| Auditoria       | `pnpm audit --audit-level=moderate` reporta vulnerabilidades moderadas                                 |
| Licenca         | Nao ha arquivo `LICENSE` no repositorio                                                                |

## Modulos

- `apps/web`: SPA React + Vite para login, recuperacao de senha, rotas protegidas, gestao de usuarios, monitoramento de integracao, trilha de auditoria operacional (`/admin/audit`), fluxo de cotacoes, pedidos, follow-up logistico, notificacoes, avarias e dashboards (PRD-08).
- `apps/api`: API Fastify com autenticacao, RBAC, auditoria, webhooks Sienge, orquestracao de jobs, cotacoes, entregas, pedidos, notificacoes, follow-up, avarias, dashboards (PRD-08), health check, Swagger e metricas Prometheus.
- `workers`: runtime Node.js + `pg-boss` para polling Sienge, reconciliacao, retries, processamento de webhooks, escrita outbound de negociacoes, expiracao de cotacoes, envio de e-mail, follow-up diario, recalculo de status de pedido e consolidacao diaria do dashboard (PRD-08).
- `packages/domain`: enums, entidades e servicos de dominio, incluindo `OrderStatusEngine` e `TemplateRenderer`.
- `packages/shared`: schemas Zod, tipos Supabase e utilitarios compartilhados.
- `packages/integration-sienge`: cliente HTTP, clientes especializados, mapeadores, health check de integracao e criptografia de credenciais Sienge.
- `supabase`: configuracao local, seed e 19 migracoes versionadas, incluindo PRD-08 (dashboards) e PRD-09 (`audit_logs` operacional).
- `deploy/`: exemplos de variaveis (`deploy/compose/*.env.example`) e scripts de smoke.

## Topologia

```text
.
├── apps/
│   ├── api/
│   └── web/
├── deploy/
│   ├── compose/
│   └── scripts/
├── docs/
│   ├── architecture.md
│   ├── decisions/
│   ├── prd/
│   └── runbooks/
├── packages/
│   ├── domain/
│   ├── integration-sienge/
│   └── shared/
├── scripts/
├── supabase/
├── tools/
└── workers/
```

Observacao: o pacote `apps/` raiz ainda contem resquicios de scaffold Vite e nao deve ser tratado como aplicacao de producao. As aplicacoes reais sao `apps/web` e `apps/api`.

## Stack

| Camada     | Tecnologias principais                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Workspace  | pnpm workspace, Node.js 20, TypeScript                                                                        |
| Frontend   | React 19, React Router 7, Vite 8, React Hook Form, Axios, Zod, Lucide, Recharts                               |
| API        | Fastify 5, `@fastify/jwt`, Swagger, Zod, Supabase JS, pg-boss, Resend, Prometheus                             |
| Workers    | Node.js, pg-boss 9, pg (transacoes atomicas), Supabase JS, Resend, Prometheus                                 |
| Integracao | Axios, axios-retry, Bottleneck, cliente Sienge proprio                                                        |
| Banco      | Supabase/PostgreSQL 17, RLS, migrations SQL                                                                   |
| Qualidade  | Vitest, ESLint 9, Prettier 3, Husky, lint-staged, gitleaks                                                    |
| Deploy     | GitHub Actions (CI, artefactos de bundle, seguranca); producao via bundles Node 20 na Hostinger (ver runbook) |

Ha heterogeneidade de versoes entre workspaces, especialmente em `vitest`, `typescript`, `@types/node`, `zod` e `@supabase/supabase-js`.

## Funcionalidades

- PRD-01: autenticacao, perfis, RBAC e gestao de usuarios.
- PRD-02: fluxo de cotacao com envio por Compras, resposta do fornecedor e revisao.
- PRD-03: templates de notificacao, logs e envio de e-mail via Resend.
- PRD-04: follow-up logistico, sugestao/aprovacao de nova data, notificacoes e calculo de dias uteis.
- PRD-05: pedidos, entregas, divergencias, validacao e historico de status operacional.
- PRD-06: avarias, acoes corretivas, reposicoes, auditoria especifica e telas de backoffice/fornecedor.
- PRD-07: integracao Sienge por polling, webhooks, reconciliacao, retries e escrita outbound.
- PRD-08: snapshots diarios de KPIs, ranking, lead time, atrasos, criticidade e avarias; consolidacao atomica (pg), graficos de evolucao (recharts), cards com cores operacionais; API `/api/dashboard/*` e telas `/admin/dashboard/*`.
- PRD-09: trilha de auditoria operacional (`audit_logs` enriquecido com summary obrigatorio, `AuditService` centralizado com fallback pg-boss, `GET /api/backoffice/audit*`), aliases `/api/backoffice/integrations*` e `/api/supplier-portal/orders*` (espelho dos canonicos), filtro "Exigem acao" em cotacoes backoffice, campos minimos §14.1 em OrderList (10 colunas) e SupplierOrderList (8 colunas com badges de atraso/avaria), cooldown de retry manual na UI de integracao; retencao 1 ano documentada em `docs/runbooks/prd09-audit-retention.md`.

## Principais Endpoints

| Area                    | Rotas                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saude e observabilidade | `GET /health`, `GET /metrics`, `GET /docs`                                                                                                        |
| Auth                    | `/api/auth/*`                                                                                                                                     |
| Usuarios                | `/api/users/*`                                                                                                                                    |
| Integracao              | `/api/integration/*`, `GET /api/backoffice/integrations`, `POST /api/backoffice/integrations/:id/retry` (aliases PRD-09), `POST /webhooks/sienge` |
| Cotacoes                | `/api/quotations/*`, `/api/backoffice/quotations/*`, `/api/supplier/quotations/*`, `/api/supplier-portal/quotations/*`                            |
| Pedidos e entregas      | `/api/orders/*`, `/api/backoffice/orders/*`, `/api/supplier-portal/orders/*` (alias), `/api/deliveries/*`                                         |
| Auditoria (PRD-09)      | `GET /api/backoffice/audit`, `GET /api/backoffice/audit/:audit_event_id`                                                                          |
| Notificacoes            | `/api/notifications/*`                                                                                                                            |
| Follow-up               | `/api/followup/*`                                                                                                                                 |
| Avarias                 | `/api/damages/*`                                                                                                                                  |
| Dashboard (PRD-08)      | `/api/dashboard/*`                                                                                                                                |

## Pre-requisitos

- Node.js 20
- `corepack` habilitado
- pnpm 10
- acesso ao projeto Supabase `dbGRF`
- credenciais Sienge para homologacao/desenvolvimento
- `DATABASE_URL` com acesso direto ao PostgreSQL para executar `workers`
- chave Resend quando for enviar e-mails reais

## Instalacao

```bash
corepack enable
pnpm install
```

## Configuracao De Ambiente

Use os exemplos versionados:

- `.env.example`: referencia consolidada para web, API e workers
- `apps/api/.env.example`: variaveis da API
- `workers/.env.example`: variaveis dos workers

Nao existe `apps/web/.env.example`; para o frontend, crie `apps/web/.env` usando as variaveis `VITE_*` documentadas no `.env.example` raiz.

### Frontend

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:3000/api
```

### API

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=
SIENGE_BASE_URL=https://api.sienge.com.br
SIENGE_API_KEY=
SIENGE_API_SECRET=
SIENGE_WEBHOOK_SECRET=
SIENGE_ENCRYPTION_KEY=
JWT_SECRET=
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
DATABASE_URL=
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=GRF Cotações <cotacoes@grfincorporadora.com>
FRONTEND_URL=http://localhost:5173
COMPRAS_EMAIL=compras@grfincorporadora.com
```

`DATABASE_URL` e opcional na API. Sem ela, a API sobe com publisher `pg-boss` desabilitado.

### Workers

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SIENGE_BASE_URL=https://api.sienge.com.br
SIENGE_API_KEY=
SIENGE_API_SECRET=
SIENGE_ENCRYPTION_KEY=
NODE_ENV=development
# PORT tem precedencia sobre WORKER_METRICS_PORT quando definido (ex.: Phusion Passenger na Hostinger injeta PORT)
# HOST opcional; bind do servidor /health (default 0.0.0.0)
WORKER_METRICS_PORT=9080
EMAIL_PROVIDER_API_KEY=
EMAIL_FROM_ADDRESS=GRF Cotações <cotacoes@grfincorporadora.com>
COMPRAS_EMAIL=compras@grfincorporadora.com
```

`DATABASE_URL` e obrigatorio nos workers.

Em producao na Hostinger «Setup Node.js App», normalmente **nao** definir `PORT` manualmente — o runtime injeta; use `WORKER_METRICS_PORT` apenas como fallback em ambientes sem `PORT`.

## Execucao Local

Em terminais separados:

```bash
pnpm --filter @projetog/web dev
pnpm --filter @projetog/api dev
pnpm --filter @projetog/workers dev
```

Se o watcher do `tsx` falhar no ambiente local, use a API sem watch:

```bash
pnpm --filter @projetog/api dev:no-watch
```

Pontos de acesso padrao:

- web: porta padrao do Vite
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- metricas API: `http://localhost:3000/metrics`
- workers: `http://localhost:9080/health`, `/ready` e `/metrics`

## Supabase

Configuracao local observada em `supabase/config.toml`:

- API: `54321`
- PostgreSQL: `54322`
- Studio: `54323`
- Inbucket: `54324`
- PostgreSQL major: `17`

Comandos utilitarios:

```bash
pnpm run db:login
pnpm run db:link
pnpm run db:push
pnpm run db:pull
pnpm run db:types
```

Depois de alterar migrations, gere novamente `packages/shared/src/database.types.ts` seguindo o fluxo em `docs/runbooks/typecheck-and-supabase-types.md`.

## Checks

Estado verificado em `2026-05-05`:

```bash
pnpm -r run test
pnpm -r run build
pnpm -r run lint
pnpm audit --audit-level=moderate
```

Resultado atual:

- `pnpm -r run test`: passa em todos os workspaces.
- `pnpm --filter @projetog/api test`: passa, 168+ testes.
- `pnpm --filter @projetog/web test`: passa, 53 testes.
- `pnpm --filter @projetog/domain test`: passa, 16 testes.
- `pnpm --filter @projetog/integration-sienge test`: passa, 53 testes.
- `pnpm --filter @projetog/shared test`: passa sem arquivos de teste por `--passWithNoTests`.
- `pnpm -r run build`: passa em todos os workspaces.
- `pnpm -r run lint`: passa em todos os workspaces (inclui `apps/web` e regras `eslint-plugin-react-hooks` 7.x; ver [`CLAUDE.md`](CLAUDE.md) «Estado dos checks»).
- `pnpm audit --audit-level=moderate`: reporta vulnerabilidades moderadas em dependencias transitivas.

## Auditoria De Dependencias

Resultado atual de `pnpm audit --audit-level=moderate`:

| Pacote    | Severidade | Origem observada                                                 |
| --------- | ---------- | ---------------------------------------------------------------- |
| `esbuild` | moderada   | transitivo via `workers > vitest > vite`                         |
| `vite`    | moderada   | transitivo via `workers > vitest > vite`                         |
| `uuid`    | moderada   | transitivo via `apps/api > pg-boss` e `apps/api > resend > svix` |
| `postcss` | moderada   | transitivo via `apps/api > vitest > vite`                        |

Mitigacoes ja presentes em `package.json`:

- `@fastify/static`: `9.1.1`
- `fast-jwt`: `6.2.1`
- `follow-redirects`: `1.16.0`

## CI/CD

Workflows em `.github/workflows/`:

- `ci.yml`: `format:check`, lint, typecheck, test e build em push/PR para `main` (Node 20, pnpm 10, `pnpm/action-setup@v4`).
- `e2e.yml`: Playwright (Chromium) em `apps/web` nos mesmos gatilhos.
- `security.yml`: `pnpm audit --audit-level=moderate`, gitleaks e dependency review em PRs.
- `hostinger-api-bundle-artifact.yml` / `hostinger-workers-bundle-artifact.yml`: `workflow_dispatch`, upload de `apps/api/dist/hostinger-entry.js` e `workers/dist/hostinger-entry.js` como artefactos (alternativa a rodar esbuild no servidor).

Bundles Node 20: `pnpm run build:api` e `pnpm run build:workers` na raiz geram os entrypoints; arranque com `pnpm run start:api` / `pnpm run start:workers`. Ver `docs/runbooks/deploy-hostinger.md`.

## Desenvolvimento E Contribuicao

O repositorio usa:

- Husky 9
- `lint-staged.config.mjs`
- Prettier
- ESLint flat config por workspace
- templates de issue e pull request em `.github/`

Fluxo recomendado:

1. Criar branch a partir de `main`.
2. Atualizar codigo, migrations e tipos Supabase juntos quando houver alteracao de schema.
3. Rodar checks do workspace afetado.
4. Preencher o template de PR com risco, rollback e evidencias.

Referencia: `docs/runbooks/branching-and-review.md`.

## Seguranca

- Nao commitar arquivos `.env`.
- Usar `.env.example`, `apps/api/.env.example` e `workers/.env.example` como referencia.
- Rodar `pnpm run security:secrets` antes de PRs sensiveis.
- O CI executa gitleaks.
- Credenciais Sienge podem vir da tabela `sienge_credentials`; em desenvolvimento, os workers fazem fallback para variaveis `SIENGE_*`.

## Documentacao

- `docs/architecture.md`: arquitetura, fluxos, inventario tecnico e debitos.
- `docs/runbooks/setup.md`: setup local e troubleshooting.
- `docs/runbooks/sienge-homologation.md`: homologacao Sienge.
- `docs/runbooks/sienge-inventory.md`: inventario da integracao.
- `docs/runbooks/branching-and-review.md`: branching e review.
- `docs/runbooks/typecheck-and-supabase-types.md`: instrucoes para validacao e geracao de tipos Supabase.
- `docs/runbooks/deploy-hostinger.md`: deploy na Hostinger (duas Node.js Apps + bundles).
- `docs/prd/`: PRDs por modulo.
- `deploy/README.md`: deploy.
- `workers/README.md`: workers.
- `supabase/README.md`: Supabase.

## Pendencias Tecnicas Principais

- Definir licenca do repositorio ou documentar explicitamente que o codigo e proprietario.
- Unificar versoes de `vitest`, `typescript`, `zod`, `@types/node` e `@supabase/supabase-js` quando houver janela de manutencao.
- Reavaliar vulnerabilidades moderadas do `pnpm audit`.
- Regenerar `database.types.ts` quando houver novas migracoes para manter os tipos alinhados (ver `docs/runbooks/typecheck-and-supabase-types.md`).
