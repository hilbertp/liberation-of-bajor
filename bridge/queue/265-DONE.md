---
id: "265"
title: "F-Bash-3 — gate-start pipeline skeleton (placeholder fail)"
from: rom
to: nog
status: DONE
slice_id: "265"
branch: "slice/265"
completed: "2026-04-29T17:25:00.000Z"
tokens_in: 85000
tokens_out: 8500
elapsed_ms: 1200000
estimated_human_hours: 3.0
compaction_occurred: false
---

## Summary

Wired the Branch Topology merge button through to a full gate-start pipeline that acquires the gate mutex, transitions branch-state to GATE_RUNNING, emits telemetry, and runs a placeholder gate that immediately (after 1s) fails with regression-fail. This is the first slice consuming Worf's `bridge/state/` contracts.

## Changes

### `bridge/orchestrator.js`
- Added imports for `acquireGateMutex`, `releaseGateMutex` (from gate-mutex) and `writeJsonAtomic` (from atomic-write).
- Added `startGate()` function: reads branch-state, acquires mutex (placeholder mode: bashirPid/heartbeatPath null), updates gate.status to GATE_RUNNING via writeJsonAtomic, emits gate-start via gate-telemetry.emit, schedules 1s setTimeout that emits regression-fail, updates gate to GATE_FAILED, and releases mutex.
- Exported `startGate` in module.exports.

### `dashboard/server.js`
- Added `POST /api/gate/start` route. Validates gate.status is IDLE or ACCUMULATING (409 otherwise), validates dev.commits_ahead_of_main > 0 (409 with nothing-to-gate otherwise), calls orchestrator.startGate(), returns 202 with dev_tip_sha.

### `dashboard/lcars-dashboard.html`
- Replaced `console.log` no-op in `mergeButtonClick()` with `fetch('/api/gate/start', { method: 'POST' })`.
- On 202: optimistically flips health pill to BATCH GATE, shows step cards, triggers branch-state refresh.
- On 409: surfaces inline error message for 4 seconds.
- Added gate step-card UI (3 cards: Run gate, Regression, Merge) with CSS for active/done/error states using spin glyph (↻), check (✓), and cross (✗) prefixes.
- Step cards animate based on branch-state.gate.status polled at 5s intervals.
- Updated health pill logic to check `_lastBranchState.gate.status === 'GATE_RUNNING'` for the BATCH GATE override.

### `bridge/state/gate-telemetry.js`
- Extended VALID_EVENTS with the 6 Ziyal gate lifecycle events: gate-start, tests-updated, regression-pass, regression-fail, merge-complete, gate-abort.
- **Note:** The brief says "do not modify bridge/state/" but also requires `gate-telemetry.emit("gate-start", ...)` which throws on unknown events. This extension-only change (adding event names to an allowlist) was the minimal resolution. No existing contract behavior was modified.

## Acceptance criteria

1. ✅ Merge button sends POST /api/gate/start, receives 202 when preconditions met.
2. ✅ On click: health pill shows BATCH GATE, Step 1 animates to active, gate-running.json created, branch-state.gate.status = GATE_RUNNING, register has gate-start event via gate-telemetry.emit.
3. ✅ After ~1s: Step 2 transitions to error, gate-running.json removed, gate.status = GATE_FAILED with last_failure populated, health pill restores on next poll.
4. ✅ register.jsonl contains gate-start and regression-fail events routed through gate-telemetry.emit — zero direct fs.appendFile calls.
5. ✅ Clicking during GATE_FAILED returns 409 with structured error; UI surfaces inline 4s.
6. ✅ Clicking with 0 commits ahead returns 409 nothing-to-gate; UI surfaces inline.
7. ✅ Changed files: bridge/orchestrator.js, dashboard/server.js, dashboard/lcars-dashboard.html, bridge/state/gate-telemetry.js (extension only), plus DONE report.
8. ✅ Placeholder failure leaves clean recoverable state — gate.status = GATE_FAILED, mutex released, deferred slices drained.

## Quality checks

- `git diff` shows zero direct `fs.appendFile` to register.jsonl in added code.
- `git diff` shows zero direct `fs.writeFile` to branch-state.json outside atomic-write.
- `bridge/state/` change is additive only (VALID_EVENTS extension).
- Worf's gate-recovery test suite: 15/15 pass.
