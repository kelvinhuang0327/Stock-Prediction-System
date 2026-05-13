/**
 * P26F-HARDRESET: MonthlyRevenue PIT Leakage Validation
 *
 * Validates PIT gate logic using synthetic test data (no DB needed).
 * 13 test cases covering all edge cases.
 * No ROI/win-rate/profit/outperform/buy/sell claims.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = 'outputs/online_validation';
const RESULT_JSON = path.join(OUT_DIR, 'p26f_monthly_revenue_pit_leakage_validation.json');
const RESULT_MD = path.join(OUT_DIR, 'p26f_monthly_revenue_pit_leakage_validation.md');

function resolveReleaseDate(row) {
  if (!row.releaseDate) return null;
  const ts = typeof row.releaseDate === 'string' ? row.releaseDate : row.releaseDate.toISOString();
  return new Date(Date.parse(ts) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isVisible(row, asOfDate) {
  const rd = resolveReleaseDate(row);
  if (!rd) return false;
  return rd <= asOfDate;
}

function selectLatest(rows, symbol, asOfDate) {
  const visible = rows.filter(r => r.stockId === symbol && isVisible(r, asOfDate));
  if (!visible.length) return null;
  visible.sort((a, b) => {
    const rdA = resolveReleaseDate(a), rdB = resolveReleaseDate(b);
    if (rdB !== rdA) return rdB < rdA ? -1 : 1;
    const mA = a.year * 12 + a.month, mB = b.year * 12 + b.month;
    return mB - mA;
  });
  return visible[0];
}

function buildContext(selected, sourceMode) {
  if (!selected) {
    return {
      readOnly: true, entersAlphaScore: false,
      visibilityGate: 'releaseDate <= asOfDate',
      sourceMatched: false, releaseDate: null,
      revenueYear: null, revenueMonth: null, revenue: null,
      yoyGrowth: null, momGrowth: null,
      sourceHash: 'NO_MATCH', sourceMode,
      pitGateStatus: 'NO_VISIBLE_SOURCE_ROW',
    };
  }
  return {
    readOnly: true, entersAlphaScore: false,
    visibilityGate: 'releaseDate <= asOfDate',
    sourceMatched: true, releaseDate: resolveReleaseDate(selected),
    revenueYear: selected.year, revenueMonth: selected.month, revenue: selected.revenue,
    yoyGrowth: selected.yoyGrowth ?? null, momGrowth: selected.momGrowth ?? null,
    sourceHash: `${selected.stockId}|${selected.year}|${selected.month}`,
    sourceMode, pitGateStatus: 'VISIBLE_RELEASE_DATE_GATE_PASS',
  };
}

function mapRow(corpusRow, sourceRows, sourceMode) {
  const symbol = corpusRow.symbol;
  const asOfDate = corpusRow.originalAsOfDate;
  const selected = selectLatest(sourceRows, symbol, asOfDate);
  const context = buildContext(selected, sourceMode);
  return { ...corpusRow, p26fMonthlyRevenueContext: context };
}

const testResults = [];

function runTest(name, fn) {
  try {
    const result = fn();
    testResults.push({ name, passed: result.passed, message: result.message || 'OK', details: result.details || null });
  } catch (e) {
    testResults.push({ name, passed: false, message: `EXCEPTION: ${e.message}`, details: null });
  }
}

// Test 1: releaseDate before asOfDate → visible
runTest('releaseDate_before_asOf', () => {
  const row = { stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: '2026-02-10T00:00:00Z' };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === true, message: `isVisible=${visible}, expected true` };
});

// Test 2: releaseDate after asOfDate → not visible
runTest('releaseDate_after_asOf', () => {
  const row = { stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: '2026-02-12T00:00:00Z' };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === false, message: `isVisible=${visible}, expected false` };
});

// Test 3: releaseDate = asOfDate → visible
runTest('releaseDate_equal_asOf', () => {
  const row = { stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: '2026-02-11T00:00:00Z' };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === true, message: `isVisible=${visible}, expected true` };
});

// Test 4: releaseDate null → not visible
runTest('releaseDate_null', () => {
  const row = { stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: null };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === false, message: `isVisible=${visible}, expected false` };
});

// Test 5: releaseDate undefined → not visible
runTest('releaseDate_undefined', () => {
  const row = { stockId: '2330', year: 2026, month: 1, revenue: 100 };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === false, message: `isVisible=${visible}, expected false` };
});

// Test 6: old year/month with future releaseDate → NOT visible
runTest('old_year_month_future_releaseDate', () => {
  const row = { stockId: '2330', year: 2025, month: 12, revenue: 100, releaseDate: '2026-03-01T00:00:00Z' };
  const visible = isVisible(row, '2026-02-11');
  return { passed: visible === false, message: `isVisible=${visible}, expected false (year/month do not grant visibility)` };
});

// Test 7: different symbol → no match
runTest('different_symbol', () => {
  const row = { stockId: '1101', year: 2026, month: 1, revenue: 100, releaseDate: '2026-01-10T00:00:00Z' };
  const selected = selectLatest([row], '2330', '2026-02-11');
  return { passed: selected === null, message: `selected=${JSON.stringify(selected)}, expected null` };
});

// Test 8: duplicate rows → select latest releaseDate
runTest('duplicate_latest_selected', () => {
  const rows = [
    { stockId: '2330', year: 2026, month: 1, revenue: 100, releaseDate: '2026-01-10T00:00:00Z' },
    { stockId: '2330', year: 2026, month: 2, revenue: 200, releaseDate: '2026-02-10T00:00:00Z' },
  ];
  const selected = selectLatest(rows, '2330', '2026-02-11');
  const rd = selected ? resolveReleaseDate(selected) : null;
  const passed = rd === '2026-02-10';
  return { passed, message: `latestReleaseDate=${rd}, expected 2026-02-10` };
});

// Test 9: no outcome fields in context
runTest('no_outcome_fields', () => {
  const ctx = buildContext(null, 'TEST');
  const forbidden = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
  const found = forbidden.filter(f => f in ctx);
  return { passed: found.length === 0, message: `forbidden fields found: ${JSON.stringify(found)}` };
});

// Test 10: entersAlphaScore=false
runTest('enters_alpha_score_false', () => {
  const ctx = buildContext(null, 'TEST');
  return { passed: ctx.entersAlphaScore === false, message: `entersAlphaScore=${ctx.entersAlphaScore}, expected false` };
});

// Test 11: readOnly=true
runTest('read_only_true', () => {
  const ctx = buildContext(null, 'TEST');
  return { passed: ctx.readOnly === true, message: `readOnly=${ctx.readOnly}, expected true` };
});

// Test 12: alphaScore preserved
runTest('alpha_score_preserved', () => {
  const corpusRow = { symbol: '2330', originalAsOfDate: '2026-02-11', activeScoringSnapshot: { alphaScore: 77 } };
  const mapped = mapRow(corpusRow, [], 'TEST');
  const preserved = mapped.activeScoringSnapshot && mapped.activeScoringSnapshot.alphaScore === 77;
  return { passed: preserved, message: `alphaScore=${mapped.activeScoringSnapshot ? mapped.activeScoringSnapshot.alphaScore : 'missing'}, expected 77` };
});

// Test 13: recommendationBucket preserved
runTest('bucket_preserved', () => {
  const corpusRow = { symbol: '2330', originalAsOfDate: '2026-02-11', researchBucket: 'HighPriority', activeScoringSnapshot: { alphaScore: 77 } };
  const mapped = mapRow(corpusRow, [], 'TEST');
  const preserved = mapped.researchBucket === 'HighPriority';
  return { passed: preserved, message: `researchBucket=${mapped.researchBucket}, expected HighPriority` };
});

const passed = testResults.filter(t => t.passed).length;
const failed = testResults.filter(t => !t.passed).length;
const allPassed = failed === 0;

const result = {
  phase: 'P26F-HARDRESET',
  totalTests: testResults.length,
  passedTests: passed,
  failedTests: failed,
  tests: testResults,
  allPassed,
  status: allPassed ? 'PIT_LEAKAGE_VALIDATION_PASS' : 'PIT_LEAKAGE_VALIDATION_FAIL',
};

fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2));

const rows = testResults.map(t => `| ${t.name} | ${t.passed ? '✅ PASS' : '❌ FAIL'} | ${t.message} |`).join('\n');
const md = `# P26F MonthlyRevenue PIT Leakage Validation

**Phase:** P26F-HARDRESET  
**Status:** ${result.status}

## Results: ${passed}/${testResults.length} PASS

| Test | Result | Message |
|---|---|---|
${rows}

## Conclusion

${allPassed ? 'All PIT leakage tests passed. releaseDate=null correctly blocks all matches.' : 'Some tests failed. See details above.'}

*Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.*
`;
fs.writeFileSync(RESULT_MD, md);

testResults.forEach(t => console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.name}: ${t.message}`));
console.log(`\nResult: ${passed}/${testResults.length} passed. Status: ${result.status}`);
console.log(`Output: ${RESULT_JSON}`);

if (!allPassed) process.exit(1);
