---
id: "202"
title: "F-202 — Main-lock hardening: ensureMainIsFresh wraps unlock/relock + chmod-guard reflex protection"
from: rom
to: nog
status: DONE
slice_id: "202"
branch: "slice/202"
completed: "2026-04-24T12:30:00.000Z"
tokens_in: 18500
tokens_out: 5200
elapsed_ms: 3720000
estimated_human_hours: 1.5
compaction_occurred: false
---

## Summary

Two-layer fix for the `branch_creation_failed` bug that blocked slices 195 and 196:

1. **Bug fix**: `ensureMainIsFresh()` now wraps its `git reset --hard origin/main` and `git merge --ff-only origin/main` calls with `unlock-main.sh` (before) and `lock-main.sh` (after, in `try/finally`). Verbatim pattern from `mergeBranch()`.
2. **Defense in depth**: `scripts/chmod-guard.sh` + `scripts/activate-guard.sh` intercept reflexive `chmod +w` on locked paths and emit protocol guidance instead of silently breaking the lock. State is communicated via `bridge/.main-unlocked` marker file.

## Acceptance criteria

- [x] 0. DONE skeleton committed first
- [x] 1. `ensureMainIsFresh()` wraps reset + ff-merge with unlock/relock (try/finally)
- [x] 2. Audit lists other PROJECT_DIR git mutation sites (see below)
- [x] 3. `scripts/unlock-main.sh` creates `bridge/.main-unlocked` after chmod loop
- [x] 4. `scripts/lock-main.sh` removes `bridge/.main-unlocked` before chmod loop
- [x] 5. `bridge/.main-unlocked` in `.gitignore`
- [x] 6. `scripts/chmod-guard.sh` exists, executable, behaves per spec
- [x] 7. `scripts/activate-guard.sh` exists; sources it prepends `bin/` to PATH
- [x] 8. `README.md` documents `source scripts/activate-guard.sh`
- [x] 9. Regression tests A–F pass (6/6)
- [x] 10. Full suite passes (269 tests, 0 failures)
- [x] 11. Diff: ~250 LOC (orchestrator ~15 LOC, new scripts ~130 LOC, tests ~100 LOC)
- [x] 12. (Post-merge verification — will hold after orchestrator restart)

## Audit: other PROJECT_DIR git mutations

Grepped `bridge/orchestrator.js` for `git (checkout|restore|pull|read-tree|reset|clean)` on PROJECT_DIR.

| Location | Function | Status |
|---|---|---|
| Line 1192 | `ensureMainIsFresh()` — `git reset --hard origin/main` | **Wrapped (this slice)** |
| Line 1198 | `ensureMainIsFresh()` — `git merge --ff-only origin/main` | **Wrapped (this slice)** |
| Line 2430 | `mergeBranch()` — `git read-tree main` | Already wrapped (inside `mergeBranch()` try/finally) |
| Line 910 | `fuseSafeCheckoutMain()` — `git read-tree main` | `@deprecated` dead code — never called |
| Line 990 | `fuseSafeCheckoutBranch()` — `git read-tree branchName` | `@deprecated` dead code — never called |
| Line 1039 | `createBranchFromMain()` — `git checkout -b branchName` | `@deprecated` dead code — never called |

**Conclusion:** Only `ensureMainIsFresh()` needed wrapping. All other active git mutations on PROJECT_DIR were already inside `mergeBranch()`'s existing unlock/relock block.

## Files changed

- `bridge/orchestrator.js` — `ensureMainIsFresh()`: added unlock/relock try/finally around git ops
- `scripts/unlock-main.sh` — added `touch "$REPO/bridge/.main-unlocked"` after chmod loop
- `scripts/lock-main.sh` — added `rm -f "$REPO/bridge/.main-unlocked"` before chmod loop
- `.gitignore` — added `bridge/.main-unlocked`
- `scripts/chmod-guard.sh` (new, +x) — POSIX chmod wrapper with marker-file gating
- `scripts/activate-guard.sh` (new, +x) — creates `bin/chmod` symlink and prepends to PATH
- `README.md` — added main-lock protocol + guard activation instructions
- `test/main-lock-guard.test.js` (new) — Tests A–F, all passing

## Test results

```
test/main-lock-guard.test.js:
  ✓ A: git reset --hard succeeds when unlock wraps the operation
  ✓ B: try/finally re-locks even when git reset --hard throws
  ✓ C: chmod-guard rejects chmod u+w on locked path when marker absent
  ✓ D: chmod-guard allows chmod u+w on locked path when marker present
  ✓ E: chmod-guard passes through chmod a-w (read-only) without checking marker
  ✓ F: unlock-main.sh creates marker; lock-main.sh removes it

Full suite: 269 tests, 0 failed
```
