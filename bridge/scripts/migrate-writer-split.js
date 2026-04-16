#!/usr/bin/env node
/**
 * migrate-writer-split.js
 *
 * One-shot migration: splits existing monolithic JSONL files into per-role
 * files so multiple writers never race on the same file.
 *
 * Existing entries are attributed to "watcher" (safe assumption — all
 * historical writes came through watcher.js or usage-snapshot.js).
 *
 * Idempotent: if the per-role file already exists with content, skips that file.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BRIDGE_DIR = path.resolve(__dirname, '..');

const FILES_TO_SPLIT = ['timesheet', 'anchors', 'tt-audit'];

let totalMigrated = 0;

for (const base of FILES_TO_SPLIT) {
  const srcPath = path.join(BRIDGE_DIR, `${base}.jsonl`);
  const dstPath = path.join(BRIDGE_DIR, `${base}-watcher.jsonl`);

  // Idempotency: skip if destination already has content
  if (fs.existsSync(dstPath)) {
    try {
      const existing = fs.readFileSync(dstPath, 'utf-8').trim();
      if (existing.length > 0) {
        console.log(`[skip] ${base}-watcher.jsonl already has content (${existing.split('\n').length} lines) — skipping`);
        continue;
      }
    } catch (_) {
      // Empty or unreadable — proceed with migration
    }
  }

  // Read source
  let lines = [];
  try {
    const raw = fs.readFileSync(srcPath, 'utf-8').trim();
    if (raw) lines = raw.split('\n');
  } catch (_) {
    console.log(`[skip] ${base}.jsonl does not exist or is empty — nothing to migrate`);
    continue;
  }

  if (lines.length === 0) {
    console.log(`[skip] ${base}.jsonl is empty — creating empty watcher file`);
    fs.writeFileSync(dstPath, '');
    continue;
  }

  // Write all existing entries to the watcher file
  fs.writeFileSync(dstPath, lines.join('\n') + '\n');
  console.log(`[done] ${base}.jsonl → ${base}-watcher.jsonl (${lines.length} lines)`);
  totalMigrated += lines.length;
}

console.log(`\nMigration complete. ${totalMigrated} lines migrated across ${FILES_TO_SPLIT.length} files.`);
console.log('Original files are preserved (not deleted). They become rebuilt output targets.');
