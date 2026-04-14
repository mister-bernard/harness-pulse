'use strict';

/**
 * Composite Momentum Score (0-100)
 *
 * Phase 1: score each tool within its category (terminal-agent, ide-extension, ai-ide, personal-agent)
 * Phase 2: blend category rank with cross-category rank (60/40) to preserve within-category fairness
 * Phase 3: velocity bonus — tools with accelerating star growth get up to +8pts
 *
 * Weights (applied to cross-category percentile ranks):
 *   GitHub star velocity (30d)    18%
 *   GitHub commit velocity (4w)   12%
 *   Package downloads (weekly)    22%
 *   VS Code installs              12%
 *   JetBrains downloads            5%
 *   Docker pulls                   3%
 *   Community mentions (7d)        8%
 *   Stack Overflow questions       5%
 *   Google Trends (7d avg)         5%
 *   OpenRouter token volume        3%
 *   Issue engagement ratio         7%
 */

const WEIGHTS = {
  star_velocity:      0.18,
  commit_velocity:    0.12,
  weekly_downloads:   0.22,
  vscode_installs:    0.12,
  jetbrains_downloads:0.05,
  docker_pulls:       0.03,
  community_mentions: 0.08,
  stackoverflow:      0.05,
  google_trends:      0.05,
  openrouter_volume:  0.03,
  issue_engagement:   0.07,
};

function extractSignals(tools) {
  return tools.map(t => ({
    slug: t.slug,
    category: t.category,
    star_velocity:       t.github?.stars_velocity_30d ?? t.github?.stars_delta_7d ?? null,
    commit_velocity:     t.github?.commit_velocity_4w ?? null,
    weekly_downloads:    t.downloads?.weekly_downloads ?? null,
    vscode_installs:     t.vscode?.installs ?? null,
    jetbrains_downloads: t.jetbrains?.downloads ?? null,
    docker_pulls:        t.docker?.pull_count ?? null,
    community_mentions:  ((t.community?.hn_stories_7d ?? 0) + (t.community?.hn_comments_7d ?? 0) + (t.community?.reddit_posts_7d ?? 0)),
    stackoverflow:       t.stackoverflow?.total_questions ?? null,
    google_trends:       t.trends?.avg_7d ?? null,
    openrouter_volume:   t.openrouter?.token_volume ?? null,
    issue_engagement:    t.github?.issue_close_ratio ?? null,
  }));
}

function percentileRank(values) {
  const withIdx = values.map((v, i) => ({ v, i }));
  const nonNull = withIdx.filter(x => x.v !== null);
  const sorted = [...nonNull].sort((a, b) => a.v - b.v);
  const result = new Array(values.length).fill(null);
  sorted.forEach((item, rank) => {
    result[item.i] = nonNull.length === 1 ? 50 : Math.round((rank / (nonNull.length - 1)) * 100);
  });
  return result.map(v => v === null ? 50 : v); // null → median
}

function weightedScore(signals, ranks, signalKeys) {
  return signals.map((_, i) => {
    let score = 0;
    for (const key of signalKeys) score += ranks[key][i] * WEIGHTS[key];
    return Math.round(score);
  });
}

function velocityBonus(tools, signals) {
  // Bonus for acceleration: stars_delta_7d / sqrt(total_stars)
  // Normalized 0-8pts on top of composite
  const rawBonus = tools.map((t, i) => {
    const delta7d = t.github?.stars_delta_7d;
    const total = t.github?.stars;
    if (!delta7d || !total) return 0;
    return delta7d / Math.sqrt(total);
  });
  const max = Math.max(...rawBonus, 1);
  return rawBonus.map(b => Math.round((b / max) * 8));
}

function trendLabel(delta7d) {
  if (delta7d > 10)  return 'surging';
  if (delta7d > 3)   return 'rising';
  if (delta7d >= -3) return 'stable';
  if (delta7d >= -10)return 'declining';
  return 'falling';
}

function calculateScores(data, previousData = null) {
  const tools = data.tools;
  const signals = extractSignals(tools);
  const signalKeys = Object.keys(WEIGHTS);

  // Phase 1: cross-category percentile ranks
  const globalRanks = {};
  for (const key of signalKeys) {
    globalRanks[key] = percentileRank(signals.map(s => s[key]));
  }
  const globalScores = weightedScore(signals, globalRanks, signalKeys);

  // Phase 2: within-category percentile ranks
  const categories = [...new Set(tools.map(t => t.category))];
  const categoryScores = new Array(tools.length).fill(50);
  for (const cat of categories) {
    const catIdx = tools.map((t, i) => t.category === cat ? i : -1).filter(i => i >= 0);
    if (catIdx.length < 2) continue;
    const catSignals = catIdx.map(i => signals[i][signalKeys[0]]); // use for ranking within category
    const catRanks = {};
    for (const key of signalKeys) {
      const vals = catIdx.map(i => signals[i][key]);
      const ranks = percentileRank(vals);
      catRanks[key] = ranks;
    }
    catIdx.forEach((globalI, localI) => {
      let score = 0;
      for (const key of signalKeys) score += catRanks[key][localI] * WEIGHTS[key];
      categoryScores[globalI] = Math.round(score);
    });
  }

  // Blend: 60% global + 40% category
  const blendedScores = tools.map((_, i) => Math.round(globalScores[i] * 0.6 + categoryScores[i] * 0.4));

  // Phase 3: velocity bonus
  const bonuses = velocityBonus(tools, signals);

  const scoredTools = tools.map((tool, i) => {
    const momentum_score = Math.min(100, blendedScores[i] + bonuses[i]);

    let momentum_delta_7d = null, momentum_delta_30d = null;
    if (previousData) {
      const prev7  = previousData['7d']?.tools?.find(t => t.slug === tool.slug);
      const prev30 = previousData['30d']?.tools?.find(t => t.slug === tool.slug);
      if (prev7?.momentum_score  != null) momentum_delta_7d  = momentum_score - prev7.momentum_score;
      if (prev30?.momentum_score != null) momentum_delta_30d = momentum_score - prev30.momentum_score;
    }

    return {
      ...tool,
      momentum_score,
      momentum_delta_7d,
      momentum_delta_30d,
      trend: momentum_delta_7d !== null ? trendLabel(momentum_delta_7d) : 'stable',
      _velocity_bonus: bonuses[i]
    };
  });

  scoredTools.sort((a, b) => b.momentum_score - a.momentum_score);
  scoredTools.forEach((t, i) => { t.rank = i + 1; });
  return { ...data, tools: scoredTools };
}

module.exports = { calculateScores };
