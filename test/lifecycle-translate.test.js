'use strict';

const assert = require('assert');
const {
  translateState,
  translateVerdict,
  translateEvent,
  resetDedupeState,
  STATE_MAP,
  VERDICT_MAP,
} = require('../bridge/lifecycle-translate');

// ─────────────────────────────────────────────────────────────────────────────
// CI guard: every map entry must have a corresponding test.
// If a new entry is added to the map without a test here, this block fails.
// ─────────────────────���───────────────────────────────────────────────────────

const TESTED_STATE_KEYS = new Set();
const TESTED_VERDICT_KEYS = new Set();

// ── translateState ──────────────────────────────────────────────────────────

function testState(legacy, expected) {
  TESTED_STATE_KEYS.add(legacy);
  assert.strictEqual(translateState(legacy), expected,
    `translateState('${legacy}') should be '${expected}'`);
}

testState('PENDING', 'QUEUED');
testState('EVALUATING', 'IN_REVIEW');
testState('REVIEWED', 'IN_REVIEW');
testState('PARKED', 'IN_REVIEW');

// Pass-through for unknown/canonical names
assert.strictEqual(translateState('QUEUED'), 'QUEUED', 'canonical QUEUED passes through');
assert.strictEqual(translateState('IN_PROGRESS'), 'IN_PROGRESS', 'IN_PROGRESS passes through');
assert.strictEqual(translateState('DONE'), 'DONE', 'DONE passes through');
assert.strictEqual(translateState('STUCK'), 'STUCK', 'STUCK passes through');
assert.strictEqual(translateState(null), null, 'null passes through');
assert.strictEqual(translateState(undefined), undefined, 'undefined passes through');

// ── translateVerdict ──────���─────────────────────────────────────────────────

function testVerdict(legacy, expected) {
  TESTED_VERDICT_KEYS.add(legacy);
  assert.strictEqual(translateVerdict(legacy), expected,
    `translateVerdict('${legacy}') should be '${expected}'`);
}

testVerdict('PASS', 'ACCEPTED');
testVerdict('RETURN', 'REJECTED');
testVerdict('APENDMENT_NEEDED', 'REJECTED');
testVerdict('AMENDMENT_NEEDED', 'REJECTED');
testVerdict('ESCALATE-to-OBRIEN', 'ESCALATE');
testVerdict('MAX_ROUNDS_EXHAUSTED', 'REJECTED');

// Pass-through for canonical/unknown verdicts
assert.strictEqual(translateVerdict('ACCEPTED'), 'ACCEPTED', 'canonical ACCEPTED passes through');
assert.strictEqual(translateVerdict('REJECTED'), 'REJECTED', 'canonical REJECTED passes through');
assert.strictEqual(translateVerdict('ESCALATE'), 'ESCALATE', 'canonical ESCALATE passes through');
assert.strictEqual(translateVerdict('OVERSIZED'), 'OVERSIZED', 'OVERSIZED passes through');
assert.strictEqual(translateVerdict(null), null, 'null passes through');

// ── translateEvent ───────────────────────────────────────��──────────────────

// Reset before each batch
resetDedupeState();

// REVIEWED → NOG_DECISION with derived verdict
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '100', event: 'REVIEWED',
    verdict: 'APENDMENT_NEEDED', failed_criteria: 'AC 3 failed', cycle: 2, round: 2, apendment_cycle: 2,
  });
  assert.strictEqual(result.event, 'NOG_DECISION', 'REVIEWED → NOG_DECISION');
  assert.strictEqual(result.verdict, 'REJECTED', 'APENDMENT_NEEDED verdict → REJECTED');
  assert.strictEqual(result.round, 2, 'round preserved');
  assert.strictEqual(result.reason, 'AC 3 failed', 'failed_criteria becomes reason');
}

// NOG_PASS → NOG_DECISION{verdict: ACCEPTED}
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '101', event: 'NOG_PASS', round: 1,
  });
  assert.strictEqual(result.event, 'NOG_DECISION', 'NOG_PASS → NOG_DECISION');
  assert.strictEqual(result.verdict, 'ACCEPTED', 'NOG_PASS verdict → ACCEPTED');
  assert.strictEqual(result.round, 1, 'round preserved');
}

// REVIEW_RECEIVED → drop
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '100', event: 'REVIEW_RECEIVED', verdict: 'ACCEPTED',
  });
  assert.strictEqual(result, null, 'REVIEW_RECEIVED is dropped');
}

// ACCEPTED (as event) → drop
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '100', event: 'ACCEPTED', cycle: 0,
  });
  assert.strictEqual(result, null, 'ACCEPTED event is dropped');
}

// ROM_WAITING_FOR_NOG → NOG_INVOKED
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '102', event: 'ROM_WAITING_FOR_NOG', round: 1,
  });
  assert.strictEqual(result.event, 'NOG_INVOKED', 'ROM_WAITING_FOR_NOG → NOG_INVOKED');
  assert.strictEqual(result.round, 1, 'round preserved');
}

// MERGED — first occurrence passes through
resetDedupeState();
{
  const result = translateEvent({
    ts: '2026-04-01T00:00:00Z', id: '103', event: 'MERGED',
    branch: 'slice/103', sha: 'abc1234', slice_id: '103',
  });
  assert.ok(result !== null, 'first MERGED passes through');
  assert.strictEqual(result.event, 'MERGED', 'MERGED event name preserved');
}

// MERGED — duplicate on (slice_id, sha) → drop
{
  const result = translateEvent({
    ts: '2026-04-01T00:01:00Z', id: '103', event: 'MERGED',
    branch: 'slice/103', sha: 'abc1234', slice_id: '103',
  });
  assert.strictEqual(result, null, 'duplicate MERGED (same slice_id+sha) is dropped');
}

// MERGED — different sha passes through
{
  const result = translateEvent({
    ts: '2026-04-01T00:02:00Z', id: '103', event: 'MERGED',
    branch: 'slice/103', sha: 'def5678', slice_id: '103',
  });
  assert.ok(result !== null, 'MERGED with different sha passes through');
}

// Other events pass through unchanged (with id → slice_id normalization)
{
  const commissioned = { ts: '2026-04-01T00:00:00Z', id: '104', event: 'COMMISSIONED', title: 'test' };
  const result = translateEvent(commissioned);
  assert.strictEqual(result.event, 'COMMISSIONED', 'COMMISSIONED event passes through');
  assert.strictEqual(result.slice_id, '104', 'id normalized to slice_id');
  assert.strictEqual(result.id, '104', 'original id preserved');
}

{
  const done = { ts: '2026-04-01T00:00:00Z', id: '105', event: 'DONE', durationMs: 1000 };
  const result = translateEvent(done);
  assert.strictEqual(result.event, 'DONE', 'DONE event passes through');
  assert.strictEqual(result.slice_id, '105', 'id normalized to slice_id');
}

{
  const error = { ts: '2026-04-01T00:00:00Z', id: '106', event: 'ERROR', reason: 'crash' };
  const result = translateEvent(error);
  assert.strictEqual(result.event, 'ERROR', 'ERROR event passes through');
  assert.strictEqual(result.slice_id, '106', 'id normalized to slice_id');
}

// New-format entries with slice_id but no id get id backfilled
{
  const newEntry = { ts: '2026-04-01T00:00:00Z', slice_id: '107', event: 'NOG_DECISION', verdict: 'ACCEPTED' };
  const result = translateEvent(newEntry);
  assert.strictEqual(result.id, '107', 'slice_id backfilled to id');
  assert.strictEqual(result.slice_id, '107', 'slice_id preserved');
}

// Entries with both id and slice_id are left alone
{
  const both = { ts: '2026-04-01T00:00:00Z', id: '108', slice_id: '108', event: 'MERGED', sha: 'xyz' };
  resetDedupeState();
  const result = translateEvent(both);
  assert.strictEqual(result.id, '108', 'both keys present — id unchanged');
  assert.strictEqual(result.slice_id, '108', 'both keys present — slice_id unchanged');
}

// null / undefined input
assert.strictEqual(translateEvent(null), null, 'null input returns null');
assert.strictEqual(translateEvent(undefined), undefined, 'undefined input returns undefined');

// ── CI guard: all map entries tested ────────────────────────────────────────

for (const key of Object.keys(STATE_MAP)) {
  assert.ok(TESTED_STATE_KEYS.has(key),
    `STATE_MAP key '${key}' has no corresponding test — add one`);
}

for (const key of Object.keys(VERDICT_MAP)) {
  assert.ok(TESTED_VERDICT_KEYS.has(key),
    `VERDICT_MAP key '${key}' has no corresponding test — add one`);
}

console.log('lifecycle-translate.test.js: all tests passed');
