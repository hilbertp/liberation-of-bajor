# HANDOFF: Kira Activation Architecture — Sprint 3 Blocker

**From:** Sisko (PM)
**To:** Dax (Architect)
**Date:** 2026-04-14
**Priority:** Blocking — Sprint 3 cannot start without your recommendation

---

## The problem

Kira lives in Cowork. All her context lives there. She is passive — she only acts when Philipp talks to her directly. The Sprint 3 bet requires Kira to self-activate in response to pipeline events without Philipp nudging her:

- Nog escalates after 5 failed cycles → Kira must investigate and recommission autonomously
- A slice enters terminal error state → Kira must review and respond
- All slices complete and pass Nog → Kira must sign off and deliver a demo summary to Philipp

Currently, Philipp sees an error in the Ops Center dashboard and has to open Cowork and tell Kira about it. That's the loop we're closing.

---

## What has been tried and failed

**Kira watcher service** — a Node.js service that polled for state changes every 60 seconds and sent Kira a notification. Results:

- Noisy: fired on every poll, not just meaningful state changes
- Memory cost: each notification consumed Cowork context window, degrading Kira's ability to hold sprint context over time
- Not viable for Sprint 3

---

## Constraints

- Kira's decision-making value comes from her accumulated context in Cowork — sprint history, role relationships, prior decisions. A solution that throws this away is not acceptable.
- O'Brien stays in CLI (`claude -p`). Kira stays in Cowork. This is the architectural contract.
- The relay and watcher (`bridge/watcher.js`) are already running and managing the queue state machine. Any Kira activation mechanism should integrate with or extend this, not replace it.
- Cowork is a desktop app (Mac). We don't control its internals.

---

## What Dax needs to answer

**Primary question:** What is the most practical architecture for triggering Kira to act on pipeline events without Philipp in the loop?

**Options to evaluate (not exhaustive — Dax may identify others):**

1. **Headless Kira via `claude -p`** — Run a separate headless Kira invocation that handles pipeline events. Kira's Cowork session holds strategy and context; headless Kira handles reactive event processing. How do they share state? What's the context sync mechanism? Does headless Kira have enough context to make good decisions without the full Cowork session?

2. **Event-triggered Cowork notification** — A mechanism that writes a structured event to a file Kira watches (or is prompted to read at session start). Kira processes events at the start of each Cowork session. Not real-time, but avoids the noisy polling problem. Is this acceptable latency for Sprint 3?

3. **Kira as a scheduled headless process** — Not a watcher, but a scheduled invocation (e.g. every 10 minutes) that reads queue state, identifies anything requiring intervention, and acts. Different from the failed watcher: Kira invoked with full context from files, not a notification ping. Is this viable given token cost?

4. **Event queue for Kira** — Watcher writes structured escalation events to a file (`bridge/kira-queue.jsonl` or similar). Kira reads and drains this queue when invoked. Invocation could be triggered by Philipp opening Cowork, or by a scheduled process. What's the invocation mechanism?

5. **Something else** — Dax may identify a cleaner approach given knowledge of the existing watcher and relay architecture.

---

## What a good recommendation looks like

Dax's output should be an ADR (Architecture Decision Record) covering:

- **Recommended approach** — one clear recommendation, not a list of equally weighted options
- **Why this approach** — what problem it solves better than the alternatives
- **What it requires** — new components, changes to existing components, context sync mechanism
- **Trade-offs accepted** — what this approach gives up
- **What O'Brien builds** — concrete implementation scope, clear enough for a slice definition
- **What stays for later** — what this doesn't solve, flagged for Sprint 4 or beyond

---

## Reference files

- Sprint 3 scope: `repo/docs/SPRINT3-SCOPE.md`
- Sprint roadmap: `sprint-roadmap.html` (in project root)
- Current watcher: `repo/bridge/watcher.js`
- Current queue state machine: documented in FEATURES.md
- Failed watcher approach: documented in DEBRIEF.md

---

## Timing

Dax's ADR is the first deliverable of Sprint 3. O'Brien cannot start Kira activation work until the architecture is decided. Everything else in Sprint 3 (Nog, Ops Center frontend, token tracking) can start in parallel — only Kira activation is blocked on this.
