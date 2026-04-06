'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULTS = {
  pollIntervalMs: 5000,
  timeoutMs: 900000,
  heartbeatIntervalMs: 60000,
  queueDir: 'queue',
  logFile: 'bridge.log',
  heartbeatFile: 'heartbeat.json',
  claudeCommand: 'claude',
  claudeArgs: ['-p', '--permission-mode', 'bypassPermissions'],
  projectDir: '..',
  maxRetries: 0,
};

function loadConfig() {
  const configPath = path.join(__dirname, 'bridge.config.json');
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    // Config file absent or unreadable — proceed with defaults.
    // This is intentional: the watcher must work with zero configuration.
  }
  return Object.assign({}, DEFAULTS, fileConfig);
}

const config = loadConfig();

// ---------------------------------------------------------------------------
// Resolved paths
// ---------------------------------------------------------------------------

const QUEUE_DIR      = path.resolve(__dirname, config.queueDir);
const LOG_FILE       = path.resolve(__dirname, config.logFile);
const HEARTBEAT_FILE = path.resolve(__dirname, config.heartbeatFile);
const PROJECT_DIR    = path.resolve(__dirname, config.projectDir);

// Ensure queue directory exists.
fs.mkdirSync(QUEUE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Color support
// ---------------------------------------------------------------------------

// Honor NO_COLOR env var: checked once at startup.
const USE_COLOR = !process.env.NO_COLOR;

const C = {
  green:  USE_COLOR ? '\x1b[32m' : '',
  red:    USE_COLOR ? '\x1b[31m' : '',
  yellow: USE_COLOR ? '\x1b[33m' : '',
  cyan:   USE_COLOR ? '\x1b[36m' : '',
  dim:    USE_COLOR ? '\x1b[2m'  : '',
  reset:  USE_COLOR ? '\x1b[0m'  : '',
};

// ---------------------------------------------------------------------------
// Stdout-only output (dividers, progress ticks — must NOT go to bridge.log)
// ---------------------------------------------------------------------------

const DIVIDER = '─'.repeat(64);

function printStdout(line) {
  process.stdout.write(line + '\n');
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

/**
 * timestampNow()
 * Returns HH:MM:SS string for the current local time.
 */
function timestampNow() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * formatForStdout(level, event, fields)
 *
 * Returns a human-readable line (or null to suppress) for terminal display.
 * bridge.log receives JSON; stdout receives this.
 */
function formatForStdout(level, event, fields) {
  // Heartbeat is too noisy for the terminal — suppress entirely.
  if (event === 'heartbeat') return null;

  const ts = timestampNow();
  const prefix = `[Bridge] ${ts}`;

  if (event === 'complete') {
    const durationMs = fields.durationMs || 0;
    const totalSec   = Math.floor(durationMs / 1000);
    const mins       = Math.floor(totalSec / 60);
    const secs       = totalSec % 60;
    const duration   = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    if (fields.msg && fields.msg.includes('no DONE file')) {
      return `${prefix}  ${C.red}✗ Commission ${fields.id} exited cleanly but wrote no DONE file — fallback written · ${duration}${C.reset}`;
    }
    if (level === 'error' || level === 'warn') {
      return `${prefix}  ${C.red}✗ Commission ${fields.id} failed · ${duration}${C.reset}`;
    }
    return `${prefix}  ${C.green}✓ Commission ${fields.id} complete · ${duration}${C.reset}`;
  }

  if (event === 'state') {
    return `${prefix}  ${C.dim}  ${fields.from} → ${fields.to}${C.reset}`;
  }

  if (event === 'timeout') {
    let msg = `✗ Commission ${fields.id} timed out`;
    if (fields.durationMs) {
      const totalSec = Math.floor(fields.durationMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      msg += ` · ${mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}`;
    }
    return `${prefix}  ${C.red}${msg}${C.reset}`;
  }

  if (event === 'error') {
    const detail = fields.exitCode != null ? `exit ${fields.exitCode}` : (fields.error || '');
    const msg = `✗ ${fields.msg || 'Error'}${detail ? ` · ${detail}` : ''}`;
    return `${prefix}  ${C.red}${msg}${C.reset}`;
  }

  if (event === 'invoke') {
    const timeoutMin = Math.round((fields.timeoutMs || 0) / 60000);
    return `${prefix}  ${C.dim}  claude -p invoked (timeout: ${timeoutMin}min)${C.reset}`;
  }

  if (event === 'pickup') {
    const titlePart = fields.title ? `  "${fields.title}"` : '';
    return `${prefix}  ${C.cyan}▶ Commission ${fields.id}${titlePart}${C.reset}`;
  }

  if (event === 'startup') {
    const pollSec    = Math.round((config.pollIntervalMs || 5000) / 1000);
    const timeoutMin = Math.round((config.timeoutMs || 900000) / 60000);
    return `${prefix}  Watcher started · polling every ${pollSec}s · timeout ${timeoutMin}min`;
  }

  return `${prefix}  ${fields.msg || event}`;
}

/**
 * log(level, event, fields)
 *
 * Writes one JSON line to bridge.log AND a human-readable line to stdout.
 * Each log line: { ts, level, event, ...fields }
 */
function log(level, event, fields) {
  const line = JSON.stringify(Object.assign({ ts: new Date().toISOString(), level, event }, fields));
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (err) {
    // Log file write failure must not crash the watcher.
    process.stdout.write('[log-write-error] ' + err.message + '\n');
  }
  const humanLine = formatForStdout(level, event, fields);
  if (humanLine !== null) {
    process.stdout.write(humanLine + '\n');
  }
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * parseFrontmatter(content)
 *
 * Zero-dependency, regex-based YAML frontmatter extractor.
 * Returns a flat key→value object, or null if frontmatter is absent/malformed.
 * Values are stripped of surrounding quotes.
 */
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

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

let heartbeatState = {
  status: 'idle',
  current_commission: null,
  pickupTime: null,   // internal — not written to file
  processed_total: 0,
};

function writeHeartbeat() {
  const elapsedSeconds = heartbeatState.pickupTime
    ? Math.floor((Date.now() - heartbeatState.pickupTime) / 1000)
    : null;

  const snapshot = {
    ts: new Date().toISOString(),
    status: heartbeatState.status,
    current_commission: heartbeatState.current_commission,
    commission_elapsed_seconds: elapsedSeconds,
    processed_total: heartbeatState.processed_total,
  };

  try {
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(snapshot, null, 2) + '\n');
  } catch (err) {
    log('warn', 'heartbeat', { msg: 'Failed to write heartbeat', error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Processing state
// ---------------------------------------------------------------------------

let processing = false;

// ---------------------------------------------------------------------------
// Rook invocation
// ---------------------------------------------------------------------------

/**
 * invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, effectiveTimeoutMs)
 *
 * Pipes commission content + report path instruction to `claude -p`.
 * On success: checks donePath exists; if not, writes a fallback DONE report.
 * On failure: writes an ERROR report and removes the IN_PROGRESS file.
 * Always removes the IN_PROGRESS file on completion.
 */
function invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, effectiveTimeoutMs) {
  const prompt = commissionContent + '\n\nWrite your report to: ' + donePath;

  const pickupTime = Date.now();
  heartbeatState.status = 'processing';
  heartbeatState.current_commission = id;
  heartbeatState.pickupTime = pickupTime;
  writeHeartbeat();

  log('info', 'invoke', {
    id,
    msg: 'Invoking claude -p',
    command: config.claudeCommand,
    args: config.claudeArgs,
    cwd: PROJECT_DIR,
    timeoutMs: effectiveTimeoutMs,
  });

  // Progress tick: every 60s while Rook is running — stdout only, not bridge.log.
  const tickInterval = setInterval(() => {
    const elapsedMs  = Date.now() - pickupTime;
    const totalSec   = Math.floor(elapsedMs / 1000);
    const mins       = Math.floor(totalSec / 60);
    const secs       = totalSec % 60;
    const elapsed    = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    printStdout(`[Bridge] ${timestampNow()}  ${C.yellow}⏳ still running · ${elapsed} elapsed${C.reset}`);
  }, 60000);

  const child = execFile(
    config.claudeCommand,
    config.claudeArgs,
    {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
      timeout: effectiveTimeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10 MB stdout buffer
    },
    (err, stdout, stderr) => {
      clearInterval(tickInterval);

      const durationMs = Date.now() - pickupTime;
      const isTimeout = err && err.killed && err.signal === 'SIGTERM';

      if (!err) {
        // Success path: check Rook wrote his DONE file.
        if (fs.existsSync(donePath)) {
          log('info', 'complete', { id, msg: 'Rook finished — DONE file present', durationMs });
          log('info', 'state', { id, from: 'IN_PROGRESS', to: 'DONE' });
        } else {
          // Fallback: Rook exited zero but wrote no DONE file.
          log('warn', 'complete', {
            id,
            msg: 'Rook exited cleanly but wrote no DONE file — writing fallback',
            durationMs,
          });
          writeFallbackDone(donePath, id, stdout);
          log('info', 'state', { id, from: 'IN_PROGRESS', to: 'DONE', fallback: true });
        }
      } else {
        // Failure path: invocation failure → ERROR file (watcher writes it).
        const reason = isTimeout ? 'timeout' : 'invocation-failure';
        log('error', isTimeout ? 'timeout' : 'error', {
          id,
          msg: isTimeout ? 'Commission timed out' : 'claude -p failed',
          exitCode: err.code,
          signal: err.signal || null,
          durationMs,
        });
        writeErrorFile(errorPath, id, reason, err, stdout, stderr);
        log('info', 'state', { id, from: 'IN_PROGRESS', to: 'ERROR' });
      }

      // Visual divider after commission resolves (stdout only).
      printStdout(DIVIDER);

      // Clean up IN_PROGRESS file.
      try {
        fs.unlinkSync(inProgressPath);
      } catch (unlinkErr) {
        log('warn', 'error', { id, msg: 'Failed to delete IN_PROGRESS file', error: unlinkErr.message });
      }

      // Reset processing state.
      processing = false;
      heartbeatState.status = 'idle';
      heartbeatState.current_commission = null;
      heartbeatState.pickupTime = null;
      heartbeatState.processed_total += 1;
      writeHeartbeat();
    }
  );

  // Feed the prompt to claude via stdin, then close stdin to signal EOF.
  child.stdin.write(prompt);
  child.stdin.end();
}

// ---------------------------------------------------------------------------
// Fallback DONE report (written by watcher when Rook exits 0 but writes nothing)
// ---------------------------------------------------------------------------

function writeFallbackDone(donePath, id, stdout) {
  const completed = new Date().toISOString();
  const content = [
    '---',
    `id: "${id}"`,
    `title: "Commission ${id} (fallback report)"`,
    'from: watcher',
    'to: mara',
    'status: PARTIAL',
    `commission_id: "${id}"`,
    `completed: "${completed}"`,
    '---',
    '',
    '## What I did',
    '',
    'Rook exited cleanly (exit code 0) but did not write a DONE file.',
    'This report was generated by the watcher as a fallback.',
    '',
    '## What succeeded',
    '',
    'Unknown — Rook produced no structured report.',
    '',
    '## What failed',
    '',
    'No DONE file written by Rook.',
    '',
    '## Blockers / Questions for Mara',
    '',
    'Investigate why Rook exited without writing a report.',
    '',
    '## Files changed',
    '',
    'Unknown.',
    '',
    '## Rook stdout (raw)',
    '',
    '```',
    stdout || '(empty)',
    '```',
  ].join('\n');

  try {
    fs.writeFileSync(donePath, content);
  } catch (err) {
    log('error', 'error', { id, msg: 'Failed to write fallback DONE file', error: err.message });
  }
}

// ---------------------------------------------------------------------------
// ERROR file (written by watcher on invocation failure)
// ---------------------------------------------------------------------------

function writeErrorFile(errorPath, id, reason, err, stdout, stderr) {
  const completed = new Date().toISOString();
  const exitCode = err.code != null ? String(err.code) : 'null';
  const signal = err.signal || 'null';

  const content = [
    '---',
    `id: "${id}"`,
    `title: "Commission ${id} invocation failure"`,
    'from: watcher',
    'to: mara',
    'status: ERROR',
    `commission_id: "${id}"`,
    `completed: "${completed}"`,
    '---',
    '',
    '## Failure reason',
    '',
    `**${reason}**`,
    '',
    reason === 'timeout'
      ? `The \`claude -p\` process was killed after exceeding the configured timeout.`
      : `The \`claude -p\` process exited with a non-zero status.`,
    '',
    '## Invocation details',
    '',
    `- Exit code: ${exitCode}`,
    `- Signal: ${signal}`,
    `- Reason: ${reason}`,
    '',
    '## stderr',
    '',
    '```',
    stderr || '(empty)',
    '```',
    '',
    '## stdout',
    '',
    '```',
    stdout || '(empty)',
    '```',
  ].join('\n');

  try {
    fs.writeFileSync(errorPath, content);
  } catch (writeErr) {
    log('error', 'error', { id, msg: 'Failed to write ERROR file', error: writeErr.message });
  }
}

// ---------------------------------------------------------------------------
// Poll cycle
// ---------------------------------------------------------------------------

function poll() {
  if (processing) return;

  let files;
  try {
    files = fs.readdirSync(QUEUE_DIR);
  } catch (err) {
    log('error', 'error', { msg: 'Failed to read queue directory', error: err.message });
    return;
  }

  const pendingFiles = files
    .filter(f => f.endsWith('-PENDING.md'))
    .sort(); // lexicographic = numeric FIFO given zero-padded IDs

  if (pendingFiles.length === 0) return;

  const pendingFile = pendingFiles[0];
  const pendingPath = path.join(QUEUE_DIR, pendingFile);

  // Derive the commission ID from the filename (e.g. "003-PENDING.md" → "003").
  const id = pendingFile.replace('-PENDING.md', '');

  // Read commission content.
  let commissionContent;
  try {
    commissionContent = fs.readFileSync(pendingPath, 'utf-8');
  } catch (err) {
    log('error', 'error', { id, msg: 'Failed to read PENDING file', error: err.message });
    return;
  }

  // Parse frontmatter for timeout_min override and title.
  const meta = parseFrontmatter(commissionContent);
  const timeoutMin = meta && meta.timeout_min && meta.timeout_min !== 'null'
    ? parseInt(meta.timeout_min, 10)
    : null;
  const effectiveTimeoutMs = timeoutMin != null && !isNaN(timeoutMin)
    ? timeoutMin * 60 * 1000
    : config.timeoutMs;
  const title = (meta && meta.title) || null;

  // Derive sibling paths.
  const inProgressPath = path.join(QUEUE_DIR, `${id}-IN_PROGRESS.md`);
  const donePath       = path.join(QUEUE_DIR, `${id}-DONE.md`);
  const errorPath      = path.join(QUEUE_DIR, `${id}-ERROR.md`);

  // Atomic rename: PENDING → IN_PROGRESS.
  try {
    fs.renameSync(pendingPath, inProgressPath);
  } catch (err) {
    log('error', 'error', { id, msg: 'Failed to rename PENDING to IN_PROGRESS', error: err.message });
    return;
  }

  // Visual divider before commission starts (stdout only).
  printStdout(DIVIDER);

  log('info', 'pickup', { id, title, msg: 'Commission picked up', file: pendingFile });
  log('info', 'state', { id, from: 'PENDING', to: 'IN_PROGRESS' });

  processing = true;

  // Invoke Rook asynchronously — event loop stays live.
  invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, effectiveTimeoutMs);
}

// ---------------------------------------------------------------------------
// Crash recovery stub
// ---------------------------------------------------------------------------

function crashRecovery() {
  // TODO (Layer 3, capability 3.1): Scan QUEUE_DIR for orphaned IN_PROGRESS files
  // on startup and resolve them:
  //   - {id}-IN_PROGRESS.md alone          → rename back to {id}-PENDING.md (re-queue)
  //   - {id}-IN_PROGRESS.md + DONE present  → delete IN_PROGRESS (already complete)
  //   - {id}-IN_PROGRESS.md + ERROR present → delete IN_PROGRESS (already failed)
  // See docs/contracts/queue-lifecycle.md §"Crash recovery" and
  // Architecture — Bridge of Hormuz v1.md §4 for full spec.
  log('info', 'startup', { msg: 'Crash recovery: stub (Layer 3, not implemented)' });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  log('info', 'shutdown', { msg: `Received ${signal} — shutting down` });
  if (processing) {
    log('warn', 'shutdown', {
      msg: 'A commission is in flight at shutdown. The IN_PROGRESS file will be recovered by crash recovery (Layer 3) on next startup.',
      current_commission: heartbeatState.current_commission,
    });
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

log('info', 'startup', {
  msg: 'Watcher started',
  config: {
    pollIntervalMs: config.pollIntervalMs,
    timeoutMs: config.timeoutMs,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    queueDir: QUEUE_DIR,
    logFile: LOG_FILE,
    heartbeatFile: HEARTBEAT_FILE,
    projectDir: PROJECT_DIR,
    claudeCommand: config.claudeCommand,
    claudeArgs: config.claudeArgs,
    maxRetries: config.maxRetries,
  },
});

// Visual divider after startup line (stdout only).
printStdout(DIVIDER);

crashRecovery();

// Initial heartbeat write so the file exists immediately on startup.
writeHeartbeat();

// Start heartbeat interval.
setInterval(writeHeartbeat, config.heartbeatIntervalMs);

// Start poll interval + immediate first poll.
setInterval(poll, config.pollIntervalMs);
poll();
