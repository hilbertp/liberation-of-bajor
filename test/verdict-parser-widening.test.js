'use strict';

/**
 * verdict-parser-widening.test.js
 *
 * AC 4: The orchestrator's Nog-result parsing path routes raw verdict strings
 * through translateVerdict before matching. This test synthesizes verdict blocks
 * in BOTH the current Nog vocabulary (PASS/RETURN) and the canonical vocabulary
 * (ACCEPTED/REJECTED/ESCALATE/OVERSIZED), confirming they resolve to the same
 * canonical values.
 */

const assert = require('assert');
const { translateVerdict } = require('../bridge/lifecycle-translate');

// ── Simulate the orchestrator's verdict extraction + translation ────────────
// In orchestrator.js (invokeNog callback), the flow is:
//   verdict = nogMeta.verdict ? translateVerdict(nogMeta.verdict.toUpperCase()) : null;
//   if (!verdict || !['ACCEPTED','REJECTED','ESCALATE','OVERSIZED'].includes(verdict)) { ... unreadable ... }
//   if (verdict === 'ACCEPTED') { ... pass path ... }
//   if (verdict === 'ESCALATE' || verdict === 'OVERSIZED') { ... escalate path ... }
//   else { ... return/rejected path ... }

function parseNogVerdict(rawVerdictString) {
  if (!rawVerdictString) return null;
  const translated = translateVerdict(rawVerdictString.toUpperCase());
  const VALID = ['ACCEPTED', 'REJECTED', 'ESCALATE', 'OVERSIZED'];
  if (!VALID.includes(translated)) return null; // unreadable
  return translated;
}

// ── Current Nog vocabulary (legacy — what Nog actually emits today) ─────────
// Nog's prompt says: verdict: PASS or verdict: RETURN

assert.strictEqual(parseNogVerdict('PASS'), 'ACCEPTED',
  'Legacy PASS → ACCEPTED');
assert.strictEqual(parseNogVerdict('RETURN'), 'REJECTED',
  'Legacy RETURN → REJECTED');

// These legacy values appear in register entries (read-side translateEvent)
// but NOT in Nog verdict output. Included for completeness via translateVerdict:
assert.strictEqual(parseNogVerdict('MAX_ROUNDS_EXHAUSTED'), 'REJECTED',
  'Legacy MAX_ROUNDS_EXHAUSTED → REJECTED');
assert.strictEqual(parseNogVerdict('APENDMENT_NEEDED'), 'REJECTED',
  'Legacy APENDMENT_NEEDED → REJECTED');
assert.strictEqual(parseNogVerdict('AMENDMENT_NEEDED'), 'REJECTED',
  'Legacy AMENDMENT_NEEDED → REJECTED');

// Note: ESCALATE-to-OBRIEN (mixed case with hyphens) is a register event value,
// not a Nog verdict. It doesn't round-trip through toUpperCase() because
// the map key is case-sensitive. Nog escalation uses plain 'ESCALATE'.

// ── Canonical vocabulary (future Dax-1b) ────────────────────────────────────

assert.strictEqual(parseNogVerdict('ACCEPTED'), 'ACCEPTED',
  'Canonical ACCEPTED passes through');
assert.strictEqual(parseNogVerdict('REJECTED'), 'REJECTED',
  'Canonical REJECTED passes through');
assert.strictEqual(parseNogVerdict('ESCALATE'), 'ESCALATE',
  'Canonical ESCALATE passes through');
assert.strictEqual(parseNogVerdict('OVERSIZED'), 'OVERSIZED',
  'Canonical OVERSIZED passes through');

// ── Both vocabularies resolve to the same canonical value ───────────────────

assert.strictEqual(parseNogVerdict('PASS'), parseNogVerdict('ACCEPTED'),
  'PASS and ACCEPTED resolve to same value');
assert.strictEqual(parseNogVerdict('RETURN'), parseNogVerdict('REJECTED'),
  'RETURN and REJECTED resolve to same value');

// ── Case insensitivity (toUpperCase in orchestrator path) ───────────────────

assert.strictEqual(parseNogVerdict('pass'), 'ACCEPTED',
  'lowercase pass → ACCEPTED');
assert.strictEqual(parseNogVerdict('Accepted'), 'ACCEPTED',
  'mixed case Accepted → ACCEPTED');
assert.strictEqual(parseNogVerdict('return'), 'REJECTED',
  'lowercase return → REJECTED');

// ── Invalid / null verdicts ─────────────────────────────────────────────────

assert.strictEqual(parseNogVerdict(null), null,
  'null → null (unreadable)');
assert.strictEqual(parseNogVerdict(''), null,
  'empty string → null (unreadable)');
assert.strictEqual(parseNogVerdict('UNKNOWN_VALUE'), null,
  'unknown value → null (unreadable)');

console.log('verdict-parser-widening.test.js: all tests passed');
