'use strict';

const { fetchWithRetry, sleep } = require('../utils');

// Search terms that match SO question titles
const QUERY_OVERRIDES = {
  'github-copilot': 'github copilot',
  'codex-cli': 'openai codex',
  'gemini-cli': 'gemini cli',
  'openhands': 'openhands AI',
};

async function fetchSOCount(query) {
  const q = encodeURIComponent(query);
  const url = `https://api.stackexchange.com/2.3/search?intitle=${q}&site=stackoverflow&pagesize=1&filter=total`;
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'HarnessPulse/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  await sleep(200); // SO free tier: 300 req/day
  return data.total ?? null;
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    try {
      const query = QUERY_OVERRIDES[tool.slug] || tool.name;
      console.log(`[stackoverflow] Collecting "${query}"...`);
      const total = await fetchSOCount(query);
      results[tool.slug] = total !== null ? { total_questions: total } : null;
    } catch (err) {
      console.error(`[stackoverflow] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
