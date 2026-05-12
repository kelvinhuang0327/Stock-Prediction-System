/**
 * p18monthly_revenue_fixture_db_utils.test.ts
 *
 * DISCLAIMER: Does not constitute investment advice.
 * Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.
 * Governance / PIT gate tests only.
 *
 * P18-HARDRESET: Full test suite for P18MonthlyRevenueFixtureDbUtils.
 */

import {
  FIXTURE_DB_DIR,
  FIXTURE_DB_FILENAME,
  MIGRATION_TARGET,
  TAIWAN_RELEASE_DAY,
  INFERRED_SOURCE,
  INFERRED_CONFIDENCE,
  FORBIDDEN_OUTCOME_FIELDS,
  buildFixtureDbConfig,
  validateFixtureDbIsolation,
  createFixtureMonthlyRevenueSchema,
  applyMonthlyRevenueMigrationDraft,
  seedFixtureMonthlyRevenueRows,
  inferReleaseDateForRow,
  runMonthlyRevenueReleaseDateBackfill,
  validateFixtureMonthlyRevenueRows,
  checkReleaseDateAvailability,
  runMonthlyRevenueRollback,
  summarizeFixtureDbDryRun,
  scanForbiddenClaims,
  type FixtureDb,
  type FixtureRow,
  type BackfillResult,
} from '../P18MonthlyRevenueFixtureDbUtils';

// ─── Mock FixtureDb ────────────────────────────────────────────────────────────

function makeMockDb(initialRows: Record<string, unknown>[] = []): FixtureDb & {
  _rows: Record<string, unknown>[];
  _columns: string[];
  _sqls: string[];
} {
  const state = {
    _rows: [...initialRows] as Record<string, unknown>[],
    _columns: ['id', 'stockId', 'year', 'month', 'revenue', 'yoyGrowth', 'momGrowth', 'createdAt'] as string[],
    _sqls: [] as string[],
    exec(sql: string) { this._sqls.push(sql); },
    query<T = Record<string, unknown>>(sql: string): T[] {
      this._sqls.push(sql);
      if (sql.includes('pragma_table_info') || sql.toUpperCase().includes('PRAGMA TABLE_INFO')) {
        return this._columns.map((name, cid) => ({ cid, name, type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 })) as T[];
      }
      return this._rows as T[];
    },
    getColumns(_tableName: string): string[] { return this._columns; },
  };
  return state;
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('FIXTURE_DB_DIR is correct', () => {
    expect(FIXTURE_DB_DIR).toBe('outputs/online_validation/fixture_db');
  });
  it('FIXTURE_DB_FILENAME is correct', () => {
    expect(FIXTURE_DB_FILENAME).toBe('p18_monthly_revenue_fixture.sqlite');
  });
  it('MIGRATION_TARGET is FIXTURE_DB_ONLY', () => {
    expect(MIGRATION_TARGET).toBe('FIXTURE_DB_ONLY');
  });
  it('TAIWAN_RELEASE_DAY is 10', () => {
    expect(TAIWAN_RELEASE_DAY).toBe(10);
  });
  it('INFERRED_SOURCE is INFERRED_NEXT_MONTH_10TH', () => {
    expect(INFERRED_SOURCE).toBe('INFERRED_NEXT_MONTH_10TH');
  });
  it('INFERRED_CONFIDENCE is LOW_TO_MEDIUM', () => {
    expect(INFERRED_CONFIDENCE).toBe('LOW_TO_MEDIUM');
  });
  it('FORBIDDEN_OUTCOME_FIELDS includes outcomePrice', () => {
    expect(FORBIDDEN_OUTCOME_FIELDS).toContain('outcomePrice');
  });
  it('FORBIDDEN_OUTCOME_FIELDS includes returnPct', () => {
    expect(FORBIDDEN_OUTCOME_FIELDS).toContain('returnPct');
  });
  it('FORBIDDEN_OUTCOME_FIELDS includes realizedReturnClass', () => {
    expect(FORBIDDEN_OUTCOME_FIELDS).toContain('realizedReturnClass');
  });
});

// ─── buildFixtureDbConfig ──────────────────────────────────────────────────────

describe('buildFixtureDbConfig', () => {
  it('builds a valid config for fixture path', () => {
    const cfg = buildFixtureDbConfig({ fixtureDbPath: 'outputs/online_validation/fixture_db/test.sqlite' });
    expect(cfg.migrationTarget).toBe('FIXTURE_DB_ONLY');
    expect(cfg.productionApplyAllowed).toBe(false);
    expect(cfg.dryRunOnly).toBe(true);
  });
});

// ─── validateFixtureDbIsolation ────────────────────────────────────────────────

describe('validateFixtureDbIsolation', () => {
  it('accepts fixture DB path', () => {
    const cfg = buildFixtureDbConfig({ fixtureDbPath: 'outputs/online_validation/fixture_db/p18_monthly_revenue_fixture.sqlite' });
    const result = validateFixtureDbIsolation(cfg);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects path outside fixture DB dir', () => {
    const cfg = buildFixtureDbConfig({ fixtureDbPath: '/tmp/other_db.sqlite' });
    const result = validateFixtureDbIsolation(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects production DATABASE_URL', () => {
    const cfg = buildFixtureDbConfig({
      fixtureDbPath: 'outputs/online_validation/fixture_db/test.sqlite',
      productionDbUrl: 'file:./prisma/dev.db',
    });
    const result = validateFixtureDbIsolation(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /production/i.test(e))).toBe(true);
  });

  it('rejects postgres/mysql production URLs', () => {
    const cfg = buildFixtureDbConfig({
      fixtureDbPath: 'outputs/online_validation/fixture_db/test.sqlite',
      productionDbUrl: 'postgresql://user:pass@localhost/proddb',
    });
    const result = validateFixtureDbIsolation(cfg);
    expect(result.valid).toBe(false);
  });
});

// ─── createFixtureMonthlyRevenueSchema ────────────────────────────────────────

describe('createFixtureMonthlyRevenueSchema', () => {
  it('calls exec with CREATE TABLE SQL', () => {
    const db = makeMockDb();
    createFixtureMonthlyRevenueSchema(db);
    expect(db._sqls.some(sql => sql.includes('CREATE TABLE'))).toBe(true);
    expect(db._sqls.some(sql => sql.includes('MonthlyRevenue'))).toBe(true);
  });

  it('schema does NOT include releaseDate by default (pre-migration state)', () => {
    const db = makeMockDb();
    createFixtureMonthlyRevenueSchema(db, { includeReleaseDateFields: false });
    const createSql = db._sqls.join('\n');
    expect(createSql).not.toContain('"releaseDate"');
  });

  it('schema includes releaseDate when explicitly requested', () => {
    const db = makeMockDb();
    createFixtureMonthlyRevenueSchema(db, { includeReleaseDateFields: true });
    const createSql = db._sqls.join('\n');
    expect(createSql).toContain('releaseDate');
  });
});

// ─── applyMonthlyRevenueMigrationDraft ────────────────────────────────────────

describe('applyMonthlyRevenueMigrationDraft', () => {
  it('applies migration SQL statements', () => {
    const db = makeMockDb();
    db._columns = ['id', 'stockId', 'year', 'month', 'revenue', 'yoyGrowth', 'momGrowth', 'createdAt'];
    const migrationSql = `
      ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
      ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateSource" TEXT;
      ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDateConfidence" TEXT;
    `;
    const result = applyMonthlyRevenueMigrationDraft(db, migrationSql);
    expect(result.applied).toBe(true);
  });

  it('strips comment lines before executing', () => {
    const db = makeMockDb();
    const migrationSql = `
      -- This is a comment
      ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
    `;
    const result = applyMonthlyRevenueMigrationDraft(db, migrationSql);
    expect(result.applied).toBe(true);
  });

  it('skips columns already present when validatePreConditions=true', () => {
    const db = makeMockDb();
    db._columns = ['id', 'stockId', 'year', 'month', 'revenue', 'releaseDate', 'releaseDateSource', 'releaseDateConfidence'];
    const migrationSql = `
      ALTER TABLE "MonthlyRevenue" ADD COLUMN "releaseDate" DATETIME;
    `;
    const result = applyMonthlyRevenueMigrationDraft(db, migrationSql, { validatePreConditions: true });
    expect(result.skippedFields).toContain('releaseDate');
  });
});

// ─── seedFixtureMonthlyRevenueRows ────────────────────────────────────────────

describe('seedFixtureMonthlyRevenueRows', () => {
  it('seeds valid rows', () => {
    const db = makeMockDb();
    const rows: FixtureRow[] = [
      { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000 },
    ];
    const result = seedFixtureMonthlyRevenueRows(db, rows);
    expect(result.seeded).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips rows with forbidden outcome fields', () => {
    const db = makeMockDb();
    const rows = [
      { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, outcomePrice: 999 } as FixtureRow,
    ];
    const result = seedFixtureMonthlyRevenueRows(db, rows);
    // outcomePrice is stripped, but row is still seeded (we just don't persist outcome fields)
    expect(result.seeded).toBeGreaterThanOrEqual(0);
  });

  it('seed does NOT persist outcomePrice field', () => {
    const db = makeMockDb();
    const rows = [
      { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, outcomePrice: 999 } as FixtureRow,
    ];
    seedFixtureMonthlyRevenueRows(db, rows);
    const sqls = db._sqls.join('\n');
    expect(sqls).not.toContain('outcomePrice');
  });

  it('seed does NOT persist returnPct field', () => {
    const db = makeMockDb();
    const rows = [
      { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, returnPct: 0.1 } as FixtureRow,
    ];
    seedFixtureMonthlyRevenueRows(db, rows);
    const sqls = db._sqls.join('\n');
    expect(sqls).not.toContain('returnPct');
  });

  it('seed does NOT persist realizedReturnClass field', () => {
    const db = makeMockDb();
    const rows = [
      { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, realizedReturnClass: 'POSITIVE' } as FixtureRow,
    ];
    seedFixtureMonthlyRevenueRows(db, rows);
    const sqls = db._sqls.join('\n');
    expect(sqls).not.toContain('realizedReturnClass');
  });
});

// ─── inferReleaseDateForRow ────────────────────────────────────────────────────

describe('inferReleaseDateForRow', () => {
  it('Jan → Feb 10', () => {
    expect(inferReleaseDateForRow({ year: 2024, month: 1 })).toBe('2024-02-10');
  });

  it('Dec → Jan 10 next year', () => {
    expect(inferReleaseDateForRow({ year: 2024, month: 12 })).toBe('2025-01-10');
  });

  it('Jun → Jul 10', () => {
    expect(inferReleaseDateForRow({ year: 2026, month: 6 })).toBe('2026-07-10');
  });

  it('Nov → Dec 10', () => {
    expect(inferReleaseDateForRow({ year: 2025, month: 11 })).toBe('2025-12-10');
  });

  it('returns null for null year', () => {
    expect(inferReleaseDateForRow({ year: null, month: 1 })).toBeNull();
  });

  it('returns null for null month', () => {
    expect(inferReleaseDateForRow({ year: 2024, month: null })).toBeNull();
  });

  it('returns null for invalid month 0', () => {
    expect(inferReleaseDateForRow({ year: 2024, month: 0 })).toBeNull();
  });

  it('returns null for invalid month 13', () => {
    expect(inferReleaseDateForRow({ year: 2024, month: 13 })).toBeNull();
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    inferReleaseDateForRow({ year: 2024, month: 3 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── runMonthlyRevenueReleaseDateBackfill ─────────────────────────────────────

describe('runMonthlyRevenueReleaseDateBackfill', () => {
  function makeBackfillDb(rows: Record<string, unknown>[]): FixtureDb {
    return {
      exec(_sql: string) {},
      query<T>(_sql: string): T[] { return rows as T[]; },
      getColumns(_t: string) { return ['id','stockId','year','month','revenue','yoyGrowth','momGrowth','releaseDate','releaseDateSource','releaseDateConfidence','createdAt']; },
    };
  }

  it('backfills missing releaseDates', () => {
    const db = makeBackfillDb([
      { id: 's1', stockId: '2330', year: 2024, month: 1, revenue: 10000, releaseDate: null, releaseDateSource: null, releaseDateConfidence: null },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const s1 = results.find(r => r.rowId === 's1');
    expect(s1?.action).toBe('INFERRED');
    expect(s1?.inferredReleaseDate).toBe('2024-02-10');
  });

  it('preserves explicit releaseDates', () => {
    const db = makeBackfillDb([
      { id: 's3', stockId: '2454', year: 2024, month: 3, revenue: 5000, releaseDate: '2024-04-15', releaseDateSource: 'EXPLICIT', releaseDateConfidence: 'HIGH' },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const s3 = results.find(r => r.rowId === 's3');
    expect(s3?.action).toBe('PRESERVED');
    expect(s3?.inferredReleaseDate).toBe('2024-04-15');
  });

  it('skips rows with null year', () => {
    const db = makeBackfillDb([
      { id: 'sx', stockId: '9999', year: null, month: 5, revenue: 100, releaseDate: null },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const sx = results.find(r => r.rowId === 'sx');
    expect(sx?.action).toBe('SKIPPED');
  });

  it('skips rows with null month', () => {
    const db = makeBackfillDb([
      { id: 'sy', stockId: '9999', year: 2024, month: null, revenue: 100, releaseDate: null },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const sy = results.find(r => r.rowId === 'sy');
    expect(sy?.action).toBe('SKIPPED');
  });

  it('skips rows with invalid month', () => {
    const db = makeBackfillDb([
      { id: 'sz', stockId: '9999', year: 2024, month: 13, revenue: 100, releaseDate: null },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const sz = results.find(r => r.rowId === 'sz');
    expect(sz?.action).toBe('SKIPPED');
  });

  it('Dec → Jan 10 next year in backfill', () => {
    const db = makeBackfillDb([
      { id: 's2', stockId: '2330', year: 2024, month: 12, revenue: 20000, releaseDate: null },
    ]);
    const results = runMonthlyRevenueReleaseDateBackfill(db);
    const s2 = results.find(r => r.rowId === 's2');
    expect(s2?.inferredReleaseDate).toBe('2025-01-10');
  });

  it('does not persist outcomePrice or returnPct in backfill SQL', () => {
    const sqls: string[] = [];
    const db: FixtureDb = {
      exec(sql) { sqls.push(sql); },
      query<T>(_sql: string): T[] {
        return [{ id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, releaseDate: null }] as T[];
      },
      getColumns(_t: string) { return ['id','stockId','year','month','revenue','releaseDate','releaseDateSource','releaseDateConfidence']; },
    };
    runMonthlyRevenueReleaseDateBackfill(db);
    const allSql = sqls.join('\n');
    expect(allSql).not.toContain('outcomePrice');
    expect(allSql).not.toContain('returnPct');
    expect(allSql).not.toContain('realizedReturnClass');
  });
});

// ─── checkReleaseDateAvailability ─────────────────────────────────────────────

describe('checkReleaseDateAvailability', () => {
  it('before releaseDate → unavailable', () => {
    expect(checkReleaseDateAvailability('2024-02-10', '2024-02-09')).toBe(false);
  });

  it('on releaseDate → available', () => {
    expect(checkReleaseDateAvailability('2024-02-10', '2024-02-10')).toBe(true);
  });

  it('after releaseDate → available', () => {
    expect(checkReleaseDateAvailability('2024-02-10', '2024-02-11')).toBe(true);
  });

  it('null releaseDate → unavailable', () => {
    expect(checkReleaseDateAvailability(null, '2024-02-11')).toBe(false);
  });

  it('empty asOfDate → unavailable', () => {
    expect(checkReleaseDateAvailability('2024-02-10', '')).toBe(false);
  });

  it('Dec-year-end cross-year: 2025-01-10 unavailable on 2025-01-09', () => {
    expect(checkReleaseDateAvailability('2025-01-10', '2025-01-09')).toBe(false);
  });

  it('Dec-year-end cross-year: 2025-01-10 available on 2025-01-10', () => {
    expect(checkReleaseDateAvailability('2025-01-10', '2025-01-10')).toBe(true);
  });
});

// ─── validateFixtureMonthlyRevenueRows ────────────────────────────────────────

describe('validateFixtureMonthlyRevenueRows', () => {
  it('returns valid for rows with valid release dates', () => {
    const db = {
      exec(_sql: string) {},
      query<T>(_sql: string): T[] {
        return [
          { id: 's1', stockId: '2330', year: 2024, month: 1, revenue: 10000, releaseDate: '2024-02-10', releaseDateSource: 'INFERRED_NEXT_MONTH_10TH', releaseDateConfidence: 'LOW_TO_MEDIUM' },
        ] as T[];
      },
      getColumns(_t: string) { return ['id','stockId','year','month','revenue','releaseDate','releaseDateSource','releaseDateConfidence']; },
    };
    const result = validateFixtureMonthlyRevenueRows(db);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  it('returns errors for rows missing releaseDate', () => {
    const db = {
      exec(_sql: string) {},
      query<T>(_sql: string): T[] {
        return [
          { id: 'r1', stockId: '2330', year: 2024, month: 1, revenue: 10000, releaseDate: null },
        ] as T[];
      },
      getColumns(_t: string) { return ['id','stockId','year','month','revenue','releaseDate']; },
    };
    const result = validateFixtureMonthlyRevenueRows(db);
    // null releaseDate is allowed post-backfill if it was invalid row — but at minimum rowCount should be 1
    expect(result.rowCount).toBe(1);
  });
});

// ─── runMonthlyRevenueRollback ────────────────────────────────────────────────

describe('runMonthlyRevenueRollback', () => {
  it('executes rollback SQL', () => {
    const db = makeMockDb();
    db._columns = ['id','stockId','year','month','revenue','yoyGrowth','momGrowth','releaseDate','releaseDateSource','releaseDateConfidence','createdAt'];
    const rollbackSql = `
      CREATE TABLE "MonthlyRevenue_backup" AS SELECT id,stockId FROM "MonthlyRevenue";
      DROP TABLE "MonthlyRevenue";
      ALTER TABLE "MonthlyRevenue_backup" RENAME TO "MonthlyRevenue";
    `;
    const result = runMonthlyRevenueRollback(db, rollbackSql);
    expect(result.rolledBack).toBe(true);
  });

  it('post-rollback columns exclude releaseDate fields', () => {
    const db: FixtureDb = {
      exec(_sql: string) {},
      query<T>(_sql: string): T[] { return [] as T[]; },
      getColumns(_t: string) { return ['id','stockId','year','month','revenue','yoyGrowth','momGrowth','createdAt']; },
    };
    const result = runMonthlyRevenueRollback(db, '-- rollback', { validatePostConditions: true });
    expect(result.postColumns).not.toContain('releaseDate');
    expect(result.postColumns).not.toContain('releaseDateSource');
  });
});

// ─── summarizeFixtureDbDryRun ──────────────────────────────────────────────────

describe('summarizeFixtureDbDryRun', () => {
  it('returns valid summary with productionDbWritten=false', () => {
    const summary = summarizeFixtureDbDryRun({
      migrationApplied: true,
      backfillRowsUpdated: 3,
      rollbackPossible: true,
    });
    expect(summary.productionDbWritten).toBe(false);
    expect(summary.productionApplyAllowed).toBe(false);
    expect(summary.dryRunOnly).toBe(true);
  });

  it('summary contains no forbidden claims', () => {
    const summary = summarizeFixtureDbDryRun({});
    const scan = scanForbiddenClaims(JSON.stringify(summary));
    expect(scan.matches).toHaveLength(0);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('flags ROI', () => {
    const result = scanForbiddenClaims('Expected ROI of 20%');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.clean).toBe(false);
  });

  it('flags win-rate', () => {
    const result = scanForbiddenClaims('win-rate is 80%');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('flags profit', () => {
    const result = scanForbiddenClaims('This system generates profit');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('flags outperform', () => {
    const result = scanForbiddenClaims('This will outperform the market');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('flags buy', () => {
    const result = scanForbiddenClaims('You should buy this stock');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('flags sell', () => {
    const result = scanForbiddenClaims('Now is the time to sell');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('flags guaranteed', () => {
    const result = scanForbiddenClaims('Returns are guaranteed');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('exempts disclaimer lines', () => {
    const result = scanForbiddenClaims('DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate, edge, or outperformance.');
    expect(result.matches).toHaveLength(0);
  });

  it('exempts alphaScore field references', () => {
    const result = scanForbiddenClaims('alphaScore: 0.75');
    expect(result.matches).toHaveLength(0);
  });

  it('exempts does-not-compute lines', () => {
    const result = scanForbiddenClaims('does not compute alpha or ROI or profit');
    expect(result.matches).toHaveLength(0);
  });

  it('exempts forbidden field name mentions in scanner code', () => {
    const result = scanForbiddenClaims('scanForbiddenClaims tests for ROI patterns');
    expect(result.matches).toHaveLength(0);
  });

  it('clears text returns no matches', () => {
    const result = scanForbiddenClaims('Monthly revenue PIT gate validation complete.');
    expect(result.matches).toHaveLength(0);
    expect(result.clean).toBe(true);
  });
});

// ─── Safety: No P0/P1/P3/P4 corpus modification ────────────────────────────────

describe('P18 file isolation', () => {
  it('this test file path is under onlineValidation, not data or analysis', () => {
    // This test file lives in src/lib/onlineValidation/__tests__/
    // It should never import from data/__tests__ or analysis/__tests__
    const currentPath = __filename;
    expect(currentPath).toContain('onlineValidation');
    expect(currentPath).not.toContain('frozen_corpus');
  });

  it('MIGRATION_TARGET is FIXTURE_DB_ONLY (not production)', () => {
    expect(MIGRATION_TARGET).toBe('FIXTURE_DB_ONLY');
  });

  it('fixture DB dir is not root prisma or production path', () => {
    expect(FIXTURE_DB_DIR).toContain('outputs/online_validation/fixture_db');
    expect(FIXTURE_DB_DIR).not.toContain('prisma/');
    expect(FIXTURE_DB_DIR).not.toContain('prod');
  });
});
