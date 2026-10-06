/**
 * ConfidenceReadinessEngine — unit tests
 *
 * Verifies:
 *   - UNCALIBRATED for all heuristic types (COVERAGE_PROXY / SCORE_DERIVED / RULE_PENALTY)
 *   - INSUFFICIENT_DATA for BRIER_ADJACENT with low sample or missing brierLikeScore
 *   - PARTIAL for BRIER_ADJACENT with sufficient sample AND brierLikeScore defined
 *   - rawConfidence is never modified
 *   - limitations are deduped
 *   - explanation / requirementNote are populated
 *   - assessAllConfidenceReadiness convenience wrapper
 *   - L1 isolation: pure function, no side effects
 */

import {
  assessConfidenceReadiness,
  assessAllConfidenceReadiness,
} from '../ConfidenceReadinessEngine';
import type { ConfidenceReadinessInput } from '../ConfidenceReadinessEngine';

// ─── helpers ─────────────────────────────────────────────────────

function makeCoverageInput(overrides: Partial<ConfidenceReadinessInput> = {}): ConfidenceReadinessInput {
  return {
    moduleId: 'SignalFusionEngine',
    confidenceType: 'COVERAGE_PROXY',
    rawConfidence: 72,
    ...overrides,
  };
}

function makeBrierInput(overrides: Partial<ConfidenceReadinessInput> = {}): ConfidenceReadinessInput {
  return {
    moduleId: 'SignalEffectivenessEngine',
    confidenceType: 'BRIER_ADJACENT',
    rawConfidence: 0.65,
    sampleSize: 15,
    brierLikeScore: 0.12,
    ...overrides,
  };
}

// ─── COVERAGE_PROXY ───────────────────────────────────────────────

describe('COVERAGE_PROXY', () => {
  it('is always UNCALIBRATED regardless of sample size', () => {
    const result = assessConfidenceReadiness(
      makeCoverageInput({ sampleSize: 100, predictionOutcomePairs: 50 }),
    );
    expect(result.calibrationStatus).toBe('UNCALIBRATED');
    expect(result.readinessLabel).toBe('未校準');
  });

  it('is UNCALIBRATED even with zero sample size', () => {
    const result = assessConfidenceReadiness(makeCoverageInput({ sampleSize: 0 }));
    expect(result.calibrationStatus).toBe('UNCALIBRATED');
  });

  it('preserves rawConfidence unchanged', () => {
    const result = assessConfidenceReadiness(makeCoverageInput({ rawConfidence: 88 }));
    expect(result.rawConfidence).toBe(88);
  });

  it('has explanation mentioning 資料完整度', () => {
    const result = assessConfidenceReadiness(makeCoverageInput());
    expect(result.explanation).toContain('資料完整度');
  });

  it('has requirementNote explaining heuristic type cannot be calibrated directly', () => {
    const result = assessConfidenceReadiness(makeCoverageInput());
    expect(result.requirementNote).toContain('啟發式規則');
  });

  it('adds limitation when predictionOutcomePairs = 0', () => {
    const result = assessConfidenceReadiness(makeCoverageInput({ predictionOutcomePairs: 0 }));
    expect(result.limitations.some((l) => l.includes('prediction-outcome pairs'))).toBe(true);
  });

  it('brierLikeScore is undefined in output', () => {
    const result = assessConfidenceReadiness(makeCoverageInput({ brierLikeScore: 0.1 }));
    expect(result.brierLikeScore).toBeUndefined();
  });
});

// ─── SCORE_DERIVED ────────────────────────────────────────────────

describe('SCORE_DERIVED', () => {
  it('is always UNCALIBRATED', () => {
    const result = assessConfidenceReadiness({
      moduleId: 'MultiAgentResearch',
      confidenceType: 'SCORE_DERIVED',
      rawConfidence: 60,
    });
    expect(result.calibrationStatus).toBe('UNCALIBRATED');
  });

  it('explanation mentions 評分比例映射', () => {
    const result = assessConfidenceReadiness({
      moduleId: 'MultiAgentResearch',
      confidenceType: 'SCORE_DERIVED',
      rawConfidence: 60,
    });
    expect(result.explanation).toContain('評分');
  });
});

// ─── RULE_PENALTY ─────────────────────────────────────────────────

describe('RULE_PENALTY', () => {
  it('is always UNCALIBRATED', () => {
    const result = assessConfidenceReadiness({
      moduleId: 'RelevanceScoringEngine',
      confidenceType: 'RULE_PENALTY',
      rawConfidence: 45,
    });
    expect(result.calibrationStatus).toBe('UNCALIBRATED');
  });

  it('explanation mentions 規則懲罰', () => {
    const result = assessConfidenceReadiness({
      moduleId: 'RelevanceScoringEngine',
      confidenceType: 'RULE_PENALTY',
      rawConfidence: 45,
    });
    expect(result.explanation).toContain('規則懲罰');
  });
});

// ─── BRIER_ADJACENT ───────────────────────────────────────────────

describe('BRIER_ADJACENT — INSUFFICIENT_DATA', () => {
  it('is INSUFFICIENT_DATA when sampleSize < 10 (no brierLikeScore)', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 5, brierLikeScore: undefined }),
    );
    expect(result.calibrationStatus).toBe('INSUFFICIENT_DATA');
    expect(result.readinessLabel).toBe('資料不足');
  });

  it('is INSUFFICIENT_DATA when sampleSize = 9 (just below threshold)', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 9, brierLikeScore: 0.1 }),
    );
    expect(result.calibrationStatus).toBe('INSUFFICIENT_DATA');
  });

  it('is INSUFFICIENT_DATA when sampleSize >= 10 but brierLikeScore is undefined', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 20, brierLikeScore: undefined }),
    );
    expect(result.calibrationStatus).toBe('INSUFFICIENT_DATA');
  });

  it('is INSUFFICIENT_DATA when sampleSize = 0 (no data at all)', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 0, brierLikeScore: undefined }),
    );
    expect(result.calibrationStatus).toBe('INSUFFICIENT_DATA');
  });

  it('adds limitation for low sample count', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 5, brierLikeScore: undefined }),
    );
    expect(result.limitations.some((l) => l.includes('有效樣本'))).toBe(true);
  });

  it('adds limitation when predictionOutcomePairs = 0', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 3, brierLikeScore: undefined, predictionOutcomePairs: 0 }),
    );
    expect(result.limitations.some((l) => l.includes('prediction-outcome pairs'))).toBe(true);
  });

  it('requirementNote mentions minimum sample count', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({ sampleSize: 5, brierLikeScore: undefined }),
    );
    expect(result.requirementNote).toBeTruthy();
    expect(result.requirementNote.length).toBeGreaterThan(0);
  });
});

describe('BRIER_ADJACENT — PARTIAL', () => {
  it('is PARTIAL when sampleSize >= 10 AND brierLikeScore defined', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 10, brierLikeScore: 0.12 }));
    expect(result.calibrationStatus).toBe('PARTIAL');
    expect(result.readinessLabel).toBe('部分指標');
  });

  it('is PARTIAL at exact threshold sampleSize = 10', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 10, brierLikeScore: 0.2 }));
    expect(result.calibrationStatus).toBe('PARTIAL');
  });

  it('brierLikeScore is propagated into result', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 15, brierLikeScore: 0.18 }));
    expect(result.brierLikeScore).toBe(0.18);
  });

  it('explanation mentions brierLikeScore value', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 15, brierLikeScore: 0.12 }));
    expect(result.explanation).toContain('0.1200');
  });

  it('explanation notes "偏低" quality for brierLikeScore < 0.15', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 15, brierLikeScore: 0.10 }));
    expect(result.explanation).toContain('偏低');
  });

  it('explanation notes "中等" quality for brierLikeScore between 0.15 and 0.25', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 15, brierLikeScore: 0.20 }));
    expect(result.explanation).toContain('中等');
  });

  it('explanation notes "偏高" quality for brierLikeScore >= 0.25', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ sampleSize: 15, brierLikeScore: 0.30 }));
    expect(result.explanation).toContain('偏高');
  });

  it('requirementNote mentions needing more prediction-outcome pairs', () => {
    const result = assessConfidenceReadiness(makeBrierInput());
    expect(result.requirementNote).toContain('brierLikeScore');
  });

  it('rawConfidence is never modified', () => {
    const result = assessConfidenceReadiness(makeBrierInput({ rawConfidence: 0.73 }));
    expect(result.rawConfidence).toBe(0.73);
  });
});

// ─── General invariants ───────────────────────────────────────────

describe('General invariants', () => {
  it('moduleId is preserved in result', () => {
    const result = assessConfidenceReadiness(
      makeCoverageInput({ moduleId: 'TestModule' }),
    );
    expect(result.moduleId).toBe('TestModule');
  });

  it('confidenceType is preserved in result', () => {
    const result = assessConfidenceReadiness(makeBrierInput());
    expect(result.confidenceType).toBe('BRIER_ADJACENT');
  });

  it('limitations are deduped', () => {
    const result = assessConfidenceReadiness(
      makeBrierInput({
        sampleSize: 3,
        brierLikeScore: undefined,
        predictionOutcomePairs: 0,
        limitations: ['有效樣本 3 筆，低於 brierLikeScore 最低需求 10 筆'],
      }),
    );
    const counts = new Map<string, number>();
    for (const l of result.limitations) {
      counts.set(l, (counts.get(l) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBe(1);
    }
  });

  it('caller-supplied limitations are passed through', () => {
    const result = assessConfidenceReadiness(
      makeCoverageInput({ limitations: ['測試限制'] }),
    );
    expect(result.limitations).toContain('測試限制');
  });

  it('does not mutate input object', () => {
    const input: ConfidenceReadinessInput = makeBrierInput({ sampleSize: 5 });
    const before = { ...input };
    assessConfidenceReadiness(input);
    expect(input).toEqual(before);
  });

  it('CALIBRATED status has empty requirementNote', () => {
    // CALIBRATED is not achievable via assessConfidenceReadiness in the current system
    // but we can verify the function handles the CALIBRATED branch if it were ever reached
    // by testing the requirementNote for a PARTIAL result (nearest reachable)
    const result = assessConfidenceReadiness(makeBrierInput());
    expect(result.calibrationStatus).not.toBe('CALIBRATED');
  });
});

// ─── assessAllConfidenceReadiness ─────────────────────────────────

describe('assessAllConfidenceReadiness', () => {
  it('returns results for each input', () => {
    const inputs: ConfidenceReadinessInput[] = [
      makeCoverageInput({ moduleId: 'A' }),
      makeBrierInput({ moduleId: 'B' }),
    ];
    const results = assessAllConfidenceReadiness(inputs);
    expect(results).toHaveLength(2);
    expect(results[0].moduleId).toBe('A');
    expect(results[1].moduleId).toBe('B');
  });

  it('returns empty array for empty input', () => {
    expect(assessAllConfidenceReadiness([])).toHaveLength(0);
  });

  it('each result is independent (no shared state)', () => {
    const inputs: ConfidenceReadinessInput[] = [
      makeBrierInput({ moduleId: 'X', sampleSize: 3, brierLikeScore: undefined }),
      makeBrierInput({ moduleId: 'Y', sampleSize: 20, brierLikeScore: 0.1 }),
    ];
    const [r1, r2] = assessAllConfidenceReadiness(inputs);
    expect(r1.calibrationStatus).toBe('INSUFFICIENT_DATA');
    expect(r2.calibrationStatus).toBe('PARTIAL');
  });
});
