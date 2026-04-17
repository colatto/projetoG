# projetoG

Monorepo da aplicação da GRF para portal do fornecedor, backoffice interno e integração operacional com o Sienge.

## Estado atual

O repositório já está operacional como monorepo `pnpm` e contém:

- `apps/web`: SPA React 19 + Vite 8 para login, recuperação de senha, gestão de usuários e monitoramento de integração.
- `apps/api`: API Fastify 5 com autenticação, RBAC, auditoria, webhooks Sienge e orquestração de jobs.
- `workers`: runtime Node.js + `pg-boss` para polling, reconciliação, retries e escrita outbound no Sienge.
- `packages/domain`: enums e entidades centrais de usuários, webhooks, integração e cursores de sincronização.
- `packages/integration-sienge`: cliente HTTP resiliente, mapeadores e criptografia para credenciais Sienge.
- `packages/shared`: schemas Zod, tipos do Supabase e utilitários compartilhados.
- `supabase`: migrações, seed e configuração local/remota do projeto `dbGRF`.

## Topologia do repositório

```text
.
├── CLAUDE.md
├── README.md
├── PRDGlobal.md
├── .env.example
├── apps/
│   ├── api/
│   └── web/
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
| API          | Fastify `5.8.4`, `@fastify/jwt` `9.0.1`, Zod `3.23.8`, Vitest `2.1.0`   | Backend dedicado em `apps/api`                     |
| Workers      | Node.js + `pg-boss` `9.0.3`, Supabase JS `2.39.0`, Vitest `1.4.0`       | Processamento assíncrono em `workers`              |
| Integração   | Axios `1.15.0`, `axios-retry` `4.5.0`, Bottleneck `2.19.5`, Zod `4.3.6` | `packages/integration-sienge`                      |
| Persistência | Supabase/PostgreSQL 17                                                  | Projeto `lkfevrdhofxlmwjfhnru`, região `sa-east-1` |
| Qualidade    | ESLint 9, Prettier 3, Husky 9, lint-staged 16                           | Configuração por workspace                         |

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

## CI/CD observado

- GitHub Actions em `.github/workflows/ci.yml`
- gatilhos em `push` e `pull_request` para `main`
- etapas: `pnpm install --frozen-lockfile`, `format:check`, `lint`, `test`, `pnpm -r run build`

Não há manifesto de deploy versionado para API ou workers. O alvo operacional continua sendo backend/worker standalone [VERIFICAR].

## Situação dos checks em 2026-04-17

- `pnpm -r run test`: passa
- `pnpm -r run build`: passa
- `pnpm -r run lint`: falha em `apps/api` e `workers`

As falhas de lint atuais são principalmente:

- `no-unused-vars`
- `no-explicit-any`
- resíduos em arquivos de teste dos workers

## Auditoria resumida de dependências em 2026-04-17

- `pnpm audit`: 12 vulnerabilidades encontradas
- críticas/altas concentradas em `fast-jwt` via `@fastify/jwt` e `fastify@5.8.4`
- moderadas em `vite` transitivo do Vitest, `follow-redirects` via `axios` no frontend e `@fastify/static` via `@fastify/swagger-ui`

Atualizações de menor risco já identificadas:

- `fastify 5.8.4 -> 5.8.5`
- `prettier 3.8.1 -> 3.8.3`
- `react-router-dom 7.14.0 -> 7.14.1`
- `typescript-eslint 8.58.1 -> 8.58.2`
- `@supabase/supabase-js 2.102.1 -> 2.103.3`

## Documentação principal

- `CLAUDE.md`: baseline técnica e diretrizes do repositório
- `docs/architecture.md`: arquitetura atual, diagramas, fluxos e inventário técnico
- `docs/runbooks/setup.md`: instalação, execução e troubleshooting
- `docs/runbooks/sienge-homologation.md`: pendências de homologação externa
- `docs/runbooks/sienge-inventory.md`: inventário funcional da integração
