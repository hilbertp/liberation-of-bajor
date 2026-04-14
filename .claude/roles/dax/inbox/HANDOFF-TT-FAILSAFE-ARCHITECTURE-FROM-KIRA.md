# Handoff: T&T Failsafe Architecture

**From:** Kira (Delivery Coordinator)
**To:** Dax (Architect)
**Date:** 2026-04-12
**Scope:** Bet 2 — T&T tracking enforcement

---

## Problem

We have a unified `bridge/timesheet.jsonl` where every role must log time-and-token economics after completing work. O'Brien's entries are automated by the watcher — that's solved. The Cowork roles (Dax, Sisko, Ziyal, Leeta, Kira) log manually via the `ds9:estimate-hours` skill.

**The problem: there is no enforcement if a Cowork role forgets to log.** In the real world, HR withholds your paycheck or your freelance contract requires timesheets. For AI roles in Cowork, there's no equivalent mechanism.

## Constraints you must design around

1. **No persistent memory across sessions.** Each Cowork role opens in a fresh context window. It has no knowledge of what happened in its prior session.
2. **Roles are not invoked automatically.** The human user (Philipp) manually navigates to a role in the Cowork UI and tells it to check for handoffs. There is no scheduler or event loop for Cowork roles.
3. **The watcher only manages O'Brien.** It cannot invoke or gate Cowork roles.
4. **ROLE.md is always loaded** at the start of every session — it's the one reliable injection point for role behavior.
5. **`bridge/timesheet.jsonl` and all files in `bridge/` and `.claude/roles/` are readable** from any Cowork session.
6. **Handoff files in `.claude/roles/{role}/HANDOFF-*.md`** are the mechanism for inter-role communication.

## What failed

- **Gate in `check-handoffs` skill:** The receiving role checking its OWN last session doesn't work — it has no memory of when its last session was or what it did.
- **Receiver checks sender's T&T:** Better, but still requires the receiver to know when the sender last worked, and doesn't solve the problem that the LAST role in a chain has nobody checking them.
- **Kira gating at handoff-write time:** Adds too many tokens to Kira's already large context window. Kira shouldn't carry compliance overhead.
- **Watcher audit:** Only sees O'Brien's work. Can't observe Cowork sessions.

## What might work (but you decide)

Some seed ideas — feel free to reject all of them:

- A lightweight audit file (e.g. `bridge/tt-audit.jsonl`) that the `handoff-to-teammate` skill writes to when sending a handoff (recording "role X sent handoff to Y at time T"). Then `check-handoffs` can cross-reference: "I see a handoff FROM role X, but X has no timesheet entry after their last outbound handoff — refuse until X logs."
- A Quark role (future) whose sole job is compliance enforcement, invoked periodically.
- A scheduled task (we have the `schedule` skill) that runs daily and flags delinquent roles in a file that `check-handoffs` reads.
- Something in the Ops Center that shows Philipp which roles are behind on T&T, so HE becomes the enforcement mechanism (human-in-the-loop HR).

## Deliverable

Write an architecture decision document. Cover:
1. Where the enforcement point lives
2. What data it reads
3. What happens when a role is delinquent
4. How it works given the constraints above (especially: no cross-session memory, manual invocation only)
5. Which existing skills/files need changes
6. Whether new infrastructure is needed

Keep it practical. This is a local file queue system, not a distributed platform. The simplest mechanism that actually works is the right answer.
