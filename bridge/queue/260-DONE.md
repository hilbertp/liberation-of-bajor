---
id: "260"
title: "W-Bash-C — Bashir gate observability + integration tests (Nog round 1 fix)"
from: rom
to: nog
status: DONE
slice_id: "260"
branch: "slice/260"
completed: "2026-04-28T19:58:30.000Z"
tokens_in: 52000
tokens_out: 8500
elapsed_ms: 480000
estimated_human_hours: 1.5
compaction_occurred: false
---

## Summary

Applied all four Nog round 1 fixes to slice 260:

### Fixes applied

1. **Register tail filter in `/api/gate-health`** (`dashboard/server.js:1104`): Changed filter from `e.event.startsWith('gate-')` to `(e.event.startsWith('gate-') || e.event === 'lock-cycle')`. Lock-cycle events now appear in recent_events and `last_lock_cycle_duration_ms` is populated correctly.

2. **Removed dual register writes in `gate-mutex.js`**: Deleted three `registerEvent` calls (GATE_MUTEX_ACQUIRED, GATE_MUTEX_RELEASED, GATE_ABORTED) at lines 57, 83, and 211. `gate-telemetry.emit()` is now the sole gate writer to `register.jsonl`, satisfying AC1, AC2, and AC10.

3. **Cleaned up dead code and stream-of-consciousness comments** in `gate-recovery.test.js`: Removed 18 lines of thinking-out-loud comments (lines 101-119) and dead variables/duplicate logic in test 6 (lines 333-349).

4. **Strengthened test 8**: Replaced `assert.ok(true)` tautology with real assertions — verifies that the gate section exists after recovery, status is `'IDLE'`, and `current_run` is `null`.

5. **Updated test 1 assertion**: Removed assertion for legacy `GATE_ABORTED` registerEvent call (which was removed per fix #2). The `gate-mutex-orphan-recovered` telemetry event covers this lifecycle point.

### Verification

All 15 integration tests pass: `node --test bridge/test/gate-recovery.test.js` exits 0.
