---
id: "094"
title: "Error reporting — capture error details in watcher + API"
goal: "When a slice errors, the watcher captures a structured error record. The Ops Center API exposes it. Frontend slice 104 surfaces it in the UI."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: 20
status: "STAGED"
---

## Objective

When a slice enters ERROR state, the watcher currently writes minimal error info. Expand the error record to capture structured details (reason, last output, exit code, duration). Expose this via a new API endpoint so the Ops Center can show why something failed.

## Context

Current error handling in `bridge/watcher.js`: when a slice errors, the watcher writes `{id}-ERROR.md` with reason and basic metadata. The Ops Center shows "error" state but not why. Sprint 3 requires showing *why* in the UI (see `docs/SPRINT3-SCOPE.md`).

The error details needed:
- `reason`: string — e.g. `"inactivity_timeout"`, `"non_zero_exit"`, `"signal"`, `"nog_escalation"`
- `exitCode`: number or null
- `signal`: string or null
- `lastOutput`: last N characters of stdout/stderr (cap at 2000 chars to avoid bloat)
- `durationMs`: how long the slice ran before failing
- `ts`: ISO 8601 timestamp

These are written by the watcher to `bridge/errors/{id}-ERROR.json` (structured JSON, not markdown). The existing `{id}-ERROR.md` DONE report stays as-is for human reading.

## Tasks

1. Create `bridge/errors/` directory (add `.gitkeep`, add `bridge/errors/*.json` to `.gitignore`).

2. In `bridge/watcher.js`, in the error handler (wherever `{id}-ERROR.md` is written):
   - After writing the markdown error report, also write `bridge/errors/{id}-ERROR.json`:
   ```json
   {
     "ts": "ISO 8601",
     "slice_id": "NNN",
     "reason": "inactivity_timeout | non_zero_exit | signal | nog_escalation",
     "exitCode": null,
     "signal": null,
     "lastOutput": "last 2000 chars of combined stdout+stderr",
     "durationMs": 12345
   }
   ```
   - Use `try/catch` — this write must never crash the watcher.

3. In `dashboard/server.js`, add a new API endpoint:
   ```
   GET /api/bridge/errors/:id
   ```
   - Reads `bridge/errors/{id}-ERROR.json`
   - Returns the JSON object, or `{ error: 'not found' }` with 404 if missing

4. Add a new API endpoint:
   ```
   GET /api/bridge/errors
   ```
   - Lists all `bridge/errors/*.json` files, reads each, returns array sorted by `ts` descending
   - Limit to last 20 entries

5. Commit on branch `slice/094-error-capture`:
   ```
   feat(094): structured error capture and API for Ops Center
   ```

## Constraints

- Do not modify the existing `{id}-ERROR.md` format — it's used by the evaluator.
- Error JSON write must be wrapped in try/catch — watcher cannot crash on this.
- `bridge/errors/*.json` must not be committed to git.

## Success criteria

1. `bridge/errors/` directory with `.gitkeep` exists.
2. Watcher writes `bridge/errors/{id}-ERROR.json` when a slice errors, with all fields populated.
3. `GET /api/bridge/errors/:id` returns the error JSON for a given slice.
4. `GET /api/bridge/errors` returns array of recent errors.
5. Watcher does not crash if the JSON write fails.
6. Committed on `slice/094-error-capture`.
