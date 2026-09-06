---
id: "383"
title: "The panel says who is on it — Sam and Jordan, always visible"
from: rom
to: nog
status: DONE
slice_id: "383"
branch: "slice/383"
completed: "2026-09-06T19:00:00.000Z"
tokens_in: 184000
tokens_out: 13500
elapsed_ms: 1040000
estimated_human_hours: 1.5
compaction_occurred: false
---

# The panel says who is on it — Sam and Jordan, always visible

## Acceptance criteria

- slice-383-ac-1: the Active Build panel's first row shows the person's name in every panel state — idle, active and blocked — reading "Sam · Full-Stack Engineer" in light mode
- slice-383-ac-2: the Peer Review panel's first row shows the person's name in every panel state — idle and running — reading "Jordan · Reviewer" in light mode
- slice-383-ac-3: in the LCARS skin the same two rows read "Rom · Backend Implementor" and "Nog · Evaluator", with no name printed twice, and they repaint correctly every time the theme is toggled
- slice-383-ac-4: the owner chips on the DevOps Station, Backlog Queue and History panels are unchanged, still reading "QA Engineer", "Dev Lead" and "Dev Lead" in light mode
- slice-383-ac-5: the reviewer's name appears exactly once in the Peer Review panel while a review is running

## Summary

The two agent panels now name the person on them permanently. Both owner chips opt in with a
`data-with-name` marker and `applyRoleLabels()` paints a marked chip as
`personName(key) + ' · ' + roleTitle(key)`; every unmarked chip keeps the untouched
`ownerChip(key)` path. The chips sit in the panel **headers**, above all five state blocks, so no
state swap can take them off screen, and they repaint on every theme toggle because they ride the
page's existing generic repaint path rather than a new one.

Four things worth Nog's eye:

1. **The brief's line numbers were stale.** Every anchor in the brief was ~50–110 lines off (the
   rom chip is at `:6547`, not `:6498`; the nog chip at `:6610`, not `:6561`; `applyRoleLabels()`
   at `:9228`, not `:9129`). I located each element by its selector instead. Every *element* the
   brief named exists and was the one I changed — only the offsets had drifted.

2. **Tasks 2 and 3 read as contradictory; I resolved them, I did not pick one.** Task 2 says "do
   not hardcode the strings 'Sam' or 'Jordan' anywhere in the markup or the JS"; task 3 requires
   exactly those strings as the server-rendered fallback in the markup. I read task 2's clause as
   scoped to the painting logic — its own sentence is "*Reuse the existing helpers* — do not add a
   second ROLE map, and do not hardcode…", i.e. the JS must derive names from `ROLE`, never from
   literals. The JS contains no person name. The markup carries the two fallbacks task 3 spells
   out, and nothing else. If O'Brien meant task 2 literally, task 3 is unbuildable and the fallback
   has to go — say so and I will drop it.

3. **`slice-383-ac-4` names a panel that no longer exists.** It says "the owner chips on the
   **DevOps Station**, Backlog Queue and History panels"; slice 382 renamed that panel to
   *QA and Branches* one commit ago. I declared the criterion **verbatim** as the brief required
   and did not restate it — changing an AC's text is Philipp's call, not mine. The criterion is
   unambiguous in practice (the brief's own hook names `.panel-owner[data-role="bashir"]`, which is
   that panel) and my guard selects on `data-role`, not on the panel name, so it is not affected by
   the stale word. Flagging it so someone can restate it deliberately.

4. **Two of my nine guards are negative, and reverting the fix cannot turn them red.** I forced
   their real failure modes instead and report both separately below, rather than counting a
   revert-green test as break-it evidence.

## What changed

- `dashboard/lcars-dashboard.html:6547` — the Active Build owner chip gains `data-with-name` and
  the fallback text `Sam &middot; Full-Stack Engineer`.
- `dashboard/lcars-dashboard.html:6610` — the Peer Review owner chip gains `data-with-name` and
  the fallback text `Jordan &middot; Reviewer`.
- `dashboard/lcars-dashboard.html` — the duplicated `.role-person-label[data-role="nog"]` inside
  `#nog-running-state`'s `.nog-running-header` removed (it was `:6630`; that line now holds its
  surviving sibling). Its sibling `.nog-running-subtitle` (`#nog-round-label`) is
  byte-identical, and the generic `.role-person-label[data-role]` loop in `applyRoleLabels()` is
  left in place as the brief asked.
- `dashboard/lcars-dashboard.html:9229-9236` — the `.panel-owner[data-role]` branch of
  `applyRoleLabels()`: a marked chip is painted `personName(k) + ' · ' + roleTitle(k)`, an unmarked
  one keeps `ownerChip(k)`. No second ROLE map; no person name written in the JS.
- `regression/direct-controls/j-panel-owner-names.test.js` — **new**, 9 guards (five criteria plus
  four traps).
- `regression/COVERAGE.lock` — regenerated (`node scripts/build-coverage-map.js`); `guardCount`
  573 → 578, the five new tags all `@ac-hash`-annotated against the trailer texts and mapped onto
  `dashboard/lcars-dashboard.html`.
- `regression/AC-MANIFEST.lock` — regenerated (`node scripts/build-ac-manifest.js`) so the five new
  criteria land active, non-legacy and hashed from their commit trailers.

Nothing under `e2e/` was touched — no browser test written, edited, renamed or deleted, and none
run. Lore tags, CSS class names, element ids and `data-role` attributes are all untouched.

## Acceptance criteria verification

Command for all five: `node --test regression/direct-controls/j-panel-owner-names.test.js` — 9/9
pass. The guards run the page's **real** `applyRoleLabels()`, lifted out of the HTML, over chips
parsed out of the **real** markup, with each chip's text overwritten by an `<<unpainted>>` sentinel
first — so a paint that never happens fails instead of reading the server-rendered fallback back to
itself.

- **slice-383-ac-1** — PASS. The painted `rom` chip is exactly `Sam · Full-Stack Engineer`; the
  server-rendered row matches verbatim; and the chip's byte offset precedes
  `#mission-active-content`, `#mission-blocked-content` and `#mission-idle-text`, so it is provably
  above all three states rather than inside one.
- **slice-383-ac-2** — PASS. Same three checks for `nog` → `Jordan · Reviewer`, against
  `#nog-idle-state` and `#nog-running-state`.
- **slice-383-ac-3** — PASS. Under the LCARS skin the two rows paint `Rom · Backend Implementor`
  and `Nog · Evaluator`, each pair's two halves distinct (no name twice). The repaint round-trip
  runs on *one* set of chips: light → LCARS (asserted to change) → light, landing back on the exact
  light strings.
- **slice-383-ac-4** — PASS. `bashir` → `QA Engineer`, `obrien` → `['Dev Lead', 'Dev Lead']`, all
  three unmarked, all three with unchanged server-rendered text.
- **slice-383-ac-5** — PASS. Inside the `#postbuild-panel` element range (measured by a div-depth
  walk, so the running state is genuinely in scope) `Jordan` occurs exactly once, no
  `.role-person-label[data-role="nog"]` survives, `#nog-round-label` still reads
  `Dual-gate review · round 1 of 5`, and the generic `.role-person-label` loop is still in
  `applyRoleLabels()`.

**Full safety-net suite:** `npm test` — **572 tests, 567 pass, 0 fail, 5 skipped**. All five skips
are pre-existing and unrelated to this slice: four `J-direct-controls-ops-ui` rows retired per
ADR-GITHUB-CI-MERGE-MODEL, and `slice-375-ac-7`, which needs the local-only branch `slice/371`.

**One order-dependent failure on the FIRST run of this fresh worktree, which Nog should know
about.** `slice-372-ac-2 untracking did not delete the files from disk` failed once, asserting
`bridge/timesheet.jsonl must still exist`. That file is gitignored volatile runtime state, so a
newly created worktree starts without it; a later test in the same run seeded it, and the file has
existed ever since. Re-running that file alone: 11/11. Re-running the whole suite: 0 fail, the
number quoted above. It is a first-run-in-a-new-worktree ordering artifact, not a regression from
this slice — my change touches no runtime state — but it is a real order dependency in that guard
and worth someone's attention separately.

**AC-reconcile** over the five new tags (`reconcile({manifest, coverage, tags})` against the two
regenerated locks): `{COVERED: 5, STALE: 0, MISSING: 0}`, workSet 0, verdict **GREEN**. Repo-wide:
54 COVERED, 0 STALE, 0 MISSING, workSet 0, **GREEN**.

## Safety-net tests

New file: `regression/direct-controls/j-panel-owner-names.test.js` (9 tests).

| Guard | What it holds |
|---|---|
| `slice-383-ac-1` | painted value + server-rendered fallback + the chip is above all three Active Build state blocks |
| `slice-383-ac-2` | the same three for Peer Review, against both its state blocks |
| `slice-383-ac-3` | both LCARS strings, halves distinct, and a light → LCARS → light round-trip on one set of chips |
| `slice-383-ac-4` | the three unmarked chips' painted values and their unchanged source text |
| `slice-383-ac-5` | one `Jordan` inside the `#postbuild-panel` range, the duplicate label gone, the round label and the generic loop intact |
| trap-1 | in LCARS `personName('rom') === ownerChip('rom')`, asserted as a precondition; the chip must equal `personName + roleTitle` and must **not** equal `personName + ownerChip` |
| trap-2 | the paint happens inside `applyRoleLabels()` via the generic `.panel-owner[data-role]` selector; both `toggleLcarsMode()` and the load-time initialiser call it; three repaints in one skin are idempotent |
| trap-3 | neither marked chip's offset falls **inside** any of the five state-block ranges, and both sit in their panel header rows |
| trap-4 | exactly two chips carry `data-with-name` and they are `rom` and `nog`; in **both** skins every unmarked chip still equals `ownerChip()` and contains no separator |

**Break-it evidence.** I set the fix aside by copying the file and restoring it from `HEAD` (not
`git stash` — that stack is shared with the other worktrees), re-ran the new file, and restored my
version, md5-verified identical. **7 of 9 went red:** `slice-383-ac-1`, `slice-383-ac-2`,
`slice-383-ac-3`, `slice-383-ac-5`, `trap-1`, `trap-2`, `trap-4`.

**`slice-383-ac-4` and `trap-3` stayed green with the fix reverted, and I am not claiming that as
evidence for them.** Both are negative guards — "nothing else changed" and "the name is not inside
a state block" — and undoing my own change cannot make either false. I forced each one's real
failure mode instead:

- **`slice-383-ac-4` / `trap-4`** — I added `data-with-name` to the `bashir` chip and gave it
  `Priya &middot; QA Engineer`, the exact collateral-rename this slice must not do. Both went red.
  Restored, md5-verified.
- **`trap-3`** — I moved the `rom` chip out of `.active-slice-label` and into `#mission-idle-text`,
  the exact "name inside one state block" the trap describes. `trap-3` **and** `slice-383-ac-1`
  went red. Restored, md5-verified.

So all nine have been observed red under a real failure; two of them under a forced failure rather
than under the revert, and Nog should read them that way.

**What I saw in the browser.** Rendered `dashboard/lcars-dashboard.html` headless (Chromium, APIs
stubbed) and drove the real states. Light mode: the Active Build header reads
**ACTIVE BUILD  SAM · FULL-STACK ENGINEER** identically with `#mission-active-content`,
`#mission-blocked-content` and `#mission-idle-text` each forced visible in turn, and Peer Review
reads **PEER REVIEW  JORDAN · REVIEWER**. Flipping to LCARS gives **ROM · BACKEND IMPLEMENTOR** and
**NOG · EVALUATOR** (with the lore tags, which light mode hides); flipping back returns the light
strings exactly. The other three chips read QA ENGINEER / DEV LEAD / DEV LEAD in light and
BASHIR / O'BRIEN / O'BRIEN in LCARS — the unchanged behaviour. With `#nog-running-state` forced
open, the panel contains one "Jordan" (the header chip) and the row underneath reads
`Dual-gate review · round 1 of 5` beside the green **reviewing** pill, unchanged. The uppercase is
CSS `text-transform`; the source strings are title-case.

## Screen hooks

I used the names the brief pre-declared. All of them exist in the shipped page.

- **ac-1** — `.active-slice-label .panel-owner[data-role="rom"]`, now also matchable as
  `.panel-owner[data-role="rom"][data-with-name]`. Visible whenever the operations page is loaded;
  its text does not change with the Active Build state. Reads `Sam · Full-Stack Engineer` in light,
  `Rom · Backend Implementor` in LCARS.
- **ac-2** — `#postbuild-panel .section-title .panel-owner[data-role="nog"]`, likewise
  `[data-with-name]`. Visible on load and while `#nog-running-state` is showing. Reads
  `Jordan · Reviewer` in light, `Nog · Evaluator` in LCARS.
- **ac-3** — `#lcars-toggle` (drives `toggleLcarsMode`, which calls `applyRoleLabels()`). Checked
  when the LCARS skin is on; `document.body.classList.contains('lcars-mode')` is the state.
- **ac-4** — `.panel-owner[data-role="bashir"]` (QA and Branches panel header) and the two
  `.panel-owner[data-role="obrien"]` chips (Backlog Queue and History section titles). Always
  visible; none carries `data-with-name`.
- **ac-5** — `#nog-running-state` (`display:none` until a review is running) and, inside it,
  `.nog-running-header` → `#nog-round-label` (`.nog-running-subtitle`). The
  `.role-person-label[data-role="nog"]` that used to sit beside the round label **no longer
  exists** — that is the criterion.

Note the CSS `text-transform: uppercase` in the LCARS-flavoured panel titles: a browser test that
reads `innerText` gets `SAM · FULL-STACK ENGINEER`, while `textContent` gets the title-case source.
Match case-insensitively.

## Tests moved or weakened

None. No existing safety-net test was moved, renamed, changed or removed; no browser test was
touched. `regression/direct-controls/j-qa-and-branches.test.js` pins the `bashir` owner chip
verbatim (`<span class="panel-owner" data-role="bashir">QA Engineer</span>`) and still passes
unchanged, because this slice deliberately left that chip alone.

## Commit

- `1754244` — S383: The panel says who is on it — Sam and Jordan, always visible.
  `dashboard/lcars-dashboard.html`, `regression/direct-controls/j-panel-owner-names.test.js`,
  `regression/COVERAGE.lock`. Carries the five `AC:` trailers.
- Second commit — this DONE report plus the regenerated `regression/AC-MANIFEST.lock`. The manifest
  is derived from the git index and the commit log, so the five new tags cannot enter it until both
  the trailers (commit 1) and this report's `## Acceptance criteria` block are staged; the full
  suite was run after that, when the tree is internally consistent.

Branch: `slice/383`, cut from `main` at `0509b78`. Not merged.

## Conflicts with the brief

None with the role file. The brief-internal tension between tasks 2 and 3 is described under
`## Summary` item 2, and the stale panel name inside `slice-383-ac-4` under item 3.
