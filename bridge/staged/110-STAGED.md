---
id: "110"
title: "Watcher cleanup — rename BRIEF file suffix to ARCHIVED"
goal: "Eliminate the confusing BRIEF file suffix in the watcher's internal queue state machine. The suffix was inherited from the old 'brief' terminology (now 'slice'). Rename to ARCHIVED so the queue lifecycle reads: STAGED → PENDING → IN_PROGRESS → ARCHIVED + DONE."
from: kira
to: obrien
priority: normal
created: "2026-04-15T00:00:00Z"
references: "063"
timeout_min: 20
status: "STAGED"
---

## Objective

This is Kira, your delivery coordinator. The watcher uses the `BRIEF` suffix to archive the original commission document after O'Brien finishes (`{id}-BRIEF.md`). This was set up before the Sprint 3 rename sweep (slice 073/074) that changed the user-facing term "brief" to "slice". The watcher's internal file suffixes were left unchanged — the `BRIEF` suffix now conflicts with the user-visible "slice" terminology and is actively confusing.

The queue lifecycle currently reads:
```
STAGED → PENDING → IN_PROGRESS → BRIEF (archive) + DONE (O'Brien report)
```

After this slice, it should read:
```
STAGED → PENDING → IN_PROGRESS → ARCHIVED (archive) + DONE (O'Brien report)
```

## Tasks

### Task 1 — Rename every `BRIEF` file reference in `bridge/watcher.js`

All occurrences of `BRIEF` in file path construction, file suffix checks, and log messages must change to `ARCHIVED`. Do a global find-and-replace across `bridge/watcher.js`:

- `-BRIEF.md` → `-ARCHIVED.md`
- `BRIEF.md` → `ARCHIVED.md`
- `briefArchivePath` → `archivedPath` (variable names)
- Log messages: `'from: IN_PROGRESS, to: BRIEF'` → `'from: IN_PROGRESS, to: ARCHIVED'`
- Comments mentioning "BRIEF suffix" or "BRIEF (permanent archive)" → update to "ARCHIVED"

Do NOT rename `briefContent` or `briefMeta` or other variables that refer to the slice *content* (as opposed to the file *state*). Only rename variables and strings that refer to the file suffix/state.

Do NOT rename `briefPath` variables that reference `BRIEF.md` files — these become `archivedPath` referencing `ARCHIVED.md`.

### Task 2 — Rename existing `*-BRIEF.md` files in `bridge/queue/`

All existing `{id}-BRIEF.md` files in `bridge/queue/` must be renamed to `{id}-ARCHIVED.md`. This is a one-time migration:

```bash
cd bridge/queue
for f in *-BRIEF.md; do
  mv "$f" "${f/-BRIEF.md/-ARCHIVED.md}"
done
```

Confirm the count before and after renaming. There should be no `*-BRIEF.md` files remaining after migration.

### Task 3 — Update `dashboard/server.js`

Search for any references to `-BRIEF.md` in `dashboard/server.js` (the server may serve or list these files). Update all to `-ARCHIVED.md`.

Run: `grep -n 'BRIEF' dashboard/server.js` and update each occurrence.

### Task 4 — Update comments and log output

In `bridge/watcher.js`, update any human-visible terminal output or comments that mention "BRIEF" in the file-state sense:
- The comment `// The BRIEF suffix is inert — the poll loop only looks for PENDING files.` → `// The ARCHIVED suffix is inert — the poll loop only looks for PENDING files.`
- Any print statements showing queue state that mention BRIEF

### Task 5 — Verify watcher still starts correctly

After all changes, start the watcher in dry-run / check mode to confirm it doesn't crash on startup:

```bash
node -e "require('./bridge/watcher.js')" 2>&1 | head -5
```

If that passes, do a full syntax check:

```bash
node --check bridge/watcher.js && echo "syntax OK"
node --check dashboard/server.js && echo "syntax OK"
```

## Constraints

- Do NOT rename anything related to the slice content variables (`briefContent`, `briefMeta`, `parseFrontmatter`) — these refer to the content of the document, not the file state.
- Do NOT touch the evaluator's `briefPath` references to the original AC document — wait, after this rename those references must change too. Check: the evaluator reads the original commission from `{id}-BRIEF.md` to get the acceptance criteria. After this change, it reads from `{id}-ARCHIVED.md`. Make sure ALL evaluator references to the archive file are updated.
- Do NOT change the STAGED, PENDING, IN_PROGRESS, DONE, EVALUATING, ACCEPTED, STUCK, or ERROR suffixes — only BRIEF → ARCHIVED.
- After this slice, no `*-BRIEF.md` files should exist in `bridge/queue/` and the watcher should not create any.

## Success Criteria

1. No `*-BRIEF.md` files exist in `bridge/queue/` after migration.
2. `grep -r 'BRIEF\.md' bridge/watcher.js dashboard/server.js` returns zero results.
3. `node --check bridge/watcher.js` passes.
4. `node --check dashboard/server.js` passes.
5. The watcher queue lifecycle in comments reads: `STAGED → PENDING → IN_PROGRESS → ARCHIVED + DONE`.
6. Committed on `slice/110-brief-to-archived-rename`.
