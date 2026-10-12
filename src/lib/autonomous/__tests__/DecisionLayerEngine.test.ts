/**
 * DecisionLayerEngine Learning Feedback — Phase H tests
 */

jest.mock('../../prisma', () => ({
  prisma: {
    stock: {
      findUnique: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  },
}));

import { buildStrategyProposals } from '../DecisionLayerEngine';
import { prisma } from '../../prisma';
import type { AutonomousResearchSnapshot } from '../types';

const mockStockFindUnique = prisma.stock.findUnique as jest.Mock;
const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;

function makeSnapshot(overrides: Partial<AutonomousResearchSnapshot> = {}): AutonomousResearchSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    snapshotDate: '2026-04-15',
    marketState: 'trending',
    marketRegime: 'Bull',
    marketRegimeConfidence: 0.8,
    sectorStrength: [],
    candidateStocks: [
      {
        symbol: '2330',
        name: 'TSMC',
        screenBucket: 'top',
        setupType: 'trend',
        alphaScore: 75,
        recommendationBucket: 'Strong Candidate',
        confidence: 80,
        priceChangePercent: 2.5,
        conviction: 'high',
        thesis: 'Test thesis',
        supportingSignals: ['MA20_breakout'],
        riskFactors: ['high_valuation'],
      },
    ],
    riskSignals: [],
    topInsights: [],
    dataCoverage: 'full',
    limitations: [],
    snapshotId: 1,
    ...overrides,
  };
}

describe('DecisionLayerEngine Learning Feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStockFindUnique.mockResolvedValue({ id: '2330', name: 'TSMC', industry: 'Semiconductor' });
  });

  it('uses default sizing when no learning data exists', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const proposals = await buildStrategyProposals(makeSnapshot());
    expect(proposals).toHaveLength(1);
    expect(proposals[0].positionSizing).toBe(0.1); // high conviction default
    const meta = proposals[0].decisionMeta as Record<string, unknown>;
    const feedback = meta.learningFeedback as Record<string, unknown>;
    expect(feedback.hasLearningData).toBe(false);
  });

  it('reduces sizing for penalized setup types with enough full trades', async () => {
    mockQueryRaw.mockResolvedValue([{
      id: 1,
      successPatterns: JSON.stringify(['rebound：5 筆正報酬檢討']),
      failurePatterns: JSON.stringify(['trend：8 筆負報酬檢討']),
      adjustmentSuggestions: JSON.stringify(['提高 trend 的失效門檻']),
      sourceCount: 13,
      limitations: JSON.stringify(['學習結果僅基於已生成 review 的模擬交易，仍需持續累積樣本。']),
    }]);

    const proposals = await buildStrategyProposals(makeSnapshot());
    expect(proposals).toHaveLength(1);
    // trend is penalized and has enough full trades → 0.1 * 0.7 = 0.07
    expect(proposals[0].positionSizing).toBe(0.07);
    const meta = proposals[0].decisionMeta as Record<string, unknown>;
    const feedback = meta.learningFeedback as Record<string, unknown>;
    expect(feedback.hasLearningData).toBe(true);
    expect(feedback.adjustedSizing).toBe(0.07);
    expect(feedback.baseSizing).toBe(0.1);
  });

  it('boosts sizing for rewarded setup types with high conviction', async () => {
    mockQueryRaw.mockResolvedValue([{
      id: 1,
      successPatterns: JSON.stringify(['trend：10 筆正報酬檢討']),
      failurePatterns: JSON.stringify([]),
      adjustmentSuggestions: JSON.stringify(['保留 trend 的研究框架']),
      sourceCount: 10,
      limitations: JSON.stringify([]),
    }]);

    const proposals = await buildStrategyProposals(makeSnapshot());
    expect(proposals).toHaveLength(1);
    // trend rewarded + high conviction → 0.1 * 1.15 = 0.115
    expect(proposals[0].positionSizing).toBe(0.115);
  });

  it('[P0-2] blocks negative adjustment when full trade samples insufficient', async () => {
    mockQueryRaw.mockResolvedValue([{
      id: 1,
      successPatterns: JSON.stringify([]),
      failurePatterns: JSON.stringify(['trend：8 筆負報酬檢討']),
      adjustmentSuggestions: JSON.stringify(['提高 trend 的失效門檻']),
      sourceCount: 10,
      // This limitation indicates shadow-only data
      limitations: JSON.stringify(['學習結果僅基於已生成 review 的模擬交易，仍需持續累積樣本。', 'full trade 樣本不足 5 筆，learning adjustment 應保守或停用。']),
    }]);

    const proposals = await buildStrategyProposals(makeSnapshot());
    expect(proposals).toHaveLength(1);
    // trend has negative patterns but full trade samples insufficient
    // → penalty should NOT be applied → sizing stays at 0.1
    expect(proposals[0].positionSizing).toBe(0.1);
    const meta = proposals[0].decisionMeta as Record<string, unknown>;
    const feedback = meta.learningFeedback as Record<string, unknown>;
    expect(String(feedback.adjustmentNote)).toContain('樣本不足');
  });

  it('ignores learning data with insufficient source count', async () => {
    mockQueryRaw.mockResolvedValue([{
      id: 1,
      successPatterns: JSON.stringify([]),
      failurePatterns: JSON.stringify(['trend：8 筆負報酬檢討']),
      adjustmentSuggestions: JSON.stringify([]),
      sourceCount: 3, // below threshold of 5
    }]);

    const proposals = await buildStrategyProposals(makeSnapshot());
    expect(proposals).toHaveLength(1);
    expect(proposals[0].positionSizing).toBe(0.1); // no adjustment
  });
});
