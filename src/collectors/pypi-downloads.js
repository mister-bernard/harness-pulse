'use strict';

const { fetchWithRetry, sleep } = require('../utils');

async function collectTool(pkg) {
  console.log(`[pypi] Collecting ${pkg}...`);

  // Primary: pypistats.org
  const recentUrl = `https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`;
  const recentRes = await fetchWithRetry(recentUrl, {
    headers: { 'User-Agent': 'HarnessPulse/1.0' }
  });

  let weekly = null, monthly = null, daily_downloads = [];

  if (recentRes.ok) {
    const data = await recentRes.json();
    weekly = data?.data?.last_week ?? null;
    monthly = data?.data?.last_month ?? null;
  }

  await sleep(1000); // pypistats rate limit: 1 req/sec

  // Fallback: pepy.tech for daily breakdown
  try {
    const pepyUrl = `https://pepy.tech/api/v2/projects/${encodeURIComponent(pkg)}`;
    const pepyRes = await fetchWithRetry(pepyUrl, {
      headers: { 'User-Agent': 'HarnessPulse/1.0' }
    });
    if (pepyRes.ok) {
      const pepyData = await pepyRes.json();
      // pepy returns versions with daily downloads — sum across all versions per day
      const downloads = pepyData?.versions;
      if (downloads) {
        const dayMap = {};
        for (const version of Object.values(downloads)) {
          for (const [day, count] of Object.entries(version)) {
            dayMap[day] = (dayMap[day] || 0) + count;
          }
        }
        daily_downloads = Object.entries(dayMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([day, downloads]) => ({ day, downloads }));
      }
    }
  } catch {
    // pepy is optional
  }

  await sleep(1000);
  return { weekly_downloads: weekly, monthly_downloads: monthly, daily_downloads };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.pypi) continue;
    try {
      results[tool.slug] = await collectTool(tool.pypi);
    } catch (err) {
      console.error(`[pypi] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
  }
  return results;
}

module.exports = { collect };
