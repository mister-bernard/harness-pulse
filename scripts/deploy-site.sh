#!/usr/bin/env bash
# Deploy site/ to nginx + GitHub Pages (gh-pages branch via worktree)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."
SITE_DIR="$REPO_DIR/site"
DEPLOY_DIR="/var/www/harness-pulse"

# 1. Deploy to local nginx
rsync -a --delete "$SITE_DIR/" "$DEPLOY_DIR/"
echo "[deploy] Deployed to $DEPLOY_DIR"

# 2. Push to GitHub Pages using a temp worktree (avoids branch-switch clobbering)
GH_PAGES_DIR=$(mktemp -d)
cleanup() { git -C "$REPO_DIR" worktree remove --force "$GH_PAGES_DIR" 2>/dev/null || true; rm -rf "$GH_PAGES_DIR"; }
trap cleanup EXIT

cd "$REPO_DIR"
git worktree add "$GH_PAGES_DIR" gh-pages --quiet

cp "$SITE_DIR/index.html"       "$GH_PAGES_DIR/index.html"
cp "$SITE_DIR/style.css"        "$GH_PAGES_DIR/style.css"
cp "$SITE_DIR/feed.xml"         "$GH_PAGES_DIR/feed.xml"
mkdir -p "$GH_PAGES_DIR/api"
cp "$SITE_DIR/api/latest.json"  "$GH_PAGES_DIR/api/latest.json"

cd "$GH_PAGES_DIR"
git add index.html style.css feed.xml api/latest.json
git diff --cached --quiet || git commit -m "Deploy: $(date +%Y-%m-%d)"
git push origin gh-pages --quiet
echo "[deploy] Pushed to GitHub Pages"
