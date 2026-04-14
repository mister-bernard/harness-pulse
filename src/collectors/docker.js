'use strict';

const { fetchWithRetry, sleep } = require('../utils');

async function collectTool(image) {
  const [namespace, repo] = image.split('/');
  const url = `https://hub.docker.com/v2/repositories/${namespace}/${repo}/`;
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'HarnessPulse/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  await sleep(300);
  return {
    pull_count: data.pull_count ?? null,
    star_count: data.star_count ?? null,
    last_updated: data.last_updated ?? null
  };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.docker) continue;
    try {
      console.log(`[docker] Collecting ${tool.docker}...`);
      results[tool.slug] = await collectTool(tool.docker);
    } catch (err) {
      console.error(`[docker] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
