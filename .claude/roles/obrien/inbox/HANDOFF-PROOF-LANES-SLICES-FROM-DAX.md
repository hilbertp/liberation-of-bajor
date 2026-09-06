# Proof lanes: six slices staged by Taylor, your template changed, and one line for your stage briefs

**From:** Taylor (Architect; legacy key `dax`)
**To:** Alex (Dev Lead)
**Date:** 2026-09-07
**Scope:** Pipeline efficiency — ADR-PROOF-LANES (`docs/adr/ADR-PROOF-LANES.md`)

---

## Why this exists

Philipp measured that a 13-line dashboard change (slice 383) cost Sam 16 minutes and $5, of which
the change itself was 40 seconds. He ruled this the next change we make and asked me to write the
slices myself rather than have you re-read the decision and slice it. You keep the backlog order and
the approval flow; nothing is dispatched. This note tells you what I did in your territory.

## What you're asking for

Nothing to build. Three things to do:

1. **Order.** The six slices are staged as 386 to 391. Recommended order, which I have not written
   into `bridge/staged-order.json` (that file is Philipp's to drag): 386 (metrics), 387 (locks and
   hashes), 388 (no full suite; red dev files a fix request), 389 (lanes), 390 (gate learns the
   lane), 391 (fresh-copy guard). 390 depends on 389; the rest are independent. Philipp's word is
   that all six go before the test-ownership plumbing (363, 377, 378) and before R1 to R3.
2. **One line in your stage briefs (363, 378), before Philipp approves them:** "For a surface-lane
   slice the stage runs its machine steps only, both suites once; Julian is spawned only when a
   criterion names an interaction." Contract wording is Patch 1c in my patch document.
3. **Your future brief check (test-ownership Slice 3).** Add these phrases to the refusal list
   when you build it: "run the full suite", "run npm test", "run the safety-net suite",
   "regenerate the locks". Contract wording is Patch 2d.

## What I changed in your folder and Rom's

- `.claude/roles/obrien/slice-body-template.md`: the fixed "What Rom does not do" block now says
  Sam never runs the full suite and writes tests by lane; the task sentence has a core and a
  surface wording; traps are notes in the surface lane; the trailer block gains `Lane:`; a comment
  at the top explains `--lane`. Every brief you file from now on carries the new block, so the
  six staged slices and yours match.
- `.claude/roles/rom/ROLE.md`: run-count table (full suite: never), lane rules, lock scripts never,
  metrics left at 0, `git add -f` for the report, a transitional note until 386 and 387 are live.
- The contracts and `.claude/CLAUDE.md` are locked; the patch document for Philipp is at
  `.claude/roles/dax/drafts/contracts-2026-09-07/CONTRACT-PATCHES-PROOF-LANES.md`.

## Context you need

- `new-slice.js` gets `--lane surface|core` in Slice 389. Until it lands, write `lane:` by hand
  only if Philipp asks; a missing lane is core everywhere, which is today's behaviour.
- Every one of my six briefs is core lane (they change the orchestrator, the gate, the server).
- Each brief carries a transitional "How to finish" section: fill the metrics as the template
  demands and regenerate the two locks with two commands, because the running daemon keeps the old
  template until Chris restarts it after 386 to 389 land. Copy that section into any brief you file
  in the same window.
- The uncommitted rename work in the main tree (`bridge/new-slice.js`, `scripts/ac-reconcile.js`,
  `scripts/build-ac-manifest.js`, `scripts/regression-report.js`, plus the untracked
  `lib/roles.js` and the `nog-prompt.js` symlink) touches files 388 to 390 also touch. Whoever owns
  that WIP should commit or stash it before those three are approved.

## What NOT to worry about

- Not asking you to re-slice or re-word the six; Philipp asked me to own them. If Jordan or Sam
  finds a brief wrong, the fix request comes to me.
- Not touching your never-ask list beyond the four phrases above.
- Model A stays parked. Nothing here writes anything before the code exists.

— Taylor
