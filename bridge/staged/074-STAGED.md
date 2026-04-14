---
id: "074"
title: "Rename brief → Slice in all docs, roles, and skills (docs sweep)"
goal: "Every human-facing document, role file, and skill file uses 'Slice' where it previously said 'brief', so the team vocabulary is consistent."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: null
---

## Objective

The term "brief" is being renamed to "Slice" across the project. This slice covers the safe sweep: documentation, role files, skill files, and comments only. Code, variable names, function names, API routes, and watcher logic are explicitly out of scope — handled in slice 075.

## Context

"Brief" and "Slice" have been used interchangeably. The decision is to standardise on "Slice" everywhere. The prior commission→brief rename (earlier in the project) broke the pipeline because code and docs were changed together without verification. This slice deliberately excludes code to avoid repeating that.

Files in scope: `docs/`, `.claude/roles/`, `.claude/skills/`, `KIRA.md`, `FEATURES.md`, `DEBRIEF.md`, `IDEAS.md`, `.claude/TEAM-STANDARDS.md`, `.claude/CLAUDE.md`, `bridge/templates/`, `README` if present.

Files explicitly out of scope: `bridge/watcher.js`, `bridge/slicelog.js`, `bridge/next-id.js`, `bridge/usage-snapshot.js`, `dashboard/server.js`, `dashboard/lcars-dashboard.html`, any `.js` or `.ts` file, `bridge/queue/` (immutable historical records), `bridge/staged/`, `bridge/register.jsonl`, `bridge/timesheet.jsonl`.

## Tasks

1. Grep all in-scope files for `brief`, `briefs`, `Brief`, `Briefs` (case-sensitive variants). Capture the full list.
2. Replace occurrences that refer to the work unit concept:
   - "brief" → "slice" (lowercase)
   - "Brief" → "Slice" (capitalised)
   - "briefs" → "slices"
   - "Briefs" → "Slices"
   - "brief file" → "slice file"
   - "brief ID" → "slice ID"
   - "brief queue" → "slice queue"
   - "brief template" → "slice template"
   - "brief writing" → "slice writing"
   - "write a brief" → "write a slice"
   - "amendment brief" → "amendment slice"
3. Do NOT rename: `bridge/templates/brief.md` (the template filename) — that is code-adjacent and belongs in slice 075. Reference it by path in docs but do not rename it here.
4. Do NOT alter occurrences in `bridge/queue/` filenames or content — those are permanent historical records.
5. Commit all changes on branch `slice/74-rename-brief-to-slice-docs` with message: `docs(074): rename brief → Slice in all docs, roles, and skills`.

## Constraints

- Docs and text files only. Zero changes to `.js` files, `.html` files, or any executable code.
- Do not rename the template file `bridge/templates/brief.md` — that is slice 075 scope.
- Do not touch `bridge/queue/` — immutable records.
- Branch must be `slice/74-rename-brief-to-slice-docs`.

## Success criteria

1. `grep -r --include="*.md" "brief" docs/ .claude/roles/ .claude/skills/ KIRA.md` returns zero matches that refer to the work unit (grep hits inside `bridge/queue/` and `.js` files are not counted).
2. Zero `.js` or `.html` files were modified (verify with `git diff --name-only`).
3. All changes committed on `slice/74-rename-brief-to-slice-docs` with no uncommitted modifications.
