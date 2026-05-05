# Deploy na Hostinger (API + workers)

Runbook para **duas Node.js Apps** no painel Hostinger (Phusion Passenger), com código em **bundles Node 20** e bases em **Supabase** (Postgres + Auth). Filas **pg-boss** usam o mesmo Postgres da connection string (`DATABASE_URL`) — não é necessário Redis.

Referências: [`deploy/README.md`](../../deploy/README.md), [`docs/architecture.md`](../architecture.md).

## Hostinger «Setup Node.js App» (2 apps)

Duas aplicações Node.js independentes no painel (Phusion Passenger): uma para a **API** e outra para os **workers**. TLS e roteamento público ficam a cargo da Hostinger.

### Pré-requisitos

- Node.js **20** disponível no painel (alinhado ao target dos bundles em [`scripts/build-hostinger-api.mjs`](../../scripts/build-hostinger-api.mjs) e [`scripts/build-hostinger-workers.mjs`](../../scripts/build-hostinger-workers.mjs)).
- Projeto Supabase com migrações aplicadas ([typecheck-and-supabase-types.md](./typecheck-and-supabase-types.md)).
- **Duas** Node.js Apps (ex.: `api.seudominio.com` e `workers.seudominio.com`) conforme o produto.

### Layout sugerido

| App no painel | Command start                           | Bundle gerado                                                                                                          |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| API           | `node apps/api/dist/hostinger-entry.js` | [`scripts/build-hostinger-api.mjs`](../../scripts/build-hostinger-api.mjs) → `apps/api/dist/hostinger-entry.js`        |
| Workers       | `node workers/dist/hostinger-entry.js`  | [`scripts/build-hostinger-workers.mjs`](../../scripts/build-hostinger-workers.mjs) → `workers/dist/hostinger-entry.js` |

A raiz do repositório no servidor deve conter os caminhos relativos acima após o build (ou upload dos artefactos).

### Variáveis de ambiente

Reutilize os exemplos [`deploy/compose/api.env.example`](../../deploy/compose/api.env.example) e [`deploy/compose/workers.env.example`](../../deploy/compose/workers.env.example).

- **`PORT`**: injetado pelo Passenger — **não** defina manualmente no painel salvo instrução contrária da Hostinger. A API ([`apps/api/src/server.ts`](../../apps/api/src/server.ts)) e os workers ([`workers/src/index.ts`](../../workers/src/index.ts)) usam `PORT` quando presente (workers: preferência sobre `WORKER_METRICS_PORT`).
- **`HOST`**: opcional; default `0.0.0.0` no servidor HTTP de métricas dos workers ([`workers/src/observability.ts`](../../workers/src/observability.ts)).
- **`DATABASE_URL`**: obrigatório na API (para pg-boss send-only) e nos workers (para `boss.start()`). Use **Direct** ou **Session pooler** do Supabase — evitar Transaction pooler (`6543`) para pg-boss (ver secção _Connection string Postgres_ abaixo).

### Build no servidor ou artefacto CI

Ordem de robustez:

1. **Artefacto pré-compilado:** workflows **Hostinger API bundle artifact** ([`.github/workflows/hostinger-api-bundle-artifact.yml`](../../.github/workflows/hostinger-api-bundle-artifact.yml)) e **Hostinger workers bundle artifact** ([`.github/workflows/hostinger-workers-bundle-artifact.yml`](../../.github/workflows/hostinger-workers-bundle-artifact.yml)), disparo manual → transferir `apps/api/dist/*` e `workers/dist/*` para o host.
2. **Git Deploy / pipeline do painel:** na raiz do repo, `pnpm install --frozen-lockfile` e `pnpm run build` (gera API + workers) ou `pnpm run build:api` / `pnpm run build:workers` isoladamente. Em FS com `noexec`, o script cai em **esbuild-wasm** automaticamente; pode forçar `HOSTINGER_ESBUILD_WASM=1` no ambiente de build.
3. **Build local + upload** (`rsync`/FTP) dos ficheiros em `apps/api/dist/` e `workers/dist/`.

### Webhooks Sienge

Configure a URL pública da **API**: `https://api.<domínio>/webhooks/sienge` (ajuste ao hostname real da app API).

### Risco: idle shutdown dos workers

O processo dos workers recebe pouco tráfego HTTP (apenas `/health`, `/ready`, `/metrics`). O Passenger pode **hibernar** a app e os crons pg-boss (`*/15 * * * *`, diários, etc.) deixam de correr.

Mitigações:

- Se o painel expuser **manter instância(s) ativas** ou equivalente (`passenger_min_instances`), ativar para a app workers.
- Caso contrário: **ping HTTP externo** (ex.: a cada 5 minutos) para `https://workers.<domínio>/health` (UptimeRobot, cron cloud, etc.).
- Pós-deploy: `curl https://workers.<domínio>/health`, `/ready` e validar logs com `pg-boss started successfully`.

### Verificação remota

```bash
BASE_URL=https://api.<domínio> ./deploy/scripts/smoke-api.sh
WORKERS_HEALTH_URL=https://workers.<domínio>/health ./deploy/scripts/smoke-workers.sh
```

---

## Ambiente de hospedagem

| Indício                                                            | Ambiente provável                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Caminho de build contém `public_html`, `.builds/source/repository` | Hospedagem web partilhada (Git Deploy / painel) — use bundles + `esbuild-wasm` se necessário                                    |
| VPS ou VM própria sem Passenger                                    | Pode usar `pnpm run start:api` / `start:workers` com variáveis de ambiente; este runbook foca-se no fluxo Hostinger Node.js App |

## Connection string Postgres (`DATABASE_URL`)

- Deve ser o **mesmo** projeto indicado por `SUPABASE_URL`.
- Preferir **Direct connection** ou **Session pooler** do Supabase. Evitar **Transaction pooler** (porta típica `6543`) para API e workers — conexões longas do pg-boss não são adequadas ao modo transação.
- Incluir `sslmode=require` na URL quando aplicável.

Obter no painel Supabase: **Project Settings → Database**.

## Variáveis de ambiente (resumo)

| Variável                               | API | Workers  | Notas                                                                                                        |
| -------------------------------------- | :-: | :------: | ------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                             | sim |   sim    | `production`                                                                                                 |
| `PORT` / `HOST`                        | sim |   sim    | Passenger injeta `PORT`; API default local `3000`; workers: `PORT` ou `WORKER_METRICS_PORT` → default `9080` |
| `SUPABASE_URL`                         | sim |   sim    | URL do projeto                                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`            | sim |   sim    | Service role                                                                                                 |
| `DATABASE_URL`                         | sim |   sim    | Postgres compatível com pg-boss                                                                              |
| `JWT_SECRET`                           | sim |    —     |                                                                                                              |
| `SIENGE_BASE_URL`                      | sim |   sim    |                                                                                                              |
| `SIENGE_API_KEY` / `SIENGE_API_SECRET` | sim |   sim    |                                                                                                              |
| `SIENGE_WEBHOOK_SECRET`                | sim |    —     | Validação inbound                                                                                            |
| `SIENGE_ENCRYPTION_KEY`                | sim |   sim    |                                                                                                              |
| `EMAIL_PROVIDER_API_KEY`               | sim |   sim    | Resend                                                                                                       |
| `EMAIL_FROM_ADDRESS`                   | sim |   sim    |                                                                                                              |
| `FRONTEND_URL`                         | sim |    —     | Links em e-mails                                                                                             |
| `COMPRAS_EMAIL`                        | sim |   sim    |                                                                                                              |
| `WORKER_METRICS_PORT`                  |  —  | opcional | Fallback se `PORT` ausente (dev local); default `9080`                                                       |

## Workers e réplicas

Manter **uma** réplica do serviço `workers` — os crons pg-boss usam `singletonKey`, mas múltiplas instâncias aumentam risco operacional.

## Verificação pós-deploy (local ao processo)

Se tiver acesso HTTP direto à API e ao endpoint de health dos workers:

```bash
BASE_URL=http://127.0.0.1:3000 ./deploy/scripts/smoke-api.sh
SMOKE_INCLUDE_DOCS=1 BASE_URL=http://127.0.0.1:3000 ./deploy/scripts/smoke-api.sh
WORKERS_HEALTH_URL=http://127.0.0.1:9080/health ./deploy/scripts/smoke-workers.sh
```

(Ajuste portas conforme o ambiente.)

Checklist adicional:

1. `GET /health` e Swagger `/docs` na URL pública da API.
2. Login `POST /api/auth/login` com utilizador real.
3. Webhook Sienge (teste controlado) em `/webhooks/sienge`.
4. Logs da app workers no painel — mensagem `pg-boss started successfully`.
5. E-mail (Resend) num fluxo que dispare `notification:send-email`.

## Troubleshooting

### Log de build mostra `hostinger-entry.js` e `Done`, mas o deploy falha

Na hospedagem partilhada (`public_html` / `.builds`), o passo `pnpm run build` pode terminar com sucesso enquanto o painel ainda reporta falha. Para isolar a causa:

1. Copie o **log completo** até ao fim do pipeline (inclui exit code ou última linha de erro).
2. Confirme o comando **start** configurado (deve apontar para o bundle — API: `node apps/api/dist/hostinger-entry.js`; workers: `node workers/dist/hostinger-entry.js` na raiz do repositório após o build, ou o caminho equivalente que o painel usa).
3. Verifique a **versão do Node** no host (o bundle usa target Node 20 — ver [`scripts/build-hostinger-api.mjs`](../../scripts/build-hostinger-api.mjs)).
4. Ignore como falha os avisos `WARN … peer dependencies` ou `5.3mb ⚠️` do esbuild (bundle grande): não impedem o build; falhas reais costumam estar no arranque da API ou num passo seguinte ao bundle.

- **API sem pg-boss:** `DATABASE_URL` vazio na API → logs avisam; jobs assíncronos não são enfileirados.
- **Workers não sobem:** validar `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; inspecionar logs stdout/stderr no painel.

### EACCES no esbuild durante `pnpm run build` (hospedagem partilhada)

Sintoma: `Error: spawnSync .../node_modules/.../bin/esbuild EACCES` (ou `execFileSync` equivalente) ao correr o script [`scripts/build-hostinger-api.mjs`](../../scripts/build-hostinger-api.mjs).

**Causa:** o SO recusa **executar** o binário nativo do esbuild nesse volume (p.ex. montagem `noexec` em `public_html` / `.builds`). Ajustar `chmod` não contorna `noexec`.

**Opções:**

1. **Automático / WebAssembly:** o script tenta o binário nativo e, em caso de `EACCES`, passa para o pacote **`esbuild-wasm`** (CLI via `node`), que faz o bundle com WebAssembly e não precisa marcar o binário GO como executável no disco. Opcionalmente forçar apenas WASM: definir **`HOSTINGER_ESBUILD_WASM=1`** na variável de ambiente do build no painel.
2. **Artefacto pré-compilado (CI):** workflows [**Hostinger API bundle artifact**](../../.github/workflows/hostinger-api-bundle-artifact.yml) e [**Hostinger workers bundle artifact**](../../.github/workflows/hostinger-workers-bundle-artifact.yml) (`workflow_dispatch`) — `pnpm run build:api` / `pnpm run build:workers`, upload dos `dist/` correspondentes. Copie para o servidor e evite rodar esbuild lá.

**Confirmar montagem no servidor (SSH):**

```bash
mount | grep -E 'builds|public_html|domains' || true
stat -c '%a %n' node_modules/.pnpm/@esbuild+*/node_modules/@esbuild/*/bin/esbuild 2>/dev/null | head -1
```

Se as permissões forem executáveis (ex.: `755`) e o erro persistir, reforça a hipótese de **`noexec`** ou política equivalente no host.
