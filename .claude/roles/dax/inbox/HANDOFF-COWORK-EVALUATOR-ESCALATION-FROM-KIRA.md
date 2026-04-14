# Architecture Needed: Relay-Invoked Commission Evaluator

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-09
**Scope:** Bet 2 — Contributor-facing relay & dashboard

---

## Why this exists

The `kira-commission-watch` Cowork scheduled task is causing major storage harm — every minute it fires creates sandbox artifacts. Philipp flagged it as urgent. I've disabled it immediately.

This is now an active gap: DONE reports land with no automated evaluator. Philipp wants the relay-invoked evaluation loop (currently in IDEAS.md, deferred from Bet 2) pulled in as an urgent Bet 2 slice. This needs your architecture before Kira can commission O'Brien.

---

## What you're being asked for

An ADR or architecture note covering how to build the relay-invoked evaluator — enough for Kira to write a commission for O'Brien.

---

## Context

**The idea (from IDEAS.md):**
The relay automatically evaluates O'Brien's DONE reports against success criteria via `claude -p`, then writes ACCEPTED or a new amendment PENDING commission. Includes a hard cap at 5 failed amendment cycles, after which it writes STUCK to `register.jsonl` and surfaces it to Philipp.

**Current infrastructure:**
- `bridge/watcher.js` — the relay. Polls queue, invokes `claude -p`, writes heartbeat. It already runs `claude -p` for commissions — it could also run `claude -p` for evaluation.
- `bridge/register.jsonl` — event log. Already has COMMISSIONED, DONE, and now REVIEWED events (commission 022).
- `bridge/queue/` — the file queue. Evaluator would write new PENDING files for amendments.
- `POST /api/bridge/review` — already exists (commission 022). The evaluator should call this to write the REVIEWED event rather than writing directly to the register.

**Key design questions for you:**
1. Does the evaluator run inside `watcher.js` (extending it) or as a separate process?
2. What prompt does the evaluator send to `claude -p`? It needs: the original commission (success criteria) + O'Brien's DONE report. Where does it get both?
3. How does it distinguish "already evaluated" from "needs evaluation"? Register REVIEWED events? A separate state file?
4. Amendment loop cap: 5 cycles tracked how? Per commission ID in the register?
5. STUCK state: written to register only, or also a queue file?

**Constraint:** Must not run inside Cowork. Must run as part of the local relay infrastructure on Philipp's Mac.

---

## What NOT to worry about

- Disabling the Cowork task — already done
- The `POST /api/bridge/review` endpoint — already built, evaluator should use it
- Kira's manual fallback — she'll evaluate commission 025 manually while this is built
