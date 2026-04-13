#!/usr/bin/env bash
# Deploy site/ to nginx-served directory
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$SCRIPT_DIR/../site"
DEPLOY_DIR="/var/www/harness-pulse"

rsync -a --delete "$SITE_DIR/" "$DEPLOY_DIR/"
echo "[deploy] Deployed to $DEPLOY_DIR"
