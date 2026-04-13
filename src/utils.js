'use strict';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry 4xx (except 429)
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
        console.warn(`[fetch] Rate limited. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        await sleep(1000 * Math.pow(2, attempt)); // exponential backoff
      }
    }
  }
  throw lastErr;
}

function formatNumber(n) {
  if (n == null) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

module.exports = { sleep, fetchWithRetry, formatNumber, formatDate, daysSince };
