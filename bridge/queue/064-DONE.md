---
id: "064"
title: "Bet 3: Per-slice tracking — watcher metrics, validation gate, unified timesheet"
from: obrien
to: kira
status: DONE
brief_id: "064"
branch: "bet3/64-per-slice-tracking"
completed: "2026-04-12T02:15:00Z"
tokens_in: 42000
tokens_out: 4800
elapsed_ms: 360000
estimated_human_hours: 3.0
compaction_occurred: false
---

## Summary

Implemented the remaining piece of Bet 3 per-slice tracking. Most infrastructure was already in place on `main` from prior work — the new contribution is the DONE report template injected into every commission prompt.

## Tasks completed

### Task 1 — Config fix: `--output-format json`
**Status: Already done.** `bridge/bridge.config.json` already contains `"--output-format", "json"` in `claudeArgs`. Verified with `node -e` — flag is present.

### Task 2 — DONE report template with five required metrics fields
**Status: Done.** Added a structured DONE report template to the commission prompt in `invokeOBrien()` (bridge/watcher.js:548-582). The template includes all five required fields (`tokens_in`, `tokens_out`, `elapsed_ms`, `estimated_human_hours`, `compaction_occurred`) with explicit instructions that values must be real and non-zero.

Also audited timestamps:
- `created` in amendment brief template (line 1186): uses `new Date().toISOString()` — correct
- `completed` in ERROR file template (line 1287): uses `new Date().toISOString()` — correct
- No date-only patterns found in watcher.js (grep confirmed)

### Task 3 — Metrics validation gate
**Status: Already done.** `validateDoneMetrics()` exists at line 198 and is called in the DONE handler at line 612. Missing/malformed fields produce ERROR with reason `incomplete_metrics`.

### Task 4 — Extract `appendTimesheet()` to `bridge/slicelog.js`
**Status: Already done.** `bridge/slicelog.js` exports `appendTimesheet()`, `updateTimesheet()`, and `TIMESHEET_FILE`.

### Task 5 — Write Point 1: append timesheet entry at DONE
**Status: Already done.** `appendTimesheet()` is called at line 637 after validation passes, with full schema including `source: "watcher"`, `runtime: "legacy"`, `result: null`, ISO 8601 timestamps.

### Task 6 — Write Point 2: update timesheet entry at terminal state
**Status: Already done.** `updateTimesheet()` is called in:
- `handleAccepted` (line 1118) — sets `result: 'ACCEPTED'`
- `handleStuck` (line 1247) — sets `result: 'STUCK'`
- Error paths (lines 682, 723) — sets `result: 'ERROR'`

Recovery logic exists: if entry not found, creates with `recovered: true`.

### Task 7 — README update
**Status: Already done.** `README.md` already lists `bridge/staged/` and `bridge/register.jsonl` in the project structure section.

### Task 8 — Verification
- `node -c bridge/watcher.js` — passed
- `node -c bridge/slicelog.js` — passed
- `bridge/bridge.config.json` — valid JSON
- No date-only timestamp patterns in watcher.js

## Success criteria checklist

1. `bridge.config.json` contains `--output-format json` — YES
2. DONE report template includes all five metrics fields — YES (new commit)
3. Missing metrics fields produce ERROR with `incomplete_metrics` — YES
4. `bridge/slicelog.js` exists and exports `appendTimesheet()` — YES
5. Timesheet entry appended at DONE with `result: null` — YES
6. Timesheet entry updated at terminal state — YES
7. `README.md` lists `bridge/staged/` and `bridge/register.jsonl` — YES
8. All JS files pass `node -c` — YES
9. DONE report includes all 5 metrics fields — YES

## Commit log

- `b7feba8` feat(watcher): add DONE report template with five required metrics fields to commission prompt (brief 064)

## Notes

Seven of eight tasks were already implemented on `main` from prior work. The single new change is the DONE report template injection into the commission prompt — this was the structural gap that meant O'Brien had no explicit guidance on what metrics fields to include. With this template, the prompt-side instructions match the validation-side enforcement.
