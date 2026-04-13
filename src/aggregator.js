'use strict';

const { tools } = require('./config');

/**
 * Merges all collector outputs into a unified per-tool schema.
 *
 * Input shape:
 *   { github: {slug: data}, npm: {slug: data}, pypi: {slug: data},
 *     vscode: {slug: data}, openrouter: {slug: data}, community: {slug: data} }
 *
 * Output: { collected_at, tools: [...] }
 */
function aggregate({ github = {}, npm = {}, pypi = {}, vscode = {}, openrouter = {}, community = {} }) {
  const now = new Date().toISOString();

  const aggregated = tools.map(tool => {
    // Merge download data: npm takes precedence for npm-published tools; PyPI for Python tools
    const npmData = npm[tool.slug] || null;
    const pypiData = pypi[tool.slug] || null;

    const downloads = {
      npm: npmData,
      pypi: pypiData,
      // Unified weekly/monthly for scoring (prefer npm, fall back to pypi)
      weekly_downloads: npmData?.weekly_downloads ?? pypiData?.weekly_downloads ?? null,
      monthly_downloads: npmData?.monthly_downloads ?? pypiData?.monthly_downloads ?? null,
      // For sparkline: prefer npm daily, fall back to pypi
      daily_downloads: npmData?.daily_downloads?.length
        ? npmData.daily_downloads
        : (pypiData?.daily_downloads || [])
    };

    return {
      slug: tool.slug,
      name: tool.name,
      vendor: tool.vendor,
      category: tool.category,
      website: tool.website,
      color: tool.color,
      // Raw collector data
      github: github[tool.slug] || null,
      downloads,
      vscode: vscode[tool.slug] || null,
      openrouter: openrouter[tool.slug] || null,
      community: community[tool.slug] || null,
      // Scores filled in by scorer.js
      momentum_score: null,
      momentum_delta_7d: null,
      momentum_delta_30d: null,
      trend: null
    };
  });

  return { collected_at: now, tools: aggregated };
}

module.exports = { aggregate };
