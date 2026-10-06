#!/usr/bin/env node
'use strict';
const { execSync } = require('child_process');

const files = [
  'src/lib/onlineValidation/P22ProductionMigrationPlanUtils.ts',
  'src/lib/onlineValidation/__tests__/p22production_migration_plan_utils.test.ts',
  'scripts/run-p22-preflight.js',
  'scripts/build-p22-production-backup-restore-plan.js',
  'scripts/build-p22-production-migration-runbook.js',
  'scripts/build-p22-production-monitoring-checklist.js',
  'scripts/decide-p22-production-migration-plan-readiness.js',
  'scripts/validate-p22-artifacts.js',
  'outputs/online_validation/p22production_migration_plan_preflight.json',
  'outputs/online_validation/p22production_migration_plan_preflight.md',
  'outputs/online_validation/p22production_backup_restore_plan.json',
  'outputs/online_validation/p22production_backup_restore_plan.md',
  'outputs/online_validation/p22production_migration_runbook.json',
  'outputs/online_validation/p22production_migration_runbook.md',
  'outputs/online_validation/p22production_monitoring_checklist.json',
  'outputs/online_validation/p22production_monitoring_checklist.md',
  'outputs/online_validation/p22production_migration_plan_decision.json',
  'outputs/online_validation/p22production_migration_plan_decision.md',
];

files.forEach(f => {
  execSync(`git add "${f}"`, { stdio: 'inherit' });
});

console.log(execSync('git status --short').toString());
