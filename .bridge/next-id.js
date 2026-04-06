'use strict';

// Prints the next available commission ID (zero-padded, three digits) to stdout.
// Usage: node .bridge/next-id.js

const path = require('path');
const { nextCommissionId } = require('./watcher.js');

const queueDir = path.resolve(__dirname, 'queue');
console.log(nextCommissionId(queueDir));
