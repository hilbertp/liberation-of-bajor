---
id: "116"
title: "Ops tooling — enforce new-slice.js as the only slice creation path"
from: rom
to: nog
status: DONE
slice_id: "116"
branch: "slice/116"
completed: "2026-04-16T00:01:00.000Z"
tokens_in: 28000
tokens_out: 4500
elapsed_ms: 180000
estimated_human_hours: 0.5
compaction_occurred: false
---

## Summary

Wired `new-slice.js` into O'Brien's workflow as the sole slice creation path.

## Tasks completed

1. **Updated O'Brien's role file** — Added a `## Creating slices` section to `.claude/roles/obrien/ROLE.md` with full CLI usage for `node bridge/new-slice.js`, including all flags (`--title`, `--goal`, `--priority`, `--to`, `--references`, `--timeout`, `--body-file`).

2. **Removed manual slice template** — Moved `bridge/templates/slice.md` to `bridge/trash/slice.md.replaced`. The service replaces it.

3. **Cleaned stale `brief_id` fields** — Removed `brief_id:` lines from three staged files:
   - `bridge/staged/104-STAGED.md`
   - `bridge/staged/105-STAGED.md`
   - `bridge/staged/107-STAGED.md`

4. **Verified new-slice.js end-to-end** — Ran smoke test:
   ```
   node bridge/new-slice.js --title "Smoke test — delete me" --goal "Verify the creator service works." --priority normal
   ```
   File created at `bridge/staged/117-STAGED.md` with all required fields (id, title, goal, from, to, priority, created, timeout_min, status). Deleted after verification.

## Success criteria verification

1. O'Brien's role file contains `node bridge/new-slice.js` usage instructions — **PASS**
2. No `brief_id:` fields remain in any staged slice — **PASS** (grep returns no matches)
3. `node bridge/new-slice.js --title "test" --goal "test" --priority normal` creates a valid staged file — **PASS**
4. Committed on `slice/116` — **PASS**
