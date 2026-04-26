'use strict';

/**
 * stale-done-filter.test.js
 *
 * Regression test for slice 228 — mtime-based stale DONE filtering.
 *
 * Creates a temporary queue directory with two DONE files:
 *   - fresh DONE (1 hour old)  → should appear in Queue panel
 *   - stale DONE (10 days old) → should be excluded from Queue panel
 *
 * Also verifies that non-DONE states are unaffected by the mtime filter.
 *
 * Run: node test/stale-done-filter.test.js
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const { STALE_DONE_DAYS } = require('../dashboard/server');

// ── Mirror of the mtime-based filter from buildBridgeData() ─────────────────

const TERMINAL_FILE_RE = /^(.+?)-(ACCEPTED|ARCHIVED|ERROR|STUCK|SLICE)\.md$/;
const QUEUE_FILE_RE    = /^(.+?)-(PENDING|QUEUED|IN_PROGRESS|DONE|ERROR)\.md$/;

function filterQueueSlices(queueDir, files, events = []) {
  const mergedIds = new Set();
  for (const ev of events) {
    if (ev.event === 'MERGED') mergedIds.add(String(ev.id));
  }

  const terminalIds = new Set(mergedIds);
  for (const f of files) {
    const m = f.match(TERMINAL_FILE_RE);
    if (m) terminalIds.add(String(m[1]));
  }

  const result = [];
  for (const f of files) {
    const m = f.match(QUEUE_FILE_RE);
    if (!m) continue;
    const [, rawId, state] = m;
    if (terminalIds.has(rawId)) continue;

    // Stale DONE filter (mirrors dashboard/server.js slice 228)
    if (state === 'DONE') {
      try {
        const mtimeMs = fs.statSync(path.join(queueDir, f)).mtimeMs;
        if (Date.now() - mtimeMs > STALE_DONE_DAYS * 86400 * 1000) continue;
      } catch (_) {}
    }

    result.push({ id: rawId, state });
  }
  return result;
}

// ── Setup: temporary queue directory with synthetic files ────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-done-test-'));

const FM = '---\nid: "X"\ntitle: "test"\nstatus: "DONE"\n---\nBody.\n';

// Fresh DONE: 1 hour old
fs.writeFileSync(path.join(tmpDir, '401-DONE.md'), FM.replace('X', '401'));
const freshTime = new Date(Date.now() - 1 * 3600 * 1000);
fs.utimesSync(path.join(tmpDir, '401-DONE.md'), freshTime, freshTime);

// Stale DONE: 10 days old
fs.writeFileSync(path.join(tmpDir, '402-DONE.md'), FM.replace('X', '402'));
const staleTime = new Date(Date.now() - 10 * 86400 * 1000);
fs.utimesSync(path.join(tmpDir, '402-DONE.md'), staleTime, staleTime);

// Non-DONE slice (unaffected by mtime filter)
fs.writeFileSync(path.join(tmpDir, '403-IN_PROGRESS.md'), FM.replace('X', '403').replace('DONE', 'IN_PROGRESS'));

// QUEUED slice (unaffected)
fs.writeFileSync(path.join(tmpDir, '404-QUEUED.md'), FM.replace('X', '404').replace('DONE', 'QUEUED'));

const allFiles = fs.readdirSync(tmpDir);

// ── Test 1: Fresh DONE appears, stale DONE excluded ────────────────────────

const queue = filterQueueSlices(tmpDir, allFiles);
const ids = new Set(queue.map(s => s.id));

assert.ok(ids.has('401'), 'Fresh DONE (1 hour old) must appear in queue');
assert.ok(!ids.has('402'), 'Stale DONE (10 days old) must be excluded from queue');

// ── Test 2: Non-DONE states unaffected ─────────────────────────────────────

assert.ok(ids.has('403'), 'IN_PROGRESS slice must appear regardless of mtime');
assert.ok(ids.has('404'), 'QUEUED slice must appear regardless of mtime');

// ── Test 3: Exactly 3 slices in the queue ──────────────────────────────────

assert.strictEqual(queue.length, 3,
  'Queue should contain exactly 3 slices (fresh DONE + IN_PROGRESS + QUEUED)');

// ── Test 4: STALE_DONE_DAYS constant is 7 ─────────────────────────────────

assert.strictEqual(STALE_DONE_DAYS, 7,
  'STALE_DONE_DAYS should default to 7');

// ── Cleanup ────────────────────────────────────────────────────────────────

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('stale-done-filter.test.js: all 4 tests passed');
