---
id: "010"
title: "Slice 5: Watcher terminal for stakeholders"
from: mara
to: rook
priority: high
created: "2026-04-06T06:15:00+00:00"
references: "008"
---

## Objective

Rewrite the watcher's terminal output so a non-technical stakeholder (Philipp) can glance at the terminal and immediately understand: what's queued, what's being worked on, what's done and awaiting review, what failed, and how much it's costing. Zero technical jargon. If we fail at making the terminal useful, we'll need to build an actual web dashboard — so this matters.

**Branch:** `slice/5-watcher-terminal` (fresh branch from main)

## Context

This is Mara speaking. The current watcher stdout is functional but reads like a debug log. Lines like "claude -p invoked (timeout: 15min)" and "startup_recovery: 004 — orphaned IN_PROGRESS deleted" are meaningless to a stakeholder. Every line the watcher prints must be written for a business audience.

There is also a bug: on line ~335, the watcher tries to `fs.unlinkSync(inProgressPath)` after Rook finishes, but Rook's crash recovery (3.1) may have already renamed or deleted the IN_PROGRESS file. This causes an ENOENT error printed to the terminal. Fix this.

## Design — Terminal layout

The terminal output should have three distinct sections that build up over a session:

### 1. Startup block (printed once on launch)

```
═══════════════════════════════════════════════════════════════════
  Bridge of Hormuz · Watcher
  Started: 05:36:02 · Polling every 5s · Timeout: 15min
═══════════════════════════════════════════════════════════════════

  Recovered on startup:
    ✓ Commission 004 — cleared stale work-in-progress (already completed)
    ✓ Commission 006 — cleared stale work-in-progress (already completed)

  Queue snapshot:
    📋 1 waiting · 0 in progress · 5 completed · 0 failed
───────────────────────────────────────────────────────────────────
```

If no recovery actions needed, omit the recovery section. If queue is empty, say "Queue is empty — watching for new commissions."

### 2. Commission lifecycle blocks (one per commission)

```
┌─────────────────────────────────────────────────────────────────
│  ► Commission 010 · "Slice 5: Watcher terminal for stakeholders"
│    Queued → Handed off to Rook
│
│    ⏳ Working… 1m 0s
│    ⏳ Working… 2m 0s
│    ⏳ Working… 3m 0s
│
│    ✓ Complete · 3m 22s · 45,231 tokens · $0.38
│    Status: Done → Waiting for Mara's review
└─────────────────────────────────────────────────────────────────
```

On error:
```
│    ✗ Failed · 1m 05s · Reason: Timed out
│    Status: Needs attention
```

The progress ticks ("Working… Xm Xs") update in place if possible (ANSI cursor), otherwise append new lines. Either approach is fine — pick what's more robust.

### 3. Session summary (after each commission completes, update a running tally)

```
  Session: 3 completed · 1 failed · 142,802 tokens · $1.21 · uptime 47m
```

This is a single line that gets reprinted/updated after each commission finishes.

## Tasks

### Task 1 — Fix ENOENT bug

In `invokeRook()` callback (~line 334), wrap the `fs.unlinkSync(inProgressPath)` in an existence check. If the file doesn't exist, that's fine — Rook's crash recovery already handled it. Do NOT log a warning for this case; it's expected behavior.

### Task 2 — Token and cost tracking

Add `--output-format json` to the `claudeArgs` in DEFAULTS (so: `['-p', '--permission-mode', 'bypassPermissions', '--output-format', 'json']`). When `claude -p` finishes, parse stdout as JSON to extract token usage. The JSON output from Claude Code includes `input_tokens` and `output_tokens` fields (or similar — inspect the actual output and adapt).

Calculate cost using these rates (hardcode for now, make configurable later):
- Input tokens: $15.00 per 1M tokens
- Output tokens: $75.00 per 1M tokens

Store per-commission: `{ id, tokens_in, tokens_out, cost_usd }`. Accumulate session totals.

If the JSON parsing fails (e.g. old Claude Code version), fall back gracefully — show "tokens: unknown" instead of crashing.

**Important:** The `--output-format json` flag changes how stdout is structured. The commission content (Rook's actual work output) may be wrapped in a JSON envelope. Make sure the DONE file detection still works — Rook writes the DONE file to disk, so the watcher checks for its existence, not stdout content. The stdout JSON is only used for token extraction.

### Task 3 — Rewrite all stdout output

Replace every `printStdout()` and `formatForStdout()` call with stakeholder-friendly language. Specific requirements:

| Current jargon | Replacement |
|---|---|
| "claude -p invoked (timeout: 15min)" | "Handed off to Rook · 15min limit" |
| "still running · Xm Xs elapsed" | "Working… Xm Xs" |
| "Rook finished — DONE file present" | "Complete" (with duration and token cost) |
| "startup_recovery: ID — orphaned IN_PROGRESS deleted (DONE exists)" | "Cleared stale work-in-progress (already completed)" |
| "startup_recovery: ID — IN_PROGRESS → PENDING (re-queued)" | "Re-queued interrupted commission" |
| "Commission timed out" | "Timed out" |
| "claude -p failed" | "Failed" (with reason) |
| "invalid_commission" | "Rejected — missing required fields: [list]" |
| "Watcher started · polling every 5s · timeout 15min" | Use the startup block format from the design above |
| All ANSI-colored `[Bridge] HH:MM:SS` prefixes | Keep timestamps but use the box-drawing layout from the design |

No line should contain: "claude", "execFile", "fs.", "ENOENT", "SIGTERM", "exit code", "IN_PROGRESS", "PENDING", file paths, or Node.js terms. These belong in bridge.log only.

### Task 4 — Queue snapshot helper

Add a function `getQueueSnapshot(queueDir)` that scans the queue directory and returns counts: `{ waiting, in_progress, completed, failed, awaiting_review }`. "Awaiting review" = DONE files that exist but haven't been acknowledged (for v1, just count all DONE files — we don't have an ACCEPTED state yet).

Use this in the startup block and optionally after each commission completes.

### Task 5 — Session state tracking

Track across the session:
- Total commissions processed
- Success / fail counts
- Cumulative tokens (input + output)
- Cumulative cost
- Session start time (for uptime calculation)

Print the session summary line after each commission completes.

## Constraints

- No new npm dependencies
- `watcher.js` remains a single file (it's at 716 lines — that's fine, it can grow for this)
- `bridge.log` continues to receive the full technical JSON (no change to logging)
- Backward compatible with existing queue files
- `NO_COLOR` environment variable must still be respected (disable box-drawing characters and colors, fall back to plain text)
- Commit queue files as part of the work

## Success criteria

1. ENOENT error no longer appears when IN_PROGRESS file is already cleaned up
2. Startup block shows recovery actions (if any) and queue snapshot in stakeholder language
3. Commission lifecycle shows: pickup with title, handoff, progress ticks with elapsed time, completion with duration + tokens + cost
4. Failed commissions show reason in plain language (no error codes)
5. Session summary line updates after each commission
6. Zero technical jargon in any stdout output (bridge.log unchanged)
7. NO_COLOR mode produces clean plain-text output without box-drawing or ANSI codes
8. Token counts and cost displayed per commission and in session summary (or "tokens: unknown" if unavailable)
9. All changes committed on `slice/5-watcher-terminal`, queue files included
10. Report written to `.bridge/queue/010-DONE.md`
