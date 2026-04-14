'use strict';

const { loadLatest } = require('./historical');

const SURGE_THRESHOLD = 10; // pts in 24h

async function sendTelegramAlert(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || '39172309';
  if (!botToken) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
  });
}

async function checkSurges(currentData, previousData) {
  const prev24h = previousData?.['7d']; // closest we have to 24h without a dedicated slot
  if (!prev24h) return;

  const surges = [];
  for (const tool of currentData.tools) {
    if (tool.momentum_delta_7d == null) continue;
    const absDelta = Math.abs(tool.momentum_delta_7d);
    if (absDelta >= SURGE_THRESHOLD) {
      surges.push(tool);
    }
  }

  if (!surges.length) return;

  const lines = surges.map(t => {
    const dir = t.momentum_delta_7d > 0 ? '+' : '';
    const arrow = t.momentum_delta_7d > 0 ? '▲' : '▼';
    return `${arrow} <b>${t.name}</b>: ${dir}${t.momentum_delta_7d}pts (score: ${t.momentum_score})`;
  }).join('\n');

  const msg = `<b>Harness Pulse - Surge Alert</b>\n\n${lines}\n\n<a href="${process.env.DASHBOARD_URL || 'https://mrb.sh/hp'}">View dashboard</a>`;

  console.log(`[surge-alerts] ${surges.length} surge(s) detected`);
  await sendTelegramAlert(msg);
}

module.exports = { checkSurges };
