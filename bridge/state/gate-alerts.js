'use strict';

/**
 * gate-alerts.js — Pure functions evaluating register tail and gate state,
 * returning structured alerts.
 *
 * No side effects, no I/O beyond what is passed in as arguments.
 * Called by dashboard /api/gate-health and state-doctor --gate-health.
 *
 * Slice 260 (W-Bash-C).
 */

// ---------------------------------------------------------------------------
// Tunable thresholds (constants at top of file per brief)
// ---------------------------------------------------------------------------

const LOCK_HELD_WARN_MS   = 5000;   // single lock cycle held > 5s
const LOCK_HELD_CRIT_MS   = 30000;  // single lock cycle held > 30s (almost certainly stuck)
const MUTEX_HELD_WARN_MIN = 15;     // gate mutex held > 15min
const MUTEX_HELD_CRIT_MIN = 60;     // gate mutex held > 60min (almost certainly orphaned)
const HEARTBEAT_STALE_MS  = 60000;  // heartbeat older than 60s but younger than orphan threshold

// ---------------------------------------------------------------------------
// Alert evaluation
// ---------------------------------------------------------------------------

/**
 * evaluateAlerts({ mutexState, heartbeatAge, recentEvents })
 *
 * Pure function. Takes pre-read state, returns array of structured alerts.
 *
 * @param {object} opts
 * @param {object|null} opts.mutexState - Parsed gate-running.json or null if absent
 * @param {number|null} opts.heartbeatAge - Age of Bashir heartbeat in ms, or null if absent
 * @param {boolean}     opts.heartbeatExists - Whether heartbeat file exists at all
 * @param {Array}       opts.recentEvents - Last N gate events from register
 * @returns {Array<{id: string, level: string, message: string}>}
 */
function evaluateAlerts({ mutexState, heartbeatAge, heartbeatExists, recentEvents }) {
  const alerts = [];
  const ORPHAN_THRESHOLD_MS = 90000;

  // --- Mutex-related alerts ---
  if (mutexState) {
    const mutexAgeMs = mutexState.started_ts
      ? Date.now() - new Date(mutexState.started_ts).getTime()
      : null;

    // Heartbeat missing while mutex held
    if (!heartbeatExists) {
      alerts.push({
        id: 'mutex-no-heartbeat',
        level: 'red',
        message: 'Gate mutex held but no Bashir heartbeat file. Likely orphaned.',
      });
    }
    // Heartbeat exists but orphan-stale (> 90s)
    else if (heartbeatAge != null && heartbeatAge > ORPHAN_THRESHOLD_MS) {
      alerts.push({
        id: 'mutex-heartbeat-orphan',
        level: 'red',
        message: `Gate mutex held but heartbeat is ${Math.round(heartbeatAge / 1000)}s old (orphan threshold: ${ORPHAN_THRESHOLD_MS / 1000}s). Recovery should fire.`,
      });
    }
    // Heartbeat exists but warm-stale (> 60s, < orphan threshold)
    else if (heartbeatAge != null && heartbeatAge > HEARTBEAT_STALE_MS) {
      alerts.push({
        id: 'mutex-heartbeat-warm-stale',
        level: 'yellow',
        message: `Gate mutex held, heartbeat is ${Math.round(heartbeatAge / 1000)}s old. Bashir may be slow.`,
      });
    }

    // Mutex held too long
    if (mutexAgeMs != null) {
      const mutexHeldMin = mutexAgeMs / 60000;
      if (mutexHeldMin > MUTEX_HELD_CRIT_MIN) {
        alerts.push({
          id: 'mutex-held-critical',
          level: 'red',
          message: `Gate mutex held for ${Math.round(mutexHeldMin)}min (critical threshold: ${MUTEX_HELD_CRIT_MIN}min).`,
        });
      } else if (mutexHeldMin > MUTEX_HELD_WARN_MIN) {
        alerts.push({
          id: 'mutex-held-warning',
          level: 'yellow',
          message: `Gate mutex held for ${Math.round(mutexHeldMin)}min (warning threshold: ${MUTEX_HELD_WARN_MIN}min).`,
        });
      }
    }
  }

  // --- Lock-cycle alerts (check recent events for slow lock cycles) ---
  const lockCycleEvents = (recentEvents || []).filter(e => e.event === 'lock-cycle');
  for (const evt of lockCycleEvents) {
    if (evt.held_duration_ms != null) {
      if (evt.held_duration_ms > LOCK_HELD_CRIT_MS) {
        alerts.push({
          id: 'lock-cycle-critical',
          level: 'red',
          message: `Lock cycle (${evt.cycle_phase || '?'}) held for ${evt.held_duration_ms}ms (critical: ${LOCK_HELD_CRIT_MS}ms). Phase: ${evt.triggering_op || '?'}.`,
        });
      } else if (evt.held_duration_ms > LOCK_HELD_WARN_MS) {
        alerts.push({
          id: 'lock-cycle-warning',
          level: 'yellow',
          message: `Lock cycle (${evt.cycle_phase || '?'}) held for ${evt.held_duration_ms}ms (warning: ${LOCK_HELD_WARN_MS}ms). Phase: ${evt.triggering_op || '?'}.`,
        });
      }
    }
  }

  return alerts;
}

/**
 * computeHealthColor(alerts)
 *
 * Returns 'green', 'yellow', or 'red' based on the highest-severity alert.
 */
function computeHealthColor(alerts) {
  if (alerts.some(a => a.level === 'red')) return 'red';
  if (alerts.some(a => a.level === 'yellow')) return 'yellow';
  return 'green';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  evaluateAlerts,
  computeHealthColor,
  // Expose thresholds for testing / documentation
  LOCK_HELD_WARN_MS,
  LOCK_HELD_CRIT_MS,
  MUTEX_HELD_WARN_MIN,
  MUTEX_HELD_CRIT_MIN,
  HEARTBEAT_STALE_MS,
};
