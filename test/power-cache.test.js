'use strict';

/**
 * power-cache.test.js
 *
 * Regression tests for slice 220 — Power / battery drain fix:
 *   A. Cache returns correct result on first read
 *   B. Cache returns cached result when mtime unchanged (no re-parse)
 *   C. Cache re-parses on mtime change
 *   D. getCachedDir returns per-file parsed content
 *   E. getCachedDir re-parses only changed files
 *   F. Browser interval is 5000ms (not 2000ms)
 *   G. Orchestrator adaptive idle: poll slows after IDLE_THRESHOLD ticks
 *   H. Orchestrator adaptive idle: poll resets on activity
 *   I. Heartbeat hash-dedup: skips write on unchanged state
 *   J. sweepStaleResources does not spawn lsof when index.lock absent
 *
 * Run: node test/power-cache.test.js
 */

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

console.log('\npower-cache.test.js — slice 220 regression tests\n');

// ── A–E: Cache helper tests ──────────────────────────────────────────────

const { getCachedFile, getCachedDir, _cache } = require(path.join(REPO_ROOT, 'dashboard', 'server.js'));

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'power-cache-'));
const tmpFile = path.join(tmpDir, 'test.jsonl');

test('A. getCachedFile returns correct parsed result on first read', () => {
  // Clear cache state
  for (const k of Object.keys(_cache)) delete _cache[k];
  fs.writeFileSync(tmpFile, '{"a":1}\n{"b":2}\n');
  const result = getCachedFile(tmpFile, raw =>
    raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l))
  );
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].a, 1);
  assert.strictEqual(result[1].b, 2);
});

test('B. getCachedFile returns cached result when mtime unchanged (no re-parse)', () => {
  let parseCount = 0;
  const parser = raw => { parseCount++; return raw.trim(); };
  // Clear cache
  for (const k of Object.keys(_cache)) delete _cache[k];
  fs.writeFileSync(tmpFile, 'hello');
  getCachedFile(tmpFile, parser);
  getCachedFile(tmpFile, parser);
  getCachedFile(tmpFile, parser);
  assert.strictEqual(parseCount, 1, 'Parser should only be called once for unchanged file');
});

test('C. getCachedFile re-parses on mtime change', () => {
  let parseCount = 0;
  const parser = raw => { parseCount++; return raw.trim(); };
  for (const k of Object.keys(_cache)) delete _cache[k];
  fs.writeFileSync(tmpFile, 'v1');
  const r1 = getCachedFile(tmpFile, parser);
  assert.strictEqual(r1, 'v1');

  // Touch the file with new content — need to ensure mtime changes
  // (filesystem mtime resolution may be 1s on some systems)
  const stat = fs.statSync(tmpFile);
  const newMtime = new Date(stat.mtimeMs + 1000);
  fs.writeFileSync(tmpFile, 'v2');
  fs.utimesSync(tmpFile, newMtime, newMtime);

  const r2 = getCachedFile(tmpFile, parser);
  assert.strictEqual(r2, 'v2');
  assert.strictEqual(parseCount, 2, 'Parser should be called twice after mtime change');
});

test('D. getCachedDir returns per-file parsed content', () => {
  for (const k of Object.keys(_cache)) delete _cache[k];
  const subDir = path.join(tmpDir, 'queue');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, '001-DONE.md'), '---\nid: "001"\n---\nBody');
  fs.writeFileSync(path.join(subDir, '002-QUEUED.md'), '---\nid: "002"\n---\nBody2');
  fs.writeFileSync(path.join(subDir, 'README.txt'), 'ignore me');

  const result = getCachedDir(
    subDir,
    f => f.endsWith('.md'),
    (_fp, raw) => raw.split('\n')[1], // return first line after ---
  );
  assert.strictEqual(result.files.length, 2);
  assert.ok(result.parsed['001-DONE.md']);
  assert.ok(result.parsed['002-QUEUED.md']);
  assert.ok(!result.parsed['README.txt']);
});

test('E. getCachedDir re-parses only changed files', () => {
  for (const k of Object.keys(_cache)) delete _cache[k];
  const subDir = path.join(tmpDir, 'queue2');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'a.md'), 'aaa');
  fs.writeFileSync(path.join(subDir, 'b.md'), 'bbb');

  let parsedFiles = [];
  const parser = (fp, raw) => { parsedFiles.push(path.basename(fp)); return raw; };

  getCachedDir(subDir, f => f.endsWith('.md'), parser);
  assert.strictEqual(parsedFiles.length, 2, 'Both files parsed on first call');

  parsedFiles = [];
  getCachedDir(subDir, f => f.endsWith('.md'), parser);
  assert.strictEqual(parsedFiles.length, 0, 'No files re-parsed when unchanged');

  // Change one file
  parsedFiles = [];
  const stat = fs.statSync(path.join(subDir, 'a.md'));
  const newMtime = new Date(stat.mtimeMs + 1000);
  fs.writeFileSync(path.join(subDir, 'a.md'), 'aaa-changed');
  fs.utimesSync(path.join(subDir, 'a.md'), newMtime, newMtime);
  // Also need to bump dir mtime so it re-reads the listing
  fs.utimesSync(subDir, newMtime, newMtime);

  getCachedDir(subDir, f => f.endsWith('.md'), parser);
  assert.strictEqual(parsedFiles.length, 1, 'Only changed file re-parsed');
  assert.strictEqual(parsedFiles[0], 'a.md');
});

// ── F: Browser interval test ─────────────────────────────────────────────

test('F. Browser auto-refresh intervals are 5000ms', () => {
  const html = fs.readFileSync(
    path.join(REPO_ROOT, 'dashboard', 'lcars-dashboard.html'), 'utf8'
  );
  const bridgeMatch = html.match(/setInterval\(fetchBridge,\s*(\d+)\)/);
  const queueMatch  = html.match(/setInterval\(fetchCombinedQueue,\s*(\d+)\)/);
  assert.ok(bridgeMatch, 'fetchBridge setInterval found');
  assert.ok(queueMatch, 'fetchCombinedQueue setInterval found');
  assert.strictEqual(bridgeMatch[1], '5000', 'fetchBridge interval should be 5000');
  assert.strictEqual(queueMatch[1], '5000', 'fetchCombinedQueue interval should be 5000');
});

// ── G–H: Orchestrator adaptive idle tests ────────────────────────────────

test('G. Orchestrator has adaptive idle poll constants', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'bridge', 'orchestrator.js'), 'utf8'
  );
  assert.ok(src.includes('IDLE_POLL_MS'), 'IDLE_POLL_MS constant exists');
  assert.ok(src.includes('IDLE_THRESHOLD'), 'IDLE_THRESHOLD constant exists');
  assert.ok(/IDLE_POLL_MS\s*=\s*30000/.test(src), 'IDLE_POLL_MS is 30000');
  assert.ok(/IDLE_THRESHOLD\s*=\s*24/.test(src), 'IDLE_THRESHOLD is 24 (2min at 5s)');
  assert.ok(src.includes('consecutiveIdleTicks'), 'Idle tick counter exists');
  assert.ok(src.includes('schedulePoll'), 'schedulePoll function exists');
});

test('H. Orchestrator resets poll interval on activity', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'bridge', 'orchestrator.js'), 'utf8'
  );
  // When files are found, consecutiveIdleTicks should be reset to 0
  assert.ok(src.includes('consecutiveIdleTicks = 0'), 'Idle counter resets to 0 on activity');
  // And currentPollMs should be restored to config value
  assert.ok(
    src.includes('currentPollMs = config.pollIntervalMs'),
    'Poll interval resets to config value on activity'
  );
});

// ── I: Heartbeat hash-dedup test ─────────────────────────────────────────

test('I. writeHeartbeat has hash-dedup logic', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'bridge', 'orchestrator.js'), 'utf8'
  );
  assert.ok(src.includes('_lastHeartbeatHash'), 'Last heartbeat hash variable exists');
  assert.ok(src.includes("createHash('md5')"), 'MD5 hash used for heartbeat dedup');
  assert.ok(
    /if\s*\(hash\s*===\s*_lastHeartbeatHash\)\s*return/.test(src),
    'Early return when hash matches last written'
  );
});

// ── J: lsof short-circuit test ───────────────────────────────────────────

test('J. sweepStaleResources skips lsof when index.lock absent', () => {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'bridge', 'git-finalizer.js'), 'utf8'
  );
  // sweepStaleResources starts with `if (lockExists())` — lsof is only inside that block.
  // Verify the guard exists.
  assert.ok(
    /function sweepStaleResources[\s\S]*?if \(lockExists\(\)\)/.test(src),
    'sweepStaleResources gates lsof behind lockExists() check'
  );
  // Verify isGitProcessAlive (which calls lsof) is ONLY called inside lockExists block
  const sweepBody = src.slice(src.indexOf('function sweepStaleResources'));
  const lockBlock = sweepBody.indexOf('if (lockExists())');
  const gitAliveCall = sweepBody.indexOf('isGitProcessAlive()');
  assert.ok(lockBlock < gitAliveCall, 'isGitProcessAlive called after lockExists check');
});

// ── Cleanup ──────────────────────────────────────────────────────────────

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
