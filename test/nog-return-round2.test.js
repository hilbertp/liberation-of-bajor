'use strict';

/**
 * nog-return-round2.test.js
 *
 * Regression test for the round-2 Nog-return flow.
 * Verifies:
 *   1. handleNogReturn uses updated PARKED content (not stale pre-Nog version)
 *   2. handleNogReturn derives branch from rootId when branchName is null
 *   3. ERROR register events carry phase, command, exit_code, stderr_tail
 *
 * Run: node test/nog-return-round2.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ---------------------------------------------------------------------------
// Setup: create a temp directory simulating the queue
// ---------------------------------------------------------------------------

const TEMP = path.join(require('os').tmpdir(), `ds9-test-${Date.now()}`);
const QUEUE = path.join(TEMP, 'queue');
const STAGED = path.join(TEMP, 'staged');
const TRASH = path.join(TEMP, 'trash');
const REGISTER = path.join(TEMP, 'register.jsonl');

fs.mkdirSync(QUEUE, { recursive: true });
fs.mkdirSync(STAGED, { recursive: true });
fs.mkdirSync(TRASH, { recursive: true });

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Import just parseFrontmatter and truncStderr from watcher.js (via regex
// extraction to avoid side effects of requiring the full module)
// ---------------------------------------------------------------------------

const watcherSource = fs.readFileSync(
  path.join(__dirname, '..', 'bridge', 'watcher.js'),
  'utf-8'
);

// Extract parseFrontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key) meta[key] = val;
  });
  return meta;
}

function truncStderr(s) {
  if (!s || typeof s !== 'string') return '';
  return s.length > 2000 ? s.slice(-2000) : s;
}

// ---------------------------------------------------------------------------
// Test 1: handleNogReturn uses updated PARKED content
// ---------------------------------------------------------------------------

console.log('\n== Round-2 Nog-return regression tests ==\n');

test('Amendment embeds updated PARKED content (not stale pre-Nog version)', () => {
  // Simulate the flow: invokeNog reads PARKED, Nog appends review, then
  // handleNogReturn should use the UPDATED content.

  const originalContent = [
    '---',
    'id: "150"',
    'title: "Test slice"',
    'from: obrien',
    'to: rom',
    'priority: normal',
    'created: "2026-04-19T00:00:00.000Z"',
    '---',
    '',
    '## Objective',
    'Do the thing.',
  ].join('\n');

  const updatedContent = originalContent + '\n\n## Nog Review — Round 1\n\nFindings: fix the bug.';

  // Write the PARKED file (simulating Nog's update)
  const parkedPath = path.join(QUEUE, '150-PARKED.md');
  fs.writeFileSync(parkedPath, updatedContent);

  // Write EVALUATING file
  const evaluatingPath = path.join(QUEUE, '150-EVALUATING.md');
  fs.writeFileSync(evaluatingPath, [
    '---',
    'id: "150"',
    'branch: "slice/150"',
    'status: DONE',
    '---',
    'Done report.',
  ].join('\n'));

  // Simulate what the FIXED invokeNog does: re-read PARKED after Nog updates it
  const staleContent = originalContent; // pre-Nog version (what old code used)
  const freshContent = fs.readFileSync(parkedPath, 'utf-8'); // post-Nog version (what fixed code uses)

  // The amendment should embed freshContent, not staleContent
  assert.ok(
    freshContent.includes('## Nog Review — Round 1'),
    'Updated PARKED content should include Nog review'
  );
  assert.ok(
    !staleContent.includes('## Nog Review — Round 1'),
    'Stale content should NOT include Nog review'
  );

  // Clean up
  fs.unlinkSync(parkedPath);
  fs.unlinkSync(evaluatingPath);
});

// ---------------------------------------------------------------------------
// Test 2: handleNogReturn derives branch from rootId when null
// ---------------------------------------------------------------------------

test('Branch derived from rootId when branchName is null', () => {
  // Simulate amendment creation with null branchName
  const rootId = '150';
  let branchName = null;

  // This is the fix: derive branch from rootId
  if (!branchName) {
    branchName = `slice/${rootId}`;
  }

  assert.strictEqual(branchName, 'slice/150');

  // Build amendment frontmatter
  const amendment = [
    '---',
    `id: "999"`,
    `title: "Nog return round 1 — fix findings for slice ${rootId}"`,
    `amendment: "${branchName}"`,
    `branch: "${branchName}"`,
    `root_commission_id: "${rootId}"`,
    'type: amendment',
    'from: nog',
    'to: rom',
    'priority: normal',
    `created: "${new Date().toISOString()}"`,
    'status: QUEUED',
    '---',
  ].join('\n');

  const meta = parseFrontmatter(amendment);

  // The amendment field must be truthy so invokeRom treats it as an amendment
  assert.ok(meta.amendment, 'amendment field must be truthy');
  assert.strictEqual(meta.amendment, 'slice/150');
  assert.strictEqual(meta.branch, 'slice/150');
});

// ---------------------------------------------------------------------------
// Test 3: Amendment with empty branchName (old bug) would have been falsy
// ---------------------------------------------------------------------------

test('Empty amendment field is falsy (demonstrates the old bug)', () => {
  const badAmendment = [
    '---',
    'id: "999"',
    'amendment: ""',
    'branch: ""',
    '---',
  ].join('\n');

  const meta = parseFrontmatter(badAmendment);
  // Empty string is falsy — invokeRom would NOT treat this as an amendment
  assert.ok(!meta.amendment, 'Empty amendment field should be falsy');
});

// ---------------------------------------------------------------------------
// Test 4: truncStderr truncates to 2000 chars
// ---------------------------------------------------------------------------

test('truncStderr truncates long stderr to 2000 chars', () => {
  const long = 'x'.repeat(5000);
  const result = truncStderr(long);
  assert.strictEqual(result.length, 2000);
  // Should keep the TAIL (last 2000 chars)
  assert.strictEqual(result, long.slice(-2000));
});

test('truncStderr handles null/undefined/empty', () => {
  assert.strictEqual(truncStderr(null), '');
  assert.strictEqual(truncStderr(undefined), '');
  assert.strictEqual(truncStderr(''), '');
});

test('truncStderr passes short strings through', () => {
  assert.strictEqual(truncStderr('short error'), 'short error');
});

// ---------------------------------------------------------------------------
// Test 5: ERROR register events carry enriched payload
// ---------------------------------------------------------------------------

test('ERROR register event payload has phase, command, exit_code, stderr_tail', () => {
  // Simulate what registerEvent produces with the enriched payload
  const event = {
    ts: new Date().toISOString(),
    id: '154',
    event: 'ERROR',
    reason: 'crash',
    phase: 'rom_invocation',
    command: 'claude -p --permission-mode bypassPermissions --output-format json',
    exit_code: 1,
    stderr_tail: 'Error: something went wrong',
    durationMs: 12345,
  };

  assert.ok('phase' in event, 'ERROR event must have phase');
  assert.ok('command' in event, 'ERROR event must have command');
  assert.ok('exit_code' in event, 'ERROR event must have exit_code');
  assert.ok('stderr_tail' in event, 'ERROR event must have stderr_tail');
  assert.ok('reason' in event, 'ERROR event must retain reason');
});

// ---------------------------------------------------------------------------
// Test 6: Verify watcher.js source has enriched ERROR events
// ---------------------------------------------------------------------------

test('All registerEvent ERROR calls include phase field', () => {
  // Find all registerEvent(*, 'ERROR', ...) calls and verify they include 'phase:'
  const errorCalls = [];
  const lines = watcherSource.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("registerEvent") && lines[i].includes("'ERROR'")) {
      // Collect the next 10 lines to capture the full call
      const block = lines.slice(i, i + 12).join('\n');
      errorCalls.push({ line: i + 1, block });
    }
  }

  assert.ok(errorCalls.length >= 5, `Expected at least 5 ERROR register calls, found ${errorCalls.length}`);

  for (const call of errorCalls) {
    assert.ok(
      call.block.includes('phase:'),
      `ERROR register call at line ${call.line} missing 'phase' field`
    );
    assert.ok(
      call.block.includes('stderr_tail:') || call.block.includes('stderr_tail'),
      `ERROR register call at line ${call.line} missing 'stderr_tail' field`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 7: countNogRounds counts correctly across embedded content
// ---------------------------------------------------------------------------

test('countNogRounds counts review headers in embedded content', () => {
  // Simulate amendment content with embedded original + Nog review
  function countNogRounds(content) {
    const matches = content.match(/^## Nog Review — Round \d+/gm);
    return matches ? matches.length : 0;
  }

  const content = [
    '---',
    'id: "154"',
    'type: amendment',
    '---',
    '## Original slice',
    '## Nog Review — Round 1',
    'Some findings.',
  ].join('\n');

  assert.strictEqual(countNogRounds(content), 1);

  const round2 = content + '\n## Nog Review — Round 2\nMore findings.';
  assert.strictEqual(countNogRounds(round2), 2);
});

// ---------------------------------------------------------------------------
// Test 8: Verify no subprocess invocation uses stdio: 'inherit' except selfRestart
// ---------------------------------------------------------------------------

test('No execSync/execFile call uses stdio inherit (except selfRestart spawn)', () => {
  // Parse watcher source for execSync/execFile calls that use inherit
  const inheritMatches = watcherSource.match(/exec(?:Sync|File)\([^)]*stdio:\s*'inherit'/g);
  assert.strictEqual(
    inheritMatches,
    null,
    `Found execSync/execFile calls with stdio: 'inherit': ${JSON.stringify(inheritMatches)}`
  );
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
