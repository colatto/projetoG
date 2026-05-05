# Runbook de Setup

Runbook operacional para instalar, executar e validar o monorepo no estado atual.

## 1. Pré-requisitos

- Node.js 20 com `corepack`
- `pnpm` habilitado via `corepack enable`
- acesso ao projeto Supabase `dbGRF`
- credenciais do Sienge para ambiente homologação/desenvolvimento
- conexão PostgreSQL direta para `pg-boss` quando for executar `workers`

## 2. Instalação inicial

```bash
corepack enable
pnpm install
```

## 3. Arquivos de ambiente

Use:

- `.env.example`
- `apps/api/.env.example`
- `workers/.env.example`

### 3.1 Frontend (`apps/web/.env`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3.2 API (`apps/api/.env`)

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
NODE_ENV=development
DATABASE_URL=
```

`DATABASE_URL` é opcional na API. Quando ausente, a API sobe sem publisher de `pg-boss`.

### 3.3 Workers (`workers/.env`)

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SIENGE_BASE_URL=https://api.sienge.com.br
SIENGE_API_KEY=
SIENGE_API_SECRET=
SIENGE_ENCRYPTION_KEY=
NODE_ENV=development
```

Em desenvolvimento local use `WORKER_METRICS_PORT` (default efetivo `9080`) se não definir `PORT`. Em **Phusion Passenger** (ex.: Hostinger Node.js App), o runtime injeta **`PORT`** — esse valor tem **precedência** sobre `WORKER_METRICS_PORT`. Opcional: `HOST` para o bind do servidor `/health` (default `0.0.0.0`).

## 4. Supabase

### 4.1 Projeto local

Configuração observada em `supabase/config.toml`:

- API: `54321`
- DB: `54322`
- Studio: `54323`
- Inbucket: `54324`

### 4.2 Comandos úteis

```bash
pnpm run db:login
pnpm run db:link
pnpm run db:push
pnpm run db:pull
pnpm run db:types
```

## 5. Subida local dos serviços

Em terminais separados:

```bash
pnpm --filter @projetog/web dev
pnpm --filter @projetog/api dev
pnpm --filter @projetog/workers dev
```

Se o ambiente bloquear o watcher do `tsx` com erro de IPC em `/tmp` ou impedir o script `dev` da API, use:

```bash
pnpm --filter @projetog/api dev:no-watch
```

Pontos de acesso:

- web: porta padrão do Vite
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

## 6. Checks recomendados

```bash
pnpm -r run test
pnpm -r run build
pnpm -r run lint
```

Situação observada em `2026-05-05` (detalhe de contagens: [`CLAUDE.md`](../../CLAUDE.md) na raiz do repositório):

- `test`: passa em todos os workspaces com script de teste
- `build`: passa nos workspaces aplicáveis
- `lint`: passa em todos os workspaces; `apps/web` está alinhado às regras `react-hooks` do `eslint-plugin-react-hooks` 7.x (`queueMicrotask` nos efeitos com fetch, sincronização de ref só em efeito onde aplicável, sem `Date.now()` impuro no render em `SupplierQuotationDetail`, `useWatch` em `UserCreate`)

## 7. Hooks de commit

O repositório usa:

- Husky 9
- `lint-staged.config.mjs`

No pre-commit são executados:

- `eslint --fix` por workspace afetado
- `prettier --write` nos arquivos staged

## 8. Integração Sienge

### 8.1 Credenciais ativas

O worker tenta primeiro buscar credenciais ativas em `sienge_credentials`. Sem elas:

- em `development`, faz fallback para `SIENGE_BASE_URL`, `SIENGE_API_KEY` e `SIENGE_API_SECRET`
- fora de `development`, falha

### 8.2 Webhooks

Endpoint público esperado:

```text
POST /webhooks/sienge
```

Headers obrigatórios observados:

- `x-sienge-id`
- `x-sienge-event`

Headers opcionais suportados:

- `x-sienge-hook-id`
- `x-sienge-tenant`
- `x-webhook-secret`

## 9. Troubleshooting

### API sobe mas sem fila

Sintoma:

- log `DATABASE_URL not configured; pg-boss publisher disabled in API`

Causa:

- `DATABASE_URL` ausente em `apps/api/.env`

### API nao sobe na porta 3000 no ambiente atual

Sintoma:

- verificador externo reporta que a API na porta `3000` nao esta rodando
- `pnpm --filter @projetog/api dev` falha com erro de `tsx`/IPC em `/tmp`
- bootstrap falha antes do `listen` com erro de import em plugin

Causas provaveis:

- ambiente restrito bloqueando o `tsx watch`; usar `pnpm --filter @projetog/api dev:no-watch`
- incompatibilidade de runtime no plugin de metricas; validar `GET /metrics` e `GET /health`

### Workers falham ao iniciar

Sintoma:

- erro ao construir `PgBoss`

Causa provável:

- `DATABASE_URL` inválida
- banco Supabase/local indisponível

### Credenciais Sienge ausentes

Sintoma:

- erro ao criar cliente Sienge nos workers

Causa provável:

- não há linha ativa em `sienge_credentials`
- fallback local não configurado

### Lint falha no monorepo

Sintoma:

- `pnpm -r run lint` interrompe em algum workspace

Causa:

- verificar se há `no-explicit-any`, `no-unused-vars` ou erros de React hooks
- erros de catch devem usar `catch (e: unknown)` com `getApiErrorMessage()` de `src/lib/error-utils.ts`
- todos os workspaces passam lint desde `2026-04-19`

### Testes de integração live do Sienge

Requisito:

- variáveis reais de Sienge configuradas
- ambiente com acesso externo disponível

Referências:

- `docs/runbooks/sienge-homologation.md`
- `docs/runbooks/prd-07-remediation-log-2026-04-17.md`

## 10. Deploy

- Pipeline de segurança (`security.yml`): pnpm audit, gitleaks, dependency review
- **Hostinger** (duas Node.js Apps — API + workers): na raiz do repo, `pnpm run build:api` e `pnpm run build:workers` geram `apps/api/dist/hostinger-entry.js` e `workers/dist/hostinger-entry.js`; arranque com `pnpm run start:api` / `pnpm run start:workers`. Runbook: [`deploy-hostinger.md`](deploy-hostinger.md). Exemplos de variáveis: `deploy/compose/api.env.example` e `deploy/compose/workers.env.example`.

## 11. Observações operacionais

- arquivos `.env` com segredos não devem ser commitados; tratar qualquer credencial já exposta como comprometida
- para homologação externa do Sienge, use os artefatos em `docs/runbooks/`
