'use strict';

const { TwitterApi } = require('twitter-api-v2');
const path = require('path');
const fs = require('fs');
const { loadLatest, loadTrendHistory } = require('./historical');
const { tools: cfgTools } = require('./config');

const HISTORY_FILE = path.join(__dirname, '..', 'data', 'weekly-thread-history.json');

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); }
  catch { return { last_run: null }; }
}

function saveHistory(h) { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); }

function sanitize(s) {
  return s.replace(/[^\x00-\x7F]/g, '').replace(/--/g, '-').trim().slice(0, 280);
}

function fmt(n) {
  if (n == null) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

async function composeThread(data) {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  const tools = data.tools;

  // Build a data summary for Claude to narrate
  const top5 = tools.slice(0, 5).map(t =>
    `${t.rank}. ${t.name} (${t.momentum_score}pts, d7d: ${t.momentum_delta_7d != null ? (t.momentum_delta_7d >= 0 ? '+' : '') + t.momentum_delta_7d : '?'})`
  ).join('\n');

  const biggestMover = [...tools].filter(t => t.momentum_delta_7d != null)
    .sort((a, b) => Math.abs(b.momentum_delta_7d) - Math.abs(a.momentum_delta_7d))[0];

  const topDl = [...tools].filter(t => t.downloads?.weekly_downloads)
    .sort((a, b) => b.downloads.weekly_downloads - a.downloads.weekly_downloads)[0];

  const topStars = [...tools].filter(t => t.github?.stars_delta_7d)
    .sort((a, b) => b.github.stars_delta_7d - a.github.stars_delta_7d)[0];

  const context = `This week's AI coding tool rankings:
${top5}
Biggest mover: ${biggestMover ? `${biggestMover.name} (${biggestMover.momentum_delta_7d > 0 ? '+' : ''}${biggestMover.momentum_delta_7d}pts)` : 'N/A'}
Top downloads: ${topDl ? `${topDl.name} (${fmt(topDl.downloads.weekly_downloads)}/week)` : 'N/A'}
Fastest star growth: ${topStars ? `${topStars.name} (+${topStars.github.stars_delta_7d} stars)` : 'N/A'}`;

  const res = await fetch(`${gatewayUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model: 'openclaw/fast-dm',
      max_tokens: 400,
      messages: [{
        role: 'system',
        content: `You are Mr. Bernard (@mrb_signal), author of The Harness Pulse.
Write a 3-tweet Sunday thread summarizing the week in AI coding tools.
Format: exactly 3 tweets separated by "---".
Each tweet max 260 chars. ASCII only. No hashtags. Data-driven, direct tone.
First tweet: the headline story. Second tweet: the data behind it. Third tweet: what to watch next week.`
      }, {
        role: 'user',
        content: context
      }]
    })
  });

  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const raw = (await res.json()).choices?.[0]?.message?.content?.trim() || '';
  const tweets = raw.split('---').map(t => sanitize(t)).filter(t => t.length > 10);
  return tweets.slice(0, 3);
}

async function postWeeklyThread() {
  const history = loadHistory();

  // Only run on Sundays (0) and not more than once per week
  const now = new Date();
  if (now.getUTCDay() !== 0) {
    console.log('[weekly] Not Sunday, skipping.');
    return;
  }
  const lastRun = history.last_run ? new Date(history.last_run) : null;
  if (lastRun && (now - lastRun) < 6 * 24 * 60 * 60 * 1000) {
    console.log('[weekly] Already ran this week, skipping.');
    return;
  }

  const data = loadLatest();
  if (!data) { console.warn('[weekly] No data available.'); return; }

  console.log('[weekly] Composing Sunday thread...');
  const tweets = await composeThread(data);
  if (!tweets.length) { console.warn('[weekly] No tweets composed.'); return; }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  let replyTo = null;
  for (const text of tweets) {
    const params = replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {};
    const r = await client.v2.tweet(text, params);
    console.log(`[weekly] Posted: ${r.data.id}`);
    replyTo = r.data.id;
    await new Promise(res => setTimeout(res, 2000));
  }

  history.last_run = now.toISOString();
  saveHistory(history);
}

module.exports = { postWeeklyThread };
