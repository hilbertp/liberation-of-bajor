# Tracking Test 2 — Confirm Unified Timesheet Logging

**From:** Kira (Delivery Coordinator)
**To:** Ziyal (Product Designer)
**Date:** 2026-04-12
**Scope:** Bet 3 — Unified timesheet verification

---

## Why this exists

The team has consolidated `slicelog.jsonl` and `timesheet.jsonl` into a single unified `bridge/timesheet.jsonl`. We are re-running the tracking test to confirm every human-invoked role can log to the unified file successfully.

---

## Your task

Answer this UX question in one short decision document written to `repo/.claude/roles/ziyal/RESPONSE-TRACKING-TEST-2-FROM-KIRA.md`:

> **If we surface T&T economics in the Ops Center, should token cost (in USD) be shown as a running total per session, per brief, or per bet — and where in the layout does it belong?**

One paragraph. Make a call with a rationale. No open questions.

---

## Tracking requirement

Before handing back: log a `timesheet.jsonl` entry using the `ds9:estimate-hours` skill. This is the pass/fail criterion for this test.
