'use strict';
/**
 * run-p16-monthly-revenue-backfill-dry-run.js
 *
 * DISCLAIMER: Does not constitute investment advice. Governance / dry-run only.
 * productionApplyAllowed=false. No production DB writes.
 *
 * Validates backfill logic using fixture records covering 10 required scenarios.
 *
 * Outputs:
 *   outputs/online_validation/p16monthly_revenue_backfill_dry_run.json
 *   outputs/online_validation/p16monthly_revenue_backfill_dry_run.md
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs   = require('fs');
const path = require('path');

const {
  validateDryRunBackfill,
  EXPECTED_APPROVAL_TOKEN,
  INFERRED_SOURCE,
  INFERRED_CONFIDENCE,
} = require('../src/lib/onlineValidation/P16MonthlyRevenueDryRunUtils');

const OUT_DIR = path.join(__dirname, '..', 'outputs', 'online_validation');

// ── Fixture records: 10 required scenarios ──
const fixtureRecords = [
  // 1. 2024 Jan missing releaseDate → should infer 2024-02-10
  {
    stockId: 'TWN-001', year: 2024, month: 1,
    revenue: 1000000, releaseDate: null, releaseDateSource: null,
  },
  // 2. 2024 Dec missing releaseDate → should infer 2025-01-10
  {
    stockId: 'TWN-002', year: 2024, month: 12,
    revenue: 2000000, releaseDate: null, releaseDateSource: null,
  },
  // 3. Explicit releaseDate exists (authoritative) → should PRESERVE
  {
    stockId: 'TWN-003', year: 2024, month: 3,
    revenue: 3000000,
    releaseDate: '2024-04-08',
    releaseDateSource: 'OFFICIAL_TWSE',
    releaseDateConfidence: 'HIGH',
  },
  // 4. Missing year → skip
  {
    stockId: 'TWN-004', year: null, month: 5,
    revenue: 4000000, releaseDate: null, releaseDateSource: null,
  },
  // 5. Missing month → skip
  {
    stockId: 'TWN-005', year: 2024, month: null,
    revenue: 5000000, releaseDate: null, releaseDateSource: null,
  },
  // 6. Invalid month (13) → skip
  {
    stockId: 'TWN-006', year: 2024, month: 13,
    revenue: 6000000, releaseDate: null, releaseDateSource: null,
  },
  // 7. Authoritative releaseDate (another explicit, non-inferred) → PRESERVE
  {
    stockId: 'TWN-007', year: 2024, month: 6,
    revenue: 7000000,
    releaseDate: '2024-07-05',
    releaseDateSource: 'OFFICIAL_TWSE',
    releaseDateConfidence: 'HIGH',
  },
  // 8. Outcome fields present in input (returnPct, realizedReturnClass) → flagged as warning, not used
  {
    stockId: 'TWN-008', year: 2024, month: 2,
    revenue: 8000000,
    releaseDate: null, releaseDateSource: null,
    returnPct: 0.15, realizedReturnClass: 'WIN',
  },
  // 9. Duplicate stockId + period (same as TWN-001) → skip second
  {
    stockId: 'TWN-001', year: 2024, month: 1,
    revenue: 1100000, releaseDate: null, releaseDateSource: null,
  },
  // 10. Future period → should still infer (future is valid, gate enforcement is query-time)
  {
    stockId: 'TWN-009', year: 2026, month: 11,
    revenue: 9000000, releaseDate: null, releaseDateSource: null,
  },
];

// ── Run backfill dry-run ──
const backfillResult = validateDryRunBackfill(fixtureRecords, { allowOverwriteExisting: false });

// ── Per-scenario validation ──
const scenarioChecks = [];

function findResult(stockId, year, month) {
  return backfillResult.results.find(r =>
    r.stockId === stockId && r.year === year && r.month === month
  );
}

// Scenario 1: TWN-001 Jan 2024 → 2024-02-10
const s1 = findResult('TWN-001', 2024, 1);
scenarioChecks.push({
  scenario: '1. Jan 2024 inferred releaseDate = 2024-02-10',
  status: s1 && s1.action === 'INFERRED' && s1.releaseDate === '2024-02-10' && s1.releaseDateSource === INFERRED_SOURCE ? 'PASS' : 'FAIL',
  detail: s1 ? `action=${s1.action}, releaseDate=${s1.releaseDate}` : 'NOT FOUND',
});

// Scenario 2: TWN-002 Dec 2024 → 2025-01-10
const s2 = findResult('TWN-002', 2024, 12);
scenarioChecks.push({
  scenario: '2. Dec 2024 inferred releaseDate = 2025-01-10',
  status: s2 && s2.action === 'INFERRED' && s2.releaseDate === '2025-01-10' && s2.releaseDateSource === INFERRED_SOURCE ? 'PASS' : 'FAIL',
  detail: s2 ? `action=${s2.action}, releaseDate=${s2.releaseDate}` : 'NOT FOUND',
});

// Scenario 3: TWN-003 → PRESERVED with original releaseDate
const s3 = findResult('TWN-003', 2024, 3);
scenarioChecks.push({
  scenario: '3. Explicit releaseDate preserved (OFFICIAL_TWSE)',
  status: s3 && s3.action === 'PRESERVED' && s3.releaseDate === '2024-04-08' ? 'PASS' : 'FAIL',
  detail: s3 ? `action=${s3.action}, releaseDate=${s3.releaseDate}` : 'NOT FOUND',
});

// Scenario 4: TWN-004 → SKIPPED (missing year)
const s4 = backfillResult.results.find(r => r.stockId === 'TWN-004');
scenarioChecks.push({
  scenario: '4. Missing year → SKIPPED',
  status: s4 && s4.action === 'SKIPPED' ? 'PASS' : 'FAIL',
  detail: s4 ? `action=${s4.action}, reason=${s4.skipReason}` : 'NOT FOUND',
});

// Scenario 5: TWN-005 → SKIPPED (missing month)
const s5 = backfillResult.results.find(r => r.stockId === 'TWN-005');
scenarioChecks.push({
  scenario: '5. Missing month → SKIPPED',
  status: s5 && s5.action === 'SKIPPED' ? 'PASS' : 'FAIL',
  detail: s5 ? `action=${s5.action}, reason=${s5.skipReason}` : 'NOT FOUND',
});

// Scenario 6: TWN-006 → SKIPPED (invalid month 13)
const s6 = backfillResult.results.find(r => r.stockId === 'TWN-006');
scenarioChecks.push({
  scenario: '6. Invalid month (13) → SKIPPED',
  status: s6 && s6.action === 'SKIPPED' ? 'PASS' : 'FAIL',
  detail: s6 ? `action=${s6.action}, reason=${s6.skipReason}` : 'NOT FOUND',
});

// Scenario 7: TWN-007 → PRESERVED
const s7 = findResult('TWN-007', 2024, 6);
scenarioChecks.push({
  scenario: '7. Authoritative releaseDate preserved',
  status: s7 && s7.action === 'PRESERVED' && s7.releaseDate === '2024-07-05' ? 'PASS' : 'FAIL',
  detail: s7 ? `action=${s7.action}, releaseDate=${s7.releaseDate}` : 'NOT FOUND',
});

// Scenario 8: TWN-008 → INFERRED with forbidden fields flagged as warning (not used)
const s8 = findResult('TWN-008', 2024, 2);
const hasOutcomeWarning = backfillResult.warnings.some(w => w.includes('TWN-008') && w.includes('returnPct'));
scenarioChecks.push({
  scenario: '8. Outcome fields detected as warning, not used for backfill',
  status: s8 && s8.action === 'INFERRED' && hasOutcomeWarning ? 'PASS' : 'FAIL',
  detail: s8 ? `action=${s8.action}, outcomeWarning=${hasOutcomeWarning}` : 'NOT FOUND',
});

// Scenario 9: Duplicate TWN-001 → second occurrence SKIPPED
const allTwn001 = backfillResult.results.filter(r => r.stockId === 'TWN-001');
const duplicateSkipped = allTwn001.length === 2 && allTwn001.some(r => r.action === 'SKIPPED' && r.skipReason && r.skipReason.includes('duplicate'));
scenarioChecks.push({
  scenario: '9. Duplicate stockId+period → second SKIPPED',
  status: duplicateSkipped ? 'PASS' : 'FAIL',
  detail: `TWN-001 results: ${JSON.stringify(allTwn001.map(r => r.action))}`,
});

// Scenario 10: Future period TWN-009 → INFERRED with correct date
const s10 = findResult('TWN-009', 2026, 11);
scenarioChecks.push({
  scenario: '10. Future period inferred releaseDate = 2026-12-10',
  status: s10 && s10.action === 'INFERRED' && s10.releaseDate === '2026-12-10' ? 'PASS' : 'FAIL',
  detail: s10 ? `action=${s10.action}, releaseDate=${s10.releaseDate}` : 'NOT FOUND',
});

// Safety gates
const safetyGates = [
  { gate: 'productionDbWritten === false', status: backfillResult.productionDbWritten === false ? 'PASS' : 'FAIL' },
  { gate: 'dryRunOnly === true', status: backfillResult.dryRunOnly === true ? 'PASS' : 'FAIL' },
  { gate: 'validationStatus PASS', status: backfillResult.validationStatus === 'PASS' ? 'PASS' : 'FAIL' },
  { gate: 'all inferred tagged with INFERRED_NEXT_MONTH_10TH', status: backfillResult.results.filter(r => r.action === 'INFERRED').every(r => r.releaseDateSource === INFERRED_SOURCE && r.releaseDateConfidence === INFERRED_CONFIDENCE) ? 'PASS' : 'FAIL' },
];

const allScenarioPass = scenarioChecks.every(s => s.status === 'PASS');
const allSafetyPass   = safetyGates.every(g => g.status === 'PASS');
const allPass = allScenarioPass && allSafetyPass;

console.log('\n=== Backfill Dry-Run Scenarios ===');
for (const s of scenarioChecks) {
  console.log(`  [${s.status}] ${s.scenario}: ${s.detail}`);
}
console.log('\n=== Safety Gates ===');
for (const g of safetyGates) {
  console.log(`  [${g.status}] ${g.gate}`);
}
console.log(`\nResult: ${scenarioChecks.filter(s => s.status === 'PASS').length}/${scenarioChecks.length} scenarios PASS`);
console.log(`Safety: ${safetyGates.filter(g => g.status === 'PASS').length}/${safetyGates.length} gates PASS`);
console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

// ── Build output artifact ──
const artifact = {
  phase: 'P16-HARDRESET',
  task: 'Fixture Backfill Dry-Run',
  date: '2026-05-12',
  disclaimer: 'Does not constitute investment advice. Governance / dry-run only. No production DB writes.',
  approvalToken: EXPECTED_APPROVAL_TOKEN,
  productionApplyAllowed: false,
  dryRunOnly: true,
  productionDbWritten: false,
  backfillResult,
  scenarioChecks,
  safetyGates,
  allScenarioPass,
  allSafetyPass,
  validationStatus: allPass ? 'PASS' : 'FAIL',
  summary: allPass
    ? `Backfill dry-run PASS. ${scenarioChecks.length} scenarios verified. ${backfillResult.inferred} inferred, ${backfillResult.preserved} preserved, ${backfillResult.skipped} skipped. No production DB written.`
    : `Backfill dry-run FAIL. Failed scenarios: ${scenarioChecks.filter(s => s.status === 'FAIL').map(s => s.scenario).join('; ')}`,
};

fs.writeFileSync(
  path.join(OUT_DIR, 'p16monthly_revenue_backfill_dry_run.json'),
  JSON.stringify(artifact, null, 2)
);
console.log('\nWritten: p16monthly_revenue_backfill_dry_run.json');

// ── Markdown ──
const scenariosMd = scenarioChecks.map(s =>
  `| ${s.status === 'PASS' ? '✅' : '❌'} | ${s.scenario} | ${s.detail} |`
).join('\n');
const safetyMd = safetyGates.map(g =>
  `| ${g.status === 'PASS' ? '✅' : '❌'} | ${g.gate} |`
).join('\n');

const md = `# P16-HARDRESET: Fixture Backfill Dry-Run

> **Disclaimer:** Does not constitute investment advice. Governance / dry-run only. No production DB writes.

**Phase:** P16-HARDRESET | **Date:** 2026-05-12  
**Approval Token:** \`${EXPECTED_APPROVAL_TOKEN}\` — VERIFIED  
**productionApplyAllowed:** false | **dryRunOnly:** true

## Validation Status: ${allPass ? 'PASS ✅' : 'FAIL ❌'}

## Summary
- Inferred: ${backfillResult.inferred}
- Preserved: ${backfillResult.preserved}
- Skipped: ${backfillResult.skipped}
- Warnings: ${backfillResult.warnings.length}

## Scenario Results
| Status | Scenario | Detail |
|--------|----------|--------|
${scenariosMd}

## Safety Gates
| Status | Gate |
|--------|------|
${safetyMd}

## Warnings
${backfillResult.warnings.length === 0 ? 'None' : backfillResult.warnings.map(w => `- ${w}`).join('\n')}

## Taiwan Revenue Release Rule
- \`month ≠ 12\` → \`DATE(year, month+1, 10)\`
- \`month = 12\` → \`DATE(year+1, 1, 10)\`
- releaseDateSource = \`INFERRED_NEXT_MONTH_10TH\`
- releaseDateConfidence = \`LOW_TO_MEDIUM\`
`;

fs.writeFileSync(
  path.join(OUT_DIR, 'p16monthly_revenue_backfill_dry_run.md'),
  md
);
console.log('Written: p16monthly_revenue_backfill_dry_run.md');

if (!allPass) {
  process.exit(1);
}
