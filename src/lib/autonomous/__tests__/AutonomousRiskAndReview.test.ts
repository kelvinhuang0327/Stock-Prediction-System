jest.mock('../../prisma', () => ({
  prisma: {
    simulatedTrade: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

import { assessProposalRisk } from '../AutonomousRiskEngine';
import { buildReviewReport, shouldGenerateReview } from '../ReviewEngine';
import type { AutonomousResearchSnapshot, StrategyProposal } from '../types';

const snapshot: AutonomousResearchSnapshot = {
  generatedAt: '2026-03-30T00:00:00.000Z',
  snapshotDate: '2026-03-30',
  marketState: 'trending',
  marketRegime: 'Bull',
  marketRegimeConfidence: 72,
  sectorStrength: [],
  candidateStocks: [],
  riskSignals: [],
  topInsights: [],
  dataCoverage: 'full',
  limitations: [],
};

const proposal: StrategyProposal = {
  symbol: '2330',
  setupType: 'trend',
  thesis: '測試提案',
  entryCondition: '條件',
  invalidationCondition: '失效',
  stopLossRule: '停損',
  takeProfitRule: '停利',
  positionSizing: 0.08,
  conviction: 'high',
  supportingSignals: ['technical'],
  riskFactors: ['volatility'],
  state: 'proposed',
  researchSnapshotId: 1,
};

describe('AutonomousRiskEngine / ReviewEngine', () => {
  it('approves a well-covered trending proposal with a conservative position cap', async () => {
    const result = await assessProposalRisk(proposal, snapshot, { capital: 1_000_000 });

    expect(result.approved).toBe(true);
    expect(result.adjustedPositionSizing).toBeGreaterThan(0);
    expect(result.adjustedPositionSizing).toBeLessThanOrEqual(0.02);
  });

  it('creates a review trigger for +/-5% outcomes', () => {
    expect(shouldGenerateReview(5)).toBe(true);
    expect(shouldGenerateReview(-5)).toBe(true);
    expect(shouldGenerateReview(4.9)).toBe(false);

    const review = buildReviewReport({
      tradeId: 1,
      symbol: '2330',
      setupType: 'trend',
      pnlPct: 6.2,
      holdingDays: 4,
      mfePct: 7.5,
      maePct: -1.2,
      exitReason: 'target',
      marketState: 'trending',
      dataCoverage: 'full',
      thesis: '測試 thesis',
      signalStrength: 'technical',
      fundamentalState: 'full',
    });

    expect(review.triggerType).toBe('+5');
    expect(review.preTrade).toBeDefined();
    expect(review.result).toBeDefined();
  });

  it('time-exit produces triggerType="time" regardless of pnlPct', () => {
    const flatReview = buildReviewReport({
      tradeId: 2,
      symbol: '2330',
      setupType: 'trend',
      pnlPct: -0.17,
      holdingDays: 15,
      mfePct: 1.2,
      maePct: -3.4,
      exitReason: 'time',
      marketState: 'trending',
      dataCoverage: 'insufficient',
      thesis: '時間到期',
      signalStrength: 'technical',
      fundamentalState: 'insufficient',
    });
    expect(flatReview.triggerType).toBe('time');
    expect(flatReview.recommendations.raiseThresholds).toBe(false);
  });
});
