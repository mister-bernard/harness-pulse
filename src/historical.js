'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');
const LATEST_FILE = path.join(DATA_DIR, 'latest.json');

function ensureDirs() {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function snapshotPath(dateKey) {
  return path.join(SNAPSHOTS_DIR, `${dateKey}.json`);
}

function loadSnapshot(dateKey) {
  const p = snapshotPath(dateKey);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function loadLatest() {
  if (!fs.existsSync(LATEST_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Returns previous snapshots needed for delta calculations.
 * { '7d': snapshot|null, '30d': snapshot|null }
 */
function loadPreviousSnapshots() {
  const now = new Date();
  const key7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const key30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    '7d': loadSnapshot(key7),
    '30d': loadSnapshot(key30)
  };
}

/**
 * Enriches GitHub data with star deltas from previous snapshots.
 */
function enrichStarDeltas(data, previousData) {
  const prev7 = previousData['7d'];
  if (!prev7) return data;

  const enriched = data.tools.map(tool => {
    if (!tool.github) return tool;
    const prev = prev7.tools?.find(t => t.slug === tool.slug);
    const stars_delta_7d = (prev?.github?.stars != null && tool.github?.stars != null)
      ? tool.github.stars - prev.github.stars
      : null;
    return {
      ...tool,
      github: { ...tool.github, stars_delta_7d }
    };
  });

  return { ...data, tools: enriched };
}

/**
 * Get 30 days of momentum scores for trend chart.
 */
function loadTrendHistory(slugs) {
  ensureDirs();
  const history = {}; // slug → [{ date, score }, ...]
  for (const slug of slugs) history[slug] = [];

  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
    .sort()
    .slice(-30);

  for (const file of files) {
    const date = file.replace('.json', '');
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, file), 'utf8'));
      for (const tool of (snap.tools || [])) {
        if (history[tool.slug] !== undefined && tool.momentum_score != null) {
          history[tool.slug].push({ date, score: tool.momentum_score });
        }
      }
    } catch {
      // skip corrupt files
    }
  }

  return history;
}

/**
 * Validates snapshot data before saving.
 * Returns { valid: bool, errors: [...] }
 */
function validate(data, previousData) {
  const errors = [];
  const prev = previousData['7d'];

  for (const tool of data.tools) {
    // Stars should never decrease
    if (tool.github?.stars != null && prev) {
      const prevTool = prev.tools?.find(t => t.slug === tool.slug);
      if (prevTool?.github?.stars != null && tool.github.stars < prevTool.github.stars * 0.9) {
        errors.push(`${tool.slug}: stars dropped from ${prevTool.github.stars} to ${tool.github.stars} (>10% drop suggests API error)`);
      }
    }

    // Downloads should be non-negative
    if (tool.downloads?.weekly_downloads != null && tool.downloads.weekly_downloads < 0) {
      errors.push(`${tool.slug}: negative weekly downloads`);
    }

    // Scores should be 0-100
    if (tool.momentum_score != null && (tool.momentum_score < 0 || tool.momentum_score > 100)) {
      errors.push(`${tool.slug}: score ${tool.momentum_score} out of range`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function saveSnapshot(data) {
  ensureDirs();
  const key = todayKey();
  const snapPath = snapshotPath(key);

  // Don't overwrite today's snapshot if it already exists (only first run of day saves)
  if (fs.existsSync(snapPath)) {
    console.log(`[historical] Snapshot for ${key} already exists, updating.`);
  }

  fs.writeFileSync(snapPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(LATEST_FILE, JSON.stringify(data, null, 2));
  console.log(`[historical] Saved snapshot: ${key}`);
}

module.exports = {
  loadLatest,
  loadPreviousSnapshots,
  enrichStarDeltas,
  loadTrendHistory,
  saveSnapshot,
  validate
};
