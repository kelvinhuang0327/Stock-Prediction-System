#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'outputs/online_validation');

let allPass = true;

function check(label, cond, detail) {
  if (!cond) {
    console.log(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    allPass = false;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// 1. Parse all P23 JSON artifacts
const p23JsonFiles = [
  'p23production_migration_implementation_preflight.json',
  'p23production_migration_implementation_review.json',
  'p23production_execution_approval_request.json',
  'p23production_implementation_readiness_decision.json',
];
const artifacts = {};
for (const f of p23JsonFiles) {
  try {
    artifacts[f] = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
    check(`JSON valid: ${f}`, true);
  } catch (e) {
    check(`JSON valid: ${f}`, false, e.message);
  }
}

// 2. Frozen corpus line counts
const FROZEN = [
  { file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
  { file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
  { file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
  { file: 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', expected: 4500 },
];
for (const { file, expected } of FROZEN) {
  const fullPath = path.join(BASE, file);
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0).length;
    check(`Frozen corpus lines: ${path.basename(file)} = ${lines}`, lines === expected, `expected ${expected}, got ${lines}`);
  } catch (e) {
    check(`Frozen corpus readable: ${path.basename(file)}`, false, e.message);
  }
}

// 3. Structure checks on key artifacts
const review = artifacts['p23production_migration_implementation_review.json'] || {};
const request = artifacts['p23production_execution_approval_request.json'] || {};
const decision = artifacts['p23production_implementation_readiness_decision.json'] || {};
const preflight = artifacts['p23production_migration_implementation_preflight.json'] || {};

check('review.implementationPackageStatus exists', typeof review.implementationPackageStatus === 'string');
check('review.implementationPackageStatus = IMPLEMENTATION_PACKAGE_COMPLETE',
  review.implementationPackageStatus === 'IMPLEMENTATION_PACKAGE_COMPLETE');
check('review.approvalGranted = false', review.approvalGranted === false);
check('review.productionMigrationApplied = false', review.productionMigrationApplied === false);

check('request.requestedToken = P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY',
  request.requestedToken === 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY');
check('request.approvalGranted = false', request.approvalGranted === false);
check('request.productionMigrationApplied = false', request.productionMigrationApplied === false);
check('request.approvalAutoGranted = false', request.approvalAutoGranted === false);

check('decision.classification = P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL',
  decision.classification === 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL');
check('decision.readyToRequestExecutionApproval = true', decision.readyToRequestExecutionApproval === true);
check('decision.approvalGranted !== true', decision.approvalGranted !== true);
check('decision.productionMigrationApplied !== true', decision.productionMigrationApplied !== true);

check('preflight.gatePassCount = 27', preflight.gatePassCount === 27);
check('preflight.gateTotal = 27', preflight.gateTotal === 27);
check('preflight.classification includes P23_PREFLIGHT_PASS',
  (preflight.classification || '').includes('P23_PREFLIGHT_PASS'));

// 4. MD artifacts exist
const p23MdFiles = [
  'p23production_migration_implementation_preflight.md',
  'p23production_migration_implementation_review.md',
  'p23production_execution_approval_request.md',
  'p23production_implementation_readiness_decision.md',
];
for (const f of p23MdFiles) {
  const fullPath = path.join(OUT, f);
  check(`MD exists: ${f}`, fs.existsSync(fullPath));
}

console.log('');
console.log(allPass ? '=== Part H: ALL CHECKS PASS ✅ ===' : '=== Part H: SOME CHECKS FAILED ❌ ===');
process.exit(allPass ? 0 : 1);
