# Deploy

Os manifests em `deploy/k8s` assumem:

- imagens `ghcr.io/<owner>/projetog-api` e `ghcr.io/<owner>/projetog-workers`
- Kubernetes com Prometheus scraping via annotations
- secrets injetados via `Secret` e variáveis não sensíveis via `ConfigMap`

Build local:

```bash
docker build -f apps/api/Dockerfile -t projetog-api:local .
docker build -f workers/Dockerfile -t projetog-workers:local .
```

Aplicação:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/
```
