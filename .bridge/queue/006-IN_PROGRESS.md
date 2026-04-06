---
id: "006"
title: "Fix — Richer watcher stdout (colors, title, progress)"
from: mara
to: rook
priority: normal
created: "2026-04-06T00:00:00Z"
references: "005"
timeout_min: 10
---

## Objective

Make the watcher terminal output genuinely informative for Philipp watching it live. Commission 005 gave us a readable format — this commission makes it rich: ANSI colors, commission title, live progress ticks while Rook is running, visual dividers between commissions, and a clear summary when each commission resolves.

---

## Context

Current stdout looks like:
```
[Bridge] 23:53:57  startup    Watcher started
[Bridge] 23:53:57  pickup     004  Commission picked up (004-PENDING.md)
[Bridge] 23:53:57  state      004  PENDING → IN_PROGRESS
[Bridge] 23:53:57  invoke     004  claude -p started (timeout: 15min)
[Bridge] 23:56:12  complete   004  Done in 2m 14s ✓
[Bridge] 23:56:12  state      004  IN_PROGRESS → DONE
```

Target — what Philipp should see:

```
[Bridge] 02:49:27  Watcher started · polling every 5s · timeout 15min
──────────────────────────────────────────────────────────────
[Bridge] 02:53:57  ▶ Commission 004  "Slice 3 — Mara's Half"
[Bridge] 02:53:57    PENDING → IN_PROGRESS
[Bridge] 02:53:57    claude -p invoked (timeout: 15min)
[Bridge] 02:54:57    ⏳ still running · 1m 0s elapsed
[Bridge] 02:55:57    ⏳ still running · 2m 0s elapsed
[Bridge] 02:56:12  ✓ Commission 004 complete · 2m 14s
──────────────────────────────────────────────────────────────
```

Errors:
```
[Bridge] 02:53:57  ✗ Commission 004 failed · exit 1 · 0m 42s
```

---

## Tasks

### Branch

1. Create branch `fix/readable-stdout-v2` from `main` (NOT from `fix/readable-stdout` — that branch hasn't been merged yet; cherry-pick or re-apply the 005 changes if needed, but check git status first — main may already have them if merged).

### Implement the improvements in `watcher.js`

2. **ANSI colors** — no external deps; use raw escape codes:
   - Green (`\x1b[32m`) for ✓ success
   - Red (`\x1b[31m`) for ✗ errors and failures
   - Yellow (`\x1b[33m`) for ⏳ in-progress ticks
   - Cyan (`\x1b[36m`) for ▶ commission pickup header
   - Dim (`\x1b[2m`) for state transitions and secondary lines
   - Reset (`\x1b[0m`) always at end of colored segment
   - Honor `NO_COLOR` env var: if `process.env.NO_COLOR` is set, strip all color codes

3. **Commission title in pickup** — `parseFrontmatter` is already available; use it to extract the `title` field and show it next to the ID on the pickup line. Example: `▶ Commission 004  "Slice 3 — Mara's Half"`

4. **Visual dividers** — print a full-width `─` line (64 chars) on stdout (NOT to bridge.log) at:
   - Startup (after the startup line)
   - When a commission starts (before the pickup line)
   - When a commission resolves (after the complete/error line)

5. **Progress ticks while Rook is running** — add an independent `setInterval` inside `invokeRook` (or at the poll level) that fires every 60s while a commission is in progress and logs a `⏳ still running · Xm Ys elapsed` line to stdout only (NOT to bridge.log). Clear/cancel the interval when the commission resolves.

6. **Startup line** — show poll interval and timeout in human-readable form on startup:
   `Watcher started · polling every 5s · timeout 15min`

7. **Cleaner state lines** — indent secondary lines (state transitions, invoke) with two spaces so the pickup header stands out:
   ```
   [Bridge] 02:53:57  ▶ Commission 004  "Slice 3 — Mara's Half"
   [Bridge] 02:53:57    PENDING → IN_PROGRESS
   [Bridge] 02:53:57    claude -p invoked (timeout: 15min)
   ```

8. **bridge.log untouched** — dividers, progress ticks, and colors must NOT appear in bridge.log. Only stdout gets these. The `log()` function writes to both; use a separate `printStdout(line)` helper for stdout-only output (dividers and progress ticks). This keeps the concerns clean.

### Commit

9. Commit on `fix/readable-stdout-v2`:
   - `git add .bridge/watcher.js`
   - `git commit -m "fix: richer watcher stdout with colors, title, progress ticks"`
   - Then commit queue files:
   - `git add .bridge/queue/`
   - `git commit -m "chore: commit queue files for commission 006"`

---

## Constraints

- `bridge.log` must contain only valid JSON lines — no color codes, no dividers, no progress ticks
- `NO_COLOR` env var must disable all ANSI codes (check once at startup, store as a boolean)
- No external dependencies
- Do not touch any other files

---

## Success criteria

1. ANSI colors visible in terminal (green/red/yellow/cyan/dim) — and suppressed when `NO_COLOR` is set
2. Commission title shown on pickup line (extracted from frontmatter)
3. Visual `─` dividers printed at startup and around each commission
4. Progress ticks every 60s while Rook is running (stdout only, not in bridge.log)
5. Startup line includes poll interval and timeout in human-readable form
6. State/invoke lines indented under the pickup header
7. `bridge.log` is clean JSON with none of the above (verify with `cat .bridge/bridge.log | python3 -m json.tool`)
8. Committed on `fix/readable-stdout-v2`
9. Report at `.bridge/queue/006-DONE.md`
