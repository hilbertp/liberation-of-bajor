---
id: "092"
title: "Kira drain — watcher event emitter"
goal: "The watcher emits structured events to bridge/kira-events.jsonl when a slice gets stuck, errors, or when all active work completes."
from: kira
to: obrien
priority: high
created: "2026-04-14T00:00:00Z"
references: null
timeout_min: 30
status: "STAGED"
---

## Objective

Build the watcher-side half of Kira's self-activation system. The watcher appends to `bridge/kira-events.jsonl` when something needs Kira's judgment — stuck slices, errors, or pipeline completion. This is what the Kira drain reads when it fires every 10 minutes.

## Context

Full ADR: `docs/architecture/KIRA-ACTIVATION-ADR.md` — read it before starting. Component 1 (Watcher event emitter) is your scope.

The event drain (Cowork scheduled task) is NOT your scope — Kira sets that up separately. Your job: emit the right events from the right places in `bridge/watcher.js`.

Event schema:
```json
{
  "ts": "ISO 8601 UTC",
  "event": "STUCK | ERROR | ALL_COMPLETE | NOG_ESCALATION",
  "slice_id": "string or null",
  "root_id": "string or null",
  "cycle": "number or null",
  "branch": "string or null",
  "details": "string — human-readable summary",
  "processed": false
}
```

Trigger points (from ADR):
- `handleStuck()` (~line 1277 of watcher.js) → append `STUCK` after the register event + rename
- Error handler (after ERROR register event + rename) → append `ERROR`
- Poll loop (new) → if all active slices are terminal and ≥1 was processed this session → append `ALL_COMPLETE`

`NOG_ESCALATION` is wired in a future slice (Nog) — do not wire it here, but the event schema supports it.

## Tasks

1. Create `bridge/kira-events.js`:
   ```javascript
   'use strict';
   const fs = require('fs');
   const path = require('path');
   const EVENTS_FILE = path.resolve(__dirname, 'kira-events.jsonl');

   function appendKiraEvent(event) {
     const entry = Object.assign({ ts: new Date().toISOString(), processed: false }, event);
     try {
       fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + '\n');
     } catch (err) {
       process.stderr.write('[kira-event-error] ' + err.message + '\n');
     }
   }

   module.exports = { appendKiraEvent };
   ```

2. In `bridge/watcher.js`, require the new module at the top:
   ```javascript
   const { appendKiraEvent } = require('./kira-events');
   ```

3. Wire `STUCK` event in `handleStuck()`:
   - After the existing register event append and file rename, add:
   ```javascript
   appendKiraEvent({
     event: 'STUCK',
     slice_id: sliceId,
     root_id: rootId || null,
     cycle: cycleCount || null,
     branch: branch || null,
     details: `Slice ${sliceId} stuck after ${cycleCount} cycles`,
   });
   ```
   - Read the actual variable names from `handleStuck()` — use whatever the function already has.

4. Wire `ERROR` event in the error handler:
   - After the existing ERROR register event and file rename, add:
   ```javascript
   appendKiraEvent({
     event: 'ERROR',
     slice_id: sliceId,
     root_id: rootId || null,
     cycle: null,
     branch: branch || null,
     details: `Slice ${sliceId} errored: ${errorReason}`,
   });
   ```
   - Use the actual variable names from the error handler.

5. Wire `ALL_COMPLETE` in the poll loop:
   - Track a session-level boolean `sessionHasProcessed` — set to `true` the first time a slice transitions to DONE or ERROR during this watcher session.
   - At the end of each poll cycle, if `sessionHasProcessed` is true AND no slice is currently IN_PROGRESS AND the queue has no PENDING files AND no active IN_PROGRESS files → append `ALL_COMPLETE`:
   ```javascript
   appendKiraEvent({
     event: 'ALL_COMPLETE',
     slice_id: null,
     root_id: null,
     cycle: null,
     branch: null,
     details: 'All active slices are terminal. Pipeline idle.',
   });
   ```
   - Then set `sessionHasProcessed = false` so this fires only once per completion wave.

6. Create `bridge/kira-escalations/` and `bridge/demo-summaries/` directories (create `.gitkeep` in each).

7. Add `bridge/kira-events.jsonl` to `.gitignore` (it's a runtime file, like register.jsonl).

8. Commit on branch `slice/092-kira-drain-emitter`:
   ```
   feat(092): watcher event emitter for Kira drain
   ```

## Constraints

- `appendKiraEvent` must never throw — same pattern as `appendTimesheet`.
- Do not build the drain itself — only the emitter.
- Do not wire `NOG_ESCALATION` — that is slice 093.
- Do not add `kira-events.jsonl` to git tracking.

## Success criteria

1. `bridge/kira-events.js` exists with `appendKiraEvent`.
2. `handleStuck()` appends a `STUCK` event after the existing register write.
3. Error handler appends an `ERROR` event after the existing register write.
4. Poll loop appends `ALL_COMPLETE` once when the pipeline goes idle after processing ≥1 slice.
5. `bridge/kira-escalations/` and `bridge/demo-summaries/` directories exist with `.gitkeep`.
6. `bridge/kira-events.jsonl` in `.gitignore`.
7. Committed on `slice/092-kira-drain-emitter`.
