# Git Strategy — Liberation of Bajor

## The Problem

The repo lives on a FUSE mount. FUSE allows `write`, `rename`, and `read` but
**blocks `unlink` (delete)**. Git's `checkout` command uses `unlink` internally
to replace tracked files when switching branches. This means:

- `git checkout main` silently fails whenever files differ between branches.
- The watcher's pre-invocation checkout leaves stale branch files on disk.
- Disk state diverges from git state, causing feature regressions.

Additionally, Chief O'Brien (Cowork sessions) edits files directly on disk.
If those edits aren't committed before the watcher runs, they're either lost
(checkout succeeds and overwrites) or left orphaned (checkout fails, stale mix).

## Architecture: Watcher-Owned Branch Lifecycle

**The watcher is the single owner of all git operations.** No agent (Rom, Nog,
Chief O'Brien) creates, checks out, or switches branches. This is enforced
architecturally — the watcher never passes branch management instructions to
agents, and the DONE template pre-fills the branch name.

```
┌─────────────────────────────────────────────────────────────┐
│                    WATCHER (sole git owner)                  │
│                                                             │
│  NEW SLICE:                                                 │
│    1. autoCommitDirtyTree()     — save Chief O'Brien edits  │
│    2. fuseSafeCheckoutMain()    — get to clean main          │
│    3. createBranchFromMain()    — create slice/{id}          │
│    4. invoke Rom                — on the branch              │
│    5. verifyBranchState()       — post-invocation gate       │
│                                                             │
│  AMENDMENT:                                                 │
│    1. autoCommitDirtyTree()     — save any edits             │
│    2. fuseSafeCheckoutBranch()  — resume existing branch     │
│    3. invoke Rom                — on the branch              │
│    4. verifyBranchState()       — post-invocation gate       │
│                                                             │
│  MERGE:                                                     │
│    1. fuseSafeCheckoutMain()    — get to clean main          │
│    2. regressionGuard()         — check ALL files for shrink │
│    3. git merge --no-ff         — merge the branch           │
│    4. verifyWorkingTreeMatchesMain() — fix FUSE drift        │
│    5. git push origin main      — push (non-fatal on fail)   │
└─────────────────────────────────────────────────────────────┘
```

## The Rules (immutable)

### 1. FUSE-safe checkout — never rely on `git checkout`

Three FUSE-safe checkout functions, all in `bridge/watcher.js`:

- `fuseSafeCheckoutMain(id)` — checkout main
- `fuseSafeCheckoutBranch(id, branchName)` — checkout existing branch
- `createBranchFromMain(id, branchName)` — create new branch from main

All three follow the same FUSE-safe pattern:

1. Auto-commit any dirty tracked files to the current branch.
2. Diff current HEAD vs target.
3. Overwrite each differing file via `fs.writeFileSync` (truncate-in-place).
4. Move HEAD pointer via `git symbolic-ref`.
5. Reset index via `git read-tree`.
6. Verify HEAD.

### 2. Auto-commit before every operation

Before every slice invocation, branch switch, or merge, `autoCommitDirtyTree()`
commits any modified tracked files to the current branch. Uses `git add -u`
(tracked files only — no surprise additions of runtime files).

### 3. Pre-merge regression guard

Before every merge, the watcher checks ALL files changed by the branch. If any
file on the branch is significantly shorter than main's version (>15% shrinkage
for files >50 lines), the merge is **blocked**. This catches:

- Stale-base builds where Rom overwrites features.
- Truncation damage from context compaction.
- Partial writes from FUSE failures.

### 4. Post-merge verification

After every merge, `verifyWorkingTreeMatchesMain()` diffs the working tree
against HEAD. Any files that don't match are overwritten from git. This catches
FUSE-induced partial updates.

### 5. Post-invocation branch verification

After Rom finishes, `verifyBranchState()` checks:

1. HEAD is on the expected branch (not main, not detached).
2. The branch has commits ahead of main (Rom actually did work).
3. The branch's merge-base is reachable from main (not a stale fork).

### 6. Branch name sanitization

Branch names are pre-assigned by the watcher (`slice/{id}`). The DONE template
pre-fills the branch name — Rom never invents one. `sanitizeBranchName()` still
validates against `[a-zA-Z0-9._/-]` as defense-in-depth.

### 7. No `unlink` anywhere

All file removals use `fs.renameSync` to `TRASH_DIR` (a global constant).
Zero `unlinkSync` calls remain in the watcher. This prevents FUSE EPERM errors.

### 8. Main is the source of truth

- All direct edits (Chief O'Brien / Cowork sessions) must be committed to main.
- Feature branches exist only during Rom's execution.
- After merge, main must reflect all features — no work lives only on branches.

## What agents are NOT allowed to do

Rom's prompt explicitly prohibits:

- Running `git checkout`, `git branch`, `git switch`
- Creating new branches
- Switching branches

The DONE template pre-fills `branch: "slice/{id}"` — Rom just fills in the
other fields. The amendment template says "The watcher handles all git branching."

## Functions (all in bridge/watcher.js, "Git safety layer" section)

| Function | Purpose |
|----------|---------|
| `fuseSafeCheckoutMain(id)` | FUSE-safe checkout to main |
| `fuseSafeCheckoutBranch(id, name)` | FUSE-safe checkout to existing branch |
| `createBranchFromMain(id, name)` | Create new branch from main HEAD |
| `verifyBranchState(id, expected)` | Post-invocation branch verification |
| `autoCommitDirtyTree(reason)` | Commit dirty tracked files |
| `sanitizeBranchName(name)` | Validate branch name for shell safety |
| `verifyWorkingTreeMatchesMain(id, ctx)` | Post-merge disk verification |
