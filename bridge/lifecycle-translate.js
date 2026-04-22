'use strict';

/**
 * lifecycle-translate.js
 *
 * Read-time translation shim for the lifecycle naming migration
 * (LIFECYCLE-NAMES-ADR, Slice 1).
 *
 * Three pure functions translate legacy register entries and state/verdict
 * strings into canonical names. No side effects, no I/O.
 *
 * THE SHIM TRANSLATES ON READ. The register, trash, and archived slice
 * files are immutable history — never rewrite them.
 */

// ── State translation map ─────��─────────────────────────────────────────────
const STATE_MAP = {
  'PENDING':    'QUEUED',
  'EVALUATING': 'IN_REVIEW',
  'REVIEWED':   'IN_REVIEW',
  'PARKED':     'IN_REVIEW',
};

// ── Verdict translation map ─────────────────────────────────────────────────
const VERDICT_MAP = {
  'PASS':                  'ACCEPTED',
  'RETURN':                'REJECTED',
  'APENDMENT_NEEDED':      'REJECTED',
  'AMENDMENT_NEEDED':       'REJECTED',
  'ESCALATE-to-OBRIEN':    'ESCALATE',
  'MAX_ROUNDS_EXHAUSTED':  'REJECTED',
};

/**
 * translateState(legacyName) → canonical state name.
 * Unknown values pass through unchanged.
 */
function translateState(legacyName) {
  if (typeof legacyName !== 'string') return legacyName;
  return STATE_MAP[legacyName] || legacyName;
}

/**
 * translateVerdict(legacyName) → canonical verdict name.
 * Unknown values pass through unchanged.
 */
function translateVerdict(legacyName) {
  if (typeof legacyName !== 'string') return legacyName;
  return VERDICT_MAP[legacyName] || legacyName;
}

/**
 * translateEvent(rawEvent) → canonical event object | null.
 *
 * null means "drop this event" (it's a duplicate or redundant).
 * The function is stateful across a batch: call resetDedupeState() before
 * processing a new register snapshot, then call translateEvent for each
 * entry in order.
 *
 * @param {Object} rawEvent - A parsed register.jsonl entry.
 * @returns {Object|null} Canonical event, or null to drop.
 */

// Dedupe state for MERGED within a single read pass.
let _seenMerged = new Set();            // "slice_id:sha"

function resetDedupeState() {
  _seenMerged = new Set();
}

function translateEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== 'object') return rawEvent;

  const ev = rawEvent.event;
  let result;

  // REVIEWED (with verdict in body) → NOG_DECISION{verdict: derived}
  if (ev === 'REVIEWED') {
    const verdict = translateVerdict(rawEvent.verdict || '');
    result = Object.assign({}, rawEvent, {
      event: 'NOG_DECISION',
      verdict,
      round: rawEvent.round || rawEvent.cycle || rawEvent.apendment_cycle || null,
      reason: rawEvent.reason || rawEvent.failed_criteria || null,
    });
  }

  // NOG_PASS → NOG_DECISION{verdict: ACCEPTED}
  else if (ev === 'NOG_PASS') {
    result = Object.assign({}, rawEvent, {
      event: 'NOG_DECISION',
      verdict: 'ACCEPTED',
      round: rawEvent.round || null,
      reason: rawEvent.reason || rawEvent.summary || null,
    });
  }

  // REVIEW_RECEIVED (same ts as NOG_PASS or REVIEWED) → drop
  else if (ev === 'REVIEW_RECEIVED') {
    return null;
  }

  // ACCEPTED (as event) → drop (state derivable)
  else if (ev === 'ACCEPTED') {
    return null;
  }

  // ROM_WAITING_FOR_NOG → NOG_INVOKED
  else if (ev === 'ROM_WAITING_FOR_NOG') {
    result = Object.assign({}, rawEvent, {
      event: 'NOG_INVOKED',
    });
  }

  // MERGED — dedupe on (slice_id, sha)
  else if (ev === 'MERGED') {
    const key = `${rawEvent.slice_id || rawEvent.id}:${rawEvent.sha}`;
    if (_seenMerged.has(key)) {
      return null; // duplicate
    }
    _seenMerged.add(key);
    result = rawEvent;
  }

  // All other events pass through unchanged.
  else {
    result = rawEvent;
  }

  // Key normalization: ensure both "id" and "slice_id" are present.
  // New writes use "slice_id"; old entries use "id". The shim bridges both.
  if (result) {
    if (result.id && !result.slice_id) {
      result = Object.assign({}, result, { slice_id: result.id });
    } else if (result.slice_id && !result.id) {
      result = Object.assign({}, result, { id: result.slice_id });
    }
  }

  return result;
}

module.exports = {
  translateState,
  translateVerdict,
  translateEvent,
  resetDedupeState,
  // Expose maps for testing
  STATE_MAP,
  VERDICT_MAP,
};
