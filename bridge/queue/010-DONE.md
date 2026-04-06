---
id: "010"
title: "Slice 5: Watcher terminal for stakeholders"
from: rook
to: mara
status: DONE
commission_id: "010"
completed: "2026-04-06T07:10:00+00:00"
branch: "slice/5-watcher-terminal"
---

## Summary

All five tasks completed. The watcher terminal output has been rewritten for stakeholders, the ENOENT bug is fixed, token/cost tracking is in place, and the NO_COLOR path is clean.

## Task outcomes

### Task 1 — Fix ENOENT bug ✓

Replaced the unconditional `fs.unlinkSync(inProgressPath)` at line ~334 with an `fs.existsSync` guard. If the file is already gone (Rook's crash recovery cleaned it up), the watcher silently moves on — no warning, no error printed.

### Task 2 — Token and cost tracking ✓

Added `'--output-format', 'json'` to `claudeArgs` in DEFAULTS. `extractTokens(stdout)` scans JSONL output from the end, looking for `data.usage.input_tokens` / `data.usage.output_tokens` (and a top-level fallback). Costs are calculated at $15/1M input, $75/1M output. If JSON parsing yields nothing, the display falls back to `tokens: unknown` — no crash.

### Task 3 — Rewrite all stdout output ✓

`log()` now writes **only** to `bridge.log` (JSON, unchanged). All stdout is managed through explicit `printStdout()` calls. Zero instances of "claude", "execFile", "IN_PROGRESS", "PENDING", "SIGTERM", "exit code", file paths, or Node.js terms appear in stdout. Replacement mappings applied as specified.

### Task 4 — Queue snapshot helper ✓

`getQueueSnapshot(queueDir)` returns `{ waiting, in_progress, completed, failed, awaiting_review }`. Used in the startup block; `awaiting_review` counts all DONE files (v1 approximation per spec).

### Task 5 — Session state tracking ✓

`SESSION` object accumulates `completed`, `failed`, `tokensIn`, `tokensOut`, `costUsd`, `startTime`. `printSessionSummary()` is called after every commission (success or failure).

## Terminal output design

**Startup block** (printed once):
```
═══════════════════════════════════════════════════════════════════
  Bridge of Hormuz · Watcher
  Started: 07:02:14 · Polling every 5s · Timeout: 15min
═══════════════════════════════════════════════════════════════════

  Recovered on startup:          (section omitted if no recoveries)
    ✓ Commission 004 — cleared stale work-in-progress (already completed)

  Queue snapshot:
    📋 1 waiting · 0 in progress · 5 completed · 0 failed
───────────────────────────────────────────────────────────────────
```

**Commission lifecycle block** (one per commission):
```
┌──────────────────────────────────────────────────────────────────
│  ► Commission 010 · "Slice 5: Watcher terminal for stakeholders"
│    Queued → Handed off to Rook · 15min limit
│
│    ⏳ Working… 1m 0s
│
│    ✓ Complete · 3m 22s · 45,231 tokens · $0.38
│    Status: Done → Waiting for Mara's review
└──────────────────────────────────────────────────────────────────

  Session: 1 completed · 0 failed · 45,231 tokens · $0.38 · uptime 4m
```

**NO_COLOR mode**: Box-drawing chars replaced with `=`, `-`, `|`, `+`. ANSI codes stripped.

## Notes for Mara

- `--output-format json` is now in DEFAULTS. If a `bridge.config.json` override omits it, token tracking will fall back to "unknown" — no breakage.
- `getQueueSnapshot` is exported alongside `nextCommissionId` for any future helper scripts.
- Progress ticks append new lines (not ANSI cursor-up). More robust across terminals and log piping.
- The session summary shows `tokens: unknown` if no commissions in the session produced parseable token data.

## Files changed

- `.bridge/watcher.js` — full rewrite of terminal output, bug fix, new tracking
- `.bridge/queue/010-IN_PROGRESS.md` → `.bridge/queue/010-DONE.md`
