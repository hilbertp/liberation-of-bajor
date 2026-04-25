---
id: "207"
title: "F-207 — Rom context resume: reuse round-1 claude session on small reworks"
from: rom
to: nog
status: DONE
slice_id: "207"
branch: "slice/207"
completed: "2026-04-25T10:15:00.000Z"
tokens_in: 52000
tokens_out: 8500
elapsed_ms: 420000
estimated_human_hours: 1.5
compaction_occurred: false
---

## Summary

Implemented Rom session resume for rework rounds. On round 1, `invokeRom` now captures `session_id` from claude's JSON output and persists it to the PARKED file's frontmatter as `rom_session_id`. On rework dispatch (round > 1), the orchestrator reads `rom_session_id` and uses `--resume <session_id>` instead of `-p`, preserving the session's codebase context and avoiding expensive re-orientation.

Fresh-session fallback triggers when:
- No `rom_session_id` available (older slices, parse failures)
- Nog rejection contains architectural keywords (reconsider approach, wrong design, start over, different approach, rethink, architectural, redesign)
- Nog rejection exceeds 500 characters (substantial rework)

## Changes

### `bridge/orchestrator.js` (88 LOC added)

1. **`extractSessionId(stdout)`** — Parses session_id from claude's JSON output. Returns string or null.

2. **`shouldForceFreshSession(reason)`** — Checks Nog rejection text against keyword triggers and length threshold (>500 chars). Returns boolean.

3. **Session capture in `invokeRom` callback** — After IN_PROGRESS → PARKED rename, extracts session_id and writes `rom_session_id` to PARKED frontmatter via `updateFrontmatter`. Logs warning on failure, does not block.

4. **Rework dispatch in `invokeRom`** — Before `execFile`, detects round > 1 + rom_session_id. Builds modified args with `--resume <id>` (removing `-p`). Emits `ROM_SESSION_RESUMED` or `ROM_SESSION_FRESH` register events with payload `{ session_id, round, reason_for_fresh }`.

5. **Exports** — `extractSessionId` and `shouldForceFreshSession` added to module.exports.

### `test/rom-session-resume.test.js` (198 LOC)

20 tests covering:
- **A** (3 tests): extractSessionId parses session_id, returns null on missing/malformed
- **B** (1 test): short benign rejection → no fresh trigger
- **C** (7 tests): each FRESH_TRIGGERS keyword triggers fresh session
- **D** (2 tests): null/empty reason → false
- **E** (2 tests): >500 chars → fresh; exactly 500 → not fresh
- **F** (4 tests): event payload structure for RESUMED/FRESH variants
- Case-insensitivity test

## Acceptance criteria

| AC | Status |
|----|--------|
| 0. DONE skeleton first commit | DONE |
| 1. invokeRom captures session_id, writes to PARKED as rom_session_id | DONE |
| 2. Rework dispatch reads rom_session_id, uses --resume when appropriate | DONE |
| 3. shouldForceFreshSession triggers on keywords + >500 chars | DONE |
| 4. ROM_SESSION_RESUMED / ROM_SESSION_FRESH register events emitted | DONE |
| 5. Existing slices without rom_session_id fall through to fresh session | DONE |
| 6. Regression tests A-F pass | DONE (20/20) |
| 7. Full suite passes | DONE (all 29 test files) |
| 8. Diff under ~250 LOC excluding tests | DONE (88 LOC in orchestrator.js) |
| 9. No changes outside orchestrator.js + test file | DONE |

## Backwards compatibility

Existing PARKED files without `rom_session_id` are handled gracefully — `sliceMeta.rom_session_id` evaluates to null/undefined, triggering the fresh-session fallback with `ROM_SESSION_FRESH { reason_for_fresh: 'no_session_id' }`. No migration needed.
