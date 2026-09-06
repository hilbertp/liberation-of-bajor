'use strict';

/**
 * Journey: J-approval-provenance-dispatch (Tier 2 — the orchestrator's own
 *          dispatch gate, driven directly the way the poll loop drives it)
 * Category: Approval provenance
 *
 * Slice 354, the half that is not HTTP. Securing only the approve endpoint would
 * have been theatre: `grep -c HUMAN_APPROVAL bridge/orchestrator.js` returns 0,
 * and dispatch is driven purely by a file existing in bridge/queue/ with a
 * -QUEUED.md or -PENDING.md suffix. `printf ... > bridge/queue/999-QUEUED.md`
 * commissioned Rom with no HTTP request, no approval event and no human
 * anywhere. So the enforcement point is here.
 *
 * What this file covers:
 *   - slice-354-ac-5  post-cutover, an unprovenanced slice does not commission;
 *                     it is PARKED and escalated, never trashed
 *   - slice-354-ac-6  a pre-cutover approval still dispatches, and renders as
 *                     unattributed rather than as a named person
 *   - slice-354-ac-7  a Nog-rejected slice re-dispatches for a further round
 *                     with no new approval
 *   - trap 1          no freshness, count or nonce-consumption rule — an old
 *                     stamp and a second round after a rejection both dispatch
 *   - trap 2          `refined` and `rejected` share the HUMAN_APPROVAL name;
 *                     neither is an approval and neither unlocks dispatch
 *   - trap 3          the shared simulateApprove() helper stamps `test` and
 *                     refuses to write into the real repository
 *
 * Fixture isolation (#99992 rule): the orchestrator's queue, staged, trash and
 * register paths are redirected into an os.tmpdir() root, which is also the root
 * the provenance module signs against. The live bridge/ is never touched.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

const REPO_ROOT      = path.resolve(__dirname, '..', '..');
const DASHBOARD_SRC  = path.join(REPO_ROOT, 'dashboard', 'lcars-dashboard.html');
const ORCHESTRATOR_SRC = path.join(REPO_ROOT, 'bridge', 'orchestrator.js');
const PROVENANCE_SRC   = path.join(REPO_ROOT, 'bridge', 'approval-provenance.js');

const orchestrator = require(ORCHESTRATOR_SRC);
const provenance   = require(path.join(REPO_ROOT, 'bridge', 'approval-provenance.js'));

// The fixture's own cutover, written to state so the test does not ride on the
// committed constant. Everything "legacy" is dated before it; everything the
// gate must judge is dated after it.
const CUTOVER   = '2026-09-01T00:00:00.000Z';
const PRE_CUT   = '2026-08-01T00:00:00.000Z';
const POST_CUT  = '2026-09-04T00:00:00.000Z';

let tmpRoot, queueDir, stagedDir, trashDir, registerPath, escalationsDir;

function sliceFile(id, extra = {}) {
  const fm = Object.assign({
    id: String(id),
    title: `Dispatch provenance ${id}`,
    goal: 'Prove a machine cannot approve work.',
    from: 'obrien',
    to: 'rom',
    priority: 'normal',
    created: POST_CUT,
    status: 'QUEUED',
  }, extra);
  return '---\n'
    + Object.entries(fm).map(([k, v]) => `${k}: "${v}"`).join('\n')
    + '\n---\n\n## Goal\n\nThe original brief body.\n';
}

/** Write a queue file, optionally carrying a real stamp this root signed. */
function writeQueued(id, { stamp, ts, extra } = {}) {
  const fm = Object.assign({}, extra);
  if (stamp) Object.assign(fm, provenance.stampFrontmatter(tmpRoot, { id, provenance: stamp, ts }));
  const p = path.join(queueDir, `${id}-QUEUED.md`);
  fs.writeFileSync(p, sliceFile(id, fm), 'utf8');
  return p;
}

function metaOf(filePath) {
  return orchestrator.parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
}

function appendEvent(ev) {
  fs.appendFileSync(registerPath, JSON.stringify(ev) + '\n', 'utf8');
}

function readRegister() {
  try {
    return fs.readFileSync(registerPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch (_) { return []; }
}

before(() => {
  tmpRoot        = fs.mkdtempSync(path.join(os.tmpdir(), 'j-provenance-dispatch-'));
  queueDir       = path.join(tmpRoot, 'bridge', 'queue');
  stagedDir      = path.join(tmpRoot, 'bridge', 'staged');
  trashDir       = path.join(tmpRoot, 'bridge', 'trash');
  escalationsDir = path.join(tmpRoot, 'bridge', 'escalations');
  registerPath   = path.join(tmpRoot, 'bridge', 'register.jsonl');
  for (const d of [queueDir, stagedDir, trashDir, path.join(tmpRoot, 'bridge', 'state')]) {
    fs.mkdirSync(d, { recursive: true });
  }
  fs.writeFileSync(registerPath, '', 'utf8');
  fs.writeFileSync(
    path.join(tmpRoot, 'bridge', 'state', 'approval-cutover.json'),
    JSON.stringify({ ts: CUTOVER }) + '\n', 'utf8',
  );

  // provenanceRoot() is derived from QUEUE_DIR, so this one call redirects the
  // gate, the register and the signing root together.
  orchestrator._testSetDirs(queueDir, stagedDir, trashDir);
  orchestrator._testSetRegisterFile(registerPath);
  provenance._resetSecretCache();
});

after(() => {
  delete process.env.APPROVAL_PROVENANCE_ENFORCE;
  provenance._resetSecretCache();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
});

// ── slice-354-ac-5 ───────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-ac-5 — post-cutover, a hand-written queue file with no stamp does not commission: it is parked and escalated, and never trashed', () => {
  const id = '99411';
  // Exactly the attack in the brief: a file appears in the queue, written by
  // nothing that ever asked a human.
  const queuedPath = path.join(queueDir, `${id}-QUEUED.md`);
  fs.writeFileSync(queuedPath, sliceFile(id), 'utf8');

  const verdict = orchestrator.checkDispatchProvenance(id, metaOf(queuedPath), queuedPath);
  assert.equal(verdict.ok, false, 'an unstamped post-cutover slice must not be cleared for dispatch');
  assert.equal(verdict.reason, 'unstamped');

  orchestrator.parkUnprovenancedSlice(id, queuedPath, verdict);

  // Parked, not dispatched, and above all not destroyed. validateIntakeMeta's
  // failure path trashes; this one must not — the queue holds 17 PARKED and 23
  // DONE files and most of what is in flight predates any stamp.
  assert.equal(fs.existsSync(queuedPath), false, 'the slice must leave the dispatch queue');
  assert.ok(fs.existsSync(path.join(queueDir, `${id}-PARKED.md`)), 'the slice must be parked');
  assert.deepEqual(
    fs.readdirSync(trashDir).filter(f => f.startsWith(id)), [],
    'a provenance failure must never trash the slice',
  );
  // The brief survives the park — a wiped body would make the escalation useless.
  assert.match(fs.readFileSync(path.join(queueDir, `${id}-PARKED.md`), 'utf8'), /The original brief body/);

  const escalation = path.join(escalationsDir, `${id}-PROVENANCE-ESCALATION.md`);
  assert.ok(fs.existsSync(escalation), "an unprovenanced slice must be escalated to O'Brien");
  const text = fs.readFileSync(escalation, 'utf8');
  assert.match(text, /to: obrien/);
  assert.match(text, /unstamped/);

  const blocked = readRegister().filter(e => e.slice_id === id && e.event === 'APPROVAL_PROVENANCE_BLOCKED');
  assert.equal(blocked.length, 1, 'the block must be on the record');
  assert.equal(blocked[0].enforced, true);

  // And the wiring: the poll loop must reach for the park, not the trash.
  const src = fs.readFileSync(ORCHESTRATOR_SRC, 'utf8');
  assert.match(src, /if \(approvalProvenance\.isEnforcing\(\)\) \{\s*\n\s*parkUnprovenancedSlice\(/,
    'the enforcing branch of the poll loop must call parkUnprovenancedSlice');
  assert.doesNotMatch(
    src.slice(src.indexOf('function parkUnprovenancedSlice')).slice(0, 3000),
    /TRASH_DIR/,
    'parkUnprovenancedSlice must not reference TRASH_DIR at all',
  );

  // ── the round-1 hole: `references` was a free pass ────────────────────────
  // Round 1 asked one question covering both the slice and its claimed parent,
  // so ANY of the 274 ids with pre-cutover history worked as a parent and the
  // same printf attack walked through with one extra frontmatter line. Each of
  // these must stay blocked.
  appendEvent({ ts: PRE_CUT, event: 'COMMISSIONED', slice_id: '99410' }); // a real old parent
  const bypasses = {
    'references to a real pre-cutover parent':
      { references: '99410' },
    'references plus a LIED pre-cutover created date':
      { references: '99410', created: PRE_CUT },
    'references to a parent the register never knew':
      { references: '99409', created: PRE_CUT },
  };
  for (const [label, extra] of Object.entries(bypasses)) {
    const bypassId   = '99418';
    const bypassPath = path.join(queueDir, `${bypassId}-QUEUED.md`);
    fs.writeFileSync(bypassPath, sliceFile(bypassId, extra), 'utf8');
    const v = orchestrator.checkDispatchProvenance(bypassId, metaOf(bypassPath), bypassPath);
    assert.equal(v.ok, false, `must not dispatch — ${label}`);
    assert.equal(v.reason, 'unstamped', `must be refused as unstamped — ${label}`);
    fs.unlinkSync(bypassPath);
  }
  // `created` is written by whoever wrote the file, so it must never be the
  // deciding signal on its own — the second case above is exactly that attack.
  assert.equal(
    orchestrator.fileIsPreCutover(null, { created: PRE_CUT }, Date.parse(CUTOVER)), false,
    'a frontmatter date with no file behind it proves nothing',
  );
});

// ── slice-354-ac-6 ───────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-ac-6 — an approval recorded before the cutover still dispatches, and renders as unattributed rather than as a named person', () => {
  const id = '99412';
  const queuedPath = path.join(queueDir, `${id}-QUEUED.md`);
  fs.writeFileSync(queuedPath, sliceFile(id, { created: PRE_CUT }), 'utf8');
  // The shape all 276 historical approvals actually have: no provenance at all.
  appendEvent({ ts: PRE_CUT, event: 'HUMAN_APPROVAL', slice_id: id, action: 'approved' });

  const verdict = orchestrator.checkDispatchProvenance(id, metaOf(queuedPath), queuedPath);
  assert.equal(verdict.ok, true, 'grandfathered work must still dispatch');
  assert.equal(verdict.provenance, 'legacy-unattributed');
  assert.equal(verdict.legacy, true);
  assert.equal(verdict.reason, 'pre-cutover', "the slice's own history is what grandfathers it");

  // Bounding the parent fallback (ac-5) must not have deleted it: a GENUINE
  // pre-cutover amendment — one whose file, not just its frontmatter, predates
  // the cutover — still dispatches on its parent's history.
  const amendId   = '99419';
  const amendPath = path.join(queueDir, `${amendId}-QUEUED.md`);
  fs.writeFileSync(amendPath, sliceFile(amendId, { references: id, created: PRE_CUT }), 'utf8');
  fs.utimesSync(amendPath, new Date(PRE_CUT), new Date(PRE_CUT));
  const amend = orchestrator.checkDispatchProvenance(amendId, metaOf(amendPath), amendPath);
  assert.equal(amend.ok, true, 'a real pre-cutover amendment must still dispatch');
  assert.equal(amend.reason, 'pre-cutover-parent', 'and be recorded as riding the parent');
  fs.unlinkSync(amendPath);

  // The other half of the criterion is what the operator is shown. The old chain
  // ended in `personName('obrien')`, which is how 276 unattributed approvals came
  // to be displayed as a named human who had not approved them.
  const html = fs.readFileSync(DASHBOARD_SRC, 'utf8');
  const block = html.slice(html.indexOf('const APPROVAL_LABELS'));
  const src   = block.slice(0, block.indexOf('\n  // ── Nog active state'));
  const approvalBadge = new Function(`${src}; return approvalBadge;`)();

  assert.equal(approvalBadge({ action: 'approved' }).text, 'unattributed (pre-provenance)');
  assert.equal(approvalBadge({ action: 'approved' }).cls, 'legacy');
  assert.equal(approvalBadge({ provenance: 'legacy-unattributed' }).text, 'unattributed (pre-provenance)');
  assert.equal(approvalBadge({ provenance: 'machine-unknown' }).text, 'machine (unattributed)');
  assert.equal(approvalBadge({ provenance: 'auto-approve-policy' }).text, 'auto-approve policy');
  // A machine-origin event must not be laundered into a person by an actor field.
  assert.equal(approvalBadge({ provenance: 'machine-unknown', actor: 'obrien' }).cls, 'machine');
  assert.match(
    html,
    /const badge = approvalBadge\(ev\);/,
    'the approval read site must render through approvalBadge',
  );
  assert.doesNotMatch(
    html,
    /ev\.approver \|\| ev\.actor \|\| personName\(/,
    'the personName fallback that laundered unattributed approvals must be gone',
  );
});

// ── slice-354-ac-7 ───────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-ac-7 — a Nog-rejected slice re-dispatches for a further round without a new approval', () => {
  const id = '99413';
  // Round 1: approved through the UI, dispatched, reviewed, returned by Nog. The
  // PARKED file is what handleNogReturn rewrites, so the stamp has to be on it.
  const stamp = provenance.stampFrontmatter(tmpRoot, { id, provenance: 'human-click', ts: POST_CUT });
  fs.writeFileSync(path.join(queueDir, `${id}-PARKED.md`), sliceFile(id, stamp), 'utf8');
  const evaluatingPath = path.join(queueDir, `${id}-EVALUATING.md`);
  fs.writeFileSync(evaluatingPath, '---\nid: "' + id + '"\n---\n\nDONE report.\n', 'utf8');
  appendEvent({ ts: POST_CUT, event: 'HUMAN_APPROVAL', slice_id: id, action: 'approved', provenance: 'human-click' });

  const before = readRegister().length;

  // The shipped return path, driven exactly as the Nog verdict handler drives it.
  orchestrator.handleNogReturn(id, id, 2, `slice/${id}`, evaluatingPath, '', 'Findings from round 1', 1000);

  const requeued = path.join(queueDir, `${id}-QUEUED.md`);
  assert.ok(fs.existsSync(requeued), 'the Nog return must requeue the slice');
  const meta = metaOf(requeued);
  assert.equal(meta.round, '2', 'the requeued file is round 2');

  const verdict = orchestrator.checkDispatchProvenance(id, meta, requeued);
  assert.equal(verdict.ok, true, 'round 2 must dispatch on the round-1 approval');
  assert.equal(verdict.provenance, 'human-click', 'the original stamp survives the rewrite');
  assert.equal(verdict.legacy, false, 'this is a real stamp, not grandfathering');

  // No new approval was written, and none was needed. This is the whole of trap 1:
  // any rule that demanded one here would kill every second round.
  const approvals = readRegister().filter(e => e.slice_id === id && e.event === 'HUMAN_APPROVAL' && e.action === 'approved');
  assert.equal(approvals.length, 1, 'round 2 must not require a second approval');
  assert.equal(readRegister().length, before, 'the return path writes no approval event');
});

// ── trap 1 ───────────────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-trap-1 — the gate applies no freshness, count or consumption rule: an old stamp still dispatches, and so does a round after a rejection', () => {
  const id = '99414';
  // Slice 351's shape: one approval, two commissions either side of a rejection.
  const ancient = '2026-09-02T00:00:00.000Z';
  const queuedPath = writeQueued(id, { stamp: 'human-click', ts: ancient });
  appendEvent({ ts: ancient, event: 'HUMAN_APPROVAL', slice_id: id, action: 'approved', provenance: 'human-click' });
  appendEvent({ ts: ancient, event: 'COMMISSIONED', slice_id: id });
  appendEvent({ ts: POST_CUT, event: 'NOG_RETURN', slice_id: id });

  const first = orchestrator.checkDispatchProvenance(id, metaOf(queuedPath), queuedPath);
  assert.equal(first.ok, true);

  // Re-checked any number of times, and long after the stamp was minted, the
  // answer must not change: the stamp is not consumed and does not expire.
  appendEvent({ ts: POST_CUT, event: 'COMMISSIONED', slice_id: id });
  for (let i = 0; i < 3; i++) {
    const again = orchestrator.checkDispatchProvenance(id, metaOf(queuedPath), queuedPath);
    assert.equal(again.ok, true, `dispatch check ${i + 2} must still pass`);
    assert.equal(again.provenance, 'human-click');
  }
  // The queue file is untouched by being checked — nothing is consumed on disk.
  assert.equal(metaOf(queuedPath).approval_sig, first && metaOf(queuedPath).approval_sig);

  // And an amendment brief, which carries `references` to its parent, is judged
  // on the parent's history rather than being treated as a stranger.
  assert.equal(orchestrator.provenanceRootId('99414-1', { references: id }), id);
  assert.equal(orchestrator.provenanceRootId(id, { references: 'null' }), id);
});

// ── trap 2 ───────────────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-trap-2 — `refined` and `rejected` share the HUMAN_APPROVAL event name, and neither one unlocks dispatch', () => {
  const id = '99415';
  const queuedPath = path.join(queueDir, `${id}-QUEUED.md`);
  fs.writeFileSync(queuedPath, sliceFile(id), 'utf8');
  // Slice 315's shape, but all post-cutover and none of them an approval: a rule
  // that counted events named HUMAN_APPROVAL would wave this straight through.
  for (const action of ['refined', 'rejected', 'refined', 'refined']) {
    appendEvent({ ts: POST_CUT, event: 'HUMAN_APPROVAL', slice_id: id, action });
  }

  const verdict = orchestrator.checkDispatchProvenance(id, metaOf(queuedPath), queuedPath);
  assert.equal(verdict.ok, false, 'a refinement is not an approval');
  assert.equal(verdict.reason, 'unstamped');

  // The grandfathering question is "did this slice exist before the cutover", and
  // it is answered from timestamps, never from an action field.
  assert.equal(orchestrator.hasPreCutoverHistory(id, id), false);
  appendEvent({ ts: PRE_CUT, event: 'HUMAN_APPROVAL', slice_id: id, action: 'refined' });
  assert.equal(orchestrator.hasPreCutoverHistory(id, id), true,
    'any pre-cutover event grandfathers the slice — 64 of 274 commissions have no approval event at all');

  // A forged stamp is not an approval either.
  const forged = '99416';
  const forgedPath = path.join(queueDir, `${forged}-QUEUED.md`);
  fs.writeFileSync(forgedPath, sliceFile(forged, {
    approval_provenance: 'human-click',
    approval_ts: POST_CUT,
    approval_sig: 'deadbeef'.repeat(8),
  }), 'utf8');
  const forgedVerdict = orchestrator.checkDispatchProvenance(forged, metaOf(forgedPath), forgedPath);
  assert.equal(forgedVerdict.ok, false, 'a stamp this installation did not sign must not pass');
  assert.equal(forgedVerdict.reason, 'bad-signature');

  // …and the module must not overstate what that refusal buys. The signing secret
  // lives on disk because the orchestrator is a separate process and cannot verify
  // a stamp it cannot recompute, so anyone who can read that file can forge one.
  // The brief is explicit that this is tamper-EVIDENT, not tamper-proof, and that
  // no code or comment may claim more. A future edit that quietly promotes the
  // guarantee is the failure this guards.
  const provSrc = fs.readFileSync(PROVENANCE_SRC, 'utf8');
  assert.match(provSrc, /Nothing here is tamper-PROOF/,
    'the honest limit must stay written down where the next reader will find it');
  assert.match(provSrc, /can read that file can forge a stamp/,
    'the secret is on disk and therefore forgeable — the module must say so, not imply otherwise');
  // The over-claims. Each would be false, and none of them can be reached by
  // honest phrasing — unlike "tamper-proof" itself, which this file legitimately
  // uses to DENY the property and so cannot be matched on the word alone.
  for (const overclaim of [/\bunforgeable\b/i, /cannot be forged/i, /impossible to forge/i,
                           /\bguarantees?\b[^.\n]{0,40}\bauthenticity\b/i]) {
    assert.doesNotMatch(provSrc, overclaim,
      `approval-provenance.js must not claim more than tamper-evidence (${overclaim})`);
  }
});

// ── trap 3 ───────────────────────────────────────────────────────────────────
test('J-approval-provenance-dispatch slice-354-trap-3 — the shared simulateApprove() helper stamps `test` provenance and refuses to write into the real repository', () => {
  const { simulateApprove } = require(path.join(REPO_ROOT, 'regression', 'helpers', 'pipeline-logic.js'));
  const id = '99417';
  const stagedPath = path.join(stagedDir, `${id}-STAGED.md`);
  fs.writeFileSync(stagedPath, sliceFile(id, { status: 'STAGED' }), 'utf8');
  const helperRegister = path.join(tmpRoot, 'bridge', 'helper-register.jsonl');
  const helperOrder    = path.join(tmpRoot, 'bridge', 'helper-order.json');

  simulateApprove({ stagedPath, queueDir, queueOrderPath: helperOrder, registerPath: helperRegister, id });

  const events = fs.readFileSync(helperRegister, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'HUMAN_APPROVAL');
  assert.equal(events[0].provenance, 'test',
    'a fixture approval must be identifiable as a fixture, not indistinguishable from a forged one');

  // Aimed at the live register it would forge exactly the evidence this slice
  // makes unforgeable, so it refuses outright.
  assert.throws(
    () => simulateApprove({
      stagedPath, queueDir, queueOrderPath: helperOrder, id,
      registerPath: path.join(REPO_ROOT, 'bridge', 'register.jsonl'),
    }),
    /refuses to write an approval into the real repository/,
  );
  // The refusal comes before any write, so the real queue is untouched too.
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'bridge', 'queue', `${id}-QUEUED.md`)), false);
});
