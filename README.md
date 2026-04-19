# projetoG

Monorepo da aplicação da GRF para portal do fornecedor, backoffice interno e integração operacional com o Sienge.

## Estado atual

O repositório já está operacional como monorepo `pnpm` e contém:

- `apps/web`: SPA React 19 + Vite 8 para login, recuperação de senha, gestão de usuários, monitoramento de integração e fluxo de cotações (backoffice e portal do fornecedor).
- `apps/api`: API Fastify 5 com autenticação, RBAC, auditoria, webhooks Sienge, orquestração de jobs, fluxo completo de cotações (envio, resposta, revisão) e métricas.
- `workers`: runtime Node.js + `pg-boss` para polling, reconciliação, retries, escrita outbound no Sienge e verificação de expiração de cotações.
- `packages/domain`: enums e entidades centrais de usuários, webhooks, integração e cursores de sincronização.
- `packages/integration-sienge`: cliente HTTP resiliente, 6 clientes especializados, mapeadores e criptografia para credenciais Sienge.
- `packages/shared`: schemas Zod (auth, users, integration, quotations), tipos do Supabase e utilitários compartilhados.
- `supabase`: 9 migrações, seed e configuração local/remota do projeto `dbGRF`.

## Topologia do repositório

```text
.
├── CLAUDE.md
├── GEMINI.md
├── README.md
├── PRDGlobal.md
├── .env.example
├── apps/
│   ├── api/
│   └── web/
├── deploy/
│   └── k8s/
├── docs/
│   ├── architecture.md
│   ├── decisions/
│   ├── prd/
│   └── runbooks/
├── packages/
│   ├── domain/
│   ├── integration-sienge/
│   └── shared/
├── supabase/
├── tools/
└── workers/
```

## Stack em uso

| Camada       | Stack                                                                   | Observação                                         |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Frontend     | React `19.2.4`, React Router `7.14.0`, Vite `8.0.7`, TypeScript `6.0.2` | SPA em `apps/web`                                  |
| API          | Fastify `5.8.5`, `@fastify/jwt` `10.0.0`, Zod `3.23.8`, Vitest `2.1.0`  | Backend dedicado em `apps/api`                     |
| Workers      | Node.js + `pg-boss` `9.0.3`, Supabase JS `2.39.0`, Vitest `1.4.0`       | Processamento assíncrono em `workers`              |
| Integração   | Axios `1.15.0`, `axios-retry` `4.5.0`, Bottleneck `2.19.5`, Zod `4.3.6` | `packages/integration-sienge`                      |
| Persistência | Supabase/PostgreSQL 17                                                  | Projeto `lkfevrdhofxlmwjfhnru`, região `sa-east-1` |
| Qualidade    | ESLint 9, Prettier 3, Husky 9, lint-staged 16                           | Configuração por workspace                         |
| Deploy       | Docker, GHCR, Kubernetes, GitHub Actions                                | CI + deploy + security pipelines                   |

## Quick start

1. Instale dependências:

```bash
pnpm install
```

2. Crie os arquivos de ambiente por módulo a partir de:

- `.env.example`
- `apps/api/.env.example`
- `workers/.env.example`

3. Suba os processos em terminais separados:

```bash
pnpm --filter @projetog/web dev
pnpm --filter @projetog/api dev
pnpm --filter @projetog/workers dev
```

4. Checks principais:

```bash
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

## Banco e Supabase

Comandos utilitários definidos na raiz:

```bash
pnpm run db:login
pnpm run db:link
pnpm run db:push
pnpm run db:pull
pnpm run db:types
```

Referência operacional: `docs/runbooks/setup.md`

## CI/CD

### Pipelines ativas (`.github/workflows/`)

- `ci.yml`: format → lint → test → build em PRs e push para `main`
- `deploy.yml`: Docker build → GHCR push → K8s apply (push para `main` ou manual)
- `security.yml`: `pnpm audit` → gitleaks → dependency review em PRs

### Containers

- `apps/api/Dockerfile`: imagem de produção da API
- `workers/Dockerfile`: imagem de produção dos workers

### Kubernetes

- Manifests em `deploy/k8s/` com Kustomization

## Situação dos checks em 2026-04-19

- `pnpm -r run build`: passa
- `pnpm -r run test`: passa (40 testes)
- `pnpm -r run lint`: passa (1 warning residual em `apps/web` — `react-hooks/incompatible-library`, não acionável)

## Auditoria de dependências em 2026-04-19

- `pnpm audit`: 3 vulnerabilidades moderadas (em devDependencies transitivas: vite e esbuild via vitest)
- Mitigações aplicadas via `pnpm.overrides`: `@fastify/static 9.1.1`, `fast-jwt 6.2.1`, `follow-redirects 1.16.0`

## Documentação principal

- `CLAUDE.md`: baseline técnica e diretrizes do repositório
- `GEMINI.md`: guardrails para agentes Gemini
- `docs/architecture.md`: arquitetura atual, diagramas, fluxos e inventário técnico
- `docs/runbooks/setup.md`: instalação, execução e troubleshooting
- `docs/runbooks/sienge-homologation.md`: pendências de homologação externa
- `docs/runbooks/sienge-inventory.md`: inventário funcional da integração
- `docs/runbooks/branching-and-review.md`: convenções de branching e review
