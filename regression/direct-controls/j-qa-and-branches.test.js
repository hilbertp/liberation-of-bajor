'use strict';
// J-qa-and-branches — slice 382: the first operations panel is named for what it SHOWS
// (the QA gate sequence and the branch topology), not for a job function.
//
// The rename touches three surfaces that must agree — the visible title, the collapse
// button's accessible label, and the collapsed mini-view's SVG label — plus the acceptance
// criterion that pinned the old name (slice-340-ac-1, restated here under AC-Change-OK with
// Spec-Owner: Philipp). The guards below hold all four together, and hold the boundary
// around e2e/devops-station.spec.js, which is Julian's file to update at his stage.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const DASH = path.join(REPO, 'dashboard', 'lcars-dashboard.html');
const MANIFEST = path.join(REPO, 'regression', 'AC-MANIFEST.lock');
const COVERAGE = path.join(REPO, 'regression', 'COVERAGE.lock');
const GUARD_340 = path.join(REPO, 'regression', 'direct-controls', 'j-devops-station.test.js');
const E2E_SPEC = path.join(REPO, 'e2e', 'devops-station.spec.js');

const html = () => fs.readFileSync(DASH, 'utf8');
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const PANEL_NAME = 'QA and Branches';
const OLD_NAME = 'DevOps Station';

// The panel title's own text node — everything before the nested <span> children (the lore
// tag and the owner chip), which are NOT part of the name.
function panelTitleText(src) {
  const m = /<span class="topo-panel-title">([^<]*)</.exec(src);
  assert.ok(m, 'the .topo-panel-title span must exist and open with its title text');
  return m[1].trim();
}

// @ac-hash: slice-382-ac-1 sha256:85399f6f32a32b58829c58103339e5144eeac4b7dadd9285cb5c6feb7c885fae
test('J-qa-and-branches slice-382-ac-1 — the FIRST operations panel is titled "QA and Branches"', () => {
  const src = html();
  assert.equal(panelTitleText(src), PANEL_NAME);

  // "First" is load-bearing: this is the panel at the top of the operations page, ahead of
  // Active Build, Peer Review, Backlog Queue, History and Economics.
  const first = src.indexOf('<span class="topo-panel-title">');
  assert.ok(first > 0, 'the panel title must be present');
  for (const later of ['class="active-slice-label"', 'class="section-title"', 'class="inv-panel-title"']) {
    const at = src.indexOf(later);
    assert.ok(at === -1 || at > first, `${later} must come after the first operations panel's title`);
  }

  // Named for what it shows — not for the job function it used to carry, and not for the
  // data structure it draws.
  assert.notEqual(panelTitleText(src), OLD_NAME);
  assert.doesNotMatch(src, /class="[^"]*panel-title[^"]*"[^>]*>\s*Branch Topology/i);
});

// @ac-hash: slice-382-ac-2 sha256:43a4e9422dac2f00fe2d6a10b77e1d6b1713af71d5bc39c0c168494744760f5e
test('J-qa-and-branches slice-382-ac-2 — the collapse button and the collapsed SVG name the panel exactly as the visible title does', () => {
  const src = html();
  const title = panelTitleText(src);

  // Derived from the visible title, never hardcoded: a future rename that misses one of the
  // accessible labels fails here rather than shipping a screen reader that says the old name.
  const collapseBtn = /<button class="topo-collapse-btn"[^>]*aria-label="([^"]*)"/.exec(src);
  assert.ok(collapseBtn, 'the collapse button must carry an aria-label');
  assert.ok(collapseBtn[1].includes(title), `collapse button aria-label "${collapseBtn[1]}" must name the panel "${title}"`);

  const miniSvg = /<svg[^>]*role="img"[^>]*aria-label="([^"]*collapsed)"/.exec(src);
  assert.ok(miniSvg, 'the collapsed mini-view SVG must carry an aria-label');
  assert.ok(miniSvg[1].includes(title), `collapsed SVG aria-label "${miniSvg[1]}" must name the panel "${title}"`);

  for (const label of [collapseBtn[1], miniSvg[1]]) assert.ok(!label.includes(OLD_NAME), `"${label}" still says ${OLD_NAME}`);
});

// @ac-hash: slice-382-ac-3 sha256:f85eadb21aea4b541ea827bcf39de5c9d53fc46068acb63ba93bda18172dd4d7
test('J-qa-and-branches slice-382-ac-3 — the owner chip, the lore tag and every selector hook survive the rename', () => {
  const src = html();

  // The lore tag is the LCARS-mode name; the owner chip is Julian's. Neither is part of the
  // rename, and tests elsewhere select the crew by data-role, never by display name.
  assert.match(src, /<span class="topo-panel-title">QA and Branches<span class="lore-tag"> \(Infirmary\)<\/span> <span class="panel-owner" data-role="bashir">QA Engineer<\/span><\/span>/);

  // Renaming any of these would break selectors for no user-visible gain.
  for (const hook of [
    'class="topo-panel"', 'id="topo-panel"', 'class="topo-panel-head"', 'class="topo-head-text"',
    'class="topo-panel-title"', 'class="topo-collapse-btn"', 'id="topo-collapse-btn"',
    'class="topo-panel-body"', 'id="topo-panel-body"', 'id="topo-mini"', 'data-role="bashir"',
  ]) assert.ok(src.includes(hook), `${hook} must survive the rename`);
});

// @ac-hash: slice-382-ac-4 sha256:055a0fc4119fba6811aab051a56322ce993936f63fbb64b95377ee7eed8f4d72
test('J-qa-and-branches slice-382-ac-4 — slice-340-ac-1 states the new name, and its guard is in sync with the manifest', () => {
  const entry = json(MANIFEST).byTag['slice-340-ac-1'];
  assert.ok(entry, 'slice-340-ac-1 must still be in the AC manifest');
  assert.ok(entry.text.includes(PANEL_NAME), `slice-340-ac-1 still reads: ${entry.text}`);
  assert.ok(!entry.text.includes(OLD_NAME), 'slice-340-ac-1 must no longer pin the old name');
  assert.match(entry.acHash, /^sha256:[0-9a-f]{64}$/);

  // The restatement is only real once the ratchet moved with it: a guard still annotated with
  // the superseded spec hash reads STALE to AC-reconcile.
  const annotated = /\/\/\s*@ac-hash:\s*slice-340-ac-1\s+(sha256:[0-9a-f]+)/.exec(fs.readFileSync(GUARD_340, 'utf8'));
  assert.ok(annotated, 'the slice-340-ac-1 guard must carry an @ac-hash annotation');
  assert.equal(annotated[1], entry.acHash, 'the guard annotation must equal the manifest acHash');
});

// ── Traps ───────────────────────────────────────────────────────────────────

// Trap 1 — the authorised change RESTATES the criterion. Retiring it would silently drop a
// live check instead of re-pointing it, and losing the "not Branch Topology" half would drop
// the intent (named for what it shows, never for the data structure).
test('J-qa-and-branches trap-1 — slice-340-ac-1 is restated and still active, not retired', () => {
  const entry = json(MANIFEST).byTag['slice-340-ac-1'];
  assert.ok(entry, 'slice-340-ac-1 must not be retired out of the manifest');
  assert.equal(entry.status, 'active');
  assert.equal(entry.legacy, false, 'the criterion must stay hash-ratcheted, not fall back to grandfathered legacy');
  assert.match(entry.text, /not "Branch Topology"/, 'the original intent must survive the restatement');
  // Restated means the ratchet MOVED off the superseded spec — not left pinned to it.
  assert.notEqual(entry.acHash, 'sha256:54145d8ac9e223dd388d5884524a07ebefcca5efdfb862b3319fe24713686ee8',
    'slice-340-ac-1 still hashes to the spec that pinned the old name');

  const guarded = Object.values(json(COVERAGE).bySource).flat().some((g) => g.tag === 'slice-340-ac-1');
  assert.ok(guarded, 'slice-340-ac-1 must still carry a guard in COVERAGE.lock');
});

// Trap 2 — the browser test is Julian's. Rom does not edit it, rename it, or replace it with
// a safety-net stand-in; the mismatch is declared with a file-path Test-Loosen-OK instead.
test('J-qa-and-branches trap-2 — the browser spec keeps its path, and this slice adds no browser test', () => {
  assert.ok(fs.existsSync(E2E_SPEC), 'e2e/devops-station.spec.js must not be renamed or deleted by this slice');
  const specs = fs.readdirSync(path.join(REPO, 'e2e')).filter((f) => f.endsWith('.spec.js'));
  assert.ok(!specs.some((f) => /qa[-_]and[-_]branches/i.test(f)), 'a browser test for this rename is Julian\'s to write, not Rom\'s');
  // This slice's own guards live under regression/, where Rom's safety net belongs.
  assert.ok(fs.existsSync(path.join(REPO, 'regression', 'direct-controls', 'j-qa-and-branches.test.js')));
});

// Trap 3 — comments in the dashboard MAY be updated (and were, so no stale label survives);
// fixture values inside the browser spec may NOT be, because that file is not Rom's.
test('J-qa-and-branches trap-3 — the dashboard carries no stale label, and the browser spec\'s fixtures are untouched', () => {
  assert.ok(!html().includes(OLD_NAME), `no "${OLD_NAME}" may remain in the dashboard, comments included`);

  // These are slice 340's commit-log FIXTURES (a commit subject, not a panel label) inside
  // Julian's spec. If this fails, someone reached into a browser test they do not own.
  const spec = fs.readFileSync(E2E_SPEC, 'utf8');
  const fixtures = spec.match(/subject: 'DevOps Station'/g) || [];
  assert.equal(fixtures.length, 2, 'the two commit-subject fixtures in e2e/devops-station.spec.js must be left exactly as Julian wrote them');
});
