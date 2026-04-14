'use strict';

require('dotenv').config({ override: true });

const { tools } = require('./config');
const githubCollector      = require('./collectors/github');
const starHistoryCollector = require('./collectors/github-star-history');
const npmCollector         = require('./collectors/npm-downloads');
const pypiCollector        = require('./collectors/pypi-downloads');
const vscodeCollector      = require('./collectors/vscode-marketplace');
const jetbrainsCollector   = require('./collectors/jetbrains');
const dockerCollector      = require('./collectors/docker');
const openrouterCollector  = require('./collectors/openrouter');
const communityCollector   = require('./collectors/hackernews-reddit');
const soCollector          = require('./collectors/stackoverflow');
const trendsCollector      = require('./collectors/google-trends');
const { aggregate }        = require('./aggregator');
const { calculateScores }  = require('./scorer');
const milestoneTracker     = require('./milestone-tracker');
const surgeAlerts          = require('./surge-alerts');
const { postWeeklyThread } = require('./weekly-thread');
const {
  loadPreviousSnapshots, enrichStarDeltas,
  loadTrendHistory, saveSnapshot, validate
} = require('./historical');
const { writeSite } = require('./renderer');
const { tweet }    = require('./tweeter');
const { exec }     = require('child_process');
const path         = require('path');

async function sendAlert(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID || '39172309';
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `Harness Pulse: ${message}` })
    });
  } catch { /* best effort */ }
}

async function runPipeline() {
  const start = Date.now();
  const ts = () => `[${new Date().toISOString()}]`;
  console.log(`${ts()} Starting daily collection pipeline...`);

  try {
    // 1. Collect all sources in parallel
    console.log('[pipeline] Running collectors...');
    const safe = fn => fn.catch(err => { console.error(err.message); return {}; });

    const [github, npm, pypi, vscode, jetbrains, docker, openrouter, community, stackoverflow] = await Promise.all([
      safe(githubCollector.collect(tools)),
      safe(npmCollector.collect(tools)),
      safe(pypiCollector.collect(tools)),
      safe(vscodeCollector.collect(tools)),
      safe(jetbrainsCollector.collect(tools)),
      safe(dockerCollector.collect(tools)),
      safe(openrouterCollector.collect(tools)),
      safe(communityCollector.collect(tools)),
      safe(soCollector.collect(tools)),
    ]);

    // Google Trends runs serially (rate sensitive) — run after parallel batch
    let trends = {};
    try { trends = await trendsCollector.collect(tools); }
    catch (err) { console.warn('[trends] Skipped:', err.message); }

    // 2. Enrich GitHub with actual star velocity
    let enrichedGithub = github;
    try { enrichedGithub = await starHistoryCollector.enrich(github, tools); }
    catch (err) { console.warn('[star-history] Skipped:', err.message); }

    // 3. Load previous snapshots for deltas
    const previousData = loadPreviousSnapshots();

    // 4. Aggregate + enrich legacy star deltas from snapshots
    let data = aggregate({ github: enrichedGithub, npm, pypi, vscode, jetbrains, docker, openrouter, community, stackoverflow, trends });
    data = enrichStarDeltas(data, previousData);

    // 5. Score
    console.log('[pipeline] Scoring...');
    const scored = calculateScores(data, previousData);

    // 6. Validate
    const { valid, errors } = validate(scored, previousData);
    if (!valid) {
      console.warn('[pipeline] Validation warnings:', errors);
      await sendAlert(`Validation: ${errors.join(', ')}`);
    }

    // 7. Save snapshot
    saveSnapshot(scored);

    // 8. Render
    console.log('[pipeline] Rendering site...');
    const slugs = tools.map(t => t.slug);
    const trendHistory = loadTrendHistory(slugs);
    writeSite(scored, trendHistory);

    // 9. Deploy
    console.log('[pipeline] Deploying site...');
    await deploySite();

    // 10. Tweet daily update
    await tweet(scored);

    // 11. Milestone tweets
    await milestoneTracker.run(scored);

    // 12. Surge alerts to Telegram
    await surgeAlerts.checkSurges(scored, previousData);

    // 13. Weekly thread (Sundays only)
    await postWeeklyThread();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`${ts()} Pipeline complete in ${elapsed}s`);

  } catch (err) {
    console.error(`${ts()} Pipeline failed:`, err);
    await sendAlert(`Pipeline failed: ${err.message}`);
  }
}

function deploySite() {
  return new Promise(resolve => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'deploy-site.sh');
    exec(`bash "${scriptPath}"`, (err, stdout, stderr) => {
      if (err) console.error('[deploy] Failed:', stderr);
      else console.log('[deploy]', stdout.trim());
      resolve();
    });
  });
}

module.exports = { runPipeline };
