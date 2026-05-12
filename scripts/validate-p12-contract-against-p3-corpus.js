'use strict';
/**
 * scripts/validate-p12-contract-against-p3-corpus.js
 * PART E — P12-HARDRESET Contract Validation Against P3 Corpus
 *
 * Reads:
 *   - outputs/online_validation/p12pit_feature_contract_v0.json
 *   - outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl
 *
 * Checks each corpus row against the PIT Feature Contract:
 *   - No outcomePrice/returnPct/realizedReturnClass inside activeScoringSnapshot
 *   - originalAsOfDate (or asOfDate) exists
 *   - pitGateDate == asOfDate in activeScoringSnapshot
 *   - priceSource != 'mock-deterministic'
 *   - scoringCompletenessStatus exists
 *
 * Outputs:
 *   - outputs/online_validation/p12pit_feature_contract_validation.json
 *   - outputs/online_validation/p12pit_feature_contract_validation.md
 *
 * NO scoring changes. NO corpus modifications. NO investment claims.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({ baseUrl: __dirname + '/../', paths: { '@/*': ['src/*'] } });

const fs = require('fs');

const {
  validatePitFeatureSnapshot,
  FORBIDDEN_SNAPSHOT_FIELDS,
} = require('../src/lib/onlineValidation/P12PitFeatureContractUtils');

const OUT = 'outputs/online_validation';
const NOW = '2026-05-12';

// Load contract
const contract = JSON.parse(fs.readFileSync(`${OUT}/p12pit_feature_contract_v0.json`, 'utf8'));

// Load P3 corpus
const p3Lines = fs.readFileSync(`${OUT}/p3active_scoring_historical_replay_corpus.jsonl`, 'utf8').trim().split('\n');
const total = p3Lines.length;

// Validation stats
const stats = {
  total,
  passed: 0,
  failed: 0,
  warnings: 0,
  violations: [],
};

const MAX_VIOLATIONS = 100; // Cap output size

for (let i = 0; i < p3Lines.length; i++) {
  let row;
  try {
    row = JSON.parse(p3Lines[i]);
  } catch (e) {
    stats.failed++;
    if (stats.violations.length < MAX_VIOLATIONS) {
      stats.violations.push({ rowIndex: i, symbol: 'PARSE_ERROR', issue: 'JSON parse failed', severity: 'FAIL' });
    }
    continue;
  }

  const issues = [];

  // 1. Check originalAsOfDate or asOfDate exists at row level
  const hasAsOfDate = row.originalAsOfDate || row.asOfDate;
  if (!hasAsOfDate) {
    issues.push({ field: 'originalAsOfDate', message: 'Missing originalAsOfDate (or asOfDate) at corpus row level', severity: 'FAIL' });
  }

  // 2. Check priceSource != 'mock-deterministic'
  const priceSource = row.priceSource || row.entryPriceSource ||
    (row.outcomeSnapshot && row.outcomeSnapshot.priceSource) || null;
  if (priceSource === 'mock-deterministic') {
    issues.push({ field: 'priceSource', message: 'priceSource=mock-deterministic found — forbidden by PIT-007', severity: 'FAIL' });
  }

  // 3. Check scoringCompletenessStatus exists
  if (!row.scoringCompletenessStatus && !(row.activeScoringSnapshot && row.activeScoringSnapshot.completenessStatus)) {
    issues.push({ field: 'scoringCompletenessStatus', message: 'Missing scoringCompletenessStatus', severity: 'WARN' });
  }

  // 4. Validate activeScoringSnapshot
  if (row.activeScoringSnapshot && typeof row.activeScoringSnapshot === 'object') {
    const snap = row.activeScoringSnapshot;

    // Forbidden field check
    for (const forbidden of FORBIDDEN_SNAPSHOT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(snap, forbidden)) {
        issues.push({ field: `activeScoringSnapshot.${forbidden}`, message: `Forbidden PIT-leaking field in activeScoringSnapshot: "${forbidden}"`, severity: 'FAIL' });
      }
    }

    // pitGateDate == asOfDate
    if (snap.pitGateDate && snap.asOfDate && snap.pitGateDate !== snap.asOfDate) {
      issues.push({ field: 'activeScoringSnapshot.pitGateDate', message: `pitGateDate (${snap.pitGateDate}) != asOfDate (${snap.asOfDate})`, severity: 'FAIL' });
    }

    // Use utility validator for full check
    const snapResult = validatePitFeatureSnapshot(snap);
    for (const err of snapResult.errors) {
      issues.push({ field: `activeScoringSnapshot.${err.field}`, message: err.message, severity: 'FAIL' });
    }
    for (const warn of snapResult.warnings) {
      issues.push({ field: 'activeScoringSnapshot', message: warn, severity: 'WARN' });
    }
  } else {
    // No activeScoringSnapshot at all
    issues.push({ field: 'activeScoringSnapshot', message: 'Missing activeScoringSnapshot field', severity: 'WARN' });
  }

  const hasFail = issues.some(i => i.severity === 'FAIL');
  const hasWarn = issues.some(i => i.severity === 'WARN');

  if (hasFail) {
    stats.failed++;
    if (stats.violations.length < MAX_VIOLATIONS) {
      stats.violations.push({
        rowIndex: i,
        symbol: row.symbol || '?',
        asOfDate: row.originalAsOfDate || row.asOfDate || '?',
        issues: issues.filter(i => i.severity === 'FAIL'),
      });
    }
  } else if (hasWarn) {
    stats.warnings++;
    stats.passed++; // Warnings are not failures
  } else {
    stats.passed++;
  }
}

// Determine validation status
const failRate = stats.total > 0 ? stats.failed / stats.total : 0;
let validationStatus;
if (stats.failed === 0) {
  validationStatus = 'PASS';
} else if (failRate < 0.01) {
  validationStatus = 'PARTIAL';
} else {
  validationStatus = 'FAIL';
}

const report = {
  generatedAt: `${NOW}T00:00:00.000Z`,
  disclaimer: 'Contract validation only. No investment recommendations. No scoring changes. No corpus modifications.',
  phase: 'P12-HARDRESET',
  contractVersion: contract.contractVersion,
  corpusFile: 'p3active_scoring_historical_replay_corpus.jsonl',
  validationStatus,
  stats: {
    totalRows: stats.total,
    passed: stats.passed,
    failed: stats.failed,
    warnings: stats.warnings,
    failRate: `${(failRate * 100).toFixed(2)}%`,
  },
  violations: stats.violations,
  contractRequirementsTested: [
    'PIT-001: No future data in scoring features (proxied via asOfDate existence)',
    'PIT-002: pitGateDate == asOfDate in activeScoringSnapshot',
    'PIT-004: No forbidden snapshot fields (outcomePrice, returnPct, realizedReturnClass, etc.) in activeScoringSnapshot',
    'PIT-007: priceSource != mock-deterministic',
    'scoringCompletenessStatus present',
  ],
};

fs.writeFileSync(`${OUT}/p12pit_feature_contract_validation.json`, JSON.stringify(report, null, 2));

const statusIcon = validationStatus === 'PASS' ? '✅' : validationStatus === 'PARTIAL' ? '⚠️' : '❌';
const violationSample = stats.violations.slice(0, 10).map(v =>
  `| ${v.rowIndex} | ${v.symbol || '?'} | ${v.asOfDate || '?'} | ${(v.issues || []).map(i => i.message).join('; ').slice(0, 80)} |`
).join('\n');

const md = `# P12-HARDRESET Contract Validation Against P3 Corpus

**Date:** ${NOW}  
**Status:** ${statusIcon} ${validationStatus}  
**Contract Version:** ${contract.contractVersion}

> **Disclaimer:** Contract validation only. No investment recommendations. No scoring changes. No corpus modifications.

## Validation Stats

| Metric | Value |
|--------|-------|
| Total Rows | ${stats.total} |
| Passed | ${stats.passed} |
| Failed | ${stats.failed} |
| Warnings | ${stats.warnings} |
| Fail Rate | ${(failRate * 100).toFixed(2)}% |

## Requirements Tested

${report.contractRequirementsTested.map(r => `- ${r}`).join('\n')}

## Violations (first 10)

| Row | Symbol | asOfDate | Issues |
|-----|--------|----------|--------|
${violationSample || '*(none)*'}

## Conclusion

${validationStatus === 'PASS'
  ? 'All P3 corpus rows pass PIT feature contract validation. No forbidden fields, no mock-deterministic prices, no pitGateDate divergence found.'
  : validationStatus === 'PARTIAL'
  ? `${stats.failed} rows (${(failRate * 100).toFixed(2)}%) have contract violations — below 1% threshold, classified as PARTIAL (borderline acceptable). Review violations and address in P13 repair cycle.`
  : `${stats.failed} rows (${(failRate * 100).toFixed(2)}%) have contract violations — exceeds 1% threshold. P13 repair required before corpus promotion.`
}
`;

fs.writeFileSync(`${OUT}/p12pit_feature_contract_validation.md`, md);

console.log('PART E complete. Validation status:', validationStatus);
console.log('Total:', stats.total, '| Passed:', stats.passed, '| Failed:', stats.failed, '| Warnings:', stats.warnings);
console.log('Output: p12pit_feature_contract_validation.json + .md');
if (validationStatus === 'FAIL') process.exit(1);
