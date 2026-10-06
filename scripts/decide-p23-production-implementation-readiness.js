#!/usr/bin/env node
'use strict';
/**
 * decide-p23-production-implementation-readiness.js
 *
 * P23 Part E — Build Implementation Risk / Go-No-Go Decision.
 *
 * Reads:
 *  - p23production_migration_implementation_review.json
 *  - p23production_execution_approval_request.json
 *  - p22production_migration_plan_decision.json
 *
 * Produces:
 *  - outputs/online_validation/p23production_implementation_readiness_decision.json
 *  - outputs/online_validation/p23production_implementation_readiness_decision.md
 *
 * Hard rules:
 *  - approvalGranted = false always
 *  - productionMigrationApplied = false always
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const OUT = path.join(BASE, 'outputs', 'online_validation');
const now = new Date().toISOString();

function readJson(rel) {
  const full = path.join(BASE, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing required artifact: ${rel}`);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const review = readJson('outputs/online_validation/p23production_migration_implementation_review.json');
const approvalReq = readJson('outputs/online_validation/p23production_execution_approval_request.json');
const p22Decision = readJson('outputs/online_validation/p22production_migration_plan_decision.json');

// ---------------------------------------------------------------------------
// Evaluate each dimension
// ---------------------------------------------------------------------------
const backupRestoreComplete = review.backupRestoreStatus === 'COMPLETE';
const runbookComplete = review.migrationRunbookStatus === 'COMPLETE';
const rollbackComplete = review.rollbackStatus === 'COMPLETE';
const monitoringComplete = review.monitoringStatus === 'COMPLETE';
const allCommandsPlaceholder = review.productionCommandSafety === 'ALL_COMMANDS_PLACEHOLDER';
const p22ReadyForP23 = p22Decision.readyForP23Review === true;
const p22ClassificationOk = p22Decision.classification === 'P22_PLAN_HARDENING_COMPLETE_READY_FOR_P23_REVIEW';
const approvalRequestTokenOk =
  approvalReq.requestedToken === 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY';
const approvalNotAutoGranted = approvalReq.approvalGranted !== true;

const evaluations = {
  backupRestoreComplete: backupRestoreComplete ? 'PASS' : 'FAIL',
  runbookComplete: runbookComplete ? 'PASS' : 'FAIL',
  rollbackComplete: rollbackComplete ? 'PASS' : 'FAIL',
  monitoringComplete: monitoringComplete ? 'PASS' : 'FAIL',
  allCommandsPlaceholder: allCommandsPlaceholder ? 'PASS' : 'FAIL',
  p22ReadyForP23: p22ReadyForP23 ? 'PASS' : 'FAIL',
  p22ClassificationOk: p22ClassificationOk ? 'PASS' : 'FAIL',
  approvalRequestTokenOk: approvalRequestTokenOk ? 'PASS' : 'FAIL',
  approvalNotAutoGranted: approvalNotAutoGranted ? 'PASS' : 'FAIL',
  approvalGuard: 'PASS', // approvalGranted=false — always PASS in P23
  migrationGuard: 'PASS', // productionMigrationApplied=false — always PASS in P23
};

// ---------------------------------------------------------------------------
// Determine blockers and classification
// ---------------------------------------------------------------------------
const blockers = [];
if (!backupRestoreComplete) blockers.push('backup/restore plan incomplete — gaps: ' + (review.backupRestoreGaps || []).join(', '));
if (!runbookComplete) blockers.push('migration runbook incomplete — gaps: ' + (review.migrationRunbookGaps || []).join(', '));
if (!rollbackComplete) blockers.push('rollback package incomplete — gaps: ' + (review.rollbackGaps || []).join(', '));
if (!monitoringComplete) blockers.push('monitoring checklist incomplete — gaps: ' + (review.monitoringGaps || []).join(', '));
if (!allCommandsPlaceholder) blockers.push('non-placeholder production commands detected');
if (!p22ReadyForP23 || !p22ClassificationOk) blockers.push('P22 artifacts do not confirm P23 authorization');

let classification;
if (!p22ReadyForP23 || !p22ClassificationOk) {
  classification = 'P23_IMPLEMENTATION_REVIEW_BLOCKED_BY_ARTIFACTS';
} else if (!backupRestoreComplete) {
  classification = 'P23_REQUIRES_BACKUP_RESTORE_HARDENING';
} else if (!rollbackComplete) {
  classification = 'P23_REQUIRES_ROLLBACK_HARDENING';
} else if (!monitoringComplete) {
  classification = 'P23_REQUIRES_MONITORING_HARDENING';
} else if (!runbookComplete) {
  classification = 'P23_REQUIRES_RUNBOOK_HARDENING';
} else if (!allCommandsPlaceholder) {
  classification = 'P23_IMPLEMENTATION_REVIEW_REJECTED';
} else {
  classification = 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL';
}

const readyToRequestExecutionApproval =
  classification === 'P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL';

// ---------------------------------------------------------------------------
// Build JSON artifact
// ---------------------------------------------------------------------------
const decision = {
  phase: 'P23',
  part: 'E',
  generatedAt: now,
  classification,
  readyToRequestExecutionApproval,
  approvalGranted: false,
  productionMigrationApplied: false,
  recommendedExecutionToken: 'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY',
  evaluations,
  blockers,
  whyNotApproved:
    'P23 reviews implementation readiness only. ' +
    'Production execution approval requires an explicit P24 execution token: ' +
    'P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY. ' +
    'That token has not been provided. CTO/CEO must grant it in P24.',
  nextPhaseRecommendation: readyToRequestExecutionApproval
    ? 'Proceed to P24 — request CTO/CEO to provide P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY'
    : 'Resolve blockers before requesting P24 execution approval',
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'p23production_implementation_readiness_decision.json'),
  JSON.stringify(decision, null, 2)
);

// ---------------------------------------------------------------------------
// Build MD artifact
// ---------------------------------------------------------------------------
const passCount = Object.values(evaluations).filter(v => v === 'PASS').length;
const failCount = Object.values(evaluations).filter(v => v === 'FAIL').length;
const totalEvals = Object.keys(evaluations).length;

const md = [
  '# P23 Production Implementation Readiness Decision',
  '',
  `**Generated**: ${now}`,
  `**Phase**: P23 / Part E`,
  `**Classification**: \`${classification}\``,
  `**Ready to Request Execution Approval**: ${readyToRequestExecutionApproval ? '✅ YES' : '❌ NO'}`,
  '',
  '## Safety Invariants',
  '- `approvalGranted`: false',
  '- `productionMigrationApplied`: false',
  `- Recommended P24 token: \`P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY\``,
  '',
  `## Evaluation Results: ${passCount}/${totalEvals} PASS`,
  '',
  '| Evaluation | Result |',
  '|------------|--------|',
  ...Object.entries(evaluations).map(([k, v]) =>
    `| ${k} | ${v === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`
  ),
  '',
  ...(blockers.length > 0
    ? [
        '## Blockers',
        ...blockers.map(b => `- ❌ ${b}`),
        '',
      ]
    : ['## Blockers', '- None ✅', '']),
  '## Why Migration Not Applied',
  decision.whyNotApproved,
  '',
  '## Next Phase Recommendation',
  decision.nextPhaseRecommendation,
].join('\n');

fs.writeFileSync(
  path.join(OUT, 'p23production_implementation_readiness_decision.md'),
  md
);

// Summary
const passEvals = Object.entries(evaluations).filter(([, v]) => v === 'PASS').map(([k]) => k);
const failEvals = Object.entries(evaluations).filter(([, v]) => v === 'FAIL').map(([k]) => k);
console.log('\n=== P23 Part E: Implementation Readiness Decision ===');
passEvals.forEach(k => console.log(`  PASS: ${k}`));
failEvals.forEach(k => console.log(`  FAIL: ${k}`));
console.log(`Classification: ${classification}`);
console.log(`readyToRequestExecutionApproval: ${readyToRequestExecutionApproval}`);
console.log(`approvalGranted: false`);
console.log(`productionMigrationApplied: false`);
console.log('Artifacts written.');
