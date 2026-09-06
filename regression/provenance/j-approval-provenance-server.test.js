'use strict';

/**
 * Journey: J-approval-provenance (Tier 2 — in-process dashboard server)
 * Category: Approval provenance
 *
 * Slice 354. On 2026-09-01 O'Brien reported five slices as approved by Philipp,
 * citing HUMAN_APPROVAL events. Philipp had not approved them, and the claim was
 * uncheckable: the event recorded nothing about who or what caused it, the
 * auto-approve sweep called the same function as the Approve button, and the
 * dashboard rendered an unattributed event as a named human.
 *
 * What this file covers, driven through the real server handlers compiled into a
 * tmp root:
 *   - slice-354-ac-1  an approve POST with no UI nonce is refused, changes no
 *                     state, and is recorded as machine-origin
 *   - slice-354-ac-2  provenance comes from server state, never from the client
 *   - slice-354-ac-3  a click and a standing-policy sweep are distinguishable
 *   - slice-354-ac-4  toggling the policy is auditable and lives on the server
 *   - slice-354-ac-8  the server binds loopback by default
 *   - trap 4          every string the tmp-server harnesses rewrite or parse
 *                     still matches the shipped server, nonce injection included
 *   - trap 5          the new field is additive — the old event shape survives
 *
 * Fixture isolation (#99992 rule): everything runs inside an os.tmpdir() root;
 * the server source is rewritten so REPO_ROOT points at it. The live
 * bridge/queue, bridge/staged, bridge/state and bridge/register.jsonl are never
 * touched.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');

const SERVER_SRC = path.resolve(__dirname, '..', '..', 'dashboard', 'server.js');
const REPO_ROOT  = path.resolve(__dirname, '..', '..');

let tmpRoot, server, port, uiNonce;
let queueDir, stagedDir, trashDir, registerPath, queueOrderPath;

const ID_CLICK  = '99401';  // approved with the policy off
const ID_POLICY = '99402';  // approved with the policy on
const ID_MACHINE = '99403'; // approved by nobody

function sliceFile(id) {
  return `---\nid: "${id}"\ntitle: "Provenance ${id}"\nfrom: obrien\nto: rom\n`
       + `priority: normal\ncreated: "2026-09-01T00:00:00.000Z"\nstatus: "STAGED"\n---\n\n`
       + `## Goal\n\nProvenance fixture ${id}.\n`;
}

function compileServer(root) {
  const dashboardDir  = path.join(root, 'dashboard');
  const lifecyclePath = path.join(root, 'bridge', 'lifecycle-translate.js');
  for (const [rel, real] of [
    ['return-to-stage-eligibility.js', 'return-to-stage-eligibility'],
    ['approval-provenance.js',         'approval-provenance'],
  ]) {
    fs.writeFileSync(
      path.join(root, 'bridge', rel),
      `module.exports = require(${JSON.stringify(path.join(REPO_ROOT, 'bridge', real))});\n`,
      'utf8',
    );
  }
  fs.writeFileSync(lifecyclePath, `
'use strict';
module.exports = { translateEvent(ev) { return ev; }, resetDedupeState() {} };
`, 'utf8');
  fs.writeFileSync(path.join(dashboardDir, 'lcars-dashboard.html'), '<html><head></head><body></body></html>', 'utf8');
  fs.writeFileSync(path.join(dashboardDir, 'tokens.css'), '', 'utf8');

  const src = fs.readFileSync(SERVER_SRC, 'utf8')
    .replace(/const REPO_ROOT\s*=[\s\S]*?path\.resolve\(__dirname,\s*'\.\.'\);/, `const REPO_ROOT = ${JSON.stringify(root)};`)
    .replace(/const DASHBOARD\s*=\s*path\.join\(__dirname,\s*'lcars-dashboard\.html'\);/, `const DASHBOARD = ${JSON.stringify(path.join(dashboardDir, 'lcars-dashboard.html'))};`)
    .replace(/const TOKENS_CSS\s*=\s*path\.join\(__dirname,\s*'tokens\.css'\);/, `const TOKENS_CSS = ${JSON.stringify(path.join(dashboardDir, 'tokens.css'))};`)
    .replace(/require\(path\.join\(REPO_ROOT,\s*'bridge',\s*'lifecycle-translate'\)\)/, `require(${JSON.stringify(lifecyclePath)})`)
    .replace(/if \(require\.main === module\)/, 'if (false)')
    .replace(/module\.exports = \{ /, 'module.exports = { server, ');

  const mod = new Module('patched-dashboard-server-provenance');
  mod.paths = module.paths;
  mod._compile(src, path.join(dashboardDir, 'server.js'));
  return mod.exports.server;
}

/** POST with explicit control over the nonce header — the point of most of these tests. */
function request(method, urlPath, payload, { nonce } = {}) {
  return new Promise((resolve, reject) => {
    const body = payload == null ? '' : JSON.stringify(payload);
    const headers = body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {};
    if (nonce) headers['X-DS9-UI-Nonce'] = nonce;
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function getPage() {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: '/' }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => resolve(raw));
    }).on('error', reject);
  });
}

function events(filter) {
  const raw = fs.readFileSync(registerPath, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(JSON.parse).filter(filter || (() => true));
}

function seedStaged(id) {
  const p = path.join(stagedDir, `${id}-STAGED.md`);
  fs.writeFileSync(p, sliceFile(id), 'utf8');
  return p;
}

before(async () => {
  tmpRoot        = fs.mkdtempSync(path.join(os.tmpdir(), 'j-approval-provenance-'));
  queueDir       = path.join(tmpRoot, 'bridge', 'queue');
  stagedDir      = path.join(tmpRoot, 'bridge', 'staged');
  trashDir       = path.join(tmpRoot, 'bridge', 'trash');
  registerPath   = path.join(tmpRoot, 'bridge', 'register.jsonl');
  queueOrderPath = path.join(tmpRoot, 'bridge', 'queue-order.json');

  for (const dir of [queueDir, stagedDir, trashDir,
                     path.join(tmpRoot, 'bridge', 'control'),
                     path.join(tmpRoot, 'bridge', 'errors'),
                     path.join(tmpRoot, 'bridge', 'state'),
                     path.join(tmpRoot, 'dashboard')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(registerPath, '', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'heartbeat.json'), JSON.stringify({ current_slice: null }), 'utf8');
  fs.writeFileSync(queueOrderPath, '[]', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'staged-order.json'), '[]', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'sessions.jsonl'), '', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'first-output.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'nog-active.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'bridge', 'state', 'branch-state.json'), '{}', 'utf8');

  server = compileServer(tmpRoot);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  const page = await getPage();
  uiNonce = (page.match(/window\.__DS9_UI_NONCE="([a-f0-9]+)"/) || [])[1] || '';
});

after(async () => {
  if (server) await new Promise(r => server.close(r));
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ── ac-1 ────────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-ac-1 — an approve POST with no UI nonce is refused with no queue file and no approval event, and is recorded as machine-origin', async () => {
  seedStaged(ID_MACHINE);
  const orderBefore = fs.readFileSync(queueOrderPath, 'utf8');

  const res = await request('POST', `/api/bridge/staged/${ID_MACHINE}/approve`, {}); // no nonce: a curl / script / agent

  assert.equal(res.status, 403, 'a non-UI approve must be refused outright');
  assert.equal(fs.existsSync(path.join(queueDir, `${ID_MACHINE}-QUEUED.md`)), false,
    'a refused approval must create no queue file — the queue file IS the dispatch trigger');
  assert.equal(fs.existsSync(path.join(stagedDir, `${ID_MACHINE}-STAGED.md`)), true,
    'the staged file must be left where it was — no state change');
  assert.equal(fs.readFileSync(queueOrderPath, 'utf8'), orderBefore,
    'queue-order.json must be untouched by a refused approval');

  const approvals = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === ID_MACHINE);
  assert.deepEqual(approvals, [], 'a refused approval must write no HUMAN_APPROVAL event');

  const refusals = events(e => e.event === 'APPROVAL_REFUSED' && String(e.slice_id) === ID_MACHINE);
  assert.equal(refusals.length, 1, 'the attempt must be recorded, not silently dropped');
  assert.equal(refusals[0].provenance, 'machine-unknown',
    'the refusal must be recorded as machine-origin — this is the audit trail the incident lacked');
  assert.equal(refusals[0].reason, 'no-ui-nonce');
});

// ── ac-3 (and the human half of ac-2) ───────────────────────────────────────
test('J-approval-provenance slice-354-ac-3 — a human click and a standing auto-approve sweep produce distinguishable provenance', async () => {
  // Policy OFF: reaching this endpoint from a served page means a person clicked.
  await request('POST', '/api/auto-approve', { enabled: false }, { nonce: uiNonce });
  seedStaged(ID_CLICK);
  const clickRes = await request('POST', `/api/bridge/staged/${ID_CLICK}/approve`, {}, { nonce: uiNonce });
  assert.equal(clickRes.status, 200);

  // Policy ON: the sweep is byte-identical on the wire, so the server credits the
  // policy — the standing human decision that authorized it — not a person.
  await request('POST', '/api/auto-approve', { enabled: true }, { nonce: uiNonce });
  seedStaged(ID_POLICY);
  const sweepRes = await request('POST', `/api/bridge/staged/${ID_POLICY}/approve`, {}, { nonce: uiNonce });
  assert.equal(sweepRes.status, 200);
  await request('POST', '/api/auto-approve', { enabled: false }, { nonce: uiNonce }); // restore

  const click = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === ID_CLICK)[0];
  const sweep = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === ID_POLICY)[0];

  assert.equal(click.provenance, 'human-click');
  assert.equal(sweep.provenance, 'auto-approve-policy');
  assert.notEqual(click.provenance, sweep.provenance,
    'a sweep and a click were byte-identical in the log — that is the bug this criterion closes');
});

// ── ac-2 ────────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-ac-2 — provenance is determined from server-side state and never from a value the client supplies', async () => {
  const id = '99404';
  seedStaged(id);
  // The policy is off, and the client lies about every field it can reach.
  const res = await request('POST', `/api/bridge/staged/${id}/approve`, {
    provenance: 'human-click', actor: 'Philipp', approver: 'Philipp',
  }, { nonce: uiNonce });
  assert.equal(res.status, 200);

  const ev = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === id)[0];
  assert.ok(ev, 'the approval must be recorded');
  assert.equal(ev.actor, undefined, 'a client-supplied actor must never reach the register');
  assert.equal(ev.approver, undefined, 'a client-supplied approver must never reach the register');

  // Now flip the server's own state and repeat with the SAME client claim: the
  // recorded value follows the server, which is what makes the claim structurally
  // impossible rather than merely ignored.
  await request('POST', '/api/auto-approve', { enabled: true }, { nonce: uiNonce });
  const id2 = '99405';
  seedStaged(id2);
  await request('POST', `/api/bridge/staged/${id2}/approve`, { provenance: 'human-click' }, { nonce: uiNonce });
  await request('POST', '/api/auto-approve', { enabled: false }, { nonce: uiNonce });

  const ev2 = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === id2)[0];
  assert.equal(ev2.provenance, 'auto-approve-policy',
    'the client claimed human-click both times; only the server state changed, and only the server state was recorded');

  // And the stamp that travels with the work says the same thing as the event.
  const queued = fs.readFileSync(path.join(queueDir, `${id2}-QUEUED.md`), 'utf8');
  assert.match(queued, /approval_provenance: "auto-approve-policy"/,
    'the queue file carries the provenance too — the orchestrator dispatches off the file, not the event');
  assert.match(queued, /approval_sig: "[a-f0-9]{64}"/, 'the stamp must be signed');
});

// ── ac-4 ────────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-ac-4 — turning the auto-approve policy on or off writes an auditable register event and the state lives on the server', async () => {
  const before = events(e => e.event === 'AUTO_APPROVE_POLICY').length;

  const on = await request('POST', '/api/auto-approve', { enabled: true }, { nonce: uiNonce });
  assert.equal(on.status, 200);
  assert.equal(on.body.enabled, true);

  const readBack = await request('GET', '/api/auto-approve');
  assert.equal(readBack.body.enabled, true,
    'the policy must be readable from the server — not only from one browser\'s localStorage');
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmpRoot, 'bridge', 'state', 'auto-approve.json'), 'utf8')).enabled, true,
    'the policy must be on disk, where the log and the next process can see it');

  const off = await request('POST', '/api/auto-approve', { enabled: false }, { nonce: uiNonce });
  assert.equal(off.status, 200);

  const written = events(e => e.event === 'AUTO_APPROVE_POLICY').slice(before);
  assert.deepEqual(written.map(e => e.action), ['on', 'off'],
    'both directions must be auditable — the incident was unexplainable because nothing recorded that the policy had been on');
  for (const ev of written) {
    assert.ok(ev.ts, 'a policy event must say when');
    assert.equal(ev.provenance, 'human-click');
  }

  // And the policy itself cannot be flipped by a machine.
  const forged = await request('POST', '/api/auto-approve', { enabled: true });
  assert.equal(forged.status, 403, 'flipping a standing approval policy is approval-grade and needs UI origin');
  assert.equal((await request('GET', '/api/auto-approve')).body.enabled, false, 'the refused flip must change nothing');
});

// ── ac-8 ────────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-ac-8 — the dashboard server binds the loopback interface by default, still overridable by DASHBOARD_HOST', () => {
  const src = fs.readFileSync(SERVER_SRC, 'utf8');
  const m = src.match(/const HOST\s*=\s*process\.env\.DASHBOARD_HOST\s*\?\?\s*'([^']+)'/);
  assert.ok(m, 'HOST must still be a single DASHBOARD_HOST-with-default expression');
  assert.equal(m[1], '127.0.0.1',
    'an unauthenticated server whose POST surface queues work must not default to every interface');
});

// ── trap 4 ──────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-trap-4 — every string the tmp-server harnesses rewrite or parse still matches the shipped source', async () => {
  const src = fs.readFileSync(SERVER_SRC, 'utf8');
  const rewrites = [
    [/const REPO_ROOT\s*=[\s\S]*?path\.resolve\(__dirname,\s*'\.\.'\);/, 'REPO_ROOT'],
    [/const DASHBOARD\s*=\s*path\.join\(__dirname,\s*'lcars-dashboard\.html'\);/, 'DASHBOARD'],
    [/const TOKENS_CSS\s*=\s*path\.join\(__dirname,\s*'tokens\.css'\);/, 'TOKENS_CSS'],
    [/require\(path\.join\(REPO_ROOT,\s*'bridge',\s*'lifecycle-translate'\)\)/, 'lifecycle-translate require'],
    [/if \(require\.main === module\)/, 'require.main guard'],
    [/module\.exports = \{ /, 'module.exports'],
  ];
  for (const [re, name] of rewrites) {
    assert.match(src, re,
      `compileServer() rewrites the ${name} line by regex in every tmp-server harness; ` +
      'restructuring it breaks them silently rather than loudly');
  }

  // Slice 354 added a SEVENTH string the harnesses depend on, and this one is not
  // a rewrite but a parse: every tmp-server harness now reads its nonce out of the
  // served document with this exact regex, because without a nonce every approve
  // POST it makes is refused. It is asserted against the live server rather than
  // the source so a change to how the nonce is injected — a different variable
  // name, single quotes, a base64 alphabet, moving it out of <head> — fails here
  // instead of silently 403-ing three unrelated journeys.
  const HARNESS_NONCE_RE = /window\.__DS9_UI_NONCE="([a-f0-9]+)"/;
  const page = await getPage();
  const parsed = (page.match(HARNESS_NONCE_RE) || [])[1];
  assert.ok(parsed, 'the served page must carry a nonce the harness regex can find');
  // Parsing it is not enough — the harness needs a nonce that actually authorizes,
  // so drive one approve POST with exactly what the regex yielded.
  const id = '99407';
  seedStaged(id);
  const res = await request('POST', `/api/bridge/staged/${id}/approve`, {}, { nonce: parsed });
  assert.equal(res.status, 200, 'the nonce a harness parses out of the page must authorize an approval');
  // Per page load, by design: a second load is a different nonce, and the first
  // stays valid. A harness that cached one across loads must keep working.
  assert.notEqual(parsed, uiNonce, 'each page load mints its own nonce');

  // Both sibling harnesses must be parsing with the same pattern this test just
  // pinned; one drifting from the other is exactly the silent breakage of trap 4.
  const LITERAL = String(HARNESS_NONCE_RE);
  for (const rel of ['authoring-staging/j-approve-and-reorder-server.test.js',
                     'direct-controls/j-direct-controls-ops-ui.test.js']) {
    const harness = fs.readFileSync(path.join(REPO_ROOT, 'regression', rel), 'utf8');
    assert.ok(harness.includes(LITERAL),
      `${rel} must read the nonce with ${LITERAL} — the pattern this test pins against the live server`);
    assert.ok(harness.includes("'X-DS9-UI-Nonce'"),
      `${rel} must send the nonce header, or every approve POST it makes is refused`);
  }
});

// ── trap 5 ──────────────────────────────────────────────────────────────────
test('J-approval-provenance slice-354-trap-5 — the provenance field is purely additive: the pre-existing approval event shape is unchanged', async () => {
  const id = '99406';
  seedStaged(id);
  await request('POST', `/api/bridge/staged/${id}/approve`, {}, { nonce: uiNonce });
  const ev = events(e => e.event === 'HUMAN_APPROVAL' && String(e.slice_id) === id)[0];

  // Six regression files already assert this shape; slice-pipeline.md §7.2 makes
  // an added field legal precisely because consumers must ignore what they do not
  // recognise. Nothing may be renamed or dropped.
  assert.equal(ev.event, 'HUMAN_APPROVAL');
  assert.equal(String(ev.slice_id), id);
  assert.equal(ev.action, 'approved');
  assert.ok(ev.ts, 'ts is part of the pipeline §7 minimum schema');
  assert.deepEqual(
    Object.keys(ev).sort(),
    ['action', 'event', 'provenance', 'slice_id', 'ts'],
    'exactly one field was added — anything else is a contract change, not an additive one',
  );
});
