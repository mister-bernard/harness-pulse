'use strict';

const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const MILESTONES_FILE = path.join(__dirname, '..', 'data', 'milestones.json');

// Milestone thresholds to watch per signal
const THRESHOLDS = {
  'github.stars':               [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
  'downloads.weekly_downloads': [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
  'vscode.installs':            [100000, 500000, 1000000, 5000000, 10000000, 50000000],
  'jetbrains.downloads':        [50000, 100000, 500000, 1000000, 5000000],
};

const SIGNAL_LABELS = {
  'github.stars':               '⭐ GitHub stars',
  'downloads.weekly_downloads': '📦 weekly downloads',
  'vscode.installs':            '🔌 VS Code installs',
  'jetbrains.downloads':        '🧩 JetBrains downloads',
};

function loadMilestones() {
  try { return JSON.parse(fs.readFileSync(MILESTONES_FILE, 'utf8')); }
  catch { return {}; }
}

function saveMilestones(data) {
  fs.writeFileSync(MILESTONES_FILE, JSON.stringify(data, null, 2));
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj) ?? null;
}

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return String(n);
}

async function checkMilestones(data) {
  const milestones = loadMilestones();
  const crossed = [];

  for (const tool of data.tools) {
    for (const [signal, thresholds] of Object.entries(THRESHOLDS)) {
      const value = getNestedValue(tool, signal);
      if (value == null) continue;

      const key = `${tool.slug}:${signal}`;
      const lastRecorded = milestones[key] ?? 0;

      for (const threshold of thresholds) {
        if (value >= threshold && lastRecorded < threshold) {
          crossed.push({ tool, signal, threshold, value });
          milestones[key] = value;
        }
      }
      // Always update to latest
      if (value > lastRecorded) milestones[key] = value;
    }
  }

  saveMilestones(milestones);
  return crossed;
}

async function tweetMilestone(milestone) {
  const { tool, signal, threshold } = milestone;
  const label = SIGNAL_LABELS[signal] || signal;
  const num = formatNumber(threshold);

  const text = `${tool.name} just crossed ${num} ${label}.

Harness Pulse — ${process.env.DASHBOARD_URL || 'https://mrb.sh/hp'}`;

  // Sanitize
  const safe = text.replace(/[^\x00-\x7F]/g, '');

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY,
      appSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
    const r = await client.v2.tweet(safe);
    console.log(`[milestones] Tweeted: ${tool.name} ${num} ${label} → ${r.data.id}`);
  } catch (err) {
    console.error(`[milestones] Tweet failed: ${err.message}`);
  }
}

async function run(data) {
  const crossed = await checkMilestones(data);
  for (const m of crossed) {
    console.log(`[milestones] 🎯 ${m.tool.name} crossed ${formatNumber(m.threshold)} ${SIGNAL_LABELS[m.signal] || m.signal}`);
    await tweetMilestone(m);
  }
  return crossed;
}

module.exports = { run };
