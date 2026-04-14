'use strict';

const googleTrends = require('google-trends-api');
const { sleep } = require('../utils');

async function fetchTrend(keyword) {
  const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const raw = await googleTrends.interestOverTime({ keyword, startTime });
  const data = JSON.parse(raw);
  const points = data.default?.timelineData || [];
  if (!points.length) return null;

  const values = points.map(p => p.value?.[0] ?? 0);
  const avg7d = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const avg30d = values.reduce((a, b) => a + b, 0) / values.length;
  const latest = values[values.length - 1];
  await sleep(1000); // Google Trends rate limit
  return { avg_7d: Math.round(avg7d), avg_30d: Math.round(avg30d), latest, points: values };
}

const QUERY_OVERRIDES = {
  'github-copilot': 'GitHub Copilot',
  'codex-cli': 'OpenAI Codex',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'openhands': 'OpenHands AI',
};

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    try {
      const keyword = QUERY_OVERRIDES[tool.slug] || tool.name;
      console.log(`[trends] Collecting "${keyword}"...`);
      results[tool.slug] = await fetchTrend(keyword);
    } catch (err) {
      // Google Trends often throttles — non-fatal
      console.warn(`[trends] Skipped ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
