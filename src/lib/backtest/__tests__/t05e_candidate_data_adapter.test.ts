/**
 * t05e_candidate_data_adapter.test.ts
 *
 * T-05E PIT-safe Candidate Data Adapter tests
 * Observability-only. No strategy claims. No performance conclusions.
 * No forbidden terms in outputs: buy/sell/signal/roi/win_rate/alpha/edge/profit/recommendation/outperform/H001-H012
 */

import path from 'path';
import fs from 'fs';
import {
  normalizeCandidateSnapshotDateKey,
  InvalidCandidateSnapshotDateKeyError,
  mapStockDataToCandidateSnapshot,
  validateCandidateSnapshotFreshness,
  validateCandidateSnapshotCoverage,
  loadCandidateSnapshotsForDate,
  type CandidateRawRow,
  type CandidateSnapshot,
  type CandidateAdapterPrismaLike,
} from '../CandidateDataAdapter';
import { buildWalkForwardSkeleton } from '../WalkForwardEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const FORBIDDEN_KEYS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];
const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

function hasForbiddenKey(obj: unknown, path = ''): string[] {
  const violations: string[] = [];
  if (typeof obj !== 'object' || obj === null) return violations;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    for (const term of FORBIDDEN_KEYS) {
      if (lowerKey === term || lowerKey.startsWith(term + '_') || lowerKey.endsWith('_' + term)) {
        violations.push(`${path}.${key}`);
      }
    }
    if (H_PATTERN.test(key)) violations.push(`${path}.${key}`);
    violations.push(...hasForbiddenKey(val, `${path}.${key}`));
  }
  return violations;
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockRow(overrides: Partial<CandidateRawRow> = {}): CandidateRawRow {
  return {
    stockId: '2330',
    date: '20260101', // YYYYMMDD format from DB
    close: 800.0,
    volume: 1_000_000,
    stock: { name: 'TSMC', industry: 'Semiconductors', listingDate: '19940905' },
    ...overrides,
  };
}

function makeMockClient(rows: CandidateRawRow[]): CandidateAdapterPrismaLike {
  return {
    stockQuote: {
      findMany: async () => rows,
    },
  };
}

function makeMockClientSpy(): { client: CandidateAdapterPrismaLike; calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    client: {
      stockQuote: {
        findMany: async (args: unknown) => {
          calls.push(args);
          return [];
        },
      },
    },
    calls,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('T-05E: CandidateDataAdapter', () => {

  // --- 1. normalizeCandidateSnapshotDateKey returns YYYY-MM-DD ---
  describe('normalizeCandidateSnapshotDateKey', () => {

    it('1a. returns YYYY-MM-DD for YYYY-MM-DD string input', () => {
      const result = normalizeCandidateSnapshotDateKey('2026-01-15');
      expect(result).toBe('2026-01-15');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it('1b. converts YYYYMMDD to YYYY-MM-DD', () => {
      expect(normalizeCandidateSnapshotDateKey('20260115')).toBe('2026-01-15');
    });

    it('1c. converts Date object to YYYY-MM-DD', () => {
      const d = new Date('2026-03-20T00:00:00Z');
      expect(normalizeCandidateSnapshotDateKey(d)).toBe('2026-03-20');
    });

    it('1d. handles ISO string input', () => {
      const result = normalizeCandidateSnapshotDateKey('2026-05-07T12:00:00.000Z');
      expect(result).toBe('2026-05-07');
    });

    // --- 2. normalizeCandidateSnapshotDateKey is timezone-stable ---
    it('2a. is timezone-stable: UTC noon gives correct day', () => {
      const d = new Date('2026-06-15T12:00:00Z');
      expect(normalizeCandidateSnapshotDateKey(d)).toBe('2026-06-15');
    });

    it('2b. is timezone-stable: UTC midnight gives correct day', () => {
      const d = new Date('2026-06-01T00:00:00Z');
      expect(normalizeCandidateSnapshotDateKey(d)).toBe('2026-06-01');
    });

    it('2c. throws InvalidCandidateSnapshotDateKeyError for empty string', () => {
      expect(() => normalizeCandidateSnapshotDateKey('')).toThrow(
        InvalidCandidateSnapshotDateKeyError,
      );
    });

    it('2d. throws for random non-date string', () => {
      expect(() => normalizeCandidateSnapshotDateKey('not-a-date')).toThrow(
        InvalidCandidateSnapshotDateKeyError,
      );
    });

    it('2e. throws for invalid Date object', () => {
      expect(() => normalizeCandidateSnapshotDateKey(new Date('invalid'))).toThrow(
        InvalidCandidateSnapshotDateKeyError,
      );
    });
  });

  // --- 3. loadCandidateSnapshotsForDate reads only records with sourceDate <= rebalanceDate ---
  describe('loadCandidateSnapshotsForDate PIT safety', () => {

    it('3a. passes lte query filter to DB client', async () => {
      const spy = makeMockClientSpy();
      await loadCandidateSnapshotsForDate('2026-01-15', spy.client);
      expect(spy.calls.length).toBe(1);
      const args = spy.calls[0] as { where: { date: { lte: string } } };
      // lte value should be <= rebalanceDate in YYYYMMDD format
      expect(args.where.date.lte).toBe('20260115');
    });

    it('3b. returns PIT_SAFE_CANDIDATE_SNAPSHOT as candidateSource', async () => {
      const client = makeMockClient([makeMockRow()]);
      const result = await loadCandidateSnapshotsForDate('2026-01-15', client);
      expect(result.candidateSource).toBe('PIT_SAFE_CANDIDATE_SNAPSHOT');
    });

    it('3c. returns snapshots with sourceDate <= rebalanceDate', async () => {
      const rows = [
        makeMockRow({ stockId: '2330', date: '20260115' }), // same day — OK
        makeMockRow({ stockId: '2317', date: '20260110' }), // earlier — OK
      ];
      const client = makeMockClient(rows);
      const result = await loadCandidateSnapshotsForDate('2026-01-15', client);
      for (const snap of result.snapshots) {
        if (snap.sourceDate) {
          expect(snap.sourceDate <= '2026-01-15').toBe(true);
        }
      }
    });

    // --- 4. loadCandidateSnapshotsForDate rejects or flags future data ---
    it('4a. flags future sourceDate as INVALID_FUTURE_DATE', () => {
      // mapStockDataToCandidateSnapshot is called by load; test it directly
      const futureRow = makeMockRow({ stockId: '2330', date: '20260120' }); // future
      const snap = mapStockDataToCandidateSnapshot(futureRow, '2026-01-15');
      expect(snap.dataAvailabilityStatus).toBe('INVALID_FUTURE_DATE');
      expect(snap.exclusionReasons.some(r => r.includes('pit-violation'))).toBe(true);
    });

    it('4b. AVAILABLE status for same-day sourceDate', () => {
      const row = makeMockRow({ stockId: '2330', date: '20260115' });
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.dataAvailabilityStatus).toBe('AVAILABLE');
    });

    it('4c. AVAILABLE status for sourceDate within 7 days before rebalanceDate', () => {
      const row = makeMockRow({ stockId: '2330', date: '20260110' }); // 5 days before
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.dataAvailabilityStatus).toBe('AVAILABLE');
    });

    it('4d. STALE status for sourceDate 8-30 days before rebalanceDate', () => {
      const row = makeMockRow({ stockId: '2330', date: '20251220' }); // ~26 days before 2026-01-15
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.dataAvailabilityStatus).toBe('STALE');
    });

    // --- 5. loadCandidateSnapshotsForDate is read-only ---
    it('5a. DB client findMany is called with read-only query (no writes)', async () => {
      const spy = makeMockClientSpy();
      await loadCandidateSnapshotsForDate('2026-01-15', spy.client);
      // Only findMany was called (no create, update, delete)
      expect(spy.calls.length).toBe(1);
      expect(typeof (spy.client.stockQuote as unknown as Record<string, unknown>)['create']).toBe('undefined');
      expect(typeof (spy.client.stockQuote as unknown as Record<string, unknown>)['upsert']).toBe('undefined');
    });

    it('5b. returns empty array on DB error (graceful fallback)', async () => {
      const errorClient: CandidateAdapterPrismaLike = {
        stockQuote: {
          findMany: async () => { throw new Error('DB connection refused'); },
        },
      };
      const result = await loadCandidateSnapshotsForDate('2026-01-15', errorClient);
      expect(result.snapshots).toEqual([]);
      expect(result.totalLoaded).toBe(0);
      expect(result.candidateSource).toBe('PIT_SAFE_CANDIDATE_SNAPSHOT');
    });
  });

  // --- 6. mapStockDataToCandidateSnapshot returns neutral observability-only shape ---
  describe('mapStockDataToCandidateSnapshot', () => {

    it('6a. returns neutral observability-only CandidateSnapshot shape', () => {
      const row = makeMockRow();
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15', 'TEST_SOURCE');

      expect(snap.symbol).toBe('2330');
      expect(snap.snapshotDate).toBe('2026-01-15');
      expect(snap.sourceDate).toBe('2026-01-01'); // YYYYMMDD → YYYY-MM-DD
      expect(typeof snap.dataFreshnessDays).toBe('number');
      expect(snap.dataAvailabilityStatus).toBeDefined();
      expect(snap.observableFields).toBeDefined();
      expect(snap.ruleOnlySortKey).toBeDefined();
      expect(Array.isArray(snap.exclusionReasons)).toBe(true);
      expect(snap.sourceLabel).toBe('TEST_SOURCE');
    });

    it('6b. output has no forbidden strategy/performance fields', () => {
      const row = makeMockRow();
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      const violations = hasForbiddenKey(snap);
      expect(violations).toEqual([]);
    });

    it('6c. observableFields reflect data presence', () => {
      const row = makeMockRow({ close: 800, volume: 100_000 });
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.observableFields.hasClose).toBe(true);
      expect(snap.observableFields.hasVolume).toBe(true);
      expect(snap.observableFields.hasIndustry).toBe(true);
    });

    // --- 7. mapStockDataToCandidateSnapshot handles missing fields explicitly ---
    it('7a. handles missing close and volume explicitly', () => {
      const row = makeMockRow({ close: null, volume: null });
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.observableFields.hasClose).toBe(false);
      expect(snap.observableFields.hasVolume).toBe(false);
    });

    it('7b. handles missing stock relation explicitly', () => {
      const row = makeMockRow({ stock: null });
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.observableFields.hasIndustry).toBe(false);
      expect(snap.observableFields.hasListingDate).toBe(false);
    });

    it('7c. handles MISSING status when date is absent', () => {
      const row = { stockId: '2330', date: '', close: null, volume: null };
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      expect(snap.dataAvailabilityStatus).toBe('MISSING');
      expect(snap.sourceDate).toBeNull();
    });

    it('7d. handles YYYYMMDD and YYYY-MM-DD date formats both correctly', () => {
      const rowYYYYMMDD = makeMockRow({ date: '20260110' });
      const rowDashed = makeMockRow({ date: '2026-01-10' });
      const s1 = mapStockDataToCandidateSnapshot(rowYYYYMMDD, '2026-01-15');
      const s2 = mapStockDataToCandidateSnapshot(rowDashed, '2026-01-15');
      expect(s1.sourceDate).toBe('2026-01-10');
      expect(s2.sourceDate).toBe('2026-01-10');
      expect(s1.dataFreshnessDays).toBe(s2.dataFreshnessDays);
    });
  });

  // --- 8. validateCandidateSnapshotFreshness returns PASS for valid sourceDate ---
  describe('validateCandidateSnapshotFreshness', () => {

    function makeSnap(overrides: Partial<CandidateSnapshot> = {}): CandidateSnapshot {
      return {
        symbol: '2330',
        snapshotDate: '2026-01-15',
        sourceDate: '2026-01-10',
        dataFreshnessDays: 5,
        dataAvailabilityStatus: 'AVAILABLE',
        observableFields: { hasClose: true, hasVolume: true, hasIndustry: true, hasListingDate: true },
        ruleOnlySortKey: '2330',
        exclusionReasons: [],
        sourceLabel: 'TEST',
        ...overrides,
      };
    }

    it('8a. returns PASS when sourceDate <= rebalanceDate', () => {
      const snap = makeSnap({ sourceDate: '2026-01-10' });
      const result = validateCandidateSnapshotFreshness('2026-01-15', snap);
      expect(result.status).toBe('PASS');
    });

    it('8b. returns PASS when sourceDate === rebalanceDate (same day)', () => {
      const snap = makeSnap({ sourceDate: '2026-01-15' });
      const result = validateCandidateSnapshotFreshness('2026-01-15', snap);
      expect(result.status).toBe('PASS');
    });

    // --- 9. validateCandidateSnapshotFreshness returns FAIL for future sourceDate ---
    it('9a. returns FAIL when sourceDate > rebalanceDate', () => {
      const snap = makeSnap({ sourceDate: '2026-01-20' }); // future
      const result = validateCandidateSnapshotFreshness('2026-01-15', snap);
      expect(result.status).toBe('FAIL');
      expect(result.statusNote).toMatch(/PIT VIOLATION/);
    });

    it('9b. returns WARN when sourceDate is null', () => {
      const snap = makeSnap({ sourceDate: null, dataFreshnessDays: null });
      const result = validateCandidateSnapshotFreshness('2026-01-15', snap);
      expect(result.status).toBe('WARN');
    });

    it('9c. freshness result contains no forbidden fields', () => {
      const snap = makeSnap({ sourceDate: '2026-01-10' });
      const result = validateCandidateSnapshotFreshness('2026-01-15', snap);
      const violations = hasForbiddenKey(result);
      expect(violations).toEqual([]);
    });
  });

  // --- 10. validateCandidateSnapshotCoverage returns PASS/WARN/FAIL ---
  describe('validateCandidateSnapshotCoverage', () => {

    function makeAvailableSnap(symbol: string): CandidateSnapshot {
      return {
        symbol,
        snapshotDate: '2026-01-15',
        sourceDate: '2026-01-10',
        dataFreshnessDays: 5,
        dataAvailabilityStatus: 'AVAILABLE',
        observableFields: { hasClose: true, hasVolume: true, hasIndustry: false, hasListingDate: false },
        ruleOnlySortKey: symbol,
        exclusionReasons: [],
        sourceLabel: 'TEST',
      };
    }

    function makeMissingSnap(symbol: string): CandidateSnapshot {
      return { ...makeAvailableSnap(symbol), dataAvailabilityStatus: 'MISSING', sourceDate: null, dataFreshnessDays: null };
    }

    function makeFutureSnap(symbol: string): CandidateSnapshot {
      return { ...makeAvailableSnap(symbol), dataAvailabilityStatus: 'INVALID_FUTURE_DATE', sourceDate: '2026-01-20', dataFreshnessDays: 5 };
    }

    it('10a. returns PASS when >= 70% available and no PIT violations', () => {
      const snaps = [
        makeAvailableSnap('A'), makeAvailableSnap('B'), makeAvailableSnap('C'),
        makeAvailableSnap('D'), makeAvailableSnap('E'), makeAvailableSnap('F'),
        makeAvailableSnap('G'), makeMissingSnap('H'), makeMissingSnap('I'),
        makeAvailableSnap('J'), // 8/10 = 80%
      ];
      const result = validateCandidateSnapshotCoverage(snaps);
      expect(result.status).toBe('PASS');
      expect(result.coverageRatio).toBeGreaterThanOrEqual(0.7);
    });

    it('10b. returns WARN when 40-69% available', () => {
      const snaps = [
        makeAvailableSnap('A'), makeAvailableSnap('B'), makeAvailableSnap('C'), // 3 avail
        makeMissingSnap('D'), makeMissingSnap('E'), makeMissingSnap('F'), // 3 missing
        makeMissingSnap('G'), // 3/7 = 43%
      ];
      const result = validateCandidateSnapshotCoverage(snaps);
      expect(result.status).toBe('WARN');
    });

    it('10c. returns FAIL when < 40% available', () => {
      const snaps = [
        makeAvailableSnap('A'), // 1 avail
        makeMissingSnap('B'), makeMissingSnap('C'), makeMissingSnap('D'),
        makeMissingSnap('E'), // 1/5 = 20%
      ];
      const result = validateCandidateSnapshotCoverage(snaps);
      expect(result.status).toBe('FAIL');
    });

    it('10d. returns WARN for empty snapshots array', () => {
      const result = validateCandidateSnapshotCoverage([]);
      expect(result.status).toBe('WARN');
      expect(result.candidateCount).toBe(0);
    });

    it('10e. correctly counts invalidFutureDataCount', () => {
      const snaps = [makeAvailableSnap('A'), makeFutureSnap('B'), makeFutureSnap('C')];
      const result = validateCandidateSnapshotCoverage(snaps);
      expect(result.invalidFutureDataCount).toBe(2);
    });

    it('10f. coverage summary has no forbidden fields', () => {
      const snaps = [makeAvailableSnap('A'), makeAvailableSnap('B')];
      const result = validateCandidateSnapshotCoverage(snaps);
      const violations = hasForbiddenKey(result);
      expect(violations).toEqual([]);
    });
  });

  // --- 11. WalkForwardEngine can use candidateSnapshots without mock candidates ---
  describe('WalkForwardEngine T-05E integration', () => {

    function makePITSnapshot(symbol: string): CandidateSnapshot {
      return {
        symbol,
        snapshotDate: '2026-01-15',
        sourceDate: '2026-01-10',
        dataFreshnessDays: 5,
        dataAvailabilityStatus: 'AVAILABLE',
        observableFields: { hasClose: true, hasVolume: true, hasIndustry: false, hasListingDate: false },
        ruleOnlySortKey: symbol,
        exclusionReasons: [],
        sourceLabel: 'PIT_SAFE',
      };
    }

    it('11a. WalkForwardEngine uses candidateSnapshots when provided', () => {
      const snapshots = [makePITSnapshot('X001'), makePITSnapshot('X002'), makePITSnapshot('X003')];
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 30, candidateSnapshots: snapshots },
        new Map(),
      );
      expect(result.candidateSource).toBe('PIT_SAFE_CANDIDATE_SNAPSHOT');
      // All records should reflect 3 candidates
      for (const record of result.records) {
        expect(record.candidateCount).toBe(3);
      }
    });

    // --- 12. WalkForwardEngine fallback remains MOCK_OBSERVABILITY_ONLY ---
    it('12a. WalkForwardEngine uses MOCK_OBSERVABILITY_ONLY when no snapshots provided', () => {
      const result = buildWalkForwardSkeleton({ currentDate: '2026-01-15', lookbackDays: 30 }, new Map());
      expect(result.candidateSource).toBe('MOCK_OBSERVABILITY_ONLY');
    });

    it('12b. WalkForwardEngine uses MOCK_OBSERVABILITY_ONLY for empty candidateSnapshots array', () => {
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 30, candidateSnapshots: [] },
        new Map(),
      );
      expect(result.candidateSource).toBe('MOCK_OBSERVABILITY_ONLY');
    });

    it('12c. candidateSource field is present in output', () => {
      const result = buildWalkForwardSkeleton({ currentDate: '2026-01-15', lookbackDays: 5 }, new Map());
      expect(result).toHaveProperty('candidateSource');
    });
  });

  // --- 13. output contains no forbidden strategy/performance fields ---
  describe('Forbidden field guardrail', () => {

    it('13a. CandidateSnapshot output has no forbidden fields', () => {
      const row = makeMockRow();
      const snap = mapStockDataToCandidateSnapshot(row, '2026-01-15');
      const violations = hasForbiddenKey(snap);
      expect(violations).toEqual([]);
    });

    it('13b. CandidateSnapshotLoadResult has no forbidden fields', async () => {
      const client = makeMockClient([makeMockRow()]);
      const result = await loadCandidateSnapshotsForDate('2026-01-15', client);
      // Exclude candidateSource (it's an identifier, not a strategy output)
      const { candidateSource: _cs, ...rest } = result;
      const violations = hasForbiddenKey(rest);
      expect(violations).toEqual([]);
    });

    it('13c. WalkForwardEngine output (with PIT snapshots) has no forbidden strategy fields', () => {
      const snapshots = [
        { symbol: 'Y001', snapshotDate: '2026-01-15', sourceDate: '2026-01-10', dataFreshnessDays: 5,
          dataAvailabilityStatus: 'AVAILABLE' as const, observableFields: { hasClose: true, hasVolume: true, hasIndustry: false, hasListingDate: false },
          ruleOnlySortKey: 'Y001', exclusionReasons: [], sourceLabel: 'TEST' },
      ];
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 5, candidateSnapshots: snapshots },
        new Map(),
      );
      // Exclude safetyContract (it uses negation keys like noBuySellOutput) and candidateSource
      const { safetyContract: _sc, candidateSource: _cs, ...rest } = result;
      const violations = hasForbiddenKey(rest);
      expect(violations).toEqual([]);
    });
  });

  // --- 14. no DB write / external API / LLM behavior ---
  describe('Source code safety inspection', () => {

    it('14a. CandidateDataAdapter.ts has no Prisma real-write imports', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'CandidateDataAdapter.ts'),
        'utf8',
      );
      // Should not import real Prisma client (only interface)
      expect(src).not.toMatch(/from ['"]@prisma\/client['"]/);
      expect(src).not.toMatch(/new PrismaClient/);
    });

    it('14b. CandidateDataAdapter.ts has no external API calls', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'CandidateDataAdapter.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/fetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/https?:\/\//);
    });

    it('14c. CandidateDataAdapter.ts has no LLM imports', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'CandidateDataAdapter.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/langchain/i);
    });

    it('14d. CandidateDataAdapter.ts has no DB write operations', () => {
      const src = fs.readFileSync(
        path.join(__dirname, '..', 'CandidateDataAdapter.ts'),
        'utf8',
      );
      expect(src).not.toMatch(/\.create\s*\(/);
      expect(src).not.toMatch(/\.upsert\s*\(/);
      expect(src).not.toMatch(/\.update\s*\(/);
      expect(src).not.toMatch(/\.delete\s*\(/);
    });
  });

  // --- 15. T-05B / T-05C / T-05D regression preserved ---
  describe('Regression: T-05B / T-05C / T-05D compatibility', () => {

    it('15a. WalkForwardEngine still works without candidateSnapshots (T-05B compat)', () => {
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 10 },
        new Map(),
      );
      expect(result.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
      expect(result.records.length).toBeGreaterThan(0);
      expect(result.safetyContract.noDbWrite).toBe(true);
      expect(result.safetyContract.noBuySellOutput).toBe(true);
    });

    it('15b. WalkForwardEngine candidateCountRange reflects mock default (T-05B compat)', () => {
      const result = buildWalkForwardSkeleton(
        { currentDate: '2026-01-15', lookbackDays: 10 },
        new Map(),
      );
      // Default mock has 5 candidates
      expect(result.summary.candidateCountRange.min).toBe(5);
      expect(result.summary.candidateCountRange.max).toBe(5);
    });

    it('15c. WalkForwardEngine tradingDates config still works (T-05D compat)', () => {
      const result = buildWalkForwardSkeleton(
        {
          currentDate: '2026-01-15',
          tradingDates: ['2026-01-02', '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-12'],
        },
        new Map(),
      );
      expect(result.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
      expect(result.totalDays).toBe(5);
    });

    it('15d. WalkForwardEngine with PIT snapshots + Taiwan calendar (T-05D + T-05E compat)', () => {
      const snapshots = [
        { symbol: 'Z001', snapshotDate: '2026-01-15', sourceDate: '2026-01-12',
          dataFreshnessDays: 3, dataAvailabilityStatus: 'AVAILABLE' as const,
          observableFields: { hasClose: true, hasVolume: true, hasIndustry: true, hasListingDate: false },
          ruleOnlySortKey: 'Z001', exclusionReasons: [], sourceLabel: 'PIT' },
      ];
      const result = buildWalkForwardSkeleton(
        {
          currentDate: '2026-01-15',
          tradingDates: ['2026-01-02', '2026-01-05', '2026-01-07'],
          candidateSnapshots: snapshots,
        },
        new Map(),
      );
      expect(result.calendarBasis).toBe('TAIWAN_TRADING_CALENDAR');
      expect(result.candidateSource).toBe('PIT_SAFE_CANDIDATE_SNAPSHOT');
      expect(result.records[0].candidateCount).toBe(1);
    });
  });
});
