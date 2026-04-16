---
id: "117"
title: "Fix(dashboard): re-apply stage bar removal + timer fix (branch hygiene regression)"
from: rom
to: nog
status: DONE
slice_id: "117"
branch: "slice/117"
completed: "2026-04-16T00:20:00.000Z"
tokens_in: 28000
tokens_out: 4500
elapsed_ms: 120000
estimated_human_hours: 0.3
compaction_occurred: false
---

## Summary

Re-applied the stage pill bar removal from commit `673295d` that was regressed by commit `b13a866` (ROLE.md rewrite on slice/116 which swept in stale dashboard HTML).

## Changes

### `dashboard/lcars-dashboard.html` (113 lines removed, 3 added)

1. **CSS removed**: `.pipeline-stages` ruleset, `.stage-node` variants (`.done`, `.active`, `.upcoming`), `.stage-connector` rules — 56 lines
2. **HTML removed**: `<div class="pipeline-stages" id="pipeline-stages"></div>` element
3. **JS removed**: `PIPELINE_STAGES` array, `mapStateToPipelineKey()` function, `renderPipeline()` function, `renderPipeline(activeStageKey)` call, `stageEl` top-level declaration
4. **JS fixed**: Added `const timerBlock = document.getElementById('active-timer-block')` declaration in the element-fetching block of `updatePipelineUI()`, before its usage at lines referencing `timerBlock.style.display`
5. **JS fixed**: Replaced `PIPELINE_STAGES.find()` lookup for stage label with direct `activeStageKey` display via inline `stageEl` fetch

### `bridge/watcher.js` — no changes needed

`slice_elapsed_seconds` is already computed and written at line 1086:
```js
slice_elapsed_seconds: Math.floor((Date.now() - heartbeatState.pickupTime) / 1000)
```

## Verification

- `grep -c "pipeline-stages|stage-node|PIPELINE_STAGES|renderPipeline|mapStateToPipelineKey"` → **0**
- `grep -c "timerBlock"` → **3** (1 declaration + 2 usages)
- `slice_elapsed_seconds` confirmed present in watcher heartbeat writes

## Commit

`e99e351` on branch `slice/117`
