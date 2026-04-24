/**
 * SignalDisagreementEngine — Unit Tests
 *
 * Verifies:
 * 1. High-conflict scores → HIGH disagreement
 * 2. Low-conflict scores  → LOW disagreement
 * 3. ETF skips fundamental, no false HIGH from 0 fundamental
 * 4. Direction conflict pushes level to HIGH
 * 5. dataCoverage / missingSources / regime caution rules fire correctly
 * 6. Degraded mode returns valid structure
 * 7. alphaScore / recommendationBucket are never present in output (L1 isolation)
 */

import {
  computeDisagreementOverlay,
  type DisagreementInput,
} from '../SignalDisagreementEngine';

// ─── Fixtures ─────────────────────────────────────────────────────

const BASE_FULL: DisagreementInput = {
  technicalScore: 70,
  chipScore: 68,
  fundamentalScore: 72,
  isETF: false,
  dataCoverage: 'full',
  missingSources: [],
  marketRegime: 'Bull',
  marketRegimeConfidence: 75,
};

const BASE_ETF: DisagreementInput = {
  ...BASE_FULL,
  isETF: true,
  fundamentalScore: 0, // ETF: not used
};

// ─── 1. High conflict ─────────────────────────────────────────────

describe('high conflict scores', () => {
  test('tech=90, chip=20, fund=80 → HIGH disagreement', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      technicalScore: 90,
      chipScore: 20,
      fundamentalScore: 80,
    });
    expect(result.disagreementLevel).toBe('HIGH');
    expect(result.disagreementScore).toBeGreaterThanOrEqual(0.45);
    expect(result.isDegraded).toBe(false);
    expect(result.cautionReasons.length).toBeGreaterThan(0);
  });

  test('direction conflict (tech=80, chip=25) → HIGH even without large stdDev', () => {
    // stdDev(80, 25) = 27.5 → raw = 0.55 → already HIGH via formula
    // but direction conflict also applies (80 > 65, 25 < 35)
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      isETF: true,
      technicalScore: 80,
      chipScore: 25,
    });
    expect(result.disagreementLevel).toBe('HIGH');
    expect(result.cautionReasons.some((r) => r.includes('方向衝突') || r.includes('方向相反') || r.includes('強勢'))).toBe(true);
  });

  test('borderline direction conflict: tech=66, chip=34 → HIGH (both barely cross thresholds)', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      isETF: true,
      technicalScore: 66,
      chipScore: 34,
    });
    expect(result.disagreementLevel).toBe('HIGH');
  });
});

// ─── 2. Low conflict ──────────────────────────────────────────────

describe('low conflict scores', () => {
  test('tech=70, chip=68, fund=72 → LOW disagreement', () => {
    const result = computeDisagreementOverlay(BASE_FULL);
    expect(result.disagreementLevel).toBe('LOW');
    expect(result.disagreementScore).toBeLessThan(0.20);
    expect(result.adjustedConfidenceLabel).toBe('HIGH');
  });

  test('tech=50, chip=52, fund=48 → LOW disagreement', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      technicalScore: 50,
      chipScore: 52,
      fundamentalScore: 48,
    });
    expect(result.disagreementLevel).toBe('LOW');
  });

  test('moderate spread (tech=80, chip=60, fund=40) → MODERATE', () => {
    // mean=60, stdDev≈16.3, normalized≈0.33 → MODERATE
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      technicalScore: 80,
      chipScore: 60,
      fundamentalScore: 40,
    });
    expect(result.disagreementLevel).toBe('MODERATE');
    expect(result.disagreementScore).toBeGreaterThanOrEqual(0.20);
    expect(result.disagreementScore).toBeLessThan(0.45);
  });
});

// ─── 3. ETF handling ─────────────────────────────────────────────

describe('ETF handling', () => {
  test('ETF with fundamental=0 does NOT produce false HIGH from zero fundamental', () => {
    // If we mistakenly included fundamental=0 with tech=70, chip=65:
    // stdDev(70, 65, 0) ≈ 30 → HIGH — which would be wrong.
    // With ETF exclusion: stdDev(70, 65) = 2.5 → LOW ✓
    const result = computeDisagreementOverlay({
      ...BASE_ETF,
      technicalScore: 70,
      chipScore: 65,
    });
    expect(result.disagreementLevel).toBe('LOW');
    expect(result.activeScores).toHaveLength(2);
    expect(result.activeScores.map((s) => s.name)).not.toContain('基本面');
    expect(result.limitations.some((l) => l.includes('ETF'))).toBe(true);
  });

  test('ETF with genuine chip conflict → HIGH', () => {
    const result = computeDisagreementOverlay({
      ...BASE_ETF,
      technicalScore: 80,
      chipScore: 20,
    });
    expect(result.disagreementLevel).toBe('HIGH');
    expect(result.activeScores).toHaveLength(2);
  });

  test('ETF: isDegraded stays false with 2 valid scores', () => {
    const result = computeDisagreementOverlay(BASE_ETF);
    expect(result.isDegraded).toBe(false);
  });
});

// ─── 4. Condition downgrade rules ────────────────────────────────

describe('condition downgrade rules', () => {
  test('dataCoverage=limited → caution added', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      dataCoverage: 'limited',
    });
    expect(result.cautionReasons.some((r) => r.includes('不完整'))).toBe(true);
    expect(result.adjustedConfidenceLabel).not.toBe('HIGH');
  });

  test('dataCoverage=insufficient → stronger caution', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      dataCoverage: 'insufficient',
    });
    expect(result.cautionReasons.some((r) => r.includes('嚴重不足'))).toBe(true);
  });

  test('missingSources non-empty → caution added', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      missingSources: ['InstitutionalChip', 'MonthlyRevenue'],
    });
    expect(result.cautionReasons.some((r) => r.includes('資料來源缺失'))).toBe(true);
  });

  test('marketRegime=Unknown → caution added', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      marketRegime: 'Unknown',
    });
    expect(result.cautionReasons.some((r) => r.includes('市場環境無法判斷'))).toBe(true);
  });

  test('empty marketRegime string → same caution as Unknown', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      marketRegime: '',
    });
    expect(result.cautionReasons.some((r) => r.includes('市場環境無法判斷'))).toBe(true);
  });

  test('marketRegimeConfidence=30 → low confidence caution', () => {
    const result = computeDisagreementOverlay({
      ...BASE_FULL,
      marketRegimeConfidence: 30,
    });
    expect(result.cautionReasons.some((r) => r.includes('信心度偏低'))).toBe(true);
  });

  test('no caution conditions → adjustedConfidenceLabel=HIGH', () => {
    const result = computeDisagreementOverlay(BASE_FULL);
    expect(result.adjustedConfidenceLabel).toBe('HIGH');
    expect(result.cautionReasons).toHaveLength(0);
  });
});

// ─── 5. Degraded mode ────────────────────────────────────────────

describe('degraded mode', () => {
  test('returns well-formed structure in all cases (no throws)', () => {
    // Even with zeroed out everything
    const result = computeDisagreementOverlay({
      technicalScore: 0,
      chipScore: 0,
      fundamentalScore: 0,
      isETF: false,
      dataCoverage: 'insufficient',
      missingSources: ['A', 'B', 'C'],
      marketRegime: 'Unknown',
      marketRegimeConfidence: 0,
    });
    expect(result).toHaveProperty('disagreementScore');
    expect(result).toHaveProperty('disagreementLevel');
    expect(result).toHaveProperty('cautionReasons');
    expect(result).toHaveProperty('limitations');
    expect(result).toHaveProperty('isDegraded');
    expect(Array.isArray(result.cautionReasons)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
  });

  test('disagreementScore is always between 0 and 1', () => {
    const extremes: DisagreementInput[] = [
      { ...BASE_FULL, technicalScore: 0, chipScore: 100, fundamentalScore: 0 },
      { ...BASE_FULL, technicalScore: 100, chipScore: 0, fundamentalScore: 100 },
      BASE_FULL,
    ];
    for (const input of extremes) {
      const result = computeDisagreementOverlay(input);
      expect(result.disagreementScore).toBeGreaterThanOrEqual(0);
      expect(result.disagreementScore).toBeLessThanOrEqual(1);
    }
  });
});

// ─── 6. L1 isolation ─────────────────────────────────────────────

describe('L1 isolation', () => {
  test('output does NOT contain alphaScore or recommendationBucket', () => {
    const result = computeDisagreementOverlay(BASE_FULL);
    // These L1 fields must never appear in the overlay output
    expect(result).not.toHaveProperty('alphaScore');
    expect(result).not.toHaveProperty('recommendationBucket');
    expect(result).not.toHaveProperty('screenBucket');
  });

  test('input object is not mutated', () => {
    const input: DisagreementInput = { ...BASE_FULL };
    const before = JSON.stringify(input);
    computeDisagreementOverlay(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

// ─── 7. Output shape completeness ────────────────────────────────

describe('output shape', () => {
  test('always returns all required fields', () => {
    const result = computeDisagreementOverlay(BASE_FULL);
    expect(typeof result.disagreementScore).toBe('number');
    expect(['LOW', 'MODERATE', 'HIGH']).toContain(result.disagreementLevel);
    expect(['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW']).toContain(result.adjustedConfidenceLabel);
    expect(Array.isArray(result.activeScores)).toBe(true);
    expect(Array.isArray(result.cautionReasons)).toBe(true);
    expect(Array.isArray(result.limitations)).toBe(true);
    expect(typeof result.isDegraded).toBe('boolean');
  });

  test('activeScores each have name and value', () => {
    const result = computeDisagreementOverlay(BASE_FULL);
    for (const s of result.activeScores) {
      expect(typeof s.name).toBe('string');
      expect(typeof s.value).toBe('number');
    }
  });
});
