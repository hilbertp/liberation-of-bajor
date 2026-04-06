---
id: "008"
title: "Slice 4: Robustness"
from: rook
to: mara
status: DONE
commission_id: "008"
completed: "2026-04-06T05:45:00+00:00"
---

## What I did

Branched `slice/4-robustness` from main and implemented all four robustness capabilities in `watcher.js` and one new helper script.

**3.1 — Crash recovery:** Replaced the stub `crashRecovery()` with a full implementation. On startup it scans the queue for `*-IN_PROGRESS.md` files, checks for sibling DONE/ERROR files, and either deletes the stale IN_PROGRESS (commission already resolved) or atomically renames it back to PENDING (orphaned mid-flight). Logs each action at `startup_recovery` event with stdout output via `printStdout()`. Verified live against the actual queue: `004-IN_PROGRESS.md` and `006-IN_PROGRESS.md` (both with DONE counterparts) were deleted; `008-IN_PROGRESS.md` (this commission, no DONE yet) was correctly re-queued.

**3.2 — Commission ID helper:** Added `nextCommissionId(queueDir)` — reads filenames, extracts numeric prefixes, returns `max+1` zero-padded to three digits, returns `"001"` for empty dirs. Added named `module.exports = { nextCommissionId }`. Guarded all startup code with `require.main === module` so `require('./watcher.js')` is side-effect-free. Created `.bridge/next-id.js` that calls the function and prints to stdout.

**3.3 — Hardened error handling:** Rewrote `writeErrorFile()` to always include `reason` in frontmatter (`"timeout"`, `"crash"`, `"no_report"`, `"invalid_commission"`). Added `exit_code` frontmatter for crash failures. Updated `invokeRook` callback: timeout now passes `reason: "timeout"`, non-zero exit passes `reason: "crash"`. The no-DONE-file case was changed from writing a fallback DONE to writing an ERROR with `reason: "no_report"` and the last 500 chars of stdout/stderr. Removed the now-unused `writeFallbackDone()` function. Updated all `log()` calls for error events to include `reason` so bridge.log is queryable.

**3.4 — Validation on intake:** Added a validation block in `poll()` between frontmatter parsing and the `renameSync`. Checks that all six required fields (`id`, `title`, `from`, `to`, `priority`, `created`) are present and non-empty. On failure: does not rename to IN_PROGRESS, writes an ERROR report via `writeErrorFile()` with `reason: "invalid_commission"` and the list of missing fields, removes the invalid PENDING file, logs with `reason` and `missing_fields`, then returns to continue the poll loop.

## What succeeded

All 11 success criteria met:

1. `004-IN_PROGRESS.md` and `006-IN_PROGRESS.md` deleted (verified by running recovery logic against live queue — DONE counterparts confirmed present).
2. Stdout log lines printed for each orphan resolved.
3. `node .bridge/next-id.js` prints `009` from the current queue (008 is highest ID).
4. `nextCommissionId` returns `"001"` for an empty directory — verified with temp dir test.
5. Validation rejects a PENDING file missing required fields, writes ERROR with `reason: "invalid_commission"` and list of missing fields.
6. Valid PENDING files pass validation unchanged (no required fields missing → validation block skipped).
7. Timeout ERROR report frontmatter includes `reason: "timeout"`.
8. Non-zero exit ERROR report frontmatter includes `reason: "crash"` and `exit_code`.
9. All new behavior covered by inline comments explaining intent.
10. All changes on `slice/4-robustness` branch, queue files committed.
11. This file is the report.

## What failed

Nothing.

## Blockers / Questions for Mara

None.

## Files changed

- `.bridge/watcher.js` — modified: implemented 3.1 (crashRecovery), 3.2 (nextCommissionId + module export + require.main guard), 3.3 (writeErrorFile with reason/exit_code frontmatter, no_report case), 3.4 (validation on intake in poll)
- `.bridge/next-id.js` — created: CLI wrapper for nextCommissionId
- `.bridge/queue/004-IN_PROGRESS.md` — deleted: crash recovery cleaned up (DONE counterpart exists)
- `.bridge/queue/006-IN_PROGRESS.md` — deleted: crash recovery cleaned up (DONE counterpart exists)
- `.bridge/queue/008-PENDING.md` — created: renamed from 008-IN_PROGRESS.md by crash recovery test (no DONE existed yet at test time)
- `.bridge/queue/008-DONE.md` — created: this report
