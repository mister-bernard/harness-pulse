'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TWEET_HISTORY_FILE = path.join(
  process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  'tweet-history.json'
);

// URL counts as 23 chars on Twitter regardless of actual length
const URL_CHARS = 23;

function twitterClient() {
  const { TwitterApi } = require('twitter-api-v2');
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  });
}

function trendEmoji(trend) {
  if (!trend) return '●';
  if (trend === 'surging' || trend === 'rising') return '▲';
  if (trend === 'declining' || trend === 'falling') return '▼';
  return '●';
}

function shortName(name, maxLen = 14) {
  const abbrevs = {
    'GitHub Copilot': 'Copilot',
    'Claude Code': 'Claude Code',
    'Codex CLI': 'Codex CLI',
    'Gemini CLI': 'Gemini CLI',
    'OpenHands': 'OpenHands',
    'Hermes Agent': 'Hermes',
    'ISEKAI ZERO': 'ISEKAI',
    'Kilo Code': 'Kilo Code',
    'Roo Code': 'Roo Code',
    'Claw Code': 'Claw Code'
  };
  return abbrevs[name] || (name.length > maxLen ? name.slice(0, maxLen - 1) + '…' : name);
}

function deltaStr(delta) {
  if (delta == null) return '';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}pts`;
}

// Choose template variant based on day of week
function composeTweet1(data, url) {
  const tools = data.tools;
  const top3 = tools.slice(0, 3);
  const date = new Date(data.collected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const biggestMover = [...tools]
    .filter(t => t.momentum_delta_7d != null)
    .reduce((max, t) =>
      Math.abs(t.momentum_delta_7d) > Math.abs(max.momentum_delta_7d ?? 0) ? t : max,
      tools[0]
    );

  const dayOfWeek = new Date(data.collected_at).getDay();

  if (dayOfWeek % 2 === 0 && biggestMover?.momentum_delta_7d) {
    // "Biggest mover" template
    const dir = biggestMover.momentum_delta_7d >= 0 ? 'surged' : 'dropped';
    const abs = Math.abs(biggestMover.momentum_delta_7d);
    const line1 = `🔥 ${shortName(biggestMover.name)} ${dir} ${abs} pts this week.`;
    const line2 = `\nTop 3:\n${top3.map((t, i) => `${i + 1}. ${shortName(t.name)} (${t.momentum_score})`).join('\n')}`;
    const line3 = `\n\n${url}`;
    return (line1 + line2 + line3).slice(0, 277);
  } else {
    // Standard leaderboard template
    const rows = top3.map((t, i) =>
      `#${i + 1} ${shortName(t.name)} (${t.momentum_score}) ${trendEmoji(t.trend)}`
    ).join('\n');
    const moverLine = biggestMover?.momentum_delta_7d != null
      ? `\nBiggest mover: ${shortName(biggestMover.name)} (${deltaStr(biggestMover.momentum_delta_7d)} 7d)`
      : '';
    const header = `📊 Harness Pulse — ${date}\n\n`;
    const footer = `\n\n${url}`;
    return (header + rows + moverLine + footer).slice(0, 277);
  }
}

function composeTweet2(data) {
  const tools = data.tools;

  const topStarGainer = [...tools]
    .filter(t => t.github?.stars_delta_7d != null)
    .sort((a, b) => b.github.stars_delta_7d - a.github.stars_delta_7d)[0];

  const topDl = [...tools]
    .filter(t => t.downloads?.weekly_downloads != null)
    .sort((a, b) => b.downloads.weekly_downloads - a.downloads.weekly_downloads)[0];

  const topDiscussed = [...tools]
    .filter(t => t.community)
    .sort((a, b) => {
      const scoreA = (a.community.hn_stories_7d ?? 0) + (a.community.hn_comments_7d ?? 0) + (a.community.reddit_posts_7d ?? 0);
      const scoreB = (b.community.hn_stories_7d ?? 0) + (b.community.hn_comments_7d ?? 0) + (b.community.reddit_posts_7d ?? 0);
      return scoreB - scoreA;
    })[0];

  const lines = ['The data behind the rankings:\n'];
  if (topStarGainer) lines.push(`⭐ GitHub stars (7d): ${shortName(topStarGainer.name)} +${topStarGainer.github.stars_delta_7d}`);
  if (topDl) lines.push(`📦 Downloads (7d): ${shortName(topDl.name)} ${Math.round((topDl.downloads.weekly_downloads || 0) / 1000)}k`);
  if (topDiscussed) {
    const total = (topDiscussed.community.hn_stories_7d ?? 0) + (topDiscussed.community.hn_comments_7d ?? 0) + (topDiscussed.community.reddit_posts_7d ?? 0);
    lines.push(`💬 Dev buzz: ${shortName(topDiscussed.name)} (${total} HN+Reddit mentions)`);
  }
  lines.push('\nComposite of GitHub, downloads, VS Code installs, community + OpenRouter. Updated daily. Open source.');

  return lines.join('\n').slice(0, 280);
}

function loadTweetHistory() {
  if (!fs.existsSync(TWEET_HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TWEET_HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveTweetHistory(history) {
  fs.writeFileSync(TWEET_HISTORY_FILE, JSON.stringify(history.slice(-14), null, 2));
}

function hashTweet(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function isDuplicate(text, history) {
  const h = hashTweet(text);
  return history.some(entry => entry.hash === h);
}

function countCollectorSuccesses(data) {
  const tools = data.tools;
  const signals = ['github', 'downloads', 'vscode', 'openrouter', 'community'];
  let total = 0, present = 0;
  for (const t of tools) {
    for (const sig of signals) {
      total++;
      if (t[sig] != null) present++;
    }
  }
  return { total, present, ratio: present / total };
}

async function tweet(data) {
  const dashUrl = process.env.DASHBOARD_URL || 'https://harnesspulse.com';

  // Safety: >30% collectors failed → skip
  const { ratio } = countCollectorSuccesses(data);
  if (ratio < 0.7) {
    console.warn(`[tweeter] Skipping tweet — only ${Math.round(ratio * 100)}% of data collected`);
    return false;
  }

  const tweet1Text = composeTweet1(data, dashUrl);
  const tweet2Text = composeTweet2(data);

  const history = loadTweetHistory();

  if (isDuplicate(tweet1Text, history)) {
    console.warn('[tweeter] Duplicate content detected — skipping tweet');
    return false;
  }

  const client = twitterClient();

  try {
    console.log('[tweeter] Posting tweet 1...');
    const t1 = await client.v2.tweet(tweet1Text);

    console.log('[tweeter] Posting tweet 2 (reply)...');
    await client.v2.tweet(tweet2Text, { reply: { in_reply_to_tweet_id: t1.data.id } });

    history.push({
      hash: hashTweet(tweet1Text),
      date: new Date().toISOString(),
      text: tweet1Text.slice(0, 80) + '…'
    });
    saveTweetHistory(history);

    console.log(`[tweeter] Tweeted successfully. Tweet ID: ${t1.data.id}`);
    return true;
  } catch (err) {
    console.error(`[tweeter] Tweet failed: ${err.message}`);
    return false;
  }
}

module.exports = { tweet, composeTweet1, composeTweet2 };
