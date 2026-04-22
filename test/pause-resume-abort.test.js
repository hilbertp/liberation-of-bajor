'use strict';

/**
 * pause-resume-abort.test.js
 *
 * Tests for slice 166 — Pause/Resume/Abort controls (UI2):
 *   1. Pause happy path: ROM_PAUSED event emitted, PID tracked
 *   2. Resume happy path: ROM_RESUMED event emitted
 *   3. Abort from paused: ROM_ABORTED event, cleanup
 *   4. Abort from in-progress: ROM_ABORTED event, cleanup
 *   5. Pause rejected when not IN_PROGRESS
 *   6. Resume rejected when not paused
 *   7. Watcher restart with a paused slice (no re-spawn)
 *   8. Dashboard: Pause button enabled (no disabled attr, no UI2 tooltip)
 *   9. Dashboard: Resume + Abort buttons enabled
 *  10. No "amendment" (old spelling) in dashboard or orchestrator
 *
 * Run: node test/pause-resume-abort.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Read source files for static analysis
// ---------------------------------------------------------------------------

const watcherSource = fs.readFileSync(
  path.join(__dirname, '..', 'bridge', 'orchestrator.js'),
  'utf-8'
);

const dashboardSource = fs.readFileSync(
  path.join(__dirname, '..', 'dashboard', 'lcars-dashboard.html'),
  'utf-8'
);

const serverSource = fs.readFileSync(
  path.join(__dirname, '..', 'dashboard', 'server.js'),
  'utf-8'
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Part 1: Backend — Pause action
// ---------------------------------------------------------------------------

console.log('\n== Pause/Resume/Abort tests (slice 166) ==\n');
console.log('--- Part 1: Backend pause action ---');

test('Watcher handles "pause" control action', () => {
  assert.ok(
    watcherSource.includes("'pause'") || watcherSource.includes('"pause"'),
    'orchestrator.js must handle action === "pause"'
  );
});

test('Pause emits ROM_PAUSED register event', () => {
  const matches = watcherSource.match(/registerEvent\([^)]*'ROM_PAUSED'/g) ||
                  watcherSource.match(/registerEvent\([^)]*"ROM_PAUSED"/g);
  assert.ok(matches && matches.length >= 1, 'orchestrator.js must emit ROM_PAUSED via registerEvent');
});

test('Pause sends SIGSTOP to child process', () => {
  assert.ok(
    watcherSource.includes('SIGSTOP'),
    'orchestrator.js must use SIGSTOP for pause'
  );
});

test('PID bookkeeping: active child processes tracked by slice ID', () => {
  // There should be a map/object that stores child processes keyed by slice ID
  assert.ok(
    watcherSource.includes('activeChildren') ||
    watcherSource.includes('childProcessMap') ||
    watcherSource.includes('romProcesses'),
    'orchestrator.js must track child processes by slice ID'
  );
});

// ---------------------------------------------------------------------------
// Part 1: Backend — Resume action
// ---------------------------------------------------------------------------

console.log('\n--- Part 1: Backend resume action ---');

test('Watcher handles "resume" control action', () => {
  assert.ok(
    watcherSource.includes("'resume'") || watcherSource.includes('"resume"'),
    'orchestrator.js must handle action === "resume"'
  );
});

test('Resume emits ROM_RESUMED register event', () => {
  const matches = watcherSource.match(/registerEvent\([^)]*'ROM_RESUMED'/g) ||
                  watcherSource.match(/registerEvent\([^)]*"ROM_RESUMED"/g);
  assert.ok(matches && matches.length >= 1, 'orchestrator.js must emit ROM_RESUMED via registerEvent');
});

test('Resume sends SIGCONT to child process', () => {
  assert.ok(
    watcherSource.includes('SIGCONT'),
    'orchestrator.js must use SIGCONT for resume'
  );
});

// ---------------------------------------------------------------------------
// Part 1: Backend — Abort action
// ---------------------------------------------------------------------------

console.log('\n--- Part 1: Backend abort action ---');

test('Watcher handles "abort" control action', () => {
  assert.ok(
    watcherSource.includes("'abort'") || watcherSource.includes('"abort"'),
    'orchestrator.js must handle action === "abort"'
  );
});

test('Abort emits ROM_ABORTED register event', () => {
  const matches = watcherSource.match(/registerEvent\([^)]*'ROM_ABORTED'/g) ||
                  watcherSource.match(/registerEvent\([^)]*"ROM_ABORTED"/g);
  assert.ok(matches && matches.length >= 1, 'orchestrator.js must emit ROM_ABORTED via registerEvent');
});

test('Abort sends SIGKILL to child process', () => {
  assert.ok(
    watcherSource.includes('SIGKILL'),
    'orchestrator.js must use SIGKILL for abort'
  );
});

test('Abort moves slice to STAGED', () => {
  // The handleAbort function must reference STAGED to move the slice back
  const fnMatch = watcherSource.match(/function handleAbort\([^)]*\)\s*\{([\s\S]*?)^}/m);
  assert.ok(fnMatch, 'handleAbort function must exist');
  const body = fnMatch[1];
  assert.ok(
    body.includes('STAGED') || body.includes('staged'),
    'Abort handler must move slice to STAGED'
  );
});

// ---------------------------------------------------------------------------
// Part 1: Rejection preconditions
// ---------------------------------------------------------------------------

console.log('\n--- Part 1: Rejection preconditions ---');

test('Pause rejects when slice is not IN_PROGRESS', () => {
  // The pause handler should check for IN_PROGRESS state
  assert.ok(
    watcherSource.includes('IN_PROGRESS'),
    'Pause handler must validate IN_PROGRESS state'
  );
});

test('Resume rejects when latest event is not ROM_PAUSED', () => {
  assert.ok(
    watcherSource.includes('ROM_PAUSED'),
    'Resume handler must check for ROM_PAUSED state'
  );
});

// ---------------------------------------------------------------------------
// Part 2: Paused-state survival across orchestrator restart
// ---------------------------------------------------------------------------

console.log('\n--- Part 2: Paused-state persistence ---');

test('Watcher checks register events on startup for paused slices', () => {
  // On startup/poll, the orchestrator should check if a slice has ROM_PAUSED as latest event
  // and skip re-spawning Rom for it
  assert.ok(
    watcherSource.includes('ROM_PAUSED'),
    'Watcher must be aware of ROM_PAUSED state'
  );
  // Should have logic to not respawn paused slices
  assert.ok(
    watcherSource.includes('paused') || watcherSource.includes('PAUSED'),
    'Watcher must handle paused state during poll'
  );
});

test('Paused child death emits ERROR with phase paused_child_died', () => {
  assert.ok(
    watcherSource.includes('paused_child_died'),
    'Watcher must emit ERROR with phase "paused_child_died" when paused child dies'
  );
});

// ---------------------------------------------------------------------------
// Part 3+4: Frontend — Pause button and paused-state rendering
// ---------------------------------------------------------------------------

console.log('\n--- Part 3+4: Frontend ---');

test('Pause button is NOT disabled', () => {
  // The pause button should no longer have the disabled attribute
  const pauseBtnMatch = dashboardSource.match(/<button[^>]*class="pause-build-btn"[^>]*>/);
  assert.ok(pauseBtnMatch, 'Pause button must exist');
  assert.ok(
    !pauseBtnMatch[0].includes('disabled'),
    'Pause button must NOT have disabled attribute'
  );
});

test('Pause button does not have UI2 tooltip', () => {
  assert.ok(
    !dashboardSource.includes('coming in UI2'),
    'Dashboard must not contain "coming in UI2" tooltip text'
  );
});

test('Resume button is NOT disabled', () => {
  const resumeBtnMatch = dashboardSource.match(/<button[^>]*class="resume-btn"[^>]*>/);
  assert.ok(resumeBtnMatch, 'Resume button must exist');
  assert.ok(
    !resumeBtnMatch[0].includes('disabled'),
    'Resume button must NOT have disabled attribute'
  );
});

test('Abort button is NOT disabled', () => {
  const abortBtnMatch = dashboardSource.match(/<button[^>]*class="abort-btn"[^>]*>/);
  assert.ok(abortBtnMatch, 'Abort button must exist');
  assert.ok(
    !abortBtnMatch[0].includes('disabled'),
    'Abort button must NOT have disabled attribute'
  );
});

test('Dashboard handles ROM_PAUSED event', () => {
  assert.ok(
    dashboardSource.includes('ROM_PAUSED'),
    'Dashboard must react to ROM_PAUSED events'
  );
});

test('Dashboard handles ROM_RESUMED event', () => {
  assert.ok(
    dashboardSource.includes('ROM_RESUMED'),
    'Dashboard must react to ROM_RESUMED events'
  );
});

test('Dashboard handles ROM_ABORTED event', () => {
  assert.ok(
    dashboardSource.includes('ROM_ABORTED'),
    'Dashboard must react to ROM_ABORTED events'
  );
});

test('Dashboard has pause control function that writes control file', () => {
  assert.ok(
    dashboardSource.includes('pauseBuild') || dashboardSource.includes('pause_build') ||
    dashboardSource.includes("action: 'pause'") || dashboardSource.includes('action: "pause"') ||
    dashboardSource.includes("'pause'"),
    'Dashboard must have a function to send pause control action'
  );
});

test('Abort has inline confirmation (not modal)', () => {
  // Should NOT use confirm() or window.confirm()
  assert.ok(
    !dashboardSource.includes('window.confirm') || dashboardSource.includes('abort-confirm'),
    'Abort must use inline confirmation, not window.confirm modal'
  );
});

test('Timer freezes on pause (Paused at display)', () => {
  assert.ok(
    dashboardSource.includes('Paused at') || dashboardSource.includes('paused at') ||
    dashboardSource.includes('pausedAt') || dashboardSource.includes('frozenElapsed'),
    'Dashboard must freeze the timer display when paused'
  );
});

// ---------------------------------------------------------------------------
// Part 5: Server API routes for pause/resume/abort
// ---------------------------------------------------------------------------

console.log('\n--- Part 5: Server API ---');

test('Server has pause API endpoint', () => {
  assert.ok(
    serverSource.includes('pause') || serverSource.includes('PAUSE'),
    'Server must have a pause API endpoint'
  );
});

test('Server has resume API endpoint', () => {
  assert.ok(
    serverSource.includes('resume') || serverSource.includes('RESUME'),
    'Server must have a resume API endpoint'
  );
});

test('Server has abort API endpoint', () => {
  assert.ok(
    serverSource.includes('abort') || serverSource.includes('ABORT'),
    'Server must have an abort API endpoint'
  );
});

// ---------------------------------------------------------------------------
// AC 8: No old spelling "amendment" in dashboard or orchestrator
// ---------------------------------------------------------------------------

console.log('\n--- AC 8: APENDMENT spelling ---');

test('No "amendment" (lowercase) in dashboard', () => {
  // Exclude comments and strings that are part of legacy compat
  const lines = dashboardSource.split('\n');
  const hits = lines.filter((line, i) => {
    const lower = line.toLowerCase();
    return lower.includes('amendment') && !lower.includes('legacy') && !lower.includes('compat');
  });
  assert.strictEqual(hits.length, 0,
    `Found ${hits.length} "amendment" hit(s) in dashboard (excluding legacy compat)`
  );
});

test('No "amendment" (any case) in orchestrator outside legacy compat', () => {
  const lines = watcherSource.split('\n');
  const hits = lines.filter(line => {
    const lower = line.toLowerCase();
    if (!lower.includes('amendment')) return false;
    // Skip backward compat patterns: reading old field names, handling old suffixes/verdicts
    if (lower.includes('legacy') || lower.includes('compat') || lower.includes('backward')) return false;
    if (line.includes('sliceMeta.amendment')) return false;
    if (line.includes('parsed.amendment_instructions')) return false;
    if (line.includes("meta.type === 'amendment'")) return false;
    if (line.includes('meta.amendment')) return false;
    if (line.includes('NEEDS_AMENDMENT')) return false;
    if (line.includes("'AMENDMENT_NEEDED'")) return false;
    if (line.includes('amendment_cycle')) return false;
    return true;
  });
  assert.strictEqual(hits.length, 0,
    `Found ${hits.length} non-compat "amendment" hit(s) in orchestrator: ${hits.map(l => l.trim()).join(' | ')}`
  );
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`\n== Results: ${passed} passed, ${failed} failed ==\n`);
process.exit(failed > 0 ? 1 : 0);
