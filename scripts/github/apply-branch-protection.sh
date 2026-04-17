#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI não encontrado." >&2
  exit 1
fi

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "Defina GITHUB_REPOSITORY no formato owner/repo." >&2
  exit 1
fi

BRANCH="${1:-main}"

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/${GITHUB_REPOSITORY}/branches/${BRANCH}/protection" \
  -f required_status_checks.strict=true \
  -F required_status_checks.contexts[]="Build, Lint and Test" \
  -F required_status_checks.contexts[]="Audit and Secret Scan" \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=false \
  -f required_pull_request_reviews.required_approving_review_count=2 \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f restrictions=
