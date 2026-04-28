---
id: "255"
title: "Perf: dashboard — deduplicate bridge fetch and guard re-render on unchanged data"
from: rom
to: nog
status: DONE
slice_id: "255"
branch: "slice/255"
completed: "2026-04-28T09:02:00.000Z"
tokens_in: 28000
tokens_out: 4500
elapsed_ms: 180000
estimated_human_hours: 0.75
compaction_occurred: false
---

## Summary

Deduplicated the `/api/bridge` fetch and added a fingerprint guard to skip expensive DOM rebuilds when data is unchanged. Unified two independent `setInterval` timers into a single `pollAll()` cadence.

## Changes

All changes in `dashboard/lcars-dashboard.html`:

### 1. Shared bridge-data state
- Added `_lastBridgeData` and `_lastBridgeFingerprint` variables alongside existing `cached*` declarations.

### 2. Fingerprint helper
- Added `_bridgeFingerprint(data)` — cheap string fingerprint from heartbeat timestamp, status, and array lengths for recent/events/slices.

### 3. fetchBridge rewrite
- Now sets `_lastBridgeData` so `fetchCombinedQueue` can consume it without re-fetching.
- Moved `cachedBridgeSlices` and `cachedQueueOrder` assignments here (previously in `fetchCombinedQueue`).
- Fingerprint guard: `renderHistoryPanel` and `updateNogLane` only fire when data actually changed.
- Heartbeat timestamp, `processApiRetries`, and `updatePipelineUI` still run every cycle (cheap).

### 4. fetchCombinedQueue rewrite
- Removed `fetch('/api/bridge')` call entirely — reads from `_lastBridgeData` instead.
- Removed `cachedBridgeSlices` / `cachedQueueOrder` assignments (now in `fetchBridge`).
- Still fetches `/api/bridge/staged` independently (different endpoint, still needed).

### 5. Unified poll interval
- Removed `setInterval(fetchBridge, 5000)` and `setInterval(fetchCombinedQueue, 5000)`.
- Added `pollAll()` that runs `fetchBridge()` then `fetchCombinedQueue()` sequentially.
- Single `setInterval(pollAll, 5000)` drives both.

## Expected impact
- `/api/bridge` calls: **halved** (1 per 5s instead of 2).
- DOM rebuilds for history/nog panels: **skipped** when data unchanged.
- Brave Renderer CPU expected to drop from ~70% to <10% at idle.
- Node server.js CPU expected to drop from ~32% to <5% at idle.

## Verification
- Grep confirms only one `fetch('/api/bridge')` call remains in the file.
- No orphaned `setInterval(fetchBridge, ...)` or `setInterval(fetchCombinedQueue, ...)`.
- Single `setInterval(pollAll, 5000)` drives all polling.
