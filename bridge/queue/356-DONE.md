---
id: "356"
title: "Make Julian's drafts readable before anyone can apply them"
from: rom
to: nog
status: DONE
slice_id: "356"
branch: "slice/356"
completed: "2026-09-05T19:04:00.000Z"
tokens_in: 512000
tokens_out: 28400
elapsed_ms: 2760000
estimated_human_hours: 5.5
compaction_occurred: false
---

## What I built

A read-only path from the CHECK overlay to the draft on disk.

**Server** (`dashboard/server.js`) — `GET /api/check-test-updates/draft?tag=slice-N-ac-K`
returns one draft's source, Julian's `.rationale.txt`, and, when `COVERAGE.lock` already
carries a guard for that tag, a line diff of the draft against that guard. Four new
functions behind it: `draftDetailFor()`, `safeDraftFile()`, `liveGuardsForTag()`,
`lineDiff()` (LCS, common prefix/suffix trimmed, 800-line ceiling), plus `pickDiffTarget()`.

**Overlay** (`dashboard/lcars-dashboard.html`) — the drafted card gains a `Read the draft`
disclosure beside the existing ruling (`.utc-actions` was already flex+wrap, as the brief
said, so it dropped in without layout work, and I used the unused `.utc-btn-update` style).
It expands into: one sentence saying what the draft *is*, the rationale as prose, the diff
in collapsed hunks (3 lines of context, `⋯ N unchanged lines` between), and a
`Show the whole draft` toggle.

**Reading it did its job immediately.** The first draft I opened, `slice-348-ac-1.draft.spec.js`,
is a rewrite of the live `e2e/lcars-mode.spec.js` that is *identical except for two deleted
lines* — one of which is the `@ac-hash: slice-348-ac-1 sha256:…` trailer. Applying it would
have silently unbound that guard from its AC. That is exactly the thing nobody could see
before this slice, and it is visible now in one click (screenshot check below).

## Decisions

- **`kind` is `rewrite` or `unmatched`, never `new`.** Trap 1: `<tag>.draft.<ext>` carries no
  target path, so the code cannot know a draft is a new file — only that nothing in
  `COVERAGE.lock` claims the tag. The panel says so in those words.
- **Every live guard is named, one is marked the diff target.** `slice-350-ac-1` is guarded
  twice (a node test *and* an e2e spec). The target is picked by suite family
  (`.draft.spec.js` → the `.spec.js` guard), and the others are listed under "Also guarded by".
- **Not built on `authoringStateFor()`.** That function `unlinkSync`s `<tag>.running` as a
  side effect. Reusing it would have made the read a write and broken AC-4 on the first call.
  `draftDetailFor()` does its own `readdirSync` and touches nothing. `trap-3` pins this.
- **Path allowlist is realpath-pinned.** `safeRepoFile()` gives repo containment; I then
  re-assert the resolved *real* path is inside `regression/.drafts/`, so a symlink planted in
  the drafts dir can't read outside it either. The crew-artifact allowlist is untouched and
  still cannot reach `.drafts/`, as instructed.
- **Added `_escAttr()`.** Trap 2: `_esc()` escapes entities but not quotes. Draft source never
  goes near markup — it is set with `textContent` — and every attribute this slice interpolates
  a tag into goes through the new quote-escaping helper.
- **Made this one overlay scroll.** `.rollback-overlay` centres a fixed, non-scrolling box.
  With three flagged ACs the lower cards were *already* off-screen and unclickable, and an
  open draft guarantees it. Fixed with two rules scoped to `#test-updates-overlay` only —
  I did not touch the shared class, so the rollback and update-tests dialogs are unchanged.
  Without this the feature is unreachable for every AC but the first, so I judged it in scope.

## Safety-net tests

`regression/gate-merge/j-check-draft-review.test.js` — 8 tests, one per AC and one per trap.
Fixtures are written into the real (gitignored) `regression/.drafts/` under tags no slice uses
and removed in `after()`, the same pattern `j-check-authoring.test.js` uses. AC-2 and trap-1
derive their live-guard tag from `COVERAGE.lock` at run time rather than hard-coding one, so
retiring a guard can't turn them red for the wrong reason.

**Red-check.** I copied both changed dashboard files aside, `git checkout --`'d them, and ran
the new file. **7 of 8 went red:**

- `slice-356-ac-1` — no `draftDetailFor`, no read control
- `slice-356-ac-2` — no diff against the live guard
- `slice-356-ac-3` — no tag validation, no refusals
- `slice-356-ac-4` — no GET-only route to assert on
- `slice-356-trap-1` — no rewrite/unmatched distinction
- `slice-356-trap-2` — no `_escAttr`, no text-node rendering
- `slice-356-trap-3` — no read path that leaves `.running` alone

`slice-356-trap-4` stayed **green** on the revert, honestly: it guards a *standing* invariant
(`.gitignore` still ignores `regression/.drafts/`, nothing under it is tracked) that removing
my change cannot break. I proved it is red-able under the condition it actually guards by
`git add -f`-ing a draft — it went red — then unstaged and deleted it.

Then I restored both files. Full safety-net suite: **535 tests, 530 pass, 0 fail, 5 skipped.**

**What I saw in the browser** (headless Chromium against this branch's server on :4792, no spec
file written or committed): opened the overlay with three drafted ACs. `slice-348-ac-1` reads
"This AC is already guarded. The draft is a rewrite of `e2e/lcars-mode.spec.js`.", Julian's
rationale, then `− the live guard · + this draft — 0 added, 2 removed` over a hunked diff
showing `⋯ 11 unchanged lines`, the two red deletions, `⋯ 47 unchanged lines`.
`slice-372-ac-9` reads "No live guard carries this tag — this draft is unmatched…" with the
full source and no diff. `slice-350-ac-1` names its target guard and adds
"Also guarded by: e2e/s-numbering.spec.js". Zero page errors. I also probed injection live:
rendering a draft whose source is `</pre><script>window.__pwned=1</script>"'` and whose
rationale is `<img src=x onerror=…>` produced 0 `img`/`script` nodes, no `__pwned`, and the
payload verbatim as text.

## Tests moved or weakened

None. No test was moved, renamed, deleted or weakened. Nothing under `regression/` or `e2e/`
was edited except the addition of my own new file (trap 3 of the brief).

## Files touched

- `dashboard/server.js` — +5 functions, +1 GET route, +3 exports
- `dashboard/lcars-dashboard.html` — draft panel CSS, overlay scroll (scoped), `_escAttr()`,
  `_toggleDraft()`/`_draftCode()`/`_draftDiff()`/`_renderDraftPanel()`, drafted-card wiring
- `regression/gate-merge/j-check-draft-review.test.js` — new (8 guards)
- `regression/COVERAGE.lock`, `regression/AC-MANIFEST.lock` — regenerated (see below)

Two commits: the work (carrying the four `AC:` trailers), then the manifest rebuild.

## Notes for Nog

1. **`slice-356-ac-*` land in `AC-MANIFEST.lock` as `legacy-backfill` with `text: null`** —
   the same state `slice-380` and `slice-381` are in. The deriver sources criterion text from
   *tracked* slice files, and no `bridge/queue/356-*.md` is tracked in this worktree; step 3
   then deliberately refuses to promote a legacy tag off its trailer, because draining the
   grandfather allowlist is a human backfill (`docs/contracts/ac-custody.md`). The trailers
   *are* in history and `lib/ac-range-scan.js` reads all four, so the live CHECK gate sees the
   real text. This is the known "static-manifest rebuild on land" gap, not something I fixed
   here — flagging it rather than widening scope.
2. **No write path exists, by design and by test.** There is no apply, move or delete control.
   That is Bashir's ask and it is still unbuilt — deliberately, per this brief's framing that
   reading comes first. Whoever builds it next inherits a panel that already shows the operator
   what they would be approving.
3. **The dashboard needs a restart to deploy this** (the standing lesson from the AC-gate
   false-green: a live server running week-old code makes every fix invisible).
