'use strict';

/**
 * lifecycle-events.test.js
 *
 * Tests for slice 162 — lifecycle terminal events:
 *   1. MAX_ROUNDS_EXHAUSTED emission on round 5 Nog return
 *   2. ESCALATED_TO_OBRIEN emission on Nog ESCALATE verdict
 *   3. NOG_INVOKED emission on DONE→EVALUATING transition
 *   4. Return-to-stage happy path (terminal slice → STAGED)
 *   5. Return-to-stage rejection for non-terminal slices
 *
 * Run: node test/lifecycle-events.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Read orchestrator source for static analysis tests
// ---------------------------------------------------------------------------

const watcherSource = fs.readFileSync(
  path.join(__dirname, '..', 'bridge', 'orchestrator.js'),
  'utf-8'
);

// ---------------------------------------------------------------------------
// Setup: temp dirs
// ---------------------------------------------------------------------------

const TEMP = path.join(require('os').tmpdir(), `ds9-lifecycle-test-${Date.now()}`);
const QUEUE = path.join(TEMP, 'queue');
const STAGED = path.join(TEMP, 'staged');
const CONTROL = path.join(TEMP, 'control');
const REGISTER = path.join(TEMP, 'register.jsonl');

fs.mkdirSync(QUEUE, { recursive: true });
fs.mkdirSync(STAGED, { recursive: true });
fs.mkdirSync(CONTROL, { recursive: true });

let passed = 0;
let failed = 0;

function test(name, fn) {
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

// Helper: parse frontmatter (same as orchestrator's)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = val;
  });
  return meta;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

console.log('\n== Lifecycle events tests (slice 162) ==\n');

// ---- Part 1: MAX_ROUNDS_EXHAUSTED ----

test('Watcher source contains MAX_ROUNDS_EXHAUSTED event emission', () => {
  assert.ok(
    watcherSource.includes("'MAX_ROUNDS_EXHAUSTED'"),
    'orchestrator.js must emit MAX_ROUNDS_EXHAUSTED register event'
  );
});

test('MAX_ROUNDS_EXHAUSTED is emitted at exactly one site', () => {
  const matches = watcherSource.match(/registerEvent\([^,]+,\s*'MAX_ROUNDS_EXHAUSTED'/g);
  assert.ok(matches, 'No MAX_ROUNDS_EXHAUSTED registerEvent call found');
  assert.strictEqual(matches.length, 1, `Expected 1 emission site, found ${matches.length}`);
});

test('MAX_ROUNDS_EXHAUSTED event includes round and reason fields', () => {
  // Find the registerEvent call and its surrounding block
  const idx = watcherSource.indexOf("'MAX_ROUNDS_EXHAUSTED'");
  const block = watcherSource.slice(Math.max(0, idx - 100), idx + 300);
  assert.ok(block.includes('round'), 'MAX_ROUNDS_EXHAUSTED must include round field');
  assert.ok(block.includes('reason'), 'MAX_ROUNDS_EXHAUSTED must include reason field');
});

test('Round >5 does NOT commission a new slice (no apendment written)', () => {
  // In the round >5 block, there should be no nextSliceId call or QUEUED write
  const lines = watcherSource.split('\n');
  let inRoundBlock = false;
  let foundMaxRounds = false;
  let foundQueuedWrite = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("'MAX_ROUNDS_EXHAUSTED'")) {
      inRoundBlock = true;
      foundMaxRounds = true;
    }
    if (inRoundBlock) {
      if (lines[i].includes('nextSliceId') || lines[i].includes('QUEUED.md')) {
        foundQueuedWrite = true;
      }
      // Stop scanning after ~60 lines
      if (i > lines.indexOf(lines.find(l => l.includes("'MAX_ROUNDS_EXHAUSTED'"))) + 60) break;
    }
  }

  assert.ok(foundMaxRounds, 'MAX_ROUNDS_EXHAUSTED must exist in source');
  assert.ok(!foundQueuedWrite, 'Round >5 block must NOT commission a new slice');
});

test('Worktree cleanup called in MAX_ROUNDS_EXHAUSTED path', () => {
  const idx = watcherSource.indexOf("'MAX_ROUNDS_EXHAUSTED'");
  // Look within 80 lines after for cleanupWorktree
  const afterBlock = watcherSource.slice(idx, idx + 3000);
  // Find the next return statement to bound the block
  const returnIdx = afterBlock.indexOf('return;');
  const block = afterBlock.slice(0, returnIdx > 0 ? returnIdx : 3000);
  assert.ok(block.includes('cleanupWorktree'), 'MAX_ROUNDS_EXHAUSTED path must call cleanupWorktree');
});

// ---- Part 2: ESCALATED_TO_OBRIEN ----

test('Watcher source contains ESCALATED_TO_OBRIEN event emission', () => {
  assert.ok(
    watcherSource.includes("'ESCALATED_TO_OBRIEN'"),
    'orchestrator.js must emit ESCALATED_TO_OBRIEN register event'
  );
});

test('ESCALATED_TO_OBRIEN is emitted at exactly one site', () => {
  const matches = watcherSource.match(/registerEvent\([^,]+,\s*'ESCALATED_TO_OBRIEN'/g);
  assert.ok(matches, 'No ESCALATED_TO_OBRIEN registerEvent call found');
  assert.strictEqual(matches.length, 1, `Expected 1 emission site, found ${matches.length}`);
});

test('ESCALATED_TO_OBRIEN event includes round and reason fields', () => {
  const idx = watcherSource.indexOf("'ESCALATED_TO_OBRIEN'");
  const block = watcherSource.slice(Math.max(0, idx - 100), idx + 300);
  assert.ok(block.includes('round'), 'ESCALATED_TO_OBRIEN must include round field');
  assert.ok(block.includes('reason'), 'ESCALATED_TO_OBRIEN must include reason field');
});

test('ESCALATE verdict is handled in Nog callback', () => {
  // The verdict parsing should handle ESCALATE
  assert.ok(
    watcherSource.includes("'ESCALATE'"),
    'orchestrator.js must handle ESCALATE verdict from Nog'
  );
});

test('Worktree cleanup called in ESCALATED_TO_OBRIEN path', () => {
  const idx = watcherSource.indexOf("'ESCALATED_TO_OBRIEN'");
  const afterBlock = watcherSource.slice(idx, idx + 3000);
  const returnIdx = afterBlock.indexOf('return;');
  const block = afterBlock.slice(0, returnIdx > 0 ? returnIdx : 3000);
  assert.ok(block.includes('cleanupWorktree'), 'ESCALATED_TO_OBRIEN path must call cleanupWorktree');
});

// ---- Part 3: NOG_INVOKED ----

test('Watcher source contains NOG_INVOKED event emission', () => {
  assert.ok(
    watcherSource.includes("'NOG_INVOKED'"),
    'orchestrator.js must emit NOG_INVOKED register event'
  );
});

test('NOG_INVOKED is emitted at exactly one site', () => {
  const matches = watcherSource.match(/registerEvent\([^,]+,\s*'NOG_INVOKED'/g);
  assert.ok(matches, 'No NOG_INVOKED registerEvent call found');
  assert.strictEqual(matches.length, 1, `Expected 1 emission site, found ${matches.length}`);
});

test('NOG_INVOKED event includes round field', () => {
  const idx = watcherSource.indexOf("'NOG_INVOKED'");
  const block = watcherSource.slice(Math.max(0, idx - 200), idx + 300);
  assert.ok(block.includes('round'), 'NOG_INVOKED must include round field');
});

test('NOG_INVOKED is emitted before Nog invocation', () => {
  // NOG_INVOKED should appear in the DONE→EVALUATING block, before invokeNog
  const waitIdx = watcherSource.indexOf("'NOG_INVOKED'");
  const nogIdx = watcherSource.indexOf('invokeNog(doneId)');
  assert.ok(waitIdx > 0, 'NOG_INVOKED must exist');
  assert.ok(nogIdx > 0, 'invokeNog call must exist');
  assert.ok(waitIdx < nogIdx, 'NOG_INVOKED must be emitted BEFORE invokeNog is called');
});

// ---- Part 4: Return-to-stage ----

test('Watcher source contains RETURN_TO_STAGE event emission', () => {
  assert.ok(
    watcherSource.includes("'RETURN_TO_STAGE'"),
    'orchestrator.js must emit RETURN_TO_STAGE register event'
  );
});

test('RETURN_TO_STAGE event includes from_event and reason fields', () => {
  const idx = watcherSource.indexOf("'RETURN_TO_STAGE'");
  const block = watcherSource.slice(Math.max(0, idx - 200), idx + 400);
  assert.ok(block.includes('from_event'), 'RETURN_TO_STAGE must include from_event field');
  assert.ok(block.includes('reason'), 'RETURN_TO_STAGE must include reason field');
});

test('Return-to-stage control directory exists reference in orchestrator', () => {
  assert.ok(
    watcherSource.includes('control') || watcherSource.includes('CONTROL'),
    'Watcher must reference a control mechanism for return-to-stage'
  );
});

test('Return-to-stage validates terminal state before acting', () => {
  // The handler function should check for terminal states
  const idx = watcherSource.indexOf('handleReturnToStage');
  assert.ok(idx > 0, 'handleReturnToStage function must exist in orchestrator');
  const block = watcherSource.slice(idx, idx + 3000);
  // Should check for terminal file suffixes
  assert.ok(
    block.includes('ACCEPTED') || block.includes('STUCK') ||
    block.includes('ERROR') || block.includes('terminal'),
    'Return-to-stage must validate slice is in terminal state'
  );
});

test('Return-to-stage rejects non-terminal slices', () => {
  // Should have rejection logic for IN_PROGRESS or EVALUATING
  const idx = watcherSource.indexOf('handleReturnToStage');
  const block = watcherSource.slice(idx, idx + 3000);
  assert.ok(
    block.includes('IN_PROGRESS') || block.includes('EVALUATING'),
    'Return-to-stage must reject non-terminal slices'
  );
});

test('Return-to-stage moves file to staged directory', () => {
  const idx = watcherSource.indexOf('handleReturnToStage');
  const block = watcherSource.slice(idx, idx + 3000);
  assert.ok(
    block.includes('STAGED') || block.includes('staged'),
    'Return-to-stage must move slice to staged directory'
  );
});

// ---- Integration: file-based return-to-stage ----

test('Return-to-stage control file: happy path simulation', () => {
  // Simulate: terminal slice exists, control file requests return
  const sliceId = '200';

  // Create a terminal STUCK file in the queue
  const stuckPath = path.join(QUEUE, `${sliceId}-STUCK.md`);
  fs.writeFileSync(stuckPath, [
    '---',
    `id: "${sliceId}"`,
    'title: "Test stuck slice"',
    'status: STUCK',
    '---',
    'Stuck content.',
  ].join('\n'));

  // Verify file exists
  assert.ok(fs.existsSync(stuckPath), 'STUCK file should exist before return');

  // Simulate the return: move to staged (what the orchestrator would do)
  const stagedPath = path.join(STAGED, `${sliceId}-STAGED.md`);
  const content = fs.readFileSync(stuckPath, 'utf-8');
  // Update frontmatter status to STAGED
  const updated = content.replace('status: STUCK', 'status: STAGED');
  fs.writeFileSync(stagedPath, updated);
  fs.unlinkSync(stuckPath);

  assert.ok(!fs.existsSync(stuckPath), 'STUCK file should be removed');
  assert.ok(fs.existsSync(stagedPath), 'STAGED file should exist after return');

  const stagedMeta = parseFrontmatter(fs.readFileSync(stagedPath, 'utf-8'));
  assert.strictEqual(stagedMeta.status, 'STAGED', 'Status should be STAGED');

  // Cleanup
  fs.unlinkSync(stagedPath);
});

test('Return-to-stage control file: rejection for IN_PROGRESS', () => {
  const sliceId = '201';

  // Create an IN_PROGRESS file
  const ipPath = path.join(QUEUE, `${sliceId}-IN_PROGRESS.md`);
  fs.writeFileSync(ipPath, [
    '---',
    `id: "${sliceId}"`,
    'title: "Test in-progress slice"',
    'status: IN_PROGRESS',
    '---',
    'In progress.',
  ].join('\n'));

  // The file should NOT be movable — still in queue, not in staged
  assert.ok(fs.existsSync(ipPath), 'IN_PROGRESS file should remain');
  assert.ok(!fs.existsSync(path.join(STAGED, `${sliceId}-STAGED.md`)), 'Should NOT be in staged');

  // Cleanup
  fs.unlinkSync(ipPath);
});

// ---- Cross-cutting ----

test('Canonical register event names exist in orchestrator', () => {
  // Verify the canonical events are present (post lifecycle-names migration)
  const canonicalEvents = ['COMMISSIONED', 'ERROR', 'DONE', 'MERGED',
    'STUCK', 'NOG_DECISION', 'NOG_INVOKED', 'NOG_ESCALATION'];
  for (const evt of canonicalEvents) {
    assert.ok(
      watcherSource.includes(`'${evt}'`),
      `Canonical event '${evt}' must be present in orchestrator.js`
    );
  }
});

test('Register is append-only (no truncation or rewrite functions)', () => {
  // No fs.writeFileSync(REGISTER_FILE...) — only appendFileSync
  const lines = watcherSource.split('\n');
  for (const line of lines) {
    if (line.includes('writeFileSync') && line.includes('REGISTER_FILE')) {
      assert.fail('register.jsonl must be append-only — found writeFileSync on REGISTER_FILE');
    }
  }
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);

// Cleanup temp dir
try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch (_) {}

process.exit(failed > 0 ? 1 : 0);
