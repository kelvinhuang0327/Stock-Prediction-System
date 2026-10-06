#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');

const scripts = [
  'scripts/run-p23-production-migration-implementation-review.js',
  'scripts/build-p23-production-execution-approval-request.js',
  'scripts/decide-p23-production-implementation-readiness.js',
];

for (const s of scripts) {
  console.log(`\n--- Running: ${s} ---`);
  execSync(`node ${s}`, { stdio: 'inherit' });
}
console.log('\nAll P23 Part C/D/E scripts complete.');
