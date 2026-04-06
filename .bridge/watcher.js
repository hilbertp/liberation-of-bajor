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
  claudeArgs: ['-p', '--permission-mode', 'bypassPermissions', '--output-format', 'json'],
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
// Color / box-drawing support
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

// Box-drawing characters (degraded to ASCII when NO_COLOR is set).
const WIDTH = 67;
const BOX = USE_COLOR ? {
  doubleRow: '═'.repeat(WIDTH),
  singleRow: '─'.repeat(WIDTH),
  top:       '┌' + '─'.repeat(WIDTH - 1),
  bottom:    '└' + '─'.repeat(WIDTH - 1),
  side:      '│',
} : {
  doubleRow: '='.repeat(WIDTH),
  singleRow: '-'.repeat(WIDTH),
  top:       '+' + '-'.repeat(WIDTH - 1),
  bottom:    '+' + '-'.repeat(WIDTH - 1),
  side:      '|',
};

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const SESSION = {
  startTime: Date.now(),
  completed: 0,
  failed: 0,
  tokensIn: 0,
  tokensOut: 0,
  costUsd: 0,
};

// Cost rates per 1M tokens (hardcoded; make configurable in a future commission).
const COST_PER_1M_INPUT  = 15.00;
const COST_PER_1M_OUTPUT = 75.00;

function calcCost(tokensIn, tokensOut) {
  return (tokensIn  / 1_000_000) * COST_PER_1M_INPUT
       + (tokensOut / 1_000_000) * COST_PER_1M_OUTPUT;
}

// ---------------------------------------------------------------------------
// Queue snapshot
// ---------------------------------------------------------------------------

/**
 * getQueueSnapshot(queueDir)
 * Returns counts of queue files in each state.
 */
function getQueueSnapshot(queueDir) {
  let files;
  try {
    files = fs.readdirSync(queueDir);
  } catch (_) {
    return { waiting: 0, in_progress: 0, completed: 0, failed: 0, awaiting_review: 0 };
  }
  const snap = { waiting: 0, in_progress: 0, completed: 0, failed: 0, awaiting_review: 0 };
  for (const f of files) {
    if      (f.endsWith('-PENDING.md'))     snap.waiting++;
    else if (f.endsWith('-IN_PROGRESS.md')) snap.in_progress++;
    else if (f.endsWith('-DONE.md'))        { snap.completed++; snap.awaiting_review++; }
    else if (f.endsWith('-ERROR.md'))       snap.failed++;
  }
  return snap;
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * extractTokens(stdout)
 * Parses Claude Code JSON output to find token usage.
 * Falls back gracefully if parsing fails or output format differs.
 */
function extractTokens(stdout) {
  if (!stdout) return { tokensIn: 0, tokensOut: 0, known: false };

  // Claude Code --output-format json may emit multiple JSON lines (JSONL).
  // Scan from the end to find the last entry with usage data.
  const lines = stdout.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const data = JSON.parse(line);
      if (data && data.usage && data.usage.input_tokens != null) {
        return {
          tokensIn:  Number(data.usage.input_tokens)  || 0,
          tokensOut: Number(data.usage.output_tokens) || 0,
          known: true,
        };
      }
      if (data && data.input_tokens != null) {
        return {
          tokensIn:  Number(data.input_tokens)  || 0,
          tokensOut: Number(data.output_tokens) || 0,
          known: true,
        };
      }
    } catch (_) {
      // Not valid JSON on this line — continue scanning.
    }
  }
  return { tokensIn: 0, tokensOut: 0, known: false };
}

// ---------------------------------------------------------------------------
// Stdout output (stakeholder-facing — no technical jargon)
// ---------------------------------------------------------------------------

function printStdout(line) {
  process.stdout.write(line + '\n');
}

// ---------------------------------------------------------------------------
// Structured logging (bridge.log only — no stdout)
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
 * log(level, event, fields)
 * Writes one JSON line to bridge.log. Does NOT write to stdout.
 */
function log(level, event, fields) {
  const line = JSON.stringify(Object.assign({ ts: new Date().toISOString(), level, event }, fields));
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (err) {
    // Log write failure must not crash the watcher.
    process.stdout.write('[log-write-error] ' + err.message + '\n');
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatTokenCount(n) {
  return n.toLocaleString('en-US');
}

function formatCost(usd) {
  return '$' + usd.toFixed(2);
}

function printSessionSummary() {
  const uptimeMins = Math.floor((Date.now() - SESSION.startTime) / 60000);
  const uptimeStr  = uptimeMins > 0 ? `${uptimeMins}m` : '<1m';
  const totalTok   = SESSION.tokensIn + SESSION.tokensOut;
  const tokStr     = totalTok > 0
    ? `${formatTokenCount(totalTok)} tokens · ${formatCost(SESSION.costUsd)}`
    : 'tokens: unknown';
  printStdout('');
  printStdout(`  Session: ${SESSION.completed} completed · ${SESSION.failed} failed · ${tokStr} · uptime ${uptimeStr}`);
}

// ---------------------------------------------------------------------------
// Startup block
// ---------------------------------------------------------------------------

function printStartupBlock(recoveryMessages) {
  const ts         = timestampNow();
  const pollSec    = Math.round(config.pollIntervalMs / 1000);
  const timeoutMin = Math.round(config.timeoutMs / 60000);

  printStdout(BOX.doubleRow);
  printStdout(`  Bridge of Hormuz · Watcher`);
  printStdout(`  Started: ${ts} · Polling every ${pollSec}s · Timeout: ${timeoutMin}min`);
  printStdout(BOX.doubleRow);

  if (recoveryMessages.length > 0) {
    printStdout('');
    printStdout('  Recovered on startup:');
    for (const msg of recoveryMessages) {
      printStdout(msg);
    }
  }

  const snap = getQueueSnapshot(QUEUE_DIR);
  printStdout('');

  if (snap.waiting === 0 && snap.in_progress === 0 && snap.completed === 0 && snap.failed === 0) {
    printStdout('  Queue is empty — watching for new commissions.');
  } else {
    printStdout('  Queue snapshot:');
    printStdout(`    📋 ${snap.waiting} waiting · ${snap.in_progress} in progress · ${snap.completed} completed · ${snap.failed} failed`);
  }

  printStdout(BOX.singleRow);
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
 * invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, title, effectiveTimeoutMs)
 *
 * Pipes commission content + report path instruction to `claude -p`.
 * Prints commission lifecycle block to stdout.
 * On success: checks donePath exists; if not, writes a fallback ERROR report.
 * On failure: writes an ERROR report.
 * Always cleans up IN_PROGRESS file on completion (gracefully if already gone).
 */
function invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, title, effectiveTimeoutMs) {
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

  // Commission lifecycle block — header
  const timeoutMin   = Math.round(effectiveTimeoutMs / 60000);
  const titleDisplay = title ? `"${title}"` : '(no title)';
  const B            = BOX.side;

  printStdout('');
  printStdout(BOX.top);
  printStdout(`${B}  ${C.cyan}► Commission ${id} · ${titleDisplay}${C.reset}`);
  printStdout(`${B}    Queued → Handed off to Rook · ${timeoutMin}min limit`);
  printStdout(`${B}`);

  // Progress tick: every 60s while Rook is running — stdout only, not bridge.log.
  const tickInterval = setInterval(() => {
    const elapsed = formatDuration(Date.now() - pickupTime);
    printStdout(`${B}    ${C.yellow}⏳ Working… ${elapsed}${C.reset}`);
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

      const durationMs  = Date.now() - pickupTime;
      const durationStr = formatDuration(durationMs);
      const isTimeout   = err && err.killed && err.signal === 'SIGTERM';

      // Extract token usage from JSON output.
      const { tokensIn, tokensOut, known } = extractTokens(stdout || '');
      const costUsd = known ? calcCost(tokensIn, tokensOut) : 0;

      if (!err) {
        // Success path: check Rook wrote his DONE file.
        if (fs.existsSync(donePath)) {
          const tokenStr = known
            ? `${formatTokenCount(tokensIn + tokensOut)} tokens · ${formatCost(costUsd)}`
            : 'tokens: unknown';
          printStdout(`${B}`);
          printStdout(`${B}    ${C.green}✓ Complete · ${durationStr} · ${tokenStr}${C.reset}`);
          printStdout(`${B}    Status: Done → Waiting for Mara's review`);
          printStdout(BOX.bottom);

          log('info', 'complete', { id, msg: 'Rook finished — DONE file present', durationMs, tokensIn, tokensOut, costUsd });
          log('info', 'state', { id, from: 'IN_PROGRESS', to: 'DONE' });

          SESSION.completed++;
          if (known) { SESSION.tokensIn += tokensIn; SESSION.tokensOut += tokensOut; SESSION.costUsd += costUsd; }
        } else {
          // Rook exited 0 but wrote no DONE file — write an ERROR report.
          printStdout(`${B}`);
          printStdout(`${B}    ${C.red}✗ Failed · ${durationStr} · Reason: No report written${C.reset}`);
          printStdout(`${B}    Status: Needs attention`);
          printStdout(BOX.bottom);

          log('warn', 'complete', {
            id,
            msg: 'Rook exited cleanly but wrote no DONE file — writing ERROR (no_report)',
            reason: 'no_report',
            durationMs,
          });
          writeErrorFile(errorPath, id, 'no_report', null, stdout, stderr);
          log('info', 'state', { id, from: 'IN_PROGRESS', to: 'ERROR', reason: 'no_report' });

          SESSION.failed++;
        }
      } else {
        // Failure path: invocation failure → ERROR file.
        const reason        = isTimeout ? 'timeout' : 'crash';
        const reasonDisplay = isTimeout ? 'Timed out' : 'Process error';
        const tokenPart     = known
          ? ` · ${formatTokenCount(tokensIn + tokensOut)} tokens · ${formatCost(costUsd)}`
          : '';

        printStdout(`${B}`);
        printStdout(`${B}    ${C.red}✗ Failed · ${durationStr} · Reason: ${reasonDisplay}${tokenPart}${C.reset}`);
        printStdout(`${B}    Status: Needs attention`);
        printStdout(BOX.bottom);

        log('error', isTimeout ? 'timeout' : 'error', {
          id,
          msg: isTimeout ? 'Commission timed out' : 'claude -p failed',
          reason,
          exitCode: err.code,
          signal: err.signal || null,
          durationMs,
          tokensIn:  known ? tokensIn  : null,
          tokensOut: known ? tokensOut : null,
          costUsd:   known ? costUsd   : null,
        });
        writeErrorFile(errorPath, id, reason, err, stdout, stderr);
        log('info', 'state', { id, from: 'IN_PROGRESS', to: 'ERROR', reason });

        SESSION.failed++;
        if (known) { SESSION.tokensIn += tokensIn; SESSION.tokensOut += tokensOut; SESSION.costUsd += costUsd; }
      }

      // Session summary after each commission completes.
      printSessionSummary();

      // Clean up IN_PROGRESS file.
      // Rook's crash recovery may have already renamed or deleted it — that's fine.
      if (fs.existsSync(inProgressPath)) {
        try {
          fs.unlinkSync(inProgressPath);
        } catch (_) {
          // Disappeared between the existence check and the delete — ignore.
        }
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
// ERROR file (written by watcher on invocation failure or invalid commission)
// ---------------------------------------------------------------------------

/**
 * writeErrorFile(errorPath, id, reason, err, stdout, stderr)
 *
 * Writes a structured ERROR report. The frontmatter always includes `reason`
 * so bridge.log and Mara's tooling can distinguish failure modes:
 *   "timeout"             — claude -p was killed after exceeding the timeout
 *   "crash"               — claude -p exited non-zero; exit_code included
 *   "no_report"           — claude -p exited 0 but wrote no DONE file
 *   "invalid_commission"  — PENDING file failed frontmatter validation
 *
 * @param {string}      errorPath  Absolute path for the ERROR file.
 * @param {string}      id         Commission ID.
 * @param {string}      reason     One of the four reason strings above.
 * @param {Error|null}  err        The Error object (null for no_report/invalid).
 * @param {string}      stdout     Combined stdout captured from the process.
 * @param {string}      stderr     Combined stderr captured from the process.
 * @param {Object}      [extra]    Optional extra fields (e.g. { missingFields }).
 */
function writeErrorFile(errorPath, id, reason, err, stdout, stderr, extra) {
  const completed = new Date().toISOString();
  const exitCode  = err && err.code != null ? String(err.code) : null;
  const signal    = err && err.signal ? err.signal : null;

  // Frontmatter lines — always present.
  const frontmatter = [
    '---',
    `id: "${id}"`,
    `title: "Commission ${id} — ${reason}"`,
    'from: watcher',
    'to: mara',
    'status: ERROR',
    `commission_id: "${id}"`,
    `completed: "${completed}"`,
    `reason: "${reason}"`,
  ];

  // exit_code is only meaningful for crash failures.
  if (reason === 'crash' && exitCode !== null) {
    frontmatter.push(`exit_code: ${exitCode}`);
  }

  frontmatter.push('---');

  // Truncate stdout/stderr to last 500 chars for no_report — avoids enormous files.
  const truncate = (s, n) => (s && s.length > n ? '…' + s.slice(-n) : s || '(empty)');
  const stdoutBody = reason === 'no_report' ? truncate(stdout, 500) : (stdout || '(empty)');
  const stderrBody = reason === 'no_report' ? truncate(stderr, 500) : (stderr || '(empty)');

  const detail = reason === 'timeout'
    ? 'The `claude -p` process was killed after exceeding the configured timeout.'
    : reason === 'crash'
      ? `The \`claude -p\` process exited with a non-zero status (exit code ${exitCode ?? 'unknown'}).`
      : reason === 'no_report'
        ? 'The `claude -p` process exited cleanly (exit 0) but wrote no DONE file.'
        : `Commission frontmatter validation failed. Missing fields: ${(extra && extra.missingFields || []).join(', ')}.`;

  const content = [
    ...frontmatter,
    '',
    '## Failure reason',
    '',
    `**${reason}**`,
    '',
    detail,
    '',
    '## Invocation details',
    '',
    `- Exit code: ${exitCode ?? 'n/a'}`,
    `- Signal: ${signal ?? 'n/a'}`,
    `- Reason: ${reason}`,
    '',
    '## stderr',
    '',
    '```',
    stderrBody,
    '```',
    '',
    '## stdout',
    '',
    '```',
    stdoutBody,
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

  // ---------------------------------------------------------------------------
  // 3.4 — Validation on intake
  //
  // Before renaming to IN_PROGRESS, check that all required frontmatter fields
  // are present and non-empty. Required: id, title, from, to, priority, created.
  //
  // If validation fails:
  //   - Do NOT rename to IN_PROGRESS (file stays as PENDING for inspection)
  //   - Write an ERROR report immediately
  //   - Log with reason "invalid_commission"
  //   - Remove the PENDING file so the poll loop doesn't re-process it forever
  //   - Continue the poll loop (do not crash)
  // ---------------------------------------------------------------------------
  const REQUIRED_FIELDS = ['id', 'title', 'from', 'to', 'priority', 'created'];
  const missingFields = REQUIRED_FIELDS.filter(
    field => !meta || !meta[field] || meta[field].trim() === ''
  );

  if (missingFields.length > 0) {
    // Use "unknown-{timestamp}" as fallback error path if id is indeterminate.
    const errId   = (meta && meta.id) || id;
    const errPath = path.join(QUEUE_DIR, `${errId}-ERROR.md`);

    printStdout('');
    printStdout(BOX.top);
    printStdout(`${BOX.side}  ${C.red}✗ Commission ${errId} · Rejected${C.reset}`);
    printStdout(`${BOX.side}    Missing required fields: ${missingFields.join(', ')}`);
    printStdout(BOX.bottom);

    log('error', 'error', {
      id: errId,
      msg: 'Commission rejected — missing required frontmatter fields',
      reason: 'invalid_commission',
      missing_fields: missingFields,
      file: pendingFile,
    });
    writeErrorFile(errPath, errId, 'invalid_commission', null, '', '', { missingFields });
    log('info', 'state', { id: errId, from: 'PENDING', to: 'ERROR', reason: 'invalid_commission' });

    // Remove the invalid PENDING file so it doesn't loop indefinitely.
    try { fs.unlinkSync(pendingPath); } catch (_) {}

    return; // Continue poll loop on next tick.
  }

  // Atomic rename: PENDING → IN_PROGRESS.
  try {
    fs.renameSync(pendingPath, inProgressPath);
  } catch (err) {
    log('error', 'error', { id, msg: 'Failed to rename PENDING to IN_PROGRESS', error: err.message });
    return;
  }

  log('info', 'pickup', { id, title, msg: 'Commission picked up', file: pendingFile });
  log('info', 'state', { id, from: 'PENDING', to: 'IN_PROGRESS' });

  processing = true;

  // Invoke Rook asynchronously — event loop stays live.
  invokeRook(commissionContent, donePath, inProgressPath, errorPath, id, title, effectiveTimeoutMs);
}

// ---------------------------------------------------------------------------
// Crash recovery (3.1)
// ---------------------------------------------------------------------------

/**
 * crashRecovery()
 *
 * Runs at startup before entering the poll loop. Scans the queue directory for
 * orphaned IN_PROGRESS files left behind by a prior crash and resolves each:
 *
 *   {id}-IN_PROGRESS alone           → rename back to PENDING (re-queue)
 *   {id}-IN_PROGRESS + DONE exists   → delete IN_PROGRESS (already complete)
 *   {id}-IN_PROGRESS + ERROR exists  → delete IN_PROGRESS (already failed)
 *
 * Returns an array of human-readable recovery messages for the startup block.
 * Logs technical details to bridge.log only.
 */
function crashRecovery() {
  let files;
  try {
    files = fs.readdirSync(QUEUE_DIR);
  } catch (err) {
    log('warn', 'startup_recovery', { msg: 'Cannot read queue dir for crash recovery', error: err.message });
    return [];
  }

  const inProgressFiles = files.filter(f => f.endsWith('-IN_PROGRESS.md'));
  if (inProgressFiles.length === 0) return [];

  const messages = [];

  for (const file of inProgressFiles) {
    const id             = file.replace('-IN_PROGRESS.md', '');
    const inProgressPath = path.join(QUEUE_DIR, file);
    const hasDone        = fs.existsSync(path.join(QUEUE_DIR, `${id}-DONE.md`));
    const hasError       = fs.existsSync(path.join(QUEUE_DIR, `${id}-ERROR.md`));

    if (hasDone || hasError) {
      // Commission already resolved — the IN_PROGRESS file is a stale artifact.
      const resolvedAs = hasDone ? 'DONE' : 'ERROR';
      try {
        fs.unlinkSync(inProgressPath);
        log('info', 'startup_recovery', {
          id,
          msg: `Orphaned IN_PROGRESS deleted (${resolvedAs} present)`,
          action: 'deleted',
          resolved_as: resolvedAs,
        });
        messages.push(
          `    ${C.green}✓${C.reset} Commission ${id} — cleared stale work-in-progress (already ${hasDone ? 'completed' : 'failed'})`
        );
      } catch (err) {
        log('warn', 'startup_recovery', { id, msg: 'Failed to delete orphaned IN_PROGRESS', error: err.message });
      }
    } else {
      // No resolution file — commission was interrupted mid-flight. Re-queue it.
      const pendingPath = path.join(QUEUE_DIR, `${id}-PENDING.md`);
      try {
        fs.renameSync(inProgressPath, pendingPath);  // atomic rename
        log('info', 'startup_recovery', {
          id,
          msg: 'Orphaned IN_PROGRESS renamed to PENDING (re-queued)',
          action: 're-queued',
        });
        messages.push(
          `    ${C.yellow}↩${C.reset} Commission ${id} — re-queued interrupted commission`
        );
      } catch (err) {
        log('warn', 'startup_recovery', { id, msg: 'Failed to rename orphaned IN_PROGRESS to PENDING', error: err.message });
      }
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Commission ID management (3.2)
// ---------------------------------------------------------------------------

/**
 * nextCommissionId(queueDir)
 *
 * Reads all filenames in queueDir, extracts their numeric prefix IDs, and
 * returns the next ID as a zero-padded three-digit string (e.g. "009").
 * Returns "001" if the directory is empty or unreadable.
 *
 * This function is purely computational — it does not write any files.
 * Exported so Mara can call it from .bridge/next-id.js.
 */
function nextCommissionId(queueDir) {
  let files;
  try {
    files = fs.readdirSync(queueDir);
  } catch (_) {
    return '001';
  }

  const ids = files
    .map(f => { const m = f.match(/^(\d+)-/); return m ? parseInt(m[1], 10) : null; })
    .filter(n => n !== null);

  if (ids.length === 0) return '001';
  return String(Math.max(...ids) + 1).padStart(3, '0');
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  log('info', 'shutdown', { msg: `Received ${signal} — shutting down` });
  if (processing) {
    log('warn', 'shutdown', {
      msg: 'A commission is in flight at shutdown. The IN_PROGRESS file will be recovered on next startup.',
      current_commission: heartbeatState.current_commission,
    });
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Startup — only runs when this file is executed directly (not when required)
// ---------------------------------------------------------------------------

if (require.main === module) {
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

  const recoveryMessages = crashRecovery();
  printStartupBlock(recoveryMessages);

  // Initial heartbeat write so the file exists immediately on startup.
  writeHeartbeat();

  // Start heartbeat interval.
  setInterval(writeHeartbeat, config.heartbeatIntervalMs);

  // Start poll interval + immediate first poll.
  setInterval(poll, config.pollIntervalMs);
  poll();
}

// ---------------------------------------------------------------------------
// Exports — for use by helper scripts (e.g. .bridge/next-id.js)
// ---------------------------------------------------------------------------

module.exports = { nextCommissionId, getQueueSnapshot };
