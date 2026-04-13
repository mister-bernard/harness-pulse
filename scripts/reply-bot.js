#!/usr/bin/env node
/**
 * Harness Pulse Reply Bot
 * Checks @mrb_signal mentions every minute, auto-replies using Claude.
 * Rate cost: ~60 reads/hour vs 1200/hour free tier limit — well within budget.
 *
 * State: data/reply-bot-state.json
 * Usage: node scripts/reply-bot.js [--once]
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const STATE_FILE = path.join(__dirname, '..', 'data', 'reply-bot-state.json');
const INTERVAL_MS = 60 * 1000; // 1 minute

const MY_USER_ID = '2027171957880549376'; // @mrb_signal

// G's accounts — never auto-reply to the operator
const SKIP_USERNAMES = new Set(['gmacd', 'gmacd_', 'g_rre_tt']);

// Hard spam signals — skip without calling Claude
const SPAM_PATTERNS = [
  /blockchain|crypto|token|airdrop|nft|defi|presale|pump/i,
  /dm me|check (my |bio|link)|click (here|link)|t\.co\/\S+\s*$/i,
  /\b(earn|profit|investment|passive income|roi)\b/i,
  /SPECIAL NOTICE|URGENT|FREE MONEY/i,
];

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
});

// --- State ---

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { since_id: null, replied_ids: [] }; }
}

function saveState(state) {
  state.replied_ids = (state.replied_ids || []).slice(-500);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Spam check ---

function isSpam(text) {
  return SPAM_PATTERNS.some(p => p.test(text));
}

// --- Claude reply ---

async function composeReply(mentionText, authorUsername) {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789/v1';
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;

  const systemPrompt = `You are Mr. Bernard (@mrb_signal). You run The Harness Pulse, a daily dashboard tracking real AI coding tool adoption via GitHub stars, npm downloads, VS Code installs, and community mentions.

Reply rules:
- 1-2 sentences max. Direct, data-literate tone. No cheerleading.
- No hashtags. ASCII only. Don't include @mentions in your reply.
- Don't start with "I" or sycophantic openers.
- If the comment is off-topic, promotional, or spam, output exactly: SKIP
- Output only the reply text itself — no preamble, no quotes, no "Here's a reply:".`;

  const userPrompt = `Someone replied to your tweet about The Harness Pulse.

@${authorUsername} said: "${mentionText}"

Reply:`;

  try {
    const res = await fetch(`${gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        model: 'openclaw/fast-dm',
        max_tokens: 100,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!res.ok) { console.error(`[reply-bot] Claude error ${res.status}`); return null; }

    const data = await res.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || '';

    // Strip any leaked preamble
    reply = reply.replace(/^(here'?s? (a |my )?reply:?\s*|reply:\s*|>?\s*)/gi, '').trim();
    reply = reply.replace(/^["']|["']$/g, '').trim();

    if (!reply || reply.toUpperCase() === 'SKIP') return null;
    return reply.slice(0, 260);
  } catch (err) {
    console.error(`[reply-bot] Claude error: ${err.message}`);
    return null;
  }
}

// --- Sanitize for Twitter ---

function sanitize(text) {
  return text
    .replace(/[\u2192]/g, '->')  // →
    .replace(/[\u2190]/g, '<-')  // ←
    .replace(/[\u2014]/g, '-')   // —
    .replace(/[\u2013]/g, '-')   // –
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x00-\x7F]/g, '') // strip any remaining non-ASCII
    .trim();
}

// --- Main ---

async function checkAndReply() {
  const state = loadState();
  const ts = () => new Date().toISOString().slice(11, 19); // HH:MM:SS

  try {
    const params = {
      max_results: 20,
      'tweet.fields': ['author_id', 'created_at', 'text'],
      'user.fields': ['username'],
      expansions: ['author_id']
    };
    if (state.since_id) params.since_id = state.since_id;

    const timeline = await twitterClient.v2.userMentionTimeline(MY_USER_ID, params);
    const mentions = timeline.data?.data || [];
    const users = {};
    for (const u of (timeline.data?.includes?.users || [])) users[u.id] = u.username;

    if (mentions.length === 0) { process.stdout.write('.'); return; }

    console.log(`\n[${ts()}] ${mentions.length} new mention(s)`);

    // Advance since_id
    const newestId = mentions[0].id;
    if (!state.since_id || BigInt(newestId) > BigInt(state.since_id)) state.since_id = newestId;

    for (const mention of mentions) {
      if (mention.author_id === MY_USER_ID) continue;
      if (state.replied_ids.includes(mention.id)) continue;

      const username = users[mention.author_id] || 'unknown';
      const cleanText = mention.text.replace(/@mrb_signal\s*/gi, '').trim();

      // Skip G
      if (SKIP_USERNAMES.has(username.toLowerCase())) {
        console.log(`[${ts()}] Skipping G (@${username})`);
        state.replied_ids.push(mention.id);
        continue;
      }

      // Hard spam filter
      if (isSpam(cleanText)) {
        console.log(`[${ts()}] Spam skip: @${username}: ${cleanText.slice(0, 60)}`);
        state.replied_ids.push(mention.id);
        continue;
      }

      console.log(`[${ts()}] @${username}: ${cleanText.slice(0, 100)}`);

      const reply = await composeReply(cleanText, username);
      if (!reply) {
        console.log(`[${ts()}] Skipped (Claude said SKIP or error)`);
        state.replied_ids.push(mention.id);
        saveState(state);
        continue;
      }

      const tweetText = sanitize(`@${username} ${reply}`);
      console.log(`[${ts()}] Replying: ${tweetText}`);

      try {
        const posted = await twitterClient.v2.tweet(tweetText, {
          reply: { in_reply_to_tweet_id: mention.id }
        });
        console.log(`[${ts()}] Posted: https://x.com/mrb_signal/status/${posted.data.id}`);
        state.replied_ids.push(mention.id);
      } catch (err) {
        console.error(`[${ts()}] Tweet failed: ${err.message}`);
      }

      saveState(state);
      await new Promise(r => setTimeout(r, 2000));
    }

    saveState(state);
  } catch (err) {
    console.error(`\n[${ts()}] Check failed: ${err.message}`);
  }
}

// --- Entry ---

const runOnce = process.argv.includes('--once');

if (runOnce) {
  checkAndReply().then(() => process.exit(0));
} else {
  console.log(`[reply-bot] Started. Polling every ${INTERVAL_MS / 1000}s.`);
  checkAndReply();
  setInterval(checkAndReply, INTERVAL_MS);
}
