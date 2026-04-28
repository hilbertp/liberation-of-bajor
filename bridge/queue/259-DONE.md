---
id: "259"
title: "F-W-Bash-B — gate-running.json mutex lifecycle with heartbeat-primary liveness"
from: rom
to: nog
status: DONE
slice_id: "259"
branch: "slice/259"
completed: "2026-04-28T19:25:00.000Z"
tokens_in: 38000
tokens_out: 8500
elapsed_ms: 420000
estimated_human_hours: 2.5
compaction_occurred: false
---

## Summary

Implemented the Bashir-gate concurrency mutex (`bridge/state/gate-running.json`) with full lifecycle: acquire, release, drain, defer-check, and heartbeat-primary recovery on orchestrator restart.

## Deliverables

### `bridge/state/gate-mutex.js` (196 LOC)

Exports:

| Function | Purpose |
|---|---|
| `acquireGateMutex(devTipSha, bashirPid, heartbeatPath, deps)` | Creates mutex via `writeJsonAtomic`. Returns `{ ok: false, reason: "already_held" }` if file exists. Emits `GATE_MUTEX_ACQUIRED`. |
| `releaseGateMutex(reason, deps)` | Deletes mutex file, emits `GATE_MUTEX_RELEASED`, triggers `drainDeferredSlices()`. |
| `drainDeferredSlices(deps)` | Walks `branch-state.json.dev.deferred_slices` in FIFO order (by `accepted_ts`, tiebreak: numeric slice ID). Calls `squashSliceToDev(sliceId)` stub for each. Removes entries on success. |
| `shouldDeferSquash()` | Returns `true` iff `gate-running.json` exists. |
| `recoverGateMutex(deps)` | Startup recovery: checks heartbeat freshness. Fresh (< 90s) = resume. Stale/missing = emit `GATE_ABORTED`, delete mutex, drain. |

### `bridge/orchestrator.js` (+2 LOC)

- Added `require('./state/gate-mutex')` import.
- Wired `recoverGateMutex({ registerEvent, log })` into startup sequence immediately after `reconcileBranchState()`.

### `test/state-gate-mutex.test.js` (9 scenarios, all passing)

1. Acquire happy path — file appears, event fires.
2. Acquire while held — `already_held`, no overwrite.
3. Release happy path — file deleted, event fires, drain runs.
4. Drain FIFO ordering — earlier `accepted_ts` drains first.
5. Drain tiebreak — same timestamp, smaller slice ID first.
6. Recovery happy — fresh heartbeat, resume, mutex untouched.
7. Recovery orphan — stale heartbeat, `GATE_ABORTED`, mutex deleted, drain.
8. Recovery missing-heartbeat — absent file treated as stale.
9. `shouldDeferSquash` — true when mutex exists, false otherwise.

## Acceptance criteria

- [x] AC0 — Skeleton DONE first commit.
- [x] AC1 — Exports `acquireGateMutex`, `releaseGateMutex`, `drainDeferredSlices`, `shouldDeferSquash`.
- [x] AC2 — `acquireGateMutex` writes schema via `writeJsonAtomic`, returns `already_held` if exists.
- [x] AC3 — `releaseGateMutex` deletes file, emits event, triggers drain.
- [x] AC4 — Drain walks FIFO by `accepted_ts` with numeric slice ID tiebreak.
- [x] AC5 — `shouldDeferSquash` checks file existence.
- [x] AC6 — Startup recovery after `reconcileBranchState()`, heartbeat-primary decision.
- [x] AC7 — `HEARTBEAT_ORPHAN_THRESHOLD_MS = 90000` with ADR citation comment.
- [x] AC8 — PID recorded in mutex but not used for recovery decision.
- [x] AC9 — Nine regression tests, all passing.
- [x] AC10 — 198 LOC excluding tests (under 350).
- [x] AC11 — Changes only in `bridge/state/`, `bridge/orchestrator.js`, and test file.

## Design notes

- `squashSliceToDev(sliceId)` is a module-internal stub that throws `"not yet implemented"`. O'Brien's slice 4 replaces the body. Tests verify drain ordering by catching the first throw.
- Heartbeat path is resolved from project root (`__dirname/../../<path>`) since the mutex stores paths relative to project root (e.g. `bridge/state/bashir-heartbeat.json`).
- `fs.unlinkSync` used for mutex deletion per constraints (no atomic-rename for delete).
- Drain breaks on first `squashSliceToDev` failure to avoid out-of-order squashes.
