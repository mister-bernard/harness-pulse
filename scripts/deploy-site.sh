#!/usr/bin/env bash
# Deploy site/ to nginx + GitHub Pages (gh-pages branch)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."
SITE_DIR="$REPO_DIR/site"
DEPLOY_DIR="/var/www/harness-pulse"

# 1. Deploy to local nginx
rsync -a --delete "$SITE_DIR/" "$DEPLOY_DIR/"
echo "[deploy] Deployed to $DEPLOY_DIR"

# 2. Push to GitHub Pages (gh-pages branch)
cd "$REPO_DIR"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Stash any working changes on main
git stash --quiet 2>/dev/null || true

# Switch to gh-pages, update, commit, push
git checkout gh-pages --quiet

# Copy built files
cp "$SITE_DIR/index.html" index.html
cp "$SITE_DIR/style.css" style.css 2>/dev/null || true
cp "$SITE_DIR/feed.xml" feed.xml
mkdir -p api
cp "$SITE_DIR/api/latest.json" api/latest.json

git add index.html style.css feed.xml api/latest.json 2>/dev/null || true
git diff --cached --quiet || git commit -m "Deploy: $(date +%Y-%m-%d)"
git push origin gh-pages --quiet
echo "[deploy] Pushed to GitHub Pages"

# Return to original branch
git checkout "$CURRENT_BRANCH" --quiet
git stash pop --quiet 2>/dev/null || true
