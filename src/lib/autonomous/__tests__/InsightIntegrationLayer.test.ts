/**
 * InsightIntegrationLayer — unit tests
 *
 * Tests cover:
 *   1. extractInsightsFromTaskOutput — score_bias signal
 *   2. extractInsightsFromTaskOutput — data_quality_issue signal
 *   3. extractInsightsFromTaskOutput — unknown taskId → []
 *   4. computeTriggerScoreInsightMultiplier — cap at 20%
 *   5. computeTriggerScoreInsightMultiplier — low confidence → no penalty
 *   6. applyInsightRankingPenalty — setup_imbalance reduces dominant setup
 *   7. loadActiveInsights — maps DB row to OptimizationInsightRecord
 */

jest.mock('../../prisma', () => ({
  prisma: {
    optimizationInsightRecord: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import {
  extractInsightsFromTaskOutput,
  computeTriggerScoreInsightMultiplier,
  computeTieredScoreMultiplier,
  applyInsightRankingPenalty,
  applyStrongInsightRankingPenalty,
  formatInsightsAsLimitations,
  loadActiveInsights,
  type OptimizationInsightRecord,
} from '../InsightIntegrationLayer';
import type { TieredFilteredInsights } from '../InsightGuardrailLayer';
import { prisma } from '../../prisma';

const mockPrisma = prisma as unknown as {
  optimizationInsightRecord: {
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
};

// ─── 1. score_bias extraction ────────────────────────────────────────────────

describe('extractInsightsFromTaskOutput', () => {
  it('creates a score_bias insight when scoreRange is narrow and sampleSize meets threshold', () => {
    const report = {
      scoreRange: 0.08,            // < 0.25 → fires
      dominantSetupType: 'trend',
      dominantPct: 0.72,
      sampleSize: 30,              // ≥ 10 → fires; confidence = min(1, 30/50) = 0.6
    };

    const insights = extractInsightsFromTaskOutput(
      'price_analysis_quality__trigger_score_distribution',
      report,
    );

    expect(insights).toHaveLength(1);
    const ins = insights[0];
    expect(ins.insightType).toBe('score_bias');
    expect(ins.severity).toBe('high');                    // < 0.10
    expect(ins.confidence).toBeCloseTo(0.6);
    expect(ins.affectedSetupTypes).toEqual(['trend']);
    expect(ins.evidence[0]).toContain('Score range');
    expect(new Date(ins.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns [] when sampleSize < 10 (not enough data)', () => {
    const insights = extractInsightsFromTaskOutput(
      'price_analysis_quality__trigger_score_distribution',
      { scoreRange: 0.05, dominantPct: 0.90, sampleSize: 5 },
    );
    expect(insights).toHaveLength(0);
  });

  it('returns [] when scoreRange and dominantPct do not breach thresholds', () => {
    const insights = extractInsightsFromTaskOutput(
      'price_analysis_quality__trigger_score_distribution',
      { scoreRange: 0.30, dominantPct: 0.50, sampleSize: 25 },
    );
    expect(insights).toHaveLength(0);
  });

  // ─── 2. data_quality_issue ────────────────────────────────────────────────

  it('creates a data_quality_issue insight when staleQuoteAge is very high', () => {
    const report = {
      staleQuoteAge: 131,           // > 120 → severity=high; confidence=min(1,131/120)=1
      zeroVolumeCount: 0,
      symbolCount: 3,
      stalestSymbol: 'AAPL',
    };

    const insights = extractInsightsFromTaskOutput(
      'price_analysis_quality__data_audit',
      report,
    );

    expect(insights).toHaveLength(1);
    const ins = insights[0];
    expect(ins.insightType).toBe('data_quality_issue');
    expect(ins.severity).toBe('high');
    expect(ins.confidence).toBe(1);
    expect(ins.affectedSymbols).toContain('AAPL');
  });

  it('returns [] when data is within acceptable staleness bounds', () => {
    const insights = extractInsightsFromTaskOutput(
      'price_analysis_quality__data_audit',
      { staleQuoteAge: 24, zeroVolumeCount: 0 },
    );
    expect(insights).toHaveLength(0);
  });

  // ─── 3. unknown taskId ────────────────────────────────────────────────────

  it('returns [] for unknown taskId', () => {
    const insights = extractInsightsFromTaskOutput('completely_unknown_task_key', {
      someField: 123,
    });
    expect(insights).toHaveLength(0);
  });
});

// ─── 4 & 5. computeTriggerScoreInsightMultiplier ─────────────────────────────

describe('computeTriggerScoreInsightMultiplier', () => {
  const FUTURE_ISO = new Date(Date.now() + 86400000 * 10).toISOString();

  function makeInsight(
    overrides: Partial<OptimizationInsightRecord>,
  ): OptimizationInsightRecord {
    return {
      insightType: 'score_bias',
      sourceTaskId: 'task1',
      evidence: ['some evidence'],
      confidence: 0.9,
      severity: 'high',
      affectedSetupTypes: [],
      affectedSymbols: [],
      expiresAt: FUTURE_ISO,
      ...overrides,
    };
  }

  it('caps total penalty at 25% when many high-confidence insights are present', () => {
    const insights: OptimizationInsightRecord[] = [
      makeInsight({ insightType: 'data_quality_issue', confidence: 1.0 }),   // 0.15
      makeInsight({ insightType: 'score_bias', confidence: 1.0 }),           // 0.10
      makeInsight({ insightType: 'time_exit_dominance', confidence: 1.0 }),  // 0.05
      makeInsight({ insightType: 'sector_misalignment', confidence: 1.0 }),  // 0.07
    ];
    // raw = 0.37 → capped to 0.25 → multiplier = 0.75
    const { multiplier, appliedInsights } = computeTriggerScoreInsightMultiplier(
      'TSLA',
      'trend',
      insights,
    );
    expect(multiplier).toBeCloseTo(0.75, 5);
    expect(multiplier).toBeGreaterThanOrEqual(0.75);
    expect(appliedInsights.length).toBeGreaterThan(0);
  });

  it('returns multiplier = 1.0 when all insights have confidence below threshold', () => {
    const insights: OptimizationInsightRecord[] = [
      makeInsight({ insightType: 'score_bias', confidence: 0.3 }),      // below 0.6
      makeInsight({ insightType: 'data_quality_issue', confidence: 0.5 }), // below 0.6
    ];
    const { multiplier, appliedInsights } = computeTriggerScoreInsightMultiplier(
      'AAPL',
      'trend',
      insights,
    );
    expect(multiplier).toBe(1.0);
    expect(appliedInsights).toHaveLength(0);
  });

  it('returns { multiplier: 1.0, appliedInsights: [] } when insights list is empty', () => {
    const { multiplier, appliedInsights } = computeTriggerScoreInsightMultiplier(
      'MSFT',
      'rebound',
      [],
    );
    expect(multiplier).toBe(1.0);
    expect(appliedInsights).toHaveLength(0);
  });

  it('only applies indicator_insufficient penalty when symbol is affected', () => {
    const insights: OptimizationInsightRecord[] = [
      makeInsight({
        insightType: 'indicator_insufficient',
        confidence: 1.0,
        affectedSymbols: ['NVDA'],  // not AAPL
      }),
    ];
    const { multiplier } = computeTriggerScoreInsightMultiplier('AAPL', 'trend', insights);
    expect(multiplier).toBe(1.0);

    const { multiplier: penalized } = computeTriggerScoreInsightMultiplier('NVDA', 'trend', insights);
    expect(penalized).toBeCloseTo(0.88, 2);  // 1 - 0.12×1.0
  });

  it('only applies setup_imbalance penalty for the matching setupType', () => {
    const insights: OptimizationInsightRecord[] = [
      makeInsight({
        insightType: 'setup_imbalance',
        confidence: 1.0,
        affectedSetupTypes: ['trend'],
      }),
    ];
    const { multiplier: reboundMul } = computeTriggerScoreInsightMultiplier('X', 'rebound', insights);
    expect(reboundMul).toBe(1.0);

    const { multiplier: trendMul } = computeTriggerScoreInsightMultiplier('X', 'trend', insights);
    expect(trendMul).toBeCloseTo(0.92, 2);  // 1 - 0.08×1.0
  });
});

// ─── 6. applyInsightRankingPenalty ───────────────────────────────────────────

describe('applyInsightRankingPenalty', () => {
  const FUTURE_ISO = new Date(Date.now() + 86400000 * 10).toISOString();

  const candidates = [
    { symbol: 'A', setupType: 'trend',   alphaScore: 0.80, conviction: 'high' as const },
    { symbol: 'B', setupType: 'rebound', alphaScore: 0.75, conviction: 'mid' as const },
  ];

  const setupImbalanceInsight: OptimizationInsightRecord = {
    insightType: 'setup_imbalance',
    sourceTaskId: 'task1',
    evidence: ['trend is 95% of proposals'],
    confidence: 1.0,
    severity: 'high',
    affectedSetupTypes: ['trend'],
    affectedSymbols: [],
    expiresAt: FUTURE_ISO,
  };

  it('reduces alphaScore of trend candidate while leaving rebound unchanged', () => {
    const result = applyInsightRankingPenalty(candidates, [setupImbalanceInsight]);

    const trend = result.find((c) => c.setupType === 'trend')!;
    const rebound = result.find((c) => c.setupType === 'rebound')!;

    // trend gets 0.15×1.0 = 0.15 penalty → alphaScore × 0.85 = 0.68
    expect(trend.alphaScore).toBeCloseTo(0.68, 5);
    // rebound: no matching setup → unchanged
    expect(rebound.alphaScore).toBe(0.75);
    // insightPenaltyNote should be set on trend only
    expect(trend.insightPenaltyNote).toContain('setup_imbalance');
    expect(rebound.insightPenaltyNote).toBeUndefined();
  });

  it('does not mutate the original candidates array', () => {
    const original = candidates.map((c) => ({ ...c }));
    applyInsightRankingPenalty(candidates, [setupImbalanceInsight]);
    expect(candidates[0].alphaScore).toBe(original[0].alphaScore);
    expect(candidates[1].alphaScore).toBe(original[1].alphaScore);
  });

  it('returns candidates unchanged when insights list is empty', () => {
    const result = applyInsightRankingPenalty(candidates, []);
    expect(result[0].alphaScore).toBe(candidates[0].alphaScore);
    expect(result[1].alphaScore).toBe(candidates[1].alphaScore);
  });
});

// ─── 7. loadActiveInsights ────────────────────────────────────────────────────

describe('loadActiveInsights', () => {
  beforeEach(() => {
    mockPrisma.optimizationInsightRecord.findMany.mockReset();
    mockPrisma.optimizationInsightRecord.upsert.mockReset();
  });

  it('maps a DB row to OptimizationInsightRecord correctly', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5);
    const nowDate = new Date();
    mockPrisma.optimizationInsightRecord.findMany.mockResolvedValue([
      {
        id: 1,
        insightType: 'score_bias',
        sourceTaskId: 'price_analysis_quality__trigger_score_distribution',
        evidence: JSON.stringify(['Score range: 0.05']),
        confidence: 0.8,
        severity: 'high',
        affectedScope: JSON.stringify({ setupTypes: ['trend'], symbols: [] }),
        expiresAt: futureDate,
        createdAt: nowDate,
        updatedAt: nowDate,
      },
    ]);

    const results = await loadActiveInsights();
    expect(results).toHaveLength(1);
    expect(results[0].insightType).toBe('score_bias');
    expect(results[0].confidence).toBe(0.8);
    expect(results[0].affectedSetupTypes).toEqual(['trend']);
    expect(results[0].affectedSymbols).toEqual([]);
    expect(results[0].evidence).toEqual(['Score range: 0.05']);
  });

  it('returns [] when prisma throws (e.g. missing mock in test env)', async () => {
    mockPrisma.optimizationInsightRecord.findMany.mockRejectedValue(new Error('DB error'));
    const results = await loadActiveInsights();
    expect(results).toEqual([]);
  });
});

// ─── formatInsightsAsLimitations ─────────────────────────────────────────────

describe('formatInsightsAsLimitations', () => {
  const FUTURE_ISO = new Date(Date.now() + 86400000 * 10).toISOString();

  it('formats high-confidence insights as readable limitation strings', () => {
    const insights: OptimizationInsightRecord[] = [
      {
        insightType: 'score_bias',
        sourceTaskId: 'task1',
        evidence: ['Score range: 0.05 (threshold < 0.25)'],
        confidence: 0.8,
        severity: 'high',
        affectedSetupTypes: ['trend'],
        affectedSymbols: [],
        expiresAt: FUTURE_ISO,
      },
    ];

    const limitations = formatInsightsAsLimitations(insights);
    expect(limitations).toHaveLength(1);
    expect(limitations[0]).toContain('[OptimizationInsight:score_bias]');
    expect(limitations[0]).toContain('conf=0.80');
    expect(limitations[0]).toContain('severity=high');
  });

  it('filters out insights with confidence below threshold (< 0.6)', () => {
    const insights: OptimizationInsightRecord[] = [
      {
        insightType: 'score_bias',
        sourceTaskId: 'task1',
        evidence: ['some evidence'],
        confidence: 0.4,  // below threshold
        severity: 'low',
        affectedSetupTypes: [],
        affectedSymbols: [],
        expiresAt: FUTURE_ISO,
      },
    ];

    const limitations = formatInsightsAsLimitations(insights);
    expect(limitations).toHaveLength(0);
  });
});

// ─── computeTieredScoreMultiplier ───────────────────────────────────────────────

describe('computeTieredScoreMultiplier', () => {
  const FUTURE_ISO = new Date(Date.now() + 86400000 * 10).toISOString();

  function makeTierInsight(
    overrides: Partial<OptimizationInsightRecord> = {},
  ): OptimizationInsightRecord {
    return {
      insightType: 'score_bias',
      sourceTaskId: 'task1',
      evidence: ['Score range: 0.05', 'Sample size: 30'],
      confidence: 0.9,
      severity: 'high',
      affectedSetupTypes: [],
      affectedSymbols: [],
      expiresAt: FUTURE_ISO,
      ...overrides,
    };
  }

  function makeTiers(overrides: Partial<TieredFilteredInsights> = {}): TieredFilteredInsights {
    return { soft: [], strong: [], critical: [], ...overrides };
  }

  it('returns multiplier=1.0 and effectiveCap=0.25 when all tiers empty', () => {
    const { multiplier, effectiveCap } = computeTieredScoreMultiplier('AAPL', 'trend', makeTiers());
    expect(multiplier).toBe(1.0);
    expect(effectiveCap).toBeCloseTo(0.25, 5);
  });

  it('uses 25% cap for soft-only insights', () => {
    // data_quality_issue at 1.0 conf = 0.15 penalty (< 0.25 cap)
    const tiers = makeTiers({
      soft: [{ ...makeTierInsight({ insightType: 'data_quality_issue', confidence: 1.0, evidence: ['Stale: 72h'] }), decayedConfidence: 1.0 }],
    });
    const { multiplier, effectiveCap } = computeTieredScoreMultiplier('AAPL', 'trend', tiers);
    expect(effectiveCap).toBeCloseTo(0.25, 5);
    expect(multiplier).toBeCloseTo(0.85, 5);  // 1 - 0.15×1.0
  });

  it('uses 60% cap and 2× boost for strong-tier insights', () => {
    // score_bias at conf=1.0 with 2× boost = 0.10×2.0 = 0.20 penalty
    const tiers = makeTiers({
      strong: [{ ...makeTierInsight({ insightType: 'score_bias', confidence: 1.0 }), decayedConfidence: 1.0 }],
    });
    const { multiplier, effectiveCap, appliedInsights } = computeTieredScoreMultiplier('AAPL', 'trend', tiers);
    expect(effectiveCap).toBeCloseTo(0.60, 5);
    expect(multiplier).toBeCloseTo(0.80, 5);  // 1 - 0.10×2.0×1.0 = 0.80
    expect(appliedInsights[0]).toContain('strong:score_bias');
    expect(appliedInsights[0]).toContain('×2');
  });

  it('soft + strong tiers combine with 60% cap', () => {
    // soft: score_bias 0.10×1×0.7 = 0.07
    // strong: sector_misalignment 0.07×2×0.9 = 0.126
    // total = 0.196 < 0.60 cap
    const tiers = makeTiers({
      soft: [{ ...makeTierInsight({ insightType: 'score_bias' }), decayedConfidence: 0.70 }],
      strong: [{ ...makeTierInsight({ insightType: 'sector_misalignment', evidence: ['e1', 'e2'] }), decayedConfidence: 0.90 }],
    });
    const { multiplier, effectiveCap } = computeTieredScoreMultiplier('AAPL', 'trend', tiers);
    expect(effectiveCap).toBeCloseTo(0.60, 5);  // has strong
    expect(multiplier).toBeCloseTo(1.0 - (0.10 * 1.0 * 0.70 + 0.07 * 2.0 * 0.90), 4);
  });

  it('caps at STRONG_PENALTY_CAP (0.60) when combined penalty exceeds it', () => {
    // Many high-conf strong insights → raw penalty >> 0.60
    const strong = [
      { ...makeTierInsight({ insightType: 'data_quality_issue', evidence: ['e'] }), decayedConfidence: 1.0 },
      { ...makeTierInsight({ insightType: 'score_bias' }), decayedConfidence: 1.0 },
      { ...makeTierInsight({ insightType: 'time_exit_dominance', evidence: ['60% exits', '30 trades'] }), decayedConfidence: 1.0 },
      { ...makeTierInsight({ insightType: 'sector_misalignment', evidence: ['8/10', '80% rate'] }), decayedConfidence: 1.0 },
    ];
    const { multiplier, effectiveCap } = computeTieredScoreMultiplier('AAPL', 'trend', makeTiers({ strong }));
    // raw = (0.15+0.10+0.05+0.07) × 2 = 0.74 > 0.60 → capped
    expect(effectiveCap).toBeCloseTo(0.60, 5);
    expect(multiplier).toBeCloseTo(0.40, 5);
  });

  it('only penalizes setup_imbalance when setupType matches', () => {
    const tiers = makeTiers({
      strong: [{
        ...makeTierInsight({ insightType: 'setup_imbalance', affectedSetupTypes: ['trend'] }),
        decayedConfidence: 1.0,
      }],
    });
    const { multiplier: trendMul } = computeTieredScoreMultiplier('AAPL', 'trend', tiers);
    const { multiplier: reboundMul } = computeTieredScoreMultiplier('AAPL', 'rebound', tiers);
    // trend: 0.08 × 2.0 × 1.0 = 0.16 penalty
    expect(trendMul).toBeCloseTo(0.84, 5);
    // rebound: setup doesn't match → no penalty
    expect(reboundMul).toBe(1.0);
  });
});

// ─── applyStrongInsightRankingPenalty ────────────────────────────────────────

describe('applyStrongInsightRankingPenalty', () => {
  const FUTURE_ISO = new Date(Date.now() + 86400000 * 10).toISOString();

  function makeCandidate(setupType: string, alphaScore: number) {
    return { setupType, alphaScore };
  }

  function makeTierInsight(
    overrides: Partial<OptimizationInsightRecord> = {},
  ): OptimizationInsightRecord {
    return {
      insightType: 'score_bias',
      sourceTaskId: 'task1',
      evidence: ['Score range: 0.05', 'n=30'],
      confidence: 0.9,
      severity: 'high',
      affectedSetupTypes: [],
      affectedSymbols: [],
      expiresAt: FUTURE_ISO,
      ...overrides,
    };
  }

  it('returns candidates unchanged when all tiers empty', () => {
    const candidates = [makeCandidate('trend', 0.8), makeCandidate('rebound', 0.6)];
    const result = applyStrongInsightRankingPenalty(candidates, { soft: [], strong: [], critical: [] });
    expect(result[0].alphaScore).toBe(0.8);
    expect(result[1].alphaScore).toBe(0.6);
  });

  it('applies 2× boost to strong-tier setup_imbalance penalty', () => {
    // strong setup_imbalance at conf=1.0: 0.15 × 2.0 × 1.0 = 0.30 penalty
    const tiers = {
      soft: [],
      strong: [{ ...makeTierInsight({ insightType: 'setup_imbalance', affectedSetupTypes: ['trend'] }), decayedConfidence: 1.0 }],
      critical: [],
    };
    const candidates = [makeCandidate('trend', 1.0)];
    const [result] = applyStrongInsightRankingPenalty(candidates, tiers);
    expect(result.alphaScore).toBeCloseTo(1.0 * (1.0 - 0.30), 4);  // 0.70
    expect(result.insightPenaltyNote).toContain('setup_imbalance(strong)');
  });

  it('does not penalize setup_imbalance for non-matching setupType', () => {
    const tiers = {
      soft: [],
      strong: [{ ...makeTierInsight({ insightType: 'setup_imbalance', affectedSetupTypes: ['trend'] }), decayedConfidence: 1.0 }],
      critical: [],
    };
    const [result] = applyStrongInsightRankingPenalty([makeCandidate('rebound', 0.8)], tiers);
    expect(result.alphaScore).toBe(0.8);
    expect(result.insightPenaltyNote).toBeUndefined();
  });

  it('applies soft-tier 1× boost for soft setup_imbalance', () => {
    // soft setup_imbalance at conf=0.7: 0.15 × 1.0 × 0.7 = 0.105 penalty
    const tiers = {
      soft: [{ ...makeTierInsight({ insightType: 'setup_imbalance', affectedSetupTypes: ['trend'] }), decayedConfidence: 0.70 }],
      strong: [],
      critical: [],
    };
    const [result] = applyStrongInsightRankingPenalty([makeCandidate('trend', 1.0)], tiers);
    expect(result.alphaScore).toBeCloseTo(1.0 * (1.0 - 0.105), 4);
    expect(result.insightPenaltyNote).toContain('setup_imbalance(soft)');
  });
});
