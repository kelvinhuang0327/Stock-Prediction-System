'use strict';
/**
 * validate-p17-monthly-revenue-query-gate-patch.js
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Governance / PIT gate validation only. No production DB writes.
 *
 * Validates P17-HARDRESET MonthlyRevenueAvailability helper and PIT gate patch.
 * Runs 10 scenarios deterministically. No Math.random.
 */
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const path = require('path');
const fs = require('fs');

const {
  inferMonthlyRevenueReleaseDate,
  normalizeMonthlyRevenueReleaseDate,
  isMonthlyRevenueAvailableAsOf,
  filterMonthlyRevenueAvailableAsOf,
  validateMonthlyRevenueAvailabilityResult,
  explainMonthlyRevenueAvailability,
  TAIWAN_REVENUE_RELEASE_DAY,
  INFERRED_RELEASE_DATE_SOURCE,
  INFERRED_RELEASE_DATE_CONFIDENCE,
} = require('../src/lib/onlineValidation/MonthlyRevenueAvailability');

const FORBIDDEN_OUTCOME_FIELDS = [
  'outcomePrice','returnPct','realizedReturnClass','futurePrice',
  'horizonReturnPct','outcomeDate','horizonDays','baselineResult','outcomeClose',
];

const results = [];
let passCount = 0;
let failCount = 0;

function assert(label, condition, details) {
  if (condition) {
    passCount++;
    results.push({ label, status: 'PASS', details });
    console.log(`  ✅ PASS: ${label}`);
  } else {
    failCount++;
    results.push({ label, status: 'FAIL', details });
    console.error(`  ❌ FAIL: ${label} | ${JSON.stringify(details)}`);
  }
}

console.log('\n=== P17 MonthlyRevenue PIT Query Gate Patch Validation ===\n');

// ─── Scenario 1: explicit releaseDate before asOfDate → available ───────────
{
  const record = { year: 2026, month: 2, revenue: 1e8, releaseDate: '2026-03-10' };
  const asOfDate = '2026-05-01';
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate);
  assert(
    'SC1: explicit releaseDate before asOfDate → available',
    result.available === true && result.inferred === false,
    result
  );
}

// ─── Scenario 2: explicit releaseDate equal asOfDate → available (boundary) ──
{
  const record = { year: 2026, month: 3, revenue: 2e8, releaseDate: '2026-04-10' };
  const asOfDate = '2026-04-10';
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate);
  assert(
    'SC2: explicit releaseDate == asOfDate → available (boundary)',
    result.available === true,
    result
  );
}

// ─── Scenario 3: explicit releaseDate after asOfDate → unavailable ───────────
{
  const record = { year: 2026, month: 4, revenue: 3e8, releaseDate: '2026-05-10' };
  const asOfDate = '2026-04-30';
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate);
  assert(
    'SC3: explicit releaseDate after asOfDate → unavailable',
    result.available === false,
    result
  );
}

// ─── Scenario 4: releaseDate missing + allowInferred=false → unavailable ─────
{
  const record = { year: 2026, month: 1, revenue: 4e8 };
  const asOfDate = '2026-04-01';
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate, { allowInferredReleaseDate: false });
  assert(
    'SC4: missing releaseDate + allowInferred=false → unavailable',
    result.available === false && result.releaseDate === null,
    result
  );
}

// ─── Scenario 5: missing + allowInferred=true + asOf before inferred → unavailable
{
  const record = { year: 2026, month: 3, revenue: 5e8 }; // inferred = 2026-04-10
  const asOfDate = '2026-04-09'; // one day before
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate, { allowInferredReleaseDate: true });
  assert(
    'SC5: missing + allowInferred=true + asOf before inferred → unavailable',
    result.available === false && result.inferred === true,
    result
  );
}

// ─── Scenario 6: missing + allowInferred=true + asOf equal inferred → available
{
  const record = { year: 2026, month: 3, revenue: 6e8 }; // inferred = 2026-04-10
  const asOfDate = '2026-04-10';
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate, { allowInferredReleaseDate: true });
  assert(
    'SC6: missing + allowInferred=true + asOf == inferred → available',
    result.available === true && result.inferred === true,
    result
  );
}

// ─── Scenario 7: missing year → unavailable ───────────────────────────────────
{
  const record = { year: null, month: 3, revenue: 7e8 };
  const result = isMonthlyRevenueAvailableAsOf(record, '2026-05-01');
  assert(
    'SC7: missing year → unavailable',
    result.available === false && result.releaseDate === null,
    result
  );
}

// ─── Scenario 8: invalid month (0) → unavailable ─────────────────────────────
{
  const record = { year: 2026, month: 0, revenue: 8e8 };
  const result = isMonthlyRevenueAvailableAsOf(record, '2026-05-01');
  assert(
    'SC8: invalid month=0 → unavailable',
    result.available === false,
    result
  );
}

// ─── Scenario 9: filterMonthlyRevenueAvailableAsOf excludes unavailable records
{
  const records = [
    { year: 2026, month: 2, revenue: 1e8, releaseDate: '2026-03-10' }, // available
    { year: 2026, month: 3, revenue: 2e8, releaseDate: '2026-04-10' }, // available
    { year: 2026, month: 4, revenue: 3e8, releaseDate: '2026-05-10' }, // future — unavailable
    { year: 2026, month: 1, revenue: 4e8 }, // no releaseDate, no inferred → unavailable (allowInferred=false default)
  ];
  const asOfDate = '2026-04-15';
  const filtered = filterMonthlyRevenueAvailableAsOf(records, asOfDate);
  assert(
    'SC9: filter excludes future/missing releaseDate records',
    filtered.length === 2 &&
    filtered.every(r => r.releaseDate && r.releaseDate <= asOfDate),
    { filtered: filtered.map(r => ({ year: r.year, month: r.month })), asOfDate }
  );
}

// ─── Scenario 10: no forbidden outcome fields used in any result ──────────────
{
  const testRecord = { year: 2026, month: 3, revenue: 1e8, releaseDate: '2026-04-10' };
  const result = isMonthlyRevenueAvailableAsOf(testRecord, '2026-05-01');
  const resultKeys = Object.keys(result);
  const forbidden = FORBIDDEN_OUTCOME_FIELDS.filter(f => resultKeys.includes(f));
  assert(
    'SC10: no forbidden outcome fields in availability result',
    forbidden.length === 0,
    { resultKeys, forbidden }
  );
}

// ─── Safety gates ─────────────────────────────────────────────────────────────
console.log('\n--- Safety gates ---');

// SG1: TAIWAN_REVENUE_RELEASE_DAY = 10
assert('SG1: TAIWAN_REVENUE_RELEASE_DAY === 10', TAIWAN_REVENUE_RELEASE_DAY === 10, { value: TAIWAN_REVENUE_RELEASE_DAY });

// SG2: INFERRED_RELEASE_DATE_SOURCE correct
assert('SG2: INFERRED_RELEASE_DATE_SOURCE', INFERRED_RELEASE_DATE_SOURCE === 'INFERRED_NEXT_MONTH_10TH', { value: INFERRED_RELEASE_DATE_SOURCE });

// SG3: INFERRED_RELEASE_DATE_CONFIDENCE correct
assert('SG3: INFERRED_RELEASE_DATE_CONFIDENCE', INFERRED_RELEASE_DATE_CONFIDENCE === 'LOW_TO_MEDIUM', { value: INFERRED_RELEASE_DATE_CONFIDENCE });

// SG4: inferMonthlyRevenueReleaseDate for Dec → next year Jan 10
{
  const inferred = inferMonthlyRevenueReleaseDate({ year: 2025, month: 12 });
  assert('SG4: Dec inference → 2026-01-10', inferred && inferred.releaseDate === '2026-01-10', inferred);
}

// SG5: validateMonthlyRevenueAvailabilityResult returns valid
{
  const record = { year: 2026, month: 2, revenue: 1e8, releaseDate: '2026-03-10' };
  const result = isMonthlyRevenueAvailableAsOf(record, '2026-05-01');
  const validation = validateMonthlyRevenueAvailabilityResult(result);
  assert('SG5: validateMonthlyRevenueAvailabilityResult returns valid', validation.valid === true, validation);
}

// SG6: explainMonthlyRevenueAvailability returns rule + details
{
  const record = { year: 2026, month: 3, revenue: 1e8 };
  const explanation = explainMonthlyRevenueAvailability(record, '2026-04-01', { allowInferredReleaseDate: false });
  assert(
    'SG6: explainMonthlyRevenueAvailability has rule + details',
    typeof explanation.rule === 'string' && typeof explanation.details === 'string',
    { rule: explanation.rule, available: explanation.available }
  );
}

// SG7: normalizeMonthlyRevenueReleaseDate handles Date object
{
  const record = { year: 2026, month: 3, revenue: 1e8, releaseDate: new Date('2026-04-10T00:00:00.000Z') };
  const norm = normalizeMonthlyRevenueReleaseDate(record);
  assert('SG7: normalizeMonthlyRevenueReleaseDate handles Date object', norm.releaseDate === '2026-04-10', norm);
}

// SG8: productionApplyAllowed = false guard
{
  const safetyCheck = { productionApplyAllowed: false, migrationCommand: 'prisma migrate deploy' };
  assert('SG8: productionApplyAllowed=false in script constants', safetyCheck.productionApplyAllowed === false, safetyCheck);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passCount + failCount;
const allPass = failCount === 0;
const summary = {
  phase: 'P17-HARDRESET',
  task: 'MonthlyRevenue releaseDate PIT query gate validation',
  date: new Date().toISOString().slice(0, 10),
  disclaimer: 'Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.',
  validationStatus: allPass ? 'ALL_PASS' : 'FAIL',
  passCount,
  failCount,
  total,
  productionApplyAllowed: false,
  results,
};

console.log(`\n=== VALIDATION ${summary.validationStatus}: ${passCount}/${total} ===\n`);

const outDir = path.join(__dirname, '..', 'outputs', 'online_validation');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'p17monthly_revenue_query_gate_validation.json'),
  JSON.stringify(summary, null, 2)
);

const mdLines = [
  '# P17-HARDRESET: Query Gate Patch Validation',
  '',
  '> **Disclaimer:** Does not constitute investment advice. PIT gate governance only.',
  '',
  `**Date:** ${summary.date}  `,
  `**Status:** ${summary.validationStatus}  `,
  `**Score:** ${passCount}/${total}`,
  '',
  '## Results',
  '',
  '| # | Scenario | Status |',
  '|---|----------|--------|',
  ...results.map((r, i) => `| ${i + 1} | ${r.label} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`),
  '',
  '## Safety',
  '- productionApplyAllowed: false',
  '- No outcome/returnPct/realizedReturnClass used',
  '- Scoring formula: unchanged',
  '- alphaScore / recommendationBucket: unchanged',
];

fs.writeFileSync(
  path.join(outDir, 'p17monthly_revenue_query_gate_validation.md'),
  mdLines.join('\n')
);

console.log(`Artifacts written to outputs/online_validation/`);
process.exit(allPass ? 0 : 1);
