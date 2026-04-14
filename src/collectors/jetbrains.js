'use strict';

const { fetchWithRetry, sleep } = require('../utils');

async function collectTool(pluginId) {
  const url = `https://plugins.jetbrains.com/api/plugins/${pluginId}/`;
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'HarnessPulse/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  await sleep(200);
  return {
    downloads: data.downloads ?? null,
    rating: data.rating ?? null,
    votes: data.votes ?? null
  };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.jetbrains) continue;
    try {
      console.log(`[jetbrains] Collecting ${tool.jetbrains}...`);
      results[tool.slug] = await collectTool(tool.jetbrains);
    } catch (err) {
      console.error(`[jetbrains] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
