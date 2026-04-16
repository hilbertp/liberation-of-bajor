#!/usr/bin/env node
/**
 * usage-snapshot.js
 * Calls claude.ai usage API and optionally logs a delta entry to timesheet.jsonl.
 *
 * Usage:
 *   node usage-snapshot.js --session-key "sk-ant-sid02-..." [--log] [--silent]
 *
 * Or set env var:
 *   CLAUDE_SESSION_KEY="sk-ant-sid02-..." node usage-snapshot.js [--log]
 *
 * Or store in bridge/bridge.config.json → coworkSessionKey
 *
 * --log     appends a snapshot entry to bridge/timesheet.jsonl
 * --silent  suppress all stdout output
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ORG_ID = 'cff23f1b-5c33-4c40-8e81-453be39aed7d';
const USAGE_URL = `https://claude.ai/api/organizations/${ORG_ID}/usage`;
const TIMESHEET = path.join(__dirname, 'timesheet-watcher.jsonl');
const SNAPSHOT_FILE = path.join(__dirname, '.usage-snapshot.json');
const CONFIG_FILE = path.join(__dirname, 'bridge.config.json');
const LOG_FILE = path.join(__dirname, 'bridge.log');

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const doLog = args.includes('--log');
const silent = args.includes('--silent');
const sessionKeyArg = (() => {
  const idx = args.indexOf('--session-key');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ── Resolve session key: CLI arg → env var → config file ────────────────────
function resolveSessionKey() {
  if (sessionKeyArg) return sessionKeyArg;
  if (process.env.CLAUDE_SESSION_KEY) return process.env.CLAUDE_SESSION_KEY;
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (config.coworkSessionKey) return config.coworkSessionKey;
  } catch (_) {
    // Config file missing or malformed — fall through
  }
  return null;
}

const sessionKey = resolveSessionKey();

// ── Logging helper ──────────────────────────────────────────────────────────
function logWarning(reason) {
  const line = `[${new Date().toISOString()}] usage-snapshot WARN: ${reason}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) { /* best-effort */ }
}

if (!sessionKey) {
  logWarning('No session key found (checked --session-key, CLAUDE_SESSION_KEY, bridge.config.json)');
  process.exit(0);
}

// Strip the "sessionKey=" prefix if the user pasted the full cookie string
const rawKey = sessionKey.startsWith('sessionKey=')
  ? sessionKey.split(';')[0].replace('sessionKey=', '')
  : sessionKey;

// ── Fetch usage ──────────────────────────────────────────────────────────────
function fetchUsage() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'claude.ai',
      path: `/api/organizations/${ORG_ID}/usage`,
      method: 'GET',
      headers: {
        'cookie': `sessionKey=${rawKey}`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://claude.ai/',
        'anthropic-client-platform': 'web_claude_ai',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function centsToEur(cents) {
  return (cents / 100).toFixed(2);
}

function formatSnapshot(raw) {
  const five = raw.five_hour || {};
  const extra = raw.extra_usage || {};
  const seven = raw.seven_day || {};

  return {
    ts: new Date().toISOString(),
    // Rolling 5-hour window (API returns utilization % and resets_at)
    five_hour: {
      utilization: five.utilization ?? null,
      resets_at: five.resets_at ?? null,
      pct: five.utilization != null ? String(five.utilization) : null,
    },
    // 7-day rolling usage (API returns utilization % and resets_at)
    monthly: {
      utilization: seven.utilization ?? null,
      resets_at: seven.resets_at ?? null,
    },
    // Extra (pay-as-you-go overage)
    extra: {
      used_eur: extra.used_credits != null ? centsToEur(extra.used_credits) : null,
      limit_eur: extra.monthly_limit != null ? centsToEur(extra.monthly_limit) : null,
    },
    _raw: raw,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  let raw;
  try {
    raw = await fetchUsage();
  } catch (err) {
    logWarning(err.message);
    process.exit(0);
  }

  const snap = formatSnapshot(raw);

  // Pretty-print current state (unless --silent)
  if (!silent) {
    console.log('\n=== claude.ai usage snapshot', snap.ts, '===');
    if (snap.five_hour.utilization != null) {
      console.log(`  5-hour window : ${snap.five_hour.utilization}%  (resets ${snap.five_hour.resets_at || 'unknown'})`);
    }
    if (snap.monthly.utilization != null) {
      console.log(`  7-day rolling : ${snap.monthly.utilization}%  (resets ${snap.monthly.resets_at || 'unknown'})`);
    }
    if (snap.extra.used_eur != null) {
      console.log(`  Extra (overage): €${snap.extra.used_eur} / €${snap.extra.limit_eur}`);
    }
  }

  // Delta against previous snapshot
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const prev = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    const deltaFive = snap.five_hour.utilization != null && prev.five_hour?.utilization != null
      ? snap.five_hour.utilization - prev.five_hour.utilization
      : null;
    const deltaExtra = snap.extra.used_eur != null && prev.extra?.used_eur != null
      ? (parseFloat(snap.extra.used_eur) - parseFloat(prev.extra.used_eur)).toFixed(2)
      : null;

    if (!silent) {
      console.log('\n  --- delta since last snapshot', prev.ts, '---');
      if (deltaFive !== null) console.log(`  5h utilization : ${deltaFive >= 0 ? '+' : ''}${deltaFive}%`);
      if (deltaExtra !== null) console.log(`  Extra spend    : +€${deltaExtra}`);
    }

    if (doLog && (deltaFive !== null || deltaExtra !== null)) {
      const entry = {
        source: 'usage-snapshot',
        ts: snap.ts,
        ts_prev: prev.ts,
        five_hour_delta: deltaFive,
        extra_eur_delta: deltaExtra != null ? parseFloat(deltaExtra) : null,
        five_hour_pct: snap.five_hour.utilization,
        extra_eur_total: snap.extra.used_eur != null ? parseFloat(snap.extra.used_eur) : null,
      };
      fs.appendFileSync(TIMESHEET, JSON.stringify(entry) + '\n');
      // Rebuild merged view so readers see the new entry
      try { require('./slicelog').rebuildMerged('timesheet'); } catch (_) {}
      if (!silent) {
        console.log('\n  ✓ delta logged to timesheet-watcher.jsonl');
      }
    }
  }

  // Save current as new baseline
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 2));
  if (!silent) {
    console.log('  ✓ snapshot saved to bridge/.usage-snapshot.json\n');
  }
})();
