#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');
const BASE = require('path').resolve(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd: BASE, encoding: 'utf8' });
  if (out.trim()) console.log(out.trim());
}

const FILES = [
  'src/lib/onlineValidation/P23ProductionMigrationImplementationReviewUtils.ts',
  'src/lib/onlineValidation/__tests__/p23production_migration_implementation_review_utils.test.ts',
  'scripts/run-p23-preflight.js',
  'scripts/run-p23-production-migration-implementation-review.js',
  'scripts/build-p23-production-execution-approval-request.js',
  'scripts/decide-p23-production-implementation-readiness.js',
  'scripts/run-p23-artifact-validation.js',
  'outputs/online_validation/p23production_migration_implementation_preflight.json',
  'outputs/online_validation/p23production_migration_implementation_preflight.md',
  'outputs/online_validation/p23production_migration_implementation_review.json',
  'outputs/online_validation/p23production_migration_implementation_review.md',
  'outputs/online_validation/p23production_execution_approval_request.json',
  'outputs/online_validation/p23production_execution_approval_request.md',
  'outputs/online_validation/p23production_implementation_readiness_decision.json',
  'outputs/online_validation/p23production_implementation_readiness_decision.md',
];

for (const f of FILES) {
  run(`git add "${f}"`);
}

const MSG = `P23-HARDRESET: Production migration implementation review

- New: production migration implementation review utilities (P23ProductionMigrationImplementationReviewUtils.ts)
- New: 76 unit tests covering all 10 utility functions including forbidden claim scanner
- New: 27-gate preflight check (27/27 PASS)
- New: implementation package review (backup/restore/runbook/rollback/monitoring all COMPLETE)
- New: P24 execution approval request artifact
- New: implementation readiness decision (P23_READY_TO_REQUEST_PRODUCTION_EXECUTION_APPROVAL)
- New: artifact validation script (28/28 PASS)
- Frozen: P0/P1/P3/P19/simulation corpus unchanged (60/4500/9900/4500/4500 lines)
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- No production DB writes
- No automatic production approval granted
- approvalGranted: false always
- productionMigrationApplied: false always
- No ROI / alpha / edge / win-rate / profit / outperform / buy / sell / guaranteed claims
- Required P24 token: P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY (request only, not a grant)`;

run(`git commit -m ${JSON.stringify(MSG)}`);
run('git log --oneline -5');
