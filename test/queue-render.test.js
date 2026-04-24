'use strict';

/**
 * queue-render.test.js
 *
 * Regression tests for slice 203 — terminal-state filtering in Queue panel.
 *
 * Covers:
 *   1. Backend filter (mirrors server.js buildBridgeData): ACCEPTED/ARCHIVED/SLICE
 *      file-system markers exclude a slice from the queue slices array.
 *   2. Backend filter: MERGED register events exclude DONE slices.
 *   3. Backend filter: non-terminal DONE slices (awaiting Nog) are included.
 *   4. Frontend defensive filter (mirrors lcars-dashboard.html buildQueueRows):
 *      DONE rows with MERGED events are excluded even if backend leaks them.
 *   5. Frontend defensive filter: DONE slices without MERGED events are shown.
 *   6. History endpoint sanity: merged slices still appear in the recent array
 *      (history is register-event-based, independent of queue files).
 *
 * Synthetic seed (5 slices):
 *   100 — QUEUED        (non-terminal: include in queue)
 *   101 — IN_PROGRESS   (non-terminal: include in queue)
 *   102 — DONE          (non-terminal, awaiting Nog: include in queue)
 *   103 — ACCEPTED+merged (terminal via file marker: exclude from queue, show in history)
 *   104 — ARCHIVED       (terminal via file marker: exclude from queue, show in history)
 *
 * Run: node test/queue-render.test.js
 */

const assert = require('assert');

// ── Backend filter logic ─────────────────────────────────────────────────────
// Pure re-implementation of the terminal-filter logic in buildBridgeData()
// (dashboard/server.js). Keeps the test self-contained.

const TERMINAL_FILE_RE  = /^(.+?)-(ACCEPTED|ARCHIVED|SLICE)\.md$/;
const QUEUE_FILE_RE     = /^(.+?)-(PENDING|QUEUED|IN_PROGRESS|DONE|ERROR)\.md$/;

/**
 * Given a list of queue directory filenames and translated register events,
 * return only the non-terminal slices (mirroring the filter in buildBridgeData).
 *
 * @param {string[]} files  - .md filenames from QUEUE_DIR
 * @param {object[]} events - translated register events (with .event and .id fields)
 * @returns {{ id: string, state: string }[]}
 */
function filterQueueSlices(files, events = []) {
  // MERGED register events mark a slice as terminal (landed on main)
  const mergedIds = new Set();
  for (const ev of events) {
    if (ev.event === 'MERGED') mergedIds.add(String(ev.id));
  }

  // Filesystem ACCEPTED / ARCHIVED / SLICE markers also mark a slice as terminal
  const terminalIds = new Set(mergedIds);
  for (const f of files) {
    const m = f.match(TERMINAL_FILE_RE);
    if (m) terminalIds.add(String(m[1]));
  }

  // Collect non-terminal slices
  const result = [];
  for (const f of files) {
    const m = f.match(QUEUE_FILE_RE);
    if (!m) continue;
    const [, rawId, state] = m;
    if (terminalIds.has(rawId)) continue;
    result.push({ id: rawId, state });
  }
  return result;
}

// ── Frontend defensive filter logic ─────────────────────────────────────────
// Pure re-implementation of the DONE-row filter added to buildQueueRows()
// (dashboard/lcars-dashboard.html). Tests the defensive guard independently.

/**
 * Given slices from the API and cached register events, return DONE rows
 * that are not MERGED (i.e., still awaiting Nog or operator action).
 */
function buildDoneRows(slices, registerEvents = []) {
  const mergedIds = new Set(
    registerEvents.filter(e => e.event === 'MERGED').map(e => String(e.id))
  );
  return slices.filter(b => b.state === 'DONE' && !mergedIds.has(String(b.id)));
}

// ── History logic ────────────────────────────────────────────────────────────
// Minimal re-implementation of the completedMap build in buildBridgeData.
// History is built from DONE/ERROR register events — independent of queue files.

function buildHistory(events) {
  const completedMap = {};
  for (const ev of events) {
    if (ev.event === 'DONE' || ev.event === 'ERROR') {
      completedMap[ev.id] = { id: ev.id, outcome: ev.event };
    }
  }
  return Object.values(completedMap);
}

// ── Synthetic seed ───────────────────────────────────────────────────────────

const syntheticFiles = [
  '100-QUEUED.md',       // non-terminal: include
  '101-IN_PROGRESS.md',  // non-terminal: include
  '102-DONE.md',         // non-terminal DONE (awaiting Nog): include
  '103-ACCEPTED.md',     // terminal marker for slice 103
  '103-DONE.md',         // DONE for 103 — terminal because ACCEPTED marker exists
  '104-ARCHIVED.md',     // terminal marker for slice 104
  '104-DONE.md',         // DONE for 104 — terminal because ARCHIVED marker exists
];

// Register events for the synthetic seed:
// slices 103 and 104 have MERGED events (belt-and-suspenders with file markers).
const syntheticEvents = [
  { event: 'MERGED', id: '103', ts: '2026-01-10T00:00:00Z' },
  { event: 'MERGED', id: '104', ts: '2026-01-09T00:00:00Z' },
  // History DONE events (what the register writes when O'Brien finishes)
  { event: 'DONE',   id: '100', ts: '2026-01-08T00:00:00Z' },
  { event: 'DONE',   id: '101', ts: '2026-01-07T00:00:00Z' },
  { event: 'DONE',   id: '102', ts: '2026-01-06T00:00:00Z' },
  { event: 'DONE',   id: '103', ts: '2026-01-05T00:00:00Z' },
  { event: 'DONE',   id: '104', ts: '2026-01-04T00:00:00Z' },
];

// ── Test 1: backend — filesystem markers exclude terminal slices ──────────────

const queueSlices = filterQueueSlices(syntheticFiles, syntheticEvents);

assert.strictEqual(queueSlices.length, 3,
  'Queue should contain exactly 3 non-terminal slices (QUEUED + IN_PROGRESS + DONE)');

assert.ok(queueSlices.some(s => s.id === '100' && s.state === 'QUEUED'),
  'Slice 100 (QUEUED) must be in queue');
assert.ok(queueSlices.some(s => s.id === '101' && s.state === 'IN_PROGRESS'),
  'Slice 101 (IN_PROGRESS) must be in queue');
assert.ok(queueSlices.some(s => s.id === '102' && s.state === 'DONE'),
  'Slice 102 (non-merged DONE) must be in queue');

assert.ok(!queueSlices.some(s => s.id === '103'),
  'Slice 103 (ACCEPTED+MERGED) must be absent from queue');
assert.ok(!queueSlices.some(s => s.id === '104'),
  'Slice 104 (ARCHIVED+MERGED) must be absent from queue');

// ── Test 2: backend — MERGED events alone (no filesystem marker) exclude slice ─

const filesNoMarkers = [
  '200-QUEUED.md',
  '201-IN_PROGRESS.md',
  '202-DONE.md',   // non-merged: include
  '199-DONE.md',   // merged via register event: exclude
  '198-DONE.md',   // merged via register event: exclude
];
const mergedOnlyEvents = [
  { event: 'MERGED', id: '199', ts: '2026-01-01T00:00:00Z' },
  { event: 'MERGED', id: '198', ts: '2026-01-01T00:00:00Z' },
  { event: 'DONE',   id: '202', ts: '2026-01-01T00:00:00Z' },
];

const result2 = filterQueueSlices(filesNoMarkers, mergedOnlyEvents);
assert.strictEqual(result2.length, 3,
  'MERGED-only filter: 3 non-terminal slices expected');
assert.ok(!result2.some(s => s.id === '199'), 'MERGED slice 199 absent from queue');
assert.ok(!result2.some(s => s.id === '198'), 'MERGED slice 198 absent from queue');
assert.ok(result2.some(s => s.id === '202'),  'Non-merged DONE 202 present in queue');

// ── Test 3: backend — no terminal events → all slices included ────────────────

const result3 = filterQueueSlices(filesNoMarkers, []);
assert.strictEqual(result3.length, 5,
  'Without terminal signals, all 5 DONE/QUEUED/IN_PROGRESS files are included');

// ── Test 4: frontend — DONE rows with MERGED events are excluded ──────────────

const apiSlices = [
  { id: '200', state: 'DONE' },  // non-merged: show
  { id: '199', state: 'DONE' },  // merged: hide
  { id: '198', state: 'DONE' },  // merged: hide
  { id: '201', state: 'QUEUED' },// not a DONE row — unaffected
];
const frontendEvents = [
  { event: 'MERGED', id: '199' },
  { event: 'MERGED', id: '198' },
];

const doneRows = buildDoneRows(apiSlices, frontendEvents);
assert.strictEqual(doneRows.length, 1, 'Only non-merged DONE slice shown in Queue');
assert.strictEqual(doneRows[0].id, '200', 'Non-merged DONE id=200 appears in Queue');

// ── Test 5: frontend — without MERGED events, all DONE slices are shown ───────

const doneRows2 = buildDoneRows(apiSlices, []);
assert.strictEqual(doneRows2.length, 3,
  'Without MERGED events, all 3 DONE slices are shown (defensive filter is a no-op)');

// ── Test 6: history — merged slices still appear in recent (history is register-based) ─

const history = buildHistory(syntheticEvents);
assert.strictEqual(history.length, 5,
  'History includes all 5 DONE events (merged + non-merged)');
assert.ok(history.some(h => h.id === '103'),
  'Merged slice 103 appears in history');
assert.ok(history.some(h => h.id === '104'),
  'Archived/merged slice 104 appears in history');
assert.ok(history.some(h => h.id === '102'),
  'Non-merged DONE slice 102 also appears in history');

console.log('queue-render.test.js: all 6 tests passed');
