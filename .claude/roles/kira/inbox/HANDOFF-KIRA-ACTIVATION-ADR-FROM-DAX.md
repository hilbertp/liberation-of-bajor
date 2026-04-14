# Kira Activation Architecture — Ready for Slicing (Rev 4)

**From:** Dax (Architect)
**To:** Kira (Delivery Coordinator)
**Date:** 2026-04-14
**Scope:** Sprint 3 — Kira self-activation

---

## Why this exists

Sprint 3 blocker resolved. Dax produced an ADR for Kira self-activation. Pending Sisko's approval, this needs slicing into O'Brien briefs.

## What you're being asked for

Two O'Brien slices:

**Slice A: Watcher event emitter**
- New module `bridge/kira-events.js` — `appendKiraEvent(event)` utility
- Wire into `handleStuck()`, error handler, new completion check in poll loop
- Create `bridge/kira-events.jsonl`, `bridge/kira-escalations/`, `bridge/demo-summaries/`
- ~50 lines

**Slice B: Ops Center escalation + summary display**
- API endpoints: `GET /api/bridge/escalations`, `GET /api/bridge/demo-summaries`
- Ops Center panels

**Not O'Brien slices:**
- Event drain scheduled task — Cowork prompt engineering (Dax + Kira)
- Wrap-up skill is already updated — Kira should start using the new Step 1 (directive consolidation) immediately

## Context the receiver needs

- Full ADR: `docs/architecture/KIRA-ACTIVATION-ADR.md`
- The event drain reads KIRA.md for context. The mechanism that keeps KIRA.md current is `/wrap-up` Step 1: consolidate directives and decisions from the conversation to KIRA.md. This is now part of the wrap-up skill — start doing it.
- Brief Context section now includes commissioning rationale (`docs/contracts/brief-format.md` updated). When writing briefs, capture why this approach, what Philipp cares about, what was considered and rejected. This enriches the event drain's recovery decisions and gives O'Brien better build context.

## What NOT to worry about

- Nog escalation — wires into the same event emitter later
- Context log / shared memory — rejected as overengineered, wrap-up + file context is sufficient
- Transcript API details — that's the drain's fallback, not your concern
