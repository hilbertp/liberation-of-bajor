'use strict';

const fs = require('fs');
const path = require('path');
const BRIDGE_DIR = __dirname;
const TIMESHEET_WATCHER = path.resolve(BRIDGE_DIR, 'timesheet-watcher.jsonl');
// Legacy export — now points to the merged output file (read-only)
const TIMESHEET_FILE = path.resolve(BRIDGE_DIR, 'timesheet.jsonl');

/**
 * appendTimesheet(entry)
 *
 * Appends a single JSON line to bridge/timesheet-watcher.jsonl.
 * Called at Write Point 1 (DONE) and Write Point 2 (terminal state update).
 * Will also be called by the future Ruflo runner.
 */
function appendTimesheet(entry) {
  try {
    fs.appendFileSync(TIMESHEET_WATCHER, JSON.stringify(entry) + '\n');
    rebuildMerged('timesheet');
  } catch (err) {
    // Timesheet write failure must not crash the watcher.
    process.stderr.write('[timesheet-write-error] ' + err.message + '\n');
  }
}

/**
 * updateTimesheet(commissionId, updates)
 *
 * Reads timesheet-watcher.jsonl, finds the watcher entry by commission_id,
 * merges updates, rewrites the file. Then rebuilds the merged view.
 * If the entry doesn't exist, creates a new one with updates and recovered: true.
 */
function updateTimesheet(commissionId, updates) {
  let lines = [];
  try {
    const raw = fs.readFileSync(TIMESHEET_WATCHER, 'utf-8').trim();
    if (raw) lines = raw.split('\n');
  } catch (_) {
    // File doesn't exist yet — will create with recovered entry.
  }

  let found = false;
  const updated = lines.map(line => {
    try {
      const entry = JSON.parse(line);
      if (entry.source === 'watcher' && entry.commission_id === String(commissionId)) {
        found = true;
        return JSON.stringify(Object.assign(entry, updates));
      }
    } catch (_) {}
    return line;
  });

  if (!found) {
    // Watcher restarted mid-flight — create recovered entry.
    const recovered = Object.assign({ commission_id: String(commissionId), source: 'watcher', role: 'obrien', recovered: true }, updates);
    updated.push(JSON.stringify(recovered));
  }

  try {
    fs.writeFileSync(TIMESHEET_WATCHER, updated.join('\n') + '\n');
    rebuildMerged('timesheet');
  } catch (err) {
    process.stderr.write('[timesheet-update-error] ' + err.message + '\n');
  }
}

/**
 * rebuildMerged(base)
 *
 * Reads all bridge/{base}-*.jsonl files, merges entries sorted by `ts`,
 * and writes the merged result to bridge/{base}.jsonl.
 *
 * The merged file is read-only output — never written to directly.
 */
function rebuildMerged(base) {
  const prefix = `${base}-`;
  const files = fs.readdirSync(BRIDGE_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.jsonl'))
    .map(f => path.join(BRIDGE_DIR, f));
  const allLines = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(file, 'utf-8').trim();
      if (raw) {
        for (const line of raw.split('\n')) {
          allLines.push(line);
        }
      }
    } catch (_) {
      // Skip unreadable files
    }
  }

  // Sort by ts field (ascending). Lines without parseable ts go to the end.
  allLines.sort((a, b) => {
    try {
      const tsA = JSON.parse(a).ts || '';
      const tsB = JSON.parse(b).ts || '';
      return tsA < tsB ? -1 : tsA > tsB ? 1 : 0;
    } catch (_) {
      return 0;
    }
  });

  const mergedPath = path.join(BRIDGE_DIR, `${base}.jsonl`);
  try {
    fs.writeFileSync(mergedPath, allLines.length ? allLines.join('\n') + '\n' : '');
  } catch (err) {
    process.stderr.write(`[rebuild-merged-error] ${base}: ${err.message}\n`);
  }
}

module.exports = { appendTimesheet, updateTimesheet, rebuildMerged, TIMESHEET_FILE };
