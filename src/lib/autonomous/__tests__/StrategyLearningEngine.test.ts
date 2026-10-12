/**
 * StrategyLearningEngine — P0-2 fix validation
 * Ensures shadow trade down-weighting and learning protection.
 */

jest.mock('../../prisma', () => ({
  prisma: {
    tradeReviewReport: {
      findMany: jest.fn(),
    },
    simulatedTrade: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    strategyLearningInsight: {
      upsert: jest.fn(),
    },
    optimizationInsightRecord: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

import { buildStrategyLearningInsight } from '../StrategyLearningEngine';
import { prisma } from '../../prisma';

const mockFindMany = prisma.tradeReviewReport.findMany as jest.Mock;

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    generatedAt: '2026-04-01T00:00:00Z',
    triggerType: '-5',
    preTrade: JSON.stringify({
      setupType: 'rebound',
      marketState: 'defensive',
      tradeMode: 'shadow',
      ...overrides,
    }),
    result: JSON.stringify({
      return: -3.8,
      holdingTime: 5,
      exitReason: 'stop',
    }),
    analysis: '{}',
    issues: '{}',
    recommendations: '{}',
  };
}

describe('StrategyLearningEngine — P0-2 Fixes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('down-weights shadow trade reviews at 0.3x', async () => {
    // 5 shadow trades with negative outcomes
    mockFindMany.mockResolvedValue([
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    // 5 shadow reviews × 0.3 weight = 1.5 → rounds to 2
    // Should NOT reach the threshold of 3 needed for penalization
    const reboundFailure = insight!.failurePatterns.find((p) => p.startsWith('rebound'));
    if (reboundFailure) {
      const match = reboundFailure.match(/(\d+)/);
      const count = match ? Number(match[1]) : 0;
      // 5 × 0.3 = 1.5 → rounded to 2, NOT 5
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('full trade reviews counted at 1.0x weight', async () => {
    mockFindMany.mockResolvedValue([
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'full' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    const reboundFailure = insight!.failurePatterns.find((p) => p.startsWith('rebound'));
    expect(reboundFailure).toBeDefined();
    // 3 × 1.0 = 3 → rounds to 3
    expect(reboundFailure).toContain('3');
  });

  it('adds limitation when no full trades exist', async () => {
    mockFindMany.mockResolvedValue([
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();
    expect(insight!.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('full trade 樣本不足'),
      ]),
    );
  });

  it('summary includes shadow vs full breakdown', async () => {
    mockFindMany.mockResolvedValue([
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'full' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();
    expect(insight!.summary).toContain('full=2');
    expect(insight!.summary).toContain('shadow=1');
  });

  it('returns null when no reviews exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const insight = await buildStrategyLearningInsight();
    expect(insight).toBeNull();
  });

  it('mixed shadow + full computes weighted counts correctly', async () => {
    mockFindMany.mockResolvedValue([
      // 3 full failures + 5 shadow failures
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'full' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
      makeReview({ tradeMode: 'shadow' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    // Weight = 3×1.0 + 5×0.3 ≈ 4.5 (floating point: 4.4999...)
    const reboundFailure = insight!.failurePatterns.find((p) => p.startsWith('rebound'));
    expect(reboundFailure).toBeDefined();
    const match = reboundFailure!.match(/(\d+)/);
    // Floating point: 0.3*5 = 1.4999...8 + 3 = 4.4999...8 → Math.round → 4
    expect(Number(match![1])).toBe(4);
  });

  it('promoted trades weighted at 0.7x and count toward fullTradeCount', async () => {
    mockFindMany.mockResolvedValue([
      makeReview({ tradeMode: 'pending', promotionSource: 'shadow_track_record' }),
      makeReview({ tradeMode: 'pending', promotionSource: 'shadow_track_record' }),
      makeReview({ tradeMode: 'pending', promotionSource: 'shadow_track_record' }),
      makeReview({ tradeMode: 'pending', promotionSource: 'shadow_track_record' }),
      makeReview({ tradeMode: 'pending', promotionSource: 'shadow_track_record' }),
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    // 5 promoted × 0.7 = 3.5 → Math.round → 4
    const reboundFailure = insight!.failurePatterns.find((p) => p.startsWith('rebound'));
    expect(reboundFailure).toBeDefined();
    const match = reboundFailure!.match(/(\d+)/);
    expect(Number(match![1])).toBe(4);

    // Promoted trades count toward fullTradeCount → no "full trade 樣本不足" limitation
    expect(insight!.limitations).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('full trade 樣本不足'),
      ]),
    );
  });

  it('[time-exit neutral] time-exit reviews do NOT appear in failurePatterns', async () => {
    // 3 time-exit trades at flat pnl: should be neutral, not failure
    mockFindMany.mockResolvedValue([
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.17, holdingTime: 15, exitReason: 'time' }) },
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.21, holdingTime: 15, exitReason: 'time' }) },
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.16, holdingTime: 15, exitReason: 'time' }) },
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    // Time-exits must NOT appear in failurePatterns
    expect(insight!.failurePatterns).toHaveLength(0);
    // And not in successPatterns either
    expect(insight!.successPatterns).toHaveLength(0);
    // adjustmentSuggestions must be empty (no "raise thresholds" for neutral outcomes)
    expect(insight!.adjustmentSuggestions).toHaveLength(0);
    // fullTradeCount still increments (3 full-mode trades)
    expect(insight!.limitations).toEqual(
      expect.arrayContaining([expect.stringContaining('full trade 樣本不足 5 筆')]),
    );
  });

  it('[time-exit neutral] mixed: 1 stop-hit + 2 time-exits — only stop-hit counts as failure', async () => {
    mockFindMany.mockResolvedValue([
      // real stop hit
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: '-5',
        result: JSON.stringify({ return: -6.14, holdingTime: 3, exitReason: 'stop' }) },
      // two time-exits (neutral)
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.17, holdingTime: 15, exitReason: 'time' }) },
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.16, holdingTime: 15, exitReason: 'time' }) },
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight).not.toBeNull();

    // Only the stop-hit contributes to failurePatterns (weight=1.0)
    expect(insight!.failurePatterns).toHaveLength(1);
    const match = insight!.failurePatterns[0].match(/(\d+)/);
    expect(Number(match![1])).toBe(1);

    expect(insight!.successPatterns).toHaveLength(0);
    // Suggestion should fire for the stop-hit failure
    expect(insight!.adjustmentSuggestions).toEqual(
      expect.arrayContaining([expect.stringContaining('trend')]),
    );
  });

  it('[time-exit neutral] summary includes time-exit neutral count', async () => {
    mockFindMany.mockResolvedValue([
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: 'time',
        result: JSON.stringify({ return: -0.17, holdingTime: 15, exitReason: 'time' }) },
      { ...makeReview({ tradeMode: 'full', setupType: 'trend' }), triggerType: '+5',
        result: JSON.stringify({ return: 8.34, holdingTime: 8, exitReason: 'target' }) },
    ]);

    const insight = await buildStrategyLearningInsight();
    expect(insight!.summary).toContain('time-exit中性=1');
  });
});
