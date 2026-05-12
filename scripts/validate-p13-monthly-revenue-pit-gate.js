#!/usr/bin/env node
/**
 * P13-HARDRESET PART E: MonthlyRevenue PIT Gate Validation Script
 *
 * Validates the PIT gate logic using fixture records.
 * Read-only. Does NOT write production DB.
 * All test cases are deterministic, no Math.random(), no corpus modification.
 */
'use strict';

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const {
  inferMonthlyRevenueReleaseDate,
  isMonthlyRevenueAvailableAsOf,
  validateMonthlyRevenueReleaseDate,
} = require('../src/lib/onlineValidation/P13MonthlyRevenuePitUtils');

const fs = require('fs');
const OUT_DIR = 'outputs/online_validation';

const results = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function assert(caseId, description, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  if (condition) passed++;
  else failed++;
  const r = { caseId, description, status, detail };
  results.push(r);
  console.log(`[${status}] ${caseId}: ${description}${detail ? ' — ' + JSON.stringify(detail) : ''}`);
  return condition;
}

function warn(caseId, description, detail) {
  warnings++;
  const r = { caseId, description, status: 'WARN', detail };
  results.push(r);
  console.log(`[WARN] ${caseId}: ${description}${detail ? ' — ' + JSON.stringify(detail) : ''}`);
}

// ── Fixture records ───────────────────────────────────────────────────────────

// Case 1: Missing releaseDate, year=2024, month=1
// Inferred: 2024-02-10
// asOf=2024-02-09 → unavailable
// asOf=2024-02-10 → available
const case1Record = { stockId: 'TEST001', year: 2024, month: 1, revenue: 1000000, yoyGrowth: 5.0, momGrowth: -2.0 };

;(function testCase1() {
  const inferred = inferMonthlyRevenueReleaseDate(case1Record);
  assert('C1-001', 'Jan 2024 inferred releaseDate = 2024-02-10', inferred.releaseDate === '2024-02-10', { got: inferred.releaseDate });
  assert('C1-002', 'Jan 2024 releaseDateSource = INFERRED_NEXT_MONTH_10TH', inferred.releaseDateSource === 'INFERRED_NEXT_MONTH_10TH', { got: inferred.releaseDateSource });
  assert('C1-003', 'Jan 2024 repairNeeded = true', inferred.repairNeeded === true, { got: inferred.repairNeeded });
  assert('C1-004', 'Jan 2024 confidence = LOW_TO_MEDIUM', inferred.confidence === 'LOW_TO_MEDIUM', { got: inferred.confidence });

  const before = isMonthlyRevenueAvailableAsOf(case1Record, '2024-02-09');
  assert('C1-005', 'asOfDate=2024-02-09 → unavailable (before release)', before.available === false, { available: before.available, reason: before.reason });

  const onDay = isMonthlyRevenueAvailableAsOf(case1Record, '2024-02-10');
  assert('C1-006', 'asOfDate=2024-02-10 → available (on release day)', onDay.available === true, { available: onDay.available, reason: onDay.reason });

  const after = isMonthlyRevenueAvailableAsOf(case1Record, '2024-02-15');
  assert('C1-007', 'asOfDate=2024-02-15 → available (after release day)', after.available === true, { available: after.available });
})();

// Case 2: Explicit releaseDate provided — use authoritative, do not infer
;(function testCase2() {
  const case2 = { stockId: 'TEST002', year: 2024, month: 3, revenue: 2000000, yoyGrowth: 8.0, momGrowth: 3.0, releaseDate: '2024-04-08' };
  const inferred = inferMonthlyRevenueReleaseDate(case2);
  assert('C2-001', 'Explicit releaseDate uses AUTHORITATIVE source', inferred.releaseDateSource === 'AUTHORITATIVE', { got: inferred.releaseDateSource });
  assert('C2-002', 'Explicit releaseDate is returned as-is', inferred.releaseDate === '2024-04-08', { got: inferred.releaseDate });
  assert('C2-003', 'Explicit releaseDate repairNeeded = false', inferred.repairNeeded === false, { got: inferred.repairNeeded });
  assert('C2-004', 'Explicit releaseDate confidence = HIGH', inferred.confidence === 'HIGH', { got: inferred.confidence });

  const unavail = isMonthlyRevenueAvailableAsOf(case2, '2024-04-07');
  assert('C2-005', 'asOf before explicit releaseDate → unavailable', unavail.available === false, { reason: unavail.reason });

  const avail = isMonthlyRevenueAvailableAsOf(case2, '2024-04-08');
  assert('C2-006', 'asOf = explicit releaseDate → available', avail.available === true, { reason: avail.reason });
})();

// Case 3: Missing year/month
;(function testCase3() {
  const case3 = { stockId: 'TEST003', revenue: 500000 };
  const inferred = inferMonthlyRevenueReleaseDate(case3);
  assert('C3-001', 'Missing year/month → MISSING releaseDateSource', inferred.releaseDateSource === 'MISSING', { got: inferred.releaseDateSource });
  assert('C3-002', 'Missing year/month → releaseDate = null', inferred.releaseDate === null, { got: inferred.releaseDate });
  assert('C3-003', 'Missing year/month → repairNeeded = true', inferred.repairNeeded === true, { got: inferred.repairNeeded });

  const result = isMonthlyRevenueAvailableAsOf(case3, '2024-02-15');
  assert('C3-004', 'Missing year/month → available = false', result.available === false, { reason: result.reason });
})();

// Case 4: releaseDate after asOfDate → unavailable
;(function testCase4() {
  const case4 = { stockId: 'TEST004', year: 2024, month: 6, revenue: 800000, releaseDate: '2024-07-10' };
  const before = isMonthlyRevenueAvailableAsOf(case4, '2024-07-05');
  assert('C4-001', 'releaseDate after asOfDate → unavailable', before.available === false, { reason: before.reason });
  assert('C4-002', 'Source is AUTHORITATIVE for explicit releaseDate', before.releaseDateSource === 'AUTHORITATIVE', { got: before.releaseDateSource });
})();

// Case 5: releaseDate before or equal asOfDate → available
;(function testCase5() {
  const case5 = { stockId: 'TEST005', year: 2024, month: 5, revenue: 900000, releaseDate: '2024-06-10' };
  const equal = isMonthlyRevenueAvailableAsOf(case5, '2024-06-10');
  assert('C5-001', 'releaseDate = asOfDate → available', equal.available === true, { reason: equal.reason });

  const before = isMonthlyRevenueAvailableAsOf(case5, '2024-07-01');
  assert('C5-002', 'releaseDate < asOfDate → available', before.available === true, { reason: before.reason });
})();

// Case 6: Outcome fields in input — must be ignored (not used for inference)
;(function testCase6() {
  // These forbidden fields are present but must NOT affect availablity or releaseDate
  const case6 = {
    stockId: 'TEST006',
    year: 2024,
    month: 8,
    revenue: 1100000,
    // Forbidden fields — must be ignored by inference
    outcomePrice: 150.0,
    returnPct: 12.5,
    realizedReturnClass: 'STRONG_BUY',
    futurePrice: 170.0,
  };
  const inferred = inferMonthlyRevenueReleaseDate(case6);
  // Should still infer from year/month only
  assert('C6-001', 'Forbidden fields present but releaseDate inferred from year/month only', inferred.releaseDate === '2024-09-10', { got: inferred.releaseDate });
  assert('C6-002', 'Source is INFERRED_NEXT_MONTH_10TH regardless of outcome fields', inferred.releaseDateSource === 'INFERRED_NEXT_MONTH_10TH', { got: inferred.releaseDateSource });
  // The forbidden fields are on the record object but the function must not use them
  warn('C6-003', 'Forbidden fields (outcomePrice/returnPct/realizedReturnClass) must never flow into releaseDate logic — verified by inspection', { releaseDateUsed: inferred.releaseDate });
})();

// Case 7: December → January year rollover
;(function testCase7() {
  const case7 = { stockId: 'TEST007', year: 2024, month: 12, revenue: 1500000 };
  const inferred = inferMonthlyRevenueReleaseDate(case7);
  assert('C7-001', 'Dec 2024 inferred releaseDate = 2025-01-10', inferred.releaseDate === '2025-01-10', { got: inferred.releaseDate });
  assert('C7-002', 'Year rolls over correctly (2024 → 2025)', inferred.releaseDate?.startsWith('2025-'), { got: inferred.releaseDate });
})();

// Case 8: Invalid releaseDate format
;(function testCase8() {
  const case8 = { stockId: 'TEST008', year: 2024, month: 2, revenue: 600000, releaseDate: 'not-a-date' };
  const inferred = inferMonthlyRevenueReleaseDate(case8);
  assert('C8-001', 'Invalid releaseDate format → INVALID source', inferred.releaseDateSource === 'INVALID', { got: inferred.releaseDateSource });
  assert('C8-002', 'Invalid releaseDate → null returned', inferred.releaseDate === null, { got: inferred.releaseDate });
  assert('C8-003', 'Invalid releaseDate → repairNeeded = true', inferred.repairNeeded === true, { got: inferred.repairNeeded });
})();

// Case 9: Invalid asOfDate
;(function testCase9() {
  const case9 = { stockId: 'TEST009', year: 2024, month: 3, revenue: 700000 };
  const result = isMonthlyRevenueAvailableAsOf(case9, 'not-a-date');
  assert('C9-001', 'Invalid asOfDate → available = false', result.available === false, { reason: result.reason });
})();

// Case 10: validateMonthlyRevenueReleaseDate with valid AUTHORITATIVE date
;(function testCase10() {
  const case10 = { year: 2024, month: 7, revenue: 950000, releaseDate: '2024-08-09' };
  const validation = validateMonthlyRevenueReleaseDate(case10);
  assert('C10-001', 'AUTHORITATIVE releaseDate passes validation', validation.valid === true, { errors: validation.errors, warnings: validation.warnings });
  assert('C10-002', 'AUTHORITATIVE source returned', validation.releaseDateSource === 'AUTHORITATIVE', { got: validation.releaseDateSource });
})();

// Case 11: validateMonthlyRevenueReleaseDate with inferred date
;(function testCase11() {
  const case11 = { year: 2024, month: 9, revenue: 880000 };
  const validation = validateMonthlyRevenueReleaseDate(case11);
  assert('C11-001', 'Inferred releaseDate has no errors', validation.errors.length === 0, { errors: validation.errors });
  assert('C11-002', 'Inferred date source is INFERRED_NEXT_MONTH_10TH', validation.releaseDateSource === 'INFERRED_NEXT_MONTH_10TH', { got: validation.releaseDateSource });
  assert('C11-003', 'Inferred date has warning about repairNeeded', validation.warnings.length > 0, { warnings: validation.warnings });
})();

// Case 12: validateMonthlyRevenueReleaseDate missing year/month
;(function testCase12() {
  const case12 = { revenue: 500000 };
  const validation = validateMonthlyRevenueReleaseDate(case12);
  assert('C12-001', 'Missing year/month → validation invalid', validation.valid === false, { errors: validation.errors });
})();

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passed + failed;
const failRate = total > 0 ? failed / total : 0;
const validationStatus = failed === 0 ? 'PASS' : failRate < 0.01 ? 'PARTIAL' : 'FAIL';

console.log(`\nTotal: ${total}, Passed: ${passed}, Failed: ${failed}, Warnings: ${warnings}`);
console.log('Validation Status:', validationStatus);

const output = {
  phase: 'P13-HARDRESET',
  part: 'E',
  generatedAt: new Date().toISOString(),
  validationStatus,
  total,
  passed,
  failed,
  warnings,
  failRate: Math.round(failRate * 10000) / 10000,
  testCases: results,
  nonGoals: [
    'This script does NOT write production DB.',
    'This script does NOT modify scoring formulas.',
    'This script does NOT use realized return data.',
    'This script does NOT produce ROI/alpha/profit claims.',
  ],
};

fs.writeFileSync('outputs/online_validation/p13monthly_revenue_pit_gate_validation.json', JSON.stringify(output, null, 2));

const md = `# P13-HARDRESET: MonthlyRevenue PIT Gate Validation

> Disclaimer: No production DB writes. No investment recommendations. No ROI/alpha/profit claims.

**Status:** ${validationStatus}  
**Generated:** ${output.generatedAt}  
**Total:** ${total} | **Passed:** ${passed} | **Failed:** ${failed} | **Warnings:** ${warnings}

## Test Results

| Case | Description | Status |
|------|-------------|--------|
${results.map(r => `| ${r.caseId} | ${r.description} | ${r.status} |`).join('\n')}
`;

fs.writeFileSync('outputs/online_validation/p13monthly_revenue_pit_gate_validation.md', md);

if (failed > 0) process.exit(1);
