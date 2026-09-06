'use strict';
// J-panel-owner-names — slice 383: the two agent panels say WHO is on them.
//
// The Active Build and Peer Review panels used to carry a job title and nothing else, so an
// operator asking "who is standing by?" got "Full-Stack Engineer". Their owner chips now opt
// in (data-with-name) to a permanent person + title pair, painted by the page's own
// applyRoleLabels() so it survives every theme toggle. The other three owner chips are
// untouched.
//
// These guards run the REAL applyRoleLabels() lifted out of lcars-dashboard.html, over chips
// parsed out of the REAL markup — a hand-kept copy of either would go on passing after the
// page changed underneath it. Every painted assertion overwrites the chip with a sentinel
// first, so a paint that never happens fails instead of reading the server-rendered fallback
// back to itself.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DASH = path.resolve(__dirname, '..', '..', 'dashboard', 'lcars-dashboard.html');
const SRC = fs.readFileSync(DASH, 'utf8');

const SEP = ' · ';                 // " · " — the pair separator, name then title
const UNPAINTED = '<<unpainted>>';      // sentinel: still here ⇒ applyRoleLabels never wrote

// ── Lift the real role machinery out of the page ────────────────────────────

// Brace-match a top-level declaration (`function f(`, `const ROLE = {`) out of the source.
function extractBlock(header) {
  const start = SRC.search(header);
  assert.notEqual(start, -1, `${header} must exist in lcars-dashboard.html`);
  let depth = 0;
  for (let j = SRC.indexOf('{', start); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces while extracting ${header}`);
}

const APPLY_SRC = extractBlock(/\n\s*function applyRoleLabels\s*\(/);

// Just the .panel-owner half of it — up to the next selector applyRoleLabels reaches for.
const OWNER_BLOCK = (() => {
  const from = APPLY_SRC.indexOf('.panel-owner[data-role]');
  assert.notEqual(from, -1, 'applyRoleLabels must still select .panel-owner[data-role]');
  const next = APPLY_SRC.indexOf('querySelectorAll(', from);
  return APPLY_SRC.slice(from, next === -1 ? APPLY_SRC.length : next);
})();

// Run the page's own applyRoleLabels() against `chips` under the given skin. Returns the
// selectors it asked for, so a guard can prove WHICH code path did the painting.
function paint(chips, { lcars = false } = {}) {
  const asked = [];
  const document = {
    body: { classList: { contains: (c) => c === 'lcars-mode' && lcars } },
    querySelectorAll(sel) {
      asked.push(sel);
      return sel === '.panel-owner[data-role]' ? chips : [];
    },
    querySelector(sel) { asked.push(sel); return null; },
  };
  const factory = new Function('document', `
    ${extractBlock(/\n\s*const ROLE\s*=\s*\{/)}
    ${extractBlock(/\n\s*function lcarsOn\s*\(/)}
    ${extractBlock(/\n\s*function personName\s*\(/)}
    ${extractBlock(/\n\s*function ownerChip\s*\(/)}
    ${extractBlock(/\n\s*function roleTitle\s*\(/)}
    ${APPLY_SRC}
    return { ROLE, applyRoleLabels, personName, ownerChip, roleTitle };
  `);
  const api = factory(document);
  api.applyRoleLabels();
  return { asked, ...api };
}

// ── Read the shipped owner chips out of the shipped markup ──────────────────

const OWNER_RE = /<span class="panel-owner"([^>]*)>([^<]*)<\/span>/g;
const decode = (s) => s.replace(/&middot;/g, '·').replace(/&amp;/g, '&');

// One fake element per real .panel-owner span, carrying its real data-role, its real
// data-with-name marker and its real server-rendered fallback text.
function shippedChips() {
  const out = [];
  let m;
  OWNER_RE.lastIndex = 0;
  while ((m = OWNER_RE.exec(SRC))) {
    const attrs = m[1];
    const role = /data-role="([^"]*)"/.exec(attrs);
    out.push({
      dataset: { role: role ? role[1] : undefined },
      marked: /\sdata-with-name(?=[\s>=])/.test(attrs + '>'),
      fallback: decode(m[2]),
      textContent: decode(m[2]),
      hasAttribute(n) { return n === 'data-with-name' ? this.marked : n === 'data-role' && !!this.dataset.role; },
    });
  }
  assert.ok(out.length >= 5, 'the page must still carry its owner chips');
  return out;
}

// Every chip, painted under `opts`, keyed by data-role. Sentinel-first: what comes back is
// what applyRoleLabels() wrote, never the fallback text it was parsed with.
function painted(opts) {
  const chips = shippedChips();
  for (const c of chips) c.textContent = UNPAINTED;
  const api = paint(chips, opts);
  const byRole = new Map();
  for (const c of chips) {
    assert.notEqual(c.textContent, UNPAINTED, `.panel-owner[data-role="${c.dataset.role}"] was never painted`);
    if (!byRole.has(c.dataset.role)) byRole.set(c.dataset.role, []);
    byRole.get(c.dataset.role).push(c.textContent);
  }
  return { byRole, chips, api };
}

const one = (byRole, role) => {
  const v = byRole.get(role);
  assert.ok(v && v.length === 1, `expected exactly one .panel-owner[data-role="${role}"], got ${v ? v.length : 0}`);
  return v[0];
};

// ── Read element extents out of the shipped markup ──────────────────────────

// [start, end) byte range of the <div> carrying `id`, by div-depth walk from its open tag.
function divRange(id) {
  const at = SRC.indexOf(`id="${id}"`);
  assert.notEqual(at, -1, `#${id} must exist in lcars-dashboard.html`);
  const start = SRC.lastIndexOf('<div', at);
  assert.notEqual(start, -1, `#${id} must be a <div>`);
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(SRC))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return [start, m.index + m[0].length];
  }
  throw new Error(`unbalanced <div> while measuring #${id}`);
}

const chipAt = (role) => {
  const at = SRC.indexOf(`<span class="panel-owner" data-role="${role}"`);
  assert.notEqual(at, -1, `the ${role} owner chip must exist`);
  return at;
};

// The Active Build panel swaps between these three; the Peer Review panel between the last two.
const BUILD_STATES = ['mission-active-content', 'mission-blocked-content', 'mission-idle-text'];
const REVIEW_STATES = ['nog-idle-state', 'nog-running-state'];

// ── Acceptance criteria ─────────────────────────────────────────────────────

// @ac-hash: slice-383-ac-1 sha256:2d6fa5b6c40ba0e8d0c9b0d0179e448a32807cf2337ef922cc652ccb8721a101
test('J-panel-owner-names slice-383-ac-1 — the Active Build first row reads "Sam · Full-Stack Engineer" in every panel state', () => {
  // Painted by the page's own repaint path, not read back off the fallback.
  assert.equal(one(painted().byRole, 'rom'), `Sam${SEP}Full-Stack Engineer`);

  // Before any JavaScript runs, the server-rendered row already names the person.
  assert.match(SRC, /<div class="active-slice-label">Active Build<span class="lore-tag"> \(Workshop\)<\/span> <span class="panel-owner" data-role="rom" data-with-name>Sam &middot; Full-Stack Engineer<\/span><\/div>/);

  // "Every panel state" is structural: the chip sits in the panel header, ahead of all three
  // state blocks, so no state swap can take it off screen.
  const chip = chipAt('rom');
  for (const id of BUILD_STATES) {
    const [from] = divRange(id);
    assert.ok(chip < from, `the Active Build owner chip must sit above #${id}, not inside it`);
  }
});

// @ac-hash: slice-383-ac-2 sha256:9105d49da08650a605155e343472d0fd6dda6db2f42bd3dab3266b46c5c20adb
test('J-panel-owner-names slice-383-ac-2 — the Peer Review first row reads "Jordan · Reviewer" in every panel state', () => {
  assert.equal(one(painted().byRole, 'nog'), `Jordan${SEP}Reviewer`);

  assert.match(SRC, /<div class="section-title">Peer Review<span class="lore-tag"> \(Quality Diagnostics\)<\/span> <span class="panel-owner" data-role="nog" data-with-name>Jordan &middot; Reviewer<\/span><\/div>/);

  // Above both states — it still reads correctly while #nog-running-state is showing.
  const chip = chipAt('nog');
  for (const id of REVIEW_STATES) {
    const [from] = divRange(id);
    assert.ok(chip < from, `the Peer Review owner chip must sit above #${id}, not inside it`);
  }
});

// @ac-hash: slice-383-ac-3 sha256:f04b24d666e7af8b8808db4cd0f69abae552c09bb248574ec299396cf3b9a361
test('J-panel-owner-names slice-383-ac-3 — in LCARS the same two rows read "Rom · Backend Implementor" and "Nog · Evaluator", and repaint on every toggle', () => {
  const lcars = painted({ lcars: true }).byRole;
  assert.equal(one(lcars, 'rom'), `Rom${SEP}Backend Implementor`);
  assert.equal(one(lcars, 'nog'), `Nog${SEP}Evaluator`);

  // No name printed twice: the two halves of each pair are distinct.
  for (const role of ['rom', 'nog']) {
    const [name, title] = one(lcars, role).split(SEP);
    assert.notEqual(name, title, `the ${role} chip prints "${name}" twice`);
  }

  // Repaint round-trip on one set of chips, the way the theme toggle drives it: light →
  // LCARS → light must land back on the light strings, not on a stale or accumulated skin.
  const chips = shippedChips().filter((c) => c.marked);
  const read = () => chips.map((c) => c.textContent).join(' | ');
  paint(chips, { lcars: false });
  const light = read();
  paint(chips, { lcars: true });
  assert.notEqual(read(), light, 'flipping the skin must change the two rows');
  assert.equal(read(), `Rom${SEP}Backend Implementor | Nog${SEP}Evaluator`);
  paint(chips, { lcars: false });
  assert.equal(read(), `Sam${SEP}Full-Stack Engineer | Jordan${SEP}Reviewer`);
  assert.equal(read(), light);
});

// @ac-hash: slice-383-ac-4 sha256:b10eb8b560c8846354e07e4cd39a9e737bf7ef8d218f3fabaf569b124bbd2c2c
test('J-panel-owner-names slice-383-ac-4 — the QA, Backlog Queue and History owner chips are unchanged', () => {
  const { byRole } = painted();
  assert.equal(one(byRole, 'bashir'), 'QA Engineer');
  assert.deepEqual(byRole.get('obrien'), ['Dev Lead', 'Dev Lead']);

  // Their server-rendered text is unchanged too — a job title, no name, no marker.
  for (const c of shippedChips()) {
    if (['bashir', 'obrien'].includes(c.dataset.role)) {
      assert.equal(c.marked, false, `the ${c.dataset.role} chip must not opt in to a person's name`);
      assert.equal(c.fallback, c.dataset.role === 'bashir' ? 'QA Engineer' : 'Dev Lead');
    }
  }
});

// @ac-hash: slice-383-ac-5 sha256:3cafcbc471845befc6a9decfa74138632bfbecb023461622a5792d5a539d7a6c
test('J-panel-owner-names slice-383-ac-5 — the reviewer is named exactly once in the Peer Review panel while a review is running', () => {
  const [from, to] = divRange('postbuild-panel');
  const panel = SRC.slice(from, to);

  // The running state is part of the panel, and the duplicate label inside it is gone.
  assert.ok(panel.includes('id="nog-running-state"'), 'the running state must still be in this panel');
  assert.doesNotMatch(panel, /class="role-person-label"[^>]*data-role="nog"/);
  assert.doesNotMatch(panel, /data-role="nog"[^>]*class="role-person-label"/);

  // One "Jordan" in the whole panel — the header chip — with the running state showing.
  assert.equal((panel.match(/Jordan/g) || []).length, 1);

  // The round label beside it is untouched.
  assert.ok(panel.includes('<span class="nog-running-subtitle" id="nog-round-label">Dual-gate review · round 1 of 5</span>'));

  // The generic .role-person-label loop stays — other labels may use it later.
  assert.match(APPLY_SRC, /querySelectorAll\('\.role-person-label\[data-role\]'\)/);
});

// ── Traps ───────────────────────────────────────────────────────────────────

// Trap 1 — the doubled name in LCARS. ownerChip('rom') and personName('rom') are BOTH "Rom"
// in the dark skin, so pairing the name with the owner chip renders "Rom · Rom". The chip
// must pair personName() with roleTitle().
test('J-panel-owner-names trap-1 — the marked chips pair the person with the ROLE TITLE, never with the owner chip', () => {
  const { byRole, api } = painted({ lcars: true });
  for (const role of ['rom', 'nog']) {
    assert.equal(api.personName(role), api.ownerChip(role), `precondition: ${role} name and owner chip collide in LCARS`);
    assert.equal(one(byRole, role), api.personName(role) + SEP + api.roleTitle(role));
    assert.notEqual(one(byRole, role), api.personName(role) + SEP + api.ownerChip(role), `the ${role} chip was built from ownerChip()`);
  }
  // The source says so too, so the intent survives a refactor that happens to still pass above.
  assert.match(OWNER_BLOCK, /personName\(/, 'the marked chip must take its name from personName()');
  assert.match(OWNER_BLOCK, /roleTitle\(/, 'the marked chip must take its title from roleTitle()');
});

// Trap 2 — repaint on toggle. A chip written once at render time, or by a path the theme
// toggle never calls, shows the wrong skin after the operator flips the theme.
test('J-panel-owner-names trap-2 — the marked chips are painted by applyRoleLabels(), which both the toggle and the loader call', () => {
  // The paint happens inside applyRoleLabels, via the generic .panel-owner selector — not in
  // some bespoke writer the toggle does not reach.
  const { asked } = paint(shippedChips());
  assert.ok(asked.includes('.panel-owner[data-role]'), 'applyRoleLabels must still drive the owner chips');
  assert.match(APPLY_SRC, /data-with-name/);

  // Both entry points call it: the theme toggle and the load-time initialiser.
  const toggle = extractBlock(/\n\s*function toggleLcarsMode\s*\(/);
  assert.match(toggle, /applyRoleLabels\(\)/, 'toggleLcarsMode must repaint the role labels');
  assert.match(extractBlock(/\n\s*\(function initLcarsMode\s*\(/), /applyRoleLabels\(\)/, 'the loader must paint the role labels');

  // Repainting the same skin twice is idempotent — an appending writer accumulates instead.
  const chips = shippedChips().filter((c) => c.marked);
  paint(chips);
  const once = chips.map((c) => c.textContent);
  paint(chips);
  paint(chips);
  assert.deepEqual(chips.map((c) => c.textContent), once);
});

// Trap 3 — the name disappearing with a state change. "Permanently" is the whole point: a
// name placed inside any one state block vanishes the moment the panel swaps state.
test('J-panel-owner-names trap-3 — neither marked chip sits inside any state block', () => {
  for (const [role, states] of [['rom', BUILD_STATES], ['nog', REVIEW_STATES]]) {
    const chip = chipAt(role);
    for (const id of states) {
      const [from, to] = divRange(id);
      assert.ok(chip < from || chip >= to, `the ${role} owner chip is inside #${id} — it would vanish with the state`);
    }
  }
  // And they are where they belong: the two panel header rows.
  assert.ok(SRC.indexOf('class="active-slice-label"') < chipAt('rom'));
  assert.ok(SRC.lastIndexOf('<div class="section-title">Peer Review', chipAt('nog')) !== -1);
});

// Trap 4 — collateral rename. This slice adds names to two panels, not five.
test('J-panel-owner-names trap-4 — exactly two owner chips opt in, and no other chip gained a name', () => {
  const chips = shippedChips();
  assert.deepEqual(chips.filter((c) => c.marked).map((c) => c.dataset.role), ['rom', 'nog']);

  // In BOTH skins the untouched chips still come out of ownerChip() alone — the code path
  // this slice did not change — with no name pinned in front of the title.
  for (const lcars of [false, true]) {
    const { chips: out, api } = painted({ lcars });
    for (const c of out) {
      if (c.marked) continue;
      assert.equal(c.textContent, api.ownerChip(c.dataset.role),
        `.panel-owner[data-role="${c.dataset.role}"] no longer reads exactly ownerChip()`);
      assert.ok(!c.textContent.includes(SEP),
        `.panel-owner[data-role="${c.dataset.role}"] reads "${c.textContent}" — it gained a name it was not meant to`);
    }
  }
});
