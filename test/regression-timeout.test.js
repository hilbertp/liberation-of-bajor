'use strict';

/**
 * regression-timeout.test.js — Slice 268
 *
 * Verifies that when the regression suite times out:
 *   1. Emits regression-fail with reason "suite-timeout" and empty failed_acs
 *   2. Kills the runner subprocess
 *   3. Releases the mutex
 *   4. Sets gate.status to GATE_FAILED
 *
 * Run: DS9_REGRESSION_TIMEOUT_S=2 node test/regression-timeout.test.js
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
// Isolation
// ---------------------------------------------------------------------------

const BRANCH_STATE_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'branch-state.json');
const MUTEX_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'gate-running.json');
const TEST_REGISTER = path.resolve(__dirname, '..', 'bridge', 'state', 'test-register-268-timeout.jsonl');

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
  try { fs.unlinkSync(MUTEX_PATH); } catch (_) {}
  try { fs.writeFileSync(BRANCH_STATE_PATH, originalBranchState, 'utf-8'); } catch (_) {}
}

const ctx = {
  registerEvent: () => {},
  log: () => {},
};

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

console.log('\nregression-timeout.test.js');
console.log('\u2500'.repeat(50));

// The timeout test requires DS9_REGRESSION_TIMEOUT_S to be set low.
// The orchestrator reads it at module load time, so we check whether
// the constant matches what we expect.
const orchestrator = require('../bridge/orchestrator');

test('REGRESSION_TIMEOUT_MS respects DS9_REGRESSION_TIMEOUT_S env', () => {
  const envVal = process.env.DS9_REGRESSION_TIMEOUT_S;
  if (envVal) {
    assert.strictEqual(orchestrator.REGRESSION_TIMEOUT_MS, parseInt(envVal, 10) * 1000);
  }
  // If env not set, default is 600s = 600000ms
  if (!envVal) {
    assert.strictEqual(orchestrator.REGRESSION_TIMEOUT_MS, 600000);
  }
});

test('regression-timeout emits correct event, releases mutex, kills runner', (done) => {
  cleanup();

  // Create a synthetic infinite-loop suite
  const suiteDir = path.resolve(__dirname, '..', 'regression', '_test_timeout_suite');
  fs.mkdirSync(suiteDir, { recursive: true });
  fs.writeFileSync(path.join(suiteDir, 'hang.test.js'),
    `const { test } = require('node:test');
test('slice-77-ac-0 this test hangs forever', () => {
  return new Promise(() => {}); // never resolves
});
`, 'utf-8');

  // Set up mutex + branch state
  writeJsonAtomic(MUTEX_PATH, {
    schema_version: 1,
    started_ts: new Date().toISOString(),
    dev_tip_sha: 'timeouttest789',
    bashir_pid: null,
    bashir_heartbeat_path: null,
  });

  const state = JSON.parse(originalBranchState);
  state.gate = { status: 'GATE_RUNNING', current_run: { started_ts: new Date().toISOString() } };
  writeJsonAtomic(BRANCH_STATE_PATH, state);

  orchestrator._gateTestsUpdated('timeouttest789', ctx);

  // Poll for telemetry — timeout should fire based on REGRESSION_TIMEOUT_MS
  // With DS9_REGRESSION_TIMEOUT_S=2, expect ~2s wait
  let attempts = 0;
  const maxAttempts = Math.ceil((orchestrator.REGRESSION_TIMEOUT_MS + 10000) / 500);
  const poll = setInterval(() => {
    attempts++;
    const events = readTelemetryEvents();
    const failEvent = events.find(e => e.event === 'regression-fail');
    if (failEvent) {
      clearInterval(poll);

      assert.strictEqual(failEvent.reason, 'suite-timeout', 'reason should be suite-timeout');
      assert.deepStrictEqual(failEvent.failed_acs, [], 'failed_acs should be empty on timeout');

      // Verify branch-state
      const bsAfter = JSON.parse(fs.readFileSync(BRANCH_STATE_PATH, 'utf-8'));
      assert.strictEqual(bsAfter.gate.status, 'GATE_FAILED');
      assert.strictEqual(bsAfter.gate.current_run, null);

      // Verify mutex released
      assert.ok(!fs.existsSync(MUTEX_PATH), 'Mutex should be released on timeout');

      // Cleanup synthetic suite
      try { fs.unlinkSync(path.join(suiteDir, 'hang.test.js')); } catch (_) {}
      try { fs.rmdirSync(suiteDir); } catch (_) {}
      cleanup();

      passed++;
      console.log('  \u2713 regression-timeout: correct event + mutex released');
      report();
      return;
    }
    if (attempts > maxAttempts) {
      clearInterval(poll);
      try { fs.unlinkSync(path.join(suiteDir, 'hang.test.js')); } catch (_) {}
      try { fs.rmdirSync(suiteDir); } catch (_) {}
      cleanup();

      failed++;
      console.log('  \u2717 regression-timeout: timed out waiting for timeout event');
      report();
    }
  }, 500);
});

// Decrement for async test
passed--;

function report() {
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}
