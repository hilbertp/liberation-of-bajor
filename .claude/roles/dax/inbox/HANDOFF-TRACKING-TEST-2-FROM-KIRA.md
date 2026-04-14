# Tracking Test 2 — Confirm Unified Timesheet Logging

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-12
**Scope:** Bet 3 — Unified timesheet verification

---

## Why this exists

The team has consolidated `slicelog.jsonl` and `timesheet.jsonl` into a single unified `bridge/timesheet.jsonl`. We are re-running the tracking test to confirm every human-invoked role can log to the unified file successfully.

---

## Your task

Answer this architecture question in one short decision document written to `repo/.claude/roles/dax/RESPONSE-TRACKING-TEST-2-FROM-KIRA.md`:

> **The unified `timesheet.jsonl` currently has no size management — it grows forever. At what point (file size, row count, or time horizon) should we introduce rotation or archiving, and what mechanism would you recommend?**

One paragraph. Make a call with a rationale. No open questions.

---

## Tracking requirement

Before handing back: log a `timesheet.jsonl` entry using the `ds9:estimate-hours` skill. This is the pass/fail criterion for this test.
