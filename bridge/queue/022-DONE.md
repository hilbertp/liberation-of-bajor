---
id: "022"
title: "REVIEWED event in register + review state wiring"
from: obrien
to: kira
status: DONE
commission_id: "022"
branch: slice/13-reviewed-event
created: "2026-04-09T13:35:00Z"
completed: "2026-04-09T14:30:00Z"
---

## Summary

All five tasks completed. Only `dashboard/server.js` was modified. Branch `slice/13-reviewed-event` was cut from `slice/12-register-api` (the parent commission 021 branch) per amendment protocol.

## Changes made

**`dashboard/server.js`**

1. **`writeRegisterEvent(event)`** — appends `JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'` to `bridge/register.jsonl` via `fs.appendFileSync`.

2. **`POST /api/bridge/review`** — new endpoint that:
   - Handles OPTIONS preflight with CORS headers (`Access-Control-Allow-Methods: POST, OPTIONS`)
   - Rejects non-POST methods with 405
   - Validates request body: 400 if `id` or `verdict` missing, 400 if verdict not in `['ACCEPTED', 'AMENDMENT_REQUIRED']`
   - Calls `writeRegisterEvent({ id, event: 'REVIEWED', verdict, notes? })` on success
   - Returns 201 `{ ok: true }`

3. **`reviewedMap`** — built alongside `completedMap` in a single pass over events; keyed by commission ID, stores the last REVIEWED event's verdict.

4. **`reviewStatus` on `recent` entries** — `.map()` after the `.slice(0, 10)`:
   - `'accepted'` if verdict is `ACCEPTED`
   - `'amendment_required'` if verdict is `AMENDMENT_REQUIRED`
   - `'waiting_for_review'` if no REVIEWED event found

## Success criteria check

| Criterion | Status |
|---|---|
| `POST /api/bridge/review` accepts `{ id, verdict, notes }` → 201 | ✓ (smoke-tested: `{"ok":true}` 201) |
| POST writes REVIEWED event to register.jsonl with correct schema | ✓ (verified via register tail) |
| POST returns 400 if `id` or `verdict` missing | ✓ (smoke-tested: `{"error":"id and verdict are required"}` 400) |
| POST returns 400 if verdict is invalid | ✓ (smoke-tested: `{"error":"verdict must be one of: ACCEPTED, AMENDMENT_REQUIRED"}` 400) |
| `recent[]` entries include `reviewStatus` | ✓ (smoke-tested: `recent[0].reviewStatus: "accepted"`) |
| CORS headers on POST endpoint including OPTIONS preflight | ✓ (OPTIONS → 204) |
| All existing endpoints and response shapes unchanged | ✓ |
| Changes committed on `slice/13-reviewed-event` | ✓ (commit 1cc16ee) |

## Notes

- Branch cut from `slice/12-register-api` (commission 021), not from `main`, per amendment protocol.
- `reviewedMap` uses last-wins per ID: if multiple REVIEWED events exist for the same commission, the latest verdict wins.
- The smoke-test REVIEWED event written during testing was stripped from register.jsonl before committing.
- `notes` field on the REVIEWED event is optional — omitted from the written object if not present in the request body.
