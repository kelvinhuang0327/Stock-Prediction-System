/**
 * P25-HARDRESET: Pre-flight Gate (Part A)
 *
 * Verifies all P24 artifacts, DB schema post-migration, and frozen corpus counts.
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * productionDbWritten = false | corpusModified = false
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT_DIR = 'outputs/online_validation';
const DB_FILE = 'prisma/dev.db';
const NOW = new Date().toISOString();

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
function fileExists(f) { try { fs.accessSync(f); return true; } catch { return false; } }
function sqlQuery(q) {
  try { return execSync(`sqlite3 "${DB_FILE}" "${q}"`, { encoding: 'utf8' }).trim(); }
  catch (e) { return `ERROR: ${e.message}`; }
}

const gates = [];
let gatePass = 0;
let gateFail = 0;

function check(id, description, pass, detail) {
  const status = pass ? 'PASS' : 'FAIL';
  if (pass) gatePass++; else gateFail++;
  gates.push({ id, description, status, detail: detail || '' });
  console.log(`[${status}] ${id}: ${description}${detail ? ' — ' + detail : ''}`);
}

console.log('P25-HARDRESET: Pre-flight Gate');
console.log('Generated:', NOW);
console.log('');

// ── A.1: P24 artifact existence ──────────────────────────────────────────

const P24_ARTIFACTS = [
  'p24production_migration_execution_final_report.md',
  'p24production_backup_gate.json',
  'p24production_migration_gate.json',
  'p24production_backfill_gate.json',
  'p24production_post_migration_validation.json',
  'p24production_rollback_readiness.json',
];

for (const artifact of P24_ARTIFACTS) {
  const fpath = path.join(OUT_DIR, artifact);
  check(`A1-${artifact.replace(/\W/g, '_').slice(0, 20)}`, `P24 artifact exists: ${artifact}`, fileExists(fpath), fpath);
}

// ── A.2: P24 gate conclusions ────────────────────────────────────────────

let backup, migration, backfill, postval, rollback;
try {
  backup = readJson(path.join(OUT_DIR, 'p24production_backup_gate.json'));
  migration = readJson(path.join(OUT_DIR, 'p24production_migration_gate.json'));
  backfill = readJson(path.join(OUT_DIR, 'p24production_backfill_gate.json'));
  postval = readJson(path.join(OUT_DIR, 'p24production_post_migration_validation.json'));
  rollback = readJson(path.join(OUT_DIR, 'p24production_rollback_readiness.json'));
} catch (e) {
  check('A2-LOAD', 'P24 artifacts parseable', false, e.message);
  process.exit(1);
}

check('A2-backup-status', 'P24 backup gate = PASS', backup.backupStatus === 'PASS', `backupStatus=${backup.backupStatus}`);
check('A2-migration-status', 'P24 migration gate = PASS', migration.migrationStatus === 'PASS', `migrationStatus=${migration.migrationStatus}`);
check('A2-migration-applied', 'P24 productionMigrationApplied = true', migration.productionMigrationApplied === true, `productionMigrationApplied=${migration.productionMigrationApplied}`);
check('A2-backfill-status', 'P24 backfill gate = PASS', backfill.backfillStatus === 'PASS', `backfillStatus=${backfill.backfillStatus}`);
check('A2-rows-backfilled', 'P24 rowsBackfilled >= 2143', backfill.rowsBackfilled >= 2143, `rowsBackfilled=${backfill.rowsBackfilled}`);
check('A2-rows-skipped', 'P24 rowsSkipped = 0', backfill.rowsSkipped === 0, `rowsSkipped=${backfill.rowsSkipped}`);
check('A2-postval-status', 'P24 post-migration validation = PASS', postval.validationStatus === 'PASS', `validationStatus=${postval.validationStatus}`);
check('A2-rollback-status', 'P24 rollback readiness = PASS', rollback.rollbackReadinessStatus === 'PASS', `rollbackReadinessStatus=${rollback.rollbackReadinessStatus}`);
check('A2-distribution', 'P24 distribution has INFERRED_NEXT_MONTH_10TH', backfill.releaseDateSourceDistribution && backfill.releaseDateSourceDistribution['INFERRED_NEXT_MONTH_10TH'] > 0, `dist=${JSON.stringify(backfill.releaseDateSourceDistribution)}`);

// ── A.3: DB schema checks ────────────────────────────────────────────────

const schemaRaw = sqlQuery('PRAGMA table_info(MonthlyRevenue)');
check('A3-schema-releaseDate', 'DB MonthlyRevenue has releaseDate column', schemaRaw.includes('releaseDate'), 'PRAGMA table_info');
check('A3-schema-releaseDateSource', 'DB MonthlyRevenue has releaseDateSource column', schemaRaw.includes('releaseDateSource'), 'PRAGMA table_info');
check('A3-schema-releaseDateConfidence', 'DB MonthlyRevenue has releaseDateConfidence column', schemaRaw.includes('releaseDateConfidence'), 'PRAGMA table_info');

const rowCountRaw = sqlQuery('SELECT COUNT(*) FROM MonthlyRevenue');
const rowCount = parseInt(rowCountRaw, 10);
check('A3-row-count', `MonthlyRevenue row count >= 2143`, rowCount >= 2143, `rowCount=${rowCount}`);

const nullRdCount = parseInt(sqlQuery('SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NULL'), 10);
check('A3-null-releaseDate', 'No rows with NULL releaseDate', nullRdCount === 0, `nullCount=${nullRdCount}`);

const invalidDistrib = sqlQuery("SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDateSource != 'INFERRED_NEXT_MONTH_10TH' AND releaseDateSource IS NOT NULL");
const unexpectedSourceCount = parseInt(invalidDistrib, 10);
check('A3-source-distribution', 'All non-null releaseDateSource = INFERRED_NEXT_MONTH_10TH', unexpectedSourceCount === 0, `unexpectedSourceRows=${unexpectedSourceCount}`);

// ── A.4: Frozen corpus counts ────────────────────────────────────────────

const FROZEN = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'p19active_scoring_pit_replay_corpus.jsonl': 4500,
};

for (const [fname, expected] of Object.entries(FROZEN)) {
  const fpath = path.join(OUT_DIR, fname);
  let actual = -1;
  try {
    actual = fs.readFileSync(fpath, 'utf8').trim().split('\n').length;
  } catch (e) {
    actual = -1;
  }
  check(`A4-${fname.replace(/\W/g,'_').slice(0,25)}`, `Frozen: ${fname} = ${expected} lines`, actual === expected, `actual=${actual}`);
}

// ── Output ───────────────────────────────────────────────────────────────

console.log('');
console.log(`Total gates: ${gatePass + gateFail} | PASS: ${gatePass} | FAIL: ${gateFail}`);

const classification = gateFail === 0
  ? 'P25_PREFLIGHT_PASS'
  : 'P25_POST_MIGRATION_BLOCKED_BY_ARTIFACTS';

const result = {
  phase: 'P25-HARDRESET',
  part: 'A',
  generatedAt: NOW,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  gatePassCount: gatePass,
  gateTotalCount: gatePass + gateFail,
  gateFailCount: gateFail,
  classification,
  gates,
  p24Summary: {
    backupStatus: backup.backupStatus,
    migrationStatus: migration.migrationStatus,
    productionMigrationApplied: migration.productionMigrationApplied,
    backfillStatus: backfill.backfillStatus,
    rowsBackfilled: backfill.rowsBackfilled,
    postMigrationValidationStatus: postval.validationStatus,
    rollbackReadinessStatus: rollback.rollbackReadinessStatus,
  },
  dbSchema: {
    releaseDateExists: schemaRaw.includes('releaseDate'),
    releaseDateSourceExists: schemaRaw.includes('releaseDateSource'),
    releaseDateConfidenceExists: schemaRaw.includes('releaseDateConfidence'),
    totalRows: rowCount,
    nullReleaseDateRows: nullRdCount,
  },
  frozenCorpora: Object.fromEntries(
    Object.entries(FROZEN).map(([f, exp]) => {
      let actual = -1;
      try { actual = fs.readFileSync(path.join(OUT_DIR, f), 'utf8').trim().split('\n').length; } catch {}
      return [f, { expected: exp, actual, ok: actual === exp }];
    })
  ),
  productionDbWritten: false,
  corpusModified: false,
  scoringFormulaModified: false,
};

const jsonPath = path.join(OUT_DIR, 'p25post_migration_observability_preflight.json');
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log('Written:', jsonPath);

const md = `# P25 Pre-flight Gate

**Phase:** P25-HARDRESET  
**Generated:** ${NOW}  
**Classification:** \`${classification}\`

## Gate Summary

| Metric | Value |
|--------|-------|
| Total gates | ${gatePass + gateFail} |
| PASS | ${gatePass} |
| FAIL | ${gateFail} |
| Classification | \`${classification}\` |

## Gates

${gates.map(g => `- [${g.status}] \`${g.id}\` — ${g.description}${g.detail ? ' (' + g.detail + ')' : ''}`).join('\n')}

## DB Schema (post-migration)

- releaseDate: ${schemaRaw.includes('releaseDate') ? '✅' : '❌'}
- releaseDateSource: ${schemaRaw.includes('releaseDateSource') ? '✅' : '❌'}
- releaseDateConfidence: ${schemaRaw.includes('releaseDateConfidence') ? '✅' : '❌'}
- Total rows: ${rowCount}
- NULL releaseDate rows: ${nullRdCount}

## Frozen Corpus Counts

${Object.entries(FROZEN).map(([f, exp]) => {
  let actual = -1;
  try { actual = fs.readFileSync(path.join(OUT_DIR, f), 'utf8').trim().split('\n').length; } catch {}
  return `- ${actual === exp ? '✅' : '❌'} \`${f}\` — expected ${exp}, actual ${actual}`;
}).join('\n')}

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
`;

const mdPath = path.join(OUT_DIR, 'p25post_migration_observability_preflight.md');
fs.writeFileSync(mdPath, md);
console.log('Written:', mdPath);

if (gateFail > 0) {
  console.error('\nPRE-FLIGHT FAILED — P25 execution blocked.');
  process.exit(1);
}
console.log('\nPRE-FLIGHT PASS — P25 execution authorized.');
