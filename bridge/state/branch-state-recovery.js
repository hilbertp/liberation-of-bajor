'use strict';

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('./atomic-write');
const { createInitialBranchState } = require('./initial-schema');

const STATE_FILE = path.resolve(__dirname, 'branch-state.json');

/**
 * reconcileBranchState({ registerEvent, log, runGit })
 *
 * Startup recovery scan for branch-state.json (ADR §8).
 * - Missing file: write initial schema, emit BRANCH_STATE_INITIALIZED.
 * - Present + parseable: re-derive branch section from git, preserve gate.
 * - Present + corrupt: log warning, emit BRANCH_STATE_RESET_FROM_CORRUPT, write fresh.
 */
function reconcileBranchState({ registerEvent, log, runGit }) {
  let existing = null;
  let corrupt = false;

  // --- Read existing file (if any) ---
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    try {
      existing = JSON.parse(raw);
    } catch (_) {
      corrupt = true;
      const truncated = raw.length > 1024 ? raw.slice(0, 1024) : raw;
      log('warn', 'branch_state', { msg: 'branch-state.json is corrupt, resetting to initial schema' });
      registerEvent('0', 'BRANCH_STATE_RESET_FROM_CORRUPT', { corrupt_content: truncated });
    }
  }

  // --- Missing or corrupt: write fresh initial schema ---
  if (!existing) {
    const initial = createInitialBranchState();
    writeJsonAtomic(STATE_FILE, initial);
    if (!corrupt) {
      registerEvent('0', 'BRANCH_STATE_INITIALIZED', {});
    }
    return initial;
  }

  // --- Present + parseable: re-derive branch section from git ---
  const state = Object.assign(createInitialBranchState(), existing);

  try {
    // main tip
    const mainSha = runGit('git rev-parse main', { slice_id: '0', op: 'branchState_mainTip', encoding: 'utf-8' }).trim();
    const mainSubject = runGit('git log -1 --format=%s main', { slice_id: '0', op: 'branchState_mainSubject', encoding: 'utf-8' }).trim();
    const mainTs = runGit('git log -1 --format=%cI main', { slice_id: '0', op: 'branchState_mainTs', encoding: 'utf-8' }).trim();

    state.main = { tip_sha: mainSha, tip_subject: mainSubject, tip_ts: mainTs };
  } catch (err) {
    log('warn', 'branch_state', { msg: 'Failed to read main tip from git', error: err.message });
    state.main = createInitialBranchState().main;
  }

  try {
    // dev tip — dev branch may not exist yet
    const devSha = runGit('git rev-parse dev', { slice_id: '0', op: 'branchState_devTip', encoding: 'utf-8' }).trim();
    const devTs = runGit('git log -1 --format=%cI dev', { slice_id: '0', op: 'branchState_devTs', encoding: 'utf-8' }).trim();
    const aheadStr = runGit('git rev-list main..dev --count', { slice_id: '0', op: 'branchState_devAhead', encoding: 'utf-8' }).trim();
    const aheadCount = parseInt(aheadStr, 10) || 0;

    // Commit list: short sha + subject for each commit ahead of main
    let commits = [];
    if (aheadCount > 0) {
      const logOutput = runGit('git log main..dev --format=%H|%s', { slice_id: '0', op: 'branchState_devCommits', encoding: 'utf-8' }).trim();
      commits = logOutput.split('\n').filter(Boolean).map(line => {
        const [sha, ...rest] = line.split('|');
        return { sha, subject: rest.join('|') };
      });
    }

    state.dev = {
      tip_sha: devSha,
      tip_ts: devTs,
      commits_ahead_of_main: aheadCount,
      commits,
      deferred_slices: (existing.dev && existing.dev.deferred_slices) || [],
    };
  } catch (_) {
    // dev branch doesn't exist — use defaults
    state.dev = createInitialBranchState().dev;
    if (existing.dev && existing.dev.deferred_slices) {
      state.dev.deferred_slices = existing.dev.deferred_slices;
    }
  }

  try {
    // last_merge: merge-base of main and dev
    const mergeBase = runGit('git merge-base main dev', { slice_id: '0', op: 'branchState_mergeBase', encoding: 'utf-8' }).trim();
    const mergeTs = runGit(`git log -1 --format=%cI ${mergeBase}`, { slice_id: '0', op: 'branchState_mergeTs', encoding: 'utf-8' }).trim();
    state.last_merge = { sha: mergeBase, ts: mergeTs };
  } catch (_) {
    state.last_merge = null;
  }

  // Preserve gate section from existing file
  state.gate = existing.gate || createInitialBranchState().gate;

  writeJsonAtomic(STATE_FILE, state);
  return state;
}

module.exports = { reconcileBranchState, STATE_FILE };
