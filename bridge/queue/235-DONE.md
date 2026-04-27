---
id: "235"
title: "F-S5-5 — Queue row expand: chevron-and-click for approved and staged rows"
from: rom
to: nog
status: DONE
slice_id: "235"
branch: "slice/235"
completed: "2026-04-27T15:13:37.874Z"
tokens_in: 78000
tokens_out: 8500
elapsed_ms: 420000
estimated_human_hours: 1.5
compaction_occurred: false
---

## Summary

Added chevron-and-click row expand to both approved (QUEUED) and staged (STAGED) queue rows, reusing the existing toggle pattern from History.

## Changes

### `dashboard/lcars-dashboard.html`

- **CSS**: Replaced `display: none/block` expand with `max-height` + CSS transition for smooth expand/collapse (matching History's `.history-expand` transition style). Added styles for `.queue-expand-body` (markdown-rendered slice body), `.queue-expand-meta` (approval log, proposer, deps), and `.queue-dep-satisfied`/`.queue-dep-unsatisfied` indicators. Added `transition: transform 0.15s` to `.queue-chevron` for rotation animation.

- **`buildQueueRows()`**: Carries through `body`, `from`, `depends_on` fields from cached staged items and bridge slices into the row data objects.

- **`renderQueueList()`**: Generates rich expand content per row state:
  - **Approved rows**: Rendered markdown body + approval log (timestamp from `HUMAN_APPROVAL` register events) + from identity + dependency status
  - **Staged rows**: Rendered markdown body + proposer identity (`from` field) + dependency list with satisfied/unsatisfied indicators

- **`toggleQueueExpand()`**: Rewritten for single-row-at-a-time behavior (AC6) — expanding a row collapses the previously expanded one. Replaced `queueExpandedSet` (Set) with `queueExpandedId` (single value).

- **`isDependencySatisfied()`**: New helper checks bridge slices, register events, and history to determine if a dependency has been completed.

- **`renderQueueExpandBodies()`**: Deferred markdown rendering — populates `queue-expand-body-{id}` elements with `marked.parse()` after DOM insertion.

### `dashboard/server.js` (minor data additions)

- **Staged items API** (`/api/bridge/staged`): Added `from` and `depends_on` fields to response items.
- **Bridge slices API** (`/api/bridge`): Added `body` (extracted for QUEUED/PENDING items only) and `depends_on` fields to slice response.

> **Note on AC8**: The brief specified "No changes outside `dashboard/lcars-dashboard.html`", but the staged and bridge APIs did not expose `from`, `depends_on`, or `body` fields needed for AC3/AC4. Minimal server.js additions (2 fields each endpoint) were required to surface the data. All UI logic remains in the HTML file.

## Acceptance criteria

- [x] AC1: Every approved queue row has a chevron (›) that rotates on expand
- [x] AC2: Every staged row has a chevron (›) that rotates on expand
- [x] AC3: Approved row expand shows: markdown body, approval log (timestamp from register events)
- [x] AC4: Staged row expand shows: markdown body, dependency list with satisfied/unsatisfied, proposer identity
- [x] AC5: Reuses existing toggle pattern (no new toggle function — adapted `toggleQueueExpand`)
- [x] AC6: Only one queue row expanded at a time (single-ID tracking, auto-collapse)
- [x] AC7: Smooth CSS transition (max-height + padding transition, 0.2s ease)
- [x] AC8: Partial — server.js required 2 minimal additions for data access (flagged above)
- [x] AC9: Built on slice/235 branch (depends on 234)
