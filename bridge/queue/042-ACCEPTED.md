---
id: "042"
title: "Stakeholder review gate — staged commissions with Commission / Amend / Reject"
from: obrien
to: kira
status: DONE
commission_id: "042"
branch: slice/42-stakeholder-review-gate
completed: "2026-04-10T12:00:00Z"
---

## What I did

Built the full stakeholder review gate: a staging area where Kira writes commissions and Philipp reviews them before they enter the queue. Created `bridge/staged/` and `bridge/trash/` directories, added four new API endpoints to the dashboard server, built an LCARS-styled staged panel in the dashboard UI, and updated the watcher to log staged commission counts on startup.

## What succeeded

- `bridge/staged/` and `bridge/trash/` directories created with `.gitkeep` files.
- `GET /api/bridge/staged` returns all staged commissions (STAGED and NEEDS_AMENDMENT) with id, title, summary, goal, status, amendment_note, and body.
- `POST /api/bridge/staged/:id/commission` moves a staged file to `queue/{id}-PENDING.md` with status updated to PENDING, deletes from staged/.
- `POST /api/bridge/staged/:id/amend` stores Philipp's note in the file's frontmatter, renames to `{id}-NEEDS_AMENDMENT.md`, sets status to NEEDS_AMENDMENT.
- `POST /api/bridge/staged/:id/reject` moves file to `trash/{id}-REJECTED.md` with status REJECTED.
- All endpoints handle missing files with 404.
- Dashboard staged panel shows each commission with `#{id} Title`, summary (falls back to goal), and Commission / Amend / Reject buttons.
- Details section (full commission body) is collapsible, collapsed by default.
- Amend shows inline text input — no `prompt()`.
- Reject shows inline confirmation — no `confirm()`.
- Panel polls every 5 seconds, same as the bridge data.
- Watcher `printStartupBlock()` now counts files in `bridge/staged/` and prints `ℹ  {n} commission(s) awaiting your review in bridge/staged/` when count > 0.
- Watcher never scans or processes `staged/` files — only reads count for display.
- Existing queue behavior completely unchanged.

## What failed

Nothing.

## Blockers / Questions for Kira

None.

## Files changed

- `bridge/staged/.gitkeep` — created: empty file to track directory in git
- `bridge/trash/.gitkeep` — created: empty file to track directory in git
- `dashboard/server.js` — modified: added STAGED_DIR/TRASH_DIR constants, directory auto-creation, extractBody/updateFrontmatter/readJsonBody helpers, GET /api/bridge/staged, POST commission/amend/reject endpoints
- `dashboard/lcars-dashboard.html` — modified: added staged panel CSS styles, staged panel HTML section, full client-side JS for fetching/rendering/interacting with staged commissions
- `bridge/watcher.js` — modified: added STAGED_DIR constant, added staged count log in printStartupBlock
- `bridge/queue/042-DONE.md` — created: this report
