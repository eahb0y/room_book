#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "Error: NETLIFY_AUTH_TOKEN is not set."
  echo "Run: NETLIFY_AUTH_TOKEN='your_token' ./scripts/deploy-netlify.sh"
  exit 1
fi

SITE_ID="${NETLIFY_SITE_ID:-cf06a09c-7752-4400-81c6-ff5b59595964}"
DEPLOY_DIR="${NETLIFY_DEPLOY_DIR:-dist}"
DEPLOY_MESSAGE="${NETLIFY_DEPLOY_MESSAGE:-manual deploy $(date '+%Y-%m-%d %H:%M:%S')}"

echo "Building project..."
npm run build

echo "Deploying to Netlify production..."
NETLIFY_AUTH_TOKEN="$NETLIFY_AUTH_TOKEN" npx --yes netlify deploy \
  --prod \
  --no-build \
  --dir="$DEPLOY_DIR" \
  --site="$SITE_ID" \
  --message "$DEPLOY_MESSAGE"

echo "Done."
