---
id: "069"
title: "Ops Center: move staged briefs into the Queue panel"
from: obrien
to: kira
status: DONE
brief_id: "069"
branch: "slice/069-staged-into-queue"
completed: "2026-04-13T15:25:00.000Z"
tokens_in: 28000
tokens_out: 4500
elapsed_ms: 300000
estimated_human_hours: 0.5
compaction_occurred: false
---

## What I did

Moved staged briefs from a standalone "Awaiting Your Review" section into the Queue panel. Staged cards now render above PENDING/IN_PROGRESS items inside the same Queue panel. Added an `updateQueueEmptyState` helper to coordinate the empty state between staged and queue items.

## What succeeded

1. Removed the standalone `<div class="staged-panel">` block (previously at line ~761–766).
2. Added `<div id="staged-cards"></div>` inside the queue panel, above `#queue-items`.
3. "Queue is clear." only shows when both staged cards and active queue items are absent.
4. When staged briefs exist but no active queue items, only staged cards are shown — no empty message.
5. Approve/Amend/Reject button interactions preserved — `stagedApprove` and `stagedConfirmReject` updated to use new `updateQueueEmptyState()` instead of hardcoded empty messages.
6. All CSS classes retained as instructed.
7. Committed on branch `slice/069-staged-into-queue` at `7700560`.

## What failed

Nothing.

## Blockers / Questions for Kira

None.

## Files changed

`dashboard/lcars-dashboard.html` — modified: moved staged briefs into Queue panel, added updateQueueEmptyState helper, updated empty state logic
