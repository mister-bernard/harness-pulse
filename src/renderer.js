'use strict';

const fs = require('fs');
const path = require('path');
const { formatNumber, formatDate, daysSince } = require('./utils');

const SITE_DIR = path.join(__dirname, '..', 'site');

// --- SVG Generators ---

function sparkline(data, width = 80, height = 20) {
  if (!data || data.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
  const values = data.map(d => d.downloads ?? d.score ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastVal = values[values.length - 1];
  const trend = values[values.length - 1] > values[0] ? '#3FB950' : '#F85149';

  return `<svg width="${width}" height="${height}" style="display:inline-block;vertical-align:middle;">
    <polyline points="${points}" fill="none" stroke="${trend}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function barChart(tools, field, label, accessor) {
  const values = tools.map(t => ({ name: t.name, color: t.color, value: accessor(t) ?? 0 }));
  const max = Math.max(...values.map(v => v.value), 1);
  const barW = 600;
  const rowH = 28;
  const labelW = 130;
  const height = values.length * rowH + 40;

  const bars = values.map((v, i) => {
    const y = i * rowH + 20;
    const w = Math.round((v.value / max) * (barW - labelW - 80));
    const display = formatNumber(v.value);
    return `
      <text x="${labelW - 8}" y="${y + 14}" fill="#8B949E" font-size="11" text-anchor="end" font-family="JetBrains Mono,monospace">${v.name.slice(0, 14)}</text>
      <rect x="${labelW}" y="${y}" width="${w}" height="16" rx="2" fill="${v.color}" opacity="0.8"/>
      <text x="${labelW + w + 6}" y="${y + 12}" fill="#E6EDF3" font-size="11" font-family="JetBrains Mono,monospace">${display}</text>`;
  }).join('');

  return `<div class="chart-wrap">
    <div class="chart-label">${label}</div>
    <svg width="${barW}" height="${height}" style="max-width:100%">
      ${bars}
    </svg>
  </div>`;
}

// --- Trend utilities ---

function trendEmoji(trend) {
  if (!trend) return '●';
  if (trend === 'surging' || trend === 'rising') return '▲';
  if (trend === 'declining' || trend === 'falling') return '▼';
  return '●';
}

function trendClass(trend) {
  if (!trend) return 'stable';
  if (trend === 'surging' || trend === 'rising') return 'rising';
  if (trend === 'declining' || trend === 'falling') return 'declining';
  return 'stable';
}

function deltaStr(delta) {
  if (delta == null) return '—';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}`;
}

// --- Detail card ---

function detailCard(t) {
  const gh = t.github;
  const dl = t.downloads;
  const vs = t.vscode;
  const or = t.openrouter;
  const comm = t.community;

  const ghBlock = gh ? `
    <div class="card-row"><span class="card-key">⭐ Stars</span><span class="card-val">${formatNumber(gh.stars)}${gh.stars_delta_7d != null ? ` <span class="delta ${gh.stars_delta_7d >= 0 ? 'pos' : 'neg'}">(${deltaStr(gh.stars_delta_7d)} 7d)</span>` : ''}</span></div>
    <div class="card-row"><span class="card-key">🍴 Forks</span><span class="card-val">${formatNumber(gh.forks)}</span></div>
    <div class="card-row"><span class="card-key">🐛 Issues</span><span class="card-val">${formatNumber(gh.open_issues)}</span></div>
    <div class="card-row"><span class="card-key">⚡ Commits/4w</span><span class="card-val">${gh.commit_velocity_4w ?? 'N/A'}</span></div>
    <div class="card-row"><span class="card-key">🔖 Release</span><span class="card-val">${gh.latest_release || 'N/A'}</span></div>
    <div class="card-row"><span class="card-key">📅 Last push</span><span class="card-val">${gh.last_push ? `${daysSince(gh.last_push)}d ago` : 'N/A'}</span></div>` : '';

  const dlSparkline = dl?.daily_downloads?.length ? sparkline(dl.daily_downloads) : '';
  const dlBlock = (dl?.weekly_downloads != null || dl?.monthly_downloads != null) ? `
    <div class="card-row"><span class="card-key">📦 Wkly DLs</span><span class="card-val">${formatNumber(dl.weekly_downloads)} ${dlSparkline}</span></div>
    <div class="card-row"><span class="card-key">📦 Mo DLs</span><span class="card-val">${formatNumber(dl.monthly_downloads)}</span></div>` : '';

  const vsBlock = vs ? `
    <div class="card-row"><span class="card-key">🔌 Installs</span><span class="card-val">${formatNumber(vs.installs)}</span></div>
    <div class="card-row"><span class="card-key">⭐ Rating</span><span class="card-val">${vs.average_rating ? `${vs.average_rating.toFixed(1)}/5 (${formatNumber(vs.rating_count)})` : 'N/A'}</span></div>` : '';

  const orBlock = or ? `
    <div class="card-row"><span class="card-key">🔀 OR Rank</span><span class="card-val">${or.rank != null ? `#${or.rank}` : 'N/A'}</span></div>
    <div class="card-row"><span class="card-key">🔀 OR Tokens</span><span class="card-val">${formatNumber(or.token_volume)}</span></div>` : '';

  const commBlock = comm ? `
    <div class="card-row"><span class="card-key">💬 HN (7d)</span><span class="card-val">${comm.hn_stories_7d} posts / ${comm.hn_comments_7d} comments</span></div>
    <div class="card-row"><span class="card-key">🟠 Reddit (7d)</span><span class="card-val">${comm.reddit_posts_7d} posts</span></div>` : '';

  const hasData = ghBlock || dlBlock || vsBlock;

  return `<div class="tool-card" style="border-top: 3px solid ${t.color}">
    <div class="card-header">
      <div>
        <div class="card-name">${t.name}</div>
        <div class="card-meta"><span class="badge">${t.category}</span> <span class="vendor">${t.vendor}</span></div>
      </div>
      <div class="score-badge" style="background:${t.color}22;border:1px solid ${t.color}66;color:${t.color}">${t.momentum_score ?? '—'}</div>
    </div>
    ${hasData ? `<div class="card-body">${ghBlock}${dlBlock}${vsBlock}${orBlock}${commBlock}</div>` : '<div class="card-body no-data">No public data available</div>'}
    ${t.website ? `<div class="card-footer"><a href="${t.website}" target="_blank" rel="noopener">${t.website.replace(/^https?:\/\//, '')}</a></div>` : ''}
  </div>`;
}

// --- Trend line chart (SVG, inline) ---

function trendChart(trendHistory, tools) {
  const width = 800;
  const height = 220;
  const padL = 40, padR = 20, padT = 20, padB = 30;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  // Get all dates across all tools
  const allDates = [...new Set(
    Object.values(trendHistory).flatMap(arr => arr.map(d => d.date))
  )].sort();

  if (allDates.length < 2) return '';

  const xScale = (i) => padL + (i / (allDates.length - 1)) * chartW;
  const yScale = (score) => padT + chartH - (score / 100) * chartH;

  const lines = tools.map(t => {
    const hist = trendHistory[t.slug] || [];
    if (hist.length < 2) return '';
    const points = hist
      .map(d => {
        const xi = allDates.indexOf(d.date);
        if (xi === -1) return null;
        return `${xScale(xi).toFixed(1)},${yScale(d.score).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');
    return `<polyline points="${points}" fill="none" stroke="${t.color}" stroke-width="2" stroke-linejoin="round" opacity="0.85" title="${t.name}"/>`;
  }).join('');

  // X-axis labels (first, mid, last)
  const xLabels = [0, Math.floor(allDates.length / 2), allDates.length - 1].map(i => {
    const d = allDates[i];
    return `<text x="${xScale(i).toFixed(1)}" y="${height - 5}" fill="#8B949E" font-size="10" text-anchor="middle" font-family="monospace">${d?.slice(5)}</text>`;
  }).join('');

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100].map(v => `
    <text x="${padL - 5}" y="${yScale(v) + 4}" fill="#8B949E" font-size="10" text-anchor="end" font-family="monospace">${v}</text>
    <line x1="${padL}" y1="${yScale(v)}" x2="${padL + chartW}" y2="${yScale(v)}" stroke="#30363D" stroke-width="0.5"/>
  `).join('');

  return `<svg width="${width}" height="${height}" style="max-width:100%;overflow:visible">
    ${yLabels}
    ${lines}
    ${xLabels}
  </svg>`;
}

// --- Main render ---

function render(data, trendHistory = {}) {
  const { tools, collected_at } = data;
  const ts = new Date(collected_at).toUTCString();

  const leaderboardRows = tools.map(t => `
    <tr>
      <td class="rank">#${t.rank}</td>
      <td class="tool-name" style="color:${t.color}">${t.name}</td>
      <td class="vendor-cell">${t.vendor}</td>
      <td class="score">${t.momentum_score ?? '—'}</td>
      <td class="delta ${t.momentum_delta_7d >= 0 ? 'pos' : 'neg'}">${deltaStr(t.momentum_delta_7d)}</td>
      <td class="delta ${t.momentum_delta_30d >= 0 ? 'pos' : 'neg'}">${deltaStr(t.momentum_delta_30d)}</td>
      <td class="trend ${trendClass(t.trend)}">${trendEmoji(t.trend)} ${t.trend || 'stable'}</td>
    </tr>`).join('');

  const starsChart = barChart(tools.filter(t => t.github), 'stars', 'GitHub Stars', t => t.github?.stars);
  const dlChart = barChart(tools.filter(t => t.downloads?.weekly_downloads != null), 'downloads', 'Weekly Downloads', t => t.downloads?.weekly_downloads);
  const commChart = barChart(tools, 'community', 'Community Mentions (7d)', t =>
    (t.community?.hn_stories_7d ?? 0) + (t.community?.hn_comments_7d ?? 0) + (t.community?.reddit_posts_7d ?? 0)
  );

  const cards = tools.map(detailCard).join('');
  const trendSvg = trendChart(trendHistory, tools);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Harness Pulse — AI Coding Tool Adoption Dashboard</title>
  <link rel="stylesheet" href="style.css">
  <link rel="alternate" type="application/rss+xml" title="Harness Pulse" href="feed.xml">
</head>
<body>
  <header>
    <div class="header-left">
      <h1>THE HARNESS PULSE</h1>
      <p class="subtitle">Daily intelligence on AI coding tool adoption</p>
    </div>
    <div class="header-right">
      <div class="last-updated">Last updated: ${ts}</div>
      <a href="api/latest.json" class="api-link">JSON API</a>
    </div>
  </header>

  <section class="leaderboard">
    <h2>MOMENTUM LEADERBOARD</h2>
    <p class="section-note">Composite score (0-100) based on GitHub activity, downloads, VS Code installs, community mentions, and OpenRouter volume.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Tool</th>
            <th>Vendor</th>
            <th>Score</th>
            <th>Δ 7d</th>
            <th>Δ 30d</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>${leaderboardRows}</tbody>
      </table>
    </div>
  </section>

  <section class="charts">
    <h2>SIGNAL BREAKDOWN</h2>
    <div class="chart-grid">
      ${starsChart}
      ${dlChart}
      ${commChart}
    </div>
  </section>

  ${trendSvg ? `<section class="trend-chart">
    <h2>30-DAY MOMENTUM TREND</h2>
    <div class="trend-wrap">${trendSvg}</div>
    <div class="legend">${tools.map(t => `<span style="color:${t.color}">■ ${t.name}</span>`).join(' ')}</div>
  </section>` : ''}

  <section class="detail-cards">
    <h2>TOOL DETAIL</h2>
    <div class="cards-grid">${cards}</div>
  </section>

  <section class="methodology">
    <h2>METHODOLOGY & DATA SOURCES</h2>
    <div class="method-body">
      <h3>Why This Dashboard Exists</h3>
      <p>OpenRouter's leaderboard measures API gateway traffic — it only captures tools that route requests through OpenRouter. Claude Code, Cursor, and GitHub Copilot use direct API access and are invisible to OpenRouter's rankings. Token volume also isn't user adoption: one agentic loop can burn billions of tokens. This dashboard measures what actually matters — installs, stars, downloads, community activity.</p>

      <h3>Score Weights</h3>
      <table class="method-table">
        <tr><th>Signal</th><th>Weight</th><th>Source</th><th>Rationale</th></tr>
        <tr><td>GitHub star velocity (30d)</td><td>20%</td><td>GitHub API</td><td>Raw developer interest</td></tr>
        <tr><td>GitHub commit velocity (4w)</td><td>15%</td><td>GitHub API</td><td>Active development pace</td></tr>
        <tr><td>Package downloads (weekly)</td><td>25%</td><td>npm + PyPI</td><td>Actual installation/usage</td></tr>
        <tr><td>VS Code installs</td><td>15%</td><td>VS Code Marketplace</td><td>IDE adoption</td></tr>
        <tr><td>Community mentions (7d)</td><td>10%</td><td>HN + Reddit</td><td>Developer mindshare</td></tr>
        <tr><td>OpenRouter token volume</td><td>5%</td><td>OpenRouter</td><td>API gateway traffic</td></tr>
        <tr><td>Issue engagement ratio</td><td>10%</td><td>GitHub API</td><td>Community health</td></tr>
      </table>

      <h3>Known Limitations</h3>
      <ul>
        <li><strong>Closed-source tools</strong> (Cursor, Windsurf) have no GitHub or download data. They receive median scores for those signals — not zero.</li>
        <li><strong>Enterprise usage</strong> doesn't appear in any public signal. Copilot's real adoption is likely much larger than its VS Code extension count suggests.</li>
        <li><strong>OpenRouter data</strong> is labeled clearly: it measures API gateway traffic, not total usage.</li>
        <li><strong>OpenRouter rankings API</strong> may not be publicly available; this signal may show N/A.</li>
        <li>Data updates once per day at 06:00 UTC.</li>
      </ul>

      <h3>Data Update Frequency</h3>
      <ul>
        <li>GitHub, npm, PyPI, VS Code Marketplace: daily</li>
        <li>HN + Reddit: daily (7-day rolling window)</li>
        <li>OpenRouter: daily (if available)</li>
      </ul>

      <h3>Open Source</h3>
      <p>All code is open source. <a href="https://github.com/mister-bernard/harness-pulse" target="_blank">github.com/mister-bernard/harness-pulse</a></p>
    </div>
  </section>

  <footer>
    <div>The Harness Pulse — Data updated daily at 06:00 UTC</div>
    <div><a href="https://twitter.com/mrb_signal">@mrb_signal</a> · <a href="api/latest.json">JSON API</a> · <a href="feed.xml">RSS</a></div>
  </footer>
</body>
</html>`;

  return html;
}

function writeSite(data, trendHistory = {}) {
  fs.mkdirSync(SITE_DIR, { recursive: true });
  fs.mkdirSync(path.join(SITE_DIR, 'api'), { recursive: true });

  const html = render(data, trendHistory);
  fs.writeFileSync(path.join(SITE_DIR, 'index.html'), html);

  // JSON API endpoint
  fs.writeFileSync(path.join(SITE_DIR, 'api', 'latest.json'), JSON.stringify(data, null, 2));

  // RSS feed
  const rss = generateRSS(data);
  fs.writeFileSync(path.join(SITE_DIR, 'feed.xml'), rss);

  console.log(`[renderer] Site written to ${SITE_DIR}`);
}

function generateRSS(data) {
  const items = data.tools.slice(0, 5).map(t => `
    <item>
      <title>${t.name} — Momentum Score: ${t.momentum_score ?? 'N/A'}</title>
      <description>Rank #${t.rank}. 7d delta: ${deltaStr(t.momentum_delta_7d)}. Trend: ${t.trend}.</description>
      <pubDate>${new Date(data.collected_at).toUTCString()}</pubDate>
      <guid>${process.env.DASHBOARD_URL || 'https://harnesspulse.com'}#${t.slug}-${data.collected_at.slice(0, 10)}</guid>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Harness Pulse</title>
    <link>${process.env.DASHBOARD_URL || 'https://harnesspulse.com'}</link>
    <description>Daily AI coding tool adoption rankings</description>
    <lastBuildDate>${new Date(data.collected_at).toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

module.exports = { writeSite, render };
