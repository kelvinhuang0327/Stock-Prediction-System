/**
 * T-05B Walk-Forward Engine Tests
 *
 * Tests for src/lib/backtest/WalkForwardEngine.ts
 *
 * SAFETY CONTRACT:
 * - observability-only: no edge claim, no production write, no DB write
 * - no external API, no LLM call, no strategy mutation, no H001-H012
 * - no buy/sell output, no performance conclusions, no trading recommendations
 * - all tests use injected context (no DB dependency)
 */

import {
  buildWalkForwardSkeleton,
  getRegimeContextForDate,
  buildMonthlyRebalanceSchedule,
  rankCandidatesRuleOnly,
  computeTurnoverStats,
  T05B_LOOKBACK_DAYS,
  type WalkForwardSkeletonOutput,
  type RegimeContextForDate,
  type RankCandidatesResult,
  type TurnoverStats,
  type MonthlyRebalanceSchedule,
} from '@/lib/backtest/WalkForwardEngine';
import type { PersistedRegimeContext } from '@/lib/marketRegimeResult';

// ─── Test Constants ───────────────────────────────────────────────────────────

const FIXED_DATE = '2026-05-06';

const FORBIDDEN_KEYS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha', 'edge',
  'profit', 'recommendation', 'outperform',
];

const H_PATTERN = /H0(0[1-9]|1[0-2])\b/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function containsForbiddenKey(obj: unknown, path = ''): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(key.toLowerCase())) {
      return `${path}.${key}`;
    }
    const nested = containsForbiddenKey((obj as Record<string, unknown>)[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

function containsH001H012(str: string): boolean {
  return H_PATTERN.test(str);
}

function makeMockContextMap(date: string, overrides: Partial<PersistedRegimeContext> = {}): Map<string, PersistedRegimeContext> {
  const ctx: PersistedRegimeContext = {
    date,
    regimeLabel: 'BULL',
    confidence: 0.85,
    taiexClose: 21000,
    source: 'P4_03_MARKET_REGIME_CLASSIFIER',
    version: 'p4_03b_v1',
    freshnessStatus: 'FRESH',
    freshnessLagDays: 0,
    warning: null,
    isAvailable: true,
    ...overrides,
  };
  return new Map([[date, ctx]]);
}

// ─── Suite 1: buildWalkForwardSkeleton ────────────────────────────────────────

describe('T-05B buildWalkForwardSkeleton', () => {
  let output: WalkForwardSkeletonOutput;

  beforeAll(() => {
    output = buildWalkForwardSkeleton({ currentDate: FIXED_DATE }, new Map());
  });

  it('1. uses resolveCurrentDate contract — output.currentDate matches injected date', () => {
    expect(output.currentDate).toBe(FIXED_DATE);
  });

  it('1b. falls back to ISO date format when no currentDate provided', () => {
    const out = buildWalkForwardSkeleton({}, new Map());
    expect(out.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('2. task identifier is T-05B (not T-05 or T-10)', () => {
    expect(output.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
  });

  it('3. 500-day lookback contract is present as constant T05B_LOOKBACK_DAYS', () => {
    expect(T05B_LOOKBACK_DAYS).toBe(500);
  });

  it('3b. default output uses 500-day lookback', () => {
    expect(output.lookbackDays).toBe(500);
  });

  it('3c. accepts custom lookback days', () => {
    const out = buildWalkForwardSkeleton({ currentDate: FIXED_DATE, lookbackDays: 30 }, new Map());
    expect(out.lookbackDays).toBe(30);
  });

  it('4. output has a non-empty records array when lookback > 0', () => {
    expect(output.records.length).toBeGreaterThan(0);
  });

  it('5. safety contract fields are all true', () => {
    const sc = output.safetyContract;
    expect(sc.noDbWrite).toBe(true);
    expect(sc.noExternalApiCall).toBe(true);
    expect(sc.noLlmCall).toBe(true);
    expect(sc.noBuySellOutput).toBe(true);
    expect(sc.noTradingClaims).toBe(true);
    expect(sc.noPerformanceClaims).toBe(true);
    expect(sc.noLegacyHypotheses).toBe(true);
    expect(sc.resolveCurrentDateUsed).toBe(true);
    expect(sc.noHardcodedTodayCap).toBe(true);
    expect(sc.persistedRegimeResultReadOnly).toBe(true);
    expect(sc.observabilityOnly).toBe(true);
  });

  it('8. output does not contain forbidden strategy/performance keys', () => {
    const foundKey = containsForbiddenKey(output);
    expect(foundKey).toBeNull();
  });

  it('8b. JSON serialization of output does not contain H001-H012 patterns', () => {
    const jsonStr = JSON.stringify(output);
    expect(containsH001H012(jsonStr)).toBe(false);
  });

  it('9. no DB write: buildWalkForwardSkeleton does not import prisma', () => {
    // Verified structurally: function accepts injected Map, never calls prisma
    // Test confirms no DB-write behavior by checking safety contract
    expect(output.safetyContract.noDbWrite).toBe(true);
  });

  it('10. output is valid JSON (can be serialized and parsed)', () => {
    const jsonStr = JSON.stringify(output);
    expect(() => JSON.parse(jsonStr)).not.toThrow();
    const parsed = JSON.parse(jsonStr) as WalkForwardSkeletonOutput;
    expect(parsed.task).toBe('T-05B_WALK_FORWARD_BACKTEST_SKELETON_V2');
    expect(parsed.summary).toBeDefined();
    expect(parsed.rebalanceSchedule).toBeDefined();
    expect(Array.isArray(parsed.records)).toBe(true);
  });

  it('placeholder metrics are all null (no performance conclusions)', () => {
    for (const rec of output.records.slice(0, 5)) {
      expect(rec.placeholderMetrics.forwardReturnPlaceholder).toBeNull();
      expect(rec.placeholderMetrics.benchmarkReturnPlaceholder).toBeNull();
      expect(rec.placeholderMetrics.drawdownPlaceholder).toBeNull();
    }
  });

  it('summary missingDataDays equals totalRecords when no context provided', () => {
    expect(output.summary.missingDataDays).toBe(output.summary.totalRecords);
    expect(output.summary.recordsMissingRegimeContext).toBe(output.summary.totalRecords);
  });

  it('summary recordsWithRegimeContext increases when context map is provided', () => {
    const ctxMap = makeMockContextMap(FIXED_DATE);
    const out = buildWalkForwardSkeleton({ currentDate: FIXED_DATE, lookbackDays: 5 }, ctxMap);
    expect(out.summary.recordsWithRegimeContext).toBeGreaterThan(0);
  });
});

// ─── Suite 2: getRegimeContextForDate ─────────────────────────────────────────

describe('T-05B getRegimeContextForDate', () => {
  it('5. returns explicit MISSING state when contextMap is empty', () => {
    const result: RegimeContextForDate = getRegimeContextForDate('2026-05-06', new Map());
    expect(result.isAvailable).toBe(false);
    expect(result.dataAvailabilityFlag).toBe('MISSING');
    expect(result.regimeLabel).toBeNull();
    expect(result.warning).toBeTruthy();
  });

  it('5b. returns explicit MISSING when no prior date exists in map', () => {
    const ctxMap = makeMockContextMap('2026-06-01'); // future date only
    const result = getRegimeContextForDate('2026-05-01', ctxMap);
    expect(result.isAvailable).toBe(false);
    expect(result.dataAvailabilityFlag).toBe('MISSING');
  });

  it('returns AVAILABLE when exact date match exists', () => {
    const ctxMap = makeMockContextMap('2026-05-06');
    const result = getRegimeContextForDate('2026-05-06', ctxMap);
    expect(result.isAvailable).toBe(true);
    expect(result.dataAvailabilityFlag).toBe('AVAILABLE');
    expect(result.regimeLabel).toBe('BULL');
    expect(result.freshnessLagDays).toBe(0);
  });

  it('returns nearest prior date when exact match not available', () => {
    const ctxMap = makeMockContextMap('2026-05-04');
    const result = getRegimeContextForDate('2026-05-06', ctxMap);
    expect(result.isAvailable).toBe(true);
    expect(result.freshnessLagDays).toBe(2);
  });

  it('does not mutate the context map (read-only)', () => {
    const ctxMap = makeMockContextMap('2026-05-06');
    const sizeBefore = ctxMap.size;
    getRegimeContextForDate('2026-05-06', ctxMap);
    expect(ctxMap.size).toBe(sizeBefore);
  });

  it('does not throw on any input', () => {
    expect(() => getRegimeContextForDate('2026-05-06', new Map())).not.toThrow();
    expect(() => getRegimeContextForDate('invalid', new Map())).not.toThrow();
  });
});

// ─── Suite 3: buildMonthlyRebalanceSchedule ───────────────────────────────────

describe('T-05B buildMonthlyRebalanceSchedule', () => {
  it('4. monthly rebalance skeleton is deterministic — same input produces same output', () => {
    const dates = ['2026-01-02', '2026-01-05', '2026-02-02', '2026-02-03'];
    const r1 = buildMonthlyRebalanceSchedule('2026-01-01', '2026-02-28', dates);
    const r2 = buildMonthlyRebalanceSchedule('2026-01-01', '2026-02-28', dates);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('returns rebalanceCount 0 for empty trading dates', () => {
    const result: MonthlyRebalanceSchedule = buildMonthlyRebalanceSchedule(
      '2026-01-01', '2026-01-31', [],
    );
    expect(result.rebalanceCount).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('builds correct entry count for 3-month range', () => {
    const dates = [
      '2026-01-02', '2026-01-05', '2026-01-12',
      '2026-02-02', '2026-02-09',
      '2026-03-02', '2026-03-09',
    ];
    const result = buildMonthlyRebalanceSchedule('2026-01-01', '2026-03-31', dates);
    expect(result.rebalanceCount).toBe(3);
    expect(result.entries.filter(e => e.dataAvailabilityFlag === 'AVAILABLE')).toHaveLength(3);
  });

  it('marks NO_TRADING_DAYS for months with no available dates', () => {
    const dates = ['2026-01-04', '2026-03-02'];
    const result = buildMonthlyRebalanceSchedule('2026-01-01', '2026-03-31', dates);
    const febEntry = result.entries.find(e => e.monthLabel === '2026-02');
    expect(febEntry?.dataAvailabilityFlag).toBe('NO_TRADING_DAYS');
  });

  it('observabilityNote does not contain forbidden trading terms', () => {
    const result = buildMonthlyRebalanceSchedule('2026-01-01', '2026-01-31', ['2026-01-02']);
    const note = result.observabilityNote.toLowerCase();
    // The note should avoid forbidden terms even in negation context
    for (const term of ['roi', 'alpha', 'edge', 'profit']) {
      expect(note).not.toContain(term);
    }
    // Verify it's clearly observability-only
    expect(note).toContain('observabilit');
  });
});

// ─── Suite 4: rankCandidatesRuleOnly ──────────────────────────────────────────

describe('T-05B rankCandidatesRuleOnly', () => {
  it('6. rankCandidatesRuleOnly is deterministic', () => {
    const candidates = ['Z001', 'A001', 'M005', 'B002'];
    const r1: RankCandidatesResult = rankCandidatesRuleOnly(candidates, FIXED_DATE);
    const r2: RankCandidatesResult = rankCandidatesRuleOnly(candidates, FIXED_DATE);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('ranks by alphabetical order (A before B before Z)', () => {
    const result = rankCandidatesRuleOnly(['Z001', 'A001', 'B002'], FIXED_DATE);
    expect(result.rankedCandidates[0].candidateId).toBe('A001');
    expect(result.rankedCandidates[1].candidateId).toBe('B002');
    expect(result.rankedCandidates[2].candidateId).toBe('Z001');
  });

  it('rankingMethod is DETERMINISTIC_RULE_ONLY', () => {
    const result = rankCandidatesRuleOnly(['A001'], FIXED_DATE);
    expect(result.rankingMethod).toBe('DETERMINISTIC_RULE_ONLY');
  });

  it('does not contain forbidden keys in output', () => {
    const result = rankCandidatesRuleOnly(['A001', 'B002'], FIXED_DATE);
    const foundKey = containsForbiddenKey(result);
    expect(foundKey).toBeNull();
  });

  it('includes regime context in observableReasons when available', () => {
    const ctxMap = makeMockContextMap(FIXED_DATE);
    const regCtx = getRegimeContextForDate(FIXED_DATE, ctxMap);
    const result = rankCandidatesRuleOnly(['A001'], FIXED_DATE, regCtx);
    expect(result.rankedCandidates[0].observableReasons.some(r => r.includes('regime-context-observed'))).toBe(true);
  });

  it('flags regime-context-unavailable when no context provided', () => {
    const missingCtx = getRegimeContextForDate(FIXED_DATE, new Map());
    const result = rankCandidatesRuleOnly(['A001'], FIXED_DATE, missingCtx);
    expect(result.rankedCandidates[0].dataAvailabilityFlags).toContain('regime-context-unavailable');
  });

  it('handles empty candidate list gracefully', () => {
    const result = rankCandidatesRuleOnly([], FIXED_DATE);
    expect(result.candidateCount).toBe(0);
    expect(result.rankedCandidates).toHaveLength(0);
  });
});

// ─── Suite 5: computeTurnoverStats ────────────────────────────────────────────

describe('T-05B computeTurnoverStats', () => {
  it('7. computeTurnoverStats returns observability-only stats', () => {
    const stats: TurnoverStats = computeTurnoverStats(
      ['A001', 'A002', 'B001'],
      ['A001', 'A002', 'C001'],
      '2026-04-01',
      '2026-04-30',
      1,
      0,
    );
    expect(stats.candidateRetainedCount).toBe(2);
    expect(stats.candidateAddedCount).toBe(1);
    expect(stats.candidateRemovedCount).toBe(1);
    expect(stats.rebalanceCount).toBe(1);
    expect(stats.missingDataCount).toBe(0);
  });

  it('overlapRatio is between 0 and 1', () => {
    const stats = computeTurnoverStats(['A'], ['B'], '2026-01-01', '2026-01-31', 1, 0);
    expect(stats.overlapRatio).toBeGreaterThanOrEqual(0);
    expect(stats.overlapRatio).toBeLessThanOrEqual(1);
  });

  it('overlapRatio is 1 when sets are identical', () => {
    const stats = computeTurnoverStats(['A', 'B'], ['A', 'B'], '2026-01-01', '2026-01-31', 1, 0);
    expect(stats.overlapRatio).toBe(1);
  });

  it('overlapRatio is 0 when sets are completely different', () => {
    const stats = computeTurnoverStats(['A', 'B'], ['C', 'D'], '2026-01-01', '2026-01-31', 1, 0);
    expect(stats.overlapRatio).toBe(0);
  });

  it('handles empty previous candidates', () => {
    const stats = computeTurnoverStats([], ['A', 'B'], '2026-01-01', '2026-01-31', 1, 0);
    expect(stats.candidateAddedCount).toBe(2);
    expect(stats.candidateRemovedCount).toBe(0);
    expect(stats.candidateRetainedCount).toBe(0);
  });

  it('does not contain forbidden keys in output', () => {
    const stats = computeTurnoverStats(['A'], ['A'], '2026-01-01', '2026-01-31', 1, 0);
    const foundKey = containsForbiddenKey(stats);
    expect(foundKey).toBeNull();
  });

  it('observabilityNote does not claim performance', () => {
    const stats = computeTurnoverStats(['A'], ['A'], '2026-01-01', '2026-01-31', 1, 0);
    const note = stats.observabilityNote.toLowerCase();
    for (const term of ['roi', 'alpha', 'edge', 'profit', 'win_rate']) {
      expect(note).not.toContain(term);
    }
  });
});

// ─── Suite 6: Source Code Guardrails ──────────────────────────────────────────

describe('T-05B source code guardrails', () => {
  it('2. no hardcoded TODAY_CAP string appears in WalkForwardEngine.ts', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../WalkForwardEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    // TODAY_CAP is the specific Python skeleton hardcode we must avoid
    expect(content).not.toContain('TODAY_CAP');
    // No hardcoded date string used as a cap (allow comments and test strings)
    // The key guardrail: no date assignment like `const someCap = '2026-'...`
    expect(content).not.toMatch(/const\s+\w*[Cc]ap\w*\s*=\s*['"][0-9]{4}-/);
  });

  it('3. T05B_LOOKBACK_DAYS constant equals 500', () => {
    expect(T05B_LOOKBACK_DAYS).toBe(500);
  });

  it('9. WalkForwardEngine.ts does not import prisma (no DB write)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../WalkForwardEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toContain("from '@/lib/prisma'");
    expect(content).not.toContain("require('@/lib/prisma')");
    expect(content).not.toContain('prisma.');
  });

  it('9b. WalkForwardEngine.ts does not use fetch/axios (no external API call)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../WalkForwardEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toMatch(/\bfetch\s*\(/);
    expect(content).not.toContain('axios');
    expect(content).not.toContain('http.get');
    expect(content).not.toContain('https.get');
  });

  it('9c. WalkForwardEngine.ts does not call LLM providers', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../WalkForwardEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).not.toContain('openai');
    expect(content).not.toContain('anthropic');
    expect(content).not.toContain('gpt-');
    expect(content).not.toContain('claude-');
  });
});
