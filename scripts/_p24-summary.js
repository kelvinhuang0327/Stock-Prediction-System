#!/usr/bin/env node
'use strict';
const fs = require('fs');
const OUT = 'outputs/online_validation';
const preflight = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_execution_preflight.json`, 'utf8'));
const backup = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
const migration = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
const backfill = JSON.parse(fs.readFileSync(`${OUT}/p24production_backfill_gate.json`, 'utf8'));
const val = JSON.parse(fs.readFileSync(`${OUT}/p24production_post_migration_validation.json`, 'utf8'));
const rb = JSON.parse(fs.readFileSync(`${OUT}/p24production_rollback_readiness.json`, 'utf8'));

console.log(JSON.stringify({
  preflight_gates: `${preflight.gatePassCount}/${preflight.gateTotal}`,
  preflight_classification: preflight.classification,
  backupStatus: backup.backupStatus,
  backupPath: backup.backupPath,
  checksum_prefix: backup.checksum ? backup.checksum.substring(0, 16) + '...' : 'N/A',
  rowCountBefore: backup.monthlyRevenueRowCountBefore,
  migrationStatus: migration.migrationStatus,
  productionMigrationApplied: migration.productionMigrationApplied,
  releaseDateExists: migration.releaseDateExists,
  releaseDateSourceExists: migration.releaseDateSourceExists,
  releaseDateConfidenceExists: migration.releaseDateConfidenceExists,
  backfillStatus: backfill.backfillStatus,
  rowsScanned: backfill.rowsScanned,
  rowsBackfilled: backfill.rowsBackfilled,
  rowsSkipped: backfill.rowsSkipped,
  dist: backfill.releaseDateSourceDistribution,
  validationStatus: val.validationStatus,
  checklistCount: val.checklistItems ? val.checklistItems.length : 'N/A',
  mandatoryPass: val.mandatoryPass,
  mandatoryTotal: val.mandatoryTotal,
  queryGateSmoke: val.queryGateSmoke,
  noLeakagePass: val.noLeakagePass,
  corpusFrozen: val.corpusFrozen,
  rollbackReadinessStatus: rb.rollbackReadinessStatus,
  rollbackTriggerCount: rb.rollbackTriggerCount,
  restoreStepCount: rb.restoreStepCount,
}, null, 2));
