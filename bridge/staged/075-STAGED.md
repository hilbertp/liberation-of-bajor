---
id: "075"
title: "Rename brief → Slice in watcher, server, dashboard, and template (code sweep + pipeline verification)"
goal: "The pipeline runs a full slice end-to-end under the new naming with no regressions — watcher picks up, invokes O'Brien, evaluates, and merges cleanly."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: "074"
timeout_min: 30
---

## Objective

Complete the brief→Slice rename in all code, API routes, log messages, and the template filename. Then verify the pipeline is fully functional. The prior commission→brief rename broke the pipeline — treat this as a risky migration and verify before marking done.

## Context

Slice 074 renamed all docs and role files. This slice covers everything 074 explicitly excluded: `bridge/watcher.js`, `bridge/slicelog.js`, `bridge/next-id.js`, `dashboard/server.js`, `dashboard/lcars-dashboard.html`, `bridge/templates/brief.md`, and any other executable or template files.

**Key risk:** The watcher uses string patterns to match queue filenames, parse log output, and construct API responses. Any rename of a string constant the watcher depends on can silently break state transitions. Check carefully — do not do a blind find-and-replace in `.js` files.

**Historical breakage pattern:** The commission→brief rename earlier in this project broke the pipeline because a string constant in the watcher that matched queue file states was renamed without updating the corresponding filename pattern check. Before touching any string in watcher.js, confirm whether it is a display label (safe to rename) or a filename/state-machine string (must be renamed atomically with its counterpart, or not at all).

## Tasks

1. Read `bridge/watcher.js` in full before making any changes. Identify every occurrence of `brief` and classify each as:
   - **Display label** — appears in log output, terminal banners, or comments only. Safe to rename.
   - **State/filename string** — matched against actual filenames or queue states (e.g. `PENDING`, `DONE`). Rename only if the corresponding file format or state name is also changing (it is not — queue filenames stay `{id}-PENDING.md` etc.).
   - **Variable/function name** — internal code symbol. Rename if it improves clarity; ensure all call sites are updated atomically.
2. Apply the same classification to `bridge/slicelog.js`, `bridge/next-id.js`, `dashboard/server.js`.
3. Rename `bridge/templates/brief.md` → `bridge/templates/slice.md`. Update any reference to this path in watcher.js or other code.
4. Rename API routes if they contain `brief` in the path (e.g. `/api/bridge/briefs` → `/api/bridge/slices`). Update all call sites in `dashboard/lcars-dashboard.html` and any other client. If an API route rename would break an existing integration, flag it in the report instead of renaming.
5. Update `dashboard/lcars-dashboard.html` display labels that say "Brief" → "Slice".
6. **Verification — mandatory before committing:**
   a. Start the watcher (`node bridge/watcher.js` or equivalent).
   b. Write a minimal test slice to `bridge/staged/` and approve it (move to `bridge/queue/{id}-PENDING.md`).
   c. Confirm the watcher picks it up (transitions to IN_PROGRESS), invokes O'Brien, and processes the DONE report through to ACCEPTED or AMENDMENT.
   d. Confirm the Ops Center at `localhost:4747` loads without errors and displays pipeline state correctly.
   e. Record the verification result in the DONE report.
7. Commit all changes on branch `slice/75-rename-brief-to-slice-code` with message: `refactor(075): rename brief → Slice in watcher, server, dashboard, and template`.

## Constraints

- Do not rename queue state strings (`PENDING`, `IN_PROGRESS`, `DONE`, `ERROR`, `ACCEPTED`, `MERGED`, `STUCK`) — these are not being changed.
- Do not rename `{id}-STAGED.md`, `{id}-PENDING.md` etc. file format patterns — queue filenames are not changing.
- Branch must be `slice/75-rename-brief-to-slice-code`. Do not commit to main until verification passes.
- If verification fails, stop and report PARTIAL with the exact failure — do not attempt to fix pipeline breakage within this slice.

## Success criteria

1. `grep -r "brief" bridge/watcher.js dashboard/server.js dashboard/lcars-dashboard.html` returns zero display-label matches referring to the work unit (state-machine strings are excepted and must be explicitly listed in the report if retained).
2. `bridge/templates/slice.md` exists; `bridge/templates/brief.md` does not.
3. The watcher successfully processed a test slice end-to-end during verification (O'Brien confirms in report: watcher picked up, transitioned states, evaluation ran, result was ACCEPTED or AMENDMENT_NEEDED).
4. Ops Center loads at `localhost:4747` with no console errors.
5. All changes committed on `slice/75-rename-brief-to-slice-code`.
