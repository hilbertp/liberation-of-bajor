---
id: "194"
title: "F-194 — Ops Queue+History polish: Accepted pill + paginate history at 5"
from: rom
to: nog
status: DONE
slice_id: "194"
branch: "slice/194"
completed: "2026-04-23T10:18:00.000Z"
tokens_in: 18400
tokens_out: 4100
elapsed_ms: 1980000
estimated_human_hours: 0.5
compaction_occurred: false
---

## Summary

Two UX fixes to the Ops dashboard:
1. Approved-but-not-yet-running slices now show a non-interactive `✓ Accepted` pill instead of the clickable `[Accept]` button.
2. History panel now paginates at 5 entries per page (was 10).

## Changes

### `dashboard/lcars-dashboard.html`
- `HISTORY_PAGE_SIZE`: `10` → `5` (line ~3092)
- Queue QUEUED-state action: replaced `<button class="queue-btn-accepted" onclick="queueUnaccept(...)">&#10003; Queued</button>` with `<span class="queue-accepted-pill">&#10003; Accepted</span>`
- Added `.queue-accepted-pill` CSS class: same green fill as the old button (`#16a34a` background/border, `#ffffff` text) but `cursor: default; user-select: none` — no hover affordance, not interactive

### `test/dashboard-render.test.js` (new file)
- Test 1: 1 STAGED + 2 QUEUED rows → asserts exactly 1 `queue-btn-accept` and 2 `queue-accepted-pill`
- Test 2: Edit button visible for STAGED + both QUEUED rows (3 total)
- Test 3: Pill is a `<span>`, not a `<button>`
- Test 4: 12 history rows → page 1=5 rows, page 2=5 rows, page 3=2 rows, totalPages=3
- Test 5: Pagination controls — Prev disabled on page 1, Next disabled on last page, labels correct
- Test 6: `HISTORY_PAGE_SIZE === 5`

## Tests

All tests pass:
```
dashboard-render.test.js: all tests passed
ops-queue-render.test.js: all tests passed
lifecycle-translate.test.js: all tests passed
(all other test files: passed)
```

## Notes

- The old `queueUnaccept()` JS function remains in the codebase but is no longer called from the queue row render. No dead imports introduced.
- No `bridge/` files were modified.
- Diff: ~20 LOC in dashboard (excluding tests), well under 250 LOC limit.
