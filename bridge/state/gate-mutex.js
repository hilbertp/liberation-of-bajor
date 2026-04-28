'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./atomic-write');
const { emit } = require('./gate-telemetry');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MUTEX_PATH = path.resolve(__dirname, 'gate-running.json');
const BRANCH_STATE_PATH = path.resolve(__dirname, 'branch-state.json');

// 3x the 30s heartbeat interval, per ADR Amendment 1 §4.
const HEARTBEAT_ORPHAN_THRESHOLD_MS = 90000;

// ---------------------------------------------------------------------------
// Stub — replaced by O'Brien's slice 4 with real squash-to-dev logic.
// ---------------------------------------------------------------------------

function squashSliceToDev(sliceId) {
  throw new Error(`squashSliceToDev not yet implemented (sliceId=${sliceId})`);
}

// ---------------------------------------------------------------------------
// Core mutex operations
// ---------------------------------------------------------------------------

/**
 * acquireGateMutex(devTipSha, bashirPid, heartbeatPath, { registerEvent, log })
 *
 * Creates gate-running.json via writeJsonAtomic.
 * If the file already exists, returns { ok: false, reason: "already_held" }.
 */
function acquireGateMutex(devTipSha, bashirPid, heartbeatPath, { registerEvent, log }) {
  if (fs.existsSync(MUTEX_PATH)) {
    log('warn', 'gate_mutex', { msg: 'acquireGateMutex called but mutex already held' });
    return { ok: false, reason: 'already_held' };
  }

  const payload = {
    schema_version: 1,
    started_ts: new Date().toISOString(),
    dev_tip_sha: devTipSha,
    bashir_pid: bashirPid,
    bashir_heartbeat_path: heartbeatPath,
  };

  writeJsonAtomic(MUTEX_PATH, payload);
  emit('gate-mutex-acquired', {
    dev_tip_sha: devTipSha,
    bashir_pid: bashirPid,
    bashir_heartbeat_path: heartbeatPath,
    started_ts: payload.started_ts,
  });
  registerEvent('0', 'GATE_MUTEX_ACQUIRED', { dev_tip_sha: devTipSha, bashir_pid: bashirPid });
  return { ok: true };
}

/**
 * releaseGateMutex(reason, { registerEvent, log })
 *
 * Deletes the mutex file and emits GATE_MUTEX_RELEASED.
 * reason ∈ { regression_pass, regression_fail, gate_abort }
 * Triggers drainDeferredSlices() after release.
 */
function releaseGateMutex(reason, { registerEvent, log }) {
  let heldDurationMs = null;
  try {
    const mutex = JSON.parse(fs.readFileSync(MUTEX_PATH, 'utf-8'));
    if (mutex.started_ts) {
      heldDurationMs = Date.now() - new Date(mutex.started_ts).getTime();
    }
  } catch (_) { /* mutex already gone or unreadable — best effort */ }

  try {
    fs.unlinkSync(MUTEX_PATH);
  } catch (err) {
    log('warn', 'gate_mutex', { msg: 'releaseGateMutex: mutex file already absent', error: err.message });
  }
  emit('gate-mutex-released', { reason, held_duration_ms: heldDurationMs });
  registerEvent('0', 'GATE_MUTEX_RELEASED', { reason });
  drainDeferredSlices({ registerEvent, log });
}

/**
 * drainDeferredSlices({ registerEvent, log })
 *
 * Reads branch-state.json.dev.deferred_slices, sorts FIFO by accepted_ts
 * (tiebreak: numeric slice ID), and invokes squashSliceToDev for each.
 * Removes each entry from deferred_slices on success.
 */
function drainDeferredSlices({ registerEvent, log }) {
  let state;
  try {
    const raw = fs.readFileSync(BRANCH_STATE_PATH, 'utf-8');
    state = JSON.parse(raw);
  } catch (err) {
    log('warn', 'gate_mutex', { msg: 'drainDeferredSlices: cannot read branch-state.json', error: err.message });
    return;
  }

  const deferred = (state.dev && state.dev.deferred_slices) || [];
  if (deferred.length === 0) return;

  // Sort FIFO by accepted_ts, tiebreak by numeric slice ID (smaller first)
  const sorted = deferred.slice().sort((a, b) => {
    const tsA = a.accepted_ts || '';
    const tsB = b.accepted_ts || '';
    if (tsA < tsB) return -1;
    if (tsA > tsB) return 1;
    return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
  });

  for (const entry of sorted) {
    try {
      squashSliceToDev(entry.id);
      // Remove this entry from deferred_slices on success
      state.dev.deferred_slices = state.dev.deferred_slices.filter(e => e.id !== entry.id);
      writeJsonAtomic(BRANCH_STATE_PATH, state);
    } catch (err) {
      log('warn', 'gate_mutex', {
        msg: `drainDeferredSlices: squashSliceToDev failed for slice ${entry.id}`,
        error: err.message,
      });
      break;
    }
  }
}

/**
 * shouldDeferSquash()
 *
 * Returns true if gate-running.json exists (gate is active).
 */
function shouldDeferSquash() {
  return fs.existsSync(MUTEX_PATH);
}

// ---------------------------------------------------------------------------
// Heartbeat-primary recovery — called during orchestrator startup
// ---------------------------------------------------------------------------

/**
 * recoverGateMutex({ registerEvent, log })
 *
 * Run after reconcileBranchState(). If gate-running.json exists, check
 * Bashir's heartbeat freshness:
 *   - Fresh (within HEARTBEAT_ORPHAN_THRESHOLD_MS): resume, leave mutex.
 *   - Stale or missing: emit GATE_ABORTED, delete mutex, drain deferred.
 * PID is diagnostic only — heartbeat is canonical per ADR amendment.
 */
function recoverGateMutex({ registerEvent, log }) {
  if (!fs.existsSync(MUTEX_PATH)) return;

  let mutex;
  try {
    mutex = JSON.parse(fs.readFileSync(MUTEX_PATH, 'utf-8'));
  } catch (err) {
    log('warn', 'gate_mutex', { msg: 'recoverGateMutex: corrupt mutex file, treating as orphan', error: err.message });
    _abortOrphan('process-gone', { registerEvent, log });
    return;
  }

  const heartbeatPath = mutex.bashir_heartbeat_path;
  let heartbeatFresh = false;
  let heartbeatReadable = false;

  try {
    const hb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', heartbeatPath), 'utf-8'));
    heartbeatReadable = true;
    const age = Date.now() - new Date(hb.ts).getTime();
    heartbeatFresh = age < HEARTBEAT_ORPHAN_THRESHOLD_MS;
  } catch (_) {
    // Missing or unreadable heartbeat file → stale
    heartbeatFresh = false;
    heartbeatReadable = false;
  }

  if (heartbeatFresh) {
    log('info', 'gate_mutex', { msg: 'gate is in flight, resuming wait' });
    return;
  }

  const signal = heartbeatReadable ? 'heartbeat-stale' : 'process-gone';
  _abortOrphan(signal, { registerEvent, log });
}

function _abortOrphan(recoverySignal, { registerEvent, log }) {
  let heldDurationMs = null;
  let lastHeartbeatAgeMs = null;
  try {
    const mutex = JSON.parse(fs.readFileSync(MUTEX_PATH, 'utf-8'));
    if (mutex.started_ts) {
      heldDurationMs = Date.now() - new Date(mutex.started_ts).getTime();
    }
    if (mutex.bashir_heartbeat_path) {
      try {
        const hb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', mutex.bashir_heartbeat_path), 'utf-8'));
        if (hb.ts) lastHeartbeatAgeMs = Date.now() - new Date(hb.ts).getTime();
      } catch (_) { /* heartbeat missing or unreadable */ }
    }
  } catch (_) { /* mutex unreadable */ }

  emit('gate-mutex-orphan-recovered', {
    recovery_signal: recoverySignal,
    held_duration_ms: heldDurationMs,
    last_heartbeat_age_ms: lastHeartbeatAgeMs,
  });
  registerEvent('0', 'GATE_ABORTED', {
    reason: 'orchestrator_restart_during_gate',
    source: recoverySignal,
  });
  log('warn', 'gate_mutex', { msg: 'orphan gate detected, aborting and draining' });
  try {
    fs.unlinkSync(MUTEX_PATH);
  } catch (_) { /* already gone */ }
  drainDeferredSlices({ registerEvent, log });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  acquireGateMutex,
  releaseGateMutex,
  drainDeferredSlices,
  shouldDeferSquash,
  recoverGateMutex,
  // Exposed for testing
  MUTEX_PATH,
  BRANCH_STATE_PATH,
  HEARTBEAT_ORPHAN_THRESHOLD_MS,
};
