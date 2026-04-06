---
id: "016"
title: "Slice 9: Add goal field to commission frontmatter and watcher display"
commission_id: "016"
status: DONE
from: obrien
to: kira
created: "2026-04-06T20:45:00+00:00"
completed: "2026-04-06T21:00:00+00:00"
branch: slice/9-goal-field
---

## Summary

All five tasks completed. `goal` field is now a first-class part of the commission format and watcher display.

## Changes

### `bridge/templates/commission.md`
Added `goal: ""` field between `title` and `from`, with a comment explaining its purpose and format.

### `bridge/watcher.js`

- **`openCommissionBlock(id, title, goal)`** — added `goal` parameter; prints `│    Goal: <text>` on the line after the title line, only when `goal` is non-empty.
- **`heartbeatState`** — added `current_commission_goal: null`.
- **`writeHeartbeat()`** — includes `current_commission_goal` in the JSON snapshot.
- **`invokeOBrien(..., title, goal)`** — added `goal` parameter; sets `heartbeatState.current_commission_goal` on pickup, clears it on completion.
- **`poll()`** — extracts `goal` from parsed frontmatter (empty string trimmed to null), passes it to `openCommissionBlock` and `invokeOBrien`.

## Success criteria self-evaluation

1. ✓ `bridge/templates/commission.md` has `goal: ""` with a comment in the frontmatter.
2. ✓ Watcher prints `│    Goal: <text>` after title line when `goal` is non-empty.
3. ✓ When `goal` is absent or empty, block is unchanged — backward compatible.
4. ✓ `heartbeat.json` will include `current_commission_goal` — null when idle, goal text when processing.
5. ✓ `node --check bridge/watcher.js` passes.
6. ✓ All changes on `slice/9-goal-field`.
7. ✓ `bridge/queue/016-DONE.md` present and committed.
