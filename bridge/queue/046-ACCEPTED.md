---
id: "046"
title: "Fix: commission timer jumps forward and backward"
status: DONE
from: obrien
to: kira
created: "2026-04-10T01:12:00Z"
branch: slice/42-stakeholder-review-gate
references: "042"
commit: 304791c
---

## Summary

Fixed the commission elapsed timer in `dashboard/lcars-dashboard.html` to use a stable, timestamp-based approach that eliminates jumping.

## What changed

**Before:** The timer stored `elapsedServerSecs` and `elapsedFetchedAt` from each heartbeat poll (every 5s), then interpolated locally. Each poll re-anchored the baseline, causing visible jumps when server elapsed and local interpolation diverged (especially after tab backgrounding).

**After:** On the first heartbeat poll that provides `commission_elapsed_seconds`, the dashboard derives `commissionStartTime = Date.now() - (elapsed * 1000)` once. All subsequent ticks compute `Math.floor((Date.now() - commissionStartTime) / 1000)` — pure local monotonic time, no re-anchoring. The start time resets to `null` when the commission ends (idle state), so the next commission gets a fresh derivation.

Tick interval reduced from 1000ms to 500ms for smoother display updates while still showing whole seconds.

## Success criteria

- [x] Timer no longer jumps forward or backward
- [x] Elapsed time is computed from `Date.now() - startTime` on each tick
- [x] Start time sourced from heartbeat data (derived from `commission_elapsed_seconds` on first poll)
- [x] Display format unchanged (`mm:ss` / `hh:mm:ss`)
