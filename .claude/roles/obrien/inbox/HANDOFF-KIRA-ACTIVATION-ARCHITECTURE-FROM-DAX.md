# Kira Activation Architecture — Implementation Context (Rev 4)

**From:** Dax (Architect)
**To:** O'Brien (Implementor)
**Date:** 2026-04-14
**Scope:** Sprint 3 — Watcher event emitter

---

## Why this exists

Sprint 3 needs Kira to respond to pipeline events without Philipp nudging her. The architecture adds an event emitter to the watcher and a Cowork scheduled task that drains events. You build the emitter. Kira will brief you with the specific slice scope.

## What you'll be asked to build

### Slice A: Watcher event emitter

**New module: `bridge/kira-events.js`**

Exports `appendKiraEvent(event)`. Appends one JSON line to `bridge/kira-events.jsonl`. Creates the file on first write.

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

Pattern: same as `slicelog.js` — small module, `orchestrator.js` imports it.

**Watcher integration points:**

- `handleStuck()` (~line 1277): after register event + STUCK rename → `appendKiraEvent({ event: 'STUCK', ... })`
- Error handler (ERROR file write): after register event → `appendKiraEvent({ event: 'ERROR', ... })`
- Poll loop (new check): after processing queue, if all active briefs are terminal and ≥1 was processed this session → `appendKiraEvent({ event: 'ALL_COMPLETE', ... })`

**Create directories:** `bridge/kira-escalations/`, `bridge/demo-summaries/`

### Slice B: Ops Center escalation + summary display

- `GET /api/bridge/escalations` — lists files in `bridge/kira-escalations/`
- `GET /api/bridge/demo-summaries` — lists files in `bridge/demo-summaries/`
- Ops Center panel for escalations (prominent)
- Demo summary section

## What NOT to worry about

- The event drain scheduled task — Cowork prompt engineering, not your scope
- Who reads `kira-events.jsonl` or how — that's the drain's job
- Wrap-up skill changes — already done, not code
- Brief template changes — already done, not code
