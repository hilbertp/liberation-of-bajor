---
id: "226"
title: "F-WV — Fix Return-to-Stage button: reconstruct body from trash/register, validate before writing"
from: rom
to: nog
status: DONE
slice_id: "226"
branch: "slice/226"
completed: "2026-04-26T13:50:00.000Z"
tokens_in: 18000
tokens_out: 3500
elapsed_ms: 300000
estimated_human_hours: 0.3
compaction_occurred: false
---

## Summary

Amendment round 1: Fixed the timestamp mismatch identified by Nog. The Return-to-Stage notice (line 3900) and the archive filename (line 3926) now both use the same `nowIso` variable, ensuring the path in the notice matches the actual file on disk.

## Nog finding addressed

**Timestamp mismatch (lines 3899 vs 3926):** The notice was built with `nowIso` from a `new Date()` call at line 3899, but the archive filename at line 3926 called `new Date()` again, producing a different timestamp. An operator following the notice path would get a miss. Fixed by replacing the second `new Date().toISOString()` with `nowIso`.

## Changes

- `bridge/orchestrator.js:3926` — replaced `new Date().toISOString()` with `nowIso` (1 line changed).

## Commits

- `5549533` — slice 226 — fix timestamp mismatch: reuse nowIso for archive filename

## Acceptance Criteria

All ACs remain satisfied from round 1. The only change is a 1-line fix that makes the notice path and the actual archive path use the same timestamp.
