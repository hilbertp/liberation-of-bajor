'use strict';

/**
 * git-finalizer.test.js — Slice 184
 *
 * Regression tests for:
 *   1. Finalizer: runGit cleans up orphan .git/index.lock on throw
 *   2. runGit: emits LOCK_CLAIMED + LOCK_RELEASED on success
 *   3. Worktree orphan sweep: sweepStaleResources prunes orphan dirs
 *   4. Stale-lock sweep: prunes stale locks when idle
 *   5. Stale-lock decline: leaves lock alone when IN_PROGRESS exists
 *   6. Retry success: createWorktreeWithRetry succeeds after failures
 *   7. Retry exhaustion: gives up after max retries
 *   8. Path guard: assertWorktreePath rejects unsafe paths
 *
 * Run: node test/git-finalizer.test.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

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
// Isolated temp root — NOT under /tmp/ds9-worktrees/ to avoid collisions
// ---------------------------------------------------------------------------

const TEST_ROOT = path.join(os.tmpdir(), `ds9-finalizer-test-${Date.now()}-${process.pid}`);
fs.mkdirSync(TEST_ROOT, { recursive: true });

// Isolated worktree base for sweep tests
const TEST_WORKTREE_BASE = path.join(TEST_ROOT, 'worktrees');
fs.mkdirSync(TEST_WORKTREE_BASE, { recursive: true });

function makeTempDir(label) {
  const d = path.join(TEST_ROOT, label);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---------------------------------------------------------------------------
// Mock registry for events
// ---------------------------------------------------------------------------

let events = [];
let logs = [];

function mockRegisterEvent(id, event, extra) {
  events.push({ id: String(id), event, ...(extra || {}) });
}

function mockLog(level, event, fields) {
  logs.push({ level, event, ...(fields || {}) });
}

function resetMocks() {
  events = [];
  logs = [];
}

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

const gitFinalizer = require('../bridge/git-finalizer');

console.log('\ngit-finalizer.test.js — Slice 184\n');

// ---------------------------------------------------------------------------
// Test 1: Finalizer cleans up orphan .git/index.lock on throw
// ---------------------------------------------------------------------------

test('runGit: prunes orphan .git/index.lock on exception', () => {
  resetMocks();
  const fakeProject = makeTempDir('test1-project');
  const gitDir = path.join(fakeProject, '.git');
  fs.mkdirSync(gitDir, { recursive: true });

  // Place a fake index.lock
  const lockPath = path.join(gitDir, 'index.lock');
  fs.writeFileSync(lockPath, 'fake lock');

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: path.join(fakeProject, 'heartbeat.json'),
    QUEUE_DIR: path.join(fakeProject, 'queue'),
    WORKTREE_BASE: TEST_WORKTREE_BASE,
  });

  // Run a git command that will fail
  let threw = false;
  try {
    gitFinalizer.runGit('git --no-such-flag-xyz', {
      slice_id: '999',
      op: 'test_finalizer',
      cwd: fakeProject,
    });
  } catch (_) {
    threw = true;
  }

  assert.ok(threw, 'runGit should throw on failure');
  assert.ok(!fs.existsSync(lockPath), '.git/index.lock should be pruned after exception');

  const claimed = events.find(e => e.event === 'LOCK_CLAIMED');
  assert.ok(claimed, 'LOCK_CLAIMED event should be emitted');

  const pruned = events.find(e => e.event === 'LOCK_ORPHAN_PRUNED');
  assert.ok(pruned, 'LOCK_ORPHAN_PRUNED event should be emitted');
});

// ---------------------------------------------------------------------------
// Test 2: runGit emits LOCK_RELEASED on success
// ---------------------------------------------------------------------------

test('runGit: emits LOCK_CLAIMED + LOCK_RELEASED on success', () => {
  resetMocks();
  const fakeProject = makeTempDir('test2-project');
  fs.mkdirSync(path.join(fakeProject, '.git'), { recursive: true });

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: path.join(fakeProject, 'heartbeat.json'),
    QUEUE_DIR: path.join(fakeProject, 'queue'),
    WORKTREE_BASE: TEST_WORKTREE_BASE,
  });

  const result = gitFinalizer.runGit('echo hello', {
    slice_id: '100',
    op: 'test_success',
    cwd: fakeProject,
    encoding: 'utf-8',
  });

  assert.ok(result.includes('hello'), 'Should return command output');
  assert.ok(events.find(e => e.event === 'LOCK_CLAIMED' && e.op === 'test_success'), 'LOCK_CLAIMED');
  assert.ok(events.find(e => e.event === 'LOCK_RELEASED' && e.op === 'test_success'), 'LOCK_RELEASED');
});

// ---------------------------------------------------------------------------
// Test 3: Worktree orphan sweep
// ---------------------------------------------------------------------------

test('sweepStaleResources: prunes orphan worktree dir with no git metadata', () => {
  resetMocks();
  const fakeProject = makeTempDir('test3-project');
  const gitDir = path.join(fakeProject, '.git');
  const worktreesDir = path.join(gitDir, 'worktrees');
  fs.mkdirSync(worktreesDir, { recursive: true });

  const hbPath = path.join(fakeProject, 'heartbeat.json');
  fs.writeFileSync(hbPath, JSON.stringify({
    status: 'idle',
    last_activity_ts: new Date(Date.now() - 120000).toISOString(),
  }));

  const queueDir = path.join(fakeProject, 'queue');
  fs.mkdirSync(queueDir, { recursive: true });

  // Use isolated worktree base
  const testWtBase = path.join(TEST_ROOT, 'wt-test3');
  fs.mkdirSync(testWtBase, { recursive: true });

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: hbPath,
    QUEUE_DIR: queueDir,
    WORKTREE_BASE: testWtBase,
  });

  // Place an orphan worktree dir (no matching .git/worktrees/ metadata)
  const orphanDir = path.join(testWtBase, 'fake123');
  fs.mkdirSync(orphanDir, { recursive: true });
  fs.writeFileSync(path.join(orphanDir, 'marker'), 'test');

  gitFinalizer.sweepStaleResources();

  assert.ok(!fs.existsSync(orphanDir), 'Orphan worktree dir should be removed');
  const prunedEvent = events.find(e => e.event === 'WORKTREE_ORPHAN_PRUNED' && e.phase === 'cycle_start_sweep');
  assert.ok(prunedEvent, 'WORKTREE_ORPHAN_PRUNED event should fire');
  assert.ok(prunedEvent.artifact.includes('fake123'), 'Event artifact: ' + (prunedEvent && prunedEvent.artifact));
});

// ---------------------------------------------------------------------------
// Test 4: Stale-lock sweep — prunes when idle + no IN_PROGRESS
// ---------------------------------------------------------------------------

test('sweepStaleResources: prunes stale .git/index.lock when idle and no IN_PROGRESS', () => {
  resetMocks();
  const fakeProject = makeTempDir('test4-project');
  const gitDir = path.join(fakeProject, '.git');
  fs.mkdirSync(gitDir, { recursive: true });

  const lockPath = path.join(gitDir, 'index.lock');
  fs.writeFileSync(lockPath, 'stale');
  const oldTime = new Date(Date.now() - 120000);
  fs.utimesSync(lockPath, oldTime, oldTime);

  const hbPath = path.join(fakeProject, 'heartbeat.json');
  fs.writeFileSync(hbPath, JSON.stringify({
    status: 'idle',
    last_activity_ts: new Date(Date.now() - 120000).toISOString(),
  }));

  const queueDir = path.join(fakeProject, 'queue');
  fs.mkdirSync(queueDir, { recursive: true });

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: hbPath,
    QUEUE_DIR: queueDir,
    WORKTREE_BASE: path.join(TEST_ROOT, 'wt-test4-empty'),
  });

  const result = gitFinalizer.sweepStaleResources();

  assert.ok(!fs.existsSync(lockPath), 'Stale lock should be pruned');
  assert.strictEqual(result, true, 'Should return true (dispatch should proceed)');
  const prunedEvent = events.find(e => e.event === 'LOCK_ORPHAN_PRUNED' && e.phase === 'cycle_start_sweep');
  assert.ok(prunedEvent, 'LOCK_ORPHAN_PRUNED event should fire');
});

// ---------------------------------------------------------------------------
// Test 5: Stale-lock decline — IN_PROGRESS file blocks pruning
// ---------------------------------------------------------------------------

test('sweepStaleResources: declines to prune lock when IN_PROGRESS file exists', () => {
  resetMocks();
  const fakeProject = makeTempDir('test5-project');
  const gitDir = path.join(fakeProject, '.git');
  fs.mkdirSync(gitDir, { recursive: true });

  const lockPath = path.join(gitDir, 'index.lock');
  fs.writeFileSync(lockPath, 'active');

  const hbPath = path.join(fakeProject, 'heartbeat.json');
  fs.writeFileSync(hbPath, JSON.stringify({
    status: 'idle',
    last_activity_ts: new Date(Date.now() - 120000).toISOString(),
  }));

  const queueDir = path.join(fakeProject, 'queue');
  fs.mkdirSync(queueDir, { recursive: true });
  fs.writeFileSync(path.join(queueDir, '42-IN_PROGRESS.md'), 'in flight');

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: hbPath,
    QUEUE_DIR: queueDir,
    WORKTREE_BASE: path.join(TEST_ROOT, 'wt-test5-empty'),
  });

  const result = gitFinalizer.sweepStaleResources();

  assert.ok(fs.existsSync(lockPath), 'Lock should NOT be pruned when something is in progress');
  assert.strictEqual(result, false, 'Should return false (dispatch should be skipped)');
  const detected = events.find(e => e.event === 'STALE_LOCK_DETECTED');
  assert.ok(detected, 'STALE_LOCK_DETECTED event should fire');
  assert.strictEqual(detected.decline_reason, 'in_progress_files_exist');
});

// ---------------------------------------------------------------------------
// Test 6: Retry success
// ---------------------------------------------------------------------------

test('createWorktreeWithRetry: succeeds after transient index.lock failures', () => {
  resetMocks();
  const fakeProject = makeTempDir('test6-project');
  fs.mkdirSync(path.join(fakeProject, '.git'), { recursive: true });

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: path.join(fakeProject, 'heartbeat.json'),
    QUEUE_DIR: path.join(fakeProject, 'queue'),
    WORKTREE_BASE: TEST_WORKTREE_BASE,
  });

  let callCount = 0;
  const fakePath = '/tmp/ds9-worktrees/test-retry';

  function mockCreate(id, branch) {
    callCount++;
    if (callCount <= 2) {
      const err = new Error('fatal: index.lock File exists');
      err.stderr = Buffer.from('fatal: Unable to create ... index.lock File exists');
      throw err;
    }
    return fakePath;
  }

  // maxRetries=5, but succeeds on attempt 3 so real backoff = 2+4 = 6s
  const result = gitFinalizer.createWorktreeWithRetry(mockCreate, '200', 'slice/200', 5);

  assert.strictEqual(result, fakePath);
  assert.strictEqual(callCount, 3, 'Should succeed on 3rd attempt');

  const retryEvents = events.filter(e => e.event === 'WORKTREE_SETUP_RETRY');
  assert.strictEqual(retryEvents.length, 2, 'Should emit 2 WORKTREE_SETUP_RETRY events');
  assert.strictEqual(retryEvents[0].attempt, 1);
  assert.strictEqual(retryEvents[1].attempt, 2);
});

// ---------------------------------------------------------------------------
// Test 7: Retry exhaustion
// ---------------------------------------------------------------------------

test('createWorktreeWithRetry: exhausts retries and throws with stale reason', () => {
  resetMocks();
  const fakeProject = makeTempDir('test7-project');
  const gitDir = path.join(fakeProject, '.git');
  fs.mkdirSync(gitDir, { recursive: true });

  // Create index.lock that persists across retries
  const lockPath = path.join(gitDir, 'index.lock');

  gitFinalizer.init({
    PROJECT_DIR: fakeProject,
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: path.join(fakeProject, 'heartbeat.json'),
    QUEUE_DIR: path.join(fakeProject, 'queue'),
    WORKTREE_BASE: TEST_WORKTREE_BASE,
  });

  let callCount = 0;
  function mockAlwaysFail(id, branch) {
    callCount++;
    // Re-create the lock file before each attempt (pruneOrphanLock may remove it between retries)
    fs.writeFileSync(lockPath, 'stuck');
    const err = new Error('fatal: index.lock File exists');
    err.stderr = Buffer.from('fatal: Unable to create ... index.lock File exists');
    throw err;
  }

  let threw = false;
  let caughtErr;
  try {
    // maxRetries=2 to keep test fast (2+4=6s backoff)
    gitFinalizer.createWorktreeWithRetry(mockAlwaysFail, '201', 'slice/201', 2);
  } catch (err) {
    threw = true;
    caughtErr = err;
  }

  assert.ok(threw, 'Should throw after exhausting retries');
  assert.strictEqual(caughtErr.retryReason, 'branch_creation_blocked_stale');
  assert.ok(caughtErr.lockInfo, 'Error should have lockInfo');
  assert.ok(caughtErr.lockInfo.lock_mtime, 'lockInfo should have mtime');

  assert.strictEqual(callCount, 3, 'Should attempt initial + 2 retries');
  const retryEvents = events.filter(e => e.event === 'WORKTREE_SETUP_RETRY');
  assert.strictEqual(retryEvents.length, 2, 'Should emit 2 retry events');

  // Clean up
  try { fs.unlinkSync(lockPath); } catch (_) {}
});

// ---------------------------------------------------------------------------
// Test 8: Path guard
// ---------------------------------------------------------------------------

test('assertWorktreePath: rejects paths outside worktree base', () => {
  // Reset to production paths for this test
  gitFinalizer.init({
    PROJECT_DIR: '/tmp/fake',
    registerEvent: mockRegisterEvent,
    log: mockLog,
    HEARTBEAT_FILE: '/tmp/fake/hb.json',
    QUEUE_DIR: '/tmp/fake/queue',
    // Use default WORKTREE_BASE by passing the production value
    WORKTREE_BASE: '/tmp/ds9-worktrees',
  });

  let threw = false;
  try {
    gitFinalizer.assertWorktreePath('/home/user/important-data');
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('SAFETY'), 'Error should mention SAFETY');
  }
  assert.ok(threw, 'Should throw for path outside worktree base');

  // Should NOT throw for valid path
  gitFinalizer.assertWorktreePath('/tmp/ds9-worktrees/123');
});

// ---------------------------------------------------------------------------
// Cleanup & summary
// ---------------------------------------------------------------------------

try { fs.rmSync(TEST_ROOT, { recursive: true, force: true }); } catch (_) {}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
