---
id: "109"
title: "Watcher fix — evaluate-before-commission + checkout main before O'Brien"
goal: "Fix the two root causes of branch divergence: (1) poll() must evaluate DONE files before commissioning PENDING files, (2) watcher must checkout main before invoking O'Brien so every build branches from fresh main."
from: kira
to: obrien
priority: critical
created: "2026-04-15T00:00:00Z"
references: "096"
timeout_min: 30
status: "STAGED"
---

## Objective

This is Kira, your delivery coordinator. Two bugs in `bridge/watcher.js` caused every F-series build to diverge into unreachable branches. This slice fixes both root causes.

### Bug 1 — `poll()` priority inversion

Current behaviour:
```javascript
function poll() {
  if (processing) return;
  // ...scan files...
  if (pendingFiles.length === 0) {
    // evaluate DONE files
  }
  // else: commission next PENDING
}
```

The evaluator (which accepts work and merges to main) only runs when `pendingFiles.length === 0`. When a stakeholder approves multiple slices in a burst, all enter PENDING simultaneously. The watcher commissions them sequentially — each DONE event immediately triggers the next COMMISSIONED — so PENDING is never empty. The evaluator never runs. Nothing merges to main. Confirmed: slices 096–107 all built but zero merged until the burst drained.

**Fix:** Invert the priority. Evaluate DONE files first. Only commission a new PENDING after all DONEs are processed.

### Bug 2 — O'Brien branches from stale HEAD

The watcher invokes O'Brien via `claude -p` without first running `git checkout main`. O'Brien creates its branch from wherever HEAD happens to be — which is the *previous build's* branch tip, not main. This means:

- Slice 103 branched from `318c1e8` (pre-F-series main) instead of from the 096–102 chain
- Slice 104 also branched from `318c1e8`
- Each build's HTML is based on an old snapshot that's missing other builds' features
- When merged, these builds **overwrite** features from other branches — silent regression

**Fix:** Before invoking O'Brien, run `git checkout main` to ensure HEAD is on the latest merged main.

## Tasks

### Task 1 — Rewrite `poll()` priority order

In `bridge/watcher.js`, function `poll()` (around line 1430):

**Before:**
```javascript
function poll() {
  if (processing) return;
  // ...scan files...
  const pendingFiles = files.filter(f => f.endsWith('-PENDING.md')).sort();
  
  if (pendingFiles.length === 0) {
    // Priority 2: DONE files needing evaluation.
    const doneFiles = files.filter(f => f.endsWith('-DONE.md')).sort();
    // ...evaluate...
    return;
  }
  // Priority 1: Pick up PENDING
  // ...commission O'Brien...
}
```

**After:**
```javascript
function poll() {
  if (processing) return;
  // ...scan files...
  
  // === Priority 1: Evaluate completed DONE files first ===
  // This ensures each build merges to main BEFORE the next build starts,
  // preventing branch divergence when multiple slices are approved in a burst.
  const doneFiles = files.filter(f => f.endsWith('-DONE.md')).sort();
  for (const doneFile of doneFiles) {
    const doneId = doneFile.replace('-DONE.md', '');
    const donePath = path.join(QUEUE_DIR, doneFile);
    const briefPath = path.join(QUEUE_DIR, `${doneId}-BRIEF.md`);
    if (!fs.existsSync(briefPath)) continue;
    
    let briefMeta = {};
    try { briefMeta = parseFrontmatter(fs.readFileSync(briefPath, 'utf-8')) || {}; } catch (_) {}
    
    if (briefMeta.type === 'merge') {
      // ...existing legacy merge handling...
      continue;
    }
    if (hasReviewEvent(doneId)) continue;
    
    const evaluatingPath = path.join(QUEUE_DIR, `${doneId}-EVALUATING.md`);
    try {
      fs.renameSync(donePath, evaluatingPath);
      log('info', 'state', { id: doneId, from: 'DONE', to: 'EVALUATING' });
    } catch (err) {
      log('warn', 'evaluator', { id: doneId, msg: 'Failed to rename DONE to EVALUATING', error: err.message });
      continue;
    }
    
    processing = true;
    heartbeatState.status = 'evaluating';
    heartbeatState.current_brief = doneId;
    heartbeatState.current_brief_goal = briefMeta.goal || null;
    heartbeatState.pickupTime = Date.now();
    writeHeartbeat();
    invokeEvaluator(doneId);
    return;
  }
  
  // === Priority 2: Commission next PENDING (only if no DONE files to evaluate) ===
  const pendingFiles = files.filter(f => f.endsWith('-PENDING.md')).sort();
  if (pendingFiles.length === 0) {
    // Idle heartbeat
    idlePrintCounter += 1;
    if (idlePrintCounter >= 12) {
      idlePrintCounter = 0;
      const snap = getQueueSnapshot(QUEUE_DIR);
      const ts = timestampNow();
      print(`  ${C.dim}·${C.reset}  Queue: ${snap.waiting} waiting${SYM.sep}${snap.in_progress} in progress${SYM.sep}${snap.completed} done${SYM.sep}${snap.failed} failed  [${ts}]`);
    }
    return;
  }
  
  // ...existing PENDING pickup logic (unchanged)...
}
```

The key change: move the DONE evaluation block **above** the PENDING check. Remove the `if (pendingFiles.length === 0)` guard from the evaluation block. DONE evaluation now runs regardless of whether PENDING files exist.

Keep the idle heartbeat print at the end (when both DONE and PENDING are empty).

### Task 2 — Add `git checkout main` before O'Brien invocation

In `invokeOBrien()` (around line 575), add a `git checkout main` call at the very start, before the `claude -p` process is spawned:

```javascript
function invokeOBrien(briefContent, donePath, inProgressPath, errorPath, id, effectiveInactivityMs, title, goal) {
  // Ensure O'Brien starts from the latest main so the new branch includes all merged work.
  try {
    execSync('git checkout main', { cwd: PROJECT_DIR, stdio: 'pipe' });
    log('info', 'branch', { id, msg: 'Checked out main before O\'Brien invocation' });
  } catch (err) {
    log('warn', 'branch', { id, msg: 'Failed to checkout main before invocation — proceeding on current HEAD', error: err.message });
  }
  
  // ...rest of existing function...
```

Place this **before** the `doneTemplate` construction (the rest of the function is unchanged).

### Task 3 — Add a log line when evaluation takes priority over pending

When the evaluator runs and there ARE pending files waiting, log it so it's visible in the terminal:

```javascript
// Inside the DONE evaluation block, after successfully claiming a DONE file:
if (pendingFiles.length > 0) {
  log('info', 'evaluator', { id: doneId, msg: `Evaluating DONE before ${pendingFiles.length} pending — merge-first priority` });
  print(`${B.vert}  ${C.yellow}⚡${C.reset} ${pendingFiles.length} pending held — evaluating #${doneId} first (merge-first priority)`);
}
```

Wait — `pendingFiles` isn't scanned yet at that point in the new code. Move the pending scan to the top of `poll()` alongside the done scan so the count is available:

```javascript
function poll() {
  if (processing) return;
  // ...scan files...
  const doneFiles = files.filter(f => f.endsWith('-DONE.md')).sort();
  const pendingFiles = files.filter(f => f.endsWith('-PENDING.md')).sort();
  
  // Priority 1: evaluate DONE (uses pendingFiles.length for logging)
  // Priority 2: commission PENDING
}
```

## Constraints

- Do NOT change any other watcher behaviour: heartbeat, timesheet, error handling, evaluator invocation, merge logic — all unchanged.
- Do NOT add new npm dependencies.
- The `git checkout main` must be inside a try/catch — if it fails (dirty worktree, lock file), log a warning but proceed. Do not crash the watcher.
- Keep the idle heartbeat print (the 12-tick counter) — it just moves to the "both empty" case.
- The amendment path in `invokeOBrien` (for amendments that stay on the same branch) must NOT checkout main. Add the checkout only in the initial invocation path, NOT in the amendment re-invocation. Check: amendments call a different function or pass a flag. If amendments also go through `invokeOBrien`, gate the checkout behind a "is this an amendment?" check using the brief's `references` or `cycle` field.

### Task 4 — Line-count regression guard in `mergeBranch()`

Before the actual `git merge` call in `mergeBranch()`, add a cheap regression check. Compare the line count of `dashboard/lcars-dashboard.html` on the branch vs on main. If the branch version is significantly shorter (more than 15% fewer lines), abort the merge and log a warning:

```javascript
function mergeBranch(id, branchName, title) {
  // ...existing checkout main...
  
  // Regression guard: if the branch's dashboard HTML is significantly shorter
  // than main's, O'Brien likely built on a stale base and is missing features.
  try {
    const mainLines = parseInt(execSync(
      `git show main:dashboard/lcars-dashboard.html | wc -l`,
      { cwd: PROJECT_DIR, encoding: 'utf-8' }
    ).trim(), 10);
    const branchLines = parseInt(execSync(
      `git show ${branchName}:dashboard/lcars-dashboard.html | wc -l`,
      { cwd: PROJECT_DIR, encoding: 'utf-8' }
    ).trim(), 10);
    
    if (mainLines > 0 && branchLines < mainLines * 0.85) {
      const pct = Math.round((1 - branchLines / mainLines) * 100);
      log('warn', 'merge', {
        id,
        msg: `Regression guard: branch HTML is ${pct}% shorter than main (${branchLines} vs ${mainLines} lines) — aborting merge`,
        branchName,
        mainLines,
        branchLines,
      });
      registerEvent(id, 'MERGE_FAILED', {
        reason: `regression_guard: branch HTML ${pct}% shorter than main (${branchLines} vs ${mainLines})`,
        branch: branchName,
      });
      print(`${B.vert}    ${C.red}${SYM.cross}${C.reset} MERGE BLOCKED${SYM.sep}branch HTML ${pct}% shorter than main (${branchLines} vs ${mainLines} lines)`);
      print(`${B.vert}    ${C.yellow}⚠${C.reset}  Likely stale base — O'Brien may have overwritten features`);
      return { success: false, error: 'regression_guard' };
    }
  } catch (guardErr) {
    // If the file doesn't exist on either branch, skip the guard (not a dashboard change).
    log('info', 'merge', { id, msg: 'Regression guard skipped — file not found on one or both branches' });
  }
  
  // ...proceed with existing merge logic...
}
```

Place this AFTER the `git checkout main` call but BEFORE the `git merge --no-ff` call. The guard only checks `dashboard/lcars-dashboard.html` — it does not block merges for non-dashboard slices.

## Constraints

- Do NOT change any other watcher behaviour: heartbeat, timesheet, error handling, evaluator invocation — all unchanged.
- Do NOT add new npm dependencies.
- The `git checkout main` must be inside a try/catch — if it fails (dirty worktree, lock file), log a warning but proceed. Do not crash the watcher.
- Keep the idle heartbeat print (the 12-tick counter) — it just moves to the "both empty" case.
- The amendment path in `invokeOBrien` (for amendments that stay on the same branch) must NOT checkout main. Add the checkout only in the initial invocation path, NOT in the amendment re-invocation. Check: amendments call a different function or pass a flag. If amendments also go through `invokeOBrien`, gate the checkout behind a "is this an amendment?" check using the brief's `references` or `cycle` field.
- The regression guard must NOT crash the watcher if `dashboard/lcars-dashboard.html` doesn't exist on either branch. Wrap in try/catch.

## Success Criteria

1. `poll()` evaluates DONE files before commissioning PENDING files — confirmed by reading the code flow.
2. When a DONE file exists alongside PENDING files, the evaluator runs first (log line confirms).
3. `git checkout main` runs before O'Brien invocation for fresh builds (not amendments).
4. Regression guard: a merge where the branch HTML is >15% shorter than main is blocked with `MERGE_FAILED` event and clear log output.
5. All existing watcher tests (if any) still pass.
6. Committed on the standard `slice/109-*` branch.
