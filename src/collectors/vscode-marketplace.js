'use strict';

const { fetchWithRetry, sleep } = require('../utils');

const GALLERY_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

async function collectTool(extensionId) {
  console.log(`[vscode] Collecting ${extensionId}...`);

  const res = await fetchWithRetry(GALLERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json;api-version=7.2-preview.1',
      'User-Agent': 'HarnessPulse/1.0'
    },
    body: JSON.stringify({
      filters: [{
        criteria: [{ filterType: 7, value: extensionId }],
        pageSize: 1,
        pageNumber: 1
      }],
      flags: 914
    })
  });

  if (!res.ok) return null;
  const data = await res.json();
  const ext = data?.results?.[0]?.extensions?.[0];
  if (!ext) return null;

  const stats = {};
  for (const s of (ext.statistics || [])) {
    stats[s.statisticName] = s.value;
  }

  await sleep(300);
  return {
    installs: Math.round(stats.install ?? 0),
    average_rating: stats.averagerating ?? null,
    rating_count: Math.round(stats.ratingcount ?? 0),
    update_count: Math.round(stats.updateCount ?? 0)
  };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.vscode) continue;
    try {
      results[tool.slug] = await collectTool(tool.vscode);
    } catch (err) {
      console.error(`[vscode] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
