'use strict';

/**
 * approval-provenance.js — how an approval was authorized, in one place.
 *
 * Two processes need the same answer and they do not share memory: the dashboard
 * server decides provenance when a slice is approved, and the orchestrator checks
 * it again when the slice is dispatched. Both read this module.
 *
 * ── What went wrong (2026-09-01) ─────────────────────────────────────────────
 * O'Brien reported five slices as approved by Philipp, citing HUMAN_APPROVAL
 * events. Philipp had not approved them. The claim was uncheckable: all 276
 * approval events in the register carried exactly {ts, event, slice_id, action}
 * and nothing about who or what caused them, the auto-approve sweep called the
 * same function as the Approve button (byte-identical on the wire), and the
 * dashboard rendered an unattributed event as a named human.
 *
 * ── The honest limit ─────────────────────────────────────────────────────────
 * This is a local server whose files are writable by the same OS user every
 * agent runs as. Nothing here is tamper-PROOF and no comment in this file should
 * ever claim it is. The signing secret lives on disk because the orchestrator is
 * a separate process and cannot verify a stamp it cannot recompute; anyone who
 * can read that file can forge a stamp. What this buys is tamper-EVIDENCE: the
 * ordinary ways work reaches the queue — a script, a `curl` POST, an agent
 * appending to the register, a hand-written queue file — produce no stamp at
 * all, and are recorded and rendered as machine-origin rather than as a person.
 *
 * ── The five values ──────────────────────────────────────────────────────────
 *   human-click           a person clicked Approve in the dashboard, with the
 *                         standing auto-approve policy OFF
 *   auto-approve-policy   the standing auto-approve policy was ON. A human
 *                         policy decision, but not a human decision about THIS
 *                         slice — and with the policy on the server genuinely
 *                         cannot tell a sweep from a click, so it attributes
 *                         both to the policy. Under-claiming is the safe error.
 *   machine-unknown       reached an approval path without proof of UI origin
 *   legacy-unattributed   approved before the cutover, when nothing recorded
 *                         provenance. Dispatches normally; never shown as a person.
 *   test                  written by a regression fixture, never by the product
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PROVENANCE = {
  HUMAN_CLICK:         'human-click',
  AUTO_APPROVE_POLICY: 'auto-approve-policy',
  MACHINE_UNKNOWN:     'machine-unknown',
  LEGACY_UNATTRIBUTED: 'legacy-unattributed',
  TEST:                'test',
};

const PROVENANCE_VALUES = Object.values(PROVENANCE);

/**
 * The cutover moment: work approved before it is grandfathered.
 *
 * A committed constant rather than a runtime file, on purpose. The queue holds
 * 17 PARKED and 23 DONE files and 64 of 274 commissioned slices have no approval
 * event at all; if the cutover could silently reset to "now", real in-flight work
 * would start failing the check. In git it is one auditable value that survives a
 * fresh clone, a restart and a lost state directory.
 */
const DEFAULT_CUTOVER_TS = '2026-09-05T00:00:00.000Z';

// Env flag, advisory by default — the same shape as AC_CUSTODY_ENFORCE. Philipp
// flips it to '1' once the queue is clean; until then an unprovenanced slice is
// logged and flagged and still dispatches.
const ENFORCE_ENV = 'APPROVAL_PROVENANCE_ENFORCE';

function stateDir(repoRoot)       { return path.join(repoRoot, 'bridge', 'state'); }
function secretPath(repoRoot)     { return path.join(stateDir(repoRoot), 'approval-secret'); }
function cutoverPath(repoRoot)    { return path.join(stateDir(repoRoot), 'approval-cutover.json'); }
function autoApprovePath(repoRoot){ return path.join(stateDir(repoRoot), 'auto-approve.json'); }

/** True when the strict behaviour is armed. Default: advisory. */
function isEnforcing() {
  return process.env[ENFORCE_ENV] === '1';
}

/**
 * The HMAC key, minted on first use and held at 0600.
 *
 * Whichever process boots first mints it; the other reads it. Cached per root so
 * a poll loop does not stat the file on every slice.
 */
const _secretCache = new Map();
function secretFor(repoRoot) {
  const cached = _secretCache.get(repoRoot);
  if (cached) return cached;
  const file = secretPath(repoRoot);
  let secret = null;
  try {
    secret = fs.readFileSync(file, 'utf8').trim();
  } catch (_) { /* absent — mint below */ }
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(stateDir(repoRoot), { recursive: true });
      fs.writeFileSync(file, secret + '\n', { encoding: 'utf8', mode: 0o600 });
      fs.chmodSync(file, 0o600);
    } catch (_) {
      // Unwritable state dir: keep the in-memory secret so this process still
      // signs consistently. The peer process cannot verify, which advisory mode
      // reports and enforcing mode parks — both louder than a silent pass.
    }
  }
  _secretCache.set(repoRoot, secret);
  return secret;
}

/** Test seam: forget the cached secret so a fixture root re-reads from disk. */
function _resetSecretCache() { _secretCache.clear(); }

/**
 * The cutover, most specific source first: a state file (an operator or a
 * fixture moving the line), then the env, then the committed constant.
 */
function cutoverTs(repoRoot) {
  try {
    const raw = JSON.parse(fs.readFileSync(cutoverPath(repoRoot), 'utf8'));
    if (raw && raw.ts) return String(raw.ts);
  } catch (_) { /* absent or malformed — fall through */ }
  if (process.env.APPROVAL_PROVENANCE_CUTOVER) return process.env.APPROVAL_PROVENANCE_CUTOVER;
  return DEFAULT_CUTOVER_TS;
}

/** The signed payload. Slice id is bound in, so a stamp cannot be moved between files. */
function signApproval(repoRoot, { id, provenance, ts }) {
  return crypto.createHmac('sha256', secretFor(repoRoot))
    .update(`${id}|${provenance}|${ts}`)
    .digest('hex');
}

/**
 * The three frontmatter keys that travel with the work. Written once at approval
 * and carried by every requeue path, which either updateFrontmatter()s the file
 * (preserving unknown keys) or renames it whole.
 */
function stampFrontmatter(repoRoot, { id, provenance, ts }) {
  const stampTs = ts || new Date().toISOString();
  return {
    approval_provenance: provenance,
    approval_ts:         stampTs,
    approval_sig:        signApproval(repoRoot, { id, provenance, ts: stampTs }),
  };
}

/**
 * verifyStampedMeta(repoRoot, meta, id) → { ok, provenance, reason }
 *
 * `ok` means the frontmatter carries a stamp this installation signed for this
 * slice id. A missing stamp is `ok: false` with reason 'unstamped' — the caller
 * decides whether that is legacy work or a refusal, because only the caller can
 * see the register.
 */
function verifyStampedMeta(repoRoot, meta, id) {
  const provenance = meta && meta.approval_provenance;
  const ts         = meta && meta.approval_ts;
  const sig        = meta && meta.approval_sig;
  if (!provenance && !ts && !sig) return { ok: false, provenance: null, reason: 'unstamped' };
  if (!provenance || !ts || !sig) return { ok: false, provenance: provenance || null, reason: 'incomplete-stamp' };
  if (!PROVENANCE_VALUES.includes(provenance)) {
    return { ok: false, provenance, reason: 'unknown-provenance' };
  }
  const expected = signApproval(repoRoot, { id, provenance, ts });
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sig), 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, provenance, reason: 'bad-signature' };
  }
  return { ok: true, provenance, reason: null };
}

/**
 * The standing auto-approve policy, on the server.
 *
 * It used to live only in localStorage['ds9-auto-approve'] — per browser, and
 * invisible to the log. That invisibility is what made the 2026-09-01 incident
 * unexplainable after the fact: nothing on disk recorded that the policy had
 * ever been on.
 */
function readAutoApprove(repoRoot) {
  try {
    const raw = JSON.parse(fs.readFileSync(autoApprovePath(repoRoot), 'utf8'));
    return { enabled: raw.enabled === true, ts: raw.ts || null };
  } catch (_) {
    return { enabled: false, ts: null };
  }
}

function writeAutoApprove(repoRoot, enabled) {
  const state = { enabled: enabled === true, ts: new Date().toISOString() };
  fs.mkdirSync(stateDir(repoRoot), { recursive: true });
  fs.writeFileSync(autoApprovePath(repoRoot), JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}

module.exports = {
  PROVENANCE,
  PROVENANCE_VALUES,
  DEFAULT_CUTOVER_TS,
  ENFORCE_ENV,
  isEnforcing,
  cutoverTs,
  secretFor,
  signApproval,
  stampFrontmatter,
  verifyStampedMeta,
  readAutoApprove,
  writeAutoApprove,
  secretPath,
  cutoverPath,
  autoApprovePath,
  _resetSecretCache,
};
