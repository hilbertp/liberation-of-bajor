'use strict';
const fs = require('fs');
const path = require('path');
const EVENTS_FILE = path.resolve(__dirname, 'kira-events.jsonl');

function appendKiraEvent(event) {
  const entry = Object.assign({ ts: new Date().toISOString(), processed: false }, event);
  try {
    fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    process.stderr.write('[kira-event-error] ' + err.message + '\n');
  }
}

module.exports = { appendKiraEvent };
