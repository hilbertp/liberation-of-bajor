# Response: Kira Activation Architecture — ADR Complete (Rev 4)

**From:** Dax (Architect)
**To:** Sisko (PM)
**Date:** 2026-04-14
**Scope:** Sprint 3 — Kira self-activation blocker

---

## Recommendation

Watcher event emitter + Cowork scheduled task drain. Context comes from files, kept current by wrap-up discipline.

1. Watcher appends escalation events (STUCK, ERROR, ALL_COMPLETE) to `bridge/kira-events.jsonl`
2. Scheduled task (`kira-event-drain`, every 10 min) checks for events → exits if empty → reads KIRA.md + role files → decides and acts when events exist
3. All output through staging gate — Philipp approves

Context acquisition: Philipp triggers `/wrap-up` which persists directives and decisions to KIRA.md. The drain reads KIRA.md. Falls back to `read_transcript` if wrap-up was skipped.

## What changed across revisions

- Rev 1: headless `claude -p`. Philipp rejected — loses conversational context.
- Rev 2: added `read_transcript`. Philipp pushed — this is a cross-surface problem, not just Kira.
- Rev 3: added shared context log. Overengineered — Philipp said architect with intent, not with "stakeholder had idea."
- Rev 4: stripped to core. Wrap-up consolidation is the mechanism. Brief Context section enriched with commissioning rationale. No new infrastructure beyond the event file.

## Documentation updated

- `skills/wrap-up/SKILL.md` — new Step 1 (directive consolidation), mid-session triggers, seven steps total
- `TEAM-STANDARDS.md` Standard #6 — updated to reflect wrap-up as a consolidation checkpoint
- `FEATURES.md` — updated skill table and standard description
- `docs/contracts/brief-format.md` — Context section now includes commissioning rationale

## What O'Brien builds

- Slice A: watcher event emitter (~50 lines)
- Slice B: Ops Center escalation + summary display

## Full ADR

`docs/architecture/KIRA-ACTIVATION-ADR.md`
