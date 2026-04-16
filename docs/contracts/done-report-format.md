# DONE Report Format — Liberation of Bajor

*Contract version: 2.0*
*Source of truth: [`slice-lifecycle.md`](./slice-lifecycle.md) (BR), [`slice-pipeline.md`](./slice-pipeline.md) (technical spec).*
*Author: Rom or Leeta (the implementor).*
*Reader: Nog.*
*Supersedes: `report-format.md` (v1.0, 2026-04-06).*

---

## Overview

A DONE report is a markdown file with YAML frontmatter, written by the implementor (Rom or Leeta) at the end of slice execution. The watcher writes it to `${id}-DONE.md` in `bridge/queue/` once the `claude -p` process exits cleanly. Nog reads it, plus the branch diff, to evaluate whether the slice's acceptance criteria are satisfied.

**The implementor always writes a DONE file — even on failure.** If the slice cannot complete, the implementor writes a DONE file with `status: BLOCKED` or `status: PARTIAL` explaining the situation. The watcher writes a `${id}-ERROR.md` file only when the `claude -p` process itself crashes or times out without producing output — infrastructure failure, not slice failure.

---

## DONE vs. ERROR

| File | Writer | Meaning |
|---|---|---|
| `${id}-DONE.md` | Rom or Leeta | The implementor finished, produced output, and reported outcome. Status may be `DONE`, `PARTIAL`, or `BLOCKED`. Nog has something to evaluate. |
| `${id}-ERROR.md` | Watcher | The `claude -p` process crashed, timed out, or exited non-zero without writing a report. Infrastructure broke; no Nog review. |

---

## File naming

```
${id}-DONE.md
```

`${id}` matches the slice ID (e.g. `141-DONE.md`, `143-DONE.md`).

---

## YAML frontmatter

### Required fields

| Field                   | Type    | Description                                                                   |
|-------------------------|---------|-------------------------------------------------------------------------------|
| `id`                    | string  | Zero-padded three-digit slice ID, quoted (e.g. `"143"`).                      |
| `title`                 | string  | Slice title, copied from the slice frontmatter.                               |
| `from`                  | string  | `rom` or `leeta` — whichever implementor wrote the report.                    |
| `to`                    | string  | Always `nog`.                                                                 |
| `status`                | string  | One of `DONE`, `PARTIAL`, `BLOCKED`.                                          |
| `slice_id`              | string  | Same as `id` for originals; may differ for amendment chains.                  |
| `branch`                | string  | Git branch the implementor worked on (e.g. `"slice/143"`).                    |
| `completed`             | string  | ISO 8601 UTC timestamp when the report was written.                           |

### Required telemetry fields

The watcher fills these from the `claude -p` session metadata. The implementor does not hand-author them.

| Field                   | Type    | Description                                                                   |
|-------------------------|---------|-------------------------------------------------------------------------------|
| `tokens_in`             | integer | Prompt tokens consumed.                                                       |
| `tokens_out`            | integer | Completion tokens produced.                                                   |
| `elapsed_ms`            | integer | Wallclock milliseconds from `claude -p` start to report flush.                |
| `estimated_human_hours` | number  | Rough "human hours saved" estimate for the sprint-cost dashboard.             |
| `compaction_occurred`   | boolean | Whether the session hit context compaction.                                   |

### Frontmatter example

```yaml
---
id: "143"
title: "watcher: detect Rom slice-broken fast path and route to STAGED"
from: rom
to: nog
status: DONE
slice_id: "143"
branch: "slice/143"
completed: "2026-04-16T20:35:00.000Z"
tokens_in: 28000
tokens_out: 3500
elapsed_ms: 120000
estimated_human_hours: 0.3
compaction_occurred: false
---
```

---

## Status semantics

### `DONE`

All acceptance criteria in the slice are met. The work is complete and verifiable from the branch diff.

### `PARTIAL`

Some acceptance criteria met, some not. The report must explain:
- which criteria are satisfied, with verification notes;
- which criteria are not satisfied, and why;
- what the implementor recommends (amendment slice, split, or O'Brien rework).

### `BLOCKED`

The implementor cannot proceed without input from O'Brien. The blocker must be explained clearly:
- what is blocking progress;
- what decision or clarification is needed;
- what was done before the blocker was hit.

---

## Markdown body

The body is freeform prose for Nog. The following sections are conventional and recommended (not strictly enforced, but Nog expects them).

### `## Summary`

A brief narrative — what the implementor did, in what order, and any significant decisions made during execution.

### `## What changed`

A concrete list of the changes — files modified, functions added, commits landed. Reference specific file paths, line numbers, and commit SHAs.

### `## Acceptance criteria verification`

Point-by-point confirmation of each acceptance criterion from the slice, with the command run and the observed result (PASS / FAIL).

### `## Commit`

The commit SHA(s) produced by this slice, with the exact commit message.

### `## Blockers / Open questions` *(PARTIAL or BLOCKED only)*

Anything that needs O'Brien's input. Omit for `DONE`.

---

## Rom-only conventions (rejection pickups)

If Rom is re-running the slice after a Nog rejection, his report must also:
- Open with `## Round N — Rework` where `N` is the rejection round number.
- Explicitly call out which findings from `## Nog Review — Round N-1` were addressed and how.

If Rom is invoking the slice-broken fast path (BR invariant #9), his DONE file must include the exact heading `## Rom Escalation — Slice Broken` (no ambiguity). See `slice-pipeline.md` §10.

---

## Minimal example

```markdown
---
id: "150"
title: "Add .gitignore"
from: rom
to: nog
status: DONE
slice_id: "150"
branch: "slice/150"
completed: "2026-04-17T10:47:00.000Z"
tokens_in: 1200
tokens_out: 400
elapsed_ms: 22000
estimated_human_hours: 0.1
compaction_occurred: false
---

## Summary
Created `.gitignore` at the project root with the four patterns specified in the slice and committed.

## What changed
- Added `.gitignore` at the project root with `.DS_Store`, `node_modules/`, `*.log`, `.env`.

## Acceptance criteria verification
| Criterion | Command | Result |
|---|---|---|
| `.gitignore` exists | `test -f .gitignore` | PASS |
| Contains the four patterns | `grep -c -E "^(\.DS_Store|node_modules/|\*\.log|\.env)$" .gitignore` returns 4 | PASS |
| `git diff --stat main` shows exactly 1 file | `git diff --stat main` | PASS (1 file) |

## Commit
`a1b2c3d` — `chore: add .gitignore`
```
