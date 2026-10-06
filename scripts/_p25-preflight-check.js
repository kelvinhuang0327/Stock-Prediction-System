#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const base = 'outputs/online_validation';

// Check P24 artifacts
const backup = JSON.parse(fs.readFileSync(path.join(base, 'p24production_backup_gate.json'), 'utf8'));
const migration = JSON.parse(fs.readFileSync(path.join(base, 'p24production_migration_gate.json'), 'utf8'));
const backfill = JSON.parse(fs.readFileSync(path.join(base, 'p24production_backfill_gate.json'), 'utf8'));
const postval = JSON.parse(fs.readFileSync(path.join(base, 'p24production_post_migration_validation.json'), 'utf8'));
const rollback = JSON.parse(fs.readFileSync(path.join(base, 'p24production_rollback_readiness.json'), 'utf8'));

console.log('=== P24 Artifact Check ===');
console.log('backup:', backup.backupStatus, '| rows:', backup.monthlyRevenueRowCountBefore);
console.log('migration:', migration.migrationStatus, '| applied:', migration.productionMigrationApplied);
console.log('releaseDate:', migration.releaseDateExists);
console.log('releaseDateSource:', migration.releaseDateSourceExists);
console.log('releaseDateConfidence:', migration.releaseDateConfidenceExists);
console.log('backfill:', backfill.backfillStatus, '| rowsBackfilled:', backfill.rowsBackfilled, '| skipped:', backfill.rowsSkipped);
console.log('distribution:', JSON.stringify(backfill.releaseDateSourceDistribution));
console.log('postval:', postval.validationStatus, '| checklist:', postval.checklistItems ? postval.checklistItems.length : '?');
console.log('rollback:', rollback.rollbackReadinessStatus);

// Check DB schema via pragma
const { execSync } = require('child_process');
console.log('\n=== DB Schema Check ===');
try {
  const schema = execSync("sqlite3 prisma/dev.db 'PRAGMA table_info(MonthlyRevenue)'", { encoding: 'utf8' });
  console.log(schema);
  const hasReleaseDate = schema.includes('releaseDate');
  const hasSource = schema.includes('releaseDateSource');
  const hasConfidence = schema.includes('releaseDateConfidence');
  console.log('releaseDate column exists:', hasReleaseDate);
  console.log('releaseDateSource column exists:', hasSource);
  console.log('releaseDateConfidence column exists:', hasConfidence);
} catch (e) {
  console.log('DB schema check error:', e.message);
}

// Frozen corpus check
console.log('\n=== Frozen Corpus Counts ===');
const frozen = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl': 4500,
};
let allFrozen = true;
for (const [fpath, expected] of Object.entries(frozen)) {
  const content = fs.readFileSync(fpath, 'utf8').trim();
  const actual = content.split('\n').length;
  const ok = actual === expected;
  if (!ok) allFrozen = false;
  console.log(ok ? 'OK' : 'FAIL', fpath, actual, '/', expected);
}
console.log('allFrozen:', allFrozen);
