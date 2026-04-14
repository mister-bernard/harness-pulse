'use strict';

const { tools } = require('./config');

function aggregate({ github={}, npm={}, pypi={}, vscode={}, jetbrains={}, docker={}, openrouter={}, community={}, stackoverflow={}, trends={} }) {
  const now = new Date().toISOString();

  const aggregated = tools.map(tool => {
    const npmData  = npm[tool.slug]  || null;
    const pypiData = pypi[tool.slug] || null;

    const downloads = {
      npm: npmData,
      pypi: pypiData,
      weekly_downloads:  npmData?.weekly_downloads  ?? pypiData?.weekly_downloads  ?? null,
      monthly_downloads: npmData?.monthly_downloads ?? pypiData?.monthly_downloads ?? null,
      daily_downloads: npmData?.daily_downloads?.length
        ? npmData.daily_downloads
        : (pypiData?.daily_downloads || [])
    };

    return {
      slug:     tool.slug,
      name:     tool.name,
      vendor:   tool.vendor,
      category: tool.category,
      website:  tool.website,
      color:    tool.color,
      github:      github[tool.slug]      || null,
      downloads,
      vscode:      vscode[tool.slug]      || null,
      jetbrains:   jetbrains[tool.slug]   || null,
      docker:      docker[tool.slug]      || null,
      openrouter:  openrouter[tool.slug]  || null,
      community:   community[tool.slug]   || null,
      stackoverflow: stackoverflow[tool.slug] || null,
      trends:      trends[tool.slug]      || null,
      momentum_score: null,
      momentum_delta_7d: null,
      momentum_delta_30d: null,
      trend: null
    };
  });

  return { collected_at: now, tools: aggregated };
}

module.exports = { aggregate };
