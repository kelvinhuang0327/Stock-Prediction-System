'use strict';
/**
 * P14-HARDRESET PART E: Fixture-Only Dry-Run Validation
 *
 * Validates the P14 migration draft and query gate contract against
 * in-memory fixture MonthlyRevenue records.
 *
 * Does NOT query production DB. Does NOT modify any corpus or schema.
 *
 * Disclaimer: Does not constitute investment advice.
 * No ROI/profit/alpha/win-rate claims.
 */

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', esModuleInterop: true },
});
require('tsconfig-paths').register({
  baseUrl: require('path').resolve(__dirname, '..'),
  paths: { '@/*': ['src/*'] },
});

const fs = require('fs');
const path = require('path');
const {
  validateMonthlyRevenueQueryGate,
  buildMonthlyRevenueQueryGateContract,
  buildMonthlyRevenueMigrationDraft,
  buildMonthlyRevenueRollbackDraft,
  validateMigrationDraftSafety,
} = require('../src/lib/onlineValidation/P14MonthlyRevenueMigrationGateUtils');

const OUTPUTS_DIR = 'outputs/online_validation';

// ── Fixture Records (no DB) ────────────────────────────────────────────────────

const FIXTURES = [
  // Case 1: explicit releaseDate = 2024-02-10, asOf=2024-02-09 → unavailable
  {
    id: 'TC-01',
    description: 'explicit releaseDate=2024-02-10, asOf=2024-02-09 → unavailable',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000, releaseDate: '2024-02-10' },
    asOfDate: '2024-02-09',
    options: { allowInferredReleaseDate: true },
    expected: { available: false, releaseDateSource: 'AUTHORITATIVE' },
  },
  // Case 2: explicit releaseDate = 2024-02-10, asOf=2024-02-10 → available
  {
    id: 'TC-02',
    description: 'explicit releaseDate=2024-02-10, asOf=2024-02-10 → available',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000, releaseDate: '2024-02-10' },
    asOfDate: '2024-02-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'AUTHORITATIVE' },
  },
  // Case 3: missing releaseDate, allowInferred=true, year=2024 month=1 → inferred=2024-02-10
  {
    id: 'TC-03',
    description: 'missing releaseDate, allowInferred=true, year=2024 month=1, asOf=2024-02-10 → available',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000 },
    asOfDate: '2024-02-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'INFERRED_NEXT_MONTH_10TH' },
  },
  // Case 4: missing releaseDate, allowInferred=false → unavailable
  {
    id: 'TC-04',
    description: 'missing releaseDate, allowInferred=false → unavailable',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000 },
    asOfDate: '2024-02-15',
    options: { allowInferredReleaseDate: false },
    expected: { available: false, releaseDateSource: 'MISSING', gateResult: 'UNAVAILABLE_INFERRED_NOT_ALLOWED' },
  },
  // Case 5: Dec 2024 → inferred releaseDate = 2025-01-10
  {
    id: 'TC-05',
    description: 'Dec 2024: inferred releaseDate=2025-01-10, asOf=2025-01-10 → available',
    record: { stockId: 'TST', year: 2024, month: 12, revenue: 2000000 },
    asOfDate: '2025-01-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'INFERRED_NEXT_MONTH_10TH' },
  },
  // Case 6: missing year/month → unavailable
  {
    id: 'TC-06',
    description: 'missing year/month → unavailable',
    record: { stockId: 'TST', revenue: 1000000 },
    asOfDate: '2024-02-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: false, gateResult: 'UNAVAILABLE_MISSING_PERIOD' },
  },
  // Case 7: invalid releaseDate → unavailable
  {
    id: 'TC-07',
    description: 'invalid releaseDate format → unavailable',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000, releaseDate: 'not-a-date' },
    asOfDate: '2024-02-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: false, releaseDateSource: 'INVALID', gateResult: 'UNAVAILABLE_INVALID_RELEASE_DATE' },
  },
  // Case 8: outcomePrice / returnPct / realizedReturnClass present → flagged forbidden
  {
    id: 'TC-08',
    description: 'record with forbidden outcome fields → flagged, but gate still evaluates normally',
    record: { stockId: 'TST', year: 2024, month: 1, revenue: 1000000, releaseDate: '2024-02-10', outcomePrice: 150.0, returnPct: 0.05, realizedReturnClass: 'GAIN' },
    asOfDate: '2024-02-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'AUTHORITATIVE', forbiddenOutcomeFieldsPresent: ['outcomePrice', 'returnPct', 'realizedReturnClass'] },
  },
  // Case 9: releaseDateSource AUTHORITATIVE vs INFERRED flow correct
  {
    id: 'TC-09',
    description: 'AUTHORITATIVE releaseDate set → source=AUTHORITATIVE, confidence=HIGH',
    record: { stockId: 'TST', year: 2024, month: 2, revenue: 1200000, releaseDate: '2024-03-08' },
    asOfDate: '2024-03-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'AUTHORITATIVE', confidence: 'HIGH' },
  },
  {
    id: 'TC-09b',
    description: 'inferred releaseDate → source=INFERRED_NEXT_MONTH_10TH, confidence=LOW_TO_MEDIUM',
    record: { stockId: 'TST', year: 2024, month: 2, revenue: 1200000 },
    asOfDate: '2024-03-10',
    options: { allowInferredReleaseDate: true },
    expected: { available: true, releaseDateSource: 'INFERRED_NEXT_MONTH_10TH', confidence: 'LOW_TO_MEDIUM' },
  },
  // Case 10: rollback draft exists
  {
    id: 'TC-10',
    description: 'rollback draft exists and productionApplyAllowed=false',
    record: null, // not a gate check
    asOfDate: null,
    options: {},
    expected: { rollbackDraftExists: true, rollbackProductionApplyAllowed: false },
    isMetaCheck: true,
  },
];

function runFixtureCase(tc) {
  if (tc.isMetaCheck) {
    // TC-10: rollback draft check
    const rollback = buildMonthlyRevenueRollbackDraft();
    const pass =
      rollback.rollbackStrategyA &&
      rollback.rollbackStrategyB &&
      rollback.productionApplyAllowed === false;
    return {
      id: tc.id,
      description: tc.description,
      status: pass ? 'PASS' : 'FAIL',
      result: { rollbackDraftExists: !!(rollback.rollbackStrategyA && rollback.rollbackStrategyB), rollbackProductionApplyAllowed: rollback.productionApplyAllowed },
      expected: tc.expected,
      errors: pass ? [] : ['Rollback draft missing or productionApplyAllowed is not false'],
    };
  }

  const result = validateMonthlyRevenueQueryGate(tc.record, tc.asOfDate, tc.options);
  const errors = [];

  if (result.available !== tc.expected.available) {
    errors.push(`available: expected ${tc.expected.available}, got ${result.available}`);
  }
  if (tc.expected.releaseDateSource !== undefined && result.releaseDateSource !== tc.expected.releaseDateSource) {
    errors.push(`releaseDateSource: expected ${tc.expected.releaseDateSource}, got ${result.releaseDateSource}`);
  }
  if (tc.expected.gateResult !== undefined && result.gateResult !== tc.expected.gateResult) {
    errors.push(`gateResult: expected ${tc.expected.gateResult}, got ${result.gateResult}`);
  }
  if (tc.expected.confidence !== undefined && result.confidence !== tc.expected.confidence) {
    errors.push(`confidence: expected ${tc.expected.confidence}, got ${result.confidence}`);
  }
  if (tc.expected.forbiddenOutcomeFieldsPresent !== undefined) {
    const expectedForbidden = tc.expected.forbiddenOutcomeFieldsPresent.sort().join(',');
    const actualForbidden = (result.forbiddenOutcomeFieldsPresent || []).sort().join(',');
    if (expectedForbidden !== actualForbidden) {
      errors.push(`forbiddenOutcomeFieldsPresent: expected [${expectedForbidden}], got [${actualForbidden}]`);
    }
  }

  return {
    id: tc.id,
    description: tc.description,
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    result: {
      available: result.available,
      gateResult: result.gateResult,
      reason: result.reason,
      releaseDateUsed: result.releaseDateUsed,
      releaseDateSource: result.releaseDateSource,
      confidence: result.confidence,
      forbiddenOutcomeFieldsPresent: result.forbiddenOutcomeFieldsPresent,
    },
    expected: tc.expected,
    errors,
  };
}

function run() {
  console.log('\n=== P14 PART E: Fixture-Only Dry-Run Validation ===\n');

  // Verify migration draft safety
  const draft = buildMonthlyRevenueMigrationDraft();
  const safety = validateMigrationDraftSafety(draft);
  console.log('Migration draft safety:', safety.status);
  if (!safety.safe) {
    console.error('Migration draft safety check FAILED:', safety.errors);
    process.exit(1);
  }

  // Load query gate contract
  const contract = buildMonthlyRevenueQueryGateContract({ allowInferredReleaseDate: true });
  console.log('Query gate contract:', contract.contractId, '— rules:', contract.rules.length);

  // Run fixture cases
  const results = FIXTURES.map(tc => {
    const r = runFixtureCase(tc);
    const icon = r.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${r.id}: ${r.description}`);
    if (r.errors.length) r.errors.forEach(e => console.log(`      ERROR: ${e}`));
    return r;
  });

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const validationStatus = failed === 0 ? 'PASS' : passed > 0 ? 'PARTIAL' : 'FAIL';

  console.log(`\nResults: ${passed}/${total} PASS, ${failed} FAIL`);
  console.log(`Validation status: ${validationStatus}`);

  const output = {
    phase: 'P14',
    part: 'E',
    generatedAt: new Date().toISOString(),
    validationStatus,
    total,
    passed,
    failed,
    migrationDraftSafety: safety.status,
    queryGateContractId: contract.contractId,
    testCases: results,
    productionDbWritten: false,
    productionApplyAllowed: false,
    nonGoals: [
      'Does not query production DB.',
      'Does not modify corpus or schema.',
      'Does not compute ROI, profit, win-rate, or alpha.',
      'Does not constitute investment advice.',
      'Fixtures are in-memory only.',
    ],
  };

  const jsonPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_fixture_dry_run.json');
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf8');
  console.log('\nWrote:', jsonPath);

  const md = `# P14-HARDRESET: Fixture-Only Dry-Run Validation

> **Disclaimer:** Fixture-only validation. Does not query production DB. Does not constitute investment advice.

**Generated:** ${output.generatedAt}
**Validation Status:** ${validationStatus}
**Results:** ${passed}/${total} PASS — ${failed} FAIL

---

## Migration Draft Safety

| Status |
|--------|
| ${safety.status} |

## Query Gate Contract

**Contract ID:** ${contract.contractId}

## Test Cases

| ID | Description | Status |
|----|-------------|--------|
${results.map(r => `| ${r.id} | ${r.description} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`).join('\n')}

${results.filter(r => r.status === 'FAIL').length > 0 ? `
## Failures

${results.filter(r => r.status === 'FAIL').map(r => `- **${r.id}**: ${r.errors.join('; ')}`).join('\n')}
` : ''}

## Non-Goals

${output.nonGoals.map(g => `- ${g}`).join('\n')}
`;

  const mdPath = path.join(OUTPUTS_DIR, 'p14monthly_revenue_fixture_dry_run.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log('Wrote:', mdPath);

  if (validationStatus === 'FAIL') {
    process.exit(1);
  }

  console.log('\n✓ PART E complete.');
}

run();
