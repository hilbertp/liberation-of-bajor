'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT       = process.env.DASHBOARD_PORT ? parseInt(process.env.DASHBOARD_PORT, 10) : 4747;
const HOST       = process.env.DASHBOARD_HOST ?? '0.0.0.0';
const REPO_ROOT  = path.resolve(__dirname, '..');
const QUEUE_DIR  = path.join(REPO_ROOT, 'bridge', 'queue');
const HEARTBEAT  = path.join(REPO_ROOT, 'bridge', 'heartbeat.json');
const REGISTER   = path.join(REPO_ROOT, 'bridge', 'register.jsonl');
const DASHBOARD  = path.join(__dirname, 'lcars-dashboard.html');

// ── Frontmatter parser ───────────────────────────────────────────────────────
// Extracts key:value pairs from the YAML block between the first two `---` lines.
function parseFrontmatter(text) {
  const lines = text.split('\n');
  let inside = false;
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '---') {
      if (!inside) { inside = true; continue; }
      else { break; }
    }
    if (!inside) continue;
    // Skip comment lines
    if (trimmed.startsWith('<!--')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    let val = trimmed.slice(colon + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

// ── Register reader ──────────────────────────────────────────────────────────
function readRegister() {
  try {
    const raw = fs.readFileSync(REGISTER, 'utf8');
    return raw.split('\n').filter(l => l.trim()).map(l => {
      try { return JSON.parse(l); } catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) { return []; }
}

// ── Register writer ──────────────────────────────────────────────────────────
function writeRegisterEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n';
  fs.appendFileSync(REGISTER, line, 'utf8');
}

// ── Bridge data builder ──────────────────────────────────────────────────────
function buildBridgeData() {
  // Heartbeat
  let heartbeat = { ts: null, status: 'down', current_commission: null,
                    commission_elapsed_seconds: null, processed_total: 0 };
  try {
    const raw = JSON.parse(fs.readFileSync(HEARTBEAT, 'utf8'));
    const age = raw.ts ? (Date.now() - new Date(raw.ts).getTime()) / 1000 : Infinity;
    heartbeat = {
      ts:                        raw.ts   ?? null,
      status:                    age < 60 ? (raw.status ?? 'idle') : 'down',
      current_commission:        raw.current_commission ?? null,
      commission_elapsed_seconds: raw.commission_elapsed_seconds ?? null,
      processed_total:           raw.processed_total ?? 0,
    };
  } catch (_) { /* file missing or malformed → keep defaults */ }

  // Register events
  const events = readRegister();

  // Index COMMISSIONED events by id for goal lookup and recent title
  const commissioned = {};
  for (const ev of events) {
    if (ev.event === 'COMMISSIONED') commissioned[ev.id] = ev;
  }

  // Build recent (last 10 completed) and economics from DONE/ERROR events
  const completedMap = {};
  const reviewedMap  = {};
  const economics = { totalTokensIn: 0, totalTokensOut: 0, totalCostUsd: 0, totalCommissions: 0 };
  for (const ev of events) {
    if (ev.event === 'DONE' || ev.event === 'ERROR') {
      completedMap[ev.id] = {
        id:          ev.id,
        title:       commissioned[ev.id]?.title ?? null,
        outcome:     ev.event,
        durationMs:  ev.durationMs  ?? null,
        tokensIn:    ev.tokensIn    ?? null,
        tokensOut:   ev.tokensOut   ?? null,
        costUsd:     ev.costUsd     ?? null,
        completedAt: ev.ts          ?? null,
      };
      if (ev.event === 'DONE') {
        economics.totalTokensIn  += ev.tokensIn  ?? 0;
        economics.totalTokensOut += ev.tokensOut ?? 0;
        economics.totalCostUsd   += ev.costUsd   ?? 0;
        economics.totalCommissions++;
      }
    }
    if (ev.event === 'REVIEWED') {
      reviewedMap[ev.id] = ev.verdict;
    }
  }
  const recent = Object.values(completedMap)
    .sort((a, b) => {
      if (!a.completedAt) return 1;
      if (!b.completedAt) return -1;
      return new Date(b.completedAt) - new Date(a.completedAt);
    })
    .slice(0, 10)
    .map(entry => {
      const verdict = reviewedMap[entry.id];
      let reviewStatus;
      if (verdict === 'ACCEPTED')           reviewStatus = 'accepted';
      else if (verdict === 'AMENDMENT_REQUIRED') reviewStatus = 'amendment_required';
      else                                  reviewStatus = 'waiting_for_review';
      return { ...entry, reviewStatus };
    });

  // Queue files
  let files = [];
  try { files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.md')); }
  catch (_) {}

  const queue = { waiting: 0, active: 0, done: 0, error: 0 };
  const commissions = [];

  for (const filename of files) {
    // Derive state from filename suffix: {id}-{STATE}.md
    const match = filename.match(/^(.+?)-(PENDING|IN_PROGRESS|DONE|ERROR)\.md$/);
    if (!match) continue;
    const [, , state] = match;

    switch (state) {
      case 'PENDING':     queue.waiting++; break;
      case 'IN_PROGRESS': queue.active++;  break;
      case 'DONE':        queue.done++;    break;
      case 'ERROR':       queue.error++;   break;
    }

    let fm = {};
    try {
      const content = fs.readFileSync(path.join(QUEUE_DIR, filename), 'utf8');
      fm = parseFrontmatter(content);
    } catch (_) {}

    const id = fm.id ?? match[1];
    const goalFromRegister = commissioned[id]?.goal ?? null;
    const goalFromFm       = fm.goal ?? null;

    commissions.push({
      id,
      title:     fm.title     ?? filename,
      state,
      from:      fm.from      ?? null,
      created:   fm.created   ?? null,
      completed: fm.completed ?? null,
      goal:      goalFromRegister ?? goalFromFm,
    });
  }

  // Sort by numeric ID descending
  commissions.sort((a, b) => {
    const na = parseInt(a.id, 10);
    const nb = parseInt(b.id, 10);
    if (!isNaN(na) && !isNaN(nb)) return nb - na;
    return b.id.localeCompare(a.id);
  });

  return { heartbeat, queue, commissions, recent, economics };
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (pathname === '/' || pathname === '/index.html') {
    fs.readFile(DASHBOARD, (err, data) => {
      if (err) { res.writeHead(500); res.end('Internal Server Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (pathname === '/api/bridge') {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  'https://dax-dashboard.lovable.app',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    let data;
    try { data = buildBridgeData(); }
    catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: String(err) })); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/bridge/review') {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain', ...corsHeaders });
      res.end('Method Not Allowed');
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { id, verdict, notes } = payload;
      if (!id || !verdict) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: 'id and verdict are required' }));
        return;
      }
      const validVerdicts = ['ACCEPTED', 'AMENDMENT_REQUIRED'];
      if (!validVerdicts.includes(verdict)) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: `verdict must be one of: ${validVerdicts.join(', ')}` }));
        return;
      }

      try {
        writeRegisterEvent({ id, event: 'REVIEWED', verdict, ...(notes != null ? { notes } : {}) });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ error: String(err) }));
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`LCARS dashboard server running at http://${HOST}:${PORT}`);
});
