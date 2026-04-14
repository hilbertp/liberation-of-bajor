---
id: "091"
title: "Wormhole cutover — POC to production"
goal: "claude_desktop_config.json points to the production Wormhole server. POC is archived."
from: kira
to: obrien
priority: normal
created: "2026-04-14T00:00:00Z"
references: "089"
timeout_min: 15
status: "STAGED"
---

## Objective

Switch `claude_desktop_config.json` from the POC Wormhole server to the production Wormhole server built in slice 089. Archive the POC directory.

## Context

Slice 089 built the production Wormhole server at `wormhole/server.js`. The POC lives at `wormhole-poc/server.js` and is currently registered in `claude_desktop_config.json`. This slice performs the one-line switch and cleans up.

ADR: `docs/architecture/WORMHOLE-ADR.md` §Slice 4.

Note: `claude_desktop_config.json` lives on the macOS host at `~/Library/Application Support/Claude/claude_desktop_config.json` — not inside the repo. O'Brien must read the current file, update the wormhole entry's command/args to point to the production path, and write it back. After writing, Claude Desktop must be restarted for the change to take effect — O'Brien cannot do this, so he must note it in the DONE report.

The production path for the entry:
- Command: `node`
- Args: `["{absolute_path_to_repo}/wormhole/server.js"]`
- Env: `{ "WORMHOLE_WORKSPACE_ROOT": "{absolute_path_to_workspace_folder}" }`

Read the current `claude_desktop_config.json` to find the exact format of the existing POC entry before replacing it.

## Tasks

1. Read `~/Library/Application Support/Claude/claude_desktop_config.json`.

2. Locate the wormhole POC entry (look for `wormhole-poc` in the path).

3. Update the entry:
   - Point `command`/`args` to the production server: `{repo_root}/wormhole/server.js`
   - Set `env.WORMHOLE_WORKSPACE_ROOT` to the workspace folder absolute path
   - Keep the server name key the same (`wormhole` or whatever it currently is)

4. Write the updated config back to `~/Library/Application Support/Claude/claude_desktop_config.json`.

5. Move `wormhole-poc/` to `wormhole-poc-archive/` in the repo (do not delete — kept as reference):
   ```bash
   git mv wormhole-poc wormhole-poc-archive
   ```

6. Add a one-paragraph note to `wormhole-poc-archive/README.md` (create if missing) explaining that this is the original POC, now superseded by `wormhole/`.

7. Add a brief install note to `docs/WORMHOLE-SETUP.md` (create):
   - One-time setup: set `WORMHOLE_WORKSPACE_ROOT` in `claude_desktop_config.json` entry
   - Restart Claude Desktop after any config change
   - First tool call per session triggers a one-time consent click in Claude Desktop

8. Commit on branch `slice/091-wormhole-cutover`:
   ```
   feat(091): switch to production Wormhole, archive POC
   ```

9. Note in DONE report: **Claude Desktop must be restarted by Philipp for the config change to take effect.**

## Constraints

- Do not delete `wormhole-poc/` — archive it with `git mv`.
- Do not modify any Wormhole server code — only config and docs.

## Success criteria

1. `claude_desktop_config.json` references `wormhole/server.js`, not `wormhole-poc/server.js`.
2. `WORMHOLE_WORKSPACE_ROOT` is set correctly in the config entry.
3. `wormhole-poc/` renamed to `wormhole-poc-archive/` and committed.
4. `docs/WORMHOLE-SETUP.md` exists with restart and consent instructions.
5. DONE report clearly flags that Philipp must restart Claude Desktop.
6. Committed on `slice/091-wormhole-cutover`.
