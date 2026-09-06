# Contract patches: proof lanes, and machines run the suites

**From:** Taylor (Architect; legacy key `dax`)
**To:** Philipp (the only person who edits `docs/contracts/` and `.claude/CLAUDE.md`)
**Date:** 2026-09-07
**Status:** DRAFT. Waiting for Philipp to apply. Decision record: `docs/adr/ADR-PROOF-LANES.md`.

## What this is

One quote-and-replace document, the same form Chris used on 2026-09-03. Each patch quotes the
current text and gives the replacement. Nothing else in the files changes. Apply them in the order
given; the lifecycle contract is the source of truth and goes first.

The decisions behind these patches, in short: no agent runs the full suites (GitHub runs the
safety-net suite on every push to dev and a red run files a fix request by itself); every brief
declares a lane, `core` or `surface`; a surface slice gets a light proof; the pipeline fills the
report metrics and regenerates the lock files.

---

## Patch 1 of 5: `docs/contracts/slice-lifecycle.md`

### 1a. Actors table, the Rom row (line 21)

**Current:**

```
| Rom         | Implementor. Moves the ticket from IN_PROGRESS to DONE. On rejection, reads Nog's appendment and reworks his implementation. Writes the safety-net tests for his own change: one per acceptance criterion plus one per trap in the brief, then stops. Runs the break-it check on his own new tests and reports which went red. Moves his own safety-net tests when his change requires it and lists every move in his report. Never writes or commits a browser test (a `*.spec.js` under `e2e/`). May open a browser to check his own work and says what he saw in his report. |
```

**Replace with:**

```
| Rom         | Implementor. Moves the ticket from IN_PROGRESS to DONE. On rejection, reads Nog's appendment and reworks his implementation. Writes the safety-net tests for his own change as the brief's lane says: core lane, one per acceptance criterion plus one per trap in the brief, then stops; surface lane, only where a criterion asserts behaviour (an interaction or a computed value), otherwise none. Core lane only: runs the break-it check on his own new tests and reports which went red. Moves his own safety-net tests when his change requires it and lists every move in his report. Never writes or commits a browser test (a `*.spec.js` under `e2e/`). Never runs the full safety-net suite or the browser suite; he runs only the test file he wrote. Never runs a lock script or edits `regression/*.lock`; the pipeline regenerates them when the slice lands. Leaves the report's token and time fields at 0; the watcher fills them. May open a browser to check his own work and says what he saw in his report. |
```

### 1b. Actors table, the Watcher row (line 24)

**Current:**

```
| Watcher     | Technical orchestrator. Physical filesystem moves, git ops, role spawning.      |
```

**Replace with:**

```
| Watcher     | Technical orchestrator. Physical filesystem moves, git ops, role spawning. Fills the report's telemetry from the session it ran. Regenerates `regression/COVERAGE.lock` and `regression/AC-MANIFEST.lock` inside the commit that lands a slice on dev. Carries the slice's lane in every register event and as a `Lane:` trailer on the landing commit. |
```

### 1c. State transitions, the ACCEPTED → IN_QA row (line 56), append one sentence

**Current (end of the row):**

```
Never the line-by-line code changes, never the product source. Spawns Julian. |
```

**Replace with:**

```
Never the line-by-line code changes, never the product source. Spawns Julian. For a surface-lane slice the stage runs its machine steps only (the break-it check does not apply; both suites run once); Julian is spawned only when a criterion names an interaction. |
```

### 1d. Invariants, item 11 (line 108)

**Current:**

```
11. **The browser suite runs at Julian's stage on dev, not only at the Promote button.** Rom never runs it. Julian's stage run decides whether the slice may merge; the Promote button's run is a last check that dev still passes at that moment, not a second decision.
```

**Replace with:**

```
11. **Machines run the suites; agents do not.** No agent runs the full safety-net suite or the browser suite. Sam runs only the test file he wrote; Julian, while writing, only his. The safety-net suite runs on GitHub on every push to dev, and a red run files a fix request into Alex's inbox by itself (register: DEV_SUITE_RED). The browser suite runs at Julian's stage on dev and at the Promote button. Julian's stage run decides whether the slice may merge; the Promote button's run is a last check that dev still passes at that moment, not a second decision.
12. **Every brief declares a lane, and the lane is checked, not trusted.** `lane: core` or `lane: surface` in the frontmatter; absent means core. Nog checks the diff against the declaration and rejects a surface slice whose diff alters behaviour (a lane mismatch; O'Brien re-files it as core). The lane travels as a `Lane:` trailer on the commits so the gates read it from history.
```

---

## Patch 2 of 5: `docs/contracts/slice-format.md`

### 2a. Required frontmatter fields table (lines 37-46), add one row after `priority`

**Insert after the `priority` row:**

```
| `lane`      | string | `core` or `surface`. Written by `new-slice.js` from `--lane`; defaults to `core` with a warning when omitted. Core: changes what the system does (control flow, state, git, the gate, API endpoints and responses, the orchestrator, lib, scripts, workflows, a test's behaviour). Surface: changes what the screen shows or says, or what a document says (markup, copy, styling, docs, role files, templates, prompt wording), with no new branch of logic. Nog checks the diff against it. |
```

### 2b. Frontmatter example (lines 58-71), add one line after `priority: normal`

```
lane: core
```

### 2c. The `## Tasks` section, the never-ask list (lines 105-111)

**Current (first bullet):**

```
- Never "write guard tests" or "add tests" as an open task. Say instead, word for word: "Write one safety-net test per acceptance criterion, plus one for each trap, then stop."
```

**Replace with:**

```
- Never "write guard tests" or "add tests" as an open task. Say instead, word for word, by lane. Core: "Write one safety-net test per acceptance criterion, plus one for each trap, then stop." Surface: "Write a safety-net test only for a criterion that asserts behaviour; otherwise write none, then stop."
- Never ask Rom to run the full safety-net suite (`npm test`, `node --test regression/**`), to run a lock script (`build-coverage-map`, `build-ac-manifest`), to edit `regression/*.lock`, or to fill the report's token and time fields. The pipeline does all four. (Apply this bullet once slices 386 and 387 are live; until then briefs carry a transitional section that has Rom regenerate the locks with two commands and fill the metrics as the old template demands.)
```

### 2d. The fixed block sentence (line 113)

**Current:**

```
Every brief carries the fixed "## What Rom does not do" block, verbatim, in the wording kept in `.claude/roles/obrien/slice-body-template.md`. `bridge/new-slice.js` refuses a brief that lacks the block, and refuses a brief that contains an imperative test-writing phrase aimed at Rom: "write guard tests", "guard tests, AC-tagged", "verify in a real browser", "write a browser test", "add a browser test", "add a test in e2e/", "run the browser suite", "run npx playwright test", and the bare `npx playwright test` unless followed by `--list`.
```

**Replace with:**

```
Every brief carries the fixed "## What Rom does not do" block, verbatim, in the wording kept in `.claude/roles/obrien/slice-body-template.md`. `bridge/new-slice.js` refuses a brief that lacks the block, and refuses a brief that contains an imperative test-writing phrase aimed at Rom: "write guard tests", "guard tests, AC-tagged", "verify in a real browser", "write a browser test", "add a browser test", "add a test in e2e/", "run the browser suite", "run npx playwright test", the bare `npx playwright test` unless followed by `--list`, "run the full suite", "run npm test", "run the safety-net suite", and "regenerate the locks".
```

### 2e. `## Traps` (line 117)

**Current:**

```
A short numbered list of the ways this change is likely to go wrong. Rom writes one safety-net test per trap. Keep each trap to one or two sentences. The trap list is not the place for testing instructions; those belong to the rule above.
```

**Replace with:**

```
A short numbered list of the ways this change is likely to go wrong. In the core lane Rom writes one safety-net test per trap; in the surface lane a trap is a note to Rom and Nog, not a test. Keep each trap to one or two sentences. The trap list is not the place for testing instructions; those belong to the rule above.
```

---

## Patch 3 of 5: `docs/contracts/done-report-format.md`

### 3a. Required telemetry fields (lines 53-63)

**Current (the sentence under the heading):**

```
The watcher fills these from the `claude -p` session metadata. The implementor does not hand-author them.
```

**Replace with:**

```
The watcher fills these from the `claude -p` session metadata after the implementor exits; the implementor leaves them at 0 and is never failed for them. Two more fields are written by the watcher: `tokens_cache_read` (integer) and `cost_usd` (number, the CLI's own total). `estimated_human_hours` is the implementor's optional honest guess, or 0. `compaction_occurred` is the implementor's, default false.
```

### 3b. The DONE vs ERROR table (line 24)

**Current:**

```
| `${id}-ERROR.md` | Watcher | The `claude -p` process crashed, timed out, or exited non-zero without writing a report, or the watcher could not fill the five telemetry fields. Infrastructure broke; no Nog review. |
```

**Replace with:**

```
| `${id}-ERROR.md` | Watcher | The `claude -p` process crashed, timed out, or exited non-zero without writing a report. Infrastructure broke; no Nog review. Missing or zero telemetry is never an ERROR. |
```

### 3c. Markdown body, the heading list (line 111), prepend the lane sentence

**Current (first sentence):**

```
The body is prose for Nog and Julian under a fixed set of headings. Required, in this order: `## Summary`, `## What changed`, `## Acceptance criteria verification`, `## Safety-net tests`, `## Screen hooks`, `## Tests moved or weakened`, `## Commit`.
```

**Replace with:**

```
The body is prose for Nog and Julian under a fixed set of headings that depends on the slice's lane. Core lane, required in this order: `## Summary`, `## What changed`, `## Acceptance criteria verification`, `## Safety-net tests`, `## Screen hooks`, `## Tests moved or weakened`, `## Commit`. Surface lane, required in this order: `## Summary`, `## What changed`, `## Screen hooks`, `## Commit`; `## Safety-net tests` only if a test was written, and no break-it evidence.
```

---

## Patch 4 of 5: `docs/contracts/ac-custody.md`

### 4a. Ownership table, the Rom row (line 28)

**Current:**

```
| **Rom** | Writes the **safety-net tests** for his own change: one per AC plus one per trap in the brief, each carrying its AC tag, then stops. Runs the break-it check on them and reports which went red. Moves his own safety-net tests when needed and lists every move in his DONE report. | Never writes or commits a browser test. Never runs the browser suite. Never edits an AC. |
```

**Replace with:**

```
| **Rom** | Writes the **safety-net tests** for his own change as the lane says: core, one per AC plus one per trap in the brief, each carrying its AC tag and the `@ac-hash` line the brief gives him, then stops; surface, only where a criterion asserts behaviour. Core only: runs the break-it check on them and reports which went red. Moves his own safety-net tests when needed and lists every move in his DONE report. | Never writes or commits a browser test. Never runs the browser suite or the full safety-net suite. Never runs a lock script or edits `regression/*.lock`. Never edits an AC. |
```

### 4b. The staleness primitive (after line 40), add one paragraph

**Insert after the `stale ⟺ acHash != guardAcHash` bullet:**

```
- `lane` — `core` or `surface`, recorded per tag in `AC-MANIFEST.lock` from the `Lane:` trailer of the commit that declared the AC (fallback: the slice frontmatter; default `core`). A surface tag with no guard reconciles as **SURFACE**, not MISSING: it is passed with the reason "Jordan's review is the evidence; the browser suite covers the screen at the gate" and never asks the operator. A surface tag that does have a guard is hash-ratcheted like any other. The hard ruling is untouched: editing a surface AC's text still flags AC-MUTATED.
```

### 4c. The new-AC drain feed (line 70-71)

**Current:**

```
The coverage status refers to the
safety-net (regression) surface, which is Rom's; a MISSING or STALE entry is a finding for O'Brien's
fix slice, not something Julian fills.
```

**Replace with:**

```
The coverage status refers to the
safety-net (regression) surface, which is Rom's; a MISSING or STALE entry on a core AC is a finding for
O'Brien's fix slice, not something Julian fills. A SURFACE entry expects no safety-net test and drains
as-is.
```

---

## Patch 5 of 5: `.claude/CLAUDE.md` (Rom's standing instructions; locked by convention)

### 5a. The Tests line (line 19)

**Current:**

```
**Tests:** You write safety-net tests: one per acceptance criterion plus the trap list, then stop. You never write or commit a browser test. You may look in a browser and say what you saw. Your report uses the headings in your role file.
```

**Replace with:**

```
**Tests:** You write safety-net tests as the brief's lane says: core lane, one per acceptance criterion plus the trap list, then stop; surface lane, only where a criterion asserts behaviour. You never write or commit a browser test. You never run the full safety-net suite or the browser suite; you run only the test file you wrote. You never run a lock script or edit `regression/*.lock`, and you leave the report's token and time fields at 0; the pipeline does those. You may look in a browser and say what you saw. Your report uses the headings in your role file for your lane.
```

---

## Not in this document

The role file `.claude/roles/rom/ROLE.md` and Alex's `.claude/roles/obrien/slice-body-template.md`
are not locked; Taylor edited them directly on dev on 2026-09-07 (commit noted in the handoff to
Alex). Nog's and Julian's role files need no wording change: Nog's lane check reaches him through
his prompt (Slice 389), Julian's stage rule through the lifecycle contract (Patch 1c).

— Taylor
