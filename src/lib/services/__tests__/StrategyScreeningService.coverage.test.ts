import type { ScreeningResult, Strategy } from '../../strategies/types';

const mockStrategySignalFindMany = jest.fn();
const mockStockFindMany = jest.fn();
const mockMarketIndexFindMany = jest.fn();
const mockGetMarketStatus = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('../../prisma', () => ({
  prisma: {
    strategySignal: { findMany: mockStrategySignalFindMany },
    stock: { findMany: mockStockFindMany },
    marketIndex: { findMany: mockMarketIndexFindMany },
  },
}));

jest.mock('../MarketStatusService', () => ({ marketStatusService: { getStatus: mockGetMarketStatus } }));
jest.mock('../SimpleCacheService', () => ({ simpleCacheService: { get: mockCacheGet, set: mockCacheSet } }));

function result(stockId: string, overrides: Partial<ScreeningResult> = {}): ScreeningResult {
  return {
    stockId,
    name: `${stockId} Co.`,
    revenueYoY: 12,
    eps: 3,
    chipStrength: 40,
    technicalScore: 50,
    reason: 'fixture',
    potentialLabel: 'steady',
    climbPercent: 8,
    rsScore: 60,
    ...overrides,
  };
}

function testStrategy(screen: jest.Mock, analyze?: jest.Mock): Strategy {
  return { name: 'fixture', description: 'fixture', screen, analyze } as unknown as Strategy;
}

function stockRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '2330',
    name: 'TSMC',
    capital: 0,
    quotes: [{ date: '2026-05-30', open: 99, high: 101, low: 98, close: 100, volume: 1000 }],
    monthlyRevenues: [{ year: 2026, month: 5, revenue: 120, yoyGrowth: null }],
    financialReports: [],
    institutionalChips: [],
    ...overrides,
  };
}

describe('StrategyScreeningService', () => {
  let service: import('../StrategyScreeningService').StrategyScreeningService;
  let assetScreen: jest.Mock;
  let momentumScreen: jest.Mock;
  let assetAnalyze: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStrategySignalFindMany.mockResolvedValue([]);
    mockStockFindMany.mockResolvedValue([]);
    mockMarketIndexFindMany.mockResolvedValue([]);
    mockGetMarketStatus.mockResolvedValue({ scalingFactor: 0.75, regime: 'CORRECTION' });
    mockCacheGet.mockReturnValue(null);

    const { StrategyScreeningService } = await import('../StrategyScreeningService');
    service = new StrategyScreeningService();
    assetScreen = jest.fn().mockResolvedValue([]);
    momentumScreen = jest.fn().mockResolvedValue([]);
    assetAnalyze = jest.fn().mockResolvedValue(null);
    const strategies = (service as unknown as { strategies: Record<string, Strategy> }).strategies;
    strategies.AssetDoubling = testStrategy(assetScreen, assetAnalyze);
    strategies.MomentumSwing = testStrategy(momentumScreen);
    strategies.DayTradePrep = testStrategy(jest.fn().mockResolvedValue([]));
  });

  it('maps precomputed signals and applies metadata and display fallbacks', async () => {
    mockStrategySignalFindMany.mockResolvedValue([
      { stockId: '2330', metadata: '{"revenueYoY":18,"climbPercent":12,"rsScore":77}', score: 91, reason: 'trend', label: 'leader' },
      { stockId: '2317', metadata: null, score: null, reason: null, label: null },
    ]);

    await expect(service.screen({ asOfDate: '2026-05-31' })).resolves.toEqual([
      {
        stockId: '2330', name: '2330', revenueYoY: 18, eps: 0, chipStrength: 0,
        technicalScore: 91, reason: 'trend', potentialLabel: 'leader', climbPercent: 12,
        rsScore: 77, closePrice: 0,
      },
      {
        stockId: '2317', name: '2317', revenueYoY: 0, eps: 0, chipStrength: 0,
        technicalScore: 0, reason: '', potentialLabel: '', climbPercent: 0, rsScore: 0,
        closePrice: 0,
      },
    ]);
    expect(mockStrategySignalFindMany).toHaveBeenCalledWith({ where: { date: '20260531', strategyName: 'AssetDoubling' } });
    expect(mockStockFindMany).not.toHaveBeenCalled();
    expect(mockCacheGet).not.toHaveBeenCalled();
  });

  it('returns the in-memory cache entry before fetching stocks', async () => {
    const cached = [result('2330')];
    mockCacheGet.mockReturnValue(cached);

    await expect(service.screen()).resolves.toBe(cached);
    expect(mockCacheGet).toHaveBeenCalledWith('screening:{}');
    expect(mockStockFindMany).not.toHaveBeenCalled();
  });

  it('filters data as of the requested date, delegates to the selected strategy, then re-runs deep candidates', async () => {
    const shallowCandidate = result('2330');
    const deepCandidate = result('2330', { reason: 'deep history confirms trend' });
    momentumScreen.mockResolvedValueOnce([shallowCandidate]).mockResolvedValueOnce([deepCandidate]);
    mockStockFindMany
      .mockResolvedValueOnce([stockRow({ capital: null })])
      .mockResolvedValueOnce([stockRow({ monthlyRevenues: [{ year: 2026, month: 5, revenue: 120, yoyGrowth: 18 }] })]);
    mockMarketIndexFindMany.mockResolvedValue([{ name: 'TAIEX', date: '2026-05-30', value: 22_000 }]);

    await expect(service.screen({ asOfDate: '2026-05-31', strategy: 'MomentumSwing', maxCapital: 50 })).resolves.toEqual([deepCandidate]);

    expect(mockStockFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { OR: [{ capital: { lte: 5_000_000_000 } }, { capital: null }] },
      include: expect.objectContaining({
        monthlyRevenues: expect.objectContaining({ where: { OR: [{ year: { lt: 2026 } }, { AND: [{ year: 2026 }, { month: { lte: 5 } }] }] } }),
        financialReports: expect.objectContaining({ where: { OR: [{ year: { lt: 2026 } }, { AND: [{ year: 2026 }, { quarter: { lte: 2 } }] }] } }),
        quotes: expect.objectContaining({ where: { date: { lte: '2026-05-31' } } }),
        institutionalChips: expect.objectContaining({ where: { date: { lte: '2026-05-31' } } }),
      }),
    }));
    expect(mockMarketIndexFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ date: { lte: '2026-05-31' } }) }));
    expect(mockGetMarketStatus).toHaveBeenCalledWith('2026-05-31');
    expect(momentumScreen).toHaveBeenNthCalledWith(1, [expect.objectContaining({ capital: undefined, monthlyRevenues: [{ year: 2026, month: 5, revenue: 120, yoyGrowth: undefined }] })], expect.any(Array), { scalingFactor: 0.75, regime: 'CORRECTION' });
    expect(momentumScreen).toHaveBeenNthCalledWith(2, [expect.objectContaining({ monthlyRevenues: [{ year: 2026, month: 5, revenue: 120, yoyGrowth: 18 }] })], expect.any(Array), { scalingFactor: 0.75, regime: 'CORRECTION' });
    expect(mockStockFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: { in: ['2330'] } } }));
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('stores empty screening results with the standard TTL', async () => {
    mockStockFindMany.mockResolvedValue([stockRow()]);

    await expect(service.screen({})).resolves.toEqual([]);

    expect(assetScreen).toHaveBeenCalledWith(
      [expect.objectContaining({ stockId: '2330', capital: undefined, monthlyRevenues: [{ year: 2026, month: 5, revenue: 120, yoyGrowth: undefined }] })],
      [],
      { scalingFactor: 0.75, regime: 'CORRECTION' },
    );
    expect(mockCacheSet).toHaveBeenCalledWith('screening:{}', [], 1800);
  });

  it('returns null for an unknown stock and delegates analysis for a found stock', async () => {
    await expect(service.analyzeStock('missing')).resolves.toBeNull();
    mockStockFindMany.mockResolvedValueOnce([stockRow({ capital: 200 })]);
    const analyzed = result('2330');
    assetAnalyze.mockResolvedValue(analyzed);

    await expect(service.analyzeStock('2330', '2026-05-31')).resolves.toBe(analyzed);
    expect(mockStockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: '2330' },
      include: expect.objectContaining({
        quotes: expect.objectContaining({ where: { date: { lte: '2026-05-31' } } }),
      }),
    }));
    expect(assetAnalyze).toHaveBeenCalledWith(expect.objectContaining({ stockId: '2330', name: 'TSMC' }));
  });

  it('returns null when the selected strategy has no single-stock analyzer', async () => {
    mockStockFindMany.mockResolvedValue([stockRow()]);
    await expect(service.analyzeStock('2330', undefined, 'MomentumSwing')).resolves.toBeNull();
  });

  it('returns cached rankings without screening', async () => {
    const cached = [{ stockId: '2330', name: '2330 Co.', value: 10, label: 'leader' }];
    mockCacheGet.mockReturnValue(cached);

    await expect(service.getMetricRankings('revenue', 1, '2026-05-31')).resolves.toBe(cached);
    expect(mockCacheGet).toHaveBeenCalledWith('rankings:revenue:2026-05-31');
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it.each([
    ['rsi', 90],
    ['revenue', 40],
    ['rs', 80],
    ['chip', 90],
    ['technical', 90],
    ['unlisted', 90],
  ])('ranks by %s and caches the selected metric value', async (metric, expectedTop) => {
    const rows = [
      result('LOW', { revenueYoY: 10, rsScore: 20, chipStrength: 10, technicalScore: 30 }),
      result('HIGH', { revenueYoY: 40, rsScore: 80, chipStrength: 60, technicalScore: 90 }),
      result('MID', { revenueYoY: 20, rsScore: 50, chipStrength: 30, technicalScore: 60 }),
    ];
    const screenSpy = jest.spyOn(service, 'screen').mockResolvedValue(rows);

    const ranked = await service.getMetricRankings(metric, 2);

    expect(ranked[0]).toMatchObject({ stockId: 'HIGH', value: expectedTop, label: 'steady' });
    expect(ranked).toHaveLength(2);
    expect(screenSpy).toHaveBeenCalledWith({ asOfDate: undefined, strategy: 'AssetDoubling', options: { skipFilters: true } });
    expect(mockCacheSet).toHaveBeenCalledWith(`rankings:${metric}:latest`, ranked, 600);
  });
});
