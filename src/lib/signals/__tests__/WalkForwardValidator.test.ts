/**
 * WalkForwardValidator — Unit Tests
 *
 * Verifies:
 * 1. Insufficient observations → hasSufficientData=false, degraded result
 * 2. Sufficient observations → evaluates both halves, hasSufficientData=true
 * 3. STABLE: identical halves → STABLE consistency
 * 4. UNSTABLE: wildly different classifications + opposite excess signs
 * 5. MIXED: moderate deviation, one condition fails
 * 6. Input history is NOT mutated
 * 7. L1 isolation: no alphaScore/recommendationBucket in output
 * 8. Result always returns all required fields
 */

import { runWalkForwardValidation } from '../WalkForwardValidator';
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
    sampleSize: 10,
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

/**
 * Build a SignalHistory with `count` observations spaced 1 day apart.
 * Dates are in YYYY-MM-DD format, ascending.
 */
function makeHistory(count: number): SignalHistory {
  const observations = Array.from({ length: count }, (_, i) => {
    const d = new Date(2025, 0, 1 + i); // Jan 1 + i days
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return {
      signalType: 'topic_surging' as const,
      date: `${yyyy}-${mm}-${dd}`,
      context: {},
    };
  });
  return {
    signalType: 'topic_surging',
    observations,
    limitations: [],
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

// ─── 1. Insufficient data ─────────────────────────────────────────

describe('insufficient data', () => {
  test('0 observations → hasSufficientData=false, UNSTABLE, no mock called', async () => {
    const history = makeHistory(0);
    const result = await runWalkForwardValidation(history, 5);

    expect(result.hasSufficientData).toBe(false);
    expect(result.consistency.overallLabel).toBe('UNSTABLE');
    expect(result.firstHalf.sampleSize).toBe(0);
    expect(result.secondHalf.sampleSize).toBe(0);
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  test('15 observations (7 + 8) — first half only 7 → hasSufficientData=false', async () => {
    const history = makeHistory(15); // mid=7, firstObs.length=7 < 8
    const result = await runWalkForwardValidation(history, 5);

    expect(result.hasSufficientData).toBe(false);
    expect(mockEvaluate).not.toHaveBeenCalled();
    expect(result.limitations.some((l) => l.includes('走勢驗證'))).toBe(true);
  });

  test('16 observations (8 + 8) → hasSufficientData=true, mock called twice', async () => {
    const history = makeHistory(16);
    mockEvaluate.mockResolvedValue(makeEff());

    const result = await runWalkForwardValidation(history, 5);

    expect(result.hasSufficientData).toBe(true);
    expect(mockEvaluate).toHaveBeenCalledTimes(2);
  });
});

// ─── 2. Chronological split ───────────────────────────────────────

describe('chronological split', () => {
  test('first half receives earlier half of sorted observations', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff());

    await runWalkForwardValidation(history, 5);

    // First call should receive observations 0-9 (earlier), second 10-19 (later)
    const firstCallHistory = mockEvaluate.mock.calls[0][0];
    const secondCallHistory = mockEvaluate.mock.calls[1][0];

    expect(firstCallHistory.observations).toHaveLength(10);
    expect(secondCallHistory.observations).toHaveLength(10);
    // First half ends before second half starts
    const lastFirst = firstCallHistory.observations.at(-1)!.date;
    const firstSecond = secondCallHistory.observations[0].date;
    expect(lastFirst < firstSecond).toBe(true);
  });

  test('start/end dates are populated from observation dates', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff({ sampleSize: 10 }));

    const result = await runWalkForwardValidation(history, 5);

    expect(result.firstHalf.start).toBeTruthy();
    expect(result.firstHalf.end).toBeTruthy();
    expect(result.secondHalf.start).toBeTruthy();
    expect(result.secondHalf.end).toBeTruthy();
    expect(result.firstHalf.end < result.secondHalf.start).toBe(true);
  });
});

// ─── 3. STABLE consistency ────────────────────────────────────────

describe('STABLE consistency', () => {
  test('identical halves → STABLE', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(
      makeEff({ hitRate: 0.6, excessReturn: 0.01, classification: 'WEAK_SIGNAL' }),
    );

    const result = await runWalkForwardValidation(history, 5);

    expect(result.consistency.overallLabel).toBe('STABLE');
    expect(result.consistency.classificationMatch).toBe(true);
    expect(result.consistency.excessReturnSignMatch).toBe(true);
    expect(result.consistency.hitRateDeviation).toBe(0);
  });
});

// ─── 4. UNSTABLE consistency ──────────────────────────────────────

describe('UNSTABLE consistency', () => {
  test('high hitRate deviation (0.5 apart) → UNSTABLE', async () => {
    const history = makeHistory(20);
    mockEvaluate
      .mockResolvedValueOnce(makeEff({ hitRate: 0.8, excessReturn: 0.02, classification: 'STRONG_SIGNAL' }))
      .mockResolvedValueOnce(makeEff({ hitRate: 0.3, excessReturn: -0.01, classification: 'NOISE' }));

    const result = await runWalkForwardValidation(history, 5);

    expect(result.consistency.overallLabel).toBe('UNSTABLE');
    expect(result.consistency.hitRateDeviation).toBeCloseTo(0.5, 4);
    expect(result.consistency.classificationMatch).toBe(false);
    expect(result.consistency.excessReturnSignMatch).toBe(false);
  });

  test('classification mismatch + opposite excess sign (low deviation) → UNSTABLE', async () => {
    const history = makeHistory(20);
    mockEvaluate
      .mockResolvedValueOnce(makeEff({ hitRate: 0.55, excessReturn: 0.01, classification: 'WEAK_SIGNAL' }))
      .mockResolvedValueOnce(makeEff({ hitRate: 0.45, excessReturn: -0.01, classification: 'NOISE' }));

    const result = await runWalkForwardValidation(history, 5);

    // hitRateDev=0.10 (<0.15), but BOTH !classificationMatch AND !excessReturnSignMatch → UNSTABLE
    expect(result.consistency.overallLabel).toBe('UNSTABLE');
  });
});

// ─── 5. MIXED consistency ────────────────────────────────────────

describe('MIXED consistency', () => {
  test('moderate hitRate deviation, matching classification → MIXED', async () => {
    const history = makeHistory(20);
    mockEvaluate
      .mockResolvedValueOnce(makeEff({ hitRate: 0.65, excessReturn: 0.01, classification: 'WEAK_SIGNAL' }))
      .mockResolvedValueOnce(makeEff({ hitRate: 0.45, excessReturn: 0.005, classification: 'WEAK_SIGNAL' }));

    const result = await runWalkForwardValidation(history, 5);

    // hitRateDev ≈ 0.20 (0.15–0.30 range), classificationMatch=true → MIXED
    expect(result.consistency.overallLabel).toBe('MIXED');
    expect(result.consistency.classificationMatch).toBe(true);
  });
});

// ─── 6. Input not mutated ────────────────────────────────────────

describe('input immutability', () => {
  test('runWalkForwardValidation does not mutate input history', async () => {
    const history = makeHistory(20);
    const before = JSON.stringify(history);
    mockEvaluate.mockResolvedValue(makeEff());

    await runWalkForwardValidation(history, 5);

    expect(JSON.stringify(history)).toBe(before);
  });
});

// ─── 7. L1 isolation ─────────────────────────────────────────────

describe('L1 isolation', () => {
  test('result does NOT contain alphaScore or recommendationBucket', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff());

    const result = await runWalkForwardValidation(history, 5);

    expect(result).not.toHaveProperty('alphaScore');
    expect(result).not.toHaveProperty('recommendationBucket');
    expect(result.firstHalf).not.toHaveProperty('alphaScore');
    expect(result.secondHalf).not.toHaveProperty('alphaScore');
  });
});

// ─── 8. Output shape completeness ────────────────────────────────

describe('output shape', () => {
  test('always returns all required fields (sufficient data)', async () => {
    const history = makeHistory(20);
    mockEvaluate.mockResolvedValue(makeEff());

    const result = await runWalkForwardValidation(history, 5);

    expect(result).toHaveProperty('signalType');
    expect(result).toHaveProperty('window');
    expect(result).toHaveProperty('firstHalf');
    expect(result).toHaveProperty('secondHalf');
    expect(result).toHaveProperty('hasSufficientData');
    expect(result).toHaveProperty('consistency');
    expect(result).toHaveProperty('limitations');
    expect(typeof result.consistency.hitRateDeviation).toBe('number');
    expect(typeof result.consistency.classificationMatch).toBe('boolean');
    expect(typeof result.consistency.excessReturnSignMatch).toBe('boolean');
    expect(['STABLE', 'MIXED', 'UNSTABLE']).toContain(result.consistency.overallLabel);
  });

  test('always returns all required fields (insufficient data)', async () => {
    const history = makeHistory(4);

    const result = await runWalkForwardValidation(history, 5);

    expect(result).toHaveProperty('firstHalf');
    expect(result).toHaveProperty('secondHalf');
    expect(result).toHaveProperty('hasSufficientData');
    expect(result.hasSufficientData).toBe(false);
    expect(Array.isArray(result.limitations)).toBe(true);
  });
});
