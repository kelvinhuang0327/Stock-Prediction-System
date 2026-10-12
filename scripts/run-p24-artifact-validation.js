#!/usr/bin/env node
/**
 * P24-HARDRESET: Artifact Validation
 * Validates all P24 production migration execution artifacts.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT = 'outputs/online_validation';
const checks = [];

function check(id, description, fn) {
  try {
    fn();
    checks.push({ id, description, status: 'PASS' });
  } catch (e) {
    checks.push({ id, description, status: 'FAIL', error: e.message });
  }
}

// ── JSON parse checks ────────────────────────────────────────────────────────
const p24Files = [
  'p24production_migration_execution_preflight.json',
  'p24production_backup_gate.json',
  'p24production_migration_gate.json',
  'p24production_backfill_gate.json',
  'p24production_post_migration_validation.json',
  'p24production_rollback_readiness.json',
];

p24Files.forEach((f, i) => {
  check(`J${String(i + 1).padStart(2, '0')}`, `JSON valid: ${f}`, () => {
    const content = fs.readFileSync(path.join(OUT, f), 'utf8');
    JSON.parse(content);
  });
});

// ── Frozen corpus line counts ────────────────────────────────────────────────
const FROZEN = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'p19active_scoring_pit_replay_corpus.jsonl': 4500,
};

Object.entries(FROZEN).forEach(([file, expected], i) => {
  check(`J${String(7 + i).padStart(2, '0')}`, `Frozen line count: ${file} = ${expected}`, () => {
    const fp = path.join(OUT, file);
    const lines = fs.readFileSync(fp, 'utf8').trim().split('\n').length;
    if (lines !== expected) throw new Error(`Expected ${expected}, got ${lines}`);
  });
});

// ── P24 artifact structure checks ────────────────────────────────────────────
check('J12', 'preflight.tokenStatus present', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_execution_preflight.json`, 'utf8'));
  if (!j.tokenStatus) throw new Error('missing tokenStatus');
  if (!j.gatePassCount) throw new Error('missing gatePassCount');
  if (!j.classification) throw new Error('missing classification');
});

check('J13', 'preflight classification includes P23_PREFLIGHT_PASS or P24_PREFLIGHT', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_execution_preflight.json`, 'utf8'));
  if (!j.classification.includes('PASS') && !j.classification.includes('P24')) {
    throw new Error(`Unexpected classification: ${j.classification}`);
  }
});

check('J14', 'backup.backupStatus = PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
  if (!j.backupStatus) throw new Error('missing backupStatus');
  if (j.backupStatus !== 'PASS') throw new Error(`Expected PASS, got ${j.backupStatus}`);
});

check('J15', 'backup.backupPath present', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
  if (!j.backupPath) throw new Error('missing backupPath');
});

check('J16', 'backup.checksum present', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
  if (!j.checksum) throw new Error('missing checksum');
});

check('J17', 'backup.monthlyRevenueRowCountBefore is number', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
  if (typeof j.monthlyRevenueRowCountBefore !== 'number') throw new Error('missing or non-number monthlyRevenueRowCountBefore');
});

check('J18', 'migration.migrationStatus = PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
  if (!j.migrationStatus) throw new Error('missing migrationStatus');
  if (j.migrationStatus !== 'PASS') throw new Error(`Expected PASS, got ${j.migrationStatus}`);
});

check('J19', 'migration.productionMigrationApplied = true', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
  if (j.productionMigrationApplied !== true) throw new Error('productionMigrationApplied must be true after PASS');
});

check('J20', 'migration.executed = true', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
  if (j.executed !== true) throw new Error('executed must be true after PASS');
});

check('J21', 'migration.schemaAfter contains releaseDate', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
  if (!j.schemaAfter) throw new Error('missing schemaAfter');
  const schema = JSON.stringify(j.schemaAfter).toLowerCase();
  if (!schema.includes('releasedate')) throw new Error('schemaAfter missing releaseDate');
});

check('J22', 'backfill.backfillStatus = PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backfill_gate.json`, 'utf8'));
  if (!j.backfillStatus) throw new Error('missing backfillStatus');
  if (j.backfillStatus !== 'PASS') throw new Error(`Expected PASS, got ${j.backfillStatus}`);
});

check('J23', 'backfill.rowsBackfilled is number', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backfill_gate.json`, 'utf8'));
  if (typeof j.rowsBackfilled !== 'number') throw new Error('missing rowsBackfilled');
});

check('J24', 'backfill.releaseDateSourceDistribution has INFERRED_NEXT_MONTH_10TH', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_backfill_gate.json`, 'utf8'));
  if (!j.releaseDateSourceDistribution) throw new Error('missing releaseDateSourceDistribution');
  if (!j.releaseDateSourceDistribution.INFERRED_NEXT_MONTH_10TH) throw new Error('missing INFERRED_NEXT_MONTH_10TH key');
});

check('J25', 'validation.validationStatus = PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_post_migration_validation.json`, 'utf8'));
  if (!j.validationStatus) throw new Error('missing validationStatus');
  if (j.validationStatus !== 'PASS') throw new Error(`Expected PASS, got ${j.validationStatus}`);
});

check('J26', 'validation.checklistItems is array with ≥10 items', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_post_migration_validation.json`, 'utf8'));
  if (!Array.isArray(j.checklistItems)) throw new Error('checklistItems must be array');
  if (j.checklistItems.length < 10) throw new Error(`Expected ≥10 items, got ${j.checklistItems.length}`);
});

check('J27', 'rollback.rollbackReadinessStatus = PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_rollback_readiness.json`, 'utf8'));
  if (!j.rollbackReadinessStatus) throw new Error('missing rollbackReadinessStatus');
  if (j.rollbackReadinessStatus !== 'PASS') throw new Error(`Expected PASS, got ${j.rollbackReadinessStatus}`);
});

check('J28', 'rollback.backupFilePath present and rollback PASS', () => {
  const j = JSON.parse(fs.readFileSync(`${OUT}/p24production_rollback_readiness.json`, 'utf8'));
  if (!j.backupFilePath) throw new Error('backupFilePath must be present');
  if (j.rollbackReadinessStatus !== 'PASS') throw new Error(`Expected rollback PASS, got ${j.rollbackReadinessStatus}`);
});

check('J29', 'MD exists: p24production_migration_execution_preflight.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_migration_execution_preflight.md`)) throw new Error('file missing');
});
check('J30', 'MD exists: p24production_backup_gate.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_backup_gate.md`)) throw new Error('file missing');
});
check('J31', 'MD exists: p24production_migration_gate.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_migration_gate.md`)) throw new Error('file missing');
});
check('J32', 'MD exists: p24production_backfill_gate.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_backfill_gate.md`)) throw new Error('file missing');
});
check('J33', 'MD exists: p24production_post_migration_validation.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_post_migration_validation.md`)) throw new Error('file missing');
});
check('J34', 'MD exists: p24production_rollback_readiness.md', () => {
  if (!fs.existsSync(`${OUT}/p24production_rollback_readiness.md`)) throw new Error('file missing');
});

// ── Migration backup target consistency ──────────────────────────────────────
check('J35', 'backup and migration target the same DB file', () => {
  const backup = JSON.parse(fs.readFileSync(`${OUT}/p24production_backup_gate.json`, 'utf8'));
  const migration = JSON.parse(fs.readFileSync(`${OUT}/p24production_migration_gate.json`, 'utf8'));
  const backupTarget = backup.productionDbTarget || backup.dbFile || '';
  const migrationTarget = migration.productionDbTarget || migration.migrationTarget || migration.dbFile || '';
  if (!backupTarget || !migrationTarget) throw new Error(`Missing targets: backup=${backupTarget}, migration=${migrationTarget}`);
  if (backupTarget !== migrationTarget) throw new Error(`Targets differ: ${backupTarget} vs ${migrationTarget}`);
});

// ── Report ────────────────────────────────────────────────────────────────────
const passed = checks.filter(c => c.status === 'PASS').length;
const failed = checks.filter(c => c.status === 'FAIL').length;

console.log(`\nP24 Artifact Validation — ${passed}/${checks.length} checks PASS\n`);
checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : '❌';
  console.log(`  ${icon} ${c.id} ${c.description}${c.error ? `\n       ERROR: ${c.error}` : ''}`);
});

if (failed > 0) {
  console.error(`\n❌ ${failed} checks FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} checks PASS — P24 artifacts valid`);
}
