/**
 * RegimeStratifiedEngine — Unit Tests
 *
 * Verifies:
 * 1. Empty regime map → REGIME_FRAGILE + limitation added + hasSufficientRegimeData=false
 * 2. Observations correctly enriched with regime from map
 * 3. All Bull observations → REGIME_CONDITIONAL (only 1 regime)
 * 4. Bull+Bear same direction → REGIME_STABLE
 * 5. Bull+Bear opposite directions → REGIME_FRAGILE
 * 6. Single dominant regime (>80% share) → REGIME_CONDITIONAL even if same sign
 * 7. unknownRegimeFraction > 0.5 → REGIME_FRAGILE
 * 8. Small total sample < MIN_SAMPLE_FRAGILE → REGIME_FRAGILE
 * 9. Input not mutated
 * 10. L1 isolation: no alphaScore/recommendationBucket in output
 * 11. Result always returns all required fields
 */

import { computeRegimeStratified } from '../RegimeStratifiedEngine';
import { evaluateSignalEffectiveness } from '../SignalEffectivenessEngine';
import type { SignalEffectiveness, SignalHistory } from '../types';

jest.mock('../SignalEffectivenessEngine');

const mockEvaluate = evaluateSignalEffectiveness as jest.MockedFunction<
  typeof evaluateSignalEffectiveness
>;

// ─── Fixtures ─────────────────────────────────────────────────────

function makeEff(overrides: Partial<SignalEffectiveness> = {}): SignalEffectiveness {
  return {
    signalType: 'topic_surging',
    window: 5,
    sampleSize: 30,
    hitRate: 0.6,
    avgReturn: 0.02,
    excessReturn: 0.01,
    excessHitRate: 0.55,
    volatility: 0.04,
    regimeBreakdown: {},
    persistence: { avgDuration: 1, continuationRate: 0.3 },
    stabilityScore: 0.7,
    classification: 'WEAK_SIGNAL',
    limitations: [],
    ...overrides,
  };
}

function makeHistory(
  count: number,
  dates?: string[],
): SignalHistory {
  const obs = (dates ?? Array.from({ length: count }, (_, i) => {
    const d = new Date(2025, 0, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })).map((date) => ({
    signalType: 'topic_surging' as const,
    date,
    context: {},
  }));

  return {
    signalType: 'topic_surging',
    observations: obs,
    limitations: [],
  };
}

function emptyMap(): Map<string, string> {
  return new Map();
}

function makeMap(entries: Array<[string, string]>): Map<string, string> {
  return new Map(entries);
}

afterEach(() => jest.clearAllMocks());

// ─── 1. Empty regime map ──────────────────────────────────────────

describe('empty regime map', () => {
  test('returns REGIME_FRAGILE, adds limitation, hasSufficientRegimeData=false', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff({ sampleSize: 20 }));

    const result = await computeRegimeStratified(history, 5, emptyMap());

    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_FRAGILE');
    expect(result.hasSufficientRegimeData).toBe(false);
    expect(result.limitations.some((l) => l.includes('DailyMarketSnapshot'))).toBe(true);
  });
});

// ─── 2. Regime enrichment ─────────────────────────────────────────

describe('regime enrichment', () => {
  test('observations are enriched with regime from map', async () => {
    const dates = ['2025-01-01', '2025-01-02', '2025-01-03'];
    const history = makeHistory(3, dates);
    const regimeMap = makeMap([
      ['2025-01-01', 'Bull'],
      ['2025-01-02', 'Bear'],
      ['2025-01-03', 'Neutral'],
    ]);
    mockEvaluate.mockResolvedValue(makeEff());

    await computeRegimeStratified(history, 5, regimeMap);

    // The enriched history passed to evaluateSignalEffectiveness should have regime set
    const enrichedHistory = mockEvaluate.mock.calls[0][0];
    expect(enrichedHistory.observations[0].context.regime).toBe('Bull');
    expect(enrichedHistory.observations[1].context.regime).toBe('Bear');
    expect(enrichedHistory.observations[2].context.regime).toBe('Neutral');
  });

  test('observation not in map keeps original context.regime if set', async () => {
    const history: SignalHistory = {
      signalType: 'topic_surging',
      observations: [{
        signalType: 'topic_surging',
        date: '2025-06-01',
        context: { regime: 'Bull' }, // already set by builder
      }],
      limitations: [],
    };
    const regimeMap = emptyMap(); // no match
    mockEvaluate.mockResolvedValue(makeEff());

    await computeRegimeStratified(history, 5, regimeMap);

    const enrichedHistory = mockEvaluate.mock.calls[0][0];
    expect(enrichedHistory.observations[0].context.regime).toBe('Bull');
  });
});

// ─── 3. Single regime (CONDITIONAL) ──────────────────────────────

describe('single regime', () => {
  test('only Bull data available → REGIME_CONDITIONAL or FRAGILE (not STABLE)', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff({
      regimeBreakdown: {
        bull: { sampleSize: 20, hitRate: 0.65, avgReturn: 0.03, excessReturn: 0.01 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, emptyMap());

    // Only 1 assessable regime → cannot be STABLE
    expect(result.regimeDependency.consistencyLabel).not.toBe('REGIME_STABLE');
  });
});

// ─── 4. Bull+Bear same direction → STABLE ────────────────────────

describe('REGIME_STABLE', () => {
  test('Bull+Bear both positive excessReturn, no dominant regime → STABLE', async () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, '0')}`,
    );
    const history = makeHistory(20, dates);
    const regimeMap = makeMap(
      dates.slice(0, 10).map((d) => [d, 'Bull'] as [string, string])
        .concat(dates.slice(10).map((d) => [d, 'Bear'] as [string, string])),
    );

    mockEvaluate.mockResolvedValue(makeEff({
      sampleSize: 20,
      regimeBreakdown: {
        bull: { sampleSize: 10, hitRate: 0.6, avgReturn: 0.02, excessReturn: 0.01, excessHitRate: 0.6 },
        bear: { sampleSize: 10, hitRate: 0.5, avgReturn: 0.01, excessReturn: 0.005, excessHitRate: 0.5 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, regimeMap);

    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_STABLE');
    expect(result.regimeDependency.dominantRegime).toBe('Bull'); // higher excessReturn
    expect(result.regimeDependency.fragileRegimes).toHaveLength(0);
  });
});

// ─── 5. Bull+Bear opposite → FRAGILE ─────────────────────────────

describe('REGIME_FRAGILE', () => {
  test('Bull positive excessReturn, Bear negative → REGIME_FRAGILE', async () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, '0')}`,
    );
    const history = makeHistory(20, dates);
    const regimeMap = makeMap(
      dates.slice(0, 10).map((d) => [d, 'Bull'] as [string, string])
        .concat(dates.slice(10).map((d) => [d, 'Bear'] as [string, string])),
    );

    mockEvaluate.mockResolvedValue(makeEff({
      sampleSize: 20,
      regimeBreakdown: {
        bull: { sampleSize: 10, hitRate: 0.7, avgReturn: 0.03, excessReturn: 0.02, excessHitRate: 0.6 },
        bear: { sampleSize: 10, hitRate: 0.4, avgReturn: -0.01, excessReturn: -0.015, excessHitRate: 0.3 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, regimeMap);

    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_FRAGILE');
    expect(result.regimeDependency.fragileRegimes).toContain('Bear');
  });

  test('unknownRegimeFraction > 0.5 → REGIME_FRAGILE', async () => {
    // 20 observations, only 5 in map → 15 unknown (75%)
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, '0')}`,
    );
    const history = makeHistory(20, dates);
    const regimeMap = makeMap(
      dates.slice(0, 5).map((d) => [d, 'Bull'] as [string, string]),
    );

    mockEvaluate.mockResolvedValue(makeEff({ sampleSize: 20, regimeBreakdown: {} }));

    const result = await computeRegimeStratified(history, 5, regimeMap);

    expect(result.unknownRegimeFraction).toBeGreaterThan(0.5);
    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_FRAGILE');
  });

  test('small sampleSize < 10 → REGIME_FRAGILE', async () => {
    const history = makeHistory(5);
    mockEvaluate.mockResolvedValue(makeEff({
      sampleSize: 5,
      regimeBreakdown: {
        bull: { sampleSize: 3, hitRate: 0.7, avgReturn: 0.02, excessReturn: 0.01 },
        bear: { sampleSize: 2, hitRate: 0.5, avgReturn: 0.01, excessReturn: 0.005 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, emptyMap());

    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_FRAGILE');
  });
});

// ─── 6. Dominant single regime (CONDITIONAL) ─────────────────────

describe('REGIME_CONDITIONAL', () => {
  test('one regime with >80% sample share → CONDITIONAL even if same sign', async () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, '0')}`,
    );
    const history = makeHistory(20, dates);
    const regimeMap = makeMap(
      dates.slice(0, 18).map((d) => [d, 'Bull'] as [string, string])
        .concat(dates.slice(18).map((d) => [d, 'Bear'] as [string, string])),
    );

    mockEvaluate.mockResolvedValue(makeEff({
      sampleSize: 20,
      regimeBreakdown: {
        // Bull dominates: 18/(18+2) = 90%
        bull: { sampleSize: 18, hitRate: 0.6, avgReturn: 0.02, excessReturn: 0.01, excessHitRate: 0.55 },
        bear: { sampleSize: 2, hitRate: 0.5, avgReturn: 0.01, excessReturn: 0.005, excessHitRate: 0.5 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, regimeMap);

    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_CONDITIONAL');
  });

  test('only 1 regime positive excessReturn → CONDITIONAL', async () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      `2025-01-${String(i + 1).padStart(2, '0')}`,
    );
    const history = makeHistory(20, dates);
    const regimeMap = makeMap(
      dates.slice(0, 10).map((d) => [d, 'Bull'] as [string, string])
        .concat(dates.slice(10).map((d) => [d, 'Bear'] as [string, string])),
    );

    mockEvaluate.mockResolvedValue(makeEff({
      sampleSize: 20,
      regimeBreakdown: {
        bull: { sampleSize: 10, hitRate: 0.7, avgReturn: 0.03, excessReturn: 0.02, excessHitRate: 0.65 },
        bear: { sampleSize: 10, hitRate: 0.5, avgReturn: 0.0, excessReturn: 0.0, excessHitRate: 0.5 },
      },
    }));

    const result = await computeRegimeStratified(history, 5, regimeMap);

    // Bull positive, Bear flat (0) → positiveExcess=1, negativeOrFlat=1 → CONDITIONAL
    expect(result.regimeDependency.consistencyLabel).toBe('REGIME_CONDITIONAL');
    expect(result.regimeDependency.dominantRegime).toBe('Bull');
  });
});

// ─── 7. Input not mutated ─────────────────────────────────────────

describe('input immutability', () => {
  test('original history is not mutated', async () => {
    const history = makeHistory(10);
    const before = JSON.stringify(history);
    mockEvaluate.mockResolvedValue(makeEff());

    await computeRegimeStratified(history, 5, emptyMap());

    expect(JSON.stringify(history)).toBe(before);
  });
});

// ─── 8. L1 isolation ─────────────────────────────────────────────

describe('L1 isolation', () => {
  test('output does not contain alphaScore or recommendationBucket', async () => {
    const history = makeHistory(10);
    mockEvaluate.mockResolvedValue(makeEff());

    const result = await computeRegimeStratified(history, 5, emptyMap());

    expect(result).not.toHaveProperty('alphaScore');
    expect(result).not.toHaveProperty('recommendationBucket');
    expect(result.overall).not.toHaveProperty('alphaScore');
  });
});

// ─── 9. Output shape completeness ────────────────────────────────

describe('output shape', () => {
  test('always returns all required fields', async () => {
    const history = makeHistory(10);
    mockEvaluate.mockResolvedValue(makeEff());

    const result = await computeRegimeStratified(history, 5, emptyMap());

    expect(result).toHaveProperty('signalType');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('sampleSize');
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('regimeBreakdown');
    expect(result).toHaveProperty('regimeDependency');
    expect(result).toHaveProperty('unknownRegimeFraction');
    expect(result).toHaveProperty('hasSufficientRegimeData');
    expect(result).toHaveProperty('limitations');
    expect(['REGIME_STABLE', 'REGIME_CONDITIONAL', 'REGIME_FRAGILE']).toContain(
      result.regimeDependency.consistencyLabel,
    );
    expect(Array.isArray(result.regimeDependency.fragileRegimes)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
    expect(typeof result.unknownRegimeFraction).toBe('number');
    expect(typeof result.hasSufficientRegimeData).toBe('boolean');
  });
});
