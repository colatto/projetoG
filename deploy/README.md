# Deploy

## VPS (Docker Compose — ex. Hostinger)

Ficheiros em [`deploy/compose/`](compose/):

- [`docker-compose.prod.yml`](compose/docker-compose.prod.yml) — API (`127.0.0.1:3000`) + workers (`127.0.0.1:9080`)
- [`compose.env.example`](compose/compose.env.example) — tags das imagens GHCR
- [`api.env.example`](compose/api.env.example) / [`workers.env.example`](compose/workers.env.example) — variáveis sensíveis (copiar para `api.env` / `workers.env` na VPS)

Runbook detalhado: [`docs/runbooks/deploy-hostinger.md`](../docs/runbooks/deploy-hostinger.md).

Scripts: [`deploy/scripts/`](scripts/) (`deploy-vps.sh`, smoke).

## Kubernetes

Os manifests em `deploy/k8s` assumem:

- imagens `ghcr.io/example-org/example-repo-api` e `ghcr.io/example-org/example-repo-workers` (substituir pelo seu `ghcr.io/<github_owner>/<github_repo>-api|workers` ou usar `images:` em [`kustomization.yaml`](k8s/kustomization.yaml))
- Kubernetes com Prometheus scraping via annotations
- secrets injetados via `Secret` e variáveis não sensíveis via `ConfigMap`

Build local:

```bash
docker build -f apps/api/Dockerfile -t projetog-api:local .
docker build -f workers/Dockerfile -t projetog-workers:local .
```

Aplicação:

```bash
kubectl apply -k deploy/k8s
```
