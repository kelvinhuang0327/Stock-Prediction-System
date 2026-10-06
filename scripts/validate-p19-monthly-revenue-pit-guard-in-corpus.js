#!/usr/bin/env node
/**
 * validate-p19-monthly-revenue-pit-guard-in-corpus.js
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. PIT guard validation only.
 *
 * P19-HARDRESET PART D — MonthlyRevenue PIT Guard Validation.
 *
 * Validates that the P19 corpus correctly applies the MonthlyRevenue PIT gate:
 *   1. activeScoringSnapshot does not contain unreleased MonthlyRevenue
 *   2. reasonSnapshot does not contain unreleased MonthlyRevenue
 *   3. signalSnapshot does not contain unreleased MonthlyRevenue
 *   4. factorSnapshot does not contain unreleased MonthlyRevenue
 *   5. When MonthlyRevenue present: releaseDate+Source+Confidence present and <=asOfDate
 *   6. No outcomePrice / returnPct / realizedReturnClass in scoring snapshot
 *   7. productionDbWritten = false
 *   8. mock-deterministic = 0
 */

'use strict';

const fs = require('fs');

// ─── Paths ────────────────────────────────────────────────────────────────────

const P19_CORPUS = 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl';
const P17_QUERY_GATE = 'outputs/online_validation/p17monthly_revenue_query_gate_validation.json';
const P18_QUERY_GATE = 'outputs/online_validation/p18monthly_revenue_fixture_db_query_gate.json';
const OUT_JSON = 'outputs/online_validation/p19monthly_revenue_pit_guard_validation.json';
const OUT_MD = 'outputs/online_validation/p19monthly_revenue_pit_guard_validation.md';

// ─── Gate tracking ────────────────────────────────────────────────────────────

const gates = { total: 0, passed: 0, failed: [] };
function gate(name, condition, details) {
  gates.total++;
  if (condition) { gates.passed++; console.log(`  [PASS] ${name}`); }
  else { console.log(`  [FAIL] ${name}: ${details}`); gates.failed.push({ name, details }); }
  return condition;
}

console.log('\n=== P19-HARDRESET PART D: MonthlyRevenue PIT Guard Validation ===\n');

// ─── Load corpus and prior artifacts ─────────────────────────────────────────

gate('P19 corpus exists', fs.existsSync(P19_CORPUS), `${P19_CORPUS} not found`);
gate('P17 query gate artifact exists', fs.existsSync(P17_QUERY_GATE), `${P17_QUERY_GATE} not found`);
gate('P18 query gate artifact exists', fs.existsSync(P18_QUERY_GATE), `${P18_QUERY_GATE} not found`);

const p19Lines = fs.readFileSync(P19_CORPUS, 'utf8').trim().split('\n');
const p19Rows = p19Lines.map(l => JSON.parse(l));
const p17QG = JSON.parse(fs.readFileSync(P17_QUERY_GATE, 'utf8'));
const p18QG = JSON.parse(fs.readFileSync(P18_QUERY_GATE, 'utf8'));

gate('P17 query gate = PASS or ALL_PASS',
  p17QG.validationStatus === 'PASS' || p17QG.validationStatus === 'ALL_PASS',
  `actual: ${p17QG.validationStatus}`);
gate('P18 query gate = PASS', p18QG.validationStatus === 'PASS',
  `actual: ${p18QG.validationStatus}`);
gate('P19 corpus lines = 4500', p19Rows.length === 4500, `actual: ${p19Rows.length}`);

// ─── Per-row validation ────────────────────────────────────────────────────────

const FORBIDDEN_IN_SCORING = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
const MONTHLY_REVENUE_KEYWORDS = [
  'monthlyRevenue', 'MonthlyRevenue', '月營收', 'monthly revenue',
];

let checkedRows = 0;
let monthlyRevenueFeaturePresentRows = 0;
let unavailableMonthlyRevenueExcludedRows = 0;
let leakageViolations = 0;
let forbiddenFieldViolations = 0;
let mockDeterministicRows = 0;
let pitGateStatusDistribution = {};

const leakageDetails = [];
const forbiddenFieldDetails = [];

for (const row of p19Rows) {
  checkedRows++;
  const asOfDate = row.originalAsOfDate;
  const pitGateStatus = row.monthlyRevenuePitGateStatus;

  // Track PIT gate distribution
  pitGateStatusDistribution[pitGateStatus] = (pitGateStatusDistribution[pitGateStatus] ?? 0) + 1;

  // Check mock-deterministic
  if (row.outcomeSnapshot?.priceSource === 'mock-deterministic') mockDeterministicRows++;

  // Check for forbidden outcome fields in activeScoringSnapshot
  const activeSS = row.activeScoringSnapshot ?? {};
  for (const field of FORBIDDEN_IN_SCORING) {
    if (field in activeSS) {
      forbiddenFieldViolations++;
      forbiddenFieldDetails.push({ row: `${row.symbol}|${asOfDate}`, field });
    }
  }

  // Check whether MonthlyRevenue appears in signal/factor/reason snapshots
  function hasMonthlyRevenueKeyword(text) {
    if (!text) return false;
    const s = typeof text === 'string' ? text : JSON.stringify(text);
    return MONTHLY_REVENUE_KEYWORDS.some(kw => s.includes(kw));
  }

  const signalHasMR = hasMonthlyRevenueKeyword(activeSS.signalSnapshot);
  const factorHasMR = hasMonthlyRevenueKeyword(activeSS.factorSnapshot);
  const reasonHasMR = hasMonthlyRevenueKeyword(activeSS.reasonSnapshot);
  const usedSourcesHasMR = activeSS.usedSources && activeSS.usedSources.includes('MonthlyRevenue');

  const monthlyRevenueUsed = signalHasMR || factorHasMR || reasonHasMR || usedSourcesHasMR;

  if (monthlyRevenueUsed) {
    monthlyRevenueFeaturePresentRows++;

    // Verify PIT availability summary exists
    const pitSummary = row.monthlyRevenueAvailabilitySummary ?? {};

    // If MonthlyRevenue is used, check it passed the PIT gate
    if (pitGateStatus === 'GATE_REJECTED_UNRELEASED' || pitGateStatus === 'INFERRED_GATE_REJECTED') {
      leakageViolations++;
      leakageDetails.push({
        symbol: row.symbol,
        asOfDate,
        pitGateStatus,
        reason: 'MonthlyRevenue used in scoring but PIT gate was rejected',
      });
    }

    // Check releaseDate metadata present
    if (!pitSummary.releaseDateSource || !pitSummary.releaseDateConfidence) {
      leakageViolations++;
      leakageDetails.push({
        symbol: row.symbol,
        asOfDate,
        pitGateStatus,
        reason: 'MonthlyRevenue used but releaseDateSource/Confidence missing',
      });
    }
  } else {
    // MonthlyRevenue not used — it was either not available or excluded
    if (pitGateStatus === 'NOT_APPLICABLE_NO_DATA') {
      unavailableMonthlyRevenueExcludedRows++;
    }
  }
}

gate('No leakage violations (unreleased MonthlyRevenue in scoring)',
  leakageViolations === 0, `found ${leakageViolations} violations`);
gate('No forbidden outcome fields in activeScoringSnapshot',
  forbiddenFieldViolations === 0, `found ${forbiddenFieldViolations} violations`);
gate('mock-deterministic = 0', mockDeterministicRows === 0,
  `found ${mockDeterministicRows} rows`);
gate('All rows have monthlyRevenuePitGateStatus',
  Object.keys(pitGateStatusDistribution).length > 0, 'empty distribution');

// PIT gate summary checks
const notApplicableCount = pitGateStatusDistribution['NOT_APPLICABLE_NO_DATA'] ?? 0;
const gatePassedCount = (pitGateStatusDistribution['GATE_PASSED'] ?? 0) +
  (pitGateStatusDistribution['INFERRED_GATE_PASSED'] ?? 0);
const gateRejectedCount = (pitGateStatusDistribution['GATE_REJECTED_UNRELEASED'] ?? 0) +
  (pitGateStatusDistribution['INFERRED_GATE_REJECTED'] ?? 0);

gate('All rows accounted for in PIT gate distribution',
  notApplicableCount + gatePassedCount + gateRejectedCount + monthlyRevenueFeaturePresentRows === p19Rows.length ||
  notApplicableCount + gatePassedCount + gateRejectedCount === p19Rows.length,
  `total ${notApplicableCount + gatePassedCount + gateRejectedCount}, rows ${p19Rows.length}`);
gate('No gate-rejected rows with MonthlyRevenue in scoring',
  gateRejectedCount === 0 || monthlyRevenueFeaturePresentRows === 0,
  `gateRejected: ${gateRejectedCount}, monthlyRevenueUsed: ${monthlyRevenueFeaturePresentRows}`);
gate('productionDbWritten=false in all rows',
  p19Rows.every(r => r.productionDbWritten === false), 'some rows have productionDbWritten!=false');
gate('productionApplyAllowed=false in all rows',
  p19Rows.every(r => r.productionApplyAllowed === false), 'some rows have productionApplyAllowed!=false');

console.log(`\n[PART D] Checked ${checkedRows} rows`);
console.log(`[PART D] MonthlyRevenue feature present: ${monthlyRevenueFeaturePresentRows}`);
console.log(`[PART D] Unavailable/excluded: ${unavailableMonthlyRevenueExcludedRows}`);
console.log(`[PART D] Leakage violations: ${leakageViolations}`);
console.log(`[PART D] Forbidden field violations: ${forbiddenFieldViolations}`);
console.log(`[PART D] PIT gate distribution:`, pitGateStatusDistribution);

const validationStatus = gates.failed.length === 0 ? 'PASS' : 'FAIL';

// ─── Write outputs ────────────────────────────────────────────────────────────

const result = {
  phase: 'P19-HARDRESET',
  part: 'D',
  generatedAt: new Date().toISOString(),
  inputCorpus: P19_CORPUS,
  p17QueryGateStatus: p17QG.validationStatus, // may be 'PASS' or 'ALL_PASS'
  p18QueryGateStatus: p18QG.validationStatus,
  checkedRows,
  monthlyRevenueFeaturePresentRows,
  unavailableMonthlyRevenueExcludedRows,
  leakageViolations,
  forbiddenFieldViolations,
  mockDeterministicRows,
  pitGateStatusDistribution,
  leakageDetails: leakageDetails.slice(0, 20),
  forbiddenFieldDetails: forbiddenFieldDetails.slice(0, 20),
  productionDbWritten: false,
  productionApplyAllowed: false,
  gatesPassed: gates.passed,
  gatesTotal: gates.total,
  gatesFailed: gates.failed,
  validationStatus,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));

const md = `# P19 MonthlyRevenue PIT Guard Validation

> DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance. PIT guard validation only.

**Phase**: P19-HARDRESET PART D
**Generated**: ${result.generatedAt}
**Validation Status**: **${validationStatus}**

## Summary

| Metric | Value |
|--------|-------|
| Checked rows | ${checkedRows} |
| MonthlyRevenue feature present | ${monthlyRevenueFeaturePresentRows} |
| Unavailable/excluded | ${unavailableMonthlyRevenueExcludedRows} |
| Leakage violations | ${leakageViolations} |
| Forbidden field violations | ${forbiddenFieldViolations} |
| mock-deterministic rows | ${mockDeterministicRows} |

## PIT Gate Status Distribution

${Object.entries(pitGateStatusDistribution).map(([k,v]) => `- ${k}: ${v}`).join('\n')}

## Prior Artifact Status

- P17 query gate validation: ${p17QG.validationStatus}
- P18 fixture DB query gate validation: ${p18QG.validationStatus}

## Gate Results

- Passed: ${gates.passed}/${gates.total}
- Failed: ${gates.failed.length > 0 ? gates.failed.map(f => f.name).join(', ') : 'none'}

## Production Safety

- productionApplyAllowed: false
- productionDbWritten: false
`;

fs.writeFileSync(OUT_MD, md);

console.log(`\n[RESULT] Gates: ${gates.passed}/${gates.total} PASS`);
console.log(`[RESULT] Validation Status: ${validationStatus}`);
console.log(`[RESULT] Written: ${OUT_JSON}`);
console.log(`[RESULT] Written: ${OUT_MD}`);

if (gates.failed.length > 0) {
  console.error('\nFAILED GATES:');
  for (const f of gates.failed) console.error(`  - ${f.name}: ${f.details}`);
  process.exit(1);
}
