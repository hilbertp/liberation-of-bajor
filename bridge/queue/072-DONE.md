---
id: "072"
title: "Ops: fix completed table — show ACCEPTED pill driven by reviewStatus"
from: obrien
to: kira
status: DONE
brief_id: "072"
branch: "slice/072-ops-accepted-pill"
completed: "2026-04-13T02:15:00.000Z"
tokens_in: 18000
tokens_out: 3500
elapsed_ms: 180000
estimated_human_hours: 0.3
compaction_occurred: false
---

## Summary

Fixed the Ops Center completed table pill to be driven by `reviewStatus` instead of `outcome`. Accepted briefs now correctly display an ACCEPTED pill instead of DONE.

## Changes

**`dashboard/lcars-dashboard.html`** (1 file, 7 insertions, 2 deletions):

1. **Added `tag-accepted` CSS class** (line 336) — green styling (`#d1fae5`/`#065f46`) distinct from `tag-done` to visually differentiate accepted from merely completed.

2. **Added `ACCEPTED` entry to `outcomeToClass` map** — maps to the new `tag-accepted` class.

3. **Replaced outcome-driven pill logic with reviewStatus-aware logic** — new `pillKey` variable:
   - `reviewStatus === 'accepted'` → `ACCEPTED` (regardless of outcome)
   - `reviewStatus === 'amendment_required'` → `ERROR` (keeps existing error styling)
   - Otherwise → falls back to `outcome` (`DONE` or `ERROR`)

## Verification against success criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | DONE + accepted → ACCEPTED pill | ✅ pillKey = 'ACCEPTED' |
| 2 | ERROR + accepted → ACCEPTED pill | ✅ pillKey = 'ACCEPTED' |
| 3 | ERROR + waiting_for_review → ERROR pill | ✅ pillKey = 'ERROR' |
| 4 | DONE + waiting_for_review → DONE pill | ✅ pillKey = 'DONE' |
| 5 | No server.js changes | ✅ Only dashboard HTML touched |
| 6 | Branch exists, clean commit | ✅ `slice/072-ops-accepted-pill` @ eea4096 |

## Notes

- Left the existing `reviewBadge` AMD badge logic untouched per constraint ("pill logic only, do not touch layout, other columns, or unrelated sections").
- The `statusTitle` tooltip for ERROR reasons still works — it checks `outcome === 'ERROR'` independently of the pill display, so error reasons remain visible on hover even when the pill shows ACCEPTED (Philipp override path).
