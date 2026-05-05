#!/usr/bin/env bash
# Pull GHCR images e reinicia stack Compose na VPS (directório deploy/compose).
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../compose" && pwd)"
cd "$COMPOSE_DIR"

ENV_FILE="${COMPOSE_ENV_FILE:-compose.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy compose.env.example and set API_IMAGE / WORKERS_IMAGE." >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" pull
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d

echo "Compose stack updated. API http://127.0.0.1:3000 workers health http://127.0.0.1:9080/health"
