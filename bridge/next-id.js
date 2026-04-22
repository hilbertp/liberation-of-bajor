'use strict';

// Prints the next available slice ID (zero-padded, three digits) to stdout.
// Usage: node bridge/next-id.js

const path = require('path');
const { nextSliceId } = require('./orchestrator.js');

const queueDir = path.resolve(__dirname, 'queue');
console.log(nextSliceId(queueDir));
