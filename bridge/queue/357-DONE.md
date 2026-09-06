---
id: "357"
title: "A drafted guard must be applicable by construction"
from: rom
to: nog
status: DONE
slice_id: "357"
branch: "slice/357"
completed: "2026-09-05T19:05:00.000Z"
tokens_in: 2150000
tokens_out: 33000
elapsed_ms: 1400000
estimated_human_hours: 3.5
compaction_occurred: false
---

## Acceptance criteria

- slice-357-ac-1: a newly authored draft carries a coverage annotation in the exact form the coverage map deriver recognises
- slice-357-ac-2: a draft is written only with an extension that both the suite runner and the coverage walker pick up
- slice-357-ac-3: every draft declares whether it is a new guard or replaces a named existing guard
- slice-357-ac-4: a guard test fails if any draft in the drafts directory violates the contract, and passes when the directory is empty
- slice-357-ac-5: the authoring agent's model and effort come from configuration rather than being hardcoded

## Summary

I read `scripts/build-coverage-map.js` first, because trap 2 is the whole slice: an annotation the
deriver does not parse is worse than none. Two things came out of that read that shaped the
contract.

**The deriver needs the annotation AND a tagged title.** Form-2 registration is
`for (const tag of tagsIn(src)) { if (!acHashes[tag]) continue; … }` — the tag has to appear in a
`test()` title *and* in an `@ac-hash` line. A draft carrying only the annotation registers nothing,
which looks exactly like a draft carrying it correctly. So "carries the annotation" had to mean both.

**The hash has to be the full 64 hex.** `AC_HASH_RE` accepts `sha256:[0-9a-f]{6,64}`, so a truncated
hash parses cleanly — but `lib/ac-reconcile.js` compares it to the manifest's `acHash` with `===`,
so a short hash can never read COVERED. It would classify the AC STALE forever while looking
right. The contract requires the full digest, and the authoring script now **precomputes it** from
the AC text (`acHashOf`, the same function `build-ac-manifest.js` uses) and hands the agent the
finished line to copy, rather than asking an agent to compute a sha256.

The contract lives in `lib/draft-contract.js` and imports `acHashesIn`/`tagsIn` **from the deriver
itself** instead of restating their regexes — that is the only way "the exact form the coverage map
recognises" cannot drift apart from the coverage map later.

`scripts/author-ac-test.js` then does two new things around the agent run: it instructs the contract
(annotation, tagged title, the two legal extensions, the target companion) with the hash already
filled in, and afterwards it **verifies** what came back. A draft that violates the contract is not
left behind — it is removed and its reasons plus its full source are written to
`<tag>.REJECTED.md`, and the run exits 1. Nothing the agent wrote is lost, but nothing unappliable
survives for someone to apply. Both the opening stale-artifact sweep and the rejection are strictly
tag-scoped (trap 1).

Task 5 became `lib/agent-model.js` rather than an inline read, for one reason: I wanted it testable
without spawning an agent. It reads `--model`/`--effort` out of `bridge/bridge.config.json`'s
`claudeArgs` — the same array the orchestrator spawns Rom from — and has **no built-in default**,
because `claude` without `--model` silently falls back to `ANTHROPIC_MODEL`; an authoring run at an
unknown model is worse than a loud stop.

**One thing for Philipp to rule on.** AC-4 asks for a guard that fails when any draft in the drafts
directory violates the contract. All **15** drafts on the live tree violate it (audit below). The
directory is gitignored, so this guard is green on CI and in any clean checkout, and **RED on
Philipp's working tree** until those drafts are regenerated or discarded. Per trap 1 I did not touch
them — that is the human call, and the red is what forces it. Details and the one-liner are under
*Acceptance criteria verification*.

## What changed

- **`lib/draft-contract.js`** (new, 217 lines) — the contract. `validateDraft({filename, source,
  target, expectedAcHash, repoRoot})` returns coded errors; `auditDrafts(dir, {repoRoot, ignoreTag})`
  walks a drafts directory; `annotationFor`/`parseDraftName`/`draftName`/`targetName`/
  `manifestAcHash`/`formatViolations` are the helpers around it. Error codes: `E_FILENAME`,
  `E_EXTENSION`, `E_ANNOTATION_MISSING`, `E_ANNOTATION_HASH_FORM`, `E_ANNOTATION_HASH_MISMATCH`,
  `E_TAG_NOT_IN_TITLE`, `E_TARGET_MISSING`, `E_TARGET_MALFORMED`, `E_TARGET_PATH`, `E_TARGET_EXISTS`,
  `E_TARGET_ABSENT`. Imports `acHashesIn`/`tagsIn` from `scripts/build-coverage-map.js`.
- **`lib/agent-model.js`** (new, 47 lines) — `agentModel(repoRoot, env)` → `{model, effort, source}`
  from `bridge/bridge.config.json` `claudeArgs`, overridable by `DENORIOS_AGENT_MODEL` /
  `DENORIOS_AGENT_EFFORT`. Returns nulls rather than a default so callers can refuse.
- **`scripts/author-ac-test.js`** (rewritten around the same flow) —
  - `expectedAcHash()` resolves the spec hash (AC text → `acHashOf`, else the manifest's hashed
    entry) and the run **exits 2** when neither exists: without it no appliable draft is possible.
  - the prompt gained a "THE DRAFT CONTRACT" block (A annotation, B tagged title, C extension,
    D declared target) with the exact annotation line precomputed.
  - `clearArtifacts()` — tag-scoped sweep, now including this tag's stale `*.draft.*` and
    `.target.json`, so a run's outcome is entirely that run's.
  - post-run verification + `reject()` → `<tag>.REJECTED.md`, draft removed, exit 1.
  - model/effort from `agentModel(REPO)`; the run prints which model it spawns at and where that
    came from. The hardcoded `'claude-opus-4-8', '--effort', 'high'` is gone.
  - the success line now also prints the declared target (`new file …` / `REPLACING …`).
- **`regression/gate-merge/j-draft-contract.test.js`** (new, 8 tests) — the safety net.
- **`regression/COVERAGE.lock`** — regenerated (`node scripts/build-coverage-map.js`); 542 guards
  over 52 sources, +3 keys (`lib/draft-contract.js`, `lib/agent-model.js`, and the new test file's
  own path for the five annotated tags).
- **`regression/AC-MANIFEST.lock`** — regenerated after this report was staged, so slice 357's five
  criteria enter hashed rather than legacy-backfilled. Nothing else in it moved (verified
  tag-by-tag: 0 shared entries changed).

No file under `e2e/` was added or touched.

## Acceptance criteria verification

Command for all five: `node --test regression/gate-merge/j-draft-contract.test.js` → **8/8 pass**.
Full suite: `node --test 'regression/**/*.test.js'` → **535 tests, 530 pass, 0 fail, 5 skipped**
(the 5 skips are pre-existing and untouched by this slice).

- **slice-357-ac-1** — PASS. `j-draft-contract.test.js:72`. The authoring run prints the exact line
  it requires; the test asserts it equals `annotationFor(tag, acHashOf(acText))` **and** that the
  deriver's own `acHashesIn()` extracts it. Then end-to-end with a stand-in agent: an unannotated
  draft → exit 1, no `*.draft.*` left in the directory, `<tag>.REJECTED.md` naming
  `E_ANNOTATION_MISSING` and holding the source; a contract-satisfying draft → exit 0, kept.
  Also covered: short hash → `E_ANNOTATION_HASH_FORM`, wrong hash → `E_ANNOTATION_HASH_MISMATCH`,
  annotation without a tagged title → `E_TAG_NOT_IN_TITLE`.
- **slice-357-ac-2** — PASS. `j-draft-contract.test.js:123`. `.draft.js` and `.draft.mjs` →
  `E_EXTENSION`; `.test.js`/`.spec.js` accepted. Corroborated against the real pickup mechanisms:
  `package.json`'s `node --test 'regression/**/*.test.js'` glob, `walkTests()` on a fixture tree
  (takes the `.test.js`, skips a bare `.js`), and `buildCoverageMap()` on the same tree seeing
  exactly the `.test.js` and the `.spec.js`.
- **slice-357-ac-3** — PASS. `j-draft-contract.test.js:150`. No companion → `E_TARGET_MISSING`;
  neither key / both keys / a foreign tag → `E_TARGET_MALFORMED`; wrong directory, wrong extension
  or a `..` path → `E_TARGET_PATH`; a rewrite declared as `new` → `E_TARGET_EXISTS` (this is the
  `guardCount` inflation the brief names); `replaces` naming a file that does not exist →
  `E_TARGET_ABSENT`; `{replaces: <a real guard>}` → valid.
- **slice-357-ac-4** — PASS. `j-draft-contract.test.js:184`. `auditDrafts()` on an **absent**
  directory → `[]`; on an **empty** one → `[]`; with a contract-satisfying draft → `[]`; with a
  violating one → exactly that file with its codes. It then audits the **live**
  `regression/.drafts/`, skipping the reserved `slice-99xxx` fixture range (other suites write
  fixture drafts into that same real directory and `node --test` runs files in parallel — judging
  their transients there would flake; see the memory note on drafts flaking the determinism gate).
- **slice-357-ac-5** — PASS. `j-draft-contract.test.js:243`. `agentModel(REPO_ROOT)` returns exactly
  the `--model`/`--effort` pair read out of `bridge/bridge.config.json`; a real authoring run
  announces `spawning Julian (claude-opus-5/max, from bridge/bridge.config.json claudeArgs …)`; a
  config with no model yields `{model: null, effort: null}` and a `source` naming the file; an
  explicit `DENORIOS_AGENT_MODEL`/`_EFFORT` outranks the config. Plus the regression this AC exists
  for: neither `scripts/author-ac-test.js` nor `lib/agent-model.js` may contain a quoted
  `claude-*` literal outside comments.

### Trap 1 — the 15 drafts that predate this contract

Not deleted, not rewritten. Audited read-only against `/Users/phillyvanilly/denorios/repo`:

| draft | violations |
|---|---|
| `slice-343-ac-1.draft.test.js` | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-348-ac-1.draft.spec.js` | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-349-ac-1.draft.test.js` | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-350-ac-1…4.draft.test.js` (4) | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-351-ac-1.draft.js` | **E_EXTENSION**, E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-351-ac-2…3.draft.test.js` (2) | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-352-ac-1…4.draft.test.js` (4) | E_ANNOTATION_MISSING, E_TARGET_MISSING |
| `slice-372-ac-9.draft.test.js` | E_TARGET_MISSING (the only one carrying an annotation — authored 2026-09-04) |

15 of 15 violate. The brief measured 14/14 unannotated on 2026-09-01; `slice-372-ac-9` arrived since
and carries a correct annotation but still no declared target — worth noting, because it is the one
draft whose rewrite cost is a single small file.

**Philipp's call**, not mine: regenerate (`node scripts/author-ac-test.js <tag>` now produces a
conforming draft, one opus run each) or discard
(`rm /Users/phillyvanilly/denorios/repo/regression/.drafts/*.draft.* …`). Until then the AC-4 guard
reads RED **on the working tree only** — CI and any clean checkout have no `.drafts/` directory and
go green. I did not add a grandfather list: the drafts are gitignored, so a committed allowlist
could not name them honestly, and an escape hatch here would defeat the guard on day one.

### Trap 3 — coverage derivation unchanged

`scripts/build-coverage-map.js` and `lib/tests-needed.js` are byte-identical to HEAD
(`git diff HEAD~1 --stat` lists neither). The only lock change is the regeneration my new test file
causes.

## Safety-net tests

One file, `regression/gate-merge/j-draft-contract.test.js` — 5 criterion tests + 3 trap tests, then
stop. It carries the five `@ac-hash` annotations for slice 357 (house style, matching
`j-unrun-test-dir.test.js`) and builds every *fixture* annotation at runtime so no fixture can leak
into the real lock.

| test | guards |
|---|---|
| `slice-357-ac-1 — the authoring run demands the annotation…` | slice-357-ac-1 |
| `slice-357-ac-2 — only .test.js and .spec.js are accepted…` | slice-357-ac-2 |
| `slice-357-ac-3 — a draft must declare exactly one of…` | slice-357-ac-3 |
| `slice-357-ac-4 — the audit reports every violating draft…` | slice-357-ac-4 |
| `slice-357-ac-5 — the authoring agent runs at the model configured…` | slice-357-ac-5 |
| `slice-357-ac-1 trap — an authoring run only ever touches its own tag's files` | trap 1 |
| `slice-357-ac-2 trap — a draft the contract accepts really does register…` | trap 2 |
| `slice-357-ac-4 trap — drafts still change nothing about what the map counts` | trap 3 |

**Break-it evidence.** I did not use `git stash` — the stash stack is shared across worktrees and
other sessions pop it. I moved the fix aside by hand instead, in two stages.

*Stage A — `scripts/author-ac-test.js` restored to HEAD, both new libs kept.* 3 red, 5 green:

- ✖ `slice-357-ac-1 — the authoring run demands the annotation…`
- ✖ `slice-357-ac-5 — the authoring agent runs at the model configured…`
- ✖ `slice-357-ac-1 trap — an authoring run only ever touches its own tag's files`

*Stage B — `lib/draft-contract.js` and `lib/agent-model.js` also removed (the true HEAD state).* The
file cannot load (`Cannot find module …/lib/draft-contract.js`) so all 8 are red — honest, but a
coarse signal, so I mutation-checked the 5 that stayed green in stage A. Each mutation was reverted
immediately and `git diff` confirmed clean:

| mutation | went red |
|---|---|
| drop the `EXTENSIONS` check in `validateDraft` | ✖ slice-357-ac-2 |
| drop the target-companion checks | ✖ slice-357-ac-3 |
| make `auditDrafts` never report a violation | ✖ slice-357-ac-4 |
| emit the annotation in a form the deriver does not parse | ✖ slice-357-ac-2 trap |
| let `walkTests` descend into dot-directories (drafts leak into coverage) | ✖ slice-357-ac-4 trap |

Every new test went red against the absence of what it guards. None stayed green.

What I saw in the browser: I did not look — this slice has no screen surface. What I did watch
directly is the authoring script's own output, twice, with a stand-in `claude` on PATH: an
unannotated draft printed `DRAFT REJECTED — it would register no coverage`, listed
`✗ [E_ANNOTATION_MISSING] …`, left the directory with no `.draft.*` file and a `REJECTED.md`
holding the reasons and the source; the conforming draft printed
`target: new file regression/gate-merge/j-fixture-99357.test.js` and was kept.

## Screen hooks

None. This slice changes a CLI script, two lib modules and a regression test; nothing renders.

## Tests moved or weakened

None. No existing test was moved, renamed, loosened, skipped or deleted. `regression/COVERAGE.lock`
and `regression/AC-MANIFEST.lock` were regenerated by their own derivers, not hand-edited.

## Commit

Two commits on `slice/357` (branched from `8eab218`).

`84a31ba` — code, tests and `COVERAGE.lock`:

```
S357: A drafted guard must be applicable by construction

A draft Julian authors into regression/.drafts/ could be applied, run, pass, and
register nothing in COVERAGE.lock: measured on 2026-09-01, 14 drafts carried 0
`@ac-hash` annotations. The AC then stays flagged and the only control left to
clear it is "No test needed for this AC" — a straight path from a well-meant
apply to a silently weakened suite. Fixed upstream of apply: a draft is only
written when it already carries what the suite needs to count it.

lib/draft-contract.js states the contract and imports acHashesIn/tagsIn from
build-coverage-map.js rather than restating them, so "the exact form the map
recognises" cannot drift. It requires the FULL 64-hex spec hash (the deriver's
own regex allows {6,64}, but ac-reconcile matches the manifest with ===, so a
short hash parses and never matches), the tag in a test() title (form-2
registration needs both), one of .test.js/.spec.js, and a <tag>.target.json
declaring `new` or `replaces`.

scripts/author-ac-test.js now precomputes the required annotation from the AC
text, instructs it verbatim, and VERIFIES what came back — an unappliable draft
is removed and its reasons + source preserved in <tag>.REJECTED.md. Its sweep
and its rejection are tag-scoped: the drafts that predate this contract are
untouched. Model and effort come from bridge/bridge.config.json via
lib/agent-model.js (it had been pinned to claude-opus-4-8/high since the fleet
moved to opus-5/max), with no baked-in default — an unknown model stops the run.

Coverage derivation is unchanged; only what a draft contains.

AC: slice-357-ac-1: a newly authored draft carries a coverage annotation in the exact form the coverage map deriver recognises
AC: slice-357-ac-2: a draft is written only with an extension that both the suite runner and the coverage walker pick up
AC: slice-357-ac-3: every draft declares whether it is a new guard or replaces a named existing guard
AC: slice-357-ac-4: a guard test fails if any draft in the drafts directory violates the contract, and passes when the directory is empty
AC: slice-357-ac-5: the authoring agent's model and effort come from configuration rather than being hardcoded
```

This report, in its own commit, together with the regenerated `regression/AC-MANIFEST.lock` — the
manifest deriver reads slice AC blocks out of the git **index**, so it can only be rebuilt once this
file is staged, which is why the two travel together. With it, slice 357's five criteria reconcile
`COVERED` (verified: `reconcile()` over the two committed locks returns
`{COVERED: 5, STALE: 0, MISSING: 0, LEGACY_UNHASHED: 0}`) — the annotations in the new test file
match the manifest's hashes exactly, which is the contract dogfooding itself.
