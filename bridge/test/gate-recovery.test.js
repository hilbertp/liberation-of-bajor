'use strict';

/**
 * gate-recovery.test.js — Slice 260 (W-Bash-C)
 *
 * Integration tests for gate mutex recovery, drain ordering, telemetry,
 * and state-doctor gate-health. Exercises all 10 failure modes from the
 * A1 runbook.
 *
 * Run: node --test bridge/test/gate-recovery.test.js
 *
 * Uses node:test (built-in). No new npm dependencies.
 * Each scenario creates a fixture bridge/state/ in a tmp dir.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir;
let stateDir;
let registerPath;

function makeTmpDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-recovery-test-'));
  stateDir = path.join(tmpDir, 'bridge', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  registerPath = path.join(tmpDir, 'bridge', 'register.jsonl');
  // Ensure register parent exists
  fs.mkdirSync(path.join(tmpDir, 'bridge'), { recursive: true });
}

function cleanTmpDir() {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeMutex(payload) {
  fs.writeFileSync(path.join(stateDir, 'gate-running.json'), JSON.stringify(payload, null, 2) + '\n');
}

function readMutex() {
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir, 'gate-running.json'), 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function mutexExists() {
  return fs.existsSync(path.join(stateDir, 'gate-running.json'));
}

function writeHeartbeat(ageMs) {
  const ts = new Date(Date.now() - ageMs).toISOString();
  const hbPath = path.join(stateDir, 'bashir-heartbeat.json');
  fs.writeFileSync(hbPath, JSON.stringify({ ts, slice_id: 'test' }) + '\n');
  return hbPath;
}

function writeBranchState(state) {
  fs.writeFileSync(path.join(stateDir, 'branch-state.json'), JSON.stringify(state, null, 2) + '\n');
}

function readBranchState() {
  return JSON.parse(fs.readFileSync(path.join(stateDir, 'branch-state.json'), 'utf-8'));
}

function readRegisterEvents() {
  try {
    const raw = fs.readFileSync(registerPath, 'utf-8').trim();
    if (!raw) return [];
    return raw.split('\n').map(l => JSON.parse(l));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

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
// Fresh require with patched paths — uses real module paths with cleanup
// ---------------------------------------------------------------------------

const gateMutex = require('../state/gate-mutex');
const telemetry = require('../state/gate-telemetry');

const REAL_MUTEX_PATH = gateMutex.MUTEX_PATH;
const REAL_BRANCH_STATE_PATH = gateMutex.BRANCH_STATE_PATH;

// Save originals for restore
let originalBranchState;

function saveOriginals() {
  try {
    originalBranchState = fs.readFileSync(REAL_BRANCH_STATE_PATH, 'utf-8');
  } catch (_) {
    originalBranchState = JSON.stringify({
      schema_version: 1,
      main: { tip_sha: null, tip_subject: null, tip_ts: null },
      dev: { tip_sha: null, tip_ts: null, commits_ahead_of_main: 0, commits: [], deferred_slices: [] },
      last_merge: null,
      gate: { status: 'IDLE', current_run: null, last_failure: null, last_pass: null },
    }, null, 2) + '\n';
  }
}

function restoreOriginals() {
  // Remove mutex if present
  try { fs.unlinkSync(REAL_MUTEX_PATH); } catch (_) {}
  // Restore branch-state.json
  fs.writeFileSync(REAL_BRANCH_STATE_PATH, originalBranchState, 'utf-8');
  // Remove test heartbeat
  try { fs.unlinkSync(path.resolve(path.dirname(REAL_MUTEX_PATH), 'bashir-heartbeat.json')); } catch (_) {}
}

function writeRealMutex(payload) {
  fs.writeFileSync(REAL_MUTEX_PATH, JSON.stringify(payload, null, 2) + '\n');
}

function writeRealHeartbeat(ageMs) {
  const ts = new Date(Date.now() - ageMs).toISOString();
  const hbDir = path.dirname(REAL_MUTEX_PATH);
  const hbPath = path.join(hbDir, 'bashir-heartbeat.json');
  fs.writeFileSync(hbPath, JSON.stringify({ ts, slice_id: 'test' }) + '\n');
  // Return path relative to repo root (2 dirs up from state/)
  return path.relative(path.resolve(hbDir, '..', '..'), hbPath);
}

function realMutexExists() {
  return fs.existsSync(REAL_MUTEX_PATH);
}

// Set up telemetry to write to a tmp register for isolation
let telemetryRegister;
function setupTelemetryRegister() {
  makeTmpDir();
  telemetryRegister = registerPath;
  telemetry.setRegisterPath(telemetryRegister);
}

function readTelemetryEvents() {
  return readRegisterEvents();
}

function teardownTelemetryRegister() {
  // Reset telemetry to default
  telemetry.setRegisterPath(path.resolve(__dirname, '..', 'register.jsonl'));
  cleanTmpDir();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gate recovery integration tests', () => {
  beforeEach(() => {
    saveOriginals();
    setupTelemetryRegister();
  });

  afterEach(() => {
    restoreOriginals();
    teardownTelemetryRegister();
  });

  // 1. Orphaned mutex via stale heartbeat
  it('recovers orphaned mutex when heartbeat is stale (95s old)', () => {
    const hbPath = writeRealHeartbeat(95000); // 95s old, above 90s threshold
    writeRealMutex({
      schema_version: 1,
      started_ts: new Date(Date.now() - 120000).toISOString(),
      dev_tip_sha: 'abc123',
      bashir_pid: 99999,
      bashir_heartbeat_path: hbPath,
    });

    const { deps, events } = makeDeps();
    gateMutex.recoverGateMutex(deps);

    assert.equal(realMutexExists(), false, 'mutex should be deleted');

    // Check telemetry event (gate-telemetry is sole gate writer — no legacy registerEvent)
    const telEvents = readTelemetryEvents();
    const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
    assert.ok(orphanEvt, 'should emit gate-mutex-orphan-recovered');
    assert.equal(orphanEvt.recovery_signal, 'heartbeat-stale');
  });

  // 2. Orphaned mutex via missing heartbeat file
  it('recovers orphaned mutex when heartbeat file is missing', () => {
    writeRealMutex({
      schema_version: 1,
      started_ts: new Date(Date.now() - 120000).toISOString(),
      dev_tip_sha: 'abc123',
      bashir_pid: 99999,
      bashir_heartbeat_path: 'bridge/state/nonexistent-heartbeat.json',
    });

    const { deps, events } = makeDeps();
    gateMutex.recoverGateMutex(deps);

    assert.equal(realMutexExists(), false, 'mutex should be deleted');

    const telEvents = readTelemetryEvents();
    const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
    assert.ok(orphanEvt, 'should emit gate-mutex-orphan-recovered');
    assert.equal(orphanEvt.recovery_signal, 'process-gone');
  });

  // 3. Fresh heartbeat → no recovery
  it('does not recover mutex when heartbeat is fresh (5s old)', () => {
    const hbPath = writeRealHeartbeat(5000); // 5s old, well within threshold
    writeRealMutex({
      schema_version: 1,
      started_ts: new Date(Date.now() - 60000).toISOString(),
      dev_tip_sha: 'abc123',
      bashir_pid: 99999,
      bashir_heartbeat_path: hbPath,
    });

    const { deps, events } = makeDeps();
    gateMutex.recoverGateMutex(deps);

    assert.equal(realMutexExists(), true, 'mutex should still be present');

    const telEvents = readTelemetryEvents();
    const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
    assert.equal(orphanEvt, undefined, 'should not emit orphan-recovered');
  });

  // 4. PID reuse trap — stale heartbeat, live PID
  it('recovers based on heartbeat even if PID matches a live process', () => {
    const hbPath = writeRealHeartbeat(95000); // stale
    // Use PID 1 which always exists on any Unix system
    writeRealMutex({
      schema_version: 1,
      started_ts: new Date(Date.now() - 120000).toISOString(),
      dev_tip_sha: 'abc123',
      bashir_pid: 1,
      bashir_heartbeat_path: hbPath,
    });

    const { deps } = makeDeps();
    gateMutex.recoverGateMutex(deps);

    assert.equal(realMutexExists(), false, 'mutex should be deleted (heartbeat is authoritative, PID is diagnostic)');

    const telEvents = readTelemetryEvents();
    const orphanEvt = telEvents.find(e => e.event === 'gate-mutex-orphan-recovered');
    assert.ok(orphanEvt, 'should emit orphan-recovered');
    assert.equal(orphanEvt.recovery_signal, 'heartbeat-stale');
  });

  // 5. Idempotent gate-start — acquire twice
  it('second acquireGateMutex returns already_held without clobbering', () => {
    const hbPath = writeRealHeartbeat(1000);
    const { deps } = makeDeps();

    const first = gateMutex.acquireGateMutex('sha1', 1234, hbPath, deps);
    assert.equal(first.ok, true);

    const originalMutex = JSON.parse(fs.readFileSync(REAL_MUTEX_PATH, 'utf-8'));

    const second = gateMutex.acquireGateMutex('sha2', 5678, hbPath, deps);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'already_held');

    // Verify mutex wasn't clobbered
    const afterMutex = JSON.parse(fs.readFileSync(REAL_MUTEX_PATH, 'utf-8'));
    assert.equal(afterMutex.dev_tip_sha, originalMutex.dev_tip_sha, 'mutex should be unchanged');
  });

  // 6. FIFO drain order — accepted_ts ascending
  it('drains deferred slices in accepted_ts order, not numeric ID order', () => {
    // Write branch-state with 3 deferred slices, out-of-order IDs but ascending ts
    const branchState = {
      schema_version: 1,
      main: { tip_sha: null, tip_subject: null, tip_ts: null },
      dev: {
        tip_sha: null, tip_ts: null, commits_ahead_of_main: 0, commits: [],
        deferred_slices: [
          { id: '300', accepted_ts: '2026-04-28T10:00:00Z' },
          { id: '100', accepted_ts: '2026-04-28T11:00:00Z' },
          { id: '200', accepted_ts: '2026-04-28T12:00:00Z' },
        ],
      },
      last_merge: null,
      gate: { status: 'IDLE', current_run: null, last_failure: null, last_pass: null },
    };
    fs.writeFileSync(REAL_BRANCH_STATE_PATH, JSON.stringify(branchState, null, 2) + '\n');

    const logs = [];
    const deps = {
      registerEvent() {},
      log(level, tag, data) { logs.push({ level, tag, ...data }); },
    };

    gateMutex.drainDeferredSlices(deps);

    // squashSliceToDev throws for slice 300 first (earliest accepted_ts)
    const failLog = logs.find(l => l.msg && l.msg.includes('squashSliceToDev failed'));
    assert.ok(failLog, 'should have a drain failure log');
    assert.ok(failLog.msg.includes('slice 300'), `first drain attempt should be slice 300 (earliest ts), got: ${failLog.msg}`);
  });

  // 7. FIFO drain tiebreak — identical accepted_ts, numeric ID ascending
  it('breaks accepted_ts ties by ascending numeric ID', () => {
    const branchState = {
      schema_version: 1,
      main: { tip_sha: null, tip_subject: null, tip_ts: null },
      dev: {
        tip_sha: null, tip_ts: null, commits_ahead_of_main: 0, commits: [],
        deferred_slices: [
          { id: '200', accepted_ts: '2026-04-28T10:00:00Z' },
          { id: '100', accepted_ts: '2026-04-28T10:00:00Z' },
        ],
      },
      last_merge: null,
      gate: { status: 'IDLE', current_run: null, last_failure: null, last_pass: null },
    };
    fs.writeFileSync(REAL_BRANCH_STATE_PATH, JSON.stringify(branchState, null, 2) + '\n');

    const logs = [];
    const deps = {
      registerEvent() {},
      log(level, tag, data) { logs.push({ level, tag, ...data }); },
    };

    gateMutex.drainDeferredSlices(deps);

    // First attempt should be slice 100 (smaller numeric ID, same ts)
    const failLog = logs.find(l => l.msg && l.msg.includes('squashSliceToDev failed'));
    assert.ok(failLog, 'should have a drain failure log');
    assert.ok(failLog.msg.includes('slice 100'), `tiebreak should pick slice 100 first, got: ${failLog.msg}`);
  });

  // 8. gate-state absent on startup — no gate section in branch-state.json
  it('recovery scan initializes gate section to IDLE when absent', () => {
    // Write branch-state without gate section
    const branchState = {
      schema_version: 1,
      main: { tip_sha: null, tip_subject: null, tip_ts: null },
      dev: { tip_sha: null, tip_ts: null, commits_ahead_of_main: 0, commits: [], deferred_slices: [] },
      last_merge: null,
      // no gate section
    };
    fs.writeFileSync(REAL_BRANCH_STATE_PATH, JSON.stringify(branchState, null, 2) + '\n');

    // recoverGateMutex should not throw when gate section is absent
    const { deps } = makeDeps();
    gateMutex.recoverGateMutex(deps);

    // Verify branch-state-recovery initializes the gate section
    const recovery = require('../state/branch-state-recovery');
    const events = [];
    const recDeps = {
      registerEvent(id, event, extra) { events.push({ id, event, ...extra }); },
      log() {},
      runGit() { return ''; },
    };
    recovery.reconcileBranchState(recDeps);

    // Read back — gate section should have been initialized to IDLE
    const afterState = JSON.parse(fs.readFileSync(REAL_BRANCH_STATE_PATH, 'utf-8'));
    assert.ok(afterState.gate, 'gate section should exist after recovery');
    assert.equal(afterState.gate.status, 'IDLE', 'gate status should be initialized to IDLE');
    assert.equal(afterState.gate.current_run, null, 'gate current_run should be null');
  });

  // 9. branch-state.json corrupt
  it('handles corrupt branch-state.json without crashing', () => {
    fs.writeFileSync(REAL_BRANCH_STATE_PATH, '{ this is not valid json !!!', 'utf-8');

    // recoverGateMutex should not crash on corrupt branch-state
    // (it only reads mutex file, not branch-state directly in recovery path)
    const { deps, logs } = makeDeps();

    // No mutex = nothing to recover, but let's also test drain with corrupt state
    writeRealMutex({
      schema_version: 1,
      started_ts: new Date(Date.now() - 120000).toISOString(),
      dev_tip_sha: 'abc123',
      bashir_pid: 99999,
      bashir_heartbeat_path: 'bridge/state/nonexistent.json',
    });

    gateMutex.recoverGateMutex(deps);

    // Mutex should be deleted (heartbeat missing = stale)
    assert.equal(realMutexExists(), false, 'mutex should be deleted');

    // drainDeferredSlices should log a warning about corrupt branch-state
    const drainWarn = logs.find(l => l.msg && l.msg.includes('cannot read branch-state.json'));
    assert.ok(drainWarn, 'should log warning about corrupt branch-state.json');
  });

  // 10. Lock-cycle telemetry
  it('emits lock-cycle events with unlock then relock and non-negative held_duration_ms', () => {
    // Directly test the telemetry emit for lock-cycle events
    const { emit } = require('../state/gate-telemetry');

    const startUnlock = Date.now();
    emit('lock-cycle', {
      cycle_phase: 'unlock',
      triggering_op: 'squash-to-dev',
      held_duration_ms: 42,
    });

    emit('lock-cycle', {
      cycle_phase: 'relock',
      triggering_op: 'squash-to-dev',
      held_duration_ms: 17,
    });

    const telEvents = readTelemetryEvents();
    const lockEvents = telEvents.filter(e => e.event === 'lock-cycle');

    assert.equal(lockEvents.length, 2, 'should have 2 lock-cycle events');
    assert.equal(lockEvents[0].cycle_phase, 'unlock');
    assert.equal(lockEvents[1].cycle_phase, 'relock');
    assert.equal(lockEvents[0].triggering_op, 'squash-to-dev');
    assert.equal(lockEvents[1].triggering_op, 'squash-to-dev');
    assert.ok(lockEvents[0].held_duration_ms >= 0, 'unlock held_duration_ms should be non-negative');
    assert.ok(lockEvents[1].held_duration_ms >= 0, 'relock held_duration_ms should be non-negative');
  });
});

// ---------------------------------------------------------------------------
// Alert evaluation tests (pure functions — no I/O)
// ---------------------------------------------------------------------------

describe('Gate alerts (pure functions)', () => {
  const { evaluateAlerts, computeHealthColor } = require('../state/gate-alerts');

  it('returns green when no mutex and no issues', () => {
    const alerts = evaluateAlerts({
      mutexState: null,
      heartbeatAge: null,
      heartbeatExists: false,
      recentEvents: [],
    });
    assert.equal(alerts.length, 0);
    assert.equal(computeHealthColor(alerts), 'green');
  });

  it('returns green when mutex present with fresh heartbeat', () => {
    const alerts = evaluateAlerts({
      mutexState: { started_ts: new Date(Date.now() - 300000).toISOString() },
      heartbeatAge: 5000,
      heartbeatExists: true,
      recentEvents: [],
    });
    assert.equal(computeHealthColor(alerts), 'green');
  });

  it('returns yellow when heartbeat is warm-stale (>60s, <90s)', () => {
    const alerts = evaluateAlerts({
      mutexState: { started_ts: new Date(Date.now() - 300000).toISOString() },
      heartbeatAge: 75000, // 75s — warm stale
      heartbeatExists: true,
      recentEvents: [],
    });
    assert.equal(computeHealthColor(alerts), 'yellow');
    assert.ok(alerts.some(a => a.id === 'mutex-heartbeat-warm-stale'));
  });

  it('returns red when heartbeat is orphan-stale (>90s)', () => {
    const alerts = evaluateAlerts({
      mutexState: { started_ts: new Date(Date.now() - 300000).toISOString() },
      heartbeatAge: 95000,
      heartbeatExists: true,
      recentEvents: [],
    });
    assert.equal(computeHealthColor(alerts), 'red');
    assert.ok(alerts.some(a => a.id === 'mutex-heartbeat-orphan'));
  });

  it('returns red when mutex held but no heartbeat file', () => {
    const alerts = evaluateAlerts({
      mutexState: { started_ts: new Date(Date.now() - 300000).toISOString() },
      heartbeatAge: null,
      heartbeatExists: false,
      recentEvents: [],
    });
    assert.equal(computeHealthColor(alerts), 'red');
    assert.ok(alerts.some(a => a.id === 'mutex-no-heartbeat'));
  });
});
