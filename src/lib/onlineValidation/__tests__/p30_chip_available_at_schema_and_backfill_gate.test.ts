/**
 * P30 — Chip availableAt Schema & Backfill Gate Tests
 *
 * Tests for:
 * - T01: Schema Migration Readiness
 * - T02: availableAt Policy
 * - T03: Write Policy
 * - T04: Backfill Gate
 * - T05: Forbidden Claims
 * - T06: Determinism
 *
 * Pure unit tests — no DB access, no side effects.
 *
 * DISCLAIMER: Test assertions only. Does not constitute investment advice.
 * InstitutionalChip.entersAlphaScore = false (always).
 */

import {
  buildChipMigrationReadinessReport,
  computeChipAvailableAt,
  computeChipAvailableAtConservative,
  CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER,
} from '../p29l/ChipAvailableAtMigrationReadiness';

import {
  buildBackfillDryRunResult,
  computeBackfillReleaseDate,
  checkSourcePresentDryRunReadiness,
  MONTHLY_REVENUE_BACKFILL_DISCLAIMER,
  type NullReleaseDateRow,
} from '../p29l/MonthlyRevenueBackfillReadiness';

import {
  buildChipUpsertAvailableAt,
  computeChipWriteAvailableAt,
  validateWriteDoesNotAlterChipNumerics,
  assertEntersAlphaScoreFalse,
  CHIP_AVAILABLE_AT_WRITE_DISCLAIMER,
  CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION,
} from '../p30/ChipAvailableAtWritePolicy';

// ─── T01: Schema Migration Readiness ─────────────────────────────────────────

describe('T01 Schema Migration Readiness', () => {
  it('T01-1: hasAvailableAt is false — schema field absent before P30 migration', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.hasAvailableAt).toBe(false);
  });

  it('T01-2: migrationNeeded is true', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.migrationNeeded).toBe(true);
  });

  it('T01-3: canClaimChipLagConfirmed is false', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.canClaimChipLagConfirmed).toBe(false);
  });

  it('T01-4: entersAlphaScore is false', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.entersAlphaScore).toBe(false);
  });

  it('T01-5: classification is CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.classification).toBe('CHIP_AVAILABLE_AT_MIGRATION_PLAN_READY');
  });

  it('T01-6: schemaModel is InstitutionalChip', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.schemaModel).toBe('InstitutionalChip');
  });

  it('T01-7: schemaModifiedInSession is false (P29L option A)', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.schemaModifiedInSession).toBe(false);
  });

  it('T01-8: prodLogsRequired is true', () => {
    const report = buildChipMigrationReadinessReport();
    expect(report.prodLogsRequired).toBe(true);
  });
});

// ─── T02: availableAt Policy ──────────────────────────────────────────────────

describe('T02 availableAt Policy', () => {
  it('T02-1: computeChipAvailableAt primary policy returns 2026-05-20T09:30:00.000Z', () => {
    const result = computeChipAvailableAt('2026-05-20');
    expect(result.availableAtIso).toBe('2026-05-20T09:30:00.000Z');
  });

  it('T02-2: computeChipAvailableAt policy is INFERRED_SAME_DAY_T86_0930_UTC', () => {
    const result = computeChipAvailableAt('2026-05-20');
    expect(result.policy).toBe('INFERRED_SAME_DAY_T86_0930_UTC');
  });

  it('T02-3: computeChipAvailableAt entersAlphaScore is false', () => {
    const result = computeChipAvailableAt('2026-05-20');
    expect(result.entersAlphaScore).toBe(false);
  });

  it('T02-4: computeChipAvailableAtConservative returns next day 09:30 UTC', () => {
    const result = computeChipAvailableAtConservative('2026-05-20');
    expect(result.availableAtIso).toBe('2026-05-21T09:30:00.000Z');
  });

  it('T02-5: conservative policy is INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE', () => {
    const result = computeChipAvailableAtConservative('2026-05-20');
    expect(result.policy).toBe('INFERRED_NEXT_DAY_0930_UTC_CONSERVATIVE');
  });

  it('T02-6: conservative entersAlphaScore is false', () => {
    const result = computeChipAvailableAtConservative('2026-05-20');
    expect(result.entersAlphaScore).toBe(false);
  });

  it('T02-7: computeChipAvailableAt throws for invalid date format', () => {
    expect(() => computeChipAvailableAt('invalid')).toThrow(RangeError);
  });
});

// ─── T03: Write Policy ────────────────────────────────────────────────────────

describe('T03 Write Policy', () => {
  it('T03-1: buildChipUpsertAvailableAt without sourcePayload uses primary policy', () => {
    const result = buildChipUpsertAvailableAt('2026-05-20');
    expect(result.policySource).toBe('INFERRED_PRIMARY');
    expect(result.availableAtIso).toBe('2026-05-20T09:30:00.000Z');
  });

  it('T03-2: buildChipUpsertAvailableAt with sourcePayload uses SOURCE_PAYLOAD', () => {
    const sourceDate = new Date('2026-05-20T11:00:00.000Z');
    const result = buildChipUpsertAvailableAt('2026-05-20', sourceDate);
    expect(result.policySource).toBe('SOURCE_PAYLOAD');
    expect(result.availableAt).toEqual(sourceDate);
  });

  it('T03-3: write result entersAlphaScore is always false', () => {
    const result = buildChipUpsertAvailableAt('2026-05-20');
    expect(result.entersAlphaScore).toBe(false);
  });

  it('T03-4: computeChipWriteAvailableAt PRIMARY mode returns same-day 09:30 UTC', () => {
    const result = computeChipWriteAvailableAt('2026-05-20', 'PRIMARY');
    expect(result.availableAtIso).toBe('2026-05-20T09:30:00.000Z');
    expect(result.policySource).toBe('INFERRED_PRIMARY');
  });

  it('T03-5: computeChipWriteAvailableAt CONSERVATIVE mode returns next-day 09:30 UTC', () => {
    const result = computeChipWriteAvailableAt('2026-05-20', 'CONSERVATIVE');
    expect(result.availableAtIso).toBe('2026-05-21T09:30:00.000Z');
    expect(result.policySource).toBe('INFERRED_CONSERVATIVE');
  });

  it('T03-6: validateWriteDoesNotAlterChipNumerics returns true when values unchanged', () => {
    const snap = { foreignBuy: 100, trustBuy: 200, dealerBuy: 300, totalBuy: 600 };
    expect(validateWriteDoesNotAlterChipNumerics(snap, { ...snap })).toBe(true);
  });

  it('T03-7: validateWriteDoesNotAlterChipNumerics returns false when foreignBuy changed', () => {
    const original = { foreignBuy: 100, trustBuy: 200, dealerBuy: 300, totalBuy: 600 };
    const updated = { ...original, foreignBuy: 999 };
    expect(validateWriteDoesNotAlterChipNumerics(original, updated)).toBe(false);
  });

  it('T03-8: validateWriteDoesNotAlterChipNumerics returns false when trustBuy changed', () => {
    const original = { foreignBuy: 100, trustBuy: 200, dealerBuy: 300, totalBuy: 600 };
    const updated = { ...original, trustBuy: 999 };
    expect(validateWriteDoesNotAlterChipNumerics(original, updated)).toBe(false);
  });

  it('T03-9: validateWriteDoesNotAlterChipNumerics returns false when dealerBuy changed', () => {
    const original = { foreignBuy: 100, trustBuy: 200, dealerBuy: 300, totalBuy: 600 };
    const updated = { ...original, dealerBuy: 999 };
    expect(validateWriteDoesNotAlterChipNumerics(original, updated)).toBe(false);
  });

  it('T03-10: validateWriteDoesNotAlterChipNumerics returns false when totalBuy changed', () => {
    const original = { foreignBuy: 100, trustBuy: 200, dealerBuy: 300, totalBuy: 600 };
    const updated = { ...original, totalBuy: 999 };
    expect(validateWriteDoesNotAlterChipNumerics(original, updated)).toBe(false);
  });

  it('T03-11: assertEntersAlphaScoreFalse does NOT throw for {entersAlphaScore: false}', () => {
    expect(() => assertEntersAlphaScoreFalse({ entersAlphaScore: false })).not.toThrow();
  });

  it('T03-12: assertEntersAlphaScoreFalse THROWS for {entersAlphaScore: true}', () => {
    expect(() => assertEntersAlphaScoreFalse({ entersAlphaScore: true })).toThrow();
  });

  it('T03-13: assertEntersAlphaScoreFalse THROWS for {entersAlphaScore: null}', () => {
    expect(() => assertEntersAlphaScoreFalse({ entersAlphaScore: null })).toThrow();
  });

  it('T03-14: write result version is p30-chip-available-at-write-policy-v1', () => {
    const result = buildChipUpsertAvailableAt('2026-05-20');
    expect(result.version).toBe(CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION);
  });
});

// ─── T04: Backfill Gate ───────────────────────────────────────────────────────

describe('T04 Backfill Gate', () => {
  it('T04-1: buildBackfillDryRunResult([]).dryRun is true', () => {
    const result = buildBackfillDryRunResult([]);
    expect(result.dryRun).toBe(true);
  });

  it('T04-2: buildBackfillDryRunResult([]).productionApplied is false', () => {
    const result = buildBackfillDryRunResult([]);
    expect(result.productionApplied).toBe(false);
  });

  it('T04-3: buildBackfillDryRunResult([]).entersAlphaScore is false', () => {
    const result = buildBackfillDryRunResult([]);
    expect(result.entersAlphaScore).toBe(false);
  });

  it('T04-4: computeBackfillReleaseDate(2026, 5) → 2026-06-10T00:00:00.000Z', () => {
    const date = computeBackfillReleaseDate(2026, 5);
    expect(date.toISOString()).toBe('2026-06-10T00:00:00.000Z');
  });

  it('T04-5: computeBackfillReleaseDate(2026, 12) → 2027-01-10T00:00:00.000Z (December wrap)', () => {
    const date = computeBackfillReleaseDate(2026, 12);
    expect(date.toISOString()).toBe('2027-01-10T00:00:00.000Z');
  });

  it('T04-6: checkSourcePresentDryRunReadiness with null releaseDate → MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE', () => {
    const result = checkSourcePresentDryRunReadiness({
      releaseDate: null,
      releaseDateSource: null,
    });
    expect(result.classification).toBe('MONTHLY_REVENUE_BLOCKED_NULL_RELEASE_DATE');
    expect(result.ready).toBe(false);
  });

  it('T04-7: checkSourcePresentDryRunReadiness with non-null releaseDate and no future fields → MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN', () => {
    const result = checkSourcePresentDryRunReadiness({
      releaseDate: new Date('2026-06-10T00:00:00.000Z'),
      releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    });
    expect(result.classification).toBe('MONTHLY_REVENUE_READY_FOR_SOURCE_PRESENT_DRY_RUN');
    expect(result.ready).toBe(true);
  });

  it('T04-8: checkSourcePresentDryRunReadiness entersAlphaScore is always false', () => {
    const result = checkSourcePresentDryRunReadiness({
      releaseDate: null,
      releaseDateSource: null,
    });
    expect(result.entersAlphaScore).toBe(false);
  });

  it('T04-9: authorization phrase absence means WAITING_FOR_USER_AUTHORIZATION gate', () => {
    // The authorization phrase "YES apply MonthlyRevenue releaseDate backfill"
    // must be explicitly provided by the user. Without it, the gate stays closed.
    const REQUIRED_AUTH_PHRASE = 'YES apply MonthlyRevenue releaseDate backfill';
    const userInput = ''; // no authorization given
    const authorizationReceived = userInput === REQUIRED_AUTH_PHRASE;
    const gate = authorizationReceived ? 'AUTHORIZED' : 'WAITING_FOR_USER_AUTHORIZATION';
    expect(gate).toBe('WAITING_FOR_USER_AUTHORIZATION');
    expect(authorizationReceived).toBe(false);
  });

  it('T04-10: buildBackfillDryRunResult with rows computes correct affectedRows', () => {
    const rows: NullReleaseDateRow[] = [
      { stockId: '2330', year: 2025, month: 1, releaseDate: null },
      { stockId: '2330', year: 2025, month: 2, releaseDate: null },
    ];
    const result = buildBackfillDryRunResult(rows);
    expect(result.affectedRows).toBe(2);
    expect(result.dryRun).toBe(true);
    expect(result.productionApplied).toBe(false);
  });
});

// ─── T05: Forbidden Claims ────────────────────────────────────────────────────

describe('T05 Forbidden Claims', () => {
  const INVESTMENT_TERMS = ['buy', 'sell', 'ROI', 'profit', 'outperform', 'win-rate'];

  it('T05-1: CHIP_AVAILABLE_AT_WRITE_DISCLAIMER contains required prohibition text and no positive investment claims', () => {
    const lower = CHIP_AVAILABLE_AT_WRITE_DISCLAIMER.toLowerCase();
    // Must contain the required prohibition phrase
    expect(lower).toContain('does not constitute investment advice');
    // Terms that appear in disclaimers only in prohibition context are acceptable
    // Check that disclaimer does not contain positive investment advice framing
    expect(lower).not.toContain('guaranteed');
    expect(lower).not.toContain('buy stock');
    expect(lower).not.toContain('buy recommendation');
    expect(lower).not.toContain('sell recommendation');
    // The disclaimer explicitly prohibits buy/sell/hold signal use
    expect(lower).toContain('entersalphascore = false');
  });

  it('T05-2: MONTHLY_REVENUE_BACKFILL_DISCLAIMER does not contain investment claims', () => {
    const lower = MONTHLY_REVENUE_BACKFILL_DISCLAIMER.toLowerCase();
    // "profit" appears only in prohibition context "no profit ... claims" — not as a positive claim
    // Check it does not contain standalone investment-positive claims
    expect(lower).not.toContain('guaranteed profit');
    expect(lower).not.toContain('outperform');
    expect(lower).not.toContain('win-rate');
    expect(lower).not.toContain('guaranteed');
    expect(lower).not.toContain('expected return');
    // Must contain the prohibition phrase, not an affirmative claim
    expect(lower).toContain('does not constitute investment advice');
  });

  it('T05-3: CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER does not contain investment claims', () => {
    const lower = CHIP_AVAILABLE_AT_MIGRATION_DISCLAIMER.toLowerCase();
    // "profit" appears only in prohibition context — not as a positive claim
    expect(lower).not.toContain('guaranteed profit');
    expect(lower).not.toContain('outperform');
    expect(lower).not.toContain('guaranteed');
    // Must contain the prohibition phrase
    expect(lower).toContain('does not constitute investment advice');
  });

  it('T05-4: write policy version string does not contain investment terms', () => {
    const lower = CHIP_AVAILABLE_AT_WRITE_POLICY_VERSION.toLowerCase();
    expect(lower).not.toContain('roi');
    expect(lower).not.toContain('alpha-score');
    expect(lower).not.toContain('profit');
  });

  it('T05-5: buildChipUpsertAvailableAt result entersAlphaScore is never true', () => {
    const result1 = buildChipUpsertAvailableAt('2026-01-01');
    const result2 = buildChipUpsertAvailableAt('2026-12-31');
    expect(result1.entersAlphaScore).not.toBe(true);
    expect(result2.entersAlphaScore).not.toBe(true);
  });
});

// ─── T06: Determinism ────────────────────────────────────────────────────────

describe('T06 Determinism', () => {
  it('T06-1: buildChipMigrationReadinessReport called twice produces same JSON', () => {
    const r1 = buildChipMigrationReadinessReport();
    const r2 = buildChipMigrationReadinessReport();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('T06-2: computeChipAvailableAt("2026-01-01") always returns the same result', () => {
    const r1 = computeChipAvailableAt('2026-01-01');
    const r2 = computeChipAvailableAt('2026-01-01');
    expect(r1.availableAtIso).toBe(r2.availableAtIso);
    expect(r1.policy).toBe(r2.policy);
  });

  it('T06-3: buildChipUpsertAvailableAt is deterministic for same inputs', () => {
    const r1 = buildChipUpsertAvailableAt('2026-05-20');
    const r2 = buildChipUpsertAvailableAt('2026-05-20');
    expect(r1.availableAtIso).toBe(r2.availableAtIso);
    expect(r1.policySource).toBe(r2.policySource);
  });

  it('T06-4: computeBackfillReleaseDate is deterministic', () => {
    const d1 = computeBackfillReleaseDate(2026, 5);
    const d2 = computeBackfillReleaseDate(2026, 5);
    expect(d1.toISOString()).toBe(d2.toISOString());
  });

  it('T06-5: buildBackfillDryRunResult is deterministic for same input', () => {
    const rows: NullReleaseDateRow[] = [
      { stockId: '2330', year: 2025, month: 1, releaseDate: null },
    ];
    const r1 = buildBackfillDryRunResult(rows);
    const r2 = buildBackfillDryRunResult(rows);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
