/**
 * p16monthly_revenue_dry_run_utils.test.ts
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Test / governance only.
 */

import {
  validateDryRunApprovalToken,
  buildDryRunMigrationSpec,
  buildDryRunRollbackSpec,
  applyMigrationToFixtureSchema,
  applyRollbackToFixtureSchema,
  validateFixtureMonthlyRevenueSchema,
  validateDryRunBackfill,
  validateDryRunQueryGate,
  summarizeDryRunResult,
  scanForbiddenClaims,
  EXPECTED_APPROVAL_TOKEN,
  INFERRED_SOURCE,
  INFERRED_CONFIDENCE,
  ALLOWED_MIGRATION_TARGETS,
  type FixtureSchema,
} from '../P16MonthlyRevenueDryRunUtils';

// ─────────────────────────────────────────────────────────────
// validateDryRunApprovalToken
// ─────────────────────────────────────────────────────────────
describe('validateDryRunApprovalToken', () => {
  it('rejects missing token', () => {
    const r = validateDryRunApprovalToken({ token: undefined });
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('rejects null token', () => {
    const r = validateDryRunApprovalToken({ token: null });
    expect(r.valid).toBe(false);
  });

  it('rejects empty string token', () => {
    const r = validateDryRunApprovalToken({ token: '' });
    expect(r.valid).toBe(false);
  });

  it('rejects wrong token value', () => {
    const r = validateDryRunApprovalToken({ token: 'WRONG_TOKEN' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain(EXPECTED_APPROVAL_TOKEN);
  });

  it('accepts P14_APPROVE_SCHEMA_MIGRATION_DRY_RUN_ONLY', () => {
    const r = validateDryRunApprovalToken({ token: EXPECTED_APPROVAL_TOKEN });
    expect(r.valid).toBe(true);
    expect(r.token).toBe(EXPECTED_APPROVAL_TOKEN);
    expect(r.error).toBeUndefined();
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    validateDryRunApprovalToken({ token: EXPECTED_APPROVAL_TOKEN });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// buildDryRunMigrationSpec
// ─────────────────────────────────────────────────────────────
describe('buildDryRunMigrationSpec', () => {
  const p14Draft = { tableName: 'MonthlyRevenue' };

  it('productionApplyAllowed is always false', () => {
    const spec = buildDryRunMigrationSpec(p14Draft, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    expect(spec.productionApplyAllowed).toBe(false);
  });

  it('dryRunOnly is always true', () => {
    const spec = buildDryRunMigrationSpec(p14Draft, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    expect(spec.dryRunOnly).toBe(true);
  });

  it('migrationTarget defaults to fixture', () => {
    const spec = buildDryRunMigrationSpec(p14Draft, {
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    expect(ALLOWED_MIGRATION_TARGETS).toContain(spec.migrationTarget);
    expect(spec.migrationTarget).toBe('fixture');
  });

  it('migrationTarget must be fixture/temp/isolated', () => {
    expect(() =>
      buildDryRunMigrationSpec(p14Draft, {
        migrationTarget: 'production' as any,
        approvalToken: EXPECTED_APPROVAL_TOKEN,
      })
    ).toThrow();
  });

  it('adds exactly releaseDate, releaseDateSource, releaseDateConfidence', () => {
    const spec = buildDryRunMigrationSpec(p14Draft, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    const names = spec.fieldsToAdd.map(f => f.name).sort();
    expect(names).toEqual(['releaseDate', 'releaseDateConfidence', 'releaseDateSource']);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    buildDryRunMigrationSpec(p14Draft, { approvalToken: EXPECTED_APPROVAL_TOKEN });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// applyMigrationToFixtureSchema / applyRollbackToFixtureSchema
// ─────────────────────────────────────────────────────────────
describe('applyMigrationToFixtureSchema', () => {
  const baseSchema: FixtureSchema = {
    tableName: 'MonthlyRevenue',
    fields: [
      { name: 'id', type: 'String', nullable: false },
      { name: 'stockId', type: 'String', nullable: false },
      { name: 'year', type: 'Int', nullable: false },
      { name: 'month', type: 'Int', nullable: false },
      { name: 'revenue', type: 'Float', nullable: true },
    ],
  };

  it('adds releaseDate to fixture schema', () => {
    const spec = buildDryRunMigrationSpec({ tableName: 'MonthlyRevenue' }, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    const result = applyMigrationToFixtureSchema(baseSchema, spec);
    const names = result.fields.map(f => f.name);
    expect(names).toContain('releaseDate');
    expect(names).toContain('releaseDateSource');
    expect(names).toContain('releaseDateConfidence');
  });

  it('preserves original fields after migration', () => {
    const spec = buildDryRunMigrationSpec({ tableName: 'MonthlyRevenue' }, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    const result = applyMigrationToFixtureSchema(baseSchema, spec);
    for (const origField of baseSchema.fields) {
      expect(result.fields.some(f => f.name === origField.name)).toBe(true);
    }
  });

  it('throws if productionApplyAllowed is not false', () => {
    const spec = buildDryRunMigrationSpec({ tableName: 'MonthlyRevenue' }, {
      migrationTarget: 'fixture',
      approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    expect(() =>
      applyMigrationToFixtureSchema(baseSchema, { ...spec, productionApplyAllowed: true as any })
    ).toThrow();
  });
});

describe('applyRollbackToFixtureSchema', () => {
  const baseSchema: FixtureSchema = {
    tableName: 'MonthlyRevenue',
    fields: [
      { name: 'id', type: 'String', nullable: false },
      { name: 'stockId', type: 'String', nullable: false },
      { name: 'year', type: 'Int', nullable: false },
      { name: 'month', type: 'Int', nullable: false },
      { name: 'revenue', type: 'Float', nullable: true },
    ],
  };

  it('removes releaseDate/releaseDateSource/releaseDateConfidence after rollback', () => {
    const migSpec = buildDryRunMigrationSpec({ tableName: 'MonthlyRevenue' }, {
      migrationTarget: 'fixture', approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    const rollSpec = buildDryRunRollbackSpec({ tableName: 'MonthlyRevenue' }, { migrationTarget: 'fixture' });
    const migrated = applyMigrationToFixtureSchema(baseSchema, migSpec);
    const rolledBack = applyRollbackToFixtureSchema(migrated, rollSpec);
    const names = rolledBack.fields.map(f => f.name);
    expect(names).not.toContain('releaseDate');
    expect(names).not.toContain('releaseDateSource');
    expect(names).not.toContain('releaseDateConfidence');
  });

  it('restores original fields after rollback', () => {
    const migSpec = buildDryRunMigrationSpec({ tableName: 'MonthlyRevenue' }, {
      migrationTarget: 'fixture', approvalToken: EXPECTED_APPROVAL_TOKEN,
    });
    const rollSpec = buildDryRunRollbackSpec({ tableName: 'MonthlyRevenue' }, { migrationTarget: 'fixture' });
    const migrated = applyMigrationToFixtureSchema(baseSchema, migSpec);
    const rolledBack = applyRollbackToFixtureSchema(migrated, rollSpec);
    for (const origField of baseSchema.fields) {
      expect(rolledBack.fields.some(f => f.name === origField.name)).toBe(true);
    }
  });

  it('throws if productionApplyAllowed is not false on rollback', () => {
    const rollSpec = buildDryRunRollbackSpec({ tableName: 'MonthlyRevenue' }, { migrationTarget: 'fixture' });
    expect(() =>
      applyRollbackToFixtureSchema(baseSchema, { ...rollSpec, productionApplyAllowed: true as any })
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// validateFixtureMonthlyRevenueSchema
// ─────────────────────────────────────────────────────────────
describe('validateFixtureMonthlyRevenueSchema', () => {
  it('passes when all 3 fields present', () => {
    const schema: FixtureSchema = {
      tableName: 'MonthlyRevenue',
      fields: [
        { name: 'id', type: 'String', nullable: false },
        { name: 'releaseDate', type: 'DateTime', nullable: true },
        { name: 'releaseDateSource', type: 'String', nullable: true },
        { name: 'releaseDateConfidence', type: 'String', nullable: true },
      ],
    };
    const r = validateFixtureMonthlyRevenueSchema(schema);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('fails when releaseDate missing', () => {
    const schema: FixtureSchema = {
      tableName: 'MonthlyRevenue',
      fields: [
        { name: 'id', type: 'String', nullable: false },
        { name: 'releaseDateSource', type: 'String', nullable: true },
        { name: 'releaseDateConfidence', type: 'String', nullable: true },
      ],
    };
    const r = validateFixtureMonthlyRevenueSchema(schema);
    expect(r.valid).toBe(false);
    expect(r.hasReleaseDate).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// validateDryRunBackfill
// ─────────────────────────────────────────────────────────────
describe('validateDryRunBackfill', () => {
  it('infers Jan 2024 → 2024-02-10', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: 2024, month: 1, revenue: 100, releaseDate: null },
    ]);
    const r = result.results[0];
    expect(r.action).toBe('INFERRED');
    expect(r.releaseDate).toBe('2024-02-10');
    expect(r.releaseDateSource).toBe(INFERRED_SOURCE);
    expect(r.releaseDateConfidence).toBe(INFERRED_CONFIDENCE);
  });

  it('infers Dec 2024 → 2025-01-10', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: 2024, month: 12, revenue: 100, releaseDate: null },
    ]);
    const r = result.results[0];
    expect(r.action).toBe('INFERRED');
    expect(r.releaseDate).toBe('2025-01-10');
  });

  it('preserves explicit non-inferred releaseDate', () => {
    const result = validateDryRunBackfill([
      {
        stockId: 'X', year: 2024, month: 3,
        releaseDate: '2024-04-08', releaseDateSource: 'OFFICIAL_TWSE',
      },
    ]);
    const r = result.results[0];
    expect(r.action).toBe('PRESERVED');
    expect(r.releaseDate).toBe('2024-04-08');
  });

  it('skips record with missing year', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: null, month: 5, releaseDate: null },
    ]);
    expect(result.results[0].action).toBe('SKIPPED');
    expect(result.results[0].skipReason).toMatch(/year/);
  });

  it('skips record with missing month', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: 2024, month: null, releaseDate: null },
    ]);
    expect(result.results[0].action).toBe('SKIPPED');
    expect(result.results[0].skipReason).toMatch(/month/);
  });

  it('skips record with invalid month (13)', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: 2024, month: 13, releaseDate: null },
    ]);
    expect(result.results[0].action).toBe('SKIPPED');
  });

  it('skips record with invalid month (0)', () => {
    const result = validateDryRunBackfill([
      { stockId: 'X', year: 2024, month: 0, releaseDate: null },
    ]);
    expect(result.results[0].action).toBe('SKIPPED');
  });

  it('outcome/returnPct/realizedReturnClass not used for backfill — warned and inferred from period', () => {
    const result = validateDryRunBackfill([
      {
        stockId: 'X', year: 2024, month: 2, releaseDate: null,
        returnPct: 0.15, realizedReturnClass: 'WIN',
      },
    ]);
    const r = result.results[0];
    // Should be INFERRED based on period, NOT from outcome fields
    expect(r.action).toBe('INFERRED');
    expect(r.releaseDate).toBe('2024-03-10'); // year=2024, month=2 → 2024-03-10
    expect(result.warnings.some(w => w.includes('returnPct'))).toBe(true);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    validateDryRunBackfill([{ stockId: 'X', year: 2024, month: 6, releaseDate: null }]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('productionDbWritten is always false', () => {
    const result = validateDryRunBackfill([]);
    expect(result.productionDbWritten).toBe(false);
  });

  it('dryRunOnly is always true', () => {
    const result = validateDryRunBackfill([]);
    expect(result.dryRunOnly).toBe(true);
  });

  it('does not modify P0/P1/P3/P4 corpus (structural — no file writes)', () => {
    // validateDryRunBackfill is a pure function that does not write files
    const fs = require('fs');
    const spy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    validateDryRunBackfill([{ stockId: 'X', year: 2024, month: 1, releaseDate: null }]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// validateDryRunQueryGate
// ─────────────────────────────────────────────────────────────
describe('validateDryRunQueryGate', () => {
  it('unavailable when asOfDate < releaseDate', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: 'OFFICIAL_TWSE' },
      '2024-02-09'
    );
    expect(r.available).toBe(false);
  });

  it('available when asOfDate === releaseDate (exact boundary)', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: 'OFFICIAL_TWSE' },
      '2024-02-10'
    );
    expect(r.available).toBe(true);
  });

  it('available when asOfDate > releaseDate', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: 'OFFICIAL_TWSE' },
      '2024-03-01'
    );
    expect(r.available).toBe(true);
  });

  it('inferred releaseDate with allowInferred=true → available after date', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: INFERRED_SOURCE },
      '2024-02-11',
      { allowInferred: true }
    );
    expect(r.available).toBe(true);
  });

  it('inferred releaseDate with allowInferred=false → unavailable', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: INFERRED_SOURCE },
      '2024-02-11',
      { allowInferred: false }
    );
    expect(r.available).toBe(false);
  });

  it('null releaseDate and no inference → unavailable', () => {
    const r = validateDryRunQueryGate(
      { stockId: 'X', releaseDate: null, releaseDateSource: null },
      '2024-02-15'
    );
    expect(r.available).toBe(false);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    validateDryRunQueryGate(
      { stockId: 'X', releaseDate: '2024-02-10', releaseDateSource: 'OFFICIAL_TWSE' },
      '2024-02-10'
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────
// summarizeDryRunResult
// ─────────────────────────────────────────────────────────────
describe('summarizeDryRunResult', () => {
  it('returns PASS when all gates pass', () => {
    const summary = summarizeDryRunResult({
      migrationStatus: 'PASS',
      rollbackStatus: 'PASS',
      backfillStatus: 'PASS',
      queryGateStatus: 'PASS',
    });
    expect(summary.validationStatus).toBe('PASS');
    expect(summary.productionApplyAllowed).toBe(false);
    expect(summary.dryRunOnly).toBe(true);
    expect(summary.productionDbWritten).toBe(false);
  });

  it('returns FAIL when any gate fails', () => {
    const summary = summarizeDryRunResult({
      migrationStatus: 'PASS',
      rollbackStatus: 'FAIL',
      backfillStatus: 'PASS',
      queryGateStatus: 'PASS',
    });
    expect(summary.validationStatus).toBe('FAIL');
  });

  it('productionApplyAllowed is always false', () => {
    const summary = summarizeDryRunResult({
      migrationStatus: 'PASS', rollbackStatus: 'PASS',
      backfillStatus: 'PASS', queryGateStatus: 'PASS',
    });
    expect(summary.productionApplyAllowed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// scanForbiddenClaims
// ─────────────────────────────────────────────────────────────
describe('scanForbiddenClaims', () => {
  it('catches ROI claim', () => {
    const hits = scanForbiddenClaims('This system delivers high ROI for investors.');
    expect(hits.some(h => h.label === 'ROI')).toBe(true);
  });

  it('catches win-rate claim', () => {
    const hits = scanForbiddenClaims('Achieves 70% win-rate consistently.');
    expect(hits.some(h => h.label === 'win-rate')).toBe(true);
  });

  it('catches alpha claim (non-alphaScore)', () => {
    const hits = scanForbiddenClaims('Generates positive alpha over benchmark.');
    expect(hits.some(h => h.label === 'alpha')).toBe(true);
  });

  it('does not flag alphaScore field name as alpha', () => {
    const hits = scanForbiddenClaims('alphaScore: 0.85 — field used for scoring bucket.');
    expect(hits.some(h => h.label === 'alpha')).toBe(false);
  });

  it('catches edge claim (non-hedge context)', () => {
    const hits = scanForbiddenClaims('Provides a trading edge over market participants.');
    expect(hits.some(h => h.label === 'edge')).toBe(true);
  });

  it('does not flag edge case or cutting-edge as edge', () => {
    const hits = scanForbiddenClaims('This is an edge case that requires special handling.');
    expect(hits.some(h => h.label === 'edge')).toBe(false);
  });

  it('catches profit claim', () => {
    const hits = scanForbiddenClaims('Expected profit of 25% per year.');
    expect(hits.some(h => h.label === 'profit')).toBe(true);
  });

  it('catches outperform claim', () => {
    const hits = scanForbiddenClaims('Strategy will outperform index by 10%.');
    expect(hits.some(h => h.label === 'outperform')).toBe(true);
  });

  it('catches buy claim', () => {
    const hits = scanForbiddenClaims('Signal: buy when score > 0.8.');
    expect(hits.some(h => h.label === 'buy')).toBe(true);
  });

  it('catches sell claim', () => {
    const hits = scanForbiddenClaims('Trigger a sell order at threshold.');
    expect(hits.some(h => h.label === 'sell')).toBe(true);
  });

  it('catches guaranteed claim', () => {
    const hits = scanForbiddenClaims('Returns are guaranteed by algorithm.');
    expect(hits.some(h => h.label === 'guaranteed')).toBe(true);
  });

  it('does not flag disclaimer lines', () => {
    const hits = scanForbiddenClaims(
      'DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge.'
    );
    expect(hits).toHaveLength(0);
  });

  it('does not flag governance-only non-goal declarations', () => {
    const hits = scanForbiddenClaims(
      'non-goal: Does not compute ROI or guarantee any return.'
    );
    expect(hits).toHaveLength(0);
  });

  it('returns empty array for clean text', () => {
    const hits = scanForbiddenClaims(
      'This migration adds releaseDate to the MonthlyRevenue table. Dry-run only. No production DB writes.'
    );
    expect(hits).toHaveLength(0);
  });
});
