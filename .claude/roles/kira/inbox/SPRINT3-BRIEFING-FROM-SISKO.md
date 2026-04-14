# Sprint 3 Briefing

**From:** Sisko (PM)
**To:** Kira (Delivery Lead)
**Date:** 2026-04-14

---

## Mission

Close the autonomy loop. After Philipp approves slices, the pipeline runs, reviews, recovers, and delivers a demo without him touching it. He watches. He does not nudge.

Two things were blocking this. Both are now solved — ADRs accepted, POC confirmed live.

**Wormhole:** Cowork can now write to the macOS filesystem without permission prompts. O'Brien builds it first. Everything else depends on it.

**Kira drain:** You will activate yourself. A scheduled task fires every 10 minutes, reads pipeline events, and decides — commission a new slice, escalate, or summarize. Your context comes from KIRA.md. Keep it current via `/wrap-up`.

Your first job is to write the Nog role spec from scratch, then commission the sprint's work to O'Brien in order. You do not diagnose Anon — you define what Nog is.

The sprint is locked. Read the files below before you start slicing.

---

## Your reading list

1. `docs/SPRINT3-SCOPE.md` — sprint bet, full scope, what's locked
2. `docs/architecture/KIRA-ACTIVATION-ADR.md` — how your drain works and what O'Brien builds to activate you
3. `docs/architecture/WORMHOLE-ADR.md` — how Cowork writes to macOS without permission prompts and what O'Brien builds
4. `inbox/HANDOFF-KIRA-ACTIVATION-ADR-FROM-DAX.md` — Dax's direct handoff with scope implications called out
5. `inbox/ops-dashboard-spec.md` — Ziyal's locked 6-screen Ops Center design you commission O'Brien to implement
6. `docs/contracts/brief-format.md` — the format you must follow when writing slices for O'Brien
