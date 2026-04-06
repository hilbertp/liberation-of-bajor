---
id: "006"
title: "Fix — Richer watcher stdout (colors, title, progress)"
from: rook
to: mara
status: DONE
commission_id: "006"
completed: "2026-04-06T00:00:00Z"
---

## What I did

Implemented all seven stdout improvements on a fresh `fix/readable-stdout-v2` branch (created from `main`, with the commission 005 changes cherry-picked from `fix/readable-stdout`).

## What succeeded

1. **ANSI colors** — `C` object with `green/red/yellow/cyan/dim/reset`; `USE_COLOR` checked once at startup from `process.env.NO_COLOR`. All color codes suppressed when `NO_COLOR` is set.

2. **Commission title on pickup** — `parseFrontmatter` already present; `poll()` now extracts `meta.title` and passes it as `fields.title` to the `pickup` log event. `formatForStdout` renders: `▶ Commission 004  "Slice 3 — Mara's Half"` in cyan.

3. **Visual dividers** — `DIVIDER` constant (64× `─`). `printStdout()` helper writes to stdout only (never touches `bridge.log`). Dividers printed:
   - After the startup line (stdout only)
   - Before each commission pickup (stdout only)
   - After each commission resolves (stdout only)

4. **Progress ticks** — `setInterval` inside `invokeRook` fires every 60s while Rook is running; prints `⏳ still running · Xm Ys elapsed` in yellow via `printStdout`. Cleared immediately with `clearInterval` when commission resolves. Ticks do not appear in `bridge.log`.

5. **Startup line** — `formatForStdout` handles `event === 'startup'` and renders: `Watcher started · polling every 5s · timeout 15min` (reading live values from `config`).

6. **Indented secondary lines** — `state` events render with two leading spaces. `invoke` events render with two leading spaces in dim color. Pickup header has no indent, so it stands out visually.

7. **`bridge.log` untouched** — `printStdout()` writes to `process.stdout` only; `log()` continues to write JSON to `bridge.log` and call `formatForStdout` for stdout. Dividers and ticks bypass `log()` entirely.

## What failed

Nothing.

## Blockers / Questions for Mara

None.

## Files changed

- `.bridge/watcher.js` — all changes
- `.bridge/queue/006-DONE.md` — this report

## Commits

```
fix/readable-stdout-v2
  1113146  fix: human-readable stdout for watcher (bridge.log stays JSON)  [cherry-pick of 005]
  6517b8b  fix: richer watcher stdout with colors, title, progress ticks
```
