'use strict';

/**
 * stale-done-filter.test.js
 *
 * Regression tests for stale DONE filtering in the Queue panel.
 *
 * Slice 228 introduced mtime-based staleness. Slice 229 switched to
 * frontmatter `completed` field (immune to mtime refresh by recovery ops)
 * with mtime as fallback when `completed` is missing/unparseable.
 *
 * Run: node test/stale-done-filter.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const { STALE_DONE_DAYS, parseFrontmatter } = require('../dashboard/server');

// ── Mirror of the completed/mtime-based filter from buildBridgeData() ────────

const TERMINAL_FILE_RE = /^(.+?)-(ACCEPTED|ARCHIVED|ERROR|STUCK|SLICE)\.md$/;
const QUEUE_FILE_RE    = /^(.+?)-(PENDING|QUEUED|IN_PROGRESS|DONE|ERROR)\.md$/;

function filterQueueSlices(queueDir, files, parsedFm = {}) {
  const terminalIds = new Set();
  for (const f of files) {
    const m = f.match(TERMINAL_FILE_RE);
    if (m) terminalIds.add(String(m[1]));
  }

  const staleCutoff = STALE_DONE_DAYS * 86400 * 1000;
  const result = [];
  for (const f of files) {
    const m = f.match(QUEUE_FILE_RE);
    if (!m) continue;
    const [, rawId, state] = m;
    if (terminalIds.has(rawId)) continue;

    // Stale DONE filter (mirrors dashboard/server.js slice 229)
    if (state === 'DONE') {
      const fm0 = parsedFm[f] || {};
      const completedMs = fm0.completed ? new Date(fm0.completed).getTime() : NaN;
      if (!isNaN(completedMs)) {
        if (Date.now() - completedMs > staleCutoff) continue;
      } else {
        try {
          const mtimeMs = fs.statSync(path.join(queueDir, f)).mtimeMs;
          if (Date.now() - mtimeMs > staleCutoff) continue;
        } catch (_) {}
      }
    }

    result.push({ id: rawId, state });
  }
  return result;
}

// ── Helper: build frontmatter text ──────────────────────────────────────────

function makeDoneFile(id, completedIso) {
  const completedLine = completedIso ? `completed: "${completedIso}"\n` : '';
  return `---\nid: "${id}"\ntitle: "test"\nstatus: "DONE"\n${completedLine}---\nBody.\n`;
}

// ── Setup: temporary queue directory ────────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-done-test-'));
const parsedFm = {};

// Case 1: completed 8 days ago, mtime is recent → EXCLUDED (frontmatter wins)
const case1 = '501-DONE.md';
const eightDaysAgo = new Date(Date.now() - 8 * 86400 * 1000).toISOString();
fs.writeFileSync(path.join(tmpDir, case1), makeDoneFile('501', eightDaysAgo));
// mtime is "now" (just written) — but completed says 8 days ago
parsedFm[case1] = parseFrontmatter(fs.readFileSync(path.join(tmpDir, case1), 'utf8'));

// Case 2: completed 1 day ago → INCLUDED
const case2 = '502-DONE.md';
const oneDayAgo = new Date(Date.now() - 1 * 86400 * 1000).toISOString();
fs.writeFileSync(path.join(tmpDir, case2), makeDoneFile('502', oneDayAgo));
parsedFm[case2] = parseFrontmatter(fs.readFileSync(path.join(tmpDir, case2), 'utf8'));

// Case 3: no completed field, mtime < 8 days → INCLUDED (fallback path)
const case3 = '503-DONE.md';
fs.writeFileSync(path.join(tmpDir, case3), makeDoneFile('503', null));
const recentTime = new Date(Date.now() - 2 * 86400 * 1000);
fs.utimesSync(path.join(tmpDir, case3), recentTime, recentTime);
parsedFm[case3] = parseFrontmatter(fs.readFileSync(path.join(tmpDir, case3), 'utf8'));

// Case 4: no completed field, mtime > 8 days → EXCLUDED (fallback path)
const case4 = '504-DONE.md';
fs.writeFileSync(path.join(tmpDir, case4), makeDoneFile('504', null));
const oldTime = new Date(Date.now() - 10 * 86400 * 1000);
fs.utimesSync(path.join(tmpDir, case4), oldTime, oldTime);
parsedFm[case4] = parseFrontmatter(fs.readFileSync(path.join(tmpDir, case4), 'utf8'));

// Non-DONE slices (unaffected)
fs.writeFileSync(path.join(tmpDir, '505-IN_PROGRESS.md'), '---\nid: "505"\nstatus: "IN_PROGRESS"\n---\n');
fs.writeFileSync(path.join(tmpDir, '506-QUEUED.md'), '---\nid: "506"\nstatus: "QUEUED"\n---\n');

const allFiles = fs.readdirSync(tmpDir);
const queue = filterQueueSlices(tmpDir, allFiles, parsedFm);
const ids = new Set(queue.map(s => s.id));

// ── Test 1: completed 8 days ago + recent mtime → excluded ─────────────────

assert.ok(!ids.has('501'),
  'DONE with completed >7 days ago must be excluded even if mtime is recent');

// ── Test 2: completed 1 day ago → included ─────────────────────────────────

assert.ok(ids.has('502'),
  'DONE with completed <7 days ago must be included');

// ── Test 3: no completed, mtime < 8 days → included (fallback) ────────────

assert.ok(ids.has('503'),
  'DONE without completed field but recent mtime must be included (fallback)');

// ── Test 4: no completed, mtime > 8 days → excluded (fallback) ────────────

assert.ok(!ids.has('504'),
  'DONE without completed field and old mtime must be excluded (fallback)');

// ── Test 5: non-DONE states unaffected ─────────────────────────────────────

assert.ok(ids.has('505'), 'IN_PROGRESS slice must appear regardless');
assert.ok(ids.has('506'), 'QUEUED slice must appear regardless');

// ── Test 6: correct count ──────────────────────────────────────────────────

assert.strictEqual(queue.length, 4,
  'Queue should contain 4 slices (502 + 503 + 505 + 506)');

// ── Test 7: STALE_DONE_DAYS constant is 7 ─────────────────────────────────

assert.strictEqual(STALE_DONE_DAYS, 7, 'STALE_DONE_DAYS should be 7');

// ── Cleanup ────────────────────────────────────────────────────────────────

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('stale-done-filter.test.js: all 7 tests passed');
