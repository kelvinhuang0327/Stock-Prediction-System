/**
 * P25-HARDRESET: Post-Migration Contract Validation (Part F)
 *
 * Validates all P25 artifacts against the expected post-migration contract.
 * Cross-checks P12 PIT requirement, P17 query gate, P24 migration, P25 results.
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
const NOW = new Date().toISOString();
const DB_FILE = 'prisma/dev.db';

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
function fileExists(f) { try { fs.accessSync(f); return true; } catch { return false; } }
function sqlInt(q) {
  try { return parseInt(execSync(`sqlite3 "${DB_FILE}" "${q}"`, { encoding: 'utf8' }).trim(), 10) || 0; }
  catch { return -1; }
}

const checks = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

function check(id, description, status, detail) {
  const s = status === true ? 'PASS' : status === false ? 'FAIL' : 'WARN';
  if (status === true) passCount++;
  else if (status === false) failCount++;
  else warnCount++;
  checks.push({ id, description, status: s, detail: detail || '' });
  console.log(`[${s}] ${id}: ${description}${detail ? ' — ' + detail : ''}`);
}

console.log('P25-HARDRESET: Post-Migration Contract Validation');
console.log('Generated:', NOW);
console.log('');

// ── Load artifacts ────────────────────────────────────────────────────────

let p12Contract, p17Info, p24Migration, p24Backfill, p25Preflight, p25Dist, p25Gate, p25Smoke;

// P12 PIT feature contract
try {
  p12Contract = readJson(path.join(OUT_DIR, 'p12pit_feature_contract_v0.json'));
  check('F01', 'P12 PIT feature contract parseable', true, 'p12pit_feature_contract_v0.json');
} catch {
  p12Contract = null;
  check('F01', 'P12 PIT feature contract parseable', null, 'Not found — warn only');
}

// P17 (MonthlyRevenueAvailability check via DB)
const p17QueryPatchApplied = sqlInt("SELECT COUNT(*) FROM MonthlyRevenue WHERE DATE(releaseDate) <= DATE('2026-05-12')") > 0;
check('F02', 'P17 query gate patch: releaseDate <= asOfDate queries work', p17QueryPatchApplied, `gated rows available: ${p17QueryPatchApplied}`);

// P24 migration result
try {
  p24Migration = readJson(path.join(OUT_DIR, 'p24production_migration_gate.json'));
  p24Backfill = readJson(path.join(OUT_DIR, 'p24production_backfill_gate.json'));
  check('F03', 'P24 migration gate = PASS', p24Migration.migrationStatus === 'PASS', `migrationStatus=${p24Migration.migrationStatus}`);
  check('F04', 'P24 productionMigrationApplied = true', p24Migration.productionMigrationApplied === true, `productionMigrationApplied=${p24Migration.productionMigrationApplied}`);
  check('F05', 'P24 backfill gate = PASS', p24Backfill.backfillStatus === 'PASS', `backfillStatus=${p24Backfill.backfillStatus}`);
  check('F06', 'P24 rowsBackfilled = 2143', p24Backfill.rowsBackfilled === 2143, `rowsBackfilled=${p24Backfill.rowsBackfilled}`);
  check('F07', 'P24 releaseDateSource = INFERRED_NEXT_MONTH_10TH', p24Backfill.releaseDateSourceDistribution?.['INFERRED_NEXT_MONTH_10TH'] > 0, JSON.stringify(p24Backfill.releaseDateSourceDistribution));
} catch (e) {
  check('F03', 'P24 artifacts parseable', false, e.message);
}

// P25 preflight
try {
  p25Preflight = readJson(path.join(OUT_DIR, 'p25post_migration_observability_preflight.json'));
  check('F08', 'P25 preflight classification = P25_PREFLIGHT_PASS', p25Preflight.classification === 'P25_PREFLIGHT_PASS', `classification=${p25Preflight.classification}`);
  check('F09', 'P25 preflight all gates pass', p25Preflight.gateFailCount === 0, `failCount=${p25Preflight.gateFailCount}`);
} catch (e) {
  check('F08', 'P25 preflight artifact parseable', false, e.message);
}

// P25 distribution audit
try {
  p25Dist = readJson(path.join(OUT_DIR, 'p25monthly_revenue_distribution_audit.json'));
  check('F10', 'P25 distribution audit = PASS', p25Dist.validationStatus === 'PASS', `validationStatus=${p25Dist.validationStatus}`);
  check('F11', 'P25 totalRows >= 2143', p25Dist.totalRows >= 2143, `totalRows=${p25Dist.totalRows}`);
  check('F12', 'P25 rowsWithReleaseDate >= 2143', p25Dist.rowsWithReleaseDate >= 2143, `rowsWithReleaseDate=${p25Dist.rowsWithReleaseDate}`);
  check('F13', 'P25 invalidReleaseDateCount = 0', p25Dist.invalidReleaseDateCount === 0, `invalidCount=${p25Dist.invalidReleaseDateCount}`);
  check('F14', 'P25 INFERRED_NEXT_MONTH_10TH in distribution', p25Dist.releaseDateSourceDistribution?.['INFERRED_NEXT_MONTH_10TH'] > 0, JSON.stringify(p25Dist.releaseDateSourceDistribution));
  check('F15', 'P25 distribution: productionDbWritten = false', p25Dist.productionDbWritten === false, String(p25Dist.productionDbWritten));
} catch (e) {
  check('F10', 'P25 distribution audit artifact parseable', false, e.message);
}

// P25 query gate smoke
try {
  p25Gate = readJson(path.join(OUT_DIR, 'p25monthly_revenue_query_gate_smoke.json'));
  check('F16', 'P25 query gate smoke = PASS', p25Gate.validationStatus === 'PASS', `validationStatus=${p25Gate.validationStatus}`);
  check('F17', 'P25 query gate 0 failures', p25Gate.failCount === 0, `failCount=${p25Gate.failCount}`);
  check('F18', 'P25 DB gate: 0 Feb rows before 2026-03-10', p25Gate.dbGateCheck?.feb2026Before20260309 === 0, `count=${p25Gate.dbGateCheck?.feb2026Before20260309}`);
  check('F19', 'P25 DB gate: 1070 Feb rows on 2026-03-10', p25Gate.dbGateCheck?.feb2026On20260310 === 1070, `count=${p25Gate.dbGateCheck?.feb2026On20260310}`);
  check('F20', 'P25 query gate: productionDbWritten = false', p25Gate.productionDbWritten === false, String(p25Gate.productionDbWritten));
} catch (e) {
  check('F16', 'P25 query gate smoke artifact parseable', false, e.message);
}

// P25 active scoring smoke
try {
  p25Smoke = readJson(path.join(OUT_DIR, 'p25active_scoring_smoke_after_migration.json'));
  const smokeAcceptable = p25Smoke.smokeStatus === 'PASS' || p25Smoke.smokeStatus === 'PARTIAL';
  check('F21', 'P25 active scoring smoke PASS or PARTIAL', smokeAcceptable, `smokeStatus=${p25Smoke.smokeStatus}`);
  check('F22', 'P25 smoke: no FAIL entries with forbidden fields', p25Smoke.entries?.every(e => e.forbiddenFieldsPresent?.length === 0) !== false, `totalEntries=${p25Smoke.totalEntries}`);
  check('F23', 'P25 smoke: productionDbWritten = false', p25Smoke.productionDbWritten === false, String(p25Smoke.productionDbWritten));
  check('F24', 'P25 smoke: corpusModified = false', p25Smoke.corpusModified === false, String(p25Smoke.corpusModified));

  // Check no forbidden fields in any entry
  const hasForbiddenFields = p25Smoke.entries?.some(e => e.forbiddenFieldsPresent?.length > 0) ?? false;
  check('F25', 'P25 smoke: no snapshot contains forbidden fields', !hasForbiddenFields, hasForbiddenFields ? 'FORBIDDEN FIELDS DETECTED' : 'clean');
} catch (e) {
  check('F21', 'P25 active scoring smoke artifact parseable', false, e.message);
}

// Frozen corpora
const FROZEN = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'p19active_scoring_pit_replay_corpus.jsonl': 4500,
};
for (const [fname, expected] of Object.entries(FROZEN)) {
  let actual = -1;
  try { actual = fs.readFileSync(path.join(OUT_DIR, fname), 'utf8').trim().split('\n').length; } catch {}
  check(`F-FROZEN-${fname.split('.')[0].slice(-10)}`, `Frozen corpus: ${fname} = ${expected}`, actual === expected, `actual=${actual}`);
}

// P12 MonthlyRevenue PIT requirement satisfied
if (p12Contract) {
  const monthlyRevSource = p12Contract.featureSourceContracts?.find(s => s.sourceName === 'MonthlyRevenue');
  if (monthlyRevSource) {
    const nowRepaired = monthlyRevSource.repairNeeded === false || sqlInt("SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL") === 2143;
    check('F-P12-REPAIR', 'P12 MonthlyRevenue PIT repair completed (releaseDate present)', sqlInt("SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL") === 2143, `rowsWithReleaseDate=${sqlInt("SELECT COUNT(*) FROM MonthlyRevenue WHERE releaseDate IS NOT NULL")}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

const errors = checks.filter(c => c.status === 'FAIL').map(c => `${c.id}: ${c.description} — ${c.detail}`);
const warnings = checks.filter(c => c.status === 'WARN').map(c => `${c.id}: ${c.description} — ${c.detail}`);
const validationStatus = failCount === 0 ? 'PASS' : 'FAIL';

console.log('');
console.log(`Total checks: ${checks.length} | PASS: ${passCount} | FAIL: ${failCount} | WARN: ${warnCount}`);
console.log('validationStatus:', validationStatus);

const result = {
  phase: 'P25-HARDRESET',
  part: 'F',
  generatedAt: NOW,
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  validationStatus,
  passCount,
  failCount,
  warnCount,
  checks,
  errors,
  warnings,
  crossReference: {
    p12ContractPresent: !!p12Contract,
    p17QueryGateActive: p17QueryPatchApplied,
    p24MigrationStatus: p24Migration?.migrationStatus ?? 'UNKNOWN',
    p24BackfillRowsBackfilled: p24Backfill?.rowsBackfilled ?? 0,
    p25PreflightClassification: p25Preflight?.classification ?? 'UNKNOWN',
    p25DistributionStatus: p25Dist?.validationStatus ?? 'UNKNOWN',
    p25QueryGateStatus: p25Gate?.validationStatus ?? 'UNKNOWN',
    p25ActiveScoringSmokeStatus: p25Smoke?.smokeStatus ?? 'UNKNOWN',
  },
  productionDbWritten: false,
  corpusModified: false,
  scoringFormulaModified: false,
};

const jsonPath = path.join(OUT_DIR, 'p25post_migration_contract_validation.json');
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
console.log('Written:', jsonPath);

const md = `# P25 Post-Migration Contract Validation

**Phase:** P25-HARDRESET Part F  
**Generated:** ${NOW}  
**Validation Status:** \`${validationStatus}\`

## Summary

| Metric | Value |
|--------|-------|
| Total checks | ${checks.length} |
| PASS | ${passCount} |
| FAIL | ${failCount} |
| WARN | ${warnCount} |

## Checks

${checks.map(c => `- [${c.status}] \`${c.id}\` — ${c.description}${c.detail ? ' (' + c.detail + ')' : ''}`).join('\n')}

## Cross-Reference

| Source | Status |
|--------|--------|
| P12 PIT contract present | ${!!p12Contract ? '✅' : '⚠️ Not found'} |
| P17 query gate active | ${p17QueryPatchApplied ? '✅' : '❌'} |
| P24 migration status | \`${p24Migration?.migrationStatus ?? 'UNKNOWN'}\` |
| P24 rows backfilled | ${p24Backfill?.rowsBackfilled ?? 0} |
| P25 preflight | \`${p25Preflight?.classification ?? 'UNKNOWN'}\` |
| P25 distribution audit | \`${p25Dist?.validationStatus ?? 'UNKNOWN'}\` |
| P25 query gate smoke | \`${p25Gate?.validationStatus ?? 'UNKNOWN'}\` |
| P25 active scoring smoke | \`${p25Smoke?.smokeStatus ?? 'UNKNOWN'}\` |

## Errors

${errors.length ? errors.map(e => `- ❌ ${e}`).join('\n') : '✅ None'}

## Warnings

${warnings.length ? warnings.map(w => `- ⚠️ ${w}`).join('\n') : 'None'}

*Does not constitute investment advice. No ROI / win-rate / alpha / profit / outperform claims.*
`;

const mdPath = path.join(OUT_DIR, 'p25post_migration_contract_validation.md');
fs.writeFileSync(mdPath, md);
console.log('Written:', mdPath);
