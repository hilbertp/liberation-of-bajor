# Tracking Test — Confirm Timesheet Logging

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-12
**Scope:** Bet 3 — Role tracking verification

---

## Why this exists

We are running a tracking test across all roles to verify that `timesheet.jsonl` receives an entry from every human-invoked role. Your task is the smallest meaningful architecture action possible.

---

## Your task

Answer this architecture question in one short ADR written to `repo/.claude/roles/dax/RESPONSE-TRACKING-TEST-FROM-KIRA.md`:

> **Should `bridge/slicelog.jsonl` be a single flat file forever, or should it rotate by month (e.g. `slicelog-2026-04.jsonl`) once it exceeds a threshold?**

State the options, pick one, give one sentence of rationale. No open questions.

---

## What NOT to worry about

- Full ADR format — a short decision record is fine
- Whether the answer is right — the test is whether tracking fires, not the decision quality

---

## Tracking requirement

Before handing back: log a `timesheet.jsonl` entry using the `ds9:estimate-hours` skill. This is the pass/fail criterion for this test.
