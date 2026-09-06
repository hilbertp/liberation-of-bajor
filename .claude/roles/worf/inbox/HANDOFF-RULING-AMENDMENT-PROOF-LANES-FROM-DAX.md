# Your run-count table is amended: no agent runs the suites, and a red dev files its own fix request

**From:** Taylor (Architect; legacy key `dax`)
**To:** Chris (DevOps / Release)
**Date:** 2026-09-07
**Scope:** Pipeline efficiency — ADR-PROOF-LANES (`docs/adr/ADR-PROOF-LANES.md`) amends §4 of your ruling of 2026-09-03

---

## Why this exists

Philipp measured slice 383 (13 product lines, 16.3 minutes, six full-suite runs inside Sam's
session) and ruled that agents must stop running suites and that small changes get a lighter proof.
He asked me to own the decision. Your ruling's run-count table said Sam runs the full safety-net
suite once before he hands in; that row becomes "never". Everything else in your ruling stands.

## What you're asking for

Three things, all yours:

1. **Amend the ruling record.** One line at the top of
   `.claude/roles/worf/RULING-TEST-OWNERSHIP-2026-09-03.md` pointing at the ADR, and the §4 table
   replaced by the one in ADR §3 (Sam: never; GitHub on every push to dev: once, red files a fix
   request). Philipp confirmed the direction on 2026-09-07; his words are in ADR §10.
2. **Restart the orchestrator** after slices 386 to 389 land
   (`launchctl kickstart -k gui/$(id -u)/dev.denorios.orchestrator`). They change
   `bridge/orchestrator.js`; the running daemon keeps the old template until restarted. Until then
   the six briefs carry a transitional section so they stay green under the old daemon.
3. **CI half, for your eyes:** Slice 388 makes the dashboard server turn a red ci.yml run on dev
   into a fix request in Alex's inbox and a `DEV_SUITE_RED` register event, once per commit. It
   reuses your `regression-report.js` renderer by exporting it and the artifact download already
   in `dashboard/server.js`. No workflow file changes. If you would rather the orchestrator poll
   than the server, say so before 388 is approved; the brief names the server because it already
   polls `gh` and already writes provenanced register events.

## Context you need

- The lane rule is by nature of the change, checked by Jordan, not by file path: the dashboard file
  mixes markup with 218 functions of logic. The decomposition review on my desk would make it
  mechanical later.
- Slice 391 fixes `slice-372-ac-2`, which asserts a gitignored file exists and fails in every fresh
  worktree; it cost Sam two minutes on 383. It matters for CI once Sam stops running the suite.
- Slice 387 regenerates the two lock files inside the landing commit (commit, regenerate, amend,
  then push). It also ends the lock-file merge conflicts 382 hit twice. Rollback reads
  `squash_sha`; the brief makes the amended sha the one recorded.
- The rename WIP in the main tree touches four files these slices touch; commit or stash it before
  388 to 390 are approved.

## What NOT to worry about

- Not reopening who writes which tests. Sam still writes his safety-net tests in the core lane;
  Jordan still writes nothing; Julian still writes the browser tests at his stage.
- Not asking for numbers in any contract; ADR §8 measures twenty runs first.

— Taylor
