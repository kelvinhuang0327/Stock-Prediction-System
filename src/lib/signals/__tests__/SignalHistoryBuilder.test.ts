import { buildAllSignalHistories, buildSignalHistory } from '../SignalHistoryBuilder';
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
        symbol: ' 2330 ',
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

  it.each(['topic_surging', 'theme_diffusing'] as const)(
    'returns a documented degraded history for empty %s inputs',
    async (signalType) => {
      (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([]);

      const history = await buildSignalHistory(signalType, 14);

      expect(history.signalType).toBe(signalType);
      expect(history.observations).toEqual([]);
      expect(history.limitations).toEqual(expect.arrayContaining([
        expect.stringContaining('NewsEvent 無可用資料'),
      ]));
    },
  );

  it('reconstructs topic surges from a populated comparison window and normalizes symbols', async () => {
    const day = (offset: number) => {
      const value = new Date();
      value.setUTCHours(12, 0, 0, 0);
      value.setUTCDate(value.getUTCDate() + offset);
      return value;
    };
    (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([
      { title: '市場觀察', summary: '', publishedAt: day(-4), relatedThemes: '[]', relatedSymbols: '[]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(-2), relatedThemes: '["AI伺服器"]', relatedSymbols: '["2330", "2330"]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(-1), relatedThemes: '["AI伺服器"]', relatedSymbols: '[" 2317 "]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(0), relatedThemes: '["AI伺服器"]', relatedSymbols: '["2330"]', source: 'wire' },
    ]);

    const history = await buildSignalHistory('topic_surging', 14);

    expect(history.observations).toHaveLength(4);
    expect(history.observations.map((item) => item.symbol)).toEqual(['2330', '2317', '2330', '2317']);
    expect(history.observations[0]).toMatchObject({
      signalType: 'topic_surging',
      context: {
        topic: 'AI伺服器',
        metadata: { recentCount: 2, previousCount: 0, windowDays: 3 },
      },
    });
  });

  it('keeps modest topic growth at watch level and ignores malformed related-theme JSON', async () => {
    const day = (offset: number) => {
      const value = new Date();
      value.setUTCHours(12, 0, 0, 0);
      value.setUTCDate(value.getUTCDate() + offset);
      return value;
    };
    (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([
      { title: '', summary: '', publishedAt: day(-3), relatedThemes: '["AI伺服器"]', relatedSymbols: '[]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(-3), relatedThemes: '[broken', relatedSymbols: '[]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(-1), relatedThemes: '["AI伺服器"]', relatedSymbols: '[]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(0), relatedThemes: '["AI伺服器"]', relatedSymbols: '[]', source: 'wire' },
      { title: '', summary: '', publishedAt: day(0), relatedThemes: '["單日主題"]', relatedSymbols: '[]', source: 'wire' },
    ]);

    const history = await buildSignalHistory('topic_surging', 14);

    expect(history.observations).toEqual([]);
    expect(history.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('樣本量偏低（0 筆）'),
    ]));
  });

  it('emits diffusing topic observations with breadth and source diversity', async () => {
    const day = (offset: number) => {
      const value = new Date();
      value.setUTCHours(12, 0, 0, 0);
      value.setUTCDate(value.getUTCDate() + offset);
      return value;
    };
    (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([
      { title: '', summary: '', publishedAt: day(-1), relatedThemes: '["AI伺服器"]', relatedSymbols: '["2330"]', source: 'official' },
      { title: '', summary: '', publishedAt: day(0), relatedThemes: '["AI伺服器"]', relatedSymbols: '["2317"]', source: 'mainstream' },
    ]);

    const history = await buildSignalHistory('theme_diffusing', 14);

    expect(history.observations.map((item) => item.symbol)).toEqual(['2330', '2317']);
    expect(history.observations[0]).toMatchObject({
      context: { topic: 'AI伺服器', metadata: { breadth: 2, sourceDiversity: 2, windowDays: 7 } },
    });
  });

  it('returns a limitation when no high alpha snapshots exist', async () => {
    mockCandidateCount.mockResolvedValue(0);

    const history = await buildSignalHistory('strong_alpha_candidate', 180);

    expect(mockCandidateFindMany).not.toHaveBeenCalled();
    expect(history.observations).toEqual([]);
    expect(history.limitations[0]).toContain('尚無資料');
  });

  it('normalizes compact dates and emits positive institutional accumulation', async () => {
    (prisma.institutionalChip.findMany as jest.Mock).mockResolvedValue([
      { date: '20260316', stockId: ' 2330 ', foreignBuy: 2, trustBuy: 1, dealerBuy: -1, totalBuy: 2 },
    ]);

    const history = await buildSignalHistory('chip_accumulation_signal', 180);

    expect(history.observations).toEqual([
      expect.objectContaining({
        symbol: '2330',
        date: '2026-03-16',
        context: { metadata: { totalBuy: 2, foreignBuy: 2, trustBuy: 1, dealerBuy: -1 } },
      }),
    ]);
  });

  it('skips malformed and non-elevated risk snapshots', async () => {
    mockPortfolioCount.mockResolvedValue(2);
    mockPortfolioFindMany.mockResolvedValue([
      { snapshotDate: '2026-03-16', scope: 'watchlist', riskClusters: '{bad json' },
      { snapshotDate: '2026-03-17', scope: 'watchlist', riskClusters: JSON.stringify({ overallRiskLevel: 'low', clusters: [] }) },
    ]);

    const history = await buildSignalHistory('risk_cluster_elevated', 180);

    expect(history.observations).toEqual([]);
    expect(history.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('樣本偏低'),
    ]));
  });

  it('keeps elevated clusters without symbols as market observations and normalizes unknown regimes', async () => {
    mockPortfolioCount.mockResolvedValue(1);
    mockPortfolioFindMany.mockResolvedValue([
      {
        snapshotDate: 'bad',
        scope: 'portfolio',
        riskClusters: JSON.stringify({
          overallRiskLevel: 'elevated',
          clusters: [{ clusterType: 'portfolio', riskLevel: 'elevated', symbols: [], reason: 'Market wide exposure' }],
        }),
      },
    ]);
    mockMarketCount.mockResolvedValue(4);
    mockMarketFindMany.mockResolvedValue([
      { snapshotDate: '20260301', regime: 'Bull', regimeConfidence: 70 },
      { snapshotDate: 'bad', regime: 'risk-off', regimeConfidence: 55 },
      { snapshotDate: '20260303', regime: 'risk-off', regimeConfidence: 50 },
      { snapshotDate: '20260304', regime: 'Neutral', regimeConfidence: 60 },
    ]);

    const riskHistory = await buildSignalHistory('risk_cluster_elevated', 180);
    const regimeHistory = await buildSignalHistory('regime_shift_signal', 180);

    expect(riskHistory.observations).toEqual([
      expect.objectContaining({ date: 'bad', context: { metadata: expect.objectContaining({ clusterType: 'portfolio', riskLevel: 'elevated' }) } }),
    ]);
    expect(regimeHistory.observations).toEqual([
      expect.objectContaining({ date: 'bad', context: expect.objectContaining({ regime: 'Unknown', confidence: 55 }) }),
      expect.objectContaining({ date: '2026-03-04', context: expect.objectContaining({ regime: 'Neutral', confidence: 60 }) }),
    ]);
  });

  it('skips valid snapshots whose overall risk and every cluster are below elevated', async () => {
    mockPortfolioCount.mockResolvedValue(1);
    mockPortfolioFindMany.mockResolvedValue([
      {
        snapshotDate: '2026-03-16',
        scope: 'watchlist',
        riskClusters: JSON.stringify({
          overallRiskLevel: 'low',
          clusters: [{ clusterType: 'sector', riskLevel: 'moderate', symbols: ['2330'], reason: 'Normal dispersion' }],
        }),
      },
    ]);

    const history = await buildSignalHistory('risk_cluster_elevated', 180);

    expect(history.observations).toEqual([]);
    expect(history.limitations).toContain('risk_cluster_elevated 來自 PortfolioImpactSnapshot 的高風險 cluster；若 cluster 未附 symbols，僅能視為市場級觀察');
  });

  it('returns no regime shifts when there are no market snapshots', async () => {
    mockMarketCount.mockResolvedValue(0);

    const history = await buildSignalHistory('regime_shift_signal', 180);

    expect(mockMarketFindMany).not.toHaveBeenCalled();
    expect(history.observations).toEqual([]);
    expect(history.limitations[0]).toContain('尚無資料');
  });

  it('builds every supported history with source-specific empty-data limitations', async () => {
    mockCandidateCount.mockResolvedValue(0);
    mockPortfolioCount.mockResolvedValue(0);
    mockMarketCount.mockResolvedValue(0);
    (prisma.newsEvent.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.institutionalChip.findMany as jest.Mock).mockResolvedValue([]);

    const histories = await buildAllSignalHistories(30);

    expect(histories.map((history) => history.signalType)).toEqual([
      'topic_surging',
      'theme_diffusing',
      'strong_alpha_candidate',
      'chip_accumulation_signal',
      'risk_cluster_elevated',
      'regime_shift_signal',
    ]);
    expect(histories.every((history) => history.observations.length === 0)).toBe(true);
    expect(histories.every((history) => history.limitations.length > 0)).toBe(true);
  });
});
