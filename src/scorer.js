'use strict';

/**
 * Composite Momentum Score (0-100).
 *
 * Weights:
 *   GitHub star velocity (30d)    20%
 *   GitHub commit velocity (4w)   15%
 *   Package downloads (weekly)    25%
 *   VS Code installs              15%
 *   Community mentions (7d)       10%
 *   OpenRouter token volume        5%
 *   Issue engagement ratio        10%
 *
 * Method: percentile rank within each signal, then weighted sum.
 * Missing data → median score for that signal (50).
 */

const WEIGHTS = {
  star_velocity: 0.20,
  commit_velocity: 0.15,
  weekly_downloads: 0.25,
  vscode_installs: 0.15,
  community_mentions: 0.10,
  openrouter_volume: 0.05,
  issue_engagement: 0.10
};

function extractSignals(tools) {
  return tools.map(t => ({
    slug: t.slug,
    star_velocity: t.github?.stars_delta_7d ?? null,
    commit_velocity: t.github?.commit_velocity_4w ?? null,
    weekly_downloads: t.downloads?.weekly_downloads ?? null,
    vscode_installs: t.vscode?.installs ?? null,
    community_mentions: (
      (t.community?.hn_stories_7d ?? 0) +
      (t.community?.hn_comments_7d ?? 0) +
      (t.community?.reddit_posts_7d ?? 0)
    ),
    openrouter_volume: t.openrouter?.token_volume ?? null,
    issue_engagement: t.github?.issue_close_ratio ?? null
  }));
}

function percentileRank(values) {
  // Returns a 0-100 score for each value based on its rank
  const withIndex = values.map((v, i) => ({ v, i }));
  const nonNull = withIndex.filter(x => x.v !== null);
  const sorted = [...nonNull].sort((a, b) => a.v - b.v);

  const result = new Array(values.length).fill(null);
  sorted.forEach((item, rank) => {
    result[item.i] = nonNull.length === 1 ? 50 : Math.round((rank / (nonNull.length - 1)) * 100);
  });

  // Fill nulls with median (50)
  return result.map(v => v === null ? 50 : v);
}

function trendLabel(delta7d) {
  if (delta7d > 10) return 'surging';
  if (delta7d > 3) return 'rising';
  if (delta7d >= -3) return 'stable';
  if (delta7d >= -10) return 'declining';
  return 'falling';
}

function calculateScores(data, previousData = null) {
  const tools = data.tools;
  const signals = extractSignals(tools);
  const signalKeys = Object.keys(WEIGHTS);

  // Compute percentile ranks for each signal dimension
  const ranks = {};
  for (const key of signalKeys) {
    const values = signals.map(s => s[key]);
    ranks[key] = percentileRank(values);
  }

  // Compute weighted composite score for each tool
  const scoredTools = tools.map((tool, i) => {
    let score = 0;
    for (const key of signalKeys) {
      score += ranks[key][i] * WEIGHTS[key];
    }
    const momentum_score = Math.round(score);

    // Compute deltas vs previous snapshots
    let momentum_delta_7d = null;
    let momentum_delta_30d = null;

    if (previousData) {
      const prev7 = previousData['7d']?.tools?.find(t => t.slug === tool.slug);
      const prev30 = previousData['30d']?.tools?.find(t => t.slug === tool.slug);
      if (prev7?.momentum_score != null) momentum_delta_7d = momentum_score - prev7.momentum_score;
      if (prev30?.momentum_score != null) momentum_delta_30d = momentum_score - prev30.momentum_score;
    }

    return {
      ...tool,
      momentum_score,
      momentum_delta_7d,
      momentum_delta_30d,
      trend: momentum_delta_7d !== null ? trendLabel(momentum_delta_7d) : 'stable'
    };
  });

  // Sort by score descending, add rank
  scoredTools.sort((a, b) => b.momentum_score - a.momentum_score);
  scoredTools.forEach((t, i) => { t.rank = i + 1; });

  return { ...data, tools: scoredTools };
}

module.exports = { calculateScores };
