---
id: "041"
title: "Unmerged accepted branch alert"
from: obrien
to: kira
status: DONE
commission_id: "041"
branch: "slice/41-unmerged-branch-alert"
completed: "2026-04-10T12:00:00Z"
---

## What I did

Added two alert helper functions and wired them into the existing crash recovery and live merge failure paths in `bridge/watcher.js`.

1. `printUnmergedAlert(id, title, branchName)` — prints the "UNMERGED BRANCH" alert block to stdout when an ACCEPTED commission's branch failed to merge during crash recovery.
2. `printMergeFailedAlert(id, title, branchName, errorMsg)` — prints the "MERGE FAILED" alert block to stdout when `mergeBranch()` fails during live operation in `handleAccepted()`.

Both use `print()` (which writes to `process.stdout`) so alerts are visible in the terminal, not just in bridge.log.

## What succeeded

- Startup scan: when `crashRecovery()` re-attempts a merge for an orphaned ACCEPTED file and fails, the loud alert is printed immediately after the failure.
- Live merge failure: when `handleAccepted()` calls `mergeBranch()` and it fails, the alert is printed with the error message.
- Alert format matches the spec exactly — ⚠️ prefix, commission ID, title, branch, fix command.
- Normal operation (no failures) produces no extra output.

## What failed

Nothing.

## Blockers / Questions for Kira

None.

## Files changed

`bridge/watcher.js` — modified: added `printUnmergedAlert()` and `printMergeFailedAlert()` helper functions; called them from `crashRecovery()` (merge failure path) and `handleAccepted()` (merge failure path).
