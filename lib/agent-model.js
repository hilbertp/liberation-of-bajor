'use strict';
// ── agent-model.js — which model an agent runs at, read from CONFIGURATION (slice 357) ──
//
// bridge/bridge.config.json's `claudeArgs` is where this system's model and effort are set;
// the orchestrator spawns Rom straight from that array. Anything else that spawns an agent
// (scripts/author-ac-test.js) must read the same place, or it silently keeps running at
// whatever model was hardcoded when it was written — author-ac-test.js sat pinned to
// claude-opus-4-8 --effort high for weeks after the fleet moved to claude-opus-5 --effort max.
//
// There is deliberately NO built-in default model: `claude` spawned without --model falls
// back to ANTHROPIC_MODEL, so a missing config value would produce an agent run at an
// unknown model rather than a loud stop. Callers check for null and refuse.
//
// Pure over the (repoRoot, env) handed in — the only I/O is reading the config file.

const fs = require('fs');
const path = require('path');

const CONFIG_REL = 'bridge/bridge.config.json';

function flagValue(args, flag) {
  const i = Array.isArray(args) ? args.indexOf(flag) : -1;
  const v = i >= 0 ? args[i + 1] : null;
  return typeof v === 'string' && v && !v.startsWith('--') ? v : null;
}

/**
 * agentModel(repoRoot, env) → { model, effort, source }
 *
 * `model`/`effort` are null when neither the environment override nor the config supplies
 * them. `source` names where a caller should look when they are missing.
 */
function agentModel(repoRoot, env) {
  const e = env || process.env;
  let claudeArgs = [];
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, CONFIG_REL), 'utf8'));
    if (Array.isArray(cfg.claudeArgs)) claudeArgs = cfg.claudeArgs;
  } catch (_) {}
  return {
    model: e.DENORIOS_AGENT_MODEL || flagValue(claudeArgs, '--model'),
    effort: e.DENORIOS_AGENT_EFFORT || flagValue(claudeArgs, '--effort'),
    source: `${CONFIG_REL} claudeArgs (override: DENORIOS_AGENT_MODEL / DENORIOS_AGENT_EFFORT)`,
  };
}

module.exports = { agentModel, flagValue, CONFIG_REL };
