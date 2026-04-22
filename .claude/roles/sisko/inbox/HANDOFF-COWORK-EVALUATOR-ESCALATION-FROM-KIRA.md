# Escalation: Move Commission Evaluator Out of Cowork — Bet 2 Scope Addition

**From:** Kira (Delivery Coordinator)
**To:** Sisko (Product Manager)
**Date:** 2026-04-09
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

The `kira-commission-watch` Cowork scheduled task (runs `*/1 * * * *`) is causing major Cowork storage harm. Every minute it fires creates sandbox artifacts. Philipp flagged this as urgent. I've disabled the task immediately to stop the bleed.

This means Kira currently has **no automated evaluation loop** — DONE reports land silently until Philipp manually opens a Kira session.

The fix already exists as an idea in `IDEAS.md` ("Relay-invoked evaluation loop", deferred from Bet 2 by Sisko on 2026-04-08). Philipp wants it pulled into Bet 2 ASAP.

---

## What you're being asked for

A scope decision: add the relay-invoked evaluation loop to Bet 2 as an urgent slice, and package it for Dax to architect.

---

## Context

**The idea (from IDEAS.md):**
The relay automatically evaluates O'Brien's DONE reports against acceptance criteria via `claude -p`, then writes ACCEPTED or a new amendment PENDING commission. Full autonomous loop without Cowork cron. Includes a hard cap at 5 failed amendment cycles (maxAmendments), after which it writes STUCK to the register and Philipp intervenes.

**Current state:**
- `kira-commission-watch` task: **disabled** (storage harm)
- Commission 025 (CORS lockdown) is in the queue — O'Brien will complete it, but there's no evaluator to pick up the DONE report automatically
- All other Bet 2 backend slices (021–024) are merged to main
- Leeta's frontend is live at `https://dax-dashboard.lovable.app`

**What the new slice needs to do (at minimum):**
1. Run inside the relay (`bridge/orchestrator.js` or a separate process) — NOT in Cowork
2. After writing a DONE file, automatically invoke `claude -p` to evaluate it against the original commission's success criteria
3. Write ACCEPTED or a new PENDING amendment commission based on the verdict
4. Write a REVIEWED event to `register.jsonl`
5. Stop after 5 failed amendment cycles — write STUCK, alert Philipp

**Technical complexity:** High. Dax should design it before Kira commissions O'Brien.

---

## What NOT to worry about

- The Cowork task infrastructure — that's being retired, not fixed
- Kira's manual evaluation workflow — it becomes the fallback, not the default
- Commission 025 specifically — Kira will evaluate it manually for now
