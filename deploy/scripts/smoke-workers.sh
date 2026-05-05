#!/usr/bin/env bash
set -euo pipefail

WORKERS_URL="${WORKERS_HEALTH_URL:-http://127.0.0.1:9080/health}"

curl -fsS "$WORKERS_URL" >/dev/null
echo "GET $WORKERS_URL OK"
