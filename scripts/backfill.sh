#!/usr/bin/env bash
# One-time historical data backfill.
# Runs the pipeline once per day for the past N days.
# NOTE: GitHub commit_activity stats only go back 52 weeks; stars/forks are current-only.
# This backfill populates the snapshot store so trend charts work from day 1.

set -euo pipefail
cd "$(dirname "$0")/.."

DAYS="${1:-30}"
echo "[backfill] Collecting $DAYS days of data..."

for i in $(seq "$DAYS" -1 1); do
  DATE=$(date -d "$i days ago" +%Y-%m-%d 2>/dev/null || date -v -${i}d +%Y-%m-%d)
  SNAPSHOT="data/snapshots/$DATE.json"
  if [ -f "$SNAPSHOT" ]; then
    echo "[backfill] $DATE already exists, skipping"
    continue
  fi
  echo "[backfill] Collecting for $DATE (approximated from current data)..."
  node src/run-once.js
  # Move today's snapshot to the target date
  mv "data/snapshots/$(date +%Y-%m-%d).json" "$SNAPSHOT" 2>/dev/null || true
  sleep 5
done

echo "[backfill] Done."
