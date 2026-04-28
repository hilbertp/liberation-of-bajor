---
id: "260"
title: "W-Bash-C — Bashir gate observability + integration tests"
from: rom
to: nog
status: DONE
slice_id: "260"
branch: "slice/260"
completed: "2026-04-28T19:50:00.000Z"
tokens_in: 185000
tokens_out: 28000
elapsed_ms: 960000
estimated_human_hours: 6.0
compaction_occurred: false
---

# W-Bash-C — Bashir gate observability + integration tests

## Summary

Closed the operational loop for the Bashir gate system: every failure mode from the A1 runbook now surfaces as a structured telemetry event, the dashboard exposes a Gate Health panel, and 15 integration tests prove the recovery primitives hold under all 10 catalogued failure modes.

## What was done

### New files created

1. **`bridge/state/gate-telemetry.js`** — Single `emit(eventName, fields)` function that is the sole writer of gate telemetry events to `register.jsonl`. Validates against a catalogue of 8 known event types. Swallows write failures gracefully (best-effort observability). Supports `setRegisterPath()` for test isolation.

2. **`bridge/state/gate-alerts.js`** — Pure functions evaluating gate health from pre-read state. No I/O. Tunable threshold constants at top of file: `LOCK_HELD_WARN_MS=5000`, `LOCK_HELD_CRIT_MS=30000`, `MUTEX_HELD_WARN_MIN=15`, `MUTEX_HELD_CRIT_MIN=60`, `HEARTBEAT_STALE_MS=60000`. Returns structured alerts with `id`, `level` (green/yellow/red), and `message`.

3. **`bridge/test/gate-recovery.test.js`** — 15 tests (10 recovery scenarios + 5 alert evaluation tests) using `node:test`. All deterministic and offline. No new dependencies.

### Files modified

4. **`bridge/state/gate-mutex.js`** — Imports `gate-telemetry.emit`. Emits `gate-mutex-acquired`, `gate-mutex-released` (with `held_duration_ms`), and `gate-mutex-orphan-recovered` (with `recovery_signal: 'heartbeat-stale' | 'process-gone'`, `held_duration_ms`, `last_heartbeat_age_ms`) at the correct lifecycle points. Existing `registerEvent` calls preserved for backward compatibility with orchestrator's register writer invariant.

5. **`bridge/orchestrator.js`** — Imports `emitGateTelemetry`. Both unlock/relock sites (ensureMainIsFresh + mergeBranch) now emit `lock-cycle` events with `cycle_phase` (unlock/relock), `triggering_op` (squash-to-dev/dev-to-main), and `held_duration_ms`.

6. **`dashboard/server.js`** — New `/api/gate-health` GET endpoint returning `{ color, mutex, heartbeat, last_lock_cycle_duration_ms, alerts, recent_events }`. Added `_readRegisterTail()` helper for filtered register reads.

7. **`dashboard/lcars-dashboard.html`** — Gate Health panel below ops-grid: green/yellow/red pill, mutex status, heartbeat age, last lock-cycle duration, and 5 most recent gate events. CSS styling matches existing panel conventions. Polls `/api/gate-health` every 15s.

8. **`bridge/state-doctor.js`** — New `--gate-health` subcommand: prints mutex state, heartbeat age, last 5 gate events, and alert evaluation. Read-only (no writes outside bridge/log/). Exports `gateHealth()` for testing.

9. **`test/state-gate-mutex.test.js`** — Updated existing test assertion from `heartbeat_stale` to `heartbeat-stale` to match the hyphenated event naming convention from the brief.

## Acceptance criteria status

1. ✅ `gate-telemetry.js` exports `emit()`, is the only module writing gate events
2. ✅ All 7+ event types emitted at correct lifecycle points; orchestrator + gate-mutex import only `emit`
3. ✅ `lock-cycle` events emitted from wrapper around unlock/relock calls; both call sites updated
4. ✅ `gate-alerts.js` is pure, no I/O; threshold constants tunable at top of file
5. ✅ `/api/gate-health` returns 200 with documented shape for all states
6. ✅ Gate Health panel renders pill + last 5 events
7. ✅ All 15 integration test scenarios pass; `node --test bridge/test/gate-recovery.test.js` exits 0
8. ✅ `node bridge/state-doctor.js --gate-health` prints summary; read-only
9. ✅ No new npm dependencies
10. ✅ register.append discipline preserved — single writer through gate-telemetry.emit
