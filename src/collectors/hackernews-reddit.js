'use strict';

const { fetchWithRetry, sleep } = require('../utils');

function sevenDaysAgo() {
  return Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
}

async function fetchHN(query) {
  const since = sevenDaysAgo();
  const q = encodeURIComponent(`"${query}"`);

  const [storiesRes, commentsRes] = await Promise.all([
    fetchWithRetry(
      `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=1`,
      { headers: { 'User-Agent': 'HarnessPulse/1.0' } }
    ),
    fetchWithRetry(
      `https://hn.algolia.com/api/v1/search?query=${q}&tags=comment&numericFilters=created_at_i>${since}&hitsPerPage=1`,
      { headers: { 'User-Agent': 'HarnessPulse/1.0' } }
    )
  ]);

  const stories = storiesRes.ok ? (await storiesRes.json())?.nbHits ?? 0 : 0;
  const comments = commentsRes.ok ? (await commentsRes.json())?.nbHits ?? 0 : 0;
  return { stories, comments };
}

async function fetchReddit(query) {
  await sleep(2000); // Reddit: 1 req per 2s unauthenticated
  const q = encodeURIComponent(`"${query}"`);
  const res = await fetchWithRetry(
    `https://www.reddit.com/search.json?q=${q}&sort=new&t=week&limit=100`,
    { headers: { 'User-Agent': 'HarnessPulse/1.0 (contact@mrb.sh)' } }
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return data?.data?.dist ?? 0;
}

// Some tools have alternate popular search terms
const QUERY_OVERRIDES = {
  'github-copilot': 'GitHub Copilot',
  'codex-cli': 'OpenAI Codex',
  'gemini-cli': 'Gemini CLI',
  'openhands': 'OpenHands AI'
};

async function collectTool(tool) {
  const query = QUERY_OVERRIDES[tool.slug] || tool.name;
  console.log(`[community] Collecting "${query}"...`);

  const [hn, reddit] = await Promise.all([
    fetchHN(query),
    fetchReddit(query)
  ]);

  await sleep(500);
  return {
    hn_stories_7d: hn.stories,
    hn_comments_7d: hn.comments,
    reddit_posts_7d: reddit
  };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    try {
      results[tool.slug] = await collectTool(tool);
    } catch (err) {
      console.error(`[community] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = { hn_stories_7d: 0, hn_comments_7d: 0, reddit_posts_7d: 0 };
    }
  }
  return results;
}

module.exports = { collect };
