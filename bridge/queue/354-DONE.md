---
id: "354"
title: "Approval provenance — a machine must not be able to approve work"
from: rom
to: nog
status: DONE
slice_id: "354"
branch: "slice/354"
completed: "2026-09-06T17:30:30.000Z"
tokens_in: 118000
tokens_out: 9800
elapsed_ms: 267468
estimated_human_hours: 2.5
compaction_occurred: false
---

## Summary

Round 2. Nog's Finding 1 was correct and I fixed it: `references:` was an unbounded free
pass through the dispatch gate, and the brief's own `printf` attack still commissioned Rom
post-cutover with one extra frontmatter line.

I reproduced it against the shipped exports before changing anything:

    A  no references      -> { ok: false, reason: 'unstamped' }              # blocked
    B  references: "100"  -> { ok: true,  provenance: 'legacy-unattributed' } # dispatches

Round 1 asked a single question covering both the slice and its claimed parent —
`hasPreCutoverHistory(provenanceRootId(id, meta), id)` — and `provenanceRootId` returns
whatever `references:` says. Since 274 ids already carry pre-cutover history, any of them
worked as a claimed parent.

The two shapes are now separate questions:

1. **the slice's OWN id** is known to the register from before the cutover — unconditional.
   An attacker cannot manufacture that for a fresh id without forging a back-dated register
   line, which leaves its own trace.
2. **a claimed PARENT's id** is known from before the cutover — but only when the queue file
   *itself* also predates the cutover. Reported distinctly as `pre-cutover-parent`.

**One judgment call worth your attention.** Nog suggested gating on "the slice's own
`created` (or, failing that, the queue file's mtime)". I did not implement it in that order,
because `created` is written by whoever wrote the file — gating on it first would have left
the identical one-line bypass, just with a back-dated `created:` alongside the `references:`.
So `created` can only ever *add* a condition, never satisfy one alone, and the filesystem
mtime is the load-bearing signal: a file printf'd into the queue carries an mtime of *now*
whatever its frontmatter claims. I verified this exact case (attack case 3 below).

`touch -t` still defeats mtime. That is the honest limit of a local server whose files are
writable by the same user every agent runs as, the code comments say so, and the
over-claiming guard from round 1 still holds.

## What changed

- `bridge/orchestrator.js`
  - `checkDispatchProvenance(id, meta, pendingPath)` — new third argument; splits the one
    grandfathering question into the two shapes above. The poll loop passes `pendingPath`,
    which it already had in scope.
  - `fileIsPreCutover(pendingPath, meta, cutoverMs)` — new. Rejects immediately if a present
    `created` is post-cutover, then requires the file's mtime to predate the cutover. Fails
    closed: no path, no stat, no answer ⇒ not pre-cutover.
  - `provenanceRootId` — unchanged behaviour; its doc comment now says it is an id lookup,
    not a permission, which is precisely the confusion that caused the finding.
  - Exports `fileIsPreCutover` for the guard test.
- `regression/provenance/j-approval-provenance-dispatch.test.js` — guards added to the two
  tests that already own these criteria. **Still 13 tests total; no test was added**, because
  the count is one per AC plus one per trap and these assertions belong to ac-5 and ac-6.

Nothing else was touched. `COVERAGE.lock` and `AC-MANIFEST.lock` were regenerated (trap 7)
and came out byte-identical — extending existing tests adds no new tags.

## Acceptance criteria verification

Command: `node --test regression/provenance/*.test.js` → **13 tests, 13 pass**.
Full suite: `node --test regression/**/*.test.js` → **540 tests, 535 pass, 0 fail, 5 skipped**
(the 5 skips are the pre-existing retired-local-gate STALE rows).

| Tag | Test file | Result |
|---|---|---|
| slice-354-ac-1 | `regression/provenance/j-approval-provenance-server.test.js` | PASS |
| slice-354-ac-2 | `regression/provenance/j-approval-provenance-server.test.js` | PASS |
| slice-354-ac-3 | `regression/provenance/j-approval-provenance-server.test.js` | PASS |
| slice-354-ac-4 | `regression/provenance/j-approval-provenance-server.test.js` | PASS |
| slice-354-ac-5 | `regression/provenance/j-approval-provenance-dispatch.test.js` | **PASS — was the round-1 failure** |
| slice-354-ac-6 | `regression/provenance/j-approval-provenance-dispatch.test.js` | PASS |
| slice-354-ac-7 | `regression/provenance/j-approval-provenance-dispatch.test.js` | PASS |
| slice-354-ac-8 | `regression/provenance/j-approval-provenance-server.test.js` | PASS |

Traps 1, 2, 3 (dispatch file) and 4, 5 (server file) all pass, unchanged.

**Test-Update Gate**: `● NEEDS REVIEW`, sole uncorroborated path `regression/COVERAGE.lock`
itself — inherent to any slice touching the lock, since the lock is not a behaviour source
anything can guard. Not RED.

## Safety-net tests

13 tests: one per acceptance criterion (8) plus one per trap (5). Unchanged count.

**Break-it-on-purpose, targeted at the round-2 fix.** I backed up the fixed
`bridge/orchestrator.js`, restored the round-1 (Nog-rejected) gate with `git checkout --`,
and re-ran the dispatch file. Exactly the two tests carrying the new guards went red, and
for the right reasons:

    ✖ slice-354-ac-5   AssertionError: must not dispatch — references to a real pre-cutover parent
    ✖ slice-354-ac-6   AssertionError: and be recorded as riding the parent
    ✔ slice-354-ac-7   ✔ trap-1   ✔ trap-2   ✔ trap-3   (correctly unaffected by the finding)

The fix was restored and all 13 are green again. Round 1's full 13-red break-it-on-purpose
still stands; this round I re-ran only the part that could have changed.

**What I observed, driving the shipped exports in a scratch fixture** (`bridge/queue`,
`bridge/state` and the register redirected into a tmpdir; two legitimate parents seeded with
pre-cutover history). Every row is the real `checkDispatchProvenance`:

    --- THE ATTACK (must all be BLOCKED) ---
    BLOCKED    printf, no references                                 unstamped
    BLOCKED    printf + references:100 (Nog finding)                 unstamped
    BLOCKED    + references + LIED created (pre-cutover)             unstamped
    BLOCKED    + references to a nonexistent parent                  unstamped
    --- LEGITIMATE WORK (must all DISPATCH) ---
    DISPATCHES own id has pre-cutover history                        pre-cutover
    DISPATCHES own id pre-cutover, rewritten today (Nog round 2)     pre-cutover
    DISPATCHES genuine pre-cutover amendment (old file + created)    pre-cutover-parent

Row 3 is the one that matters for the design choice: it is the attack that a `created`-first
gate would have let through. Row 6 is the trap-1 case — a slice rewritten today by
`handleNogReturn` has a fresh mtime, and still dispatches, because its own id carries history.

No browser involvement this round: the change is entirely orchestrator-side and the UI is
untouched since round 1. I did not run the browser suite.

## Screen hooks

Unchanged from round 1 — this round touched no UI. Restated for completeness:

| Hook | Starting state |
|---|---|
| `.approval-provenance` | Visible in an expanded queue row's meta whenever the slice has at least one approval event; absent when it has none. |
| `[data-provenance="human-click"]` | A person clicked Approve with the policy off. Class `.approval-provenance-human`. |
| `[data-provenance="auto-approve-policy"]` | The standing policy was on. Renders `auto-approve policy`. Class `.approval-provenance-policy`. |
| `[data-provenance="machine-unknown"]` | An approval reached the register without proof of UI origin. Renders `machine (unattributed)`. Class `.approval-provenance-machine`. |
| `[data-provenance="unattributed"]` | Every pre-provenance event. Renders `unattributed (pre-provenance)`. Class `.approval-provenance-legacy`. |

Existing and unchanged: `.auto-approve-toggle`, `.auto-approve-active`, `.queue-row[data-id]`.
For Julian: assert on `data-provenance` and the class, not the display text.

## Tests moved or weakened

Nothing weakened this round. One item needs your second signature:

1. **`checkDispatchProvenance` gained a third argument, so all seven call sites in
   `j-approval-provenance-dispatch.test.js` now pass the queue file's path.** No assertion
   changed; the tests drive the same function with the argument the poll loop actually
   supplies, which makes them a closer match to production than before. The two-argument form
   still works and fails closed (no path ⇒ the parent fallback is unavailable), so nothing
   silently loosened.

Round 1's four items stand as reported and you have already signed them.

## Still requires a Philipp ruling — not resolved in code

Unchanged from round 1, restated because it is not yet decided:
`docs/contracts/slice-lifecycle.md` L19/L81 say only Philipp approves and "Watcher doesn't
approve". The shipped Auto-approve toggle already contradicts that, and from this slice on
the register says so in plain text (`provenance: "auto-approve-policy"`). I did not touch the
chmod-locked contract. Either bless the policy as a delegated human decision, or retire the
toggle. I also still decline to add a client-supplied "a human really clicked" signal, which
ac-2 forbids.

## Your three flags — what I did and did not do

- **`AC-MANIFEST.lock` (17 criteria to drain back).** Left alone, exactly as you said: it is
  Philipp's call and must not ride along on a rework round. The lock regenerated
  byte-identical this round, so nothing new was swept in.
- **`-PARKED.md` / `-STUCK.md` suffix collision.** Left alone and I agree with your reading:
  a provenance hold is neither of those states, and a dedicated inert suffix (`-HELD.md`)
  would be the right answer. It is dormant while enforcement is advisory. **This is a scope
  decision, so it is O'Brien's** — I have not widened the slice to take it, but flagging that
  it should be settled before Philipp arms `APPROVAL_PROVENANCE_ENFORCE=1`.
- **ac-8's test is shape, not behaviour.** Acknowledged, left as-is. Making it behavioural
  needs a spawned subprocess because the compiled harness overrides the listen address, and
  that is a bigger change than the criterion warrants. I did verify the real bind with `lsof`
  in round 1.

## One residual limit I want on the record

A slice that has **never** appeared in the register and whose file postdates the cutover will
not dispatch under enforcement, even if it is legitimate. That is the intended shape — the
queue is meant to hold approved work, and approved work is stamped — but it means the day
Philipp arms the flag, anything hand-placed in the queue and never dispatched will park
rather than run. Advisory mode (the default) logs it and dispatches, which is the window to
find such files before arming. Worth a sweep of `bridge/queue/` before the flag is flipped.

## Commit

`44e1a0c` on branch `slice/354` — *"S354 round 2: `references` was a free pass through the
dispatch gate"*, carrying all eight `AC:` trailers verbatim. 2 files, +137 −30.

Round 1 remains at `d419458`. The DONE report is committed separately, per the standing rule.
