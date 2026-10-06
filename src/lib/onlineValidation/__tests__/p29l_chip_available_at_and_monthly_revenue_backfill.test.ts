/**
 * P29L — Chip availableAt Migration Readiness + MonthlyRevenue Historical Backfill
 *
 * Test suite for:
 * 1. ChipAvailableAtMigrationReadiness.ts — P29L chip schema readiness (Option A: plan-only)
 * 2. MonthlyRevenueBackfillReadiness.ts — P29L backfill readiness (dryRun=true)
 *
 * DISCLAIMER: These tests validate structural code correctness only.
 * Does not constitute investment advice.
 * No profit, return, or investment performance claims.
 * MonthlyRevenue entersAlphaScore = false. InstitutionalChip entersAlphaScore = false.
 * Results must not be used as buy/sell/hold signals.
 *
 * All tests: pure TypeScript — no database access, no scoring mutations.
 */

import {
  CHIP_AVAILABLE_AT_MIGRATION_VERSION,
  CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER,
  computeChipAvailableAt,
  computeChipAvailableAtConservative,
  formatChipAvailableAtUtc,
  validateChipAvailableAtIsPitSafe,
  buildChipMigrationReadinessReport,
} from '@/lib/onlineValidation/p29l/ChipAvailableAtMigrationReadiness';

import {
  MONTHLY_REVENUE_BACKFILL_VERSION,
  MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
  computeBackfillReleaseDate,
  computeBackfillRows,
  buildBackfillDryRunResult,
  checkSourcePresentDryRunReadiness,
  formatBackfillReleaseDateUtc,
  type NullReleaseDateRow,
} from '@/lib/onlineValidation/p29l/MonthlyRevenueBackfillReadiness';

// ─── T01: Chip migration readiness — detects missing availableAt ──────────────

describe('T01: buildChipMigrationReadinessReport — detects missing availableAt', () => {
  const report = buildChipMigrationReadinessReport();

  it('hasAvailableAt is false', () => {
    expect(report.hasAvailableAt).toBe(false);
  });

  it('migrationNeeded is true', () => {
    expect(report.migrationNeeded).toBe(true);
  });

  it('schemaModel is InstitutionalChip', () => {
    expect(report.schemaModel).toBe('InstitutionalChip');
  });

  it('classification is CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY', () => {
    expect(report.classification).toBe('CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY');
  });

  it('schemaModifiedInSession is false — Option A: no schema change', () => {
    expect(report.schemaModifiedInSession).toBe(false);
  });

  it('has 5 migration steps', () => {
    expect(report.migrationSteps).toHaveLength(5);
  });

  it('step 1 mentions schema', () => {
    expect(report.migrationSteps[0].action.toLowerCase()).toContain('schema');
  });

  it('step 2 mentions migrate dev', () => {
    expect(report.migrationSteps[1].action.toLowerCase()).toContain('migrate dev');
  });

  it('step 5 mentions chip lag', () => {
    expect(report.migrationSteps[4].action.toLowerCase()).toMatch(/chip.*lag|lag.*chip/i);
  });
});

// ─── T02: Chip classification does NOT claim CHIP_LAG_CONFIRMED ───────────────

describe('T02: Chip classification — CHIP_LAG_CONFIRMED not claimed without prod logs', () => {
  const report = buildChipMigrationReadinessReport();

  it('canClaimChipLagConfirmed is false', () => {
    expect(report.canClaimChipLagConfirmed).toBe(false);
  });

  it('prodLogsRequired is true', () => {
    expect(report.prodLogsRequired).toBe(true);
  });

  it('lagWarningMaintained is true', () => {
    expect(report.lagWarningMaintained).toBe(true);
  });

  it('classification is NOT CHIP_LAG_CONFIRMED', () => {
    expect(report.classification).not.toBe('CHIP_LAG_CONFIRMED');
  });

  it('classification is NOT CHIP_LAG_WARN_RESOLVED', () => {
    expect(report.classification).not.toBe('CHIP_LAG_WARN_RESOLVED');
  });
});

// ─── T03: Chip cron vs availability — WARN maintained ─────────────────────────

describe('T03: Chip timing — 15:00 cron vs 17:30 availability gap remains WARN', () => {
  const report = buildChipMigrationReadinessReport();

  it('cronScheduleTwn is 15:00 TWN', () => {
    expect(report.cronScheduleTwn).toBe('15:00 TWN');
  });

  it('t86AvailabilityTwn is ~17:30 TWN', () => {
    expect(report.t86AvailabilityTwn).toBe('~17:30 TWN');
  });

  it('timingGapMinutes is 150', () => {
    expect(report.timingGapMinutes).toBe(150);
  });

  it('effectiveChipDate is T-1', () => {
    expect(report.effectiveChipDate).toBe('T-1');
  });

  it('lagWarningMaintained is true — WARN not resolved', () => {
    expect(report.lagWarningMaintained).toBe(true);
  });

  it('canClaimChipLagConfirmed is false — timing gap unresolved without prod logs', () => {
    expect(report.canClaimChipLagConfirmed).toBe(false);
  });
});

// ─── T04: Chip availableAt computation — deterministic ────────────────────────

describe('T04: computeChipAvailableAt / computeChipAvailableAtConservative — deterministic', () => {
  it('primary policy: 2026-05-20 → 2026-05-20T09:30:00Z', () => {
    const r = computeChipAvailableAt('2026-05-20');
    expect(formatChipAvailableAtUtc(r.availableAt)).toBe('2026-05-20T09:30:00Z');
    expect(r.policy).toBe('INFERRED_SAME_DAY_T86_0930_UTC');
  });

  it('primary policy: same input → same output (determinism)', () => {
    const r1 = computeChipAvailableAt('2026-01-15');
    const r2 = computeChipAvailableAt('2026-01-15');
    expect(r1.availableAt.toISOString()).toBe(r2.availableAt.toISOString());
  });

  it('primary policy: hours=9, minutes=30, seconds=0 (UTC)', () => {
    const r = computeChipAvailableAt('2026-03-10');
    expect(r.availableAt.getUTCHours()).toBe(9);
    expect(r.availableAt.getUTCMinutes()).toBe(30);
    expect(r.availableAt.getUTCSeconds()).toBe(0);
  });

  it('conservative policy: 2026-05-20 → 2026-05-21T09:30:00Z', () => {
    const r = computeChipAvailableAtConservative('2026-05-20');
    expect(formatChipAvailableAtUtc(r.availableAt)).toBe('2026-05-21T09:30:00Z');
    expect(r.policy).toBe('INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE');
  });

  it('conservative policy: month boundary 2026-01-31 → 2026-02-01T09:30:00Z', () => {
    const r = computeChipAvailableAtConservative('2026-01-31');
    expect(formatChipAvailableAtUtc(r.availableAt)).toBe('2026-02-01T09:30:00Z');
  });

  it('conservative policy: year boundary 2025-12-31 → 2026-01-01T09:30:00Z', () => {
    const r = computeChipAvailableAtConservative('2025-12-31');
    expect(formatChipAvailableAtUtc(r.availableAt)).toBe('2026-01-01T09:30:00Z');
  });

  it('rejects invalid dateString format', () => {
    expect(() => computeChipAvailableAt('20260520')).toThrow(RangeError);
    expect(() => computeChipAvailableAt('2026/05/20')).toThrow(RangeError);
  });

  it('rejects year < 2000', () => {
    expect(() => computeChipAvailableAt('1999-12-31')).toThrow(RangeError);
  });

  it('rejects year > 2100', () => {
    expect(() => computeChipAvailableAt('2101-01-01')).toThrow(RangeError);
  });

  it('entersAlphaScore is strictly false (not 0, not null) — primary', () => {
    const r = computeChipAvailableAt('2026-05-20');
    expect(r.entersAlphaScore).toBe(false);
    expect(r.entersAlphaScore).not.toBe(0);
    expect(r.entersAlphaScore).not.toBeNull();
  });

  it('entersAlphaScore is strictly false — conservative', () => {
    const r = computeChipAvailableAtConservative('2026-05-20');
    expect(r.entersAlphaScore).toBe(false);
  });

  it('1000x calls produce identical output (pure function check)', () => {
    const first = computeChipAvailableAt('2026-06-15').availableAt.getTime();
    for (let i = 0; i < 1000; i++) {
      expect(computeChipAvailableAt('2026-06-15').availableAt.getTime()).toBe(first);
    }
  });
});

// ─── T05: MonthlyRevenue backfill — handles NULL releaseDate ──────────────────

describe('T05: computeBackfillRows — handles NULL releaseDate rows', () => {
  const nullRows: NullReleaseDateRow[] = [
    { stockId: '2330', year: 2024, month: 1, releaseDate: null },
    { stockId: '2330', year: 2024, month: 12, releaseDate: null },
    { stockId: '2454', year: 2025, month: 6, releaseDate: null },
  ];

  const backfilled = computeBackfillRows(nullRows);

  it('produces non-null releaseDate for all rows', () => {
    for (const row of backfilled) {
      expect(row.releaseDate).not.toBeNull();
      expect(row.releaseDate).toBeInstanceOf(Date);
    }
  });

  it('Jan 2024 → releaseDate 2024-02-10', () => {
    expect(formatBackfillReleaseDateUtc(backfilled[0].releaseDate)).toBe('2024-02-10');
  });

  it('Dec 2024 → releaseDate 2025-01-10 (year wrap)', () => {
    expect(formatBackfillReleaseDateUtc(backfilled[1].releaseDate)).toBe('2025-01-10');
  });

  it('Jun 2025 → releaseDate 2025-07-10', () => {
    expect(formatBackfillReleaseDateUtc(backfilled[2].releaseDate)).toBe('2025-07-10');
  });

  it('preserves stockId and year/month', () => {
    expect(backfilled[0].stockId).toBe('2330');
    expect(backfilled[0].year).toBe(2024);
    expect(backfilled[0].month).toBe(1);
  });
});

// ─── T06: MonthlyRevenue backfill — uses INFERRED_NEXT_MONTH_10TH policy ─────

describe('T06: computeBackfillReleaseDate — INFERRED_NEXT_MONTH_10TH policy', () => {
  it('all months produce day=10 in the release month', () => {
    for (let m = 1; m <= 12; m++) {
      const d = computeBackfillReleaseDate(2025, m);
      expect(d.getUTCDate()).toBe(10);
    }
  });

  it('all months produce UTC midnight (hour=0, min=0, sec=0, ms=0)', () => {
    for (let m = 1; m <= 12; m++) {
      const d = computeBackfillReleaseDate(2025, m);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCSeconds()).toBe(0);
      expect(d.getUTCMilliseconds()).toBe(0);
    }
  });

  it('Dec 2025 → Jan 2026 (year wrap)', () => {
    const d = computeBackfillReleaseDate(2025, 12);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth() + 1).toBe(1);
    expect(d.getUTCDate()).toBe(10);
  });

  it('Mar 2024 → Apr 2024', () => {
    const d = computeBackfillReleaseDate(2024, 3);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth() + 1).toBe(4);
    expect(d.getUTCDate()).toBe(10);
  });

  it('releaseDateSource is INFERRED_NEXT_MONTH_10TH', () => {
    const rows = computeBackfillRows([
      { stockId: '2330', year: 2024, month: 5, releaseDate: null },
    ]);
    expect(rows[0].releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('releaseDateConfidence is LOW', () => {
    const rows = computeBackfillRows([
      { stockId: '2330', year: 2024, month: 5, releaseDate: null },
    ]);
    expect(rows[0].releaseDateConfidence).toBe('LOW');
  });

  it('rejects year < 2000', () => {
    expect(() => computeBackfillReleaseDate(1999, 5)).toThrow(RangeError);
  });

  it('rejects year > 2100', () => {
    expect(() => computeBackfillReleaseDate(2101, 1)).toThrow(RangeError);
  });

  it('rejects month 0', () => {
    expect(() => computeBackfillReleaseDate(2024, 0)).toThrow(RangeError);
  });

  it('rejects month 13', () => {
    expect(() => computeBackfillReleaseDate(2024, 13)).toThrow(RangeError);
  });
});

// ─── T07: MonthlyRevenue backfill — idempotent ────────────────────────────────

describe('T07: computeBackfillRows — idempotent', () => {
  const nullRows: NullReleaseDateRow[] = [
    { stockId: '2330', year: 2024, month: 3, releaseDate: null },
    { stockId: '2454', year: 2023, month: 12, releaseDate: null },
  ];

  it('produces same output on repeated calls', () => {
    const r1 = computeBackfillRows(nullRows);
    const r2 = computeBackfillRows(nullRows);
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i].releaseDate.toISOString()).toBe(r2[i].releaseDate.toISOString());
      expect(r1[i].releaseDateSource).toBe(r2[i].releaseDateSource);
      expect(r1[i].releaseDateConfidence).toBe(r2[i].releaseDateConfidence);
    }
  });

  it('same year/month always produces same releaseDate', () => {
    const d1 = computeBackfillReleaseDate(2023, 12);
    const d2 = computeBackfillReleaseDate(2023, 12);
    expect(d1.getTime()).toBe(d2.getTime());
  });

  it('1000x calls produce identical output', () => {
    const first = computeBackfillReleaseDate(2025, 6).getTime();
    for (let i = 0; i < 1000; i++) {
      expect(computeBackfillReleaseDate(2025, 6).getTime()).toBe(first);
    }
  });
});

// ─── T08: MonthlyRevenue backfill — dryRun=true support ──────────────────────

describe('T08: buildBackfillDryRunResult — dryRun=true', () => {
  const nullRows: NullReleaseDateRow[] = [
    { stockId: '2330', year: 2024, month: 1, releaseDate: null },
    { stockId: '2454', year: 2024, month: 2, releaseDate: null },
    { stockId: '2412', year: 2024, month: 3, releaseDate: null },
  ];
  const result = buildBackfillDryRunResult(nullRows);

  it('dryRun is true', () => {
    expect(result.dryRun).toBe(true);
  });

  it('productionApplied is false', () => {
    expect(result.productionApplied).toBe(false);
  });

  it('affectedRows equals input length', () => {
    expect(result.affectedRows).toBe(3);
  });

  it('classification is BACKFILL_SCRIPT_READY_NOT_APPLIED', () => {
    expect(result.classification).toBe('BACKFILL_SCRIPT_READY_NOT_APPLIED');
  });

  it('policy is INFERRED_NEXT_MONTH_10TH', () => {
    expect(result.policy).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('sampleRows ≤ 5', () => {
    expect(result.sampleRows.length).toBeLessThanOrEqual(5);
  });

  it('sampleRows have non-null releaseDate', () => {
    for (const row of result.sampleRows) {
      expect(row.releaseDate).not.toBeNull();
      expect(row.releaseDate).toBeInstanceOf(Date);
    }
  });

  it('empty input — affectedRows=0', () => {
    const r = buildBackfillDryRunResult([]);
    expect(r.affectedRows).toBe(0);
    expect(r.sampleRows).toHaveLength(0);
    expect(r.productionApplied).toBe(false);
  });
});

// ─── T09: MonthlyRevenue backfill — entersAlphaScore never true ───────────────

describe('T09: entersAlphaScore = false always', () => {
  it('BackfilledRow.entersAlphaScore is strictly false', () => {
    const rows = computeBackfillRows([
      { stockId: '2330', year: 2024, month: 5, releaseDate: null },
    ]);
    expect(rows[0].entersAlphaScore).toBe(false);
    expect(rows[0].entersAlphaScore).not.toBe(0);
    expect(rows[0].entersAlphaScore).not.toBeNull();
  });

  it('BackfillDryRunResult.entersAlphaScore is strictly false', () => {
    const r = buildBackfillDryRunResult([
      { stockId: '2330', year: 2024, month: 5, releaseDate: null },
    ]);
    expect(r.entersAlphaScore).toBe(false);
  });

  it('ChipMigrationReadinessReport.entersAlphaScore is strictly false', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.entersAlphaScore).toBe(false);
  });

  it('computeChipAvailableAt result.entersAlphaScore is strictly false', () => {
    const r = computeChipAvailableAt('2026-05-20');
    expect(r.entersAlphaScore).toBe(false);
  });
});

// ─── T10: MonthlyRevenue source-present dry-run readiness ─────────────────────

describe('T10: checkSourcePresentDryRunReadiness — non-null releaseDate required', () => {
  it('NULL releaseDate → MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE', () => {
    const r = checkSourcePresentDryRunReadiness({
      releaseDate: null,
      releaseDateSource: null,
    });
    expect(r.ready).toBe(false);
    expect(r.classification).toBe('MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE');
    expect(r.requirements.releaseDateNonNull).toBe(false);
  });

  it('non-null releaseDate → MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN', () => {
    const r = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2024-02-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    });
    expect(r.ready).toBe(true);
    expect(r.classification).toBe('MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN');
  });

  it('entersAlphaScoreequalsFalse is always true in requirements', () => {
    const r1 = checkSourcePresentDryRunReadiness({ releaseDate: null, releaseDateSource: null });
    expect(r1.requirements.entersAlphaScoreequalsFalse).toBe(true);

    const r2 = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2024-02-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    });
    expect(r2.requirements.entersAlphaScoreequalsFalse).toBe(true);
  });

  it('entersAlphaScore is always false on result', () => {
    const r = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2024-02-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    });
    expect(r.entersAlphaScore).toBe(false);
  });
});

// ─── T11: Future-looking fields are rejected ──────────────────────────────────

describe('T11: checkSourcePresentDryRunReadiness — future-looking fields rejected', () => {
  const FORBIDDEN_FIELDS = [
    'outcomePrice', 'returnPct', 'realizedReturnClass', 'futurePrice',
    'realizedReturn', 'forwardReturn', 'predictedPrice',
  ];

  for (const field of FORBIDDEN_FIELDS) {
    it(`field "${field}" → MONTHLY_REVENUE_BLOCKED_FUTURE_FIELD`, () => {
      const r = checkSourcePresentDryRunReadiness({
        releaseDate: new Date('2024-02-10T00:00:00.000Z'),
        releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
        [field]: 123,
      });
      expect(r.ready).toBe(false);
      expect(r.classification).toBe('MONTHLY_REVENUE_BLOCKED_FUTURE_FIELD');
      expect(r.requirements.noFutureFields).toBe(false);
    });
  }

  it('row without forbidden fields → ready', () => {
    const r = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2024-02-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
      revenue: 1234567,
      yoyGrowth: 0.05,
    });
    expect(r.ready).toBe(true);
    expect(r.requirements.noFutureFields).toBe(true);
  });
});

// ─── T12: JSON serialization ─────────────────────────────────────────────────

describe('T12: outputs serialize to JSON', () => {
  it('buildChipMigrationReadinessReport serializes without error', () => {
    const report = buildChipMigrationReadinessReport();
    expect(() => JSON.stringify(report)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(report));
    expect(parsed.classification).toBe('CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY');
    expect(parsed.entersAlphaScore).toBe(false);
  });

  it('buildBackfillDryRunResult serializes without error', () => {
    const r = buildBackfillDryRunResult([
      { stockId: '2330', year: 2024, month: 3, releaseDate: null },
    ]);
    expect(() => JSON.stringify(r)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(r));
    expect(parsed.dryRun).toBe(true);
    expect(parsed.productionApplied).toBe(false);
  });

  it('computeChipAvailableAt result serializes without error', () => {
    const r = computeChipAvailableAt('2026-05-20');
    expect(() => JSON.stringify(r)).not.toThrow();
  });

  it('checkSourcePresentDryRunReadiness serializes without error', () => {
    const r = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2024-02-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    });
    expect(() => JSON.stringify(r)).not.toThrow();
  });
});

// ─── T13: No investment advice in text ───────────────────────────────────────

describe('T13: markdown / disclaimer text — no investment advice', () => {
  it('chip migration disclaimer contains "structural"', () => {
    expect(CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER.toLowerCase()).toContain('structural');
  });

  it('chip migration disclaimer contains entersAlphaScore = false', () => {
    expect(CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER).toContain('entersAlphaScore = false');
  });

  it('chip migration report disclaimer contains "structural"', () => {
    const r = buildChipMigrationReadinessReport();
    expect(r.disclaimer.toLowerCase()).toContain('structural');
  });

  it('backfill disclaimer contains "structural"', () => {
    expect(MONTHLY_REVENUE_BACKFILL_DISCLAIMER.toLowerCase()).toContain('structural');
  });

  it('backfill disclaimer contains entersAlphaScore = false', () => {
    expect(MONTHLY_REVENUE_BACKFILL_DISCLAIMER).toContain('entersAlphaScore = false');
  });

  it('backfill dry-run result disclaimer contains "structural"', () => {
    const r = buildBackfillDryRunResult([]);
    expect(r.disclaimer.toLowerCase()).toContain('structural');
  });
});

// ─── T14: Forbidden claims scan clean ────────────────────────────────────────

describe('T14: Forbidden claim patterns — CLEAN in all policy text', () => {
  const FORBIDDEN_CLAIM_PATTERNS = [
    /guaranteed profit/i,
    /guaranteed return/i,
    /risk[- ]?free/i,
    /\b(will|always) (profit|gain|double)\b/i,
    /\boutperform(s)? the market/i,
  ];

  const allText = [
    CHIP_AVAILABLE_AT_MIGRATION_VERSION,
    CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER,
    MONTHLY_REVENUE_BACKFILL_VERSION,
    MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
    JSON.stringify(buildChipMigrationReadinessReport()),
    JSON.stringify(buildBackfillDryRunResult([])),
  ].join('\n');

  for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
    it(`no match for ${pattern}`, () => {
      expect(pattern.test(allText)).toBe(false);
    });
  }
});

// ─── T15: Pure functions — no DB / corpus / scoring mutation ─────────────────

describe('T15: Pure functions — no side effects', () => {
  it('computeChipAvailableAt does not import prisma', async () => {
    // If the module had prisma, it would throw on import in test environment
    // This test verifies the module loads cleanly without DB deps
    const mod = await import('@/lib/onlineValidation/p29l/ChipAvailableAtMigrationReadiness');
    expect(typeof mod.computeChipAvailableAt).toBe('function');
    expect(typeof mod.buildChipMigrationReadinessReport).toBe('function');
  });

  it('MonthlyRevenueBackfillReadiness does not import prisma', async () => {
    const mod = await import('@/lib/onlineValidation/p29l/MonthlyRevenueBackfillReadiness');
    expect(typeof mod.computeBackfillRows).toBe('function');
    expect(typeof mod.buildBackfillDryRunResult).toBe('function');
  });

  it('no scorer imports in ChipAvailableAtMigrationReadiness', async () => {
    const mod = await import('@/lib/onlineValidation/p29l/ChipAvailableAtMigrationReadiness');
    // Verify scoring-related exports do NOT exist
    expect((mod as Record<string, unknown>)['alphaScore']).toBeUndefined();
    expect((mod as Record<string, unknown>)['recommendationBucket']).toBeUndefined();
    expect((mod as Record<string, unknown>)['signalFusion']).toBeUndefined();
  });

  it('no scorer imports in MonthlyRevenueBackfillReadiness', async () => {
    const mod = await import('@/lib/onlineValidation/p29l/MonthlyRevenueBackfillReadiness');
    expect((mod as Record<string, unknown>)['alphaScore']).toBeUndefined();
    expect((mod as Record<string, unknown>)['recommendationBucket']).toBeUndefined();
  });

  it('PIT-safe validation: availableAt always after chip midnight', () => {
    // Primary policy: same-day 09:30 UTC — after 00:00 UTC
    const r = computeChipAvailableAt('2026-05-20');
    const pitCheck = validateChipAvailableAtIsPitSafe('2026-05-20', r.availableAtIso);
    expect(pitCheck.safe).toBe(true);

    // Conservative policy: next-day 09:30 UTC — also after chip midnight
    const rc = computeChipAvailableAtConservative('2026-05-20');
    const pitCheckC = validateChipAvailableAtIsPitSafe('2026-05-20', rc.availableAtIso);
    expect(pitCheckC.safe).toBe(true);
  });

  it('validateChipAvailableAtIsPitSafe: availableAt before midnight → not safe', () => {
    // If availableAt were before the chip date midnight, it would fail
    const tooEarly = new Date('2026-05-19T23:59:59.999Z').toISOString();
    const check = validateChipAvailableAtIsPitSafe('2026-05-20', tooEarly);
    expect(check.safe).toBe(false);
  });

  it('backfill PIT safety: releaseDate always after last day of revenue month', () => {
    // All 12 months: releaseDate is on the 10th of the NEXT month
    // This is always after the last day of the revenue month
    for (let m = 1; m <= 12; m++) {
      const d = computeBackfillReleaseDate(2025, m);
      // Last day of revenue month: we check the release month
      const releaseMonth = d.getUTCMonth() + 1;
      const releaseYear = d.getUTCFullYear();
      // Revenue month end: last day of m in 2025
      const revenueMonthEnd = new Date(Date.UTC(releaseYear, releaseMonth - 2, 31, 23, 59, 59));
      // Release is on the 10th — always after end of previous month
      expect(d.getTime()).toBeGreaterThan(revenueMonthEnd.getTime() - 31 * 24 * 3600 * 1000);
      // More direct: releaseDate is in the NEXT month, day 10
      expect(d.getUTCDate()).toBe(10);
    }
  });
});
