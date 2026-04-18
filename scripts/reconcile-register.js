#!/usr/bin/env node
/**
 * reconcile-register.js
 *
 * One-shot script to reconcile bridge/register.jsonl against actual git state.
 * Finds every slice whose latest event is ACCEPTED with no subsequent MERGED or
 * ARCHIVED event, then classifies each as merge / archive / needs_review based
 * on branch reachability from main.
 *
 * Usage:
 *   node scripts/reconcile-register.js [--dry-run] [--apply] [--register <path>]
 *
 * --dry-run   (default) Print what would happen without modifying the register.
 * --apply     Actually append synthetic events to the register file.
 * --register  Override the default register path (bridge/register.jsonl).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_DIR    = path.resolve(__dirname, '..');
const DEFAULT_REGISTER = path.join(PROJECT_DIR, 'bridge', 'register.jsonl');

// ---------------------------------------------------------------------------
// Argv
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  let apply = false;
  let registerPath = DEFAULT_REGISTER;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--apply')        { apply = true; continue; }
    if (argv[i] === '--dry-run')      { apply = false; continue; }
    if (argv[i] === '--register' && argv[i + 1]) {
      registerPath = path.resolve(argv[++i]);
      continue;
    }
  }
  return { apply, registerPath };
}

// ---------------------------------------------------------------------------
// loadRegister — parse JSONL into array of events
// ---------------------------------------------------------------------------

function loadRegister(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`Error: cannot read register at ${filePath}: ${err.message}\n`);
    process.exit(1);
  }

  const events = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch (err) {
      process.stderr.write(`Warning: malformed JSONL at line ${i + 1}, skipping: ${err.message}\n`);
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// foldState — reduce events into per-slice state
// ---------------------------------------------------------------------------

function foldState(events) {
  const state = new Map();

  for (const ev of events) {
    const id = ev.id;
    if (id == null) continue;

    if (!state.has(id)) {
      state.set(id, {
        latestEvent: null,
        branch: null,
        hasAccepted: false,
        hasMerged: false,
        hasArchived: false,
        events: [],
      });
    }

    const s = state.get(id);
    s.events.push(ev);
    s.latestEvent = ev.event || s.latestEvent;

    if (ev.event === 'ACCEPTED') {
      s.hasAccepted = true;
      if (ev.branch) s.branch = ev.branch;
    }
    if (ev.event === 'MERGED') {
      s.hasMerged = true;
      if (ev.branch) s.branch = ev.branch;
    }
    if (ev.event === 'ARCHIVED') {
      s.hasArchived = true;
    }

    // Also pick up branch from DONE events (DONE reports often carry the branch)
    if (ev.branch && !s.branch) {
      s.branch = ev.branch;
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function gitIsAncestor(branch) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', branch, 'main'], {
      cwd: PROJECT_DIR,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function gitBranchExists(branch) {
  try {
    execFileSync('git', ['rev-parse', '--verify', branch], {
      cwd: PROJECT_DIR,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// classify — decide verdict for each unresolved slice
// ---------------------------------------------------------------------------

function classify(id, sliceState) {
  const branch = sliceState.branch;

  // Special case: test artifacts
  if (/^test-/.test(id) || /^999$/.test(id)) {
    return { id, verdict: 'archive', reason: 'test_artifact', branch: branch || null };
  }

  // No branch recorded or branch is literally "main"
  if (!branch || branch === 'main') {
    return { id, verdict: 'archive', reason: 'register_drift_no_branch', branch: branch || null };
  }

  // Check if branch is reachable from main
  if (gitIsAncestor(branch)) {
    return { id, verdict: 'merge', reason: 'ancestry_verified', branch };
  }

  // Branch exists but not ancestor — needs human review
  if (gitBranchExists(branch)) {
    return { id, verdict: 'needs_review', reason: 'branch_exists_not_ancestor', branch };
  }

  // Branch doesn't exist at all — drift
  return { id, verdict: 'archive', reason: 'register_drift_no_branch', branch };
}

// ---------------------------------------------------------------------------
// appendEvent — write one JSONL line
// ---------------------------------------------------------------------------

function appendEvent(filePath, event) {
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { apply, registerPath } = parseArgs(process.argv);
  const mode = apply ? 'APPLY' : 'DRY-RUN';

  process.stdout.write(`reconcile-register [${mode}]\n`);
  process.stdout.write(`Register: ${registerPath}\n\n`);

  const events = loadRegister(registerPath);
  const state  = foldState(events);

  // Find unresolved: ACCEPTED but no MERGED/ARCHIVED
  const unresolved = [];
  for (const [id, s] of state) {
    if (s.hasAccepted && !s.hasMerged && !s.hasArchived) {
      unresolved.push({ id, state: s });
    }
  }

  if (unresolved.length === 0) {
    process.stdout.write('All ACCEPTED slices have terminal events. Nothing to do.\n');
    process.exit(0);
  }

  // Classify each
  const results = unresolved.map(({ id, state: s }) => classify(id, s));

  // Buckets
  const wouldMerge   = results.filter(r => r.verdict === 'merge');
  const wouldArchive = results.filter(r => r.verdict === 'archive');
  const needsReview  = results.filter(r => r.verdict === 'needs_review');

  const now = new Date().toISOString();

  // Apply if requested
  if (apply) {
    for (const r of results) {
      if (r.verdict === 'merge') {
        appendEvent(registerPath, {
          ts: now,
          id: r.id,
          event: 'MERGED',
          reconciled: true,
          reason: r.reason,
        });
      } else if (r.verdict === 'archive') {
        appendEvent(registerPath, {
          ts: now,
          id: r.id,
          event: 'ARCHIVED',
          reconciled: true,
          reason: r.reason,
        });
      }
      // needs_review: do not write anything
    }
  }

  // Summary
  process.stdout.write('Summary\n');
  process.stdout.write('─'.repeat(50) + '\n');
  process.stdout.write(`  ${apply ? 'Merged' : 'Would merge'}:   ${wouldMerge.length}\n`);
  process.stdout.write(`  ${apply ? 'Archived' : 'Would archive'}: ${wouldArchive.length}\n`);
  process.stdout.write(`  Needs review:    ${needsReview.length}\n`);
  process.stdout.write(`  Total:           ${results.length}\n`);
  process.stdout.write('\n');

  // Detail per bucket
  if (wouldMerge.length > 0) {
    process.stdout.write(`${apply ? 'Merged' : 'Would merge'}:\n`);
    for (const r of wouldMerge) {
      process.stdout.write(`  ${r.id}  branch=${r.branch}  reason=${r.reason}\n`);
    }
    process.stdout.write('\n');
  }

  if (wouldArchive.length > 0) {
    process.stdout.write(`${apply ? 'Archived' : 'Would archive'}:\n`);
    for (const r of wouldArchive) {
      process.stdout.write(`  ${r.id}  branch=${r.branch}  reason=${r.reason}\n`);
    }
    process.stdout.write('\n');
  }

  if (needsReview.length > 0) {
    process.stdout.write('Needs review:\n');
    for (const r of needsReview) {
      process.stdout.write(`  ${r.id}  branch=${r.branch}  reason=${r.reason}\n`);
    }
    process.stdout.write('\n');
  }
}

main();
