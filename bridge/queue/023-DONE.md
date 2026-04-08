---
id: "023"
title: "Smart timeout — activity-based kill"
from: obrien
to: kira
status: DONE
commission_id: "023"
completed: "2026-04-09T14:00:00Z"
branch: slice/14-smart-timeout
---

## Summary

Replaced the flat wall-clock kill timeout with activity-based inactivity monitoring. O'Brien can now run as long as output is flowing — only silence kills the process.

## What was done

### 1. `bridge/bridge.config.json`
- Removed `timeoutMs: 900000`
- Added `inactivityTimeoutMs: 300000` (5 minutes of silence before kill)

### 2. `bridge/watcher.js` — core changes

**DEFAULTS:** `timeoutMs` replaced with `inactivityTimeoutMs: 300000`.

**Deprecation detection:** `loadConfig()` now returns `hasDeprecatedTimeoutMs` alongside the merged config. If `timeoutMs` is present in the config file, a one-time `warn/deprecation` line is written to `bridge.log` immediately after `LOG_FILE` is resolved.

**Module-level `currentLastActivityTs`:** Null when idle, a `Date` when processing. Read by `writeHeartbeat` to populate `last_activity_ts`.

**`invokeOBrien` rewrite:**
- Removed `timeout: effectiveTimeoutMs` from `execFile` options — no more wall-clock kill.
- Tracks `lastActivityTs` (local) and `killedByInactivity` (flag).
- `child.stdout.on('data')` and `child.stderr.on('data')` update both `lastActivityTs` and `currentLastActivityTs` on every chunk.
- `inactivityCheck` interval fires every 30s; kills child with `SIGTERM` and sets `killedByInactivity = true` if `Date.now() - lastActivityTs > effectiveInactivityMs`.
- Both intervals (`tickInterval`, `inactivityCheck`) are cleared in the callback.
- In the error branch, `killedByInactivity` takes precedence over the `SIGTERM` heuristic so the reason is correctly `inactivity_timeout`.

**`poll()`:** `effectiveTimeoutMs` → `effectiveInactivityMs`, sourced from `config.inactivityTimeoutMs`. `timeout_min` frontmatter now overrides inactivity minutes (semantics preserved, meaning updated).

**`writeErrorFile`:** `inactivity_timeout` reason emits `last_activity_seconds_ago` and `inactivity_limit_minutes` in frontmatter, and a descriptive detail line in the body.

**`writeHeartbeat`:** Added `last_activity_ts` field (ISO 8601 or null).

**`printStartupBlock`:** Shows "Inactivity kill: Nmin" instead of "Timeout: Nmin".

**Startup log:** `timeoutMs` → `inactivityTimeoutMs` in the startup config log entry.

## Success criteria check

1. ✓ `bridge.config.json` has `inactivityTimeoutMs: 300000`
2. ✓ Child is killed only after N ms of no stdout/stderr (30s check interval)
3. ✓ Active commissions producing output reset `lastActivityTs` — never killed
4. ✓ Per-commission `timeout_min` overrides inactivity limit for that commission
5. ✓ ERROR file on inactivity kill includes `reason: "inactivity_timeout"`, `last_activity_seconds_ago`, `inactivity_limit_minutes`
6. ✓ Heartbeat includes `last_activity_ts` field (ISO 8601 when active, null when idle)
7. ✓ `timeoutMs` in config triggers a one-time deprecation warning to `bridge.log`
8. ✓ All changes committed on branch `slice/14-smart-timeout` (commit `f46a7c5`)

## Files changed

- `bridge/bridge.config.json` — removed `timeoutMs`, added `inactivityTimeoutMs: 300000`
- `bridge/watcher.js` — all timeout logic replaced with inactivity monitoring
