'use strict';

/**
 * regression-pass.test.js — Slice 268
 *
 * Verifies that when the regression suite passes (exit 0), the orchestrator:
 *   1. Emits regression-pass with { suite_size, duration_ms }
 *   2. Updates branch-state.gate.last_pass
 *   3. Does NOT release the mutex (slice 269's job)
 *
 * Run: node test/regression-pass.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

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

// ---------------------------------------------------------------------------
// Isolation — redirect telemetry to a temp register
// ---------------------------------------------------------------------------

const BRANCH_STATE_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'branch-state.json');
const MUTEX_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'gate-running.json');
const TEST_REGISTER = path.resolve(__dirname, '..', 'bridge', 'state', 'test-register-268-pass.jsonl');

const telemetry = require('../bridge/state/gate-telemetry');
telemetry.setRegisterPath(TEST_REGISTER);

const { writeJsonAtomic } = require('../bridge/state/atomic-write');

const originalBranchState = fs.readFileSync(BRANCH_STATE_PATH, 'utf-8');

function readTelemetryEvents() {
  try {
    return fs.readFileSync(TEST_REGISTER, 'utf-8')
      .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch (_) { return []; }
}

function cleanup() {
  try { fs.unlinkSync(TEST_REGISTER); } catch (_) {}
  try { fs.writeFileSync(BRANCH_STATE_PATH, originalBranchState, 'utf-8'); } catch (_) {}
  // Do NOT remove mutex — some tests check its presence
}

// Stub ctx
const ctx = {
  registerEvent: () => {},
  log: () => {},
};

// ---------------------------------------------------------------------------
// Load module under test
// ---------------------------------------------------------------------------

const orchestrator = require('../bridge/orchestrator');

// ---------------------------------------------------------------------------
// Unit tests for _parseSuiteSize
// ---------------------------------------------------------------------------

console.log('\nregression-pass.test.js');
console.log('\u2500'.repeat(50));

test('_parseSuiteSize extracts count from spec format', () => {
  const output = '\u2139 tests 5\n\u2139 pass 5\n\u2139 fail 0\n';
  assert.strictEqual(orchestrator._parseSuiteSize(output), 5);
});

test('_parseSuiteSize extracts count from TAP plan line', () => {
  const output = 'TAP version 13\n1..5\nok 1 - test one\nok 2 - test two\n';
  assert.strictEqual(orchestrator._parseSuiteSize(output), 5);
});

test('_parseSuiteSize extracts count from # tests summary', () => {
  const output = '# tests 12\n# pass 12\n# fail 0\n';
  assert.strictEqual(orchestrator._parseSuiteSize(output), 12);
});

test('_parseSuiteSize returns 0 for unparseable output', () => {
  assert.strictEqual(orchestrator._parseSuiteSize('no plan here'), 0);
});

// ---------------------------------------------------------------------------
// Integration: _gateTestsUpdated with an all-pass synthetic suite
// ---------------------------------------------------------------------------

test('regression-pass emits correct event via telemetry', (done) => {
  cleanup();

  // Create a synthetic passing suite
  const suiteDir = path.resolve(__dirname, '..', 'regression', '_test_pass_suite');
  fs.mkdirSync(suiteDir, { recursive: true });
  fs.writeFileSync(path.join(suiteDir, 'pass.test.js'),
    `const { test } = require('node:test');
const assert = require('assert');
test('slice-99-ac-0 everything passes', () => { assert.ok(true); });
test('slice-99-ac-1 also passes', () => { assert.ok(true); });
`, 'utf-8');

  // Set up mutex + branch state
  writeJsonAtomic(MUTEX_PATH, {
    schema_version: 1,
    started_ts: new Date().toISOString(),
    dev_tip_sha: 'passtest123',
    bashir_pid: null,
    bashir_heartbeat_path: null,
  });

  const state = JSON.parse(originalBranchState);
  state.gate = { status: 'GATE_RUNNING', current_run: { started_ts: new Date().toISOString() } };
  writeJsonAtomic(BRANCH_STATE_PATH, state);

  // Call _gateTestsUpdated — it spawns async, so we poll for the result
  orchestrator._gateTestsUpdated('passtest123', ctx);

  // Poll for telemetry (execFile is async)
  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;
    const events = readTelemetryEvents();
    const passEvent = events.find(e => e.event === 'regression-pass');
    if (passEvent) {
      clearInterval(poll);

      assert.ok(passEvent.suite_size >= 0, 'suite_size should be present');
      assert.ok(typeof passEvent.duration_ms === 'number', 'duration_ms should be a number');

      // Verify branch-state: last_pass populated, status still GATE_RUNNING
      const bsAfter = JSON.parse(fs.readFileSync(BRANCH_STATE_PATH, 'utf-8'));
      assert.ok(bsAfter.gate.last_pass, 'last_pass should be populated');
      assert.strictEqual(bsAfter.gate.last_pass.dev_tip_sha, 'passtest123');

      // Verify mutex NOT released (file should still exist)
      assert.ok(fs.existsSync(MUTEX_PATH), 'Mutex should NOT be released on pass');

      // Cleanup synthetic suite
      try { fs.unlinkSync(path.join(suiteDir, 'pass.test.js')); } catch (_) {}
      try { fs.rmdirSync(suiteDir); } catch (_) {}
      cleanup();
      try { fs.unlinkSync(MUTEX_PATH); } catch (_) {}

      passed++;
      console.log('  \u2713 regression-pass: correct event + mutex held + last_pass set');
      report();
      return;
    }
    if (attempts > 60) {
      clearInterval(poll);
      // Cleanup
      try { fs.unlinkSync(path.join(suiteDir, 'pass.test.js')); } catch (_) {}
      try { fs.rmdirSync(suiteDir); } catch (_) {}
      cleanup();
      try { fs.unlinkSync(MUTEX_PATH); } catch (_) {}

      failed++;
      console.log('  \u2717 regression-pass: timed out waiting for event');
      report();
    }
  }, 500);
});

// Decrement passed because the async test reports itself
// (the sync `test()` wrapper already counted a pass for the call not throwing)
passed--;

function report() {
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}
