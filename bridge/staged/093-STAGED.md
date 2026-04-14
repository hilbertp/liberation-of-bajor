---
id: "093"
title: "Nog — watcher wiring and headless invocation"
goal: "The watcher invokes Nog headless (claude -p) after every O'Brien DONE, routes the NOG.md verdict, and handles PASS/RETURN correctly."
from: kira
to: obrien
priority: high
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: 45
status: "STAGED"
---

## Objective

Wire Nog into the pipeline. After O'Brien completes a slice (DONE state), the watcher invokes Nog as a headless `claude -p` process, passing the slice file and diff as context. Nog writes a verdict file. The watcher routes: PASS moves the slice forward, RETURN sends it back to O'Brien as an amendment.

## Context

Nog's role and round mechanics: `.claude/roles/nog/ROLE.md` — read this first.

Nog runs headless, same invocation pattern as O'Brien (`claude -p`). The watcher already knows how to invoke O'Brien headlessly and stream his output — apply the same pattern for Nog.

Nog's inputs (passed via prompt):
- Path to the original slice file (which may already have prior Nog review sections appended)
- Path to O'Brien's DONE report
- The git diff for the branch (output of `git diff main...{branch}` or equivalent)

Nog's outputs:
- Appends a review section to the slice file (format in ROLE.md)
- Writes `bridge/queue/{id}-NOG.md` with frontmatter `verdict: PASS | RETURN`

The watcher reads `{id}-NOG.md` after Nog exits:
- `PASS` → move to the next pipeline stage (currently: merge — Bashir is future)
- `RETURN` → create an amendment slice file and send back to O'Brien (increment round counter, max 5)
- Round 6+ → escalate: write `{id}-NOG-ESCALATION.md` to `bridge/kira-escalations/`, append a `NOG_ESCALATION` kira-event, stop cycling

Round tracking: the slice file's Nog review sections are the source of truth. Count `## Nog Review — Round N` headers to determine current round.

## Tasks

1. Create `bridge/nog-prompt.js` — builds the prompt string passed to Nog via `claude -p`:
   ```
   You are Nog, Code Reviewer for the DS9 pipeline.
   Read your role definition at: .claude/roles/nog/ROLE.md
   
   You are reviewing slice {id} — round {N}.
   
   Slice file (includes original brief and any prior review rounds):
   {sliceFileContents}
   
   O'Brien's DONE report:
   {doneReportContents}
   
   Git diff (main...{branch}):
   {gitDiff}
   
   Perform your review per ROLE.md. Then:
   1. Append your review section to the slice file at: {slicePath}
   2. Write your verdict to: bridge/queue/{id}-NOG.md
      Format: YAML frontmatter with `verdict: PASS` or `verdict: RETURN`, plus a one-line `summary`.
   
   Do not modify any code. Read only. Write only to the two files above.
   ```

2. In `bridge/watcher.js`, after a slice transitions to DONE and the DONE report is written:
   - Determine the current round number (count existing `## Nog Review — Round` sections in the slice file; add 1)
   - If round ≤ 5: invoke Nog headless using the same `claude -p` invocation pattern used for O'Brien, with the prompt from `nog-prompt.js`
   - Stream Nog's output to `bridge/logs/nog-{id}-round{N}.log`
   - After Nog exits, read `bridge/queue/{id}-NOG.md`

3. Handle the verdict:
   - **PASS**: rename slice to `{id}-DONE.md` → standard evaluator flow continues
   - **RETURN**: create `{id}-AMENDMENT.md` (copy of original slice file with Nog review appended, frontmatter updated: `round: N`, `status: AMENDMENT`). Re-queue for O'Brien.
   - **Missing/unparseable NOG.md**: treat as RETURN with details "Nog verdict unreadable" — log error, wire `NOG_ESCALATION` kira-event, escalate to Kira

4. Round 6 escalation path:
   - If round would be 6: do not invoke Nog again
   - Write `bridge/kira-escalations/{id}-NOG-ESCALATION.md` with full slice history
   - Append `NOG_ESCALATION` kira-event via `appendKiraEvent` from `bridge/kira-events.js`
   - Rename queue file to `{id}-STUCK.md`

5. Register events: append to `bridge/register.jsonl` for each Nog pass/return/escalation:
   - `{ event: 'NOG_PASS', id, round, ts }`
   - `{ event: 'NOG_RETURN', id, round, ts }`
   - `{ event: 'NOG_ESCALATION', id, round, ts }`

6. Add `bridge/logs/` to `.gitignore` if not already there.

7. Commit on branch `slice/093-nog-wiring`:
   ```
   feat(093): wire Nog headless reviewer into watcher pipeline
   ```

## Constraints

- Nog invocation is headless (`claude -p`) — same pattern as O'Brien. Do not use a different invocation.
- Do not modify `.claude/roles/nog/ROLE.md`.
- Nog never modifies O'Brien's code — the wiring must not give Nog write access beyond the slice file and NOG.md verdict.
- Max 5 rounds; round 6 always escalates, never retries.
- `appendKiraEvent` must be available from `bridge/kira-events.js` — slice 092 must have landed first, or you add the dependency inline with a note.

## Success criteria

1. `bridge/nog-prompt.js` exists and builds a complete, self-contained prompt.
2. Watcher invokes Nog after every O'Brien DONE.
3. PASS verdict → slice proceeds to evaluator (existing path).
4. RETURN verdict → O'Brien gets an amendment with the Nog review appended.
5. Round 6 → `kira-escalations/{id}-NOG-ESCALATION.md` written, kira-event emitted, slice STUCK.
6. NOG_PASS, NOG_RETURN, NOG_ESCALATION register events written correctly.
7. Nog logs written to `bridge/logs/nog-{id}-round{N}.log`.
8. Committed on `slice/093-nog-wiring`.
