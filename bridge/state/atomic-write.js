'use strict';

const fs = require('fs');

/**
 * writeJsonAtomic(filePath, content)
 *
 * Writes JSON to `filePath` atomically via temp+rename.
 * Pretty-prints with 2-space indent for human readability.
 * On failure, the destination file is left untouched.
 */
function writeJsonAtomic(filePath, content) {
  const tmp = filePath + '.tmp';
  const json = JSON.stringify(content, null, 2) + '\n';
  try {
    fs.writeFileSync(tmp, json, 'utf-8');
    fs.renameSync(tmp, filePath);
  } catch (err) {
    // Clean up temp file if it was written but rename failed
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
    throw err;
  }
}

module.exports = { writeJsonAtomic };
