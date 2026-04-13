'use strict';

require('dotenv').config();

const { tools } = require('./config');
const githubCollector = require('./collectors/github');
const npmCollector = require('./collectors/npm-downloads');
const pypiCollector = require('./collectors/pypi-downloads');
const vscodeCollector = require('./collectors/vscode-marketplace');
const openrouterCollector = require('./collectors/openrouter');
const communityCollector = require('./collectors/hackernews-reddit');
const { aggregate } = require('./aggregator');
const { calculateScores } = require('./scorer');
const {
  loadPreviousSnapshots,
  enrichStarDeltas,
  loadTrendHistory,
  saveSnapshot,
  validate
} = require('./historical');
const { writeSite } = require('./renderer');
const { tweet } = require('./tweeter');
const { exec } = require('child_process');
const path = require('path');

async function sendAlert(message) {
  // Telegram alert via existing infrastructure
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.G_TELEGRAM_ID;
  if (!botToken || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🔴 Harness Pulse: ${message}` })
    });
  } catch {
    // best effort
  }
}

async function runPipeline() {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Starting daily collection pipeline...`);

  try {
    // 1. Run collectors in parallel where possible
    console.log('[pipeline] Running collectors...');
    const [github, npm, pypi, vscode, openrouter, community] = await Promise.all([
      githubCollector.collect(tools).catch(err => { console.error('[github] Fatal:', err.message); return {}; }),
      npmCollector.collect(tools).catch(err => { console.error('[npm] Fatal:', err.message); return {}; }),
      pypiCollector.collect(tools).catch(err => { console.error('[pypi] Fatal:', err.message); return {}; }),
      vscodeCollector.collect(tools).catch(err => { console.error('[vscode] Fatal:', err.message); return {}; }),
      openrouterCollector.collect(tools).catch(err => { console.error('[openrouter] Fatal:', err.message); return {}; }),
      communityCollector.collect(tools).catch(err => { console.error('[community] Fatal:', err.message); return {}; })
    ]);

    // 2. Load previous snapshots for deltas
    const previousData = loadPreviousSnapshots();

    // 3. Aggregate
    console.log('[pipeline] Aggregating...');
    let data = aggregate({ github, npm, pypi, vscode, openrouter, community });

    // 4. Enrich with star deltas
    data = enrichStarDeltas(data, previousData);

    // 5. Score
    console.log('[pipeline] Scoring...');
    const scored = calculateScores(data, previousData);

    // 6. Validate
    const { valid, errors } = validate(scored, previousData);
    if (!valid) {
      console.warn('[pipeline] Validation warnings:', errors);
      await sendAlert(`Validation warnings: ${errors.join(', ')}`);
    }

    // 7. Save snapshot
    saveSnapshot(scored);

    // 8. Load trend history for chart
    const slugs = tools.map(t => t.slug);
    const trendHistory = loadTrendHistory(slugs);

    // 9. Render dashboard
    console.log('[pipeline] Rendering site...');
    writeSite(scored, trendHistory);

    // 10. Deploy site
    console.log('[pipeline] Deploying site...');
    await deploySite();

    // 11. Tweet
    console.log('[pipeline] Tweeting...');
    await tweet(scored);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[${new Date().toISOString()}] Pipeline complete in ${elapsed}s`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Pipeline failed:`, err);
    await sendAlert(`Pipeline failed: ${err.message}`);
  }
}

function deploySite() {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy-site.sh');
    exec(`bash "${scriptPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('[deploy] Failed:', stderr);
      } else {
        console.log('[deploy]', stdout.trim());
      }
      resolve(); // non-fatal — site is still served locally
    });
  });
}

module.exports = { runPipeline };
