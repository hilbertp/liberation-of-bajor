# ADR: Kira Activation Architecture

**Author:** Dax (Architect)
**Date:** 2026-04-14
**Status:** Proposed — awaiting Sisko review
**Responds to:** `HANDOFF-KIRA-ACTIVATION-SPRINT3-FROM-SISKO.md`
**Revision:** 4 — stripped to core after scope creep. Context consolidation is a team-wide concern handled by wrap-up, not by this ADR.

---

## Decision

**Watcher event emitter + Cowork scheduled task drain. Context comes from files, enriched by wrap-up discipline.**

1. The watcher appends escalation events to `bridge/kira-events.jsonl` when something needs Kira's judgment.
2. A Cowork scheduled task (`kira-event-drain`) runs every 10 minutes, checks for unprocessed events, exits immediately if empty.
3. When events exist, the drain reads Kira's persistent file context (KIRA.md, ROLE.md, LEARNING.md, queue state) and makes a scoped decision.
4. All output goes through the staging gate — Philipp approves before anything executes.

The drain gets conversational context because **Philipp triggers `/wrap-up` before ending a Kira session**, and wrap-up persists directives and decisions to KIRA.md. By the time the drain fires, Philipp's instructions are already in the files the drain reads. `read_transcript` is a safety net for when wrap-up was skipped, not the primary mechanism.

---

## Why this approach

### What failed and why

The `kira-commission-watch` scheduled task polled every minute, created sandbox artifacts on every run, burned Cowork context window, and was killed as an urgent storage hazard. Root cause: a Cowork session firing on a dumb timer, doing work every invocation regardless of whether anything had happened.

### Why a headless `claude -p` doesn't work (Option 1 — rejected)

Philipp rejected this in revision 1. A headless Kira can't see what Philipp told Cowork Kira. Files capture settled decisions, but not in-flight directives — unless the role consolidates them first. Headless `claude -p` also can't call `read_transcript` as a fallback. The drain must be a Cowork session.

### Why this is different from the failed task

| | Failed task | This design |
|---|---|---|
| **Frequency** | Every 1 min (1,440/day) | Every 10 min (144/day) |
| **Work per run** | Full evaluation every time | Check one file → exit if empty |
| **Real work** | Every run | Only when escalation events exist (rare) |
| **Context** | None | KIRA.md (with wrap-up–persisted directives) + file context |

### Why file-based context is now sufficient

Revision 1 was rejected because file context missed conversational directives. The fix isn't a new infrastructure layer — it's a **behavioral standard**: `/wrap-up` consolidates directives and decisions into KIRA.md before the session ends. This is a human-triggered checkpoint: Philipp decides when to end the session, and wrap-up ensures nothing is lost.

This makes the drain's context model identical to every other role's context model: read the project anchor, read ROLE.md, read LEARNING.md. No special mechanism needed.

---

## Component 1: Watcher event emitter

The watcher appends a JSON line to `bridge/kira-events.jsonl` when an escalation-worthy event occurs.

**Event schema:**

```json
{
  "ts": "ISO 8601 UTC",
  "event": "STUCK | ERROR | ALL_COMPLETE | NOG_ESCALATION",
  "brief_id": "string or null",
  "root_id": "string or null",
  "cycle": "number or null",
  "branch": "string or null",
  "details": "string — human-readable summary",
  "processed": false
}
```

**Trigger points in `watcher.js`:**

| Where | Event |
|---|---|
| `handleStuck()` (~line 1277) | Append `STUCK` after register event + rename |
| Error handler | Append `ERROR` after register event + rename |
| Poll loop (new) | If all active briefs are terminal and ≥1 was processed this session → append `ALL_COMPLETE` |

Events that do NOT trigger: normal DONE, AMENDMENT_NEEDED, ACCEPTED. The evaluator handles the happy path. The event file is for situations that need judgment.

---

## Component 2: Kira event drain

Cowork scheduled task (`kira-event-drain`), every 10 minutes.

**Flow:**

1. Read `bridge/kira-events.jsonl` — filter for `processed: false`
2. If none → exit. Minimal token cost.
3. If events exist:
   a. Read `KIRA.md` (project state, including active directives from wrap-up)
   b. Read `.claude/roles/kira/ROLE.md` + `LEARNING.md`
   c. Read relevant queue files (original brief, DONE reports, error logs) based on event details
   d. For each event, decide:
      - Check KIRA.md for directives that affect this event (e.g., "Philipp: kill slice 12")
      - `new_brief` → write to `bridge/staged/{nextId}-STAGED.md`
      - `escalate` → write to `bridge/kira-escalations/{brief_id}-ESCALATION.md`
      - `demo_summary` → write to `bridge/demo-summaries/{date}-SUMMARY.md`
   e. Mark events as processed
   f. Append register events

**Fallback:** If KIRA.md has no recent directive updates (stale `Updated:` timestamp), the drain calls `list_sessions` → `read_transcript` on the most recent Kira session. This catches the case where Philipp forgot to wrap up. The drain should flag this: "Note: KIRA.md directives may be stale — reading transcript as fallback."

---

## Component 3: Wrap-up directive consolidation (team-wide)

This is not Kira-specific infrastructure. It's an enhancement to the existing `/wrap-up` skill that benefits every role.

**New step in `/wrap-up`:** After capturing learnings and before logging hours, scan the session for:
- Directives from Philipp (things he told the role to do or not do)
- Decisions made during the session (scope changes, priority shifts, kill decisions)
- Active project state changes (what's next, what's blocked, what changed)

Persist these to the role's project anchor file (KIRA.md for Kira, equivalent for other roles) in a `## Active Directives` section or equivalent.

This is the mechanism that closes the context gap. It's human-triggered (Philipp says "wrap up"), captures ephemeral context into persistent files, and makes that context available to any future invocation — whether that's a new Cowork session, the event drain, or a future Slack-invoked role.

**See separate documentation updates:** TEAM-STANDARDS.md Standard #6, `/wrap-up` SKILL.md, FEATURES.md.

---

## What O'Brien builds

### Slice A: Watcher event emitter

- New module `bridge/kira-events.js` — `appendKiraEvent(event)` utility
- Wire into `handleStuck()`, error handler, and new completion check
- Create `bridge/kira-events.jsonl` on first write
- Create directories: `bridge/kira-escalations/`, `bridge/demo-summaries/`
- ~50 lines of new code

### Slice B: Ops Center escalation + summary display

- New API endpoint: `GET /api/bridge/escalations`
- New API endpoint: `GET /api/bridge/demo-summaries`
- Ops Center panel for escalations (prominent)
- Demo summary section

### Not O'Brien slices

- Event drain scheduled task — Cowork prompt engineering (Dax + Kira)
- Wrap-up skill enhancement — skill update (Dax or Kira)

### Not in Sprint 3

- Nog escalation path (depends on Nog)
- Event drain updating KIRA.md (read-only for now)
- Model routing for the drain (measure first)
- Retry logic (unprocessed events self-heal — picked up next cycle)

---

## Trade-offs

| We gain | We give up |
|---|---|
| Single Kira identity — no split brain | 10-minute latency on escalation response |
| Context from files (proven model, same as every other role) | Depends on wrap-up discipline — if Philipp doesn't wrap up, directives may be stale |
| Zero idle cost (check-and-exit on empty) | 144 minimal checks/day at 10-min interval |
| Watcher stays simple (append-only JSONL writes) | New scheduled task to manage |
| Staging gate preserved | Event drain is a Cowork session (storage artifacts, but at low frequency with idle-exit) |

### Risk classification

- **Wrap-up discipline:** Spike-worthy risk. The drain's context quality depends on Philipp triggering wrap-up. Mitigation: `read_transcript` fallback when KIRA.md looks stale. Monitor during Sprint 3. If Philipp consistently skips wrap-up, the fallback becomes the primary path (acceptable but less efficient).
- **Storage artifacts at 10-min interval:** Acceptable risk. ~10x less than the failed 1-min task, with idle-exit. Monitor.
- **Event drain prompt quality:** Acceptable risk. Standard prompt engineering. Iterate during Sprint 3.

---

## Reference

| Item | Path |
|---|---|
| Sprint 3 scope | `docs/SPRINT3-SCOPE.md` |
| Watcher `handleStuck()` | `bridge/watcher.js` ~line 1277 |
| Existing evaluator | `bridge/watcher.js` lines 933–1297 |
| Kira operational anchor | `KIRA.md` |
| Kira role doc | `.claude/roles/kira/ROLE.md` |
| Kira learning | `.claude/roles/kira/LEARNING.md` |
| Next ID utility | `bridge/next-id.js` |
| Wrap-up skill | `.claude/skills/wrap-up/SKILL.md` |
| Failed scheduled task | `DEBRIEF.md`, `HANDOFF-COWORK-EVALUATOR-ESCALATION-FROM-KIRA.md` |
| Transcript API (fallback) | `list_sessions` + `read_transcript` (Cowork MCP) |
