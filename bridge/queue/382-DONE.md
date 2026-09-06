---
id: "382"
title: "Rename the DevOps Station panel to \"QA and Branches\""
from: rom
to: nog
status: DONE
slice_id: "382"
branch: "slice/382"
completed: "2026-09-05T18:20:00.000Z"
tokens_in: 171000
tokens_out: 12400
elapsed_ms: 660000
estimated_human_hours: 1.5
compaction_occurred: false
---

# Rename the DevOps Station panel to "QA and Branches"

## Acceptance criteria

- slice-382-ac-1: the first operations panel is titled "QA and Branches", naming what the panel shows rather than a job function
- slice-382-ac-2: the accessible labels for the panel and its collapsed state use the same name as the visible title
- slice-382-ac-3: the owner chip and the lore tag are unchanged, and no class name, element id or data-role attribute is renamed
- slice-382-ac-4: the acceptance criterion that pinned the previous name states the new name, carried by the authorised change declaration

## Summary

Renamed the first operations panel from **DevOps Station** to **QA and Branches** — the name now
says what the panel shows (the QA gate sequence and the branch topology) instead of naming a job
function that the owner chip already carries.

Order of work: read the AC-custody machinery first (`scripts/build-ac-manifest.js`,
`lib/ac-block.js`, `lib/ac-reconcile.js`) to find out *how* a live criterion is legitimately
restated, because trap 1 turns on it. The manifest takes an AC's text from the `AC:` commit
trailers in history (newest declaration wins, `--reverse`), with the slice file's
`## Acceptance criteria` block as a fallback — so restating `slice-340-ac-1` means emitting a new
`AC:` trailer for it, not rewriting `bridge/queue/340-DONE.md`. The historical DONE report of
slice 340 is a permanent record and was left untouched.

Then: the three visible/accessible surfaces in the dashboard, the stale comments inside that same
file (permitted by trap 3), the restated `slice-340-ac-1` guard plus its `@ac-hash`, seven new
safety-net tests, and the two derived locks.

Two decisions worth Nog's eye:

1. **The restated text keeps both halves of the original intent.** `slice-340-ac-1` now reads
   *the first operations panel is titled "QA and Branches", not "Branch Topology"*. I kept the
   `not "Branch Topology"` clause verbatim: that clause *is* the criterion's intent — the panel is
   named for what it shows, never for the data structure it draws. Dropping it would have quietly
   narrowed a live check while pretending to restate it. The criterion is restated, not retired.
2. **Two commits, not one.** The AC manifest is derived from `git log HEAD`, so the restated
   criterion cannot appear in `regression/AC-MANIFEST.lock` until the commit carrying the trailer
   exists. Commit A carries the code, the tests and `COVERAGE.lock`; commit B carries the
   regenerated `AC-MANIFEST.lock`. The full safety-net suite was run once, after B, when the tree
   is internally consistent.

## What changed

- `dashboard/lcars-dashboard.html:6439` — visible title `DevOps Station` → `QA and Branches`
  (the `.topo-panel-title` text node only; the nested `lore-tag` and `panel-owner` spans are
  byte-identical).
- `dashboard/lcars-dashboard.html:6442` — collapse button `aria-label="Toggle DevOps Station panel"`
  → `"Toggle QA and Branches panel"`.
- `dashboard/lcars-dashboard.html:6474` — collapsed mini-view SVG
  `aria-label="DevOps Station collapsed"` → `"QA and Branches collapsed"`.
- `dashboard/lcars-dashboard.html` — eight code comments that named the panel updated to the new
  name (lines 2075, 2303, 6433, 7943, 8374, 10405, 11557, 11736). Permitted by trap 3; done so no
  stale label survives in the file that owns the panel.
- `regression/direct-controls/j-devops-station.test.js:17-28` — the `slice-340-ac-1` guard restated
  for the new name and **tightened**: it now anchors on `class="topo-panel-title">QA and Branches<`
  instead of matching `DevOps Station` anywhere in the file, so a comment can no longer satisfy the
  criterion. Its `@ac-hash` annotation moved to the restated spec's hash
  (`sha256:15ed4877…`, was `sha256:54145d8a…`).
- `regression/direct-controls/j-qa-and-branches.test.js` — **new**, seven safety-net tests
  (four criteria + three traps).
- `regression/COVERAGE.lock` — regenerated (`node scripts/build-coverage-map.js`); 527 → 532 guards.
- `regression/AC-MANIFEST.lock` — regenerated (`node scripts/build-ac-manifest.js`) so
  `slice-340-ac-1` carries the restated text and its new hash.

Nothing under `e2e/` was touched. `e2e/devops-station.spec.js` is byte-identical to `HEAD`
(verified by md5 against `git show HEAD:e2e/devops-station.spec.js`).

## Acceptance criteria verification

Command for all four: `node --test regression/direct-controls/j-qa-and-branches.test.js`

- **slice-382-ac-1** — PASS. The `.topo-panel-title` text node is exactly `QA and Branches`, and its
  offset in the document precedes every `active-slice-label` / `section-title` / `inv-panel-title`,
  so it is provably the *first* operations panel. It is neither the old job-function label nor
  `Branch Topology`.
- **slice-382-ac-2** — PASS. Both accessible labels are checked *against the visible title read out
  of the same file*, not against a hardcoded string: the collapse button reads
  `Toggle QA and Branches panel` and the collapsed SVG reads `QA and Branches collapsed`.
- **slice-382-ac-3** — PASS. `<span class="lore-tag"> (Infirmary)</span>` and
  `<span class="panel-owner" data-role="bashir">QA Engineer</span>` match verbatim, and all eleven
  selector hooks (`topo-panel`, `topo-panel-head`, `topo-head-text`, `topo-panel-title`,
  `topo-collapse-btn`, `topo-panel-body`, `topo-mini`, `data-role="bashir"`, plus the ids) are
  still present.
- **slice-382-ac-4** — PASS. `AC-MANIFEST.lock.byTag['slice-340-ac-1'].text` reads
  *the first operations panel is titled "QA and Branches", not "Branch Topology"* — active,
  non-legacy, hashed — and the guard's `@ac-hash` annotation equals the manifest's `acHash`, so
  AC-reconcile reads COVERED rather than STALE. The change is carried by the authorised
  declaration in commit A (`AC-Change-OK: slice-340-ac-1 mutated …` + `Spec-Owner: Philipp`).

Full safety-net suite: `npm test` — **534 tests, 529 pass, 0 fail, 5 skipped**. All five skips are
pre-existing and documented (four retired-local-gate journey rows per ADR-GITHUB-CI-MERGE-MODEL,
and `slice-375-ac-7`, which needs the local-only branch `slice/371`); none is mine.

AC-reconcile over the five affected tags (`lib/ac-reconcile.js` against the two regenerated locks):
`slice-340-ac-1` and `slice-382-ac-1..4` all read **COVERED**, workSet 0, verdict **GREEN**.

## Safety-net tests

New file: `regression/direct-controls/j-qa-and-branches.test.js` (7 tests).

| Guard | What it holds |
|---|---|
| `slice-382-ac-1` | the `.topo-panel-title` text node is `QA and Branches`, and it is the first panel title in the document |
| `slice-382-ac-2` | both aria-labels are compared to the *visible title parsed from the same file*, so a half-done rename fails |
| `slice-382-ac-3` | the owner chip + lore tag match verbatim; eleven class/id/data-role hooks still exist |
| `slice-382-ac-4` | the manifest text for `slice-340-ac-1` names the new panel, and the guard's `@ac-hash` is in sync with it |
| trap-1 | `slice-340-ac-1` is still `active` + non-legacy + guarded, still carries `not "Branch Topology"`, and its `acHash` has *moved off* the superseded spec — restated, never retired |
| trap-2 | `e2e/devops-station.spec.js` still exists at that exact path, and no `e2e/*qa-and-branches*.spec.js` was invented |
| trap-3 | no `DevOps Station` survives anywhere in `dashboard/lcars-dashboard.html` (the permitted half), and the two `subject: 'DevOps Station'` commit-log fixtures inside Julian's spec are still exactly as he wrote them (the forbidden half) |

**Break-it evidence.** I reverted the fix (`git checkout --` on `dashboard/lcars-dashboard.html`
and `regression/direct-controls/j-devops-station.test.js`) and re-ran the new file. **6 of 7 went
red:** `slice-382-ac-1`, `slice-382-ac-2`, `slice-382-ac-3`, `slice-382-ac-4`, `trap-1`, `trap-3`.

**`trap-2` stayed green with the fix reverted, and I am not claiming it as break-it evidence for
the revert.** It is a boundary guard, not a behaviour guard: it asserts I did *not* do a forbidden
thing (edit, rename or replace Julian's browser spec), and undoing my own change cannot make that
false. So I forced its real failure mode instead — I renamed `e2e/devops-station.spec.js` to
`e2e/qa-and-branches.spec.js`, confirmed `trap-2` went red, then restored the file and verified it
is byte-identical to `HEAD`. That is the evidence for trap-2; it is not hollow, but it is red for a
different reason than the other six and Nog should read it that way.

**What I saw in the browser:** loaded the dashboard headless with the APIs stubbed. The first panel
reads **QA AND BRANCHES** (LCARS-style uppercase comes from CSS `text-transform`, the source string
is title-case), with the **QA ENGINEER** chip beside it and the Gate sequence below — exactly the
panel the rename was meant to relabel. `#topo-collapse-btn` reported
`aria-label="Toggle QA and Branches panel"` and the collapsed `#topo-mini` SVG reported
`aria-label="QA and Branches collapsed"`. The lore tag is still ` (Infirmary)` in the DOM and stays
hidden in light mode, as it should.

## Screen hooks

Both hooks the brief named exist as named (line numbers shifted from the brief's `:6423`/`:6426`/
`:6458` — the file had moved on; the elements are the same ones):

- **ac-1 panel title** — `.topo-panel-title`, the first child of `.topo-head-text` inside
  `#topo-panel > .topo-panel-head`, at `dashboard/lcars-dashboard.html:6439`. Visible whenever the
  operations page is loaded and the panel is expanded. Reads `QA and Branches`; the lore tag and
  owner chip are nested spans *inside* it and are not part of the name.
- **ac-2 collapsed state** — `#topo-collapse-btn` (`aria-label="Toggle QA and Branches panel"`) at
  `:6442`, always present in the panel header; and the SVG inside `#topo-mini`
  (`role="img"`, `aria-label="QA and Branches collapsed"`) at `:6474`, visible only once the panel
  is collapsed via the chevron.
- **ac-3** — `.panel-owner[data-role="bashir"]` (text `QA Engineer`) and `.lore-tag` (text
  ` (Infirmary)`, shown in LCARS/dark mode only), both nested inside `.topo-panel-title`.

## Tests moved or weakened

- `regression/direct-controls/j-devops-station.test.js` — the `slice-340-ac-1` guard was **moved,
  not weakened**: re-pointed at the new panel name and made *stricter* (an anchored
  `class="topo-panel-title">QA and Branches<` match replaces a file-wide `/DevOps Station/`
  match, and the `not "Branch Topology"` assertion is unchanged). Its `@ac-hash` moved with the
  restated spec. Declared by
  `AC-Change-OK: slice-340-ac-1 mutated …` + `Spec-Owner: Philipp` in commit A.
- `e2e/devops-station.spec.js` — **not edited by me.** It still asserts the old name at line 41
  (`getByText('DevOps Station')`) and **will fail against this branch until Julian updates it.**
  Declared with the file-path override
  `Test-Loosen-OK: e2e/devops-station.spec.js reworded …` in commit A so the gate reads it as a
  declared mismatch rather than a weakened check. **This is Julian's to update at his stage.**
- No safety-net test was loosened, skipped or deleted. `COVERAGE.lock` grew (527 → 532), so no
  `Coverage-Removed` trailer is due.

## Conflicts with the brief

Two things O'Brien should know; neither changed what I built.

1. **The squash to dev drops the two declarations.** `squashSliceToDev` in `bridge/orchestrator.js`
   (~line 7540) harvests only `AC:` trailers from the branch into the squash message — it does not
   carry `AC-Change-OK:`, `Spec-Owner:` or `Test-Loosen-OK:`. Both declarations this brief ordered
   me to carry therefore exist on `slice/382` but will be **absent from the squash commit on dev**,
   so the promote-time gate over `origin/main..origin/dev` can see the `slice-340-ac-1` mutation as
   `acMutatedUndeclared` (RED) with the authorisation nowhere in range. It is not mine to fix in a
   rename slice, and I did not widen scope to fix it — but it means this slice may need Philipp's
   second-ack at the promote checkpoint, or a follow-up slice teaching the squash to propagate the
   override trailers. **I deliberately did not write a safety-net test asserting those trailers are
   in history**, precisely because it would pass here and go red on dev for a reason unrelated to
   this rename.
2. **Stale name outside the panel's own file.** `docs/HOW-A-SLICE-TRAVELS.md` still calls the panel
   "DevOps Station" twice (lines 16 and 95), and the guard file is still named
   `j-devops-station.test.js`. Both are outside the brief's five tasks so I left them; renaming the
   guard file would also churn `COVERAGE.lock` for no user-visible gain (task 4's reasoning). Worth
   a follow-up if O'Brien wants the name fully drained.

## Commit

Two commits on `slice/382`, in this order (the manifest is derived from `git log HEAD`, so the
trailer has to exist before the lock can carry it):

**A — `8eac80f`** `S382: Rename the DevOps Station panel to "QA and Branches"` — the code, the
restated guard, the new safety-net file and `COVERAGE.lock`. Full message:

```
S382: Rename the DevOps Station panel to "QA and Branches"

The first operations panel is named for what it SHOWS — the QA gate sequence and the
branch topology — instead of a job function the owner chip already carries. The visible
title, the collapse button's accessible label and the collapsed mini-view's SVG label all
move together, so a screen reader and the screen agree.

The criterion that pinned the old name (slice-340-ac-1) is RESTATED, not retired: it keeps
its "not Branch Topology" half, because that clause is the intent — the panel is named for
what it shows, never for the data structure it draws.

Class names, element ids and data-role attributes are untouched; tests select by those.
e2e/devops-station.spec.js still asserts the old name and is Julian's to update at his stage.

Slice-Id: 382
Slice-Branch: slice/382
AC: slice-340-ac-1: the first operations panel is titled "QA and Branches", not "Branch Topology"
AC: slice-382-ac-1: the first operations panel is titled "QA and Branches", naming what the panel shows rather than a job function
AC: slice-382-ac-2: the accessible labels for the panel and its collapsed state use the same name as the visible title
AC: slice-382-ac-3: the owner chip and the lore tag are unchanged, and no class name, element id or data-role attribute is renamed
AC: slice-382-ac-4: the acceptance criterion that pinned the previous name states the new name, carried by the authorised change declaration
AC-Change-OK: slice-340-ac-1 mutated the panel is renamed to "QA and Branches" on the operator's instruction
Spec-Owner: Philipp

Test-Loosen-OK: e2e/devops-station.spec.js reworded panel title changed to "QA and Branches"; the browser test is Julian's to update at his stage

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**B — tip of `slice/382`** `S382: regenerate AC-MANIFEST.lock for the restated slice-340-ac-1` — the derived
lock, plus the suite results in this report.
