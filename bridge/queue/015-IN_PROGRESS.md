---
id: "015"
title: "Rename .bridge/ to bridge/ throughout the repo"
from: kira
to: obrien
priority: normal
created: "2026-04-06T20:00:00+00:00"
references: null
timeout_min: null
---

## Objective

This is Kira, your delivery coordinator.

Rename the hidden `.bridge/` directory to `bridge/` and update every reference to it across the entire repo. The dot-prefix was cargo-cult Unix convention — it hides the core project infrastructure from plain `ls`, which defeats inspectability.

## Context

**Repo:** `/Users/phillyvanilly/The Liberation of Bajor/repo/`
**Your anchor:** `repo/.claude/CLAUDE.md`

The directory to rename: `repo/.bridge/` → `repo/bridge/`

`.git/` and `.claude/` stay hidden — those have legitimate reasons (git convention and Claude Code tooling convention respectively). Only `.bridge/` moves.

## Tasks

1. **Create branch** `slice/8-unhide-bridge` from `main`.

2. **Rename the directory on disk:**
   ```bash
   git mv .bridge bridge
   ```
   This stages the rename for git correctly.

3. **Update all path references** in these files (replace every occurrence of `.bridge/` or `'.bridge'` or `".bridge"` with the unhidden equivalent):

   - `bridge/watcher.js` — references to `'.bridge/'`, `".bridge/"`, or `__dirname`-relative paths that assumed the old name. Check the `REPO_ROOT`, `QUEUE_DIR`, `HEARTBEAT_FILE`, `LOG_FILE`, and config-loading logic. Also update any `console.log` / `print()` strings that say `.bridge`.
   - `bridge/bridge.config.json` — check for any self-referential paths.
   - `dashboard/server.js` — references `REPO_ROOT` and `QUEUE_DIR` which are derived from `__dirname` + `'../.bridge/...'`. Update those.
   - `KIRA.md` — the file paths table in section C and any other references.
   - `CLAUDE.md` (at `repo/.claude/CLAUDE.md`) — update any `.bridge/` paths O'Brien uses as anchors.
   - `docs/` — scan all markdown files under `docs/` for `.bridge/` references.
   - `docs/kira/commission-watcher-task.md` — contains the scheduled-task template with hardcoded `repo/.bridge/queue/` paths. Update to `repo/bridge/queue/`.
   - `.bridge/templates/commission.md` and `report.md` — these move to `bridge/templates/` as part of the `git mv`. Check if they contain any self-referential paths.

4. **Search for any remaining `.bridge` references** before committing:
   ```bash
   grep -r '\.bridge' . --include='*.md' --include='*.js' --include='*.json' \
     --exclude-dir='.git' --exclude-dir='node_modules'
   ```
   Fix any found. The only acceptable remaining `.bridge` string is inside queue files that are historical records (the DONE/ERROR files in `bridge/queue/` that were written before this rename — do not modify those).

5. **Update KIRA.md** section K: note Slice 8 accepted, update next commission ID to `016`, update the open flags to remove the dashboard-server note if resolved.

6. **Commit all changes** on `slice/8-unhide-bridge`. Commit message: `refactor: rename .bridge/ to bridge/ for inspectability`. Include `bridge/queue/015-DONE.md` in the commit.

7. **Write DONE report** to `bridge/queue/015-DONE.md` (note: the file is now under `bridge/`, not `.bridge/`). Use `repo/.bridge/templates/report.md` as the template — but since the directory has been renamed, it will now be at `repo/bridge/templates/report.md`.

## Constraints

- Do not rename or touch `.git/` or `.claude/`.
- Do not modify the content of historical queue files (002-DONE.md through 014-DONE.md). They may contain `.bridge/` strings — leave them as-is, they are permanent records.
- The watcher must still pass `node --check bridge/watcher.js` after the rename.
- Do not change any logic — this is a pure rename + find/replace.

## Success criteria

1. `bridge/` directory exists; `.bridge/` does not.
2. `node --check bridge/watcher.js` passes.
3. `grep -r '\.bridge' . --include='*.js' --include='*.json'` (excluding `.git`) returns no matches outside historical queue files.
4. `grep -r '\.bridge' . --include='*.md'` returns matches only inside `bridge/queue/` historical records, not in any doc or template file.
5. Dashboard `server.js` correctly resolves `QUEUE_DIR` and `HEARTBEAT_FILE` from the new path.
6. All changes committed to `slice/8-unhide-bridge`. No uncommitted changes.
7. `bridge/queue/015-DONE.md` present and committed.
