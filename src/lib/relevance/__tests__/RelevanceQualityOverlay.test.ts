import {
  applyQualityOverlay,
  computeEventQualityOverlay,
  computeGenericQualityOverlay,
  computeSignalQualityOverlay,
  type SignalOverlayInput,
} from '../RelevanceQualityOverlay';
import type { RelevantInsight } from '../types';
import type { EventSourceQuality } from '@/lib/events/EventSourceQualityEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSignalInput(overrides: Partial<SignalOverlayInput> = {}): SignalOverlayInput {
  return {
    stabilityScore: 0.8,
    sampleSize: 30,
    regimeBreakdown: { bull: { sampleSize: 10, avgReturn: 0.02, hitRate: 0.6 }, bear: { sampleSize: 8, avgReturn: 0.01, hitRate: 0.55 }, neutral: { sampleSize: 5, avgReturn: 0.005, hitRate: 0.5 } },
    classification: 'STRONG_SIGNAL',
    ...overrides,
  };
}

function makeEventSourceQuality(label: EventSourceQuality['qualityLabel']): EventSourceQuality {
  return {
    qualityLabel: label,
    confidenceAdjustment: 'NONE',
    rssRatio: label === 'LIVE_CONFIDENT' ? 1 : 0.5,
    mockRatio: label === 'SIMULATION_DOMINATED' ? 0.8 : 0.2,
    rssCount: 5,
    mockCount: label === 'SIMULATION_DOMINATED' ? 4 : 1,
    totalEvents: 5,
    limitations: [],
    trustLevelBreakdown: { official: 2, mainstream: 2, secondary: 1, unknown: 0 },
    sourceTypeTracked: true,
  };
}

function makeInsight(overrides: Partial<RelevantInsight> = {}): RelevantInsight {
  return {
    id: 'test',
    category: 'signal',
    title: 'test insight',
    summary: 'test',
    relevanceScore: 70,
    confidence: 60,
    explanation: 'test explanation',
    breakdown: [],
    sourceType: 'signal_effectiveness',
    limitations: [],
    ...overrides,
  };
}

// ─── computeSignalQualityOverlay ─────────────────────────────────────────────

describe('computeSignalQualityOverlay', () => {
  describe('RESEARCH_CONFIDENT cases', () => {
    it('returns RESEARCH_CONFIDENT for STRONG_SIGNAL with high stability and good sample', () => {
      const result = computeSignalQualityOverlay(makeSignalInput());
      expect(result.qualityLabel).toBe('RESEARCH_CONFIDENT');
      expect(result.scoreAdjustment).toBeGreaterThan(0);
      expect(result.confidenceAdjustment).toBeGreaterThan(0);
    });

    it('sets walkForward=STABLE for stabilityScore >= 0.7', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ stabilityScore: 0.75 }));
      expect(result.sections.walkForward).toBe('STABLE');
    });

    it('sets regimeStability=REGIME_STABLE when all regimes have positive avgReturn', () => {
      const result = computeSignalQualityOverlay(makeSignalInput());
      expect(result.sections.regimeStability).toBe('REGIME_STABLE');
    });

    it('sets confidenceReadiness=CALIBRATED for sampleSize >= 30', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 35 }));
      expect(result.sections.confidenceReadiness).toBe('CALIBRATED');
    });

    it('sets disagreement=LOW for STRONG_SIGNAL + STABLE walk-forward', () => {
      const result = computeSignalQualityOverlay(makeSignalInput());
      expect(result.sections.disagreement).toBe('LOW');
    });
  });

  describe('RESEARCH_CAUTION cases', () => {
    it('returns RESEARCH_CAUTION for PARTIAL sample with MIXED stability', () => {
      const result = computeSignalQualityOverlay(
        makeSignalInput({ stabilityScore: 0.55, sampleSize: 15, classification: 'CONDITIONAL_SIGNAL' }),
      );
      expect(result.qualityLabel).toBe('RESEARCH_CAUTION');
      expect(result.scoreAdjustment).toBeLessThan(0);
    });

    it('sets walkForward=MIXED for stabilityScore 0.4–0.7', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ stabilityScore: 0.5 }));
      expect(result.sections.walkForward).toBe('MIXED');
    });

    it('sets confidenceReadiness=PARTIAL for sampleSize 10–29', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 20 }));
      expect(result.sections.confidenceReadiness).toBe('PARTIAL');
    });

    it('sets regimeStability=REGIME_CONDITIONAL for mixed avgReturn across regimes', () => {
      const result = computeSignalQualityOverlay(
        makeSignalInput({
          regimeBreakdown: {
            bull: { sampleSize: 10, avgReturn: 0.02, hitRate: 0.6 },
            bear: { sampleSize: 8, avgReturn: -0.01, hitRate: 0.4 },
          },
        }),
      );
      expect(result.sections.regimeStability).toBe('REGIME_CONDITIONAL');
    });
  });

  describe('RESEARCH_WEAK cases', () => {
    it('returns RESEARCH_WEAK for UNSTABLE walk-forward with sufficient sample and stable regime', () => {
      // UNSTABLE(-2) + REGIME_STABLE(+1) + CALIBRATED(+1) + HIGH disagreement(-2) = -2 → RESEARCH_WEAK
      const result = computeSignalQualityOverlay(
        makeSignalInput({ stabilityScore: 0.2, sampleSize: 30, classification: 'WEAK_SIGNAL' }),
      );
      expect(result.qualityLabel).toBe('RESEARCH_WEAK');
    });

    it('sets walkForward=UNSTABLE for stabilityScore < 0.4', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ stabilityScore: 0.3 }));
      expect(result.sections.walkForward).toBe('UNSTABLE');
    });

    it('sets regimeStability=REGIME_FRAGILE when all regimes have negative avgReturn', () => {
      const result = computeSignalQualityOverlay(
        makeSignalInput({
          regimeBreakdown: {
            bull: { sampleSize: 5, avgReturn: -0.01, hitRate: 0.4 },
            bear: { sampleSize: 5, avgReturn: -0.02, hitRate: 0.3 },
          },
        }),
      );
      expect(result.sections.regimeStability).toBe('REGIME_FRAGILE');
    });
  });

  describe('RESEARCH_INSUFFICIENT cases', () => {
    it('returns RESEARCH_INSUFFICIENT for NOISE + UNSTABLE + no regime data + no sample', () => {
      const result = computeSignalQualityOverlay(
        makeSignalInput({
          stabilityScore: 0,
          sampleSize: 0,
          regimeBreakdown: {},
          classification: 'NOISE',
        }),
      );
      expect(result.qualityLabel).toBe('RESEARCH_INSUFFICIENT');
    });

    it('sets walkForward=N/A when sampleSize=0', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 0 }));
      expect(result.sections.walkForward).toBe('N/A');
    });

    it('sets confidenceReadiness=UNCALIBRATED when sampleSize=0', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 0 }));
      expect(result.sections.confidenceReadiness).toBe('UNCALIBRATED');
    });

    it('sets confidenceReadiness=INSUFFICIENT_DATA when 0 < sampleSize < 10', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 5 }));
      expect(result.sections.confidenceReadiness).toBe('INSUFFICIENT_DATA');
    });

    it('sets regimeStability=N/A when no regime data provided', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ regimeBreakdown: {} }));
      expect(result.sections.regimeStability).toBe('N/A');
    });

    it('sets disagreement=HIGH for NOISE classification', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ classification: 'NOISE' }));
      expect(result.sections.disagreement).toBe('HIGH');
    });
  });

  describe('reasons', () => {
    it('includes walkForward reason text', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ stabilityScore: 0.85, sampleSize: 30 }));
      expect(result.reasons.some((reason) => reason.includes('STABLE'))).toBe(true);
    });

    it('includes regimeStability reason text', () => {
      const result = computeSignalQualityOverlay(makeSignalInput());
      expect(result.reasons.some((reason) => reason.includes('REGIME_STABLE'))).toBe(true);
    });

    it('includes confidenceReadiness reason text', () => {
      const result = computeSignalQualityOverlay(makeSignalInput({ sampleSize: 30 }));
      expect(result.reasons.some((reason) => reason.includes('CALIBRATED'))).toBe(true);
    });

    it('sets eventSourceQuality=N/A for signal overlays', () => {
      const result = computeSignalQualityOverlay(makeSignalInput());
      expect(result.sections.eventSourceQuality).toBe('N/A');
    });
  });
});

// ─── computeEventQualityOverlay ───────────────────────────────────────────────

describe('computeEventQualityOverlay', () => {
  it('returns RESEARCH_CONFIDENT for LIVE_CONFIDENT source', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('LIVE_CONFIDENT'));
    expect(result.qualityLabel).toBe('RESEARCH_CONFIDENT');
    expect(result.sections.eventSourceQuality).toBe('LIVE_CONFIDENT');
  });

  it('returns RESEARCH_CAUTION for MIXED_SOURCE', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('MIXED_SOURCE'));
    expect(result.qualityLabel).toBe('RESEARCH_CAUTION');
    expect(result.sections.eventSourceQuality).toBe('MIXED_SOURCE');
  });

  it('returns RESEARCH_WEAK for SIMULATION_DOMINATED', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('SIMULATION_DOMINATED'));
    expect(result.qualityLabel).toBe('RESEARCH_WEAK');
    expect(result.sections.eventSourceQuality).toBe('SIMULATION_DOMINATED');
  });

  it('returns RESEARCH_INSUFFICIENT for INSUFFICIENT_EVENT_DATA', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('INSUFFICIENT_EVENT_DATA'));
    expect(result.qualityLabel).toBe('RESEARCH_INSUFFICIENT');
    expect(result.sections.eventSourceQuality).toBe('INSUFFICIENT_EVENT_DATA');
  });

  it('returns RESEARCH_INSUFFICIENT when sourceQuality is undefined', () => {
    const result = computeEventQualityOverlay(undefined);
    expect(result.qualityLabel).toBe('RESEARCH_INSUFFICIENT');
  });

  it('uses zero score/confidence adjustments (Wave 5 already applied)', () => {
    for (const label of ['LIVE_CONFIDENT', 'MIXED_SOURCE', 'SIMULATION_DOMINATED', 'INSUFFICIENT_EVENT_DATA'] as const) {
      const result = computeEventQualityOverlay(makeEventSourceQuality(label));
      expect(result.scoreAdjustment).toBe(0);
      expect(result.confidenceAdjustment).toBe(0);
    }
  });

  it('sets all signal sections to N/A', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('LIVE_CONFIDENT'));
    expect(result.sections.walkForward).toBe('N/A');
    expect(result.sections.regimeStability).toBe('N/A');
    expect(result.sections.confidenceReadiness).toBe('N/A');
    expect(result.sections.disagreement).toBe('N/A');
  });

  it('includes event source quality in reasons', () => {
    const result = computeEventQualityOverlay(makeEventSourceQuality('SIMULATION_DOMINATED'));
    expect(result.reasons.some((reason) => reason.includes('SIMULATION_DOMINATED'))).toBe(true);
  });
});

// ─── computeGenericQualityOverlay ─────────────────────────────────────────────

describe('computeGenericQualityOverlay', () => {
  it('returns RESEARCH_CONFIDENT for full coverage + high trust + few limitations', () => {
    const result = computeGenericQualityOverlay({ coverage: 'full', trust: 'high', limitationsCount: 1 });
    expect(result.qualityLabel).toBe('RESEARCH_CONFIDENT');
  });

  it('returns RESEARCH_CAUTION for limited coverage', () => {
    const result = computeGenericQualityOverlay({ coverage: 'limited', trust: 'medium', limitationsCount: 1 });
    expect(result.qualityLabel).toBe('RESEARCH_CAUTION');
  });

  it('returns RESEARCH_WEAK for insufficient coverage', () => {
    const result = computeGenericQualityOverlay({ coverage: 'insufficient', trust: 'medium', limitationsCount: 2 });
    expect(result.qualityLabel).toBe('RESEARCH_WEAK');
  });

  it('returns RESEARCH_WEAK for low trust', () => {
    const result = computeGenericQualityOverlay({ coverage: 'full', trust: 'low', limitationsCount: 1 });
    expect(result.qualityLabel).toBe('RESEARCH_WEAK');
  });

  it('bumps down RESEARCH_CONFIDENT to RESEARCH_CAUTION when limitationsCount >= 4', () => {
    const result = computeGenericQualityOverlay({ coverage: 'full', trust: 'high', limitationsCount: 5 });
    expect(result.qualityLabel).toBe('RESEARCH_CAUTION');
  });

  it('bumps down RESEARCH_CAUTION to RESEARCH_WEAK when limitationsCount >= 4', () => {
    const result = computeGenericQualityOverlay({ coverage: 'limited', trust: 'medium', limitationsCount: 4 });
    expect(result.qualityLabel).toBe('RESEARCH_WEAK');
  });

  it('bumps down RESEARCH_WEAK to RESEARCH_INSUFFICIENT when limitationsCount >= 4', () => {
    const result = computeGenericQualityOverlay({ coverage: 'insufficient', trust: 'low', limitationsCount: 5 });
    expect(result.qualityLabel).toBe('RESEARCH_INSUFFICIENT');
  });
});

// ─── applyQualityOverlay ──────────────────────────────────────────────────────

describe('applyQualityOverlay', () => {
  it('applies positive score and confidence adjustments', () => {
    const insight = makeInsight({ relevanceScore: 70, confidence: 60 });
    const overlay = computeSignalQualityOverlay(makeSignalInput()); // RESEARCH_CONFIDENT → +3, +5
    const result = applyQualityOverlay(insight, overlay);
    expect(result.relevanceScore).toBe(73);
    expect(result.confidence).toBe(65);
  });

  it('applies negative score and confidence adjustments', () => {
    const insight = makeInsight({ relevanceScore: 70, confidence: 60 });
    const overlay = computeSignalQualityOverlay(
      makeSignalInput({ stabilityScore: 0.1, sampleSize: 0, regimeBreakdown: {}, classification: 'NOISE' }),
    ); // RESEARCH_INSUFFICIENT → -20, -20
    const result = applyQualityOverlay(insight, overlay);
    expect(result.relevanceScore).toBe(50);
    expect(result.confidence).toBe(40);
  });

  it('clamps relevanceScore to minimum 0', () => {
    const insight = makeInsight({ relevanceScore: 5, confidence: 60 });
    const overlay = computeSignalQualityOverlay(
      makeSignalInput({ stabilityScore: 0.1, sampleSize: 0, regimeBreakdown: {}, classification: 'NOISE' }),
    ); // -20 score adjustment
    const result = applyQualityOverlay(insight, overlay);
    expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps confidence to minimum 10', () => {
    const insight = makeInsight({ relevanceScore: 70, confidence: 15 });
    const overlay = computeSignalQualityOverlay(
      makeSignalInput({ stabilityScore: 0.1, sampleSize: 0, regimeBreakdown: {}, classification: 'NOISE' }),
    ); // -20 confidence adjustment
    const result = applyQualityOverlay(insight, overlay);
    expect(result.confidence).toBeGreaterThanOrEqual(10);
  });

  it('clamps relevanceScore to maximum 100', () => {
    const insight = makeInsight({ relevanceScore: 99, confidence: 95 });
    const overlay = computeSignalQualityOverlay(makeSignalInput()); // +3 score adjustment
    const result = applyQualityOverlay(insight, overlay);
    expect(result.relevanceScore).toBeLessThanOrEqual(100);
  });

  it('attaches the overlay to the returned insight', () => {
    const insight = makeInsight();
    const overlay = computeSignalQualityOverlay(makeSignalInput());
    const result = applyQualityOverlay(insight, overlay);
    expect(result.qualityOverlay).toBe(overlay);
  });

  it('does not mutate the original insight', () => {
    const insight = makeInsight({ relevanceScore: 70 });
    const overlay = computeSignalQualityOverlay(makeSignalInput());
    applyQualityOverlay(insight, overlay);
    expect(insight.relevanceScore).toBe(70);
    expect(insight.qualityOverlay).toBeUndefined();
  });

  it('event overlay applies zero score/confidence adjustment', () => {
    const insight = makeInsight({ relevanceScore: 55, confidence: 45 });
    const overlay = computeEventQualityOverlay(makeEventSourceQuality('SIMULATION_DOMINATED'));
    const result = applyQualityOverlay(insight, overlay);
    expect(result.relevanceScore).toBe(55);
    expect(result.confidence).toBe(45);
  });
});
