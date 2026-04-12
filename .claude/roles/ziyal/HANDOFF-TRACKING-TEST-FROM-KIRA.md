# Tracking Test — Confirm Timesheet Logging

**From:** Kira (Delivery Coordinator)
**To:** Ziyal (UX Expert)
**Date:** 2026-04-12
**Scope:** Bet 3 — Role tracking verification

---

## Why this exists

We are running a tracking test across all roles to verify that `timesheet.jsonl` receives an entry from every human-invoked role. Your task is the smallest meaningful UX action possible.

---

## Your task

Answer this UX question in one short note written to `repo/.claude/roles/ziyal/RESPONSE-TRACKING-TEST-FROM-KIRA.md`:

> **In the Operations Center, when O'Brien is idle and Idle B is shown ("Last: #052 — Layout refactor · All clear"), should clicking that text do anything — e.g. open the commission detail — or should it be purely informational?**

One paragraph. Make a call with a rationale.

---

## What NOT to worry about

- Full spec format — a short note is correct
- Whether the answer is right — the test is whether tracking fires, not the UX decision quality

---

## Tracking requirement

Before handing back: log a `timesheet.jsonl` entry using the `ds9:estimate-hours` skill. This is the pass/fail criterion for this test.
