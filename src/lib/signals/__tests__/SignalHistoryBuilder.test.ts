import { buildSignalHistory } from '../SignalHistoryBuilder';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    newsEvent: {
      findMany: jest.fn(),
    },
    dailyCandidateSnapshot: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    institutionalChip: {
      findMany: jest.fn(),
    },
    portfolioImpactSnapshot: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    dailyMarketSnapshot: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockCandidateCount = prisma.dailyCandidateSnapshot.count as jest.Mock;
const mockCandidateFindMany = prisma.dailyCandidateSnapshot.findMany as jest.Mock;
const mockPortfolioCount = prisma.portfolioImpactSnapshot.count as jest.Mock;
const mockPortfolioFindMany = prisma.portfolioImpactSnapshot.findMany as jest.Mock;
const mockMarketCount = prisma.dailyMarketSnapshot.count as jest.Mock;
const mockMarketFindMany = prisma.dailyMarketSnapshot.findMany as jest.Mock;

describe('SignalHistoryBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.institutionalChip.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('uses alphaScore high bucket for strong_alpha_candidate instead of recommendation bucket', async () => {
    mockCandidateCount.mockResolvedValue(2);
    mockCandidateFindMany.mockResolvedValue([
      {
        snapshotDate: '2026-03-15',
        symbol: '2330',
        alphaScore: 76,
        confidence: 82,
        recommendationBucket: 'Watch',
        screenBucket: 'Watch',
      },
    ]);

    const history = await buildSignalHistory('strong_alpha_candidate', 180);

    expect(mockCandidateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          alphaScore: { gte: 75 },
        }),
      }),
    );
    expect(history.observations).toHaveLength(1);
    expect(history.observations[0]).toMatchObject({
      signalType: 'strong_alpha_candidate',
      symbol: '2330',
      date: '2026-03-15',
      context: {
        confidence: 82,
      },
    });
  });

  it('extracts symbol-level observations from elevated portfolio risk clusters', async () => {
    mockPortfolioCount.mockResolvedValue(1);
    mockPortfolioFindMany.mockResolvedValue([
      {
        snapshotDate: '2026-03-16',
        scope: 'watchlist',
        riskClusters: JSON.stringify({
          overallRiskLevel: 'elevated',
          clusters: [
            {
              clusterType: 'theme',
              riskLevel: 'high',
              symbols: ['2330', '2317'],
              reason: 'AI theme crowding',
            },
          ],
        }),
      },
    ]);

    const history = await buildSignalHistory('risk_cluster_elevated', 180);

    expect(history.observations).toHaveLength(2);
    expect(history.observations.map((item) => item.symbol)).toEqual(['2330', '2317']);
    expect(history.observations[0].context.metadata).toMatchObject({
      clusterType: 'theme',
      riskLevel: 'high',
      scope: 'watchlist',
    });
  });

  it('normalizes Sideways regime changes to Neutral for regime_shift_signal', async () => {
    mockMarketCount.mockResolvedValue(2);
    mockMarketFindMany.mockResolvedValue([
      {
        snapshotDate: '2026-03-15',
        regime: 'Bull',
        regimeConfidence: 72,
      },
      {
        snapshotDate: '2026-03-16',
        regime: 'Sideways',
        regimeConfidence: 55,
      },
    ]);

    const history = await buildSignalHistory('regime_shift_signal', 180);

    expect(history.observations).toHaveLength(1);
    expect(history.observations[0]).toMatchObject({
      signalType: 'regime_shift_signal',
      date: '2026-03-16',
      context: {
        regime: 'Neutral',
        confidence: 55,
      },
    });
  });
});
