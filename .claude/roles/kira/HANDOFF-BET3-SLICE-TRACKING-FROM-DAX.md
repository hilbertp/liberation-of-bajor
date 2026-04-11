# Per-Slice Tracking — Architecture Complete, Ready to Commission

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-12
**Scope:** Bet 3 — Per-slice token, time, and human hours tracking

---

## Why this exists

You handed me three architecture questions for the per-slice tracking system (Bet 3 prerequisite). All four are answered. The architecture doc is at `docs/architecture/BET3-PER-SLICE-TRACKING.md`. This handoff gives you what you need to commission O'Brien.

---

## What you're asking for

Commission O'Brien to implement the per-slice tracking system per the architecture doc. All six checklist items in section 8 of the ADR are O'Brien's scope.

---

## Context — the four answers

**1. Token null root cause (found this while reviewing — fixes itself as part of this commission)**

`bridge/bridge.config.json` is missing `--output-format json` from `claudeArgs`. That's why every recent DONE event in `register.jsonl` shows `tokensIn: null`. One config line fixes it. O'Brien verifies stdout parsing still works after the change.

**2. Human hours estimation**

O'Brien estimates, intra-slice, by writing five required fields to DONE report frontmatter:
- `tokens_in`, `tokens_out`, `elapsed_ms`, `estimated_human_hours`, `compaction_occurred`

The watcher validates these at DONE time. Missing fields = `ERROR` with reason `incomplete_metrics`. Commission does not proceed to evaluation. This is the structural enforcement — no discipline required.

You can optionally add `expected_human_hours` to commission frontmatter. Over time the delta reveals scope accuracy.

**3. New file: `bridge/slicelog.jsonl`**

One JSON row per commission. Written by the watcher automatically at two points: when DONE is confirmed (creates row with `result: null`), and when the terminal state fires (updates `result`, `cycle`, `ts_result`). Full schema in the ADR section 3.

**4. Ruflo / branch strategy**

`bet3/ruflo` branch off main when Ruflo is initialized. Same slicelog, same schema, `runtime` field (`"legacy"` or `"ruflo"`) distinguishes rows. Not a fork.

---

## README gaps O'Brien should fix in the same commission

Two items missing from `README.md` project structure:
- `bridge/staged/` (the Rubicon staging area)
- `bridge/register.jsonl` (the append-only event log)

Small change, same PR.

---

## What NOT to worry about

- Dashboard visualization of slicelog data — that's a later commission
- Ruflo internals — we don't control those, O'Brien only needs to expose the config flag
- Existing `timesheet.jsonl` — don't break it, leave it as-is for human-invoked roles
