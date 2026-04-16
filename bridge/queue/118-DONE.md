---
id: "118"
title: "Feat(watcher): migrate to git worktrees — dashboard locked on main"
from: rom
to: nog
status: DONE
slice_id: "118"
branch: "slice/118"
completed: "2026-04-16T00:45:00.000Z"
tokens_in: 185000
tokens_out: 28000
elapsed_ms: 900000
estimated_human_hours: 4.0
compaction_occurred: false
---

## Summary

Migrated the watcher from `git checkout`-based branch switching to git worktrees. PROJECT_DIR now stays on `main` permanently. Each slice gets its own worktree at `/tmp/ds9-worktrees/{id}/`, keeping the dashboard HTML stable.

## Changes made

### Part 1: Worktree-based slice execution
- Added `WORKTREE_BASE` constant (`/tmp/ds9-worktrees`)
- Added `getWorktreePath(id)` helper
- Added `createWorktree(id, branchName)` — handles both new branches (`-b` from main) and existing branches (amendments). Detects and prunes stale worktrees when a branch is already checked out elsewhere.
- Replaced `fuseSafeCheckoutMain()` + `createBranchFromMain()` in `invokeRom()` with single `createWorktree()` call
- Changed `cwd` in the Claude `execFile` call from `PROJECT_DIR` to `worktreePath`
- DONE report path now points into worktree; after Rom exits, copied back to `PROJECT_DIR/bridge/queue/`

### Part 2: Worktree-based evaluation (Nog)
- `invokeEvaluator()` now resolves the worktree path for the slice being evaluated
- If the worktree was cleaned up, recreates it from the slice branch
- Falls back to `PROJECT_DIR` if worktree creation fails
- `cwd` for Nog's `execFile` set to `evalWorktreePath`

### Part 3: FUSE-safe merge via worktree
- Rewrote `mergeBranch()`:
  1. Merges main into slice branch inside the worktree (local FS, no FUSE)
  2. `git update-ref refs/heads/main {newSha}` to fast-forward main
  3. `fs.copyFileSync` for each changed file from worktree → PROJECT_DIR
  4. `git read-tree main` to update the index
- Kept truncation guard (runs `git diff`/`git show` — no checkout needed)
- Kept `verifyWorkingTreeMatchesMain()` as post-merge safety net

### Part 4: FUSE-safe cleanup
- Added `cleanupWorktree(id, branchName)`:
  - `fs.rmSync` the worktree dir at `/tmp/ds9-worktrees/{id}/` (local FS)
  - `git worktree prune` to deregister
  - FUSE-safe rename of `.git/worktrees/{id}/` → `.dead`
  - FUSE-safe rename of branch ref → `.dead`
- Added `cleanupDeadWorktrees()` — startup scan removes `.dead` entries and orphaned worktree dirs
- Cleanup called at startup before crash recovery

### Part 5: Deprecated old functions
- `autoCommitDirtyTree()` — marked `@deprecated`, not called from any active path
- `fuseSafeCheckoutMain()` — marked `@deprecated`, not called from any active path
- `fuseSafeCheckoutBranch()` — marked `@deprecated`, not called from any active path
- `createBranchFromMain()` — marked `@deprecated`, not called from any active path

### Part 6: Rejection requeue with worktree reuse
- `createWorktree()` detects existing worktree for the same ID and reuses it
- Worktrees are NOT destroyed after Nog's AMENDMENT_NEEDED verdict (kept alive for retry)
- Worktrees ARE destroyed at terminal states: ACCEPTED+merged (`handleAccepted`) and STUCK (`handleStuck`)
- Added priority sorting in `poll()`: PENDING files with `type: amendment` or non-null `references` sort before fresh slices

### Part 7: verifyBranchState updated
- Now accepts optional `cwd` parameter
- Post-invocation check runs against the worktree, not PROJECT_DIR

## Verification

- `node -c bridge/watcher.js` — syntax clean
- `grep` for deprecated function calls shows zero active callsites
- All internal calls between deprecated functions are within their own bodies only
- 360 insertions, 76 deletions in watcher.js
