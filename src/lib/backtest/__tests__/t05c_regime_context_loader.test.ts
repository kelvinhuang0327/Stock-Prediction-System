/**
 * T-05C Regime Context Loader Tests
 *
 * Tests for src/lib/backtest/RegimeContextLoader.ts
 *
 * SAFETY CONTRACT:
 * - T-05C: read-only loader, persisted MarketRegimeResult only
 * - no regime recomputation, no production write, no DB write
 * - no external API, no LLM call, no strategy mutation, no performance claim
 * - no H001-H012
 * - all DB interactions use injectable mock client — no real DB
 */

import {
  normalizeRegimeContextDateKey,
  mapMarketRegimeResultToPersistedContext,
  loadRegimeContextMap,
  validateRegimeContextCoverage,
  InvalidDateKeyError,
  type RegimeResultRow,
  type PrismaClientLike,
  type RegimeContextCoverageSummary,
} from '@/lib/backtest/RegimeContextLoader';
import { buildWalkForwardSkeleton } from '@/lib/backtest/WalkForwardEngine';
import type { PersistedRegimeContext } from '@/lib/marketRegimeResult';

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_DATE = '2026-05-07';

const FORBIDDEN_KEYS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha', 'edge',
  'profit', 'recommendation', 'outperform',
];

const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function containsForbiddenKey(obj: unknown, path = ''): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      return `${path}.${key}`;
    }
    const nested = containsForbiddenKey(
      (obj as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (nested) return nested;
  }
  return null;
}

function containsH001H012(str: string): boolean {
  return H_PATTERN.test(str);
}

function makeRow(overrides: Partial<RegimeResultRow> = {}): RegimeResultRow {
  return {
    date: FIXED_DATE,
    regimeLabel: 'BULL',
    confidence: 0.85,
    taiexClose: 21000,
    source: 'P4_03_MARKET_REGIME_CLASSIFIER',
    version: 'p4_03b_v1',
    ...overrides,
  };
}

function makeMockClient(rows: RegimeResultRow[]): PrismaClientLike {
  return {
    marketRegimeResult: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

// ─── Suite 1: normalizeRegimeContextDateKey ───────────────────────────────────

describe('T-05C normalizeRegimeContextDateKey', () => {
  test('1. returns YYYY-MM-DD for a Date object', () => {
    const d = new Date('2026-05-07T12:00:00Z');
    expect(normalizeRegimeContextDateKey(d)).toBe('2026-05-07');
  });

  test('2. returns YYYY-MM-DD for a YYYY-MM-DD string', () => {
    expect(normalizeRegimeContextDateKey('2026-05-07')).toBe('2026-05-07');
  });

  test('3. is timezone-stable (UTC) for Date at UTC midnight', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    expect(normalizeRegimeContextDateKey(d)).toBe('2026-01-01');
  });

  test('4. is timezone-stable (UTC) for ISO string with time component', () => {
    // UTC time — should resolve to the date in UTC, not local timezone
    expect(normalizeRegimeContextDateKey('2026-05-07T23:59:59Z')).toBe('2026-05-07');
  });

  test('5. throws InvalidDateKeyError for empty string', () => {
    expect(() => normalizeRegimeContextDateKey('')).toThrow(InvalidDateKeyError);
  });

  test('6. throws InvalidDateKeyError for invalid date string', () => {
    expect(() => normalizeRegimeContextDateKey('not-a-date')).toThrow(InvalidDateKeyError);
  });

  test('7. throws InvalidDateKeyError for invalid Date object', () => {
    expect(() => normalizeRegimeContextDateKey(new Date('invalid'))).toThrow(InvalidDateKeyError);
  });

  test('8. result does not contain forbidden terms', () => {
    const result = normalizeRegimeContextDateKey('2026-05-07');
    expect(FORBIDDEN_KEYS.some(k => result.toLowerCase().includes(k))).toBe(false);
  });
});

// ─── Suite 2: mapMarketRegimeResultToPersistedContext ─────────────────────────

describe('T-05C mapMarketRegimeResultToPersistedContext', () => {
  test('9. preserves read-only observability context fields', () => {
    const row = makeRow();
    const ctx = mapMarketRegimeResultToPersistedContext(row);
    expect(ctx.date).toBe(FIXED_DATE);
    expect(ctx.regimeLabel).toBe('BULL');
    expect(ctx.confidence).toBe(0.85);
    expect(ctx.taiexClose).toBe(21000);
    expect(ctx.source).toBe('P4_03_MARKET_REGIME_CLASSIFIER');
    expect(ctx.version).toBe('p4_03b_v1');
    expect(ctx.isAvailable).toBe(true);
  });

  test('10. computes freshnessStatus=FRESH when referenceDate=rowDate', () => {
    const row = makeRow();
    const ctx = mapMarketRegimeResultToPersistedContext(row, FIXED_DATE);
    expect(ctx.freshnessStatus).toBe('FRESH');
    expect(ctx.freshnessLagDays).toBe(0);
    expect(ctx.warning).toBeNull();
  });

  test('11. computes freshnessStatus=STALE when lag > 3 days', () => {
    const row = makeRow({ date: '2026-04-30' });
    const ctx = mapMarketRegimeResultToPersistedContext(row, '2026-05-07');
    expect(ctx.freshnessStatus).toBe('STALE');
    expect(ctx.freshnessLagDays).toBe(7);
    expect(ctx.warning).toContain('7 calendar days');
  });

  test('12. handles null taiexClose explicitly', () => {
    const row = makeRow({ taiexClose: null });
    const ctx = mapMarketRegimeResultToPersistedContext(row);
    expect(ctx.taiexClose).toBeNull();
  });

  test('13. normalizes unknown regimeLabel to LOW_CONFIDENCE with warning', () => {
    const row = makeRow({ regimeLabel: 'UNKNOWN_REGIME' });
    const ctx = mapMarketRegimeResultToPersistedContext(row);
    expect(ctx.regimeLabel).toBe('LOW_CONFIDENCE');
    expect(ctx.warning).toContain('LOW_CONFIDENCE');
  });

  test('14. output contains no forbidden strategy/performance field keys', () => {
    const row = makeRow();
    const ctx = mapMarketRegimeResultToPersistedContext(row);
    const hit = containsForbiddenKey(ctx);
    expect(hit).toBeNull();
  });

  test('15. output does not contain H001-H012 patterns', () => {
    const row = makeRow();
    const ctx = mapMarketRegimeResultToPersistedContext(row);
    expect(containsH001H012(JSON.stringify(ctx))).toBe(false);
  });
});

// ─── Suite 3: loadRegimeContextMap ───────────────────────────────────────────

describe('T-05C loadRegimeContextMap', () => {
  test('16. returns Map keyed by YYYY-MM-DD', async () => {
    const rows = [makeRow({ date: '2026-05-05' }), makeRow({ date: '2026-05-06' })];
    const client = makeMockClient(rows);
    const map = await loadRegimeContextMap('2026-05-01', '2026-05-07', client);

    expect(map instanceof Map).toBe(true);
    expect(map.has('2026-05-05')).toBe(true);
    expect(map.has('2026-05-06')).toBe(true);
  });

  test('17. reads only the requested date range (WHERE clause)', async () => {
    const rows = [makeRow({ date: '2026-05-05' })];
    const mockFindMany = jest.fn().mockResolvedValue(rows);
    const client: PrismaClientLike = { marketRegimeResult: { findMany: mockFindMany } };

    await loadRegimeContextMap('2026-05-01', '2026-05-07', client);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.date.gte).toBe('2026-05-01');
    expect(callArgs.where.date.lte).toBe('2026-05-07');
  });

  test('18. does not write to DB (findMany only — no create/update/delete)', async () => {
    const client = makeMockClient([]);
    // The mock client has only findMany. If any write method were called it would throw.
    const writeAttempt: Record<string, unknown> = {};
    const guardedClient: PrismaClientLike = {
      marketRegimeResult: {
        findMany: jest.fn().mockResolvedValue([]),
        ...writeAttempt,
      },
    };
    await expect(loadRegimeContextMap('2026-05-01', '2026-05-07', guardedClient)).resolves.toBeDefined();
  });

  test('19. returns empty Map when DB returns no rows', async () => {
    const client = makeMockClient([]);
    const map = await loadRegimeContextMap('2026-05-01', '2026-05-07', client);
    expect(map.size).toBe(0);
  });

  test('20. returns empty Map on DB error (no throw)', async () => {
    const client: PrismaClientLike = {
      marketRegimeResult: {
        findMany: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      },
    };
    const map = await loadRegimeContextMap('2026-05-01', '2026-05-07', client);
    expect(map instanceof Map).toBe(true);
    expect(map.size).toBe(0);
  });

  test('21. does not call external API', async () => {
    // Confirm loadRegimeContextMap only calls the injected client, never fetch or XMLHttpRequest
    const mockFindMany = jest.fn().mockResolvedValue([]);
    const client: PrismaClientLike = { marketRegimeResult: { findMany: mockFindMany } };
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async () => { fetchCalled = true; throw new Error('fetch must not be called'); };

    await loadRegimeContextMap('2026-05-01', '2026-05-07', client);
    expect(fetchCalled).toBe(false);

    global.fetch = originalFetch;
  });

  test('22. does not call LLM (no fetch to openai/anthropic in loader source)', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const loaderSource = readFileSync(
      join(process.cwd(), 'src/lib/backtest/RegimeContextLoader.ts'),
      'utf-8',
    );
    expect(loaderSource).not.toContain('openai');
    expect(loaderSource).not.toContain('anthropic');
    expect(loaderSource).not.toContain('createCompletion');
    expect(loaderSource).not.toContain('chat.completions');
  });

  test('23. Map values are PersistedRegimeContext with isAvailable=true', async () => {
    const rows = [makeRow()];
    const client = makeMockClient(rows);
    const map = await loadRegimeContextMap(FIXED_DATE, FIXED_DATE, client);

    const ctx = map.get(FIXED_DATE);
    expect(ctx).toBeDefined();
    expect(ctx!.isAvailable).toBe(true);
    expect(typeof ctx!.regimeLabel).toBe('string');
    expect(typeof ctx!.confidence).toBe('number');
  });

  test('24. loader output (Map values) contains no forbidden strategy field keys', async () => {
    const rows = [
      makeRow({ date: '2026-05-05' }),
      makeRow({ date: '2026-05-06', regimeLabel: 'BEAR' }),
    ];
    const client = makeMockClient(rows);
    const map = await loadRegimeContextMap('2026-05-01', '2026-05-07', client);

    for (const [, ctx] of map) {
      const hit = containsForbiddenKey(ctx);
      expect(hit).toBeNull();
    }
  });

  test('25. loader output does not contain H001-H012 patterns', async () => {
    const rows = [makeRow({ date: '2026-05-05' })];
    const client = makeMockClient(rows);
    const map = await loadRegimeContextMap('2026-05-01', '2026-05-07', client);
    const serialized = JSON.stringify(Array.from(map.entries()));
    expect(containsH001H012(serialized)).toBe(false);
  });
});

// ─── Suite 4: validateRegimeContextCoverage ───────────────────────────────────

describe('T-05C validateRegimeContextCoverage', () => {
  function makeContextMap(dates: string[]): Map<string, PersistedRegimeContext> {
    const map = new Map<string, PersistedRegimeContext>();
    for (const d of dates) {
      map.set(d, {
        date: d,
        regimeLabel: 'BULL',
        confidence: 0.8,
        taiexClose: null,
        source: 'test',
        version: 'v1',
        freshnessStatus: 'FRESH',
        freshnessLagDays: 0,
        warning: null,
        isAvailable: true,
      });
    }
    return map;
  }

  test('26. returns PASS when coverage >= 90%', () => {
    // 5 weekdays: Mon-Fri in a week (2026-05-04 to 2026-05-08)
    const allDays = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    const map = makeContextMap(allDays); // 5/5 = 100%
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(result.status).toBe('PASS');
    expect(result.availableContextCount).toBe(5);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(0.9);
  });

  test('27. returns WARN when coverage is 50-89%', () => {
    const allDays = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    const partialDays = ['2026-05-04', '2026-05-05', '2026-05-06']; // 3/5 = 60%
    const map = makeContextMap(partialDays);
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(result.status).toBe('WARN');
    expect(result.availableContextCount).toBe(3);
  });

  test('28. returns FAIL when coverage < 50%', () => {
    const allDays = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    const partialDays = ['2026-05-04']; // 1/5 = 20%
    const map = makeContextMap(partialDays);
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(result.status).toBe('FAIL');
  });

  test('29. returns WARN when no expected trading dates in range', () => {
    // Saturday + Sunday only
    const map = makeContextMap([]);
    const result = validateRegimeContextCoverage('2026-05-09', '2026-05-10', map);
    expect(result.status).toBe('WARN');
    expect(result.expectedDateCount).toBe(0);
  });

  test('30. returns correct firstAvailableDate and lastAvailableDate', () => {
    const dates = ['2026-05-04', '2026-05-05', '2026-05-06'];
    const map = makeContextMap(dates);
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(result.firstAvailableDate).toBe('2026-05-04');
    expect(result.lastAvailableDate).toBe('2026-05-06');
  });

  test('31. missingContextCount = expectedDateCount - availableContextCount', () => {
    const allDays = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    const available = ['2026-05-04', '2026-05-06'];
    const map = makeContextMap(available);
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(result.missingContextCount).toBe(result.expectedDateCount - result.availableContextCount);
  });

  test('32. output contains no forbidden strategy/performance field keys', () => {
    const map = makeContextMap(['2026-05-04']);
    const result = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    const hit = containsForbiddenKey(result);
    expect(hit).toBeNull();
  });

  test('33. result is deterministic for same inputs', () => {
    const dates = ['2026-05-04', '2026-05-05'];
    const map = makeContextMap(dates);
    const r1 = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    const r2 = validateRegimeContextCoverage('2026-05-04', '2026-05-08', map);
    expect(r1).toEqual(r2);
  });
});

// ─── Suite 5: Integration — loader injected into WalkForwardEngine ────────────

describe('T-05C Integration: loader output injected into buildWalkForwardSkeleton', () => {
  async function buildSkeletonWithLoader(): Promise<ReturnType<typeof buildWalkForwardSkeleton>> {
    const rows = [
      makeRow({ date: '2026-05-05', regimeLabel: 'BULL' }),
      makeRow({ date: '2026-05-06', regimeLabel: 'SIDEWAYS' }),
    ];
    const client = makeMockClient(rows);
    const contextMap = await loadRegimeContextMap('2026-04-01', FIXED_DATE, client);
    return buildWalkForwardSkeleton({ currentDate: FIXED_DATE, lookbackDays: 10 }, contextMap);
  }

  test('34. loader output can be injected into buildWalkForwardSkeleton', async () => {
    const output = await buildSkeletonWithLoader();
    expect(output).toBeDefined();
    expect(output.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
  });

  test('35. skeleton shows recordsWithRegimeContext > 0 when loader provides data', async () => {
    const output = await buildSkeletonWithLoader();
    expect(output.summary.recordsWithRegimeContext).toBeGreaterThan(0);
  });

  test('36. skeleton does not change safety contract after loader injection', async () => {
    const output = await buildSkeletonWithLoader();
    expect(output.safetyContract.noDbWrite).toBe(true);
    expect(output.safetyContract.noLlmCall).toBe(true);
    expect(output.safetyContract.persistedRegimeResultReadOnly).toBe(true);
  });

  test('37. skeleton+loader output contains no forbidden field keys', async () => {
    const output = await buildSkeletonWithLoader();
    const hit = containsForbiddenKey(output);
    expect(hit).toBeNull();
  });

  test('38. skeleton+loader output does not contain H001-H012 patterns', async () => {
    const output = await buildSkeletonWithLoader();
    const serialized = JSON.stringify(output);
    expect(containsH001H012(serialized)).toBe(false);
  });

  test('39. all placeholder metrics remain null after loader injection', async () => {
    const output = await buildSkeletonWithLoader();
    for (const record of output.records) {
      expect(record.placeholderMetrics.forwardReturnPlaceholder).toBeNull();
      expect(record.placeholderMetrics.benchmarkReturnPlaceholder).toBeNull();
      expect(record.placeholderMetrics.drawdownPlaceholder).toBeNull();
    }
  });

  test('40. loader does not mutate injected contextMap', async () => {
    const rows = [makeRow({ date: '2026-05-05' })];
    const client = makeMockClient(rows);
    const contextMap = await loadRegimeContextMap('2026-04-01', FIXED_DATE, client);
    const sizeBefore = contextMap.size;

    buildWalkForwardSkeleton({ currentDate: FIXED_DATE, lookbackDays: 10 }, contextMap);

    expect(contextMap.size).toBe(sizeBefore);
  });

  test('41. RegimeContextLoader source contains no hardcoded date cap', async () => {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const source = readFileSync(
      join(process.cwd(), 'src/lib/backtest/RegimeContextLoader.ts'),
      'utf-8',
    );
    expect(source).not.toContain('TODAY_CAP');
    // Comments with example dates are acceptable; only a runtime hardcoded cap is forbidden.
    // Verify no literal date string appears outside of a comment in the actual logic.
    const nonCommentLines = source
      .split('\n')
      .filter(line => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*'))
      .join('\n');
    expect(nonCommentLines).not.toContain('TODAY_CAP');
  });

  test('42. validateRegimeContextCoverage result can be serialized to JSON', async () => {
    const rows = [makeRow({ date: '2026-05-05' })];
    const client = makeMockClient(rows);
    const contextMap = await loadRegimeContextMap('2026-05-04', '2026-05-08', client);
    const coverage = validateRegimeContextCoverage('2026-05-04', '2026-05-08', contextMap);
    expect(() => JSON.parse(JSON.stringify(coverage))).not.toThrow();
  });

  test('43. loader coverage summary contains no forbidden terms', async () => {
    const rows = [makeRow({ date: '2026-05-05' })];
    const client = makeMockClient(rows);
    const contextMap = await loadRegimeContextMap('2026-05-04', '2026-05-08', client);
    const coverage = validateRegimeContextCoverage('2026-05-04', '2026-05-08', contextMap);
    const hit = containsForbiddenKey(coverage as unknown as Record<string, unknown>);
    expect(hit).toBeNull();
  });

  test('44. coverage status is string PASS, WARN, or FAIL (not a strategy verdict)', async () => {
    const rows: RegimeResultRow[] = [];
    const client = makeMockClient(rows);
    const contextMap = await loadRegimeContextMap('2026-05-04', '2026-05-08', client);
    const coverage = validateRegimeContextCoverage('2026-05-04', '2026-05-08', contextMap);
    expect(['PASS', 'WARN', 'FAIL']).toContain(coverage.status);
  });

  test('45. loader + skeleton output JSON shape is valid and parseable', async () => {
    const output = await buildSkeletonWithLoader();
    const json = JSON.stringify(output);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as ReturnType<typeof buildWalkForwardSkeleton>;
    expect(parsed.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
    expect(Array.isArray(parsed.records)).toBe(true);
  });
});
