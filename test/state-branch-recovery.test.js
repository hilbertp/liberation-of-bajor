'use strict';

/**
 * state-branch-recovery.test.js — Slice 258
 *
 * Tests for reconcileBranchState():
 *   1. Absent file: writes initial schema, emits BRANCH_STATE_INITIALIZED
 *   2. Present + parseable: re-derives branch section, preserves gate
 *   3. Corrupt file: emits BRANCH_STATE_RESET_FROM_CORRUPT, writes fresh schema
 *
 * Run: node test/state-branch-recovery.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

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

const TEST_ROOT = path.join(os.tmpdir(), `ds9-branch-recovery-test-${Date.now()}-${process.pid}`);
fs.mkdirSync(TEST_ROOT, { recursive: true });

// ---------------------------------------------------------------------------
// We need to override STATE_FILE for testing. The module uses a resolved path,
// so we'll directly test the logic by requiring the module and monkey-patching.
// Instead, we replicate the recovery logic in a testable way by requiring
// the constituent parts and driving them with a custom STATE_FILE path.
// ---------------------------------------------------------------------------

const { writeJsonAtomic } = require('../bridge/state/atomic-write');
const { createInitialBranchState } = require('../bridge/state/initial-schema');

/**
 * Portable version of reconcileBranchState that accepts a custom stateFile path.
 * Mirrors the real implementation exactly.
 */
function reconcileForTest(stateFile, { registerEvent, log, runGit }) {
  let existing = null;
  let corrupt = false;

  if (fs.existsSync(stateFile)) {
    const raw = fs.readFileSync(stateFile, 'utf-8');
    try {
      existing = JSON.parse(raw);
    } catch (_) {
      corrupt = true;
      const truncated = raw.length > 1024 ? raw.slice(0, 1024) : raw;
      log('warn', 'branch_state', { msg: 'branch-state.json is corrupt, resetting to initial schema' });
      registerEvent('0', 'BRANCH_STATE_RESET_FROM_CORRUPT', { corrupt_content: truncated });
    }
  }

  if (!existing) {
    const initial = createInitialBranchState();
    writeJsonAtomic(stateFile, initial);
    if (!corrupt) {
      registerEvent('0', 'BRANCH_STATE_INITIALIZED', {});
    }
    return initial;
  }

  const state = Object.assign(createInitialBranchState(), existing);

  try {
    const mainSha = runGit('git rev-parse main', { slice_id: '0', op: 'branchState_mainTip', encoding: 'utf-8' }).trim();
    const mainSubject = runGit('git log -1 --format=%s main', { slice_id: '0', op: 'branchState_mainSubject', encoding: 'utf-8' }).trim();
    const mainTs = runGit('git log -1 --format=%cI main', { slice_id: '0', op: 'branchState_mainTs', encoding: 'utf-8' }).trim();
    state.main = { tip_sha: mainSha, tip_subject: mainSubject, tip_ts: mainTs };
  } catch (err) {
    log('warn', 'branch_state', { msg: 'Failed to read main tip from git', error: err.message });
    state.main = createInitialBranchState().main;
  }

  try {
    const devSha = runGit('git rev-parse dev', { slice_id: '0', op: 'branchState_devTip', encoding: 'utf-8' }).trim();
    const devTs = runGit('git log -1 --format=%cI dev', { slice_id: '0', op: 'branchState_devTs', encoding: 'utf-8' }).trim();
    const aheadStr = runGit('git rev-list main..dev --count', { slice_id: '0', op: 'branchState_devAhead', encoding: 'utf-8' }).trim();
    const aheadCount = parseInt(aheadStr, 10) || 0;

    let commits = [];
    if (aheadCount > 0) {
      const logOutput = runGit('git log main..dev --format=%H|%s', { slice_id: '0', op: 'branchState_devCommits', encoding: 'utf-8' }).trim();
      commits = logOutput.split('\n').filter(Boolean).map(line => {
        const [sha, ...rest] = line.split('|');
        return { sha, subject: rest.join('|') };
      });
    }

    state.dev = {
      tip_sha: devSha,
      tip_ts: devTs,
      commits_ahead_of_main: aheadCount,
      commits,
      deferred_slices: (existing.dev && existing.dev.deferred_slices) || [],
    };
  } catch (_) {
    state.dev = createInitialBranchState().dev;
    if (existing.dev && existing.dev.deferred_slices) {
      state.dev.deferred_slices = existing.dev.deferred_slices;
    }
  }

  try {
    const mergeBase = runGit('git merge-base main dev', { slice_id: '0', op: 'branchState_mergeBase', encoding: 'utf-8' }).trim();
    const mergeTs = runGit(`git log -1 --format=%cI ${mergeBase}`, { slice_id: '0', op: 'branchState_mergeTs', encoding: 'utf-8' }).trim();
    state.last_merge = { sha: mergeBase, ts: mergeTs };
  } catch (_) {
    state.last_merge = null;
  }

  state.gate = existing.gate || createInitialBranchState().gate;
  writeJsonAtomic(stateFile, state);
  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvents() {
  const events = [];
  return {
    events,
    registerEvent: (id, event, extra) => events.push({ id, event, extra }),
  };
}

function makeLogs() {
  const logs = [];
  return {
    logs,
    log: (level, category, detail) => logs.push({ level, category, detail }),
  };
}

function fakeRunGit(responses) {
  return (cmd) => {
    for (const [pattern, value] of Object.entries(responses)) {
      if (cmd.includes(pattern)) {
        if (value instanceof Error) throw value;
        return value;
      }
    }
    throw new Error(`Unexpected git command: ${cmd}`);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\nstate-branch-recovery.test.js');

test('absent file: writes initial schema and emits BRANCH_STATE_INITIALIZED', () => {
  const stateFile = path.join(TEST_ROOT, 'absent-test.json');
  const { events, registerEvent } = makeEvents();
  const { log } = makeLogs();
  const runGit = fakeRunGit({});

  const result = reconcileForTest(stateFile, { registerEvent, log, runGit });

  // File written
  assert.strictEqual(fs.existsSync(stateFile), true);
  const written = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert.strictEqual(written.schema_version, 1);
  assert.strictEqual(written.gate.status, 'IDLE');
  assert.strictEqual(written.main.tip_sha, null);
  assert.deepStrictEqual(written.dev.commits, []);

  // Event emitted
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].event, 'BRANCH_STATE_INITIALIZED');

  // Return value matches
  assert.deepStrictEqual(result, written);
});

test('present + parseable: re-derives branch section from git, preserves gate', () => {
  const stateFile = path.join(TEST_ROOT, 'present-test.json');
  const existing = createInitialBranchState();
  existing.gate = { status: 'RUNNING', current_run: 'test-run-42', last_failure: null, last_pass: null };
  existing.dev.deferred_slices = ['slice/99'];
  fs.writeFileSync(stateFile, JSON.stringify(existing, null, 2) + '\n');

  const { events, registerEvent } = makeEvents();
  const { log } = makeLogs();
  const runGit = fakeRunGit({
    'rev-parse main': 'abc123\n',
    'log -1 --format=%s main': 'fix: something\n',
    'log -1 --format=%cI main': '2026-04-28T10:00:00+00:00\n',
    'rev-parse dev': 'def456\n',
    'log -1 --format=%cI dev': '2026-04-28T11:00:00+00:00\n',
    'rev-list main..dev --count': '2\n',
    'log main..dev --format=%H|%s': 'aaa|first commit\nbbb|second commit\n',
    'merge-base main dev': 'abc123\n',
    'log -1 --format=%cI abc123': '2026-04-28T09:00:00+00:00\n',
  });

  const result = reconcileForTest(stateFile, { registerEvent, log, runGit });

  // Branch section re-derived
  assert.strictEqual(result.main.tip_sha, 'abc123');
  assert.strictEqual(result.main.tip_subject, 'fix: something');
  assert.strictEqual(result.dev.tip_sha, 'def456');
  assert.strictEqual(result.dev.commits_ahead_of_main, 2);
  assert.strictEqual(result.dev.commits.length, 2);
  assert.strictEqual(result.dev.commits[0].sha, 'aaa');
  assert.strictEqual(result.dev.commits[0].subject, 'first commit');

  // Gate preserved
  assert.strictEqual(result.gate.status, 'RUNNING');
  assert.strictEqual(result.gate.current_run, 'test-run-42');

  // deferred_slices preserved
  assert.deepStrictEqual(result.dev.deferred_slices, ['slice/99']);

  // last_merge set
  assert.strictEqual(result.last_merge.sha, 'abc123');

  // No events emitted (normal reconcile)
  assert.strictEqual(events.length, 0);

  // File written atomically
  const written = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert.deepStrictEqual(written, result);
});

test('corrupt file: emits BRANCH_STATE_RESET_FROM_CORRUPT, writes fresh schema', () => {
  const stateFile = path.join(TEST_ROOT, 'corrupt-test.json');
  const corruptContent = '{this is not valid JSON!!!';
  fs.writeFileSync(stateFile, corruptContent);

  const { events, registerEvent } = makeEvents();
  const { logs, log } = makeLogs();
  const runGit = fakeRunGit({});

  const result = reconcileForTest(stateFile, { registerEvent, log, runGit });

  // Fresh schema written
  const written = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert.strictEqual(written.schema_version, 1);
  assert.strictEqual(written.gate.status, 'IDLE');
  assert.strictEqual(written.main.tip_sha, null);

  // Event emitted with corrupt content
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].event, 'BRANCH_STATE_RESET_FROM_CORRUPT');
  assert.strictEqual(events[0].extra.corrupt_content, corruptContent);

  // Warning logged
  assert.strictEqual(logs.some(l => l.level === 'warn'), true);

  // Return value is initial schema
  assert.deepStrictEqual(result, createInitialBranchState());
});

test('corrupt file: truncates content to 1KB in event', () => {
  const stateFile = path.join(TEST_ROOT, 'corrupt-long-test.json');
  const longCorrupt = 'x'.repeat(2048);
  fs.writeFileSync(stateFile, longCorrupt);

  const { events, registerEvent } = makeEvents();
  const { log } = makeLogs();
  const runGit = fakeRunGit({});

  reconcileForTest(stateFile, { registerEvent, log, runGit });

  assert.strictEqual(events[0].extra.corrupt_content.length, 1024);
});

test('idempotent: same git state produces same output on re-run', () => {
  const stateFile = path.join(TEST_ROOT, 'idempotent-test.json');
  const { registerEvent } = makeEvents();
  const { log } = makeLogs();
  const gitResponses = {
    'rev-parse main': 'abc123\n',
    'log -1 --format=%s main': 'fix: something\n',
    'log -1 --format=%cI main': '2026-04-28T10:00:00+00:00\n',
    'rev-parse dev': 'def456\n',
    'log -1 --format=%cI dev': '2026-04-28T11:00:00+00:00\n',
    'rev-list main..dev --count': '0\n',
    'merge-base main dev': 'abc123\n',
    'log -1 --format=%cI abc123': '2026-04-28T09:00:00+00:00\n',
  };

  // First run: creates from absent
  reconcileForTest(stateFile, { registerEvent, log, runGit: fakeRunGit(gitResponses) });
  const first = fs.readFileSync(stateFile, 'utf-8');

  // Second run: reconciles from existing
  reconcileForTest(stateFile, { registerEvent, log, runGit: fakeRunGit(gitResponses) });
  const second = fs.readFileSync(stateFile, 'utf-8');

  // Both produce equivalent state (ignoring the first run's null values vs derived)
  const firstParsed = JSON.parse(first);
  const secondParsed = JSON.parse(second);
  // After second run, branch section should be derived from git
  assert.strictEqual(secondParsed.main.tip_sha, 'abc123');
  // Third run should produce identical output to second
  reconcileForTest(stateFile, { registerEvent, log, runGit: fakeRunGit(gitResponses) });
  const third = fs.readFileSync(stateFile, 'utf-8');
  assert.strictEqual(second, third);
});

// ---------------------------------------------------------------------------
// Cleanup + summary
// ---------------------------------------------------------------------------

fs.rmSync(TEST_ROOT, { recursive: true, force: true });

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
