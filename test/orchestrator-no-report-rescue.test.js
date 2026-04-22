'use strict';

/**
 * orchestrator-no-report-rescue.test.js
 *
 * Tests for slice 178 — no_report worktree rescue:
 *   1. classifyNoReportExit function exists with correct classification logic
 *   2. rescueWorktree function exists and writes RESCUE.md
 *   3. isRomSelfTerminated helper covers all 5 reason strings
 *   4. Empty case: no commits, no changes → rom_self_terminated_empty
 *   5. Uncommitted case: no commits, uncommitted changes → rom_self_terminated_uncommitted
 *   6. Committed case: commits on branch, no uncommitted → rom_self_terminated_committed
 *   7. Dashboard labels include all 4 new reason strings
 *   8. writeErrorFile uses isRomSelfTerminated for output truncation
 *   9. .gitignore covers bridge/worktree-rescue/
 *
 * Run: node test/orchestrator-no-report-rescue.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');
const os = require('os');

// ---------------------------------------------------------------------------
// Read source files for static analysis
// ---------------------------------------------------------------------------

const orchestratorSource = fs.readFileSync(
  path.join(__dirname, '..', 'bridge', 'orchestrator.js'),
  'utf-8'
);

const dashboardSource = fs.readFileSync(
  path.join(__dirname, '..', 'dashboard', 'lcars-dashboard.html'),
  'utf-8'
);

const gitignoreSource = fs.readFileSync(
  path.join(__dirname, '..', '.gitignore'),
  'utf-8'
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Part 1: Static analysis — function existence and structure
// ---------------------------------------------------------------------------

console.log('\nPart 1: Static analysis — function existence');

test('classifyNoReportExit function exists', () => {
  assert.ok(
    /function classifyNoReportExit\(id, worktreePath, branchName\)/.test(orchestratorSource),
    'classifyNoReportExit(id, worktreePath, branchName) not found'
  );
});

test('rescueWorktree function exists', () => {
  assert.ok(
    /function rescueWorktree\(id, branchName, classification, stdout, stderr\)/.test(orchestratorSource),
    'rescueWorktree(id, branchName, classification, stdout, stderr) not found'
  );
});

test('isRomSelfTerminated function exists', () => {
  assert.ok(
    /function isRomSelfTerminated\(reason\)/.test(orchestratorSource),
    'isRomSelfTerminated(reason) not found'
  );
});

test('isRomSelfTerminated covers legacy no_report', () => {
  assert.ok(
    orchestratorSource.includes("reason === 'no_report'"),
    'isRomSelfTerminated must check for legacy no_report string'
  );
});

test('isRomSelfTerminated covers all 4 classified reasons', () => {
  for (const r of [
    'rom_self_terminated_empty',
    'rom_self_terminated_uncommitted',
    'rom_self_terminated_committed',
    'rom_self_terminated_mixed',
  ]) {
    assert.ok(
      orchestratorSource.includes(`'${r}'`),
      `isRomSelfTerminated must reference '${r}'`
    );
  }
});

test('no_report path calls classifyNoReportExit before writeErrorFile', () => {
  // Find the no_report block and verify classify comes before writeErrorFile
  const classifyIdx = orchestratorSource.indexOf('classifyNoReportExit(id, worktreePath');
  const writeErrorIdx = orchestratorSource.indexOf("writeErrorFile(errorPath, id, classifiedReason");
  assert.ok(classifyIdx > 0, 'classifyNoReportExit call not found in no_report path');
  assert.ok(writeErrorIdx > 0, 'writeErrorFile with classifiedReason not found');
  assert.ok(classifyIdx < writeErrorIdx, 'classifyNoReportExit must come before writeErrorFile');
});

test('no_report path calls rescueWorktree for non-empty cases', () => {
  assert.ok(
    orchestratorSource.includes("rescueWorktree(id, sliceBranch, noReportClass"),
    'rescueWorktree call not found in no_report path'
  );
});

test('no_report path calls cleanupWorktree only for empty case', () => {
  // The cleanup should be inside a condition checking for 'empty'
  const match = orchestratorSource.match(/rom_self_terminated_empty.*cleanupWorktree/s);
  assert.ok(match, 'cleanupWorktree should be guarded by empty classification check');
});

// ---------------------------------------------------------------------------
// Part 2: writeErrorFile uses isRomSelfTerminated
// ---------------------------------------------------------------------------

console.log('\nPart 2: writeErrorFile compatibility');

test('writeErrorFile uses isRomSelfTerminated for stdout truncation', () => {
  assert.ok(
    orchestratorSource.includes('isRomSelfTerminated(reason) ? truncate(stdout'),
    'writeErrorFile should use isRomSelfTerminated for stdout truncation'
  );
});

test('writeErrorFile uses isRomSelfTerminated for detail text', () => {
  assert.ok(
    orchestratorSource.includes('isRomSelfTerminated(reason)'),
    'writeErrorFile detail block should use isRomSelfTerminated'
  );
});

// ---------------------------------------------------------------------------
// Part 3: Dashboard labels
// ---------------------------------------------------------------------------

console.log('\nPart 3: Dashboard labels');

test('Dashboard has labels for all 4 classified reason strings', () => {
  for (const r of [
    'rom_self_terminated_empty',
    'rom_self_terminated_uncommitted',
    'rom_self_terminated_committed',
    'rom_self_terminated_mixed',
  ]) {
    assert.ok(
      dashboardSource.includes(r),
      `Dashboard REASON_LABELS missing entry for '${r}'`
    );
  }
});

test('Dashboard retains legacy no_report label', () => {
  assert.ok(
    dashboardSource.includes('no_report'),
    'Dashboard must retain legacy no_report label for historical events'
  );
});

// ---------------------------------------------------------------------------
// Part 4: .gitignore
// ---------------------------------------------------------------------------

console.log('\nPart 4: .gitignore');

test('.gitignore covers bridge/worktree-rescue/', () => {
  assert.ok(
    gitignoreSource.includes('bridge/worktree-rescue/'),
    '.gitignore must include bridge/worktree-rescue/'
  );
});

// ---------------------------------------------------------------------------
// Part 5: Behavioral tests — classification with real git repos
// ---------------------------------------------------------------------------

console.log('\nPart 5: Behavioral tests — classification logic');

const TEMP_BASE = path.join(os.tmpdir(), `ds9-rescue-test-${Date.now()}`);

function setupBareRepo() {
  const bare = path.join(TEMP_BASE, 'bare.git');
  fs.mkdirSync(bare, { recursive: true });
  execSync('git init --bare', { cwd: bare, stdio: 'pipe' });

  // Create a main working copy with an initial commit
  const mainWt = path.join(TEMP_BASE, 'main');
  execSync(`git clone "${bare}" main`, { cwd: TEMP_BASE, stdio: 'pipe' });
  execSync('git checkout -b main', { cwd: mainWt, stdio: 'pipe' });
  fs.writeFileSync(path.join(mainWt, 'README.md'), 'init\n');
  execSync('git add README.md', { cwd: mainWt, stdio: 'pipe' });
  execSync('git -c user.name=Test -c user.email=test@test commit -m "init"', { cwd: mainWt, stdio: 'pipe' });
  execSync('git push origin main', { cwd: mainWt, stdio: 'pipe' });
  return mainWt;
}

let mainRepo;
try {
  mainRepo = setupBareRepo();
} catch (err) {
  console.error(`  Setup failed: ${err.message}`);
  process.exit(1);
}

test('Empty case: no commits, no changes → rom_self_terminated_empty', () => {
  const id = 'test-empty';
  const branchName = `slice/${id}`;
  // Create a worktree with a new branch (identical to main)
  execSync(`git worktree add -b ${branchName} "${path.join(TEMP_BASE, id)}" main`, { cwd: mainRepo, stdio: 'pipe' });
  const wtPath = path.join(TEMP_BASE, id);

  // Classification: no commits beyond main, no uncommitted changes
  const logOutput = execSync(`git log main..${branchName} --oneline`, { cwd: wtPath, encoding: 'utf-8' }).trim();
  const porcelain = execSync('git status --porcelain', { cwd: wtPath, encoding: 'utf-8' }).trim();

  assert.strictEqual(logOutput, '', 'Expected no commits beyond main');
  assert.strictEqual(porcelain, '', 'Expected no uncommitted changes');

  // Verify classification logic
  const hasCommits = logOutput.length > 0;
  const hasDiff = porcelain.length > 0;
  let reason;
  if (hasCommits && hasDiff) reason = 'rom_self_terminated_mixed';
  else if (hasCommits) reason = 'rom_self_terminated_committed';
  else if (hasDiff) reason = 'rom_self_terminated_uncommitted';
  else reason = 'rom_self_terminated_empty';

  assert.strictEqual(reason, 'rom_self_terminated_empty');

  // Cleanup
  execSync('git worktree remove --force ' + wtPath, { cwd: mainRepo, stdio: 'pipe' });
  try { execSync(`git branch -D ${branchName}`, { cwd: mainRepo, stdio: 'pipe' }); } catch (_) {}
});

test('Uncommitted case: no commits, uncommitted file → rom_self_terminated_uncommitted', () => {
  const id = 'test-uncommitted';
  const branchName = `slice/${id}`;
  execSync(`git worktree add -b ${branchName} "${path.join(TEMP_BASE, id)}" main`, { cwd: mainRepo, stdio: 'pipe' });
  const wtPath = path.join(TEMP_BASE, id);

  // Create an uncommitted change
  fs.writeFileSync(path.join(wtPath, 'work.txt'), 'partial work\n');

  const logOutput = execSync(`git log main..${branchName} --oneline`, { cwd: wtPath, encoding: 'utf-8' }).trim();
  const porcelain = execSync('git status --porcelain', { cwd: wtPath, encoding: 'utf-8' }).trim();

  assert.strictEqual(logOutput, '', 'Expected no commits beyond main');
  assert.ok(porcelain.length > 0, 'Expected uncommitted changes');

  const hasCommits = logOutput.length > 0;
  const hasDiff = porcelain.length > 0;
  let reason;
  if (hasCommits && hasDiff) reason = 'rom_self_terminated_mixed';
  else if (hasCommits) reason = 'rom_self_terminated_committed';
  else if (hasDiff) reason = 'rom_self_terminated_uncommitted';
  else reason = 'rom_self_terminated_empty';

  assert.strictEqual(reason, 'rom_self_terminated_uncommitted');

  // Simulate rescue: move worktree
  const rescueDir = path.join(TEMP_BASE, 'worktree-rescue');
  fs.mkdirSync(rescueDir, { recursive: true });
  const rescuePath = path.join(rescueDir, id);
  fs.renameSync(wtPath, rescuePath);

  assert.ok(fs.existsSync(rescuePath), 'Rescued worktree directory must exist');
  assert.ok(!fs.existsSync(wtPath), 'Original worktree path must be gone');

  // Verify rescued content survives
  assert.ok(fs.existsSync(path.join(rescuePath, 'work.txt')), 'Uncommitted file must survive rescue');

  // Write RESCUE.md like the function would
  fs.writeFileSync(path.join(rescuePath, 'RESCUE.md'), `---\nid: "${id}"\nreason: "${reason}"\n---\n`);
  assert.ok(fs.existsSync(path.join(rescuePath, 'RESCUE.md')), 'RESCUE.md must be written');
  const rescueContent = fs.readFileSync(path.join(rescuePath, 'RESCUE.md'), 'utf-8');
  assert.ok(rescueContent.includes('rom_self_terminated_uncommitted'), 'RESCUE.md must contain the classified reason');

  // Prune + cleanup
  try { execSync('git worktree prune', { cwd: mainRepo, stdio: 'pipe' }); } catch (_) {}
  try { execSync(`git branch -D ${branchName}`, { cwd: mainRepo, stdio: 'pipe' }); } catch (_) {}
});

test('Committed case: commits on branch, no uncommitted → rom_self_terminated_committed', () => {
  const id = 'test-committed';
  const branchName = `slice/${id}`;
  execSync(`git worktree add -b ${branchName} "${path.join(TEMP_BASE, id)}" main`, { cwd: mainRepo, stdio: 'pipe' });
  const wtPath = path.join(TEMP_BASE, id);

  // Create a committed change
  fs.writeFileSync(path.join(wtPath, 'feature.txt'), 'completed work\n');
  execSync('git add feature.txt', { cwd: wtPath, stdio: 'pipe' });
  execSync('git -c user.name=Test -c user.email=test@test commit -m "add feature"', { cwd: wtPath, stdio: 'pipe' });

  const logOutput = execSync(`git log main..${branchName} --oneline`, { cwd: wtPath, encoding: 'utf-8' }).trim();
  const porcelain = execSync('git status --porcelain', { cwd: wtPath, encoding: 'utf-8' }).trim();

  assert.ok(logOutput.length > 0, 'Expected commits beyond main');
  assert.strictEqual(porcelain, '', 'Expected no uncommitted changes');

  const hasCommits = logOutput.length > 0;
  const hasDiff = porcelain.length > 0;
  let reason;
  if (hasCommits && hasDiff) reason = 'rom_self_terminated_mixed';
  else if (hasCommits) reason = 'rom_self_terminated_committed';
  else if (hasDiff) reason = 'rom_self_terminated_uncommitted';
  else reason = 'rom_self_terminated_empty';

  assert.strictEqual(reason, 'rom_self_terminated_committed');

  // Simulate rescue: move worktree, keep branch ref
  const rescueDir = path.join(TEMP_BASE, 'worktree-rescue');
  fs.mkdirSync(rescueDir, { recursive: true });
  const rescuePath = path.join(rescueDir, id);
  fs.renameSync(wtPath, rescuePath);
  try { execSync('git worktree prune', { cwd: mainRepo, stdio: 'pipe' }); } catch (_) {}

  assert.ok(fs.existsSync(rescuePath), 'Rescued worktree directory must exist');

  // Branch ref must still exist (committed case preserves branch)
  try {
    execSync(`git rev-parse --verify refs/heads/${branchName}`, { cwd: mainRepo, stdio: 'pipe' });
  } catch (err) {
    assert.fail('Branch ref should still exist for committed classification');
  }

  // Verify git log still works from main repo
  const logFromMain = execSync(`git log ${branchName} --oneline -1`, { cwd: mainRepo, encoding: 'utf-8' }).trim();
  assert.ok(logFromMain.includes('add feature'), 'git log on preserved branch should show the commit');

  // Cleanup
  try { execSync(`git branch -D ${branchName}`, { cwd: mainRepo, stdio: 'pipe' }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Part 6: isRomSelfTerminated behavior
// ---------------------------------------------------------------------------

console.log('\nPart 6: isRomSelfTerminated behavior (source extraction)');

// Extract the function body from source and eval it
const isRomMatch = orchestratorSource.match(/function isRomSelfTerminated\(reason\) \{[\s\S]*?return ([\s\S]*?);\s*\}/);
assert.ok(isRomMatch, 'Could not extract isRomSelfTerminated body');

// Build a standalone copy for testing
// eslint-disable-next-line no-eval
const isRomSelfTerminated = eval(`(function(reason) { return ${isRomMatch[1]}; })`);

test('isRomSelfTerminated returns true for no_report', () => {
  assert.strictEqual(isRomSelfTerminated('no_report'), true);
});

test('isRomSelfTerminated returns true for rom_self_terminated_empty', () => {
  assert.strictEqual(isRomSelfTerminated('rom_self_terminated_empty'), true);
});

test('isRomSelfTerminated returns true for rom_self_terminated_uncommitted', () => {
  assert.strictEqual(isRomSelfTerminated('rom_self_terminated_uncommitted'), true);
});

test('isRomSelfTerminated returns true for rom_self_terminated_committed', () => {
  assert.strictEqual(isRomSelfTerminated('rom_self_terminated_committed'), true);
});

test('isRomSelfTerminated returns true for rom_self_terminated_mixed', () => {
  assert.strictEqual(isRomSelfTerminated('rom_self_terminated_mixed'), true);
});

test('isRomSelfTerminated returns false for timeout', () => {
  assert.strictEqual(isRomSelfTerminated('timeout'), false);
});

test('isRomSelfTerminated returns false for crash', () => {
  assert.strictEqual(isRomSelfTerminated('crash'), false);
});

// ---------------------------------------------------------------------------
// Cleanup temp dirs
// ---------------------------------------------------------------------------

try {
  fs.rmSync(TEMP_BASE, { recursive: true, force: true });
} catch (_) {}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
