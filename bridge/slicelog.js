'use strict';

const fs = require('fs');
const path = require('path');

const TIMESHEET_FILE = path.resolve(__dirname, 'timesheet.jsonl');

/**
 * appendTimesheet(entry)
 *
 * Appends a single JSON line to bridge/timesheet.jsonl.
 * Called at Write Point 1 (DONE) and Write Point 2 (terminal state update).
 * Will also be called by the future Ruflo runner.
 */
function appendTimesheet(entry) {
  try {
    fs.appendFileSync(TIMESHEET_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    // Timesheet write failure must not crash the watcher.
    process.stderr.write('[timesheet-write-error] ' + err.message + '\n');
  }
}

/**
 * updateTimesheet(commissionId, updates)
 *
 * Reads timesheet.jsonl, finds the watcher entry by commission_id, merges updates, rewrites the file.
 * If the entry doesn't exist, creates a new one with updates and recovered: true.
 */
function updateTimesheet(commissionId, updates) {
  let lines = [];
  try {
    const raw = fs.readFileSync(TIMESHEET_FILE, 'utf-8').trim();
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
    fs.writeFileSync(TIMESHEET_FILE, updated.join('\n') + '\n');
  } catch (err) {
    process.stderr.write('[timesheet-update-error] ' + err.message + '\n');
  }
}

module.exports = { appendTimesheet, updateTimesheet, TIMESHEET_FILE };
