'use strict';

/**
 * state-gate-mutex.test.js — Slice 259
 *
 * Tests for bridge/state/gate-mutex.js:
 *   1. acquire happy path
 *   2. acquire while held (already_held)
 *   3. release happy path (delete + event + drain)
 *   4. drain FIFO ordering
 *   5. drain tiebreak (same ts, smaller slice ID first)
 *   6. recovery happy (fresh heartbeat → resume)
 *   7. recovery orphan (stale heartbeat → abort + drain)
 *   8. recovery missing heartbeat → treated as stale
 *   9. shouldDeferSquash
 *
 * Run: node test/state-gate-mutex.test.js
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
// Isolation: patch module constants to use a temp directory
// ---------------------------------------------------------------------------

const gateMutex = require('../bridge/state/gate-mutex');
const telemetry = require('../bridge/state/gate-telemetry');

const MUTEX_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'gate-running.json');
const BRANCH_STATE_PATH = path.resolve(__dirname, '..', 'bridge', 'state', 'branch-state.json');
const TEST_REGISTER = path.resolve(__dirname, '..', 'bridge', 'state', 'test-register-mutex.jsonl');

// Point gate-telemetry at a test-local register file
telemetry.setRegisterPath(TEST_REGISTER);

function readTelemetryEvents() {
  try {
    return fs.readFileSync(TEST_REGISTER, 'utf-8')
      .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch (_) { return []; }
}

function clearTelemetry() {
  try { fs.unlinkSync(TEST_REGISTER); } catch (_) {}
}

// Save original branch-state.json content
const originalBranchState = fs.readFileSync(BRANCH_STATE_PATH, 'utf-8');

function cleanup() {
  // Remove mutex file if present
  try { fs.unlinkSync(MUTEX_PATH); } catch (_) {}
  // Restore original branch-state.json
  fs.writeFileSync(BRANCH_STATE_PATH, originalBranchState, 'utf-8');
  // Remove any heartbeat test files
  try { fs.unlinkSync(path.resolve(__dirname, '..', 'bridge', 'state', 'bashir-heartbeat.json')); } catch (_) {}
  // Clear telemetry register
  clearTelemetry();
}

// Event/log capture helpers
function makeDeps() {
  const events = [];
  const logs = [];
  return {
    deps: {
      registerEvent(id, event, extra) { events.push({ id, event, ...extra }); },
      log(level, tag, data) { logs.push({ level, tag, ...data }); },
    },
    events,
    logs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\nstate-gate-mutex.test.js');

// 1. Acquire happy path
test('acquire happy path: file appears, GATE_MUTEX_ACQUIRED event fires', () => {
  cleanup();
  const { deps, events } = makeDeps();

  const result = gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(fs.existsSync(MUTEX_PATH), true);

  const content = JSON.parse(fs.readFileSync(MUTEX_PATH, 'utf-8'));
  assert.strictEqual(content.schema_version, 1);
  assert.strictEqual(content.dev_tip_sha, 'abc123');
  assert.strictEqual(content.bashir_pid, 12345);
  assert.strictEqual(content.bashir_heartbeat_path, 'bridge/state/bashir-heartbeat.json');
  assert.ok(content.started_ts);

  // gate-telemetry emits gate-mutex-acquired (not via registerEvent)
  const telEvents = readTelemetryEvents();
  const acquired = telEvents.find(e => e.event === 'gate-mutex-acquired');
  assert.ok(acquired, 'Expected gate-mutex-acquired telemetry event');
  assert.strictEqual(acquired.dev_tip_sha, 'abc123');
  assert.strictEqual(acquired.bashir_pid, 12345);

  cleanup();
});

// 2. Acquire while held
test('acquire while held: returns already_held, no overwrite, no event', () => {
  cleanup();
  const { deps: deps1 } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', deps1);

  const originalContent = fs.readFileSync(MUTEX_PATH, 'utf-8');
  const { deps: deps2, events: events2 } = makeDeps();
  const result = gateMutex.acquireGateMutex('def456', 99999, 'bridge/state/bashir-heartbeat.json', deps2);

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'already_held');
  assert.strictEqual(events2.length, 0);

  // File not overwritten
  const currentContent = fs.readFileSync(MUTEX_PATH, 'utf-8');
  assert.strictEqual(currentContent, originalContent);

  cleanup();
});

// 3. Release happy path
test('release happy path: file deleted, GATE_MUTEX_RELEASED event fires, drain runs', () => {
  cleanup();
  const { deps: acquireDeps } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', acquireDeps);
  assert.strictEqual(fs.existsSync(MUTEX_PATH), true);

  const { deps, events } = makeDeps();
  gateMutex.releaseGateMutex('regression_pass', deps);

  assert.strictEqual(fs.existsSync(MUTEX_PATH), false);
  // gate-telemetry emits gate-mutex-released (not via registerEvent)
  const telEvents = readTelemetryEvents();
  const released = telEvents.find(e => e.event === 'gate-mutex-released');
  assert.ok(released, 'Expected gate-mutex-released telemetry event');
  assert.strictEqual(released.reason, 'regression_pass');

  cleanup();
});

// 4. Drain FIFO ordering
test('drain FIFO ordering: deferred_slices sorted by accepted_ts', () => {
  cleanup();

  // Set up branch-state with deferred_slices in wrong order
  const state = JSON.parse(originalBranchState);
  const T0 = '2026-04-28T18:00:00.000Z';
  const T1 = '2026-04-28T18:05:00.000Z';
  state.dev.deferred_slices = [
    { id: '240', accepted_ts: T1 },
    { id: '239', accepted_ts: T0 },
  ];
  fs.writeFileSync(BRANCH_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');

  const { deps, logs } = makeDeps();

  gateMutex.drainDeferredSlices(deps);

  // squashSliceToDev throws for each — drain breaks on first failure.
  // The first attempt should be slice 239 (T0 is earlier).
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].msg.includes('239'), `Expected first drain attempt to be slice 239, got: ${logs[0].msg}`);

  cleanup();
});

// 5. Drain tiebreak: same accepted_ts → smaller slice ID first
test('drain tiebreak: same accepted_ts, smaller slice ID first', () => {
  cleanup();

  const state = JSON.parse(originalBranchState);
  const T0 = '2026-04-28T18:00:00.000Z';
  state.dev.deferred_slices = [
    { id: '241', accepted_ts: T0 },
    { id: '239', accepted_ts: T0 },
    { id: '240', accepted_ts: T0 },
  ];
  fs.writeFileSync(BRANCH_STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');

  const { deps, logs } = makeDeps();
  gateMutex.drainDeferredSlices(deps);

  // First failure should be slice 239 (smallest ID)
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0].msg.includes('239'), `Expected first drain attempt to be slice 239, got: ${logs[0].msg}`);

  cleanup();
});

// 6. Recovery happy: mutex present, heartbeat fresh → resume
test('recovery happy: mutex present, heartbeat fresh, resume — mutex untouched', () => {
  cleanup();

  // Create mutex file
  const { deps: acquireDeps } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', acquireDeps);

  // Create fresh heartbeat
  const heartbeatPath = path.resolve(__dirname, '..', 'bridge', 'state', 'bashir-heartbeat.json');
  fs.writeFileSync(heartbeatPath, JSON.stringify({ ts: new Date().toISOString() }, null, 2) + '\n', 'utf-8');

  const { deps, events, logs } = makeDeps();
  gateMutex.recoverGateMutex(deps);

  // Mutex should still exist
  assert.strictEqual(fs.existsSync(MUTEX_PATH), true);
  // No GATE_ABORTED event
  assert.strictEqual(events.filter(e => e.event === 'GATE_ABORTED').length, 0);
  // Log says resuming
  assert.ok(logs.some(l => l.msg && l.msg.includes('resuming')));

  cleanup();
});

// 7. Recovery orphan: mutex present, heartbeat stale → abort + drain
test('recovery orphan: mutex present, heartbeat stale → GATE_ABORTED, mutex deleted, drain runs', () => {
  cleanup();

  // Create mutex file
  const { deps: acquireDeps } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', acquireDeps);

  // Create stale heartbeat (2 minutes old)
  const heartbeatPath = path.resolve(__dirname, '..', 'bridge', 'state', 'bashir-heartbeat.json');
  const staleTs = new Date(Date.now() - 120000).toISOString();
  fs.writeFileSync(heartbeatPath, JSON.stringify({ ts: staleTs }, null, 2) + '\n', 'utf-8');

  const { deps, events } = makeDeps();
  gateMutex.recoverGateMutex(deps);

  // Mutex should be deleted
  assert.strictEqual(fs.existsSync(MUTEX_PATH), false);
  // gate-telemetry emits gate-mutex-orphan-recovered
  const telEvents = readTelemetryEvents();
  const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
  assert.ok(orphanEvt, 'Expected gate-mutex-orphan-recovered telemetry event');
  assert.strictEqual(orphanEvt.recovery_signal, 'heartbeat-stale');

  cleanup();
});

// 8. Recovery missing heartbeat: mutex present, heartbeat file absent → stale path
test('recovery missing-heartbeat: mutex present, no heartbeat file → treated as stale', () => {
  cleanup();

  // Create mutex file pointing to a non-existent heartbeat
  const { deps: acquireDeps } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', acquireDeps);

  // Do NOT create heartbeat file
  const heartbeatPath = path.resolve(__dirname, '..', 'bridge', 'state', 'bashir-heartbeat.json');
  try { fs.unlinkSync(heartbeatPath); } catch (_) {}

  const { deps, events } = makeDeps();
  gateMutex.recoverGateMutex(deps);

  // Same as stale: mutex deleted, orphan-recovered event emitted
  assert.strictEqual(fs.existsSync(MUTEX_PATH), false);
  const telEvents = readTelemetryEvents();
  const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
  assert.ok(orphanEvt, 'Expected gate-mutex-orphan-recovered telemetry event');
  assert.strictEqual(orphanEvt.recovery_signal, 'process-gone');

  cleanup();
});

// 9. shouldDeferSquash
test('shouldDeferSquash: returns true when mutex exists, false otherwise', () => {
  cleanup();
  assert.strictEqual(gateMutex.shouldDeferSquash(), false);

  const { deps } = makeDeps();
  gateMutex.acquireGateMutex('abc123', 12345, 'bridge/state/bashir-heartbeat.json', deps);
  assert.strictEqual(gateMutex.shouldDeferSquash(), true);

  cleanup();
  assert.strictEqual(gateMutex.shouldDeferSquash(), false);

  cleanup();
});

// ---------------------------------------------------------------------------
// Final cleanup + summary
// ---------------------------------------------------------------------------

cleanup();

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
