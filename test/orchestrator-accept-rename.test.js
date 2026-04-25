'use strict';

/**
 * orchestrator-accept-rename.test.js
 *
 * Regression tests for slice 216 — acceptAndMerge wrapper,
 * RENAME_FAILED enforcement, and backfillAcceptedFiles.
 *
 * Tests A–F per brief spec.
 *
 * Run: node test/orchestrator-accept-rename.test.js
 */

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const assert = require('assert');

const {
  acceptAndMerge,
  backfillAcceptedFiles,
  _testSetRegisterFile,
} = require('../bridge/orchestrator.js');

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

const TEMP  = fs.mkdtempSync(path.join(os.tmpdir(), 'ds9-accept-rename-test-'));
const QUEUE = path.join(TEMP, 'queue');
const TRASH = path.join(TEMP, 'trash');
const REG   = path.join(TEMP, 'register.jsonl');

function writeSliceFile(id, suffix, extraFrontmatter) {
  const fm = Object.assign(
    { id: String(id), title: `Test slice ${id}`, status: suffix.replace(/^-|\.md$/g, ''), branch: `slice/${id}` },
    extraFrontmatter || {}
  );
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(`${k}: "${v}"`);
  lines.push('---', '', `## Slice ${id} body`);
  fs.writeFileSync(path.join(QUEUE, `${id}${suffix}`), lines.join('\n'));
}

function readReg() {
  try {
    return fs.readFileSync(REG, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch (_) { return []; }
}

function queueFiles() {
  return fs.readdirSync(QUEUE).sort();
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  // Fresh dirs for each test
  fs.rmSync(QUEUE, { recursive: true, force: true });
  fs.rmSync(TRASH, { recursive: true, force: true });
  fs.mkdirSync(QUEUE, { recursive: true });
  fs.mkdirSync(TRASH, { recursive: true });
  try { fs.unlinkSync(REG); } catch (_) {}
  fs.writeFileSync(REG, '', 'utf8');
  _testSetRegisterFile(REG);

  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Test A: Happy path — acceptAndMerge renames EVALUATING → ACCEPTED
// ---------------------------------------------------------------------------

console.log('\n-- acceptAndMerge --');

test('A. Happy path: EVALUATING → ACCEPTED rename, then merge attempted', () => {
  // Create an EVALUATING file.
  writeSliceFile('800', '-EVALUATING.md');
  const evaluatingPath = path.join(QUEUE, '800-EVALUATING.md');

  // acceptAndMerge will rename EVALUATING → ACCEPTED, then try mergeBranch.
  // mergeBranch will fail (no real git repo) — that's expected.
  // The key assertion: ACCEPTED file exists after the call.
  const result = acceptAndMerge('800', evaluatingPath, 'slice/800', 'Test slice 800', { queueDir: QUEUE });

  // ACCEPTED file must exist (rename succeeded).
  assert.ok(fs.existsSync(path.join(QUEUE, '800-ACCEPTED.md')), 'ACCEPTED file should exist');
  // EVALUATING file must be gone.
  assert.ok(!fs.existsSync(evaluatingPath), 'EVALUATING file should be gone');
  // mergeBranch will fail in test env (no git) — that's fine, we're testing the rename.
  // result.success may be false due to git failure, but no RENAME_FAILED event.
  const events = readReg();
  const renameFailed = events.filter(e => e.event === 'RENAME_FAILED');
  assert.strictEqual(renameFailed.length, 0, 'No RENAME_FAILED events should be emitted');
});

// ---------------------------------------------------------------------------
// Test B: EVALUATING file missing — emits RENAME_FAILED, does NOT proceed
// ---------------------------------------------------------------------------

test('B. Missing EVALUATING file → RENAME_FAILED, merge halted', () => {
  // No EVALUATING or ACCEPTED file exists.
  const fakePath = path.join(QUEUE, '801-EVALUATING.md');
  const result = acceptAndMerge('801', fakePath, 'slice/801', 'Test slice 801', { queueDir: QUEUE });

  assert.strictEqual(result.success, false, 'Should fail');
  assert.ok(result.error.includes('rename_failed'), `Error should mention rename_failed, got: ${result.error}`);

  // RENAME_FAILED event must be in register.
  const events = readReg();
  const renameFailed = events.filter(e => e.event === 'RENAME_FAILED');
  assert.strictEqual(renameFailed.length, 1, 'Exactly one RENAME_FAILED event');
  assert.strictEqual(renameFailed[0].slice_id, '801');
  assert.ok(renameFailed[0].expected_path, 'Should include expected_path');
  assert.ok(renameFailed[0].error, 'Should include error description');
});

// ---------------------------------------------------------------------------
// Test C: Idempotent rename — ACCEPTED already exists → proceed to merge
// ---------------------------------------------------------------------------

test('C. Idempotent: ACCEPTED already exists → no rename, proceed to merge', () => {
  // Create an ACCEPTED file directly.
  writeSliceFile('802', '-ACCEPTED.md');
  const acceptedPath = path.join(QUEUE, '802-ACCEPTED.md');

  // Call acceptAndMerge with null currentFilePath — ACCEPTED already exists.
  const result = acceptAndMerge('802', null, 'slice/802', 'Test slice 802', { queueDir: QUEUE });

  // ACCEPTED file still exists.
  assert.ok(fs.existsSync(acceptedPath), 'ACCEPTED file should still exist');
  // No RENAME_FAILED event.
  const events = readReg();
  const renameFailed = events.filter(e => e.event === 'RENAME_FAILED');
  assert.strictEqual(renameFailed.length, 0, 'No RENAME_FAILED when ACCEPTED already exists');
  // mergeBranch was attempted (will fail in test env — no git — but that's fine).
});

// ---------------------------------------------------------------------------
// Test D: backfillAcceptedFiles — creates ACCEPTED for merged slice with DONE only
// ---------------------------------------------------------------------------

console.log('\n-- backfillAcceptedFiles --');

test('D. Backfill: DONE-only slice with MERGED event → ACCEPTED file created', () => {
  // Create a DONE file for a slice that has a MERGED event in register.
  writeSliceFile('803', '-DONE.md');

  // Write a MERGED event so hasMergedEvent returns true.
  const mergedEvent = JSON.stringify({
    ts: new Date().toISOString(),
    slice_id: '803',
    event: 'MERGED',
    branch: 'slice/803',
    sha: 'abc1234',
  });
  fs.appendFileSync(REG, mergedEvent + '\n');

  const marker = path.join(TEMP, '.backfill-accepted-done-test-d');
  try { fs.unlinkSync(marker); } catch (_) {}

  backfillAcceptedFiles({ queueDir: QUEUE, markerFile: marker });

  // ACCEPTED file should now exist.
  assert.ok(fs.existsSync(path.join(QUEUE, '803-ACCEPTED.md')), 'ACCEPTED file should be created by backfill');
  // DONE file should still exist (it's committed on branch, backfill copies content).
  assert.ok(fs.existsSync(path.join(QUEUE, '803-DONE.md')), 'DONE file should still exist');

  // BACKFILL_ACCEPTED_COMPLETE event emitted.
  const events = readReg();
  const complete = events.filter(e => e.event === 'BACKFILL_ACCEPTED_COMPLETE');
  assert.strictEqual(complete.length, 1, 'Exactly one BACKFILL_ACCEPTED_COMPLETE event');
  assert.ok(complete[0].processed >= 1, `processed should be >= 1, got ${complete[0].processed}`);

  // Marker file written.
  assert.ok(fs.existsSync(marker), 'Marker file should be written');

  // Clean up.
  try { fs.unlinkSync(marker); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Test E: backfillAcceptedFiles idempotency — marker present → no-op
// ---------------------------------------------------------------------------

test('E. Backfill idempotency: marker present → no-op', () => {
  writeSliceFile('804', '-DONE.md');

  // Write a MERGED event.
  const mergedEvent = JSON.stringify({
    ts: new Date().toISOString(),
    slice_id: '804',
    event: 'MERGED',
    branch: 'slice/804',
    sha: 'def5678',
  });
  fs.appendFileSync(REG, mergedEvent + '\n');

  // Create marker BEFORE running backfill.
  const marker = path.join(TEMP, '.backfill-accepted-done-test-e');
  fs.writeFileSync(marker, new Date().toISOString() + '\n');

  backfillAcceptedFiles({ queueDir: QUEUE, markerFile: marker });

  // ACCEPTED should NOT be created (marker blocks backfill).
  assert.ok(!fs.existsSync(path.join(QUEUE, '804-ACCEPTED.md')), 'ACCEPTED should NOT exist when marker present');

  // No BACKFILL_ACCEPTED_COMPLETE event.
  const events = readReg();
  const complete = events.filter(e => e.event === 'BACKFILL_ACCEPTED_COMPLETE');
  assert.strictEqual(complete.length, 0, 'No BACKFILL_ACCEPTED_COMPLETE when marker present');

  // Clean up.
  try { fs.unlinkSync(marker); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Test F: crashRecovery path — ACCEPTED exists, already merged → no re-merge
// ---------------------------------------------------------------------------

test('F. crashRecovery path: ACCEPTED + already-merged → acceptAndMerge idempotent', () => {
  // This tests that acceptAndMerge is idempotent when called from crashRecovery.
  // Simulate: ACCEPTED file exists, call acceptAndMerge with it as currentFilePath.
  writeSliceFile('805', '-ACCEPTED.md');
  const acceptedPath = path.join(QUEUE, '805-ACCEPTED.md');

  // acceptAndMerge should see ACCEPTED exists → skip rename → attempt mergeBranch.
  const result = acceptAndMerge('805', acceptedPath, 'slice/805', 'Test slice 805', { queueDir: QUEUE });

  // ACCEPTED still exists (no accidental rename/deletion).
  assert.ok(fs.existsSync(acceptedPath), 'ACCEPTED file should remain');
  // No RENAME_FAILED.
  const events = readReg();
  const renameFailed = events.filter(e => e.event === 'RENAME_FAILED');
  assert.strictEqual(renameFailed.length, 0, 'No RENAME_FAILED in idempotent crashRecovery path');
});

// ---------------------------------------------------------------------------
// Cleanup and summary
// ---------------------------------------------------------------------------

fs.rmSync(TEMP, { recursive: true, force: true });

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
