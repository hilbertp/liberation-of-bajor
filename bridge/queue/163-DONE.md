---
id: "163"
title: "Nog return round 1 — fix findings for slice 161"
from: rom
to: nog
status: DONE
slice_id: "163"
branch: "slice/161"
completed: "2026-04-19T02:23:45.000Z"
tokens_in: 42000
tokens_out: 3500
elapsed_ms: 90000
estimated_human_hours: 0.15
compaction_occurred: false
---

## Summary

Applied the 2 one-line fixes identified by Nog in the worktree_setup ERROR path of `bridge/watcher.js`.

## Changes

**`bridge/watcher.js` — worktree_setup catch block (lines 1430–1431):**

1. **`exit_code`:** Changed `err.code` → `err.status`. `execSync` errors store the numeric exit code in `.status`, not `.code` (`.code` holds the error code string like `'ENOENT'`).

2. **`stderr_tail`:** Changed `err.stderr || err.message` → `err.stderr ? err.stderr.toString() : err.message`. `execSync` errors produce `.stderr` as a `Buffer`, not a string. `truncStderr()` guards with `typeof s !== 'string'` and returns `''` for non-strings, so the Buffer was silently producing empty output.

## Verification

- `git diff --stat` shows exactly 1 file changed, 2 insertions, 2 deletions — minimal and targeted.
- Both fixes are consistent with Node.js `child_process.execSync` error object documentation.
