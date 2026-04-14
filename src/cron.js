'use strict';

// dotenv loaded per-run in pipeline.js
const cron = require('node-cron');
const { runPipeline } = require('./pipeline');

console.log(`[harness-pulse] Starting cron scheduler...`);

// Run daily at 06:00 UTC
cron.schedule('0 6 * * *', async () => {
  await runPipeline();
}, { timezone: 'UTC' });

console.log('[harness-pulse] Scheduled: daily at 06:00 UTC');
console.log('[harness-pulse] Run `node src/run-once.js` to trigger manually.');
