---
id: "090"
title: "Wormhole writer-split migration"
goal: "Append-heavy multi-writer files are split into per-role files so Cowork agents and the watcher never race on the same file."
from: kira
to: obrien
priority: high
created: "2026-04-14T00:00:00Z"
references: "089"
timeout_min: 30
status: "STAGED"
---

## Objective

Migrate `bridge/timesheet.jsonl`, `bridge/anchors.jsonl`, and `bridge/tt-audit.jsonl` to a writer-split model. Each writer appends to its own per-role file. The watcher rebuilds a merged view on change. Readers use the merged view.

## Context

Full ADR: `docs/architecture/WORMHOLE-ADR.md` §Concurrency and §Slice 2.

The problem: multiple Cowork sessions (Kira, Dax, etc.) plus watcher.js may all append to the same JSONL files simultaneously. With Wormhole live, Cowork agents call `wormhole_append_jsonl` from the macOS side. Watcher appends directly. If both hit the same file at the same time, lines interleave and corrupt.

Writer-split: each writer appends to a per-role file (`timesheet-kira.jsonl`, `timesheet-watcher.jsonl`, etc.). The watcher watches all `timesheet-*.jsonl` files and on any change rebuilds `timesheet.jsonl` sorted by `ts`. Readers (Ops Center API, reports) read the merged file. No contention.

Files to split:
- `bridge/timesheet.jsonl` → `bridge/timesheet-watcher.jsonl` + `bridge/timesheet-kira.jsonl` (and any other roles that append)
- `bridge/anchors.jsonl` → `bridge/anchors-watcher.jsonl` + `bridge/anchors-kira.jsonl`
- `bridge/tt-audit.jsonl` → `bridge/tt-audit-watcher.jsonl` + `bridge/tt-audit-kira.jsonl`

The merged file (`timesheet.jsonl` etc.) is rebuilt from the per-role files — it becomes read-only output, never directly written.

Search the codebase for all current writers to each file before migrating. `bridge/slicelog.js` and `bridge/watcher.js` handle the watcher side. The Kira wrap-up skill (`skills/wrap-up/`) handles the Kira side.

## Tasks

1. Read and understand all current write points for each file:
   - `grep -rn "timesheet\|anchors\|tt-audit" bridge/ .claude/` to locate all writers and readers

2. Write `bridge/scripts/migrate-writer-split.js` — one-shot migration:
   - Reads existing `timesheet.jsonl`, `anchors.jsonl`, `tt-audit.jsonl`
   - Writes all existing entries to `timesheet-watcher.jsonl`, `anchors-watcher.jsonl`, `tt-audit-watcher.jsonl` (attributing existing history to watcher — safe assumption)
   - Does NOT delete the originals yet (safe rollback)
   - Reports: lines migrated per file

3. Run the migration: `node bridge/scripts/migrate-writer-split.js`

4. Update `bridge/slicelog.js`:
   - `appendTimesheet` now appends to `timesheet-watcher.jsonl`
   - `updateTimesheet` reads from `timesheet-watcher.jsonl`, writes back to `timesheet-watcher.jsonl`
   - Add `rebuildMerged(base)` utility that reads all `bridge/{base}-*.jsonl` files, merges by `ts`, writes `bridge/{base}.jsonl`

5. Update `bridge/watcher.js`:
   - After any write to a `*-watcher.jsonl` file, call `rebuildMerged` for that base
   - Add a file watcher (chokidar or `fs.watch`) on `bridge/timesheet-*.jsonl` to rebuild merged on external changes (i.e., when Kira appends via Wormhole to `timesheet-kira.jsonl`)

6. Update `skills/wrap-up/SKILL.md` — find the section that appends to timesheet/anchors and update the instructions to tell Kira to call `wormhole_append_jsonl` targeting `timesheet-kira.jsonl` (not `timesheet.jsonl`). Same for anchors.

7. Verify the Ops Center API (`dashboard/server.js`) reads the merged `timesheet.jsonl` — if it does, no change needed. If it reads the raw files, update to read merged.

8. Commit on branch `slice/090-writer-split`:
   ```
   feat(090): writer-split migration for timesheet, anchors, tt-audit
   ```

## Constraints

- Do not delete the original merged files — leave them as rebuilt output targets.
- Do not break the Ops Center — it must still read economics data after this change.
- Migration script is one-shot; running it twice must be idempotent (skip if already split).

## Success criteria

1. `bridge/scripts/migrate-writer-split.js` exists and runs without error.
2. `bridge/timesheet-watcher.jsonl` contains all pre-migration entries.
3. `bridge/slicelog.js` writes to `timesheet-watcher.jsonl`, not `timesheet.jsonl` directly.
4. Watcher rebuilds `timesheet.jsonl` after any `timesheet-*.jsonl` change.
5. `skills/wrap-up/SKILL.md` instructs Kira to append to `timesheet-kira.jsonl` via Wormhole.
6. Ops Center still shows economics data correctly.
7. Committed on `slice/090-writer-split`.
