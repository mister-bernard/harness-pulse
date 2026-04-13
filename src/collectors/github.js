'use strict';

const { fetchWithRetry, sleep } = require('../utils');

const BASE_URL = 'https://api.github.com';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'HarnessPulse/1.0'
  };
}

// GitHub returns 202 while computing stats — retry up to 5 times
async function fetchStats(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetchWithRetry(url, { headers: headers() });
    if (res.status === 202) {
      await sleep(2000);
      continue;
    }
    if (res.status === 204 || res.status === 404) return null;
    return await res.json();
  }
  return null;
}

async function fetchRepoInfo(owner, repo) {
  const res = await fetchWithRetry(`${BASE_URL}/repos/${owner}/${repo}`, { headers: headers() });
  if (!res.ok) {
    console.warn(`[github] Failed to fetch ${owner}/${repo}: ${res.status}`);
    return null;
  }
  return res.json();
}

async function fetchCommitActivity(owner, repo) {
  return fetchStats(`${BASE_URL}/repos/${owner}/${repo}/stats/commit_activity`);
}

async function fetchContributors(owner, repo) {
  return fetchStats(`${BASE_URL}/repos/${owner}/${repo}/stats/contributors`);
}

async function fetchLatestRelease(owner, repo) {
  const res = await fetchWithRetry(`${BASE_URL}/repos/${owner}/${repo}/releases/latest`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

// Get closed issue count via Link header trick
async function fetchClosedIssueCount(owner, repo) {
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/repos/${owner}/${repo}/issues?state=closed&per_page=1`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const link = res.headers.get('link') || '';
    const match = link.match(/page=(\d+)>; rel="last"/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return null;
  }
}

async function checkRateLimit() {
  const res = await fetchWithRetry(`${BASE_URL}/rate_limit`, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.rate;
}

async function collectTool(tool) {
  if (!tool.github) return null;

  const { owner, repo } = tool.github;
  console.log(`[github] Collecting ${owner}/${repo}...`);

  // Check rate limit before proceeding
  const rate = await checkRateLimit();
  if (rate && rate.remaining < 100) {
    const resetMs = (rate.reset * 1000) - Date.now();
    console.warn(`[github] Rate limit low (${rate.remaining}). Reset in ${Math.ceil(resetMs / 60000)}m. Pausing.`);
    await sleep(Math.min(resetMs + 5000, 60000));
  }

  const [repoInfo, commitActivity, contributors, latestRelease, closedIssueCount] = await Promise.all([
    fetchRepoInfo(owner, repo),
    fetchCommitActivity(owner, repo),
    fetchContributors(owner, repo),
    fetchLatestRelease(owner, repo),
    fetchClosedIssueCount(owner, repo)
  ]);

  if (!repoInfo) return null;

  // Commit velocity: sum of last 4 weeks
  let commit_velocity_4w = 0;
  if (Array.isArray(commitActivity)) {
    const last4 = commitActivity.slice(-4);
    commit_velocity_4w = last4.reduce((sum, w) => sum + (w.total || 0), 0);
  }

  // Contributor count
  const contributors_count = Array.isArray(contributors) ? contributors.length : null;

  // Top 5 contributors
  let top_contributors = [];
  if (Array.isArray(contributors)) {
    top_contributors = contributors
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(c => ({ login: c.author?.login, commits: c.total }));
  }

  // Issue close ratio
  const total_issues = repoInfo.open_issues_count || 0;
  const issue_close_ratio = (closedIssueCount !== null && (closedIssueCount + total_issues) > 0)
    ? closedIssueCount / (closedIssueCount + total_issues)
    : null;

  return {
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    open_issues: repoInfo.open_issues_count,
    watchers: repoInfo.subscribers_count,
    last_push: repoInfo.pushed_at,
    created_at: repoInfo.created_at,
    language: repoInfo.language,
    license: repoInfo.license?.spdx_id || null,
    commit_velocity_4w,
    contributors_count,
    top_contributors,
    latest_release: latestRelease?.tag_name || null,
    latest_release_date: latestRelease?.published_at || null,
    issue_close_ratio,
    closed_issues: closedIssueCount,
    // stars_delta_7d will be calculated in historical.js by diffing snapshots
    stars_delta_7d: null
  };
}

async function collect(tools) {
  const results = {};
  for (const tool of tools) {
    if (!tool.github) continue;
    try {
      results[tool.slug] = await collectTool(tool);
    } catch (err) {
      console.error(`[github] Error collecting ${tool.slug}: ${err.message}`);
      results[tool.slug] = null;
    }
    await sleep(300); // gentle pacing
  }
  return results;
}

module.exports = { collect };
