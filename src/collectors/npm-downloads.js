'use strict';

const { fetchWithRetry, sleep } = require('../utils');

const BASE_URL = 'https://api.npmjs.org';

async function fetchDownloads(pkg, period) {
  const url = `${BASE_URL}/downloads/point/${period}/${encodeURIComponent(pkg)}`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'HarnessPulse/1.0' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  return data.downloads;
}

async function fetchDailyDownloads(pkg) {
  const url = `${BASE_URL}/downloads/range/last-month/${encodeURIComponent(pkg)}`;
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'HarnessPulse/1.0' }
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (data.error || !Array.isArray(data.downloads)) return [];
  return data.downloads.map(d => ({ day: d.day, downloads: d.downloads }));
}

async function collectTool(pkg) {
  console.log(`[npm] Collecting ${pkg}...`);
  const [weekly, monthly, daily] = await Promise.all([
    fetchDownloads(pkg, 'last-week'),
    fetchDownloads(pkg, 'last-month'),
    fetchDailyDownloads(pkg)
  ]);
  await sleep(200);
  return { weekly_downloads: weekly, monthly_downloads: monthly, daily_downloads: daily };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.npm) continue;
    try {
      results[tool.slug] = await collectTool(tool.npm);
    } catch (err) {
      console.error(`[npm] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
