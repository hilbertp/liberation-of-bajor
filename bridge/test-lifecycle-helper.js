'use strict';

/**
 * test-lifecycle-helper.js — Unit test for getLatestLifecycleEvent logic.
 *
 * Run: node bridge/test-lifecycle-helper.js
 *
 * Tests that _REQUESTED events are correctly skipped when finding the latest
 * lifecycle event for a slice, which is the core fix for the Resume bug
 * (RESUME_REQUESTED poisoning the ROM_PAUSED precondition check).
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Replicate getLatestLifecycleEvent exactly as in watcher.js ───────────────
function getLatestLifecycleEvent(registerFile, sliceId) {
  const id = String(sliceId);
  try {
    const lines = fs.readFileSync(registerFile, 'utf-8').trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.id === id && !entry.event.endsWith('_REQUESTED')) return entry;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function writeRegister(file, events) {
  fs.writeFileSync(file, events.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// ── Tests ────────────────────────────────────────────────────────────────────
const tmpFile = path.join(os.tmpdir(), `ds9-test-register-${Date.now()}.jsonl`);

console.log('getLatestLifecycleEvent tests:\n');

// Test 1: RESUME_REQUESTED after ROM_PAUSED still resolves to ROM_PAUSED
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '171', event: 'COMMISSIONED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'ROM_STARTED' },
  { ts: '2026-04-21T00:03:00Z', id: '171', event: 'PAUSE_REQUESTED' },
  { ts: '2026-04-21T00:03:01Z', id: '171', event: 'ROM_PAUSED' },
  { ts: '2026-04-21T00:04:00Z', id: '171', event: 'RESUME_REQUESTED' },
]);
let result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_PAUSED',
  'RESUME_REQUESTED after ROM_PAUSED → returns ROM_PAUSED');

// Test 2: ABORT_REQUESTED after ROM_PAUSED still resolves to ROM_PAUSED
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '171', event: 'COMMISSIONED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'ROM_PAUSED' },
  { ts: '2026-04-21T00:03:00Z', id: '171', event: 'ABORT_REQUESTED' },
]);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_PAUSED',
  'ABORT_REQUESTED after ROM_PAUSED → returns ROM_PAUSED');

// Test 3: Multiple _REQUESTED events are all skipped
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '171', event: 'ROM_STARTED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'PAUSE_REQUESTED' },
  { ts: '2026-04-21T00:02:01Z', id: '171', event: 'ROM_PAUSED' },
  { ts: '2026-04-21T00:03:00Z', id: '171', event: 'RESUME_REQUESTED' },
  { ts: '2026-04-21T00:03:01Z', id: '171', event: 'RESUME_REQUESTED' },
  { ts: '2026-04-21T00:03:02Z', id: '171', event: 'RESUME_REQUESTED' },
]);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_PAUSED',
  'Three RESUME_REQUESTED after ROM_PAUSED → still returns ROM_PAUSED');

// Test 4: Non-matching slice IDs are ignored
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '170', event: 'ROM_STARTED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'ROM_PAUSED' },
  { ts: '2026-04-21T00:03:00Z', id: '170', event: 'DONE' },
]);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_PAUSED',
  'Events for other slices are ignored');

// Test 5: Returns null for unknown slice
result = getLatestLifecycleEvent(tmpFile, '999');
assert(result === null, 'Unknown slice → returns null');

// Test 6: ROM_ABORTED with reason field is preserved
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '171', event: 'ROM_STARTED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'ROM_ABORTED', reason: 'manual' },
]);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_ABORTED' && result.reason === 'manual',
  'ROM_ABORTED with reason:"manual" is returned with extra fields');

// Test 7: Lifecycle events after _REQUESTED are found correctly
writeRegister(tmpFile, [
  { ts: '2026-04-21T00:01:00Z', id: '171', event: 'PAUSE_REQUESTED' },
  { ts: '2026-04-21T00:01:01Z', id: '171', event: 'ROM_PAUSED' },
  { ts: '2026-04-21T00:02:00Z', id: '171', event: 'RESUME_REQUESTED' },
  { ts: '2026-04-21T00:02:01Z', id: '171', event: 'ROM_RESUMED' },
]);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result && result.event === 'ROM_RESUMED',
  'ROM_RESUMED after RESUME_REQUESTED → returns ROM_RESUMED');

// Test 8: Empty register returns null
writeRegister(tmpFile, []);
result = getLatestLifecycleEvent(tmpFile, '171');
assert(result === null, 'Empty register → returns null');

// ── Cleanup & summary ────────────────────────────────────────────────────────
try { fs.unlinkSync(tmpFile); } catch (_) {}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('All tests passed.');
