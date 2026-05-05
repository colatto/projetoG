#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

curl -fsS "${BASE_URL%/}/health" >/dev/null
echo "GET ${BASE_URL%/}/health OK"

if [[ "${SMOKE_INCLUDE_DOCS:-}" == "1" ]]; then
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL%/}/docs")"
  if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" ]]; then
    echo "GET ${BASE_URL%/}/docs unexpected status $code" >&2
    exit 1
  fi
  echo "GET ${BASE_URL%/}/docs OK ($code)"
fi
