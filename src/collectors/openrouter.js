'use strict';

const { fetchWithRetry } = require('../utils');

// OpenRouter exposes an undocumented rankings endpoint. The public rankings
// page is client-side rendered, so we attempt the most likely JSON endpoints.
const CANDIDATE_URLS = [
  'https://openrouter.ai/api/v1/rankings',
  'https://openrouter.ai/api/rankings',
  'https://openrouter.ai/api/v1/stats/apps'
];

async function fetchRankings() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'HarnessPulse/1.0',
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data) || Array.isArray(data.data) || data.apps)) {
          console.log(`[openrouter] Rankings found at ${url}`);
          return data;
        }
      }
    } catch {
      // try next
    }
  }
  console.warn('[openrouter] Rankings endpoint not found — skipping OpenRouter data');
  return null;
}

async function collect(tools) {
  const results = {};
  const rankings = await fetchRankings();

  if (!rankings) {
    for (const tool of tools) {
      if (tool.openrouter_app_slug) results[tool.slug] = null;
    }
    return results;
  }

  // Normalize: rankings might be array of { name/app/slug, tokens, rank }
  const items = Array.isArray(rankings) ? rankings
    : Array.isArray(rankings.data) ? rankings.data
    : rankings.apps || [];

  for (const tool of tools) {
    if (!tool.openrouter_app_slug) continue;
    const match = items.find(item => {
      const id = (item.name || item.app || item.slug || '').toLowerCase();
      return id.includes(tool.openrouter_app_slug.toLowerCase());
    });
    if (match) {
      results[tool.slug] = {
        rank: match.rank ?? null,
        token_volume: match.tokens ?? match.token_count ?? match.volume ?? null
      };
    } else {
      results[tool.slug] = null;
    }
  }

  return results;
}

module.exports = { collect };
