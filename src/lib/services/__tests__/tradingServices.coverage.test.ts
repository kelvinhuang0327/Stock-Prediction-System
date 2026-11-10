jest.mock('../../prisma', () => ({
  prisma: {
    stockQuote: { findMany: jest.fn().mockResolvedValue([]) },
    institutionalChip: { findMany: jest.fn().mockResolvedValue([]) },
    newsEvent: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock('../../technicalIndicators', () => ({ calculateAllIndicators: jest.fn().mockReturnValue([]) }));
jest.mock('../LLMAnalyzer', () => ({ llmAnalyzer: { analyzeNews: jest.fn().mockResolvedValue({ sentiment: 0 }) } }));
jest.mock('../MajorPlayerService', () => {
  const actual = jest.requireActual<typeof import('../MajorPlayerService')>('../MajorPlayerService');
  return { ...actual, majorPlayerService: { analyze: jest.fn().mockResolvedValue(null) } };
});
jest.mock('../NewsService', () => ({ newsService: { fetchLatestNews: jest.fn().mockResolvedValue([]) } }));

import { prisma } from '../../prisma';
import { calculateAllIndicators } from '../../technicalIndicators';
import { llmAnalyzer } from '../LLMAnalyzer';
import { majorPlayerService } from '../MajorPlayerService';
import { newsService } from '../NewsService';
import { PredictionEngine } from '../PredictionEngine';
import { MajorPlayerService } from '../MajorPlayerService';
import { RealTimeService } from '../RealTimeService';

const mockedPrisma = prisma as unknown as {
  stockQuote: { findMany: jest.Mock };
  institutionalChip: { findMany: jest.Mock };
  newsEvent: { findMany: jest.Mock };
};
const mockedIndicators = calculateAllIndicators as jest.MockedFunction<typeof calculateAllIndicators>;
const mockedLlm = llmAnalyzer as unknown as { analyzeNews: jest.Mock };
const mockedMajorPlayer = majorPlayerService as unknown as { analyze: jest.Mock };
const mockedNews = newsService as unknown as { fetchLatestNews: jest.Mock };
const originalFetch = globalThis.fetch;

function quoteRows(count = 20): { stockId: string; date: string; open: number; high: number; low: number; close: number; volume: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    stockId: '2330',
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    open: 100,
    high: 110,
    low: 95,
    close: 105,
    volume: 1000,
  }));
}

function indicatorRow(overrides: Record<string, number | undefined> = {}): Record<string, number | undefined> {
  return { close: 110, rsi: 20, dif: 2, dem: 1, ma20: 100, ma60: 90, ...overrides };
}

describe('PredictionEngine', () => {
  const engine = new PredictionEngine();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.stockQuote.findMany.mockResolvedValue([]);
    mockedPrisma.newsEvent.findMany.mockResolvedValue([]);
    mockedIndicators.mockReturnValue([]);
    mockedLlm.analyzeNews.mockResolvedValue({ sentiment: 0 });
    mockedMajorPlayer.analyze.mockResolvedValue(null);
    mockedNews.fetchLatestNews.mockResolvedValue([]);
  });

  it('combines live news, bullish technicals, and chip strength into a high-confidence BUY', async () => {
    const today = new Date().toISOString().split('T')[0]!.replace(/-/g, '');
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedNews.fetchLatestNews.mockResolvedValue([
      { title: 'Growth outlook', summary: 'positive' },
      { title: 'Demand improves', summary: null },
    ]);
    mockedLlm.analyzeNews.mockResolvedValueOnce({ sentiment: 1 }).mockResolvedValueOnce({ sentiment: 0.8 });
    mockedIndicators.mockReturnValue([indicatorRow() as never] as never);
    mockedMajorPlayer.analyze.mockResolvedValue({ averageCost: 100, targetPrice: 120, strength: 100, description: '積極佈局' });

    const result = await engine.predict('2330', today);

    expect(result).toMatchObject({
      stockId: '2330',
      technicalScore: 100,
      newsScore: 95,
      totalScore: 99,
      signal: 'BUY',
      confidence: 0.75,
      factors: { newsCount: 2, newsAnalysis: 'Analyzed with LLM Engine', chipStrength: 100 },
    });
    expect(mockedNews.fetchLatestNews).toHaveBeenCalledWith('2330', 5);
    expect(mockedPrisma.newsEvent.findMany).not.toHaveBeenCalled();
  });

  it('uses stored related news for current-day lookups when live news is empty', async () => {
    const today = new Date().toISOString().split('T')[0]!.replace(/-/g, '');
    mockedPrisma.newsEvent.findMany.mockResolvedValue([
      { title: 'Matching', summary: 'kept', relatedSymbols: '["2330"]' },
      { title: 'Other stock', summary: 'filtered', relatedSymbols: '["2317"]' },
      { title: 'Malformed', summary: null, relatedSymbols: '{bad json' },
      { title: 'Object value', summary: null, relatedSymbols: '{"symbol":"2330"}' },
    ] as never);
    mockedLlm.analyzeNews.mockResolvedValue({ sentiment: 0.4 });

    const result = await engine.predict('2330', today);

    expect(result.factors.newsCount).toBe(1);
    expect(mockedLlm.analyzeNews).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.newsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('uses only related stored news published by a historical context date', async () => {
    mockedPrisma.newsEvent.findMany.mockResolvedValue([
      { title: 'Before cutoff', summary: '', relatedSymbols: '["2330"]' },
      { title: 'Unrelated', summary: '', relatedSymbols: '["2317"]' },
    ] as never);

    await engine.predict('2330', '2024-01-02');
    expect(mockedNews.fetchLatestNews).not.toHaveBeenCalled();
    const query = mockedPrisma.newsEvent.findMany.mock.calls[0]![0] as { where: { publishedAt: { lte: Date } } };
    expect(query.where.publishedAt.lte.toISOString()).toBe('2024-01-02T23:59:59.000Z');

    mockedPrisma.newsEvent.findMany.mockClear();
    await engine.predict('2330', '20240102');
    expect(mockedPrisma.newsEvent.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns neutral technical scores for short history or empty indicator output', async () => {
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows(19) as never);
    await expect(engine.predict('2330')).resolves.toMatchObject({ technicalScore: 50, signal: 'HOLD' });
    expect(mockedIndicators).not.toHaveBeenCalled();

    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedIndicators.mockReturnValue([]);
    await expect(engine.predict('2330')).resolves.toMatchObject({ technicalScore: 50 });
  });

  it('covers bearish indicators, MACD fallback, missing moving averages, and SELL', async () => {
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedIndicators.mockReturnValue([indicatorRow({ rsi: 75, dif: 1, dem: 2, close: 90, ma20: 100, ma60: undefined }) as never] as never);
    mockedMajorPlayer.analyze.mockResolvedValue({ averageCost: 0, targetPrice: 0, strength: 1, description: '' });

    await expect(engine.predict('2330')).resolves.toMatchObject({ technicalScore: 20, newsScore: 50, signal: 'SELL' });
  });

  it('derives CAUTION for divergent bullish and bearish signal combinations', async () => {
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedIndicators.mockReturnValue([indicatorRow() as never] as never);
    mockedNews.fetchLatestNews.mockResolvedValue([{ title: 'Bad', summary: '' }]);
    mockedLlm.analyzeNews.mockResolvedValue({ sentiment: -1 });
    await expect(engine.predict('2330')).resolves.toMatchObject({ technicalScore: 100, newsScore: 0, signal: 'CAUTION' });

    mockedIndicators.mockReturnValue([indicatorRow({ rsi: 75, dif: 0, dem: 1, close: 90, ma20: 100, ma60: undefined }) as never] as never);
    mockedLlm.analyzeNews.mockResolvedValue({ sentiment: 1 });
    await expect(engine.predict('2330')).resolves.toMatchObject({ technicalScore: 20, newsScore: 100, signal: 'CAUTION' });
  });

  it('boosts confidence for two agreeing signals and multiple news sources', async () => {
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedIndicators.mockReturnValue([indicatorRow({ rsi: 55, dif: 2, dem: 1, close: 105, ma20: 100, ma60: undefined }) as never] as never);
    mockedNews.fetchLatestNews.mockResolvedValue([
      { title: '1', summary: '' }, { title: '2', summary: '' }, { title: '3', summary: '' },
    ]);
    mockedLlm.analyzeNews.mockResolvedValue({ sentiment: 0.5 });
    mockedMajorPlayer.analyze.mockResolvedValue({ averageCost: 1, targetPrice: 2, strength: 80, description: '' });

    const result = await engine.predict('2330');

    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.85);
  });
});

describe('MajorPlayerService', () => {
  const service = new MajorPlayerService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows() as never);
    mockedPrisma.institutionalChip.findMany.mockResolvedValue([]);
  });

  it('returns null when quote history is too short', async () => {
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quoteRows(19) as never);
    await expect(service.analyze('2330')).resolves.toBeNull();
  });

  it('calculates average cost, dominant player, target, and capped strength for strong foreign buying', async () => {
    const quotes = quoteRows().map((row, index) => ({ ...row, date: `2026-10-${String(index + 1).padStart(2, '0')}`, close: 100, high: 120 }));
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quotes as never);
    mockedPrisma.institutionalChip.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      stockId: '2330',
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      totalBuy: 600,
      foreignBuy: 800,
      trustBuy: 200,
      dealerBuy: 100,
    })) as never);

    await expect(service.analyze('2330', '20261031')).resolves.toMatchObject({
      averageCost: 100,
      targetPrice: 120,
      strength: 100,
      dominantPlayer: '外資',
      description: expect.stringContaining('積極佈局'),
    });
  });

  it('uses the trust branch, moderate target margin, and zero-buying fallback', async () => {
    const quotes = quoteRows().map((row) => ({ ...row, close: 90, high: 110 }));
    mockedPrisma.stockQuote.findMany.mockResolvedValue(quotes as never);
    mockedPrisma.institutionalChip.findMany.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      stockId: '2330', date: quotes[index]!.date, totalBuy: 300, foreignBuy: 1, trustBuy: 500, dealerBuy: 2,
    })) as never);
    const moderate = await service.analyze('2330');
    expect(moderate).toMatchObject({ averageCost: 90, dominantPlayer: '投信', description: expect.stringContaining('積極佈局') });

    mockedPrisma.institutionalChip.findMany.mockResolvedValue([{ stockId: '2330', date: 'no-match', totalBuy: -10000, foreignBuy: -2, trustBuy: -3, dealerBuy: -4 }] as never);
    await expect(service.analyze('2330')).resolves.toMatchObject({ averageCost: 90, dominantPlayer: '主力', strength: 0, description: expect.stringContaining('相對觀望') });
  });

  it('selects dealer attribution when that is the largest positive net buyer', async () => {
    mockedPrisma.institutionalChip.findMany.mockResolvedValue([
      { stockId: '2330', date: 'x', totalBuy: 250, foreignBuy: 5, trustBuy: 10, dealerBuy: 20 },
    ] as never);
    await expect(service.analyze('2330')).resolves.toMatchObject({ dominantPlayer: '自營商' });
  });
});

describe('RealTimeService', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    else delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it('parses a valid MIS quote, falls back to the open price, and caches it', async () => {
    const service = new RealTimeService();
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ msgArray: [
        null,
        { c: '2330' },
        { c: '2330', n: 'TSMC', ch: 'tse_2330.tw', t: '13:30:00', z: '-', o: '102', y: '100', tv: '60', v: '1234', h: '105', l: '99', a: '104_105', b: '102_101', f: '5_5', g: '40_10', tlong: '1' },
      ] }),
    });

    const quotes = await service.getQuotes(['2330']);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      code: '2330', target: 'tse_2330.tw', tradePrice: 102, tradeVolume: 60,
      accumulatedVolume: 1234, bidAskImbalance: 0.6666666666666666, isWhale: true, timestamp: 1,
    });
    expect(await service.getQuotes(['2330'])).toEqual(quotes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles invalid payload shapes, empty depth, and expired cache entries', async () => {
    const service = new RealTimeService();
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ msgArray: [42, { c: '2317', n: 'Hon Hai', ch: 'tse_2317.tw', z: 'bad', o: 'bad', y: '0', a: '', b: 9, f: 'x', g: '', tv: 'bad', v: null, h: 'bad', l: 0, tlong: 0 }] }) });

    const first = await service.getQuotes(['2317']);
    expect(first[0]).toMatchObject({ tradePrice: 0, tradeVolume: 0, bidAskImbalance: 0, isWhale: false, bestBidPrice: [], bestAskVolume: [0] });
    now.mockReturnValue(7000);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ msgArray: [] }) });
    await expect(service.getQuotes(['2317'])).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns cached entries while fetching misses and contains HTTP/JSON failures', async () => {
    const service = new RealTimeService();
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    const cachedResponse = { ok: true, json: async () => ({ msgArray: [{ c: '2330', n: 'TSMC', ch: 'tse_2330.tw', z: '100', o: '100', y: '99', tv: '1', v: '5' }] }) };
    fetchMock.mockResolvedValueOnce(cachedResponse).mockResolvedValueOnce({ ok: false, status: 500 });
    await service.getQuotes(['2330']);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const mixed = await service.getQuotes(['2330', '2317']);
    expect(mixed).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith('[RealTimeService] Fetch error:', expect.any(Error));

    fetchMock.mockResolvedValue({ ok: true, json: async () => ['not-an-object'] });
    await expect(service.getQuotes(['2454'])).resolves.toEqual([]);
  });

  it('returns immediately for an empty code list and handles rejected fetches', async () => {
    const service = new RealTimeService();
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    await expect(service.getQuotes([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRejectedValue(new Error('offline'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(service.getQuotes(['2330'])).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[RealTimeService] Fetch error:', expect.any(Error));
  });
});
