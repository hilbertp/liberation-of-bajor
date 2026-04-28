'use strict';

/**
 * Returns a fresh branch-state object with the ADR §8 schema.
 * Used for initial creation and corrupt-file recovery.
 */
function createInitialBranchState() {
  return {
    schema_version: 1,
    main: { tip_sha: null, tip_subject: null, tip_ts: null },
    dev: {
      tip_sha: null,
      tip_ts: null,
      commits_ahead_of_main: 0,
      commits: [],
      deferred_slices: [],
    },
    last_merge: null,
    gate: { status: 'IDLE', current_run: null, last_failure: null, last_pass: null },
  };
}

module.exports = { createInitialBranchState };
