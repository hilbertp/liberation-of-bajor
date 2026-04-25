'use strict';

/**
 * new-slice-restage-history.test.js
 *
 * Tests for slice 215 — rounds: preservation, attempt_number in appendRoundEntry,
 * and re-stage notice injection.
 *
 * Cases:
 *   A. --restage with prior rounds: array in body frontmatter: preserved verbatim.
 *   B. appendRoundEntry with no attempt_number argument: defaults to 1.
 *   C. appendRoundEntry called twice for same round: second gets attempt_number: 2.
 *   D. --restage with archiveQueueFiles returning attempt 2: notice injected.
 *   E. Two --restage invocations: second injects attempt 3 notice, preserves attempt 2 notice.
 *   F. --restage without --body-file: still works (no crash).
 *
 * Run: node test/new-slice-restage-history.test.js
 */

const fs           = require('fs');
const os           = require('os');
const path         = require('path');
const assert       = require('assert');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Temp directories — fully isolated
// ---------------------------------------------------------------------------

const TEMP    = fs.mkdtempSync(path.join(os.tmpdir(), 'ds9-restage-history-'));
const QUEUE   = path.join(TEMP, 'queue');
const STAGED  = path.join(TEMP, 'staged');
const TRASH   = path.join(TEMP, 'trash');
const REG     = path.join(TEMP, 'register.jsonl');

for (const d of [QUEUE, STAGED, TRASH]) fs.mkdirSync(d, { recursive: true });

const NEW_SLICE = path.join(__dirname, '..', 'bridge', 'new-slice.js');
const PROJECT   = path.join(__dirname, '..');

function baseEnv() {
  return Object.assign({}, process.env, {
    DS9_REGISTER_FILE: REG,
    DS9_QUEUE_DIR:     QUEUE,
    DS9_STAGED_DIR:    STAGED,
    DS9_TRASH_DIR:     TRASH,
  });
}

function runNewSlice(extraArgs, extraEnv) {
  const env = Object.assign(baseEnv(), extraEnv || {});
  return execSync(
    `node ${NEW_SLICE} --title "Test slice" --goal "Test goal" --priority normal ${extraArgs || ''}`,
    { cwd: PROJECT, env, stdio: 'pipe' }
  ).toString();
}

function clean() {
  for (const d of [QUEUE, STAGED, TRASH]) {
    for (const f of fs.readdirSync(d)) fs.unlinkSync(path.join(d, f));
  }
  try { fs.unlinkSync(REG); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Test A: --restage preserves rounds: in body frontmatter
// ---------------------------------------------------------------------------

(function testA_restagePreservesRounds() {
  clean();

  // Create prior history: a DONE file and a register entry.
  const id = '050';
  fs.writeFileSync(path.join(QUEUE, `${id}-DONE.md`), '---\nid: "050"\nstatus: DONE\n---\nDone.\n');
  fs.appendFileSync(REG, JSON.stringify({ ts: new Date().toISOString(), event: 'COMMISSIONED', slice_id: id }) + '\n');

  // Body file with rounds: in frontmatter.
  const bodyFile = path.join(TEMP, 'body-a.md');
  const bodyContent = [
    '---',
    'some_field: value',
    'rounds:',
    '  - round: 1',
    '    attempt_number: 1',
    '    nog_verdict: "NOG_DECISION_REJECTED"',
    '  - round: 2',
    '    attempt_number: 1',
    '    nog_verdict: "NOG_DECISION_ACCEPTED"',
    '---',
    '',
    '## Goal',
    '',
    'Do the thing.',
  ].join('\n');
  fs.writeFileSync(bodyFile, bodyContent);

  runNewSlice(`--restage ${id} --body-file ${bodyFile}`);

  const staged = fs.readdirSync(STAGED).find(f => f.startsWith('050'));
  assert.ok(staged, 'Staged file should exist for id 050');
  const content = fs.readFileSync(path.join(STAGED, staged), 'utf8');

  // rounds: must be preserved (not stripped).
  assert.ok(content.includes('rounds:'), 'rounds: must be preserved in output');
  assert.ok(content.includes('- round: 1'), 'round 1 entry must be preserved');
  assert.ok(content.includes('- round: 2'), 'round 2 entry must be preserved');
  assert.ok(content.includes('nog_verdict: "NOG_DECISION_REJECTED"'), 'round 1 verdict preserved');
  assert.ok(content.includes('nog_verdict: "NOG_DECISION_ACCEPTED"'), 'round 2 verdict preserved');

  console.log('  PASS  A: --restage preserves rounds: in body frontmatter');
})();

// ---------------------------------------------------------------------------
// Test B: appendRoundEntry defaults attempt_number to 1
// ---------------------------------------------------------------------------

(function testB_appendRoundEntryDefaultAttempt() {
  const { appendRoundEntry } = require(path.join(PROJECT, 'bridge', 'orchestrator.js'));

  const tmpFile = path.join(TEMP, 'slice-b.md');
  fs.writeFileSync(tmpFile, '---\nid: "099"\nstatus: QUEUED\n---\n\n## Goal\n\nTest.\n');

  appendRoundEntry(tmpFile, {
    round: 1,
    commissioned_at: '2026-04-25T10:00:00Z',
    done_at: '2026-04-25T10:05:00Z',
    durationMs: 300000,
    tokensIn: 1000,
    tokensOut: 500,
    costUsd: 0.01,
    nog_verdict: 'NOG_DECISION_ACCEPTED',
    nog_reason: 'Looks good',
  });

  const content = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(content.includes('attempt_number: 1'), 'Default attempt_number should be 1');
  assert.ok(content.includes('- round: 1'), 'Round entry should exist');

  console.log('  PASS  B: appendRoundEntry defaults attempt_number to 1');
})();

// ---------------------------------------------------------------------------
// Test C: appendRoundEntry twice for same round → attempt_number: 2
// ---------------------------------------------------------------------------

(function testC_appendRoundEntrySecondAttempt() {
  const { appendRoundEntry, computeNextAttemptNumber } = require(path.join(PROJECT, 'bridge', 'orchestrator.js'));

  const tmpFile = path.join(TEMP, 'slice-c.md');
  fs.writeFileSync(tmpFile, '---\nid: "098"\nstatus: QUEUED\n---\n\n## Goal\n\nTest.\n');

  // First call for round 1.
  appendRoundEntry(tmpFile, {
    round: 1,
    attempt_number: 1,
    commissioned_at: '2026-04-25T10:00:00Z',
    done_at: '2026-04-25T10:05:00Z',
    durationMs: 300000,
    tokensIn: 1000,
    tokensOut: 500,
    costUsd: 0.01,
    nog_verdict: 'NOG_DECISION_REJECTED',
    nog_reason: 'Needs work',
  });

  // Compute next attempt for round 1 — should be 2.
  const nextAttempt = computeNextAttemptNumber(tmpFile, 1);
  assert.strictEqual(nextAttempt, 2, 'Next attempt for round 1 should be 2');

  // Second call for round 1 with attempt_number 2.
  appendRoundEntry(tmpFile, {
    round: 1,
    attempt_number: nextAttempt,
    commissioned_at: '2026-04-25T11:00:00Z',
    done_at: '2026-04-25T11:05:00Z',
    durationMs: 300000,
    tokensIn: 1200,
    tokensOut: 600,
    costUsd: 0.02,
    nog_verdict: 'NOG_DECISION_ACCEPTED',
    nog_reason: 'Fixed',
  });

  const content = fs.readFileSync(tmpFile, 'utf8');
  assert.ok(content.includes('attempt_number: 1'), 'First entry should have attempt_number 1');
  assert.ok(content.includes('attempt_number: 2'), 'Second entry should have attempt_number 2');

  // Verify computeNextAttemptNumber now returns 3.
  const next3 = computeNextAttemptNumber(tmpFile, 1);
  assert.strictEqual(next3, 3, 'After two entries for round 1, next attempt should be 3');

  console.log('  PASS  C: appendRoundEntry second call gets attempt_number: 2');
})();

// ---------------------------------------------------------------------------
// Test D: --restage with archiveQueueFiles returning attempt 2 injects notice
// ---------------------------------------------------------------------------

(function testD_restageNoticeInjected() {
  clean();

  const id = '051';

  // Create prior history: a DONE file and trash from a prior archive (attempt1 already in trash).
  fs.writeFileSync(path.join(QUEUE, `${id}-DONE.md`), '---\nid: "051"\nstatus: DONE\n---\nDone.\n');
  fs.appendFileSync(REG, JSON.stringify({ ts: new Date().toISOString(), event: 'COMMISSIONED', slice_id: id }) + '\n');

  // Prior attempt1 already in trash → nextAttemptN returns 2 → new attempt is 3.
  fs.writeFileSync(path.join(TRASH, `${id}-DONE.md.attempt1`), 'archived');

  const bodyFile = path.join(TEMP, 'body-d.md');
  fs.writeFileSync(bodyFile, '## Goal\n\nDo the thing again.\n');

  runNewSlice(`--restage ${id} --body-file ${bodyFile}`);

  const staged = fs.readdirSync(STAGED).find(f => f.startsWith('051'));
  assert.ok(staged, 'Staged file should exist for id 051');
  const content = fs.readFileSync(path.join(STAGED, staged), 'utf8');

  assert.ok(content.includes('## Re-stage notice'), 'Re-stage notice should be injected');
  assert.ok(content.includes('attempt 3'), 'Notice should reference attempt 3 (attemptN=2, new=3)');
  assert.ok(content.includes('## Goal'), 'Original body content should be preserved');

  console.log('  PASS  D: --restage injects re-stage notice for attempt 2+');
})();

// ---------------------------------------------------------------------------
// Test E: Two --restage invocations produce two notices in order
// ---------------------------------------------------------------------------

(function testE_twoRestagesProduceTwoNotices() {
  clean();

  const id = '052';

  // Set up: first restage.
  fs.writeFileSync(path.join(QUEUE, `${id}-STUCK.md`), '---\nid: "052"\nstatus: STUCK\n---\nStuck.\n');
  fs.appendFileSync(REG, JSON.stringify({ ts: new Date().toISOString(), event: 'COMMISSIONED', slice_id: id }) + '\n');

  // First restage — this archives STUCK to trash as attempt1, new attempt is 2.
  const bodyFile1 = path.join(TEMP, 'body-e1.md');
  fs.writeFileSync(bodyFile1, '## Goal\n\nFirst re-attempt.\n');
  runNewSlice(`--restage ${id} --body-file ${bodyFile1}`);

  const staged1 = fs.readdirSync(STAGED).find(f => f.startsWith('052'));
  const content1 = fs.readFileSync(path.join(STAGED, staged1), 'utf8');

  // First restage should already have attempt 2 notice.
  assert.ok(content1.includes('## Re-stage notice'), 'First restage should have a notice');
  assert.ok(content1.includes('attempt 2'), 'First restage notice should say attempt 2');

  // Move staged back to queue as a terminal state for second restage.
  const donePath = path.join(QUEUE, `${id}-DONE.md`);
  fs.renameSync(path.join(STAGED, staged1), donePath);

  // Second restage — pass the body content from first restage (without new-slice frontmatter).
  const bodyFile2 = path.join(TEMP, 'body-e2.md');
  fs.writeFileSync(bodyFile2, content1.replace(/^---[\s\S]*?---\n*/, '')); // strip new-slice frontmatter, keep body
  runNewSlice(`--restage ${id} --body-file ${bodyFile2}`);

  const staged2 = fs.readdirSync(STAGED).find(f => f.startsWith('052'));
  assert.ok(staged2, 'Second staged file should exist');
  const content2 = fs.readFileSync(path.join(STAGED, staged2), 'utf8');

  // Should have two re-stage notices: attempt 2 (from first body) and attempt 3 (newly injected).
  const notices = content2.match(/## Re-stage notice/g);
  assert.ok(notices && notices.length >= 2, `Should have at least 2 re-stage notices, got ${notices ? notices.length : 0}`);
  assert.ok(content2.includes('attempt 2'), 'Should contain attempt 2 notice from first restage');
  assert.ok(content2.includes('attempt 3'), 'Should contain attempt 3 notice from second restage');
  assert.ok(content2.includes('## Goal'), 'Original body content should still be present');

  console.log('  PASS  E: Two --restage invocations produce two notices in order');
})();

// ---------------------------------------------------------------------------
// Test F: --restage without --body-file (no crash)
// ---------------------------------------------------------------------------

(function testF_restageWithoutBodyFile() {
  clean();

  const id = '053';
  fs.writeFileSync(path.join(QUEUE, `${id}-DONE.md`), '---\nid: "053"\nstatus: DONE\n---\nDone.\n');
  fs.appendFileSync(REG, JSON.stringify({ ts: new Date().toISOString(), event: 'COMMISSIONED', slice_id: id }) + '\n');

  // No --body-file, no stdin pipe.
  runNewSlice(`--restage ${id}`);

  const staged = fs.readdirSync(STAGED).find(f => f.startsWith('053'));
  assert.ok(staged, 'Staged file should exist for id 053 even without --body-file');

  console.log('  PASS  F: --restage without --body-file works');
})();

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

fs.rmSync(TEMP, { recursive: true, force: true });
console.log('\nAll tests passed.');
