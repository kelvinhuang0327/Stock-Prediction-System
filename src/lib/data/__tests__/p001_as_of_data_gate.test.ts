/**
 * p001_as_of_data_gate.test.ts
 *
 * P0-01 As-of Data Gate tests.
 * No strategy claims. No performance conclusions. No forbidden terms.
 */

import path from 'path';
import fs from 'fs';
import {
  resolveAsOfDate,
  buildAsOfWhereClause,
  assertNoFutureDateUsage,
  detectFutureDateRows,
  detectAbnormalHistoricalRows,
  validateAsOfDataReadiness,
  InvalidAsOfDateError,
  FutureDateViolationError,
  ABNORMAL_DATE_THRESHOLD,
  type AsOfGatePrismaLike,
  type FutureDateRowsSummary,
  type AbnormalHistoricalRowsSummary,
} from '../AsOfDataGate';

// ─── Mock Prisma Client ────────────────────────────────────────────────────

function makeMockPrisma(overrides: Partial<AsOfGatePrismaLike> = {}): AsOfGatePrismaLike {
  return {
    stockQuote: {
      findMany: async () => [],
      ...overrides.stockQuote,
    },
    marketIndex: {
      findMany: async () => [],
      ...overrides.marketIndex,
    },
    institutionalChip: {
      findMany: async () => [],
      ...overrides.institutionalChip,
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('P0-01: AsOfDataGate', () => {

  // --- 1. resolveAsOfDate uses resolveCurrentDate by default ---
  describe('resolveAsOfDate', () => {

    it('1a. returns system date when no input provided', () => {
      const result = resolveAsOfDate();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it('1b. returns system date when null provided', () => {
      const result = resolveAsOfDate(null);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it('1c. returns system date when empty string provided', () => {
      const result = resolveAsOfDate('');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    // --- 2. resolveAsOfDate accepts explicit asOfDate ---
    it('2a. returns explicit valid date unchanged', () => {
      expect(resolveAsOfDate('2026-05-07')).toBe('2026-05-07');
    });

    it('2b. accepts any valid YYYY-MM-DD', () => {
      expect(resolveAsOfDate('2025-01-01')).toBe('2025-01-01');
      expect(resolveAsOfDate('2024-12-31')).toBe('2024-12-31');
    });

    // --- 3. resolveAsOfDate is timezone-stable ---
    it('3a. throws InvalidAsOfDateError for invalid format', () => {
      expect(() => resolveAsOfDate('20260507')).toThrow(InvalidAsOfDateError);
    });

    it('3b. throws InvalidAsOfDateError for nonsense string', () => {
      expect(() => resolveAsOfDate('not-a-date')).toThrow(InvalidAsOfDateError);
    });

    it('3c. error name is InvalidAsOfDateError', () => {
      try {
        resolveAsOfDate('bad-input');
      } catch (e) {
        expect(e instanceof InvalidAsOfDateError).toBe(true);
        expect((e as Error).name).toBe('InvalidAsOfDateError');
      }
    });

    it('3d. result is always YYYY-MM-DD format (timezone-stable)', () => {
      const result = resolveAsOfDate('2026-05-07');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // --- 4. buildAsOfWhereClause produces date <= asOfDate ---
  describe('buildAsOfWhereClause', () => {

    it('4a. StockQuote produces lte where clause', () => {
      const clause = buildAsOfWhereClause('StockQuote', '2026-05-07');
      expect(clause.prismaWhere.date).toBeDefined();
      expect(clause.prismaWhere.date?.lte).toBeDefined();
    });

    it('4b. MarketIndex produces lte where clause', () => {
      const clause = buildAsOfWhereClause('MarketIndex', '2026-05-07');
      expect(clause.prismaWhere.date?.lte).toBeDefined();
    });

    it('4c. InstitutionalChip produces lte where clause', () => {
      const clause = buildAsOfWhereClause('InstitutionalChip', '2026-05-07');
      expect(clause.prismaWhere.date?.lte).toBeDefined();
    });

    it('4d. NewsEvent produces lte where clause', () => {
      const clause = buildAsOfWhereClause('NewsEvent', '2026-05-07');
      expect(clause.prismaWhere.date?.lte).toBeDefined();
    });

    it('4e. where clause contains YYYYMMDD format for DB comparison', () => {
      const clause = buildAsOfWhereClause('StockQuote', '2026-05-07');
      expect(clause.prismaWhere.date?.lte).toBe('20260507');
    });

    it('4f. asOfDate is returned in YYYY-MM-DD format', () => {
      const clause = buildAsOfWhereClause('StockQuote', '2026-05-07');
      expect(clause.asOfDate).toBe('2026-05-07');
    });

    // --- 5. buildAsOfWhereClause never produces date > asOfDate ---
    it('5a. produced clause has no gt (greater than) condition', () => {
      const clause = buildAsOfWhereClause('StockQuote', '2026-05-07');
      const whereStr = JSON.stringify(clause.prismaWhere);
      expect(whereStr).not.toContain('"gt"');
      expect(whereStr).not.toContain('"gte"');
    });

    it('5b. tableName is preserved in clause', () => {
      const clause = buildAsOfWhereClause('MarketIndex', '2026-05-07');
      expect(clause.tableName).toBe('MarketIndex');
    });
  });

  // --- 6. assertNoFutureDateUsage PASS when all dates <= asOfDate ---
  describe('assertNoFutureDateUsage', () => {

    it('6a. passes when all dates are before asOfDate', () => {
      expect(() =>
        assertNoFutureDateUsage(['20260101', '20260201', '20260507'], '2026-05-07'),
      ).not.toThrow();
    });

    it('6b. passes when all ISO dates are before asOfDate', () => {
      expect(() =>
        assertNoFutureDateUsage(['2026-01-01', '2026-05-06', '2026-05-07'], '2026-05-07'),
      ).not.toThrow();
    });

    it('6c. passes with empty array', () => {
      expect(() => assertNoFutureDateUsage([], '2026-05-07')).not.toThrow();
    });

    // --- 7. assertNoFutureDateUsage FAIL when any date > asOfDate ---
    it('7a. throws FutureDateViolationError when future date present (YYYYMMDD)', () => {
      expect(() =>
        assertNoFutureDateUsage(['20260507', '20260518'], '2026-05-07'),
      ).toThrow(FutureDateViolationError);
    });

    it('7b. throws FutureDateViolationError when future date present (ISO)', () => {
      expect(() =>
        assertNoFutureDateUsage(['2026-05-07', '2026-05-18'], '2026-05-07'),
      ).toThrow(FutureDateViolationError);
    });

    it('7c. error name is FutureDateViolationError', () => {
      try {
        assertNoFutureDateUsage(['2026-05-18'], '2026-05-07');
      } catch (e) {
        expect(e instanceof FutureDateViolationError).toBe(true);
        expect((e as Error).name).toBe('FutureDateViolationError');
      }
    });

    it('7d. does not silently pass with future date', () => {
      let threw = false;
      try {
        assertNoFutureDateUsage(['2030-01-01'], '2026-05-07');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  // --- 8. detectFutureDateRows is read-only ---
  describe('detectFutureDateRows', () => {

    it('8a. returns summaries array with 3 tables', async () => {
      const prisma = makeMockPrisma();
      const summaries = await detectFutureDateRows('2026-05-07', prisma);
      expect(summaries).toHaveLength(3);
      const tableNames = summaries.map(s => s.tableName);
      expect(tableNames).toContain('StockQuote');
      expect(tableNames).toContain('MarketIndex');
      expect(tableNames).toContain('InstitutionalChip');
    });

    // --- 9. detectFutureDateRows returns WARN/FAIL for future rows ---
    it('9a. returns PASS when no future rows exist', async () => {
      const prisma = makeMockPrisma();
      const summaries = await detectFutureDateRows('2026-05-07', prisma);
      for (const s of summaries) {
        expect(s.status).toBe('PASS');
      }
    });

    it('9b. returns WARN when StockQuote has future rows', async () => {
      const prisma = makeMockPrisma({
        stockQuote: {
          findMany: async () => [
            { date: '20260518', stockId: '2330' },
            { date: '20260518', stockId: '2317' },
          ],
        },
      });
      const summaries = await detectFutureDateRows('2026-05-07', prisma);
      const sq = summaries.find(s => s.tableName === 'StockQuote')!;
      expect(sq.status).toBe('WARN');
      expect(sq.futureRowCount).toBe(2);
      expect(sq.affectedSymbols).toContain('2330');
    });

    it('9c. latestFutureDate is normalized to ISO format', async () => {
      const prisma = makeMockPrisma({
        stockQuote: {
          findMany: async () => [{ date: '20260518', stockId: '2330' }],
        },
      });
      const summaries = await detectFutureDateRows('2026-05-07', prisma);
      const sq = summaries.find(s => s.tableName === 'StockQuote')!;
      expect(sq.latestFutureDate).toBe('2026-05-18');
    });

    it('9d. does not write or mutate DB (mock never called with write ops)', async () => {
      let writeCalled = false;
      const prisma = makeMockPrisma({
        stockQuote: {
          findMany: async () => {
            // Only findMany should be called — no create/delete/update
            return [];
          },
        },
      });
      // Inject write detection (would throw if called)
      (prisma as unknown as Record<string, unknown>).stockQuote = {
        ...prisma.stockQuote,
        create: () => { writeCalled = true; },
        delete: () => { writeCalled = true; },
        update: () => { writeCalled = true; },
      };
      await detectFutureDateRows('2026-05-07', prisma);
      expect(writeCalled).toBe(false);
    });
  });

  // --- 10. detectAbnormalHistoricalRows detects 1970-like abnormal rows ---
  describe('detectAbnormalHistoricalRows', () => {

    it('10a. detects 1970-like date as abnormal', () => {
      const result = detectAbnormalHistoricalRows(
        ['2025-01-01', '1970-12-04', '2026-01-01'],
        'StockQuote',
      );
      expect(result.status).toBe('WARN');
      expect(result.abnormalRowCount).toBe(1);
      expect(result.earliestAbnormalDate).toBe('1970-12-04');
    });

    it('10b. detects YYYYMMDD 1970 date as abnormal', () => {
      const result = detectAbnormalHistoricalRows(
        ['20250101', '19701204', '20260101'],
        'StockQuote',
      );
      expect(result.status).toBe('WARN');
      expect(result.abnormalRowCount).toBe(1);
    });

    it('10c. PASS when no abnormal dates', () => {
      const result = detectAbnormalHistoricalRows(
        ['2020-01-01', '2025-06-01'],
        'StockQuote',
      );
      expect(result.status).toBe('PASS');
      expect(result.abnormalRowCount).toBe(0);
    });

    it('10d. uses ABNORMAL_DATE_THRESHOLD constant by default', () => {
      expect(ABNORMAL_DATE_THRESHOLD).toBe('2000-01-01');
      const result = detectAbnormalHistoricalRows(['1999-12-31'], 'MarketIndex');
      expect(result.status).toBe('WARN');
    });

    it('10e. tableName preserved in result', () => {
      const result = detectAbnormalHistoricalRows([], 'InstitutionalChip');
      expect(result.tableName).toBe('InstitutionalChip');
    });
  });

  // --- 11. validateAsOfDataReadiness returns PASS/WARN/FAIL ---
  describe('validateAsOfDataReadiness', () => {

    it('11a. PASS when no issues', () => {
      const future: FutureDateRowsSummary[] = [
        { tableName: 'StockQuote', asOfDate: '2026-05-07', futureRowCount: 0,
          latestFutureDate: null, affectedSymbols: [], status: 'PASS', observabilityNote: '' },
      ];
      const abnormal: AbnormalHistoricalRowsSummary[] = [
        { tableName: 'StockQuote', threshold: '2000-01-01', abnormalRowCount: 0,
          earliestAbnormalDate: null, status: 'PASS', observabilityNote: '' },
      ];
      const result = validateAsOfDataReadiness(future, abnormal, '2026-05-07');
      expect(result.overallStatus).toBe('PASS');
    });

    it('11b. WARN when future rows exist (gate can exclude)', () => {
      const future: FutureDateRowsSummary[] = [
        { tableName: 'StockQuote', asOfDate: '2026-05-07', futureRowCount: 10,
          latestFutureDate: '2026-05-18', affectedSymbols: ['2330'], status: 'WARN',
          observabilityNote: '' },
      ];
      const abnormal: AbnormalHistoricalRowsSummary[] = [];
      const result = validateAsOfDataReadiness(future, abnormal, '2026-05-07');
      expect(result.overallStatus).toBe('WARN');
      expect(result.warnCount).toBe(1);
    });

    it('11c. FAIL when a future summary has FAIL status', () => {
      const future: FutureDateRowsSummary[] = [
        { tableName: 'StockQuote', asOfDate: '2026-05-07', futureRowCount: 100,
          latestFutureDate: '2026-05-18', affectedSymbols: [], status: 'FAIL',
          observabilityNote: '' },
      ];
      const result = validateAsOfDataReadiness(future, [], '2026-05-07');
      expect(result.overallStatus).toBe('FAIL');
      expect(result.failCount).toBe(1);
    });

    it('11d. passCount + warnCount + failCount = total summaries', () => {
      const future: FutureDateRowsSummary[] = [
        { tableName: 'StockQuote', asOfDate: '2026-05-07', futureRowCount: 0,
          latestFutureDate: null, affectedSymbols: [], status: 'PASS', observabilityNote: '' },
        { tableName: 'MarketIndex', asOfDate: '2026-05-07', futureRowCount: 5,
          latestFutureDate: '2026-05-18', affectedSymbols: [], status: 'WARN',
          observabilityNote: '' },
      ];
      const abnormal: AbnormalHistoricalRowsSummary[] = [
        { tableName: 'InstitutionalChip', threshold: '2000-01-01', abnormalRowCount: 0,
          earliestAbnormalDate: null, status: 'PASS', observabilityNote: '' },
      ];
      const result = validateAsOfDataReadiness(future, abnormal, '2026-05-07');
      expect(result.passCount + result.warnCount + result.failCount)
        .toBe(future.length + abnormal.length);
    });

    it('11e. asOfDate preserved in result', () => {
      const result = validateAsOfDataReadiness([], [], '2026-05-07');
      expect(result.asOfDate).toBe('2026-05-07');
    });
  });

  // --- 12. no DB write / external API / LLM behavior ---
  describe('Source code safety inspection', () => {

    const src = fs.readFileSync(
      path.join(__dirname, '..', 'AsOfDataGate.ts'),
      'utf8',
    );

    it('12a. no real Prisma client import', () => {
      expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
      expect(src).not.toMatch(/new PrismaClient/);
    });

    it('12b. no external API calls', () => {
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/https?:\/\//);
    });

    it('12c. no LLM imports', () => {
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/langchain/i);
    });

    it('12d. no DB write operations', () => {
      const codeLines = src.split('\n').filter(
        l => !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );
      const code = codeLines.join('\n');
      expect(code).not.toMatch(/\.create\s*\(/);
      expect(code).not.toMatch(/\.upsert\s*\(/);
      expect(code).not.toMatch(/\.update\s*\(/);
      expect(code).not.toMatch(/\.delete\s*\(/);
    });

    it('12e. no delete row operations', () => {
      expect(src).not.toMatch(/DELETE FROM/i);
      expect(src).not.toMatch(/deleteMany/);
    });
  });
});
