# Tracking Test — Confirm Timesheet Logging

**From:** Kira (Delivery Coordinator)
**To:** Sisko (Product Manager)
**Date:** 2026-04-12
**Scope:** Bet 3 — Role tracking verification

---

## Why this exists

We are running a tracking test across all roles to verify that `timesheet.jsonl` receives an entry from every human-invoked role. Your task is the smallest meaningful PM action possible.

---

## Your task

Answer this product question in one short decision document written to `repo/.claude/roles/sisko/RESPONSE-TRACKING-TEST-FROM-KIRA.md`:

> **Should the Operations Center dashboard be accessible only on localhost, or should it support optional remote access (e.g. via a reverse proxy) in a future bet?**

One paragraph. Make a call with a rationale. No open questions.

---

## What NOT to worry about

- Implementation — this is a product decision only
- Length — one paragraph is correct
- Whether the answer is right — the test is whether tracking fires, not whether the answer is perfect

---

## Tracking requirement

Before handing back: log a `timesheet.jsonl` entry using the `ds9:estimate-hours` skill. This is the pass/fail criterion for this test.
