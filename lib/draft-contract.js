'use strict';
// ── draft-contract.js — what a DRAFT guard must contain to be APPLICABLE (slice 357) ──
//
// scripts/author-ac-test.js has Julian propose a guard for a flagged AC into
// regression/.drafts/. "Apply" means moving that draft into the live suite — and a draft
// that lacks what the coverage deriver needs can be moved in, run, PASS, and change
// NOTHING in COVERAGE.lock: the AC stays flagged and the only remaining control is
// "No test needed for this AC." A well-meant apply silently weakens the suite.
//
// So a draft is only a draft when it is applicable BY CONSTRUCTION:
//
//   1. ANNOTATION — `// @ac-hash: <tag> sha256:<64 hex>` naming its own tag, carrying the
//      SPEC's hash (scripts/build-ac-manifest.js acHashOf). lib/ac-reconcile.js compares
//      that string to the manifest's acHash with ===, so a truncated or invented hash
//      classifies the AC STALE forever — the annotation looks right and buys nothing.
//   2. TAG IN A test() TITLE — the deriver's form-2 registration only fires for tags that
//      tagsIn() finds in a test title. An annotation alone registers zero coverage.
//   3. EXTENSION — `.test.js` (node:test, lands under regression/) or `.spec.js`
//      (Playwright, lands under e2e/). Nothing else: `npm test` globs
//      'regression/**/*.test.js' and the coverage walkers take *.test.js / *.spec.js only,
//      so any other extension is invisible to both the runner and the map, forever.
//   4. DECLARED TARGET — a `<tag>.target.json` companion saying whether the draft is a NEW
//      guard at a path, or REPLACES a named existing one. Several live drafts are rewrites
//      of existing guards; applied as new files both copies run and both register,
//      inflating guardCount — and the anti-shrink ratchet then demands a `Coverage-Removed:`
//      trailer just to delete the duplicate.
//
// The annotation and title parsing are NOT reimplemented here: acHashesIn/tagsIn are
// imported from the deriver itself, so "the exact form the coverage map recognises" cannot
// drift out from under this contract. This module only says what a draft must CONTAIN; it
// never changes how coverage is derived.
//
// Pure over the strings/paths handed in (no clock, no git, no network); the only I/O is
// reading the drafts directory in auditDrafts() and the optional target-existence checks.

const fs = require('fs');
const path = require('path');
const { acHashesIn, tagsIn } = require('../scripts/build-coverage-map');

// The two extensions BOTH the suite runner and the coverage walkers pick up.
//   .test.js → node --test 'regression/**/*.test.js' + walkTests()
//   .spec.js → playwright test (e2e/) + walkSpecs()
const EXTENSIONS = {
  'test.js': { kind: 'node:test', dir: 'regression/' },
  'spec.js': { kind: 'playwright', dir: 'e2e/' },
};
const DRAFT_NAME_RE = /^(slice-\d+-ac-\d+)\.draft\.(.+)$/;
// The full 64-hex spec hash. build-coverage-map's own regex accepts {6,64} so a truncated
// hash still PARSES — but ac-reconcile matches it against the manifest with ===, so only
// the full digest can ever read COVERED.
const FULL_HASH_RE = /^sha256:[0-9a-f]{64}$/;

const targetName = (tag) => `${tag}.target.json`;
const draftName = (tag, ext) => `${tag}.draft.${ext}`;

// The one annotation line a draft for `tag` must carry. Built by concatenation so this
// module can be read by tests without the literal ever being mistaken for a real guard.
function annotationFor(tag, acHash) {
  return '// @ac-' + 'hash: ' + tag + ' ' + acHash;
}

// { tag, ext } for a well-formed draft filename, else null.
function parseDraftName(filename) {
  const m = DRAFT_NAME_RE.exec(String(filename));
  return m ? { tag: m[1], ext: m[2] } : null;
}

const err = (code, message) => ({ code, message });

// Does the declared landing path suit the draft's extension?
function checkTargetPath(p, ext, label) {
  const out = [];
  if (typeof p !== 'string' || !p.trim()) {
    out.push(err('E_TARGET_PATH', `${label} must be a non-empty repo-relative path`));
    return out;
  }
  if (p.startsWith('/') || p.includes('\\') || p.split('/').includes('..')) {
    out.push(err('E_TARGET_PATH', `${label} must be a repo-relative POSIX path without ".." (got "${p}")`));
    return out;
  }
  const spec = EXTENSIONS[ext];
  if (!p.endsWith('.' + ext)) {
    out.push(err('E_TARGET_PATH', `${label} "${p}" must end in .${ext} to match the draft`));
  }
  if (spec && !p.startsWith(spec.dir)) {
    out.push(err('E_TARGET_PATH', `a .${ext} draft lands under ${spec.dir} — "${p}" does not`));
  }
  return out;
}

/**
 * validateDraft({ filename, source, target, expectedAcHash, repoRoot }) → { tag, ext, errors }
 *
 *   filename       — the draft's basename, e.g. "slice-357-ac-1.draft.test.js"
 *   source         — the draft's file content
 *   target         — the parsed <tag>.target.json companion, or null/undefined when absent
 *   expectedAcHash — the SPEC hash this guard must claim ("sha256:<64 hex>"); when omitted
 *                    only the FORM of the annotation is checked, never its value
 *   repoRoot       — when given, `replaces:` must name an existing file and `new:` must not
 *
 * `errors` is empty exactly when the draft is applicable.
 */
function validateDraft(opts) {
  const o = opts || {};
  const filename = String(o.filename || '');
  const source = typeof o.source === 'string' ? o.source : '';
  const errors = [];

  const parsed = parseDraftName(filename);
  if (!parsed) {
    errors.push(err('E_FILENAME', `"${filename}" is not <slice-N-ac-K>.draft.<ext>`));
    return { tag: null, ext: null, errors };
  }
  const { tag, ext } = parsed;

  if (!Object.prototype.hasOwnProperty.call(EXTENSIONS, ext)) {
    errors.push(err('E_EXTENSION',
      `extension ".${ext}" is picked up by neither the suite runner nor the coverage walker — use ${Object.keys(EXTENSIONS).map(e => '.' + e).join(' or ')}`));
  }

  // 1 + 2 — the annotation and the test title, read with the DERIVER'S OWN parsers.
  const annotated = acHashesIn(source)[tag];
  if (!annotated) {
    errors.push(err('E_ANNOTATION_MISSING',
      `no "${annotationFor(tag, 'sha256:<64 hex>')}" line the coverage deriver recognises — the draft would register no coverage`));
  } else {
    if (!FULL_HASH_RE.test(annotated)) {
      errors.push(err('E_ANNOTATION_HASH_FORM',
        `annotation hash "${annotated}" is not a full sha256:<64 hex> — a short hash parses but can never match the manifest`));
    }
    if (o.expectedAcHash && annotated !== o.expectedAcHash) {
      errors.push(err('E_ANNOTATION_HASH_MISMATCH',
        `annotation claims ${annotated} but the spec's hash is ${o.expectedAcHash} — the AC would classify STALE`));
    }
  }
  if (!tagsIn(source).includes(tag)) {
    errors.push(err('E_TAG_NOT_IN_TITLE',
      `no test() title mentions ${tag} — the deriver registers an annotation only alongside a tagged title`));
  }

  // 3 — the declared target.
  const t = o.target;
  if (t == null) {
    errors.push(err('E_TARGET_MISSING',
      `no ${targetName(tag)} companion — a draft must declare a new path or the guard it replaces`));
  } else if (typeof t !== 'object' || Array.isArray(t)) {
    errors.push(err('E_TARGET_MALFORMED', `${targetName(tag)} must be a JSON object`));
  } else {
    const hasNew = Object.prototype.hasOwnProperty.call(t, 'new');
    const hasReplaces = Object.prototype.hasOwnProperty.call(t, 'replaces');
    if (hasNew === hasReplaces) {
      errors.push(err('E_TARGET_MALFORMED',
        `${targetName(tag)} must declare exactly one of "new" or "replaces" (found ${hasNew ? 'both' : 'neither'})`));
    } else if (t.tag != null && t.tag !== tag) {
      errors.push(err('E_TARGET_MALFORMED', `${targetName(tag)} names tag "${t.tag}" but belongs to ${tag}`));
    } else {
      const label = hasNew ? '"new"' : '"replaces"';
      const declared = hasNew ? t.new : t.replaces;
      const pathErrors = checkTargetPath(declared, ext, label);
      errors.push(...pathErrors);
      if (!pathErrors.length && o.repoRoot) {
        const abs = path.join(o.repoRoot, declared);
        const exists = fs.existsSync(abs);
        if (hasReplaces && !exists) {
          errors.push(err('E_TARGET_ABSENT',
            `"replaces" names ${declared}, which does not exist — nothing to replace`));
        }
        if (hasNew && exists) {
          errors.push(err('E_TARGET_EXISTS',
            `"new" names ${declared}, which already exists — declare it as "replaces" or pick another path, or applying duplicates the guard`));
        }
      }
    }
  }

  return { tag, ext, errors };
}

// The spec hash for `tag` per the committed AC-MANIFEST.lock, or null when the manifest
// does not know it (a not-yet-landed AC) or holds it unhashed (legacy: true).
function manifestAcHash(repoRoot, tag) {
  try {
    const man = JSON.parse(fs.readFileSync(path.join(repoRoot, 'regression', 'AC-MANIFEST.lock'), 'utf8'));
    const e = man.byTag && man.byTag[tag];
    return e && !e.legacy && e.acHash ? e.acHash : null;
  } catch (_) { return null; }
}

/**
 * auditDrafts(draftsDir, { repoRoot, ignoreTag }) → [{ file, tag, errors }, …]
 *
 * Every `*.draft.*` in the directory that violates the contract, in filename order.
 * An absent or empty directory yields []. When repoRoot is given, each draft's expected
 * hash is looked up in AC-MANIFEST.lock (skipped for tags the manifest does not hash, so a
 * fresh AC is judged on FORM only) and the declared target is existence-checked.
 * `ignoreTag(tag)` opts individual tags out — the live audit uses it to skip the reserved
 * fixture range that other suites write into the same directory mid-run.
 */
function auditDrafts(draftsDir, opts) {
  const o = opts || {};
  let files;
  try { files = fs.readdirSync(draftsDir); } catch (_) { return []; }
  const out = [];
  for (const file of files.sort()) {
    if (!file.includes('.draft.')) continue;
    const parsed = parseDraftName(file);
    if (parsed && o.ignoreTag && o.ignoreTag(parsed.tag)) continue;
    let source = '';
    try { source = fs.readFileSync(path.join(draftsDir, file), 'utf8'); } catch (_) {}
    let target = null;
    if (parsed) {
      try { target = JSON.parse(fs.readFileSync(path.join(draftsDir, targetName(parsed.tag)), 'utf8')); }
      catch (_) { target = null; }
    }
    const res = validateDraft({
      filename: file,
      source,
      target,
      repoRoot: o.repoRoot,
      expectedAcHash: parsed && o.repoRoot ? manifestAcHash(o.repoRoot, parsed.tag) : null,
    });
    if (res.errors.length) out.push({ file, tag: res.tag, errors: res.errors });
  }
  return out;
}

// One human-readable block per violating draft, for a console or a REJECTED report.
function formatViolations(violations) {
  return (violations || [])
    .map(v => `${v.file}\n` + v.errors.map(e => `  ✗ [${e.code}] ${e.message}`).join('\n'))
    .join('\n');
}

module.exports = {
  EXTENSIONS, FULL_HASH_RE,
  annotationFor, parseDraftName, draftName, targetName,
  validateDraft, auditDrafts, manifestAcHash, formatViolations,
};
