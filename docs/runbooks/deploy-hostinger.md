# Deploy na Hostinger (API + workers via GitHub)

Runbook para VPS Hostinger com Docker Compose, imagens no GHCR e bases em **Supabase** (Postgres + Auth). Filas **pg-boss** usam o mesmo Postgres da connection string (`DATABASE_URL`) — não é necessário Redis.

Referências: [`deploy/README.md`](../../deploy/README.md), [`docs/architecture.md`](../architecture.md).

## Ambiente: VPS com Docker vs hospedagem partilhada

| Indício                                                             | Ambiente provável                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Caminho de build contém `public_html`, `.builds/source/repository`  | Hospedagem web partilhada (Git Deploy / painel), **não** o fluxo Docker deste runbook |
| SSH para máquina com Docker, stack em `/opt/...` + `docker compose` | **VPS** — alinhado a este documento                                                   |

Recomendação de produto: **API e workers em VPS com Docker** (imagens GHCR + workflow abaixo). Rodar `pnpm run build` na árvore `public_html` da partilhada costuma falhar ao executar binários nativos (ver secção _Troubleshooting → EACCES no esbuild_).

## Pré-requisitos

- Repositório GitHub com Actions a construir imagens ([`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) → `ghcr.io/<owner>/<repo>-api` e `-workers`).
- Projeto Supabase com migrações aplicadas ([typecheck-and-supabase-types.md](./typecheck-and-supabase-types.md)).
- VPS Hostinger com **Docker** e **Docker Compose v2** (template Docker da Hostinger ou equivalente).
- Domínio (opcional mas recomendado) com DNS apontando para o IP da VPS — para HTTPS e webhooks Sienge.

## Connection string Postgres (`DATABASE_URL`)

- Deve ser o **mesmo** projeto indicado por `SUPABASE_URL`.
- Preferir **Direct connection** ou **Session pooler** do Supabase. Evitar **Transaction pooler** (porta típica `6543`) para API e workers — conexões longas do pg-boss não são adequadas ao modo transação.
- Incluir `sslmode=require` na URL quando aplicável.

Obter no painel Supabase: **Project Settings → Database**.

## Preparação na VPS (primeira vez)

1. Criar diretório (exemplo):

   ```bash
   sudo mkdir -p /opt/projetoG/deploy/compose /opt/projetoG/deploy/scripts
   sudo chown -R "$USER:$USER" /opt/projetoG
   ```

2. Copiar para `/opt/projetoG/deploy/compose`:
   - `docker-compose.prod.yml` do repositório ([`deploy/compose/docker-compose.prod.yml`](../../deploy/compose/docker-compose.prod.yml))
   - `compose.env` — a partir de [`deploy/compose/compose.env.example`](../../deploy/compose/compose.env.example) com tags GHCR corretas
   - `api.env` — a partir de [`deploy/compose/api.env.example`](../../deploy/compose/api.env.example)
   - `workers.env` — a partir de [`deploy/compose/workers.env.example`](../../deploy/compose/workers.env.example)

3. Garantir que **ninguém comita** `compose.env`, `api.env`, `workers.env` (estão no [`.gitignore`](../../.gitignore)).

4. Reverse proxy (recomendado): **Caddy** ou **Nginx** na VPS escutando `443`, proxy para `http://127.0.0.1:3000`. URL pública dos webhooks Sienge: `https://<domínio>/webhooks/sienge`.

5. Firewall: expor apenas `80`/`443` (e SSH). Portas `3000` e `9080` ficam em **127.0.0.1** apenas (já definido no Compose).

## Variáveis de ambiente

| Variável                               | API | Workers  | Notas                           |
| -------------------------------------- | :-: | :------: | ------------------------------- |
| `NODE_ENV`                             | sim |   sim    | `production`                    |
| `PORT` / `HOST`                        | sim |    —     | API default `3000`, `0.0.0.0`   |
| `SUPABASE_URL`                         | sim |   sim    | URL do projeto                  |
| `SUPABASE_SERVICE_ROLE_KEY`            | sim |   sim    | Service role                    |
| `DATABASE_URL`                         | sim |   sim    | Postgres compatível com pg-boss |
| `JWT_SECRET`                           | sim |    —     |                                 |
| `SIENGE_BASE_URL`                      | sim |   sim    |                                 |
| `SIENGE_API_KEY` / `SIENGE_API_SECRET` | sim |   sim    |                                 |
| `SIENGE_WEBHOOK_SECRET`                | sim |    —     | Validação inbound               |
| `SIENGE_ENCRYPTION_KEY`                | sim |   sim    |                                 |
| `EMAIL_PROVIDER_API_KEY`               | sim |   sim    | Resend                          |
| `EMAIL_FROM_ADDRESS`                   | sim |   sim    |                                 |
| `FRONTEND_URL`                         | sim |    —     | Links em e-mails                |
| `COMPRAS_EMAIL`                        | sim |   sim    |                                 |
| `WORKER_METRICS_PORT`                  |  —  | opcional | Default `9080`                  |

## CI/CD GitHub → VPS

### Build e push das imagens

- Push para `main` ou **workflow_dispatch** em **Deploy** ([`deploy.yml`](../../.github/workflows/deploy.yml)): constrói e envia para GHCR.

### Atualização automática na VPS

Workflow **Deploy Hostinger VPS** ([`deploy-hostinger.yml`](../../.github/workflows/deploy-hostinger.yml)):

- Disparo manual: **Actions → Deploy Hostinger VPS → Run workflow**.

Secrets recomendados:

| Secret            | Descrição                                                 |
| ----------------- | --------------------------------------------------------- |
| `VPS_HOST`        | Hostname ou IP da VPS                                     |
| `VPS_USER`        | Utilizador SSH                                            |
| `VPS_SSH_KEY`     | Chave privada SSH (full PEM)                              |
| `VPS_COMPOSE_DIR` | Opcional; default `/opt/projetoG/deploy/compose`          |
| `GHCR_USERNAME`   | Utilizador GitHub para `docker login`                     |
| `GHCR_PULL_TOKEN` | PAT com `read:packages` se as imagens GHCR forem privadas |

Ordem operacional típica: correr **Deploy** (imagens novas) → correr **Deploy Hostinger VPS** (pull + up).

### Atualização manual na VPS

```bash
export COMPOSE_ENV_FILE=compose.env
./deploy/scripts/deploy-vps.sh
```

Certifique-se de que `compose.env` define `API_IMAGE` e `WORKERS_IMAGE`.

## Workers e réplicas

Manter **uma** réplica do serviço `workers` — os crons pg-boss usam `singletonKey`, mas múltiplas instâncias aumentam risco operacional.

## Verificação pós-deploy

Na VPS:

```bash
BASE_URL=http://127.0.0.1:3000 ./deploy/scripts/smoke-api.sh
SMOKE_INCLUDE_DOCS=1 BASE_URL=http://127.0.0.1:3000 ./deploy/scripts/smoke-api.sh
WORKERS_HEALTH_URL=http://127.0.0.1:9080/health ./deploy/scripts/smoke-workers.sh
```

Checklist adicional:

1. `GET /health` e Swagger `/docs` atrás do proxy HTTPS.
2. Login `POST /api/auth/login` com utilizador real.
3. Webhook Sienge (teste controlado) em `/webhooks/sienge`.
4. Logs: `docker compose -f docker-compose.prod.yml logs -f workers` — mensagem `pg-boss started successfully`.
5. E-mail (Resend) num fluxo que dispare `notification:send-email`.

## Kubernetes

Se usar cluster externo (não Hostinger VPS), ver manifests em [`deploy/k8s`](../../deploy/k8s) e substituir `ghcr.io/example-org/example-repo-*` pelas imagens reais ou usar o bloco comentado `images:` em `kustomization.yaml`.

## Troubleshooting

- **API sem pg-boss:** `DATABASE_URL` vazio na API → logs avisam; jobs assíncronos não são enfileirados.
- **Workers não sobem:** validar `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; inspecionar `docker compose logs workers`.
- **401/403 GHCR no pull:** configurar `GHCR_USERNAME` + `GHCR_PULL_TOKEN` no workflow ou fazer `docker login ghcr.io` manualmente na VPS.

### EACCES no esbuild durante `pnpm run build` (hospedagem partilhada)

Sintoma: `Error: spawnSync .../node_modules/.../bin/esbuild EACCES` (ou `execFileSync` equivalente) ao correr o script [`scripts/build-hostinger-api.mjs`](../../scripts/build-hostinger-api.mjs).

**Causa:** o SO recusa **executar** o binário nativo do esbuild nesse volume (p.ex. montagem `noexec` em `public_html` / `.builds`). Ajustar `chmod` não contorna `noexec`.

**Opções:**

1. **Automático / WebAssembly:** o script tenta o binário nativo e, em caso de `EACCES`, passa para o pacote **`esbuild-wasm`** (CLI via `node`), que faz o bundle com WebAssembly e não precisa marcar o binário GO como executável no disco. Opcionalmente forçar apenas WASM: definir **`HOSTINGER_ESBUILD_WASM=1`** na variável de ambiente do build no painel.
2. **Artefacto pré-compilado (CI):** workflow [**Hostinger API bundle artifact**](../../.github/workflows/hostinger-api-bundle-artifact.yml) (`workflow_dispatch`) — corre `pnpm run build`, faz upload de `apps/api/dist/hostinger-entry.js` e `apps/api/dist/package.json`. Copie para o servidor e evite rodar esbuild lá.
3. **VPS + Docker:** manter este runbook principal — imagens construídas no GitHub Actions sem depender da pasta `public_html`.

**Confirmar montagem no servidor (SSH):**

```bash
mount | grep -E 'builds|public_html|domains' || true
stat -c '%a %n' node_modules/.pnpm/@esbuild+*/node_modules/@esbuild/*/bin/esbuild 2>/dev/null | head -1
```

Se as permissões forem executáveis (ex.: `755`) e o erro persistir, reforça a hipótese de **`noexec`** ou política equivalente no host.
