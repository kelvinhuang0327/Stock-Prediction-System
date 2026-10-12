import { runCtoReviewTick } from '../ctoReviewTick';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    strategyProposal: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, symbol: 'AAA', setupType: 'trend', conviction: 'high' },
        { id: 2, symbol: 'BBB', setupType: 'rebound', conviction: 'low' },
        { id: 3, symbol: 'CCC', setupType: 'breakout', conviction: 'med' },
        { id: 4, symbol: 'AAA', setupType: 'trend', conviction: 'low' }, // duplicate symbol
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
    strategyLearningInsight: { findMany: jest.fn().mockResolvedValue([]) },
    simulatedTrade: {
      findMany: jest.fn().mockResolvedValue([
        { proposalId: 1, pnlPct: 5.2, exitReason: 'time_exit', tradeMode: 'shadow' },
        { proposalId: 2, pnlPct: -3.1, exitReason: 'stop_loss', tradeMode: 'full' },
        // proposalId 3 missing => pnl null (deferred)
      ]),
    },
    ctoReviewRun: {
      create: jest.fn().mockResolvedValue({ runId: 'run-123' }),
    },
    ctoIntentSignal: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  },
}));

jest.mock('../backlogService', () => ({ batchInsertBacklogItems: jest.fn().mockResolvedValue(2) }));
jest.mock('../signalStateClassifier', () => ({ classifySignalState: jest.fn().mockResolvedValue({ state: 'NORMAL', confidenceLabel: 'high' }) }));

describe('ctoReviewTick integration (mocked prisma)', () => {
  it('runs and produces expected candidate counts and backlog items', async () => {
    const res = await runCtoReviewTick({ isManual: true });

    expect(res).toHaveProperty('runId');
    expect(res.candidateCount).toBeGreaterThanOrEqual(4);
    // acceptedCount should be at least 1 (proposalId 1 had positive pnl)
    expect(res.acceptedCount).toBeGreaterThanOrEqual(1);
    // rejectedCount should be at least 1 (proposalId 2 had stop_loss loss)
    expect(res.rejectedCount).toBeGreaterThanOrEqual(1);
    // deferredCount should be at least 1 (proposalId 3 had no trade)
    expect(res.deferredCount).toBeGreaterThanOrEqual(1);

    // backlogItemsCreated from mocked batchInsertBacklogItems
    expect(res.backlogItemsCreated).toBe(2);
  });
});
