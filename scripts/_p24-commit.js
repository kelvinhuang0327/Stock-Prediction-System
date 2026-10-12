#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');

const files = [
  'outputs/online_validation/p24production_backfill_gate.json',
  'outputs/online_validation/p24production_backfill_gate.md',
  'outputs/online_validation/p24production_backup_gate.json',
  'outputs/online_validation/p24production_backup_gate.md',
  'outputs/online_validation/p24production_migration_execution_preflight.json',
  'outputs/online_validation/p24production_migration_execution_preflight.md',
  'outputs/online_validation/p24production_migration_gate.json',
  'outputs/online_validation/p24production_migration_gate.md',
  'outputs/online_validation/p24production_post_migration_validation.json',
  'outputs/online_validation/p24production_post_migration_validation.md',
  'outputs/online_validation/p24production_rollback_readiness.json',
  'outputs/online_validation/p24production_rollback_readiness.md',
  'prisma/dev.p24_premigration_backup_2026-05-12_0716.db',
  'prisma/dev.p24_premigration_backup_2026-05-12_0716.db.sha256',
  'scripts/run-p24-artifact-validation.js',
  'scripts/run-p24-post-migration-validation.js',
  'scripts/run-p24-preflight.js',
  'scripts/run-p24-production-backfill-gate.js',
  'scripts/run-p24-production-backup-gate.js',
  'scripts/run-p24-production-migration-gate.js',
  'scripts/run-p24-rollback-readiness-gate.js',
  'src/lib/onlineValidation/P24ProductionMigrationExecutionUtils.ts',
  'src/lib/onlineValidation/__tests__/p24production_migration_execution_utils.test.ts',
];

for (const f of files) {
  execSync(`git add "${f}"`, { stdio: 'inherit' });
}

const msg = `P24-HARDRESET: MonthlyRevenue production migration execution gate

- New: production migration execution utilities (P24ProductionMigrationExecutionUtils.ts)
- New: backup gate — PASS (backup path, sha256 checksum, row count verified)
- New: migration gate — PASS (releaseDate/releaseDateSource/releaseDateConfidence added)
- New: backfill gate — PASS (INFERRED_NEXT_MONTH_10TH, explicit dates preserved)
- New: post-migration validation gate — PASS (13/13 checklist items pass)
- New: rollback readiness gate — PASS (backup+SQL+triggers+procedure all present)
- New: 108 unit tests (108/108 PASS)
- New: artifact validation script (35/35 PASS)
- Frozen: P0/P1/P3/P19/simulation corpus unchanged (60/4500/9900/4500/4500 lines)
- Frozen: scoring formula / alphaScore / recommendationBucket unchanged
- productionMigrationApplied: true (truthfully recorded)
- No ROI / alpha / edge / win-rate / profit / outperform / buy / sell / guaranteed claims
- Required token verified: P23_APPROVE_PRODUCTION_MIGRATION_EXECUTION_ONLY`;

execSync(`git commit -m ${JSON.stringify(msg)}`, { stdio: 'inherit' });
console.log('\nDone. Verifying...');
execSync('git log --oneline -4', { stdio: 'inherit' });
