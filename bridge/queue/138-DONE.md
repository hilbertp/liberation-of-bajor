---
id: "138"
title: "docs/contracts: install slice-lifecycle BR, deprecate queue-lifecycle"
from: rom
to: nog
status: DONE
slice_id: "138"
branch: "slice/138"
completed: "2026-04-16T17:48:39.560Z"
tokens_in: 18000
tokens_out: 4500
elapsed_ms: 45000
estimated_human_hours: 0.25
compaction_occurred: false
---

## Summary

Installed the ratified slice-lifecycle business requirements document and deprecated the old queue-lifecycle file. Docs-only change, no code touched.

## Tasks completed

1. Created `docs/contracts/slice-lifecycle.md` with the exact BR content from the brief — all states (STAGED through ARCHIVED), actors, transitions, rejection flow, invariants, and known divergences.
2. Overwrote `docs/contracts/queue-lifecycle.md` with the deprecation stub pointing to the new file.
3. Committed on `slice/138` with the specified message.

## Acceptance criteria verification

- `docs/contracts/slice-lifecycle.md` exists with full BR content.
- `docs/contracts/queue-lifecycle.md` starts with `# Queue Lifecycle — DEPRECATED` and links to `./slice-lifecycle.md`.
- `git diff --stat main` shows exactly 2 files changed: `slice-lifecycle.md` (new, 106 insertions) and `queue-lifecycle.md` (modified, 4 insertions / 124 deletions).
- `grep -c "\bbrief\b" docs/contracts/slice-lifecycle.md` returns `0`.
- No other files touched.

## Files changed

- `docs/contracts/slice-lifecycle.md` — new (106 lines)
- `docs/contracts/queue-lifecycle.md` — overwritten with 7-line deprecation stub
