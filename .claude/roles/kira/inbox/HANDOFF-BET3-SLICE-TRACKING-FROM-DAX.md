# Per-Slice Tracking — Architecture Complete, Ready to Commission

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12T01:22:40Z
**Scope:** Bet 3 — Per-slice token, time, and human hours tracking

---

## Why this exists

You handed me three architecture questions for the per-slice tracking system (Bet 3 prerequisite). All four are answered. The architecture doc is at `docs/architecture/BET3-PER-SLICE-TRACKING.md`. This handoff gives you what you need to commission O'Brien.

---

## What you're asking for

Commission O'Brien to implement the per-slice tracking system per the architecture doc. All eight checklist items in section 9 of the ADR are O'Brien's scope.

---

## Context — the key decisions

**1. Token null root cause (one config line fix)**

`bridge/bridge.config.json` is missing `--output-format json` from `claudeArgs`. That's why every recent DONE event in `register.jsonl` shows `tokensIn: null`. O'Brien adds the flag and verifies nothing else breaks.

**2. Human hours enforcement**

O'Brien writes five required fields to every DONE report frontmatter: `tokens_in`, `tokens_out`, `elapsed_ms`, `estimated_human_hours`, `compaction_occurred`. Watcher validates them before allowing evaluation. Missing fields = `ERROR` with reason `incomplete_metrics`. Structural gate, no discipline required.

You can optionally add `expected_human_hours` to commission frontmatter as a pre-estimate. The delta reveals scope accuracy over time.

**3. Data destination — unified `bridge/timesheet.jsonl`**

No new file. Watcher auto-appends one row per commission to `bridge/timesheet.jsonl` with `source: "watcher"`. Two write points: creates row at DONE (with `result: null`), updates it at terminal state. Full schema in ADR section 4.

**4. Timestamp standard — ISO 8601 UTC datetime everywhere**

All timestamps in the system must be full datetimes, never date-only strings. This applies to:
- Every `ts_*` field in timesheet rows (`ts_pickup`, `ts_done`, `ts_result`, `ts`)
- Commission frontmatter `created` field
- DONE report frontmatter `completed` field
- The `**Date:**` header in every handoff artifact (including this one)

Format: `YYYY-MM-DDTHH:MM:SSZ`. Human-invoked roles use `date -u +"%Y-%m-%dT%H:%M:%SZ"` to get the current UTC datetime when writing handoffs.

**5. Ruflo / branch strategy**

`bet3/ruflo` branch off main when Ruflo is initialized. Same `timesheet.jsonl`, same schema, `runtime` field (`"legacy"` or `"ruflo"`) distinguishes rows.

---

## README gaps — same PR

Two items missing from `README.md` project structure:
- `bridge/staged/` (the Rubicon staging area)
- `bridge/register.jsonl` (the append-only event log)

---

## What NOT to worry about

- Dashboard visualization of timesheet data — later commission
- Ruflo internals — O'Brien just needs `appendTimesheet()` to exist for the Ruflo path to call later
- Existing manual `timesheet.jsonl` entries — leave them as-is, `source: "watcher"` distinguishes new rows
