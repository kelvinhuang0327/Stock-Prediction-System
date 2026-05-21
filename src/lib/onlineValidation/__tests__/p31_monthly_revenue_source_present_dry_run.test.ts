/**
 * P31 — MonthlyRevenue Source-Present Dry-Run Tests
 *
 * Pure unit tests — no DB access, no side effects.
 *
 * DISCLAIMER: Tests for structural audit contract only.
 * Does not constitute investment advice.
 * MonthlyRevenue entersAlphaScore = false ALWAYS.
 */

import {
  MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION,
  MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER,
  MONTHLY_REVENUE_DRY_RUN_CONTRACT,
  validateContract,
  checkRowAgainstContract,
} from '../p31/MonthlyRevenueDryRunContract';

import {
  checkRowDryRunGate,
  buildDryRunBatchScanResult,
  buildDryRunGateScanFromCounts,
  type MonthlyRevenueRowMetadata,
} from '../p31/MonthlyRevenueSourcePresentDryRunGate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MonthlyRevenueRowMetadata> = {}): MonthlyRevenueRowMetadata {
  return {
    stockId: 'TEST01',
    year: 2026,
    month: 1,
    releaseDate: new Date('2026-02-10T00:00:00.000Z'),
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    releaseDateConfidence: 'LOW',
    ...overrides,
  };
}

// ─── T01 Contract ─────────────────────────────────────────────────────────────

describe('T01 Contract', () => {
  test('Contract has mode = "source-present-dry-run"', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.mode).toBe('source-present-dry-run');
  });

  test('Contract has dryRun = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.dryRun).toBe(true);
  });

  test('Contract has paperOnly = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.paperOnly).toBe(true);
  });

  test('Contract has entersAlphaScore = false', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.entersAlphaScore).toBe(false);
  });

  test('Contract has notInvestmentRecommendation = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.notInvestmentRecommendation).toBe(true);
  });

  test('Contract requiresReleaseDate = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.requiresReleaseDate).toBe(true);
  });

  test('Contract requiresReleaseDateSource = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.requiresReleaseDateSource).toBe(true);
  });

  test('Contract requiresReleaseDateConfidence = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.requiresReleaseDateConfidence).toBe(true);
  });

  test('validateContract returns valid=true for MONTHLY_REVENUE_DRY_RUN_CONTRACT', () => {
    const result = validateContract(MONTHLY_REVENUE_DRY_RUN_CONTRACT);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('forbiddenOutputFields includes alphaScore', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields).toContain('alphaScore');
  });

  test('forbiddenOutputFields includes prediction', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields).toContain('prediction');
  });

  test('forbiddenOutputFields includes recommendation', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields).toContain('recommendation');
  });

  test('forbiddenOutputFields includes signal', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields).toContain('signal');
  });

  test('forbiddenClaims includes all forbidden terms', () => {
    const expected = ['buy', 'sell', 'hold', 'ROI', 'win-rate', 'edge', 'profit', 'outperform'];
    for (const claim of expected) {
      expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenClaims).toContain(claim);
    }
  });
});

// ─── T02 Row Gate — BLOCKED cases ────────────────────────────────────────────

describe('T02 Row Gate — BLOCKED cases', () => {
  test('checkRowDryRunGate blocks when releaseDate is null', () => {
    const row = makeRow({ releaseDate: null });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE');
  });

  test('checkRowDryRunGate blocks when releaseDateSource is null', () => {
    const row = makeRow({ releaseDateSource: null });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE');
  });

  test('checkRowDryRunGate blocks when asOfDate is BEFORE releaseDate (future leakage)', () => {
    const row = makeRow({ releaseDate: new Date('2026-02-10T00:00:00.000Z') });
    const asOfDate = new Date('2026-01-15T00:00:00.000Z'); // before releaseDate
    const result = checkRowDryRunGate(row, asOfDate);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate blocks row that has returnPct field (leakage field)', () => {
    const row = makeRow({ returnPct: 0.05 } as MonthlyRevenueRowMetadata);
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate blocks row that has outcomePrice field', () => {
    const row = makeRow({ outcomePrice: 100 } as MonthlyRevenueRowMetadata);
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate blocks row that has realizedReturn field', () => {
    const row = makeRow({ realizedReturn: 0.1 } as MonthlyRevenueRowMetadata);
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate blocks when releaseDate == revenueMonth end date', () => {
    // Jan 2026 ends on 2026-01-31; releaseDate on 2026-01-31 should be blocked
    const row = makeRow({
      year: 2026,
      month: 1,
      releaseDate: new Date('2026-01-31T00:00:00.000Z'),
    });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });
});

// ─── T03 Row Gate — READY case ────────────────────────────────────────────────

describe('T03 Row Gate — READY case', () => {
  test('checkRowDryRunGate returns MONTHLY_REVENUE_DRY_RUN_READY when all conditions met', () => {
    const row = makeRow();
    const asOfDate = new Date('2026-02-15T00:00:00.000Z');
    const result = checkRowDryRunGate(row, asOfDate);
    expect(result.passes).toBe(true);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
  });

  test('passes result has entersAlphaScore = false', () => {
    const row = makeRow();
    const result = checkRowDryRunGate(row);
    expect(result.entersAlphaScore).toBe(false);
  });

  test('passes result has paperOnly = true', () => {
    const row = makeRow();
    const result = checkRowDryRunGate(row);
    expect(result.paperOnly).toBe(true);
  });

  test('passes result has dryRun = true', () => {
    const row = makeRow();
    const result = checkRowDryRunGate(row);
    expect(result.dryRun).toBe(true);
  });
});

// ─── T04 Batch Scan ───────────────────────────────────────────────────────────

describe('T04 Batch Scan', () => {
  test('buildDryRunBatchScanResult([]) returns zero counts correctly', () => {
    const result = buildDryRunBatchScanResult([]);
    expect(result.totalRows).toBe(0);
    expect(result.readyRows).toBe(0);
    expect(result.blockedRows).toBe(0);
    expect(result.overallClassification).toBe('MONTHLY_REVENUE_DRY_RUN_NOT_APPLICABLE');
  });

  test('buildDryRunBatchScanResult with all-ready rows → MONTHLY_REVENUE_DRY_RUN_READY', () => {
    const rows = [makeRow(), makeRow({ stockId: 'TEST02' }), makeRow({ stockId: 'TEST03' })];
    const result = buildDryRunBatchScanResult(rows);
    expect(result.overallClassification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
    expect(result.readyRows).toBe(3);
    expect(result.blockedRows).toBe(0);
  });

  test('buildDryRunBatchScanResult with one blocked row → blocked count = 1', () => {
    const rows = [
      makeRow(),
      makeRow({ releaseDate: null }),
      makeRow({ stockId: 'TEST03' }),
    ];
    const result = buildDryRunBatchScanResult(rows);
    expect(result.blockedRows).toBe(1);
    expect(result.readyRows).toBe(2);
  });

  test('buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143) → MONTHLY_REVENUE_DRY_RUN_READY, coveragePct=100', () => {
    const result = buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143);
    expect(result.overallClassification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
    expect(result.coveragePct).toBe(100);
    expect(result.totalRows).toBe(2143);
    expect(result.readyRows).toBe(2143);
    expect(result.blockedRows).toBe(0);
  });

  test('buildDryRunGateScanFromCounts(100, 50, 100, 100) → coveragePct=50', () => {
    const result = buildDryRunGateScanFromCounts(100, 50, 100, 100);
    expect(result.coveragePct).toBe(50);
    expect(result.blockedRows).toBe(50);
  });

  test('batch result entersAlphaScore = false', () => {
    const result = buildDryRunGateScanFromCounts(10, 10, 10, 10);
    expect(result.entersAlphaScore).toBe(false);
  });

  test('batch result paperOnly = true', () => {
    const result = buildDryRunGateScanFromCounts(10, 10, 10, 10);
    expect(result.paperOnly).toBe(true);
  });
});

// ─── T05 Contract Row Check ───────────────────────────────────────────────────

describe('T05 Contract Row Check', () => {
  test('checkRowAgainstContract rejects row with alphaScore field', () => {
    const result = checkRowAgainstContract({ alphaScore: 0.8 });
    expect(result.passes).toBe(false);
    expect(result.violations.some(v => v.includes('alphaScore'))).toBe(true);
  });

  test('checkRowAgainstContract rejects row with prediction field', () => {
    const result = checkRowAgainstContract({ prediction: 'up' });
    expect(result.passes).toBe(false);
    expect(result.violations.some(v => v.includes('prediction'))).toBe(true);
  });

  test('checkRowAgainstContract rejects row with recommendation field', () => {
    const result = checkRowAgainstContract({ recommendation: 'buy' });
    expect(result.passes).toBe(false);
    expect(result.violations.some(v => v.includes('recommendation'))).toBe(true);
  });

  test('checkRowAgainstContract passes row with only revenue metadata fields', () => {
    const result = checkRowAgainstContract({
      stockId: 'TEST01',
      year: 2026,
      month: 1,
      revenue: 12345678,
      releaseDate: '2026-02-10T00:00:00.000Z',
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
      releaseDateConfidence: 'LOW',
    });
    expect(result.passes).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test('passes result has entersAlphaScore = false', () => {
    const result = checkRowAgainstContract({ stockId: 'TEST01' });
    expect(result.entersAlphaScore).toBe(false);
  });
});

// ─── T06 Forbidden claims ─────────────────────────────────────────────────────

describe('T06 Forbidden claims', () => {
  test('MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER does not contain investment claims as positive assertions', () => {
    const disclaimer = MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER.toLowerCase();
    // Should only contain these terms in a prohibition/warning context
    // The disclaimer explicitly prohibits them, which is valid
    expect(disclaimer).toContain('does not constitute investment advice');
    expect(disclaimer).toContain('no profit');
    expect(disclaimer).toContain('must not be used');
  });

  test('Contract forbiddenClaims array contains buy, sell, hold, ROI, profit', () => {
    const claims = MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenClaims;
    expect(claims).toContain('buy');
    expect(claims).toContain('sell');
    expect(claims).toContain('hold');
    expect(claims).toContain('ROI');
    expect(claims).toContain('profit');
  });

  test('Contract forbiddenOutputFields contains alphaScore, prediction, recommendation', () => {
    const fields = MONTHLY_REVENUE_DRY_RUN_CONTRACT.forbiddenOutputFields;
    expect(fields).toContain('alphaScore');
    expect(fields).toContain('prediction');
    expect(fields).toContain('recommendation');
  });

  test('DryRunBatchScanResult disclaimer does not contain positive investment claims', () => {
    const result = buildDryRunGateScanFromCounts(10, 10, 10, 10);
    const disclaimer = result.disclaimer.toLowerCase();
    expect(disclaimer).toContain('does not constitute investment advice');
    expect(disclaimer).toContain('must not be used');
  });
});

// ─── T07 Determinism ─────────────────────────────────────────────────────────

describe('T07 Determinism', () => {
  test('MONTHLY_REVENUE_DRY_RUN_CONTRACT serializes to same JSON twice', () => {
    const json1 = JSON.stringify(MONTHLY_REVENUE_DRY_RUN_CONTRACT);
    const json2 = JSON.stringify(MONTHLY_REVENUE_DRY_RUN_CONTRACT);
    expect(json1).toBe(json2);
  });

  test('buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143) is deterministic', () => {
    const r1 = buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143);
    const r2 = buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143);
    expect(r1.overallClassification).toBe(r2.overallClassification);
    expect(r1.coveragePct).toBe(r2.coveragePct);
    expect(r1.readyRows).toBe(r2.readyRows);
    expect(r1.blockedRows).toBe(r2.blockedRows);
  });
});

// ─── T08 revenueMonth cannot be availabilityDate ──────────────────────────────

describe('T08 revenueMonth cannot be availabilityDate', () => {
  test('For revenue year=2026, month=1, releaseDate must be > 2026-01-31', () => {
    // Jan 31 = last day of Jan 2026
    const monthEnd = new Date('2026-01-31T00:00:00.000Z');
    const validReleaseDate = new Date('2026-02-10T00:00:00.000Z');
    expect(validReleaseDate > monthEnd).toBe(true);
  });

  test('checkRowDryRunGate with releaseDate = 2026-01-15 (during revenue month) → BLOCKED_LEAKAGE_RISK', () => {
    const row = makeRow({
      year: 2026,
      month: 1,
      releaseDate: new Date('2026-01-15T00:00:00.000Z'),
    });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate with releaseDate = 2026-02-10 (next month) → READY', () => {
    const row = makeRow({
      year: 2026,
      month: 1,
      releaseDate: new Date('2026-02-10T00:00:00.000Z'),
    });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(true);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
  });
});

// ─── T09 asOfDate ordering ────────────────────────────────────────────────────

describe('T09 asOfDate ordering', () => {
  test('checkRowDryRunGate with asOfDate before releaseDate → BLOCKED_LEAKAGE_RISK', () => {
    const row = makeRow({ releaseDate: new Date('2026-02-10T00:00:00.000Z') });
    const asOfDate = new Date('2026-02-05T00:00:00.000Z');
    const result = checkRowDryRunGate(row, asOfDate);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });

  test('checkRowDryRunGate with asOfDate equal to releaseDate → READY (edge case: >= is ok)', () => {
    const releaseDate = new Date('2026-02-10T00:00:00.000Z');
    const row = makeRow({ releaseDate });
    const asOfDate = new Date('2026-02-10T00:00:00.000Z');
    const result = checkRowDryRunGate(row, asOfDate);
    expect(result.passes).toBe(true);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
  });

  test('checkRowDryRunGate with asOfDate after releaseDate → READY', () => {
    const row = makeRow({ releaseDate: new Date('2026-02-10T00:00:00.000Z') });
    const asOfDate = new Date('2026-03-01T00:00:00.000Z');
    const result = checkRowDryRunGate(row, asOfDate);
    expect(result.passes).toBe(true);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
  });
});

// ─── Additional edge case tests ───────────────────────────────────────────────

describe('T10 Additional edge cases', () => {
  test('Contract version string starts with p31-', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION).toMatch(/^p31-/);
  });

  test('Contract sourceName is MonthlyRevenue', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.sourceName).toBe('MonthlyRevenue');
  });

  test('Contract rejectsRevenueMonthAsAvailabilityDate = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.rejectsRevenueMonthAsAvailabilityDate).toBe(true);
  });

  test('Contract rejectsTargetLeakageFields = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.rejectsTargetLeakageFields).toBe(true);
  });

  test('Contract rejectsFutureLookingFields = true', () => {
    expect(MONTHLY_REVENUE_DRY_RUN_CONTRACT.rejectsFutureLookingFields).toBe(true);
  });

  test('validateContract catches invalid entersAlphaScore', () => {
    const badContract = { ...MONTHLY_REVENUE_DRY_RUN_CONTRACT, entersAlphaScore: true as unknown as false };
    const result = validateContract(badContract);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('entersAlphaScore'))).toBe(true);
  });

  test('buildDryRunGateScanFromCounts returns dryRun=true', () => {
    const result = buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143);
    expect(result.dryRun).toBe(true);
  });

  test('buildDryRunGateScanFromCounts returns version string', () => {
    const result = buildDryRunGateScanFromCounts(2143, 2143, 2143, 2143);
    expect(typeof result.version).toBe('string');
    expect(result.version.length).toBeGreaterThan(0);
  });

  test('buildDryRunBatchScanResult with no asOfDate — rows without leakage fields pass', () => {
    const rows = [
      makeRow({ stockId: 'A' }),
      makeRow({ stockId: 'B' }),
    ];
    const result = buildDryRunBatchScanResult(rows);
    expect(result.readyRows).toBe(2);
    expect(result.blockedRows).toBe(0);
  });

  test('checkRowDryRunGate blocked result entersAlphaScore = false', () => {
    const row = makeRow({ releaseDate: null });
    const result = checkRowDryRunGate(row);
    expect(result.entersAlphaScore).toBe(false);
  });

  test('checkRowAgainstContract rejects row with winRate field', () => {
    const result = checkRowAgainstContract({ winRate: 0.6 });
    expect(result.passes).toBe(false);
  });

  test('checkRowAgainstContract rejects row with edgeScore field', () => {
    const result = checkRowAgainstContract({ edgeScore: 0.3 });
    expect(result.passes).toBe(false);
  });

  test('buildDryRunGateScanFromCounts(0, 0, 0, 0) → NOT_APPLICABLE', () => {
    const result = buildDryRunGateScanFromCounts(0, 0, 0, 0);
    expect(result.overallClassification).toBe('MONTHLY_REVENUE_DRY_RUN_NOT_APPLICABLE');
    expect(result.coveragePct).toBe(0);
  });

  test('Dec revenue month (month=12) releaseDate after Jan 10 next year is valid', () => {
    const row = makeRow({
      year: 2025,
      month: 12,
      releaseDate: new Date('2026-01-10T00:00:00.000Z'),
    });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(true);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_READY');
  });

  test('Dec revenue month with releaseDate during Dec is blocked', () => {
    const row = makeRow({
      year: 2025,
      month: 12,
      releaseDate: new Date('2025-12-15T00:00:00.000Z'),
    });
    const result = checkRowDryRunGate(row);
    expect(result.passes).toBe(false);
    expect(result.classification).toBe('MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK');
  });
});
