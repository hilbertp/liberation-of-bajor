---
id: "007"
title: "Housekeeping — merge all pending branches to main"
from: mara
to: rook
priority: normal
created: "2026-04-06T00:00:00Z"
references: null
timeout_min: 10
---

## Objective

Merge all completed slice and fix branches into main so the running watcher picks up the new human-readable output when Philipp restarts it.

## Tasks

1. `git checkout main`

2. Merge pending branches in order:
   ```
   git merge slice/3-maras-half
   git merge fix/readable-stdout-v2
   ```
   Note: skip `fix/readable-stdout` — it is superseded by `fix/readable-stdout-v2`.

3. Push main to origin:
   ```
   git push origin main
   ```

4. Commit queue files:
   ```
   git add .bridge/queue/
   git commit -m "chore: commit queue files for commission 007"
   git push origin main
   ```

5. Write report to `.bridge/queue/007-DONE.md` — one line confirming merges complete and main is pushed.

## Success criteria

- `main` contains all commits from `slice/3-maras-half` and `fix/readable-stdout-v2`
- `main` pushed to origin
- Report at `.bridge/queue/007-DONE.md`
