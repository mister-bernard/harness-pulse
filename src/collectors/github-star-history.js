'use strict';

const { fetchWithRetry, sleep } = require('../utils');

/**
 * Fetches actual star timestamps to compute true velocity.
 * Strategy: fetch the last pages of stargazers (sorted oldest→newest by default,
 * so we need to jump to the end) and count stars added in last 7/30 days.
 */
async function fetchStarVelocity(owner, repo, totalStars) {
  if (!totalStars || totalStars === 0) return { delta_7d: 0, delta_30d: 0 };

  const PER_PAGE = 100;
  const totalPages = Math.ceil(totalStars / PER_PAGE);
  // Only fetch last 3 pages — enough to cover recent activity for most repos
  const pagesToFetch = Math.min(3, totalPages);
  const startPage = Math.max(1, totalPages - pagesToFetch + 1);

  const now = Date.now();
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;

  let delta7d = 0, delta30d = 0;

  for (let page = startPage; page <= totalPages; page++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=${PER_PAGE}&page=${page}`;
    const res = await fetchWithRetry(url, {
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.star+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'HarnessPulse/1.0'
      }
    });
    if (!res.ok) break;
    const stars = await res.json();
    for (const s of stars) {
      const ts = new Date(s.starred_at).getTime();
      if (ts >= cutoff7d) delta7d++;
      if (ts >= cutoff30d) delta30d++;
    }
    await sleep(300);
  }

  return { delta_7d: delta7d, delta_30d: delta30d };
}

async function enrich(githubData, tools) {
  const enriched = {};
  for (const tool of tools) {
    if (!tool.github || !githubData[tool.slug]) {
      enriched[tool.slug] = githubData[tool.slug];
      continue;
    }
    const base = githubData[tool.slug];
    if (!base?.stars) { enriched[tool.slug] = base; continue; }

    console.log(`[star-history] Fetching velocity for ${tool.github.owner}/${tool.github.repo}...`);
    try {
      const velocity = await fetchStarVelocity(tool.github.owner, tool.github.repo, base.stars);
      enriched[tool.slug] = {
        ...base,
        stars_delta_7d: velocity.delta_7d,
        stars_delta_30d: velocity.delta_30d,
        stars_velocity_30d: velocity.delta_30d // used by scorer
      };
    } catch (err) {
      console.warn(`[star-history] Failed ${tool.slug}: ${err.message}`);
      enriched[tool.slug] = base;
    }
  }
  return enriched;
}

module.exports = { enrich };
