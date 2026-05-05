# Deploy

Produção da API e dos **workers** segue o runbook **Hostinger «Setup Node.js App»**: dois bundles CJS Node 20 (`hostinger-entry.js`) gerados na raiz do monorepo.

## Ficheiros úteis

Em [`deploy/compose/`](compose/):

- [`api.env.example`](compose/api.env.example) / [`workers.env.example`](compose/workers.env.example) — variáveis para copiar para o painel (não commitar ficheiros com segredos reais).
- [`compose.env.example`](compose/compose.env.example) — nota histórica; o repo não mantém Docker Compose.

Runbook: [`docs/runbooks/deploy-hostinger.md`](../docs/runbooks/deploy-hostinger.md).

Scripts: [`deploy/scripts/`](scripts/) (`smoke-api.sh`, `smoke-workers.sh`).

## Bundles e CI

Na raiz do repositório:

```bash
pnpm run build:api
pnpm run build:workers
pnpm run start:api    # após configurar env
pnpm run start:workers
```

Artefactos pré-compilados (GitHub Actions, disparo manual): `hostinger-api-bundle-artifact.yml` e `hostinger-workers-bundle-artifact.yml`.
