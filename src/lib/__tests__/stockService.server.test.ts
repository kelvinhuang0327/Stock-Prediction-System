/** @jest-environment node */

import { stockService, type StockFilter } from '../stockService';
import { prisma } from '../prisma';
import { POPULAR_STOCKS, SECTORS } from '../mockData';
import { SectorAnalysisService } from '../services/SectorAnalysisService';
import { marketStatusService } from '../services/MarketStatusService';

jest.mock('../prisma', () => ({
  prisma: {
    stock: { findMany: jest.fn(), findUnique: jest.fn() },
    stockQuote: { findMany: jest.fn() },
    newsEvent: { findMany: jest.fn() },
  },
}));

jest.mock('../services/SectorAnalysisService', () => ({
  SectorAnalysisService: { getSectorRotationData: jest.fn() },
}));

jest.mock('../services/MarketStatusService', () => ({
  marketStatusService: { getStatus: jest.fn() },
}));

const stockFindMany = prisma.stock.findMany as jest.Mock;
const stockFindUnique = prisma.stock.findUnique as jest.Mock;
const quoteFindMany = prisma.stockQuote.findMany as jest.Mock;
const newsFindMany = prisma.newsEvent.findMany as jest.Mock;
const getSectorRotationData = SectorAnalysisService.getSectorRotationData as jest.Mock;
const getMarketStatus = marketStatusService.getStatus as jest.Mock;

function dbStock(overrides: Record<string, unknown> = {}) {
  return {
    id: '2330',
    name: '台積電',
    industry: SECTORS[0]?.name ?? '半導體',
    quotes: [{ close: 100, change: 10, open: 95, high: 105, low: 94, volume: 1000 }],
    metrics: [{ pe: 20, dividendYield: 2.5 }],
    ...overrides,
  };
}

describe('StockService server paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    stockFindMany.mockResolvedValue([]);
    stockFindUnique.mockResolvedValue(null);
    quoteFindMany.mockResolvedValue([]);
    newsFindMany.mockResolvedValue([]);
    getSectorRotationData.mockResolvedValue([{ sector: '半導體' }]);
    getMarketStatus.mockResolvedValue({ status: 'Bullish' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('searches the database and maps populated and missing quote fields', async () => {
    stockFindMany.mockResolvedValueOnce([dbStock()]);
    const result = await stockService.searchStocks('2330');
    expect(result).toMatchObject([{ symbol: '2330', name: '台積電', price: 100, change: 10, volume: 1000 }]);
    expect(result[0].changePercent).toBeCloseTo(11.1111, 3);

    stockFindMany.mockResolvedValueOnce([dbStock({
      quotes: [{ close: 0, change: 0, volume: 0 }],
      metrics: [{ pe: 0, dividendYield: 0 }],
    })]);
    const emptyMetrics = await stockService.searchStocks('2330');
    expect(emptyMetrics[0]).toMatchObject({ price: 0, change: 0, changePercent: 0, volume: 0 });
    expect(emptyMetrics[0].pe).toBeUndefined();
    expect(emptyMetrics[0].dividendYield).toBeUndefined();
  });

  it('falls back to popular stocks when server search is empty or fails', async () => {
    stockFindMany.mockResolvedValueOnce([]);
    expect(await stockService.searchStocks('2330')).toEqual(
      POPULAR_STOCKS.filter((stock) => stock.symbol.toLowerCase().includes('2330') || stock.name.toLowerCase().includes('2330')).slice(0, 10),
    );

    stockFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await stockService.searchStocks('台積')).toEqual(
      POPULAR_STOCKS.filter((stock) => stock.symbol.toLowerCase().includes('台積') || stock.name.toLowerCase().includes('台積')).slice(0, 10),
    );
  });

  it('loads a stock from Prisma and falls back to mock data for missing rows or errors', async () => {
    stockFindUnique.mockResolvedValueOnce(dbStock());
    expect(await stockService.getStock('2330')).toMatchObject({ symbol: '2330', price: 100 });

    stockFindUnique.mockResolvedValueOnce(null);
    expect(await stockService.getStock('2330')).toEqual(POPULAR_STOCKS.find((stock) => stock.symbol === '2330'));

    stockFindUnique.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await stockService.getStock('2330')).toEqual(POPULAR_STOCKS.find((stock) => stock.symbol === '2330'));
  });

  it('loads sectors from the server service and returns empty data on service failure', async () => {
    expect(await stockService.getSectors()).toEqual([{ sector: '半導體' }]);
    getSectorRotationData.mockRejectedValueOnce(new Error('service unavailable'));
    expect(await stockService.getSectors()).toEqual([]);
  });

  it('uses database and mock sector results for valid and unknown sector ids', async () => {
    const sector = SECTORS[0];
    if (!sector) return;

    stockFindMany.mockResolvedValueOnce([dbStock({ industry: sector.name })]);
    expect(await stockService.getStocksBySector(sector.id)).toMatchObject([{ symbol: '2330' }]);
    expect(stockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { industry: sector.name } }));

    stockFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await stockService.getStocksBySector(sector.id)).toEqual(POPULAR_STOCKS.filter((stock) => stock.sector === sector.id));

    const callsBeforeUnknown = stockFindMany.mock.calls.length;
    expect(await stockService.getStocksBySector('unknown-sector')).toEqual([]);
    expect(stockFindMany).toHaveBeenCalledTimes(callsBeforeUnknown);
  });

  it('applies price, volume, change, valuation, and yield filters', async () => {
    const filters: StockFilter[] = [
      { minPrice: 90, maxPrice: 110, minVolume: 900, minChangePercent: 10, maxChangePercent: 12, minPE: 15, maxPE: 25, minDividendYield: 2 },
    ];
    stockFindMany.mockResolvedValue([dbStock()]);
    expect(await stockService.filterStocks(filters[0])).toHaveLength(1);

    const rejectedFilters: StockFilter[] = [
      { minPrice: 101 }, { maxPrice: 99 }, { minVolume: 1001 },
      { minChangePercent: 12 }, { maxChangePercent: 10 },
      { minPE: 21 }, { maxPE: 19 }, { minDividendYield: 3 },
    ];
    for (const filter of rejectedFilters) {
      stockFindMany.mockResolvedValueOnce([dbStock()]);
      expect(await stockService.filterStocks(filter)).toEqual([]);
    }

    stockFindMany.mockResolvedValueOnce([dbStock({ metrics: [{ pe: 0, dividendYield: 0 }] })]);
    expect(await stockService.filterStocks({ minPE: 1 })).toEqual([]);
    stockFindMany.mockResolvedValueOnce([dbStock({ metrics: [{ pe: null, dividendYield: null }] })]);
    expect(await stockService.filterStocks({ minDividendYield: 1 })).toEqual([]);
  });

  it('matches sector ids, preserves all-sector queries, and falls back after query errors', async () => {
    const sector = SECTORS[0];
    if (sector) {
      stockFindMany.mockResolvedValueOnce([dbStock({ industry: sector.name })]);
      expect(await stockService.filterStocks({ sector: sector.id })).toHaveLength(1);
    }

    stockFindMany.mockResolvedValueOnce([dbStock()]);
    await stockService.filterStocks({ sector: 'all' });
    expect(stockFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));

    stockFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await stockService.filterStocks({ sector: 'unknown-sector' })).toEqual(
      POPULAR_STOCKS.filter((stock) => stock.sector === 'unknown-sector'),
    );
  });

  it('returns popular stocks from database or fallback for empty and failed queries', async () => {
    stockFindMany.mockResolvedValueOnce([dbStock()]);
    expect(await stockService.getPopularStocks()).toMatchObject([{ symbol: '2330' }]);

    stockFindMany.mockResolvedValueOnce([]);
    expect(await stockService.getPopularStocks()).toBe(POPULAR_STOCKS);

    stockFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await stockService.getPopularStocks()).toBe(POPULAR_STOCKS);
  });

  it.each([
    ['gainers', () => stockService.getTopGainers(2)],
    ['losers', () => stockService.getTopLosers(2)],
    ['volume leaders', () => stockService.getVolumeLeaders(2)],
  ])('sorts %s by database values and falls back on errors', async (_label, call) => {
    stockFindMany.mockResolvedValueOnce([
      dbStock({ id: 'A', quotes: [{ close: 110, change: 10, volume: 10 }] }),
      dbStock({ id: 'B', quotes: [{ close: 90, change: -10, volume: 100 }] }),
    ]);
    const dbResults = await call();
    expect(dbResults).toHaveLength(2);

    stockFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await call()).toHaveLength(2);
  });

  it('uses quote history when available and generated prices when it is not', async () => {
    quoteFindMany.mockResolvedValueOnce([
      { date: new Date('2026-01-02'), open: 101, high: 105, low: 99, close: 103, volume: 10 },
      { date: new Date('2026-01-01'), open: 98, high: 102, low: 97, close: 100, volume: 20 },
    ]);
    const history = await stockService.getPriceHistory('2330', 2) as Array<Record<string, unknown>>;
    expect(history).toHaveLength(2);
    expect(history[0].close).toBe(100);

    quoteFindMany.mockResolvedValueOnce([]);
    stockFindUnique.mockResolvedValueOnce(dbStock());
    expect(await stockService.getPriceHistory('2330', 3)).toHaveLength(3);

    quoteFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    stockFindUnique.mockResolvedValueOnce(null);
    expect(await stockService.getPriceHistory('missing', 2)).toHaveLength(2);
  });

  it('maps news events with and without summaries and falls back on empty or failed queries', async () => {
    newsFindMany.mockResolvedValueOnce([
      { id: 7, publishedAt: new Date('2026-01-02T12:00:00Z'), title: 'News', summary: 'Summary' },
      { id: 8, publishedAt: new Date('2026-01-01T12:00:00Z'), title: 'No summary', summary: null },
    ]);
    expect(await stockService.getEconomicEvents()).toMatchObject([
      { id: '7', date: '2026-01-02', description: 'Summary' },
      { id: '8', description: undefined },
    ]);

    newsFindMany.mockResolvedValueOnce([]);
    const emptyResultFallback = await stockService.getEconomicEvents();
    expect(emptyResultFallback.length).toBeGreaterThan(0);
    expect(emptyResultFallback.every((event) => event.id !== '7' && event.id !== '8')).toBe(true);
    newsFindMany.mockRejectedValueOnce(new Error('database unavailable'));
    const errorResultFallback = await stockService.getEconomicEvents();
    expect(errorResultFallback.length).toBeGreaterThan(0);
    expect(errorResultFallback.every((event) => event.id !== '7' && event.id !== '8')).toBe(true);
  });

  it('maps bullish, bearish, neutral, and failed sentiment service results', async () => {
    expect(await stockService.getSentimentData()).toMatchObject({ fearGreedIndex: 75, sentiment: 'bullish', volatilityIndex: 15 });
    getMarketStatus.mockResolvedValueOnce({ status: 'Bearish' });
    expect(await stockService.getSentimentData()).toMatchObject({ fearGreedIndex: 25, sentiment: 'bearish', volatilityIndex: 25 });
    getMarketStatus.mockResolvedValueOnce({ status: 'Neutral' });
    expect(await stockService.getSentimentData()).toMatchObject({ fearGreedIndex: 45, sentiment: 'neutral', volatilityIndex: 15 });
    getMarketStatus.mockRejectedValueOnce(new Error('service unavailable'));
    expect(await stockService.getSentimentData()).toMatchObject({ fearGreedIndex: 50, sentiment: 'neutral', socialMediaBuzz: 50 });
  });

  it('returns dividend history and filters missing stocks from comparisons', async () => {
    expect(await stockService.getDividendHistory('2330')).toHaveLength(5);
    stockFindUnique.mockResolvedValueOnce(dbStock());
    stockFindUnique.mockResolvedValueOnce(null);
    expect(await stockService.getStockComparison(['2330', 'missing'])).toHaveLength(1);
  });
});
