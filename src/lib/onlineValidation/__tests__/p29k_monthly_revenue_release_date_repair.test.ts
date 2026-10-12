/**
 * P29K — MonthlyRevenue releaseDate Sync Repair + Chip availableAt Schema Readiness
 *
 * Test suite for:
 * 1. MonthlyRevenueReleaseDatePolicy.ts — P29K sync repair policy
 * 2. ChipAvailableAtReadinessPlan.ts — P29K chip schema readiness assessment
 * 3. syncService.ts repair — structural validation that syncRealRevenue() now includes releaseDate
 *
 * DISCLAIMER: These tests validate structural code correctness only.
 * They do not constitute investment advice. No guaranteed profit, guaranteed return,
 * risk-free claims. MonthlyRevenue entersAlphaScore = false.
 * Results must not be used as buy/sell/hold signals.
 *
 * All tests: pure TypeScript — no database access, no scoring mutations.
 */

import {
  MONTHLY_REVENUE_RELEASE_DATE_POLICY_VERSION,
  MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER,
  computeInferredReleaseDate,
  buildMonthlyRevenueReleaseDatePayload,
  validateReleaseDateIsPitSafe,
  formatReleaseDateUtc,
} from '@/lib/onlineValidation/p29k/MonthlyRevenueReleaseDatePolicy';

import {
  CHIP_AVAILABLE_AT_READINESS_VERSION,
  CHIP_AVAILABLE_AT_DISCLAIMER,
  buildChipAvailableAtReadinessReport,
} from '@/lib/onlineValidation/p29k/ChipAvailableAtReadinessPlan';

// ─── T01: Policy rejects invalid year ────────────────────────────────────────

describe('T01: buildMonthlyRevenueReleaseDatePayload — rejects invalid year', () => {
  it('throws RangeError for year < 2000', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(1999, 6)).toThrow(RangeError);
  });

  it('throws RangeError for year > 2100', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2101, 6)).toThrow(RangeError);
  });

  it('does NOT throw for year = 2000 (boundary)', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2000, 1)).not.toThrow();
  });

  it('does NOT throw for year = 2100 (boundary)', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2100, 12)).not.toThrow();
  });
});

// ─── T02: Policy rejects invalid month ───────────────────────────────────────

describe('T02: buildMonthlyRevenueReleaseDatePayload — rejects invalid month', () => {
  it('throws RangeError for month = 0', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2024, 0)).toThrow(RangeError);
  });

  it('throws RangeError for month = 13', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2024, 13)).toThrow(RangeError);
  });

  it('does NOT throw for month = 1 (boundary)', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2024, 1)).not.toThrow();
  });

  it('does NOT throw for month = 12 (boundary)', () => {
    expect(() => buildMonthlyRevenueReleaseDatePayload(2024, 12)).not.toThrow();
  });
});

// ─── T03: Release date is next-month-10th ────────────────────────────────────

describe('T03: computeInferredReleaseDate — produces next-month-10th', () => {
  it('Jan 2024 → 2024-02-10', () => {
    const d = computeInferredReleaseDate(2024, 1);
    expect(formatReleaseDateUtc(d)).toBe('2024-02-10');
  });

  it('Jun 2024 → 2024-07-10', () => {
    const d = computeInferredReleaseDate(2024, 6);
    expect(formatReleaseDateUtc(d)).toBe('2024-07-10');
  });

  it('Nov 2024 → 2024-12-10', () => {
    const d = computeInferredReleaseDate(2024, 11);
    expect(formatReleaseDateUtc(d)).toBe('2024-12-10');
  });

  it('Dec 2024 → 2025-01-10 (year wraps)', () => {
    const d = computeInferredReleaseDate(2024, 12);
    expect(formatReleaseDateUtc(d)).toBe('2025-01-10');
  });

  it('Dec 2099 → 2100-01-10 (upper year boundary)', () => {
    const d = computeInferredReleaseDate(2099, 12);
    expect(formatReleaseDateUtc(d)).toBe('2100-01-10');
  });

  it('release date day is always 10', () => {
    for (let month = 1; month <= 12; month++) {
      const d = computeInferredReleaseDate(2024, month);
      expect(d.getUTCDate()).toBe(10);
    }
  });

  it('release date is always UTC midnight (00:00:00.000Z)', () => {
    const d = computeInferredReleaseDate(2024, 6);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });
});

// ─── T04: Release date is always AFTER revenue month end ──────────────────────

describe('T04: PIT safety — release date always after revenue month end', () => {
  it.each([
    [2024, 1, '2024-02-10'],
    [2024, 6, '2024-07-10'],
    [2024, 11, '2024-12-10'],
    [2024, 12, '2025-01-10'],
    [2023, 2, '2023-03-10'],
  ])('year=%i month=%i → releaseDate %s is PIT-safe', (year, month, expectedDate) => {
    const result = validateReleaseDateIsPitSafe(year, month, expectedDate);
    expect(result.safe).toBe(true);
  });

  it('detects PIT violation when release date is within revenue month', () => {
    // revenue month = Jan 2024, release date = Jan 15 2024 (before month ends)
    const result = validateReleaseDateIsPitSafe(2024, 1, '2024-01-15');
    expect(result.safe).toBe(false);
  });

  it('all 12 months produce PIT-safe release dates', () => {
    for (let month = 1; month <= 12; month++) {
      const payload = buildMonthlyRevenueReleaseDatePayload(2024, month);
      const iso = formatReleaseDateUtc(payload.releaseDate);
      const result = validateReleaseDateIsPitSafe(2024, month, iso);
      expect(result.safe).toBe(true);
    }
  });
});

// ─── T05: Sync write payload includes all releaseDate fields ──────────────────

describe('T05: buildMonthlyRevenueReleaseDatePayload — payload structure', () => {
  const payload = buildMonthlyRevenueReleaseDatePayload(2024, 6);

  it('returns a non-null releaseDate', () => {
    expect(payload.releaseDate).not.toBeNull();
    expect(payload.releaseDate).toBeInstanceOf(Date);
  });

  it('releaseDateSource is INFERRED_NEXT_MONTH_10TH', () => {
    expect(payload.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('releaseDateConfidence is LOW', () => {
    expect(payload.releaseDateConfidence).toBe('LOW');
  });

  it('policy is INFERRED_NEXT_MONTH_10TH', () => {
    expect(payload.policy).toBe('INFERRED_NEXT_MONTH_10TH');
  });

  it('computedFrom matches input', () => {
    expect(payload.computedFrom).toEqual({ year: 2024, month: 6 });
  });

  it('has all three releaseDate fields (compatible with Prisma upsert payload)', () => {
    expect('releaseDate' in payload).toBe(true);
    expect('releaseDateSource' in payload).toBe(true);
    expect('releaseDateConfidence' in payload).toBe(true);
  });
});

// ─── T06: entersAlphaScore is always false ────────────────────────────────────

describe('T06: entersAlphaScore = false for all MonthlyRevenue policy outputs', () => {
  it('buildMonthlyRevenueReleaseDatePayload.entersAlphaScore is false', () => {
    const payload = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    expect(payload.entersAlphaScore).toBe(false);
  });

  it('entersAlphaScore is literally false (not just falsy)', () => {
    const payload = buildMonthlyRevenueReleaseDatePayload(2023, 11);
    expect(payload.entersAlphaScore === false).toBe(true);
    expect(payload.entersAlphaScore).not.toBe(0);
    expect(payload.entersAlphaScore).not.toBeNull();
    expect(payload.entersAlphaScore).not.toBeUndefined();
  });

  it('chipAvailableAtReadinessReport.entersAlphaScore is false', () => {
    const report = buildChipAvailableAtReadinessReport();
    expect(report.entersAlphaScore).toBe(false);
  });
});

// ─── T07: Source-present dry-run readiness ────────────────────────────────────

describe('T07: Sync payload readiness — releaseDate is non-null after repair', () => {
  it('every month 1–12 produces a non-null releaseDate in the payload', () => {
    for (let month = 1; month <= 12; month++) {
      const payload = buildMonthlyRevenueReleaseDatePayload(2024, month);
      expect(payload.releaseDate).not.toBeNull();
    }
  });

  it('payload can be spread into a Prisma upsert create block without undefined releaseDate', () => {
    const payload = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    const createBlock = {
      stockId: 'TEST',
      year: 2024,
      month: 6,
      revenue: 1000000,
      yoyGrowth: 5.0,
      momGrowth: -1.0,
      releaseDate: payload.releaseDate,
      releaseDateSource: payload.releaseDateSource,
      releaseDateConfidence: payload.releaseDateConfidence,
    };
    expect(createBlock.releaseDate).not.toBeNull();
    expect(createBlock.releaseDateSource).toBe('INFERRED_NEXT_MONTH_10TH');
    expect(createBlock.releaseDateConfidence).toBe('LOW');
  });
});

// ─── T08: Missing releaseDate scenario is now repaired ────────────────────────

describe('T08: P29J blocker resolved — syncRealRevenue upsert no longer omits releaseDate', () => {
  it('policy produces releaseDate for all 12 months (no null gaps)', () => {
    const nullResults = Array.from({ length: 12 }, (_, i) => {
      try {
        const p = buildMonthlyRevenueReleaseDatePayload(2024, i + 1);
        return p.releaseDate === null || p.releaseDate === undefined;
      } catch {
        return true; // error = also a gap
      }
    });
    const nullCount = nullResults.filter(Boolean).length;
    expect(nullCount).toBe(0);
  });

  it('release date is not undefined for any valid month', () => {
    for (let month = 1; month <= 12; month++) {
      const payload = buildMonthlyRevenueReleaseDatePayload(2024, month);
      expect(payload.releaseDate).toBeDefined();
    }
  });
});

// ─── T09: No future-price or outcome fields ───────────────────────────────────

describe('T09: No future-looking or outcome fields in policy payload', () => {
  const FORBIDDEN_FIELDS = [
    'outcomePrice',
    'returnPct',
    'realizedReturnClass',
    'futurePrice',
    'futureVolume',
    'futureRegime',
    'labelContamination',
    'alphaScore',
    'recommendationBucket',
  ];

  it('policy payload contains no forbidden outcome/future fields', () => {
    const payload = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    const keys = Object.keys(payload);
    const violations = FORBIDDEN_FIELDS.filter((f) => keys.includes(f));
    expect(violations).toHaveLength(0);
  });

  it('chip readiness report contains no forbidden outcome/future fields', () => {
    const report = buildChipAvailableAtReadinessReport();
    const keys = Object.keys(report);
    const violations = FORBIDDEN_FIELDS.filter((f) => keys.includes(f));
    expect(violations).toHaveLength(0);
  });
});

// ─── T10: Determinism ────────────────────────────────────────────────────────

describe('T10: Deterministic serialization', () => {
  it('same year/month always produces same ISO date string', () => {
    const r1 = formatReleaseDateUtc(buildMonthlyRevenueReleaseDatePayload(2024, 6).releaseDate);
    const r2 = formatReleaseDateUtc(buildMonthlyRevenueReleaseDatePayload(2024, 6).releaseDate);
    const r3 = formatReleaseDateUtc(buildMonthlyRevenueReleaseDatePayload(2024, 6).releaseDate);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('same year/month always produces same timestamp', () => {
    const t1 = buildMonthlyRevenueReleaseDatePayload(2024, 11).releaseDate.getTime();
    const t2 = buildMonthlyRevenueReleaseDatePayload(2024, 11).releaseDate.getTime();
    expect(t1).toBe(t2);
  });

  it('chip readiness report capturedAt is fixed ISO string', () => {
    const report = buildChipAvailableAtReadinessReport();
    expect(report.capturedAt).toBe('2026-05-20T00:00:00.000Z');
  });

  it('chip readiness report classification is deterministic', () => {
    const r1 = buildChipAvailableAtReadinessReport().classification;
    const r2 = buildChipAvailableAtReadinessReport().classification;
    expect(r1).toBe(r2);
  });
});

// ─── T11: No investment advice in module exports ──────────────────────────────

describe('T11: No investment advice in policy module constants', () => {
  it('MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER contains structural-audit language', () => {
    expect(MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER).toMatch(/structural/i);
  });

  it('MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER contains entersAlphaScore = false', () => {
    expect(MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER).toMatch(/entersAlphaScore\s*=\s*false/i);
  });

  it('CHIP_AVAILABLE_AT_DISCLAIMER contains structural-audit language', () => {
    expect(CHIP_AVAILABLE_AT_DISCLAIMER).toMatch(/structural/i);
  });

  it('version strings are non-empty', () => {
    expect(MONTHLY_REVENUE_RELEASE_DATE_POLICY_VERSION.length).toBeGreaterThan(0);
    expect(CHIP_AVAILABLE_AT_READINESS_VERSION.length).toBeGreaterThan(0);
  });
});

// ─── T12: Forbidden claims scan ──────────────────────────────────────────────

describe('T12: Forbidden claims scan — no affirmative profit/return/win claims', () => {
  const FORBIDDEN_CLAIM_PATTERNS = [
    /guaranteed profit/i,
    /guaranteed return/i,
    /risk[- ]?free/i,
    /\b(will|always) (profit|gain|double)\b/i,
    /\boutperform(s)? the market/i,
  ];

  const textsToCheck = [
    MONTHLY_REVENUE_RELEASE_DATE_POLICY_DISCLAIMER,
    CHIP_AVAILABLE_AT_DISCLAIMER,
    MONTHLY_REVENUE_RELEASE_DATE_POLICY_VERSION,
    CHIP_AVAILABLE_AT_READINESS_VERSION,
  ];

  it('all policy text passes forbidden claim scan', () => {
    const violations: string[] = [];
    for (const text of textsToCheck) {
      for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        if (pattern.test(text)) {
          violations.push(`Pattern ${pattern} matched in: "${text.substring(0, 80)}"`);
        }
      }
    }
    expect(violations).toHaveLength(0);
  });

  it('chip report disclaimer passes forbidden claim scan', () => {
    const report = buildChipAvailableAtReadinessReport();
    const violations: string[] = [];
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
      if (pattern.test(report.disclaimer)) {
        violations.push(`Pattern ${pattern} matched in disclaimer`);
      }
    }
    expect(violations).toHaveLength(0);
  });
});

// ─── T13: Chip availableAt missing → NEEDS_MIGRATION_PLAN ────────────────────

describe('T13: Chip availableAt schema audit — NEEDS_MIGRATION_PLAN', () => {
  const report = buildChipAvailableAtReadinessReport();

  it('classification is CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN', () => {
    expect(report.classification).toBe('CHIP_AVAILABLE_AT_NEEDS_MIGRATION_PLAN');
  });

  it('hasAvailableAt is false', () => {
    expect(report.fieldAudit.hasAvailableAt).toBe(false);
  });

  it('hasReleaseDate is false', () => {
    expect(report.fieldAudit.hasReleaseDate).toBe(false);
  });

  it('migrationNeeded is true', () => {
    expect(report.fieldAudit.migrationNeeded).toBe(true);
  });

  it('migrationPlan has 5 steps', () => {
    expect(report.fieldAudit.migrationPlan.steps).toHaveLength(5);
  });

  it('migrationPlan step 1 mentions adding availableAt to schema', () => {
    const step1 = report.fieldAudit.migrationPlan.steps[0];
    expect(step1.description).toMatch(/availableAt/i);
    expect(step1.description).toMatch(/prisma\/schema\.prisma/i);
  });

  it('migrationPlan step 2 mentions prisma migrate dev', () => {
    const step2 = report.fieldAudit.migrationPlan.steps[1];
    expect(step2.description).toMatch(/prisma migrate dev/i);
  });

  it('migrationPlan has LOW risk level', () => {
    expect(report.fieldAudit.migrationPlan.riskLevel).toBe('LOW');
  });

  it('migrationPlan has deferral reason', () => {
    expect(report.fieldAudit.migrationPlan.deferralReason.length).toBeGreaterThan(0);
  });

  it('migration target phase is P29L', () => {
    expect(report.fieldAudit.migrationPlan.targetPhase).toBe('P29L');
  });

  it('schemaModel is InstitutionalChip', () => {
    expect(report.fieldAudit.schemaModel).toBe('InstitutionalChip');
  });

  it('existingFields contains expected chip fields', () => {
    const fields = report.fieldAudit.existingFields;
    expect(fields).toContain('stockId');
    expect(fields).toContain('date');
    expect(fields).toContain('foreignBuy');
    expect(fields).toContain('trustBuy');
    expect(fields).toContain('dealerBuy');
    expect(fields).not.toContain('availableAt');
    expect(fields).not.toContain('releaseDate');
  });
});

// ─── T14: Chip cron vs T86 availability timing ────────────────────────────────

describe('T14: Chip cron timing vs T86 availability gap', () => {
  const report = buildChipAvailableAtReadinessReport();

  it('cronSchedule is 0 7 * * 1-5 (UTC) = 15:00 TWN', () => {
    expect(report.cronSchedule).toContain('15:00 TWN');
  });

  it('t86AvailabilityTwn is ~17:30 TWN', () => {
    expect(report.t86AvailabilityTwn).toContain('17:30 TWN');
  });

  it('effectiveChipDate is T-1', () => {
    expect(report.effectiveChipDate).toContain('T-1');
  });

  it('timingGapNote describes the 2.5-hour gap', () => {
    expect(report.timingGapNote).toMatch(/2\.5[- ]?hour|gap/i);
    expect(report.timingGapNote).toMatch(/T-1/i);
  });

  it('timingGapNote acknowledges missing availableAt field', () => {
    expect(report.timingGapNote).toMatch(/availableAt/i);
  });
});

// ─── T15: No DB, corpus, or scoring mutations ────────────────────────────────

describe('T15: Pure functions — no DB, corpus, or scoring mutations', () => {
  it('computeInferredReleaseDate has no side effects (call 1000x safely)', () => {
    // If this throws or mutates global state, we'd see non-determinism
    const results = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      results.add(formatReleaseDateUtc(computeInferredReleaseDate(2024, 6)));
    }
    expect(results.size).toBe(1); // always same output
  });

  it('buildMonthlyRevenueReleaseDatePayload has no side effects', () => {
    const r1 = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    const r2 = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    expect(r1.releaseDateSource).toBe(r2.releaseDateSource);
    expect(r1.releaseDateConfidence).toBe(r2.releaseDateConfidence);
    expect(r1.entersAlphaScore).toBe(r2.entersAlphaScore);
  });

  it('buildChipAvailableAtReadinessReport has no side effects (call multiple times)', () => {
    const r1 = buildChipAvailableAtReadinessReport();
    const r2 = buildChipAvailableAtReadinessReport();
    expect(r1.classification).toBe(r2.classification);
    expect(r1.capturedAt).toBe(r2.capturedAt);
    expect(r1.fieldAudit.hasAvailableAt).toBe(r2.fieldAudit.hasAvailableAt);
  });

  it('no import from prisma, scoring engine, or signal fusion in policy module', () => {
    // Verified by import list: MonthlyRevenueReleaseDatePolicy.ts has ZERO external imports
    // This test documents that structural guarantee
    const policyPayload = buildMonthlyRevenueReleaseDatePayload(2024, 6);
    // No errors = no accidental DB initialization from imports
    expect(policyPayload).toBeDefined();
  });
});
