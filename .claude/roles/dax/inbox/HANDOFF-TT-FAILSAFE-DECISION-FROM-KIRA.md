# Handoff: T&T Failsafe — Decision Required

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-12T02:45:00Z
**Scope:** Bet 3 — T&T enforcement for Cowork roles

---

## Context

Brief 064 (now complete) fixed O'Brien's tracking structurally: the watcher validates five metrics fields in every DONE report, rejects with ERROR if any are missing, and auto-writes to `bridge/timesheet.jsonl`. O'Brien can no longer forget. That half of the problem is solved.

The unresolved half: **Cowork roles** (Dax, Sisko, Ziyal, Leeta, Kira) log manually via `ds9:estimate-hours`. Nothing currently enforces this. The open architecture handoff `HANDOFF-TT-FAILSAFE-ARCHITECTURE-FROM-KIRA.md` in your directory asked you to design a mechanism. Before you do that work, I need you to answer three questions. Your answers determine whether any implementation brief gets written at all.

---

## Questions for you to decide

**Q1 — Is this still needed?**

Given that O'Brien's tracking is now structural (automated, gated, no discipline required), does the manual Cowork role enforcement problem warrant an implementation effort? The Cowork roles log infrequently — a few sessions per week at most. Is the risk of missed entries high enough to build infrastructure for, or is it solved well enough by having it in each ROLE.md as a reminder?

**Q2 — If yes: what is the enforcement point?**

The constraints are hard: no cross-session memory, roles are invoked manually by Philipp, the watcher can't see Cowork sessions, and Kira shouldn't carry compliance overhead. Given these constraints, where does enforcement actually live? The candidate mechanisms from our earlier discussion were:

- **Receiver checks sender**: when role B receives a handoff from role A, B checks whether A has a timesheet entry since A's last outbound handoff. If not, B refuses and tells Philipp to make A log first.
- **`bridge/tt-audit.jsonl`**: `handoff-to-teammate` writes a record of every outbound handoff. `check-handoffs` cross-references on receipt. Fully file-based, no memory required.
- **Ops Center visibility**: surface delinquent roles in the dashboard so Philipp is the enforcement mechanism.
- **Something else you come up with.**

Which mechanism actually works within the constraints? Or a combination?

**Q3 — Scope of implementation**

If you recommend building it: which existing files change (skills, ROLE.md files, server.js, watcher.js) and is any new file needed? Keep it minimal — this is a local file queue, not a distributed platform.

---

## Deliverable

A short decision document — one paragraph per question is enough. If your answer to Q1 is "not needed", say why and close the handoff. If yes, give enough architectural direction that I can write a brief for O'Brien without ambiguity.
