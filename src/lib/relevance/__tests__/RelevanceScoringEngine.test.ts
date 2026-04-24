import { scoreRelevance } from '../RelevanceScoringEngine';
import type { RelevanceScoringInput } from '../types';

function makeInput(overrides: Partial<RelevanceScoringInput> = {}): RelevanceScoringInput {
  return {
    id: 'signal:test',
    type: 'test_signal',
    category: 'signal',
    title: 'test',
    summary: 'test summary',
    sourceType: 'signal_effectiveness',
    directness: 'direct',
    signalContext: {
      classification: 'WEAK_SIGNAL',
      sampleSize: 18,
    },
    recencyDays: 2,
    persistence: 'developing',
    regimeContext: {
      currentRegime: 'Bull',
      relevantRegimes: ['Bull'],
    },
    dataQuality: {
      coverage: 'limited',
      trust: 'medium',
    },
    limitations: [],
    ...overrides,
  };
}

describe('RelevanceScoringEngine', () => {
  it('ranks STRONG_SIGNAL above WEAK_SIGNAL', () => {
    const strong = scoreRelevance(makeInput({
      signalContext: { classification: 'STRONG_SIGNAL', sampleSize: 48 },
      persistence: 'persistent',
      dataQuality: { coverage: 'full', trust: 'high' },
    }));
    const weak = scoreRelevance(makeInput());

    expect(strong.relevanceScore).toBeGreaterThan(weak.relevanceScore);
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
  });

  it('downweights NOISE signals', () => {
    const noise = scoreRelevance(makeInput({
      signalContext: { classification: 'NOISE', sampleSize: 6 },
      dataQuality: { coverage: 'insufficient', trust: 'low' },
      limitations: ['sample too small'],
    }));

    expect(noise.relevanceScore).toBeLessThan(45);
    expect(noise.confidence).toBeLessThan(50);
  });

  it('downweights low-trust topic insights', () => {
    const trustedTopic = scoreRelevance(makeInput({
      id: 'topic:high',
      category: 'topic',
      type: 'topic_surge',
      sourceType: 'topic_surge',
      signalContext: undefined,
      persistence: 'persistent',
      dataQuality: { coverage: 'full', trust: 'high' },
    }));
    const lowTrustTopic = scoreRelevance(makeInput({
      id: 'topic:low',
      category: 'topic',
      type: 'topic_surge',
      sourceType: 'topic_surge',
      signalContext: undefined,
      persistence: 'persistent',
      dataQuality: { coverage: 'limited', trust: 'low' },
      limitations: ['low trust sources'],
    }));

    expect(trustedTopic.relevanceScore).toBeGreaterThan(lowTrustTopic.relevanceScore);
    expect(trustedTopic.confidence).toBeGreaterThan(lowTrustTopic.confidence);
  });

  it('downweights signals that do not match current regime', () => {
    const matched = scoreRelevance(makeInput({
      regimeContext: { currentRegime: 'Bull', relevantRegimes: ['Bull'] },
    }));
    const mismatched = scoreRelevance(makeInput({
      regimeContext: { currentRegime: 'Bear', relevantRegimes: ['Bull'] },
    }));

    expect(matched.relevanceScore).toBeGreaterThan(mismatched.relevanceScore);
    expect(matched.explanation).toContain('Bull');
  });

  it('keeps a degraded score with lower confidence when data is incomplete', () => {
    const degraded = scoreRelevance(makeInput({
      signalContext: undefined,
      recencyDays: null,
      persistence: undefined,
      dataQuality: { coverage: 'insufficient', trust: 'low' },
      limitations: ['missing recency', 'missing persistence'],
    }));

    expect(degraded.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(degraded.confidence).toBeLessThan(45);
    expect(degraded.limitations).toContain('missing recency');
  });

  it('returns explanation breakdown without changing factor ordering logic', () => {
    const scored = scoreRelevance(makeInput({
      signalContext: { classification: 'STRONG_SIGNAL', sampleSize: 52 },
      dataQuality: { coverage: 'full', trust: 'high' },
      persistence: 'continuous',
    }));

    expect(scored.breakdown).toHaveLength(6);
    expect(scored.breakdown.map((factor) => factor.key)).toEqual([
      'directness',
      'signalQuality',
      'recency',
      'persistence',
      'regime',
      'dataQuality',
    ]);
    expect(scored.breakdown.find((factor) => factor.key === 'signalQuality')?.score).toBe(20);
  });
});
