/** @jest-environment node */

export {};

const mockStockCount = jest.fn();
const mockQuoteFindFirst = jest.fn();
const mockQuoteFindMany = jest.fn();
const mockQuoteGroupBy = jest.fn();
const mockIndexFindMany = jest.fn();
const mockChipFindFirst = jest.fn();
const mockChipFindMany = jest.fn();
const mockChipGroupBy = jest.fn();
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stock: { count: (...args: unknown[]) => mockStockCount(...args) },
    stockQuote: {
      findFirst: (...args: unknown[]) => mockQuoteFindFirst(...args),
      findMany: (...args: unknown[]) => mockQuoteFindMany(...args),
      groupBy: (...args: unknown[]) => mockQuoteGroupBy(...args),
    },
    marketIndex: { findMany: (...args: unknown[]) => mockIndexFindMany(...args) },
    institutionalChip: {
      findFirst: (...args: unknown[]) => mockChipFindFirst(...args),
      findMany: (...args: unknown[]) => mockChipFindMany(...args),
      groupBy: (...args: unknown[]) => mockChipGroupBy(...args),
    },
  },
}));
jest.mock('@/lib/cache', () => ({
  apiCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
  },
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/rankings${query}`);
}

function chip(
  stockId: string,
  date: string,
  amounts: { foreignBuy?: number; trustBuy?: number; dealerBuy?: number; totalBuy?: number },
  stock?: { name: string; industry: string; quotes?: Array<{ close: number; change: number; volume: number }> },
) {
  return {
    stockId,
    date,
    foreignBuy: amounts.foreignBuy ?? 0,
    trustBuy: amounts.trustBuy ?? 0,
    dealerBuy: amounts.dealerBuy ?? 0,
    totalBuy: amounts.totalBuy ?? 0,
    ...(stock ? { stock } : {}),
  };
}

function quote(
  stockId: string,
  date: string,
  values: { close: number; change: number | null; volume: number | null },
  stock?: { name: string; industry: string },
) {
  return { stockId, date, ...values, stock };
}

describe('GET /api/rankings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockReturnValue(null);
    mockCacheSet.mockImplementation(() => undefined);
    mockStockCount.mockResolvedValue(10);
    mockQuoteFindFirst.mockResolvedValue({ date: '2026-03-03' });
    mockQuoteFindMany.mockResolvedValue([]);
    mockQuoteGroupBy.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({ stockId: `S${index}` })));
    mockIndexFindMany.mockResolvedValue([]);
    mockChipFindFirst.mockResolvedValue({ date: '2026-03-03' });
    mockChipFindMany.mockResolvedValue([]);
    mockChipGroupBy.mockImplementation(({ by }: { by: string[] }) => (
      Promise.resolve(by[0] === 'stockId'
        ? Array.from({ length: 8 }, (_, index) => ({ stockId: `S${index}` }))
        : [{ date: '2026-03-03' }, { date: '2026-03-02' }])
    ));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cached results without touching the data stores', async () => {
    mockCacheGet.mockReturnValue({ source: 'cached', data: [] });

    const response = await GET(request('?type=volume&sector=tech&limit=5'));

    await expect(response.json()).resolves.toEqual({ source: 'cached', data: [] });
    expect(mockCacheGet).toHaveBeenCalledWith('rankings:volume:tech:5');
    expect(mockStockCount).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('groups latest institutional rows and ranks foreign buying with optional stock data', async () => {
    mockChipFindMany.mockResolvedValue([
      chip('AAA', '2026-03-03', { foreignBuy: 10, trustBuy: 5, dealerBuy: -2, totalBuy: 13 }, {
        name: 'Alpha', industry: 'Semiconductor', quotes: [{ close: 120, change: 2, volume: 3000 }],
      }),
      chip('AAA', '2026-03-02', { foreignBuy: 999, trustBuy: 999, dealerBuy: 999, totalBuy: 2997 }),
      chip('BBB', '2026-03-03', { foreignBuy: 20, trustBuy: -4, dealerBuy: 7, totalBuy: 23 }, {
        name: 'Beta', industry: 'Banking', quotes: [],
      }),
      chip('CCC', '2026-03-03', { foreignBuy: -5, trustBuy: 8, dealerBuy: 1, totalBuy: 4 }),
    ]);

    const response = await GET(request('?type=foreign&sector=semi&limit=2'));
    const body = await response.json();

    expect(body).toMatchObject({
      source: 'database',
      type: 'foreign',
      sample_size: 2,
      last_updated: '2026-03-03',
      data: [
        { symbol: 'BBB', name: 'Beta', industry: 'Banking', price: null, change: null, volume: null, foreignBuy: 20 },
        { symbol: 'AAA', name: 'Alpha', industry: 'Semiconductor', price: 120, change: 2, volume: 3000, foreignBuy: 10 },
      ],
      coverage: { stocks: 8, total: 10, dates: 2, limitations: [] },
    });
    expect(mockChipFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { stock: { industry: { contains: 'semi' } } },
      take: 200,
    }));
    expect(mockChipGroupBy).toHaveBeenCalledTimes(2);
    expect(mockCacheSet).toHaveBeenCalledWith('rankings:foreign:semi:2', body, 180);
  });

  it.each([
    ['trust', 'trustBuy', 'trustBuy'],
    ['dealer', 'dealerBuy', 'dealerBuy'],
  ])('uses %s buying as the institutional sort key', async (type, expectedKey, property) => {
    mockChipFindMany.mockResolvedValue([
      chip('AAA', '2026-03-03', { foreignBuy: 100, trustBuy: 1, dealerBuy: 1 }),
      chip('BBB', '2026-03-03', { foreignBuy: 0, trustBuy: 5, dealerBuy: 2 }),
    ]);

    const response = await GET(request(`?type=${type}`));
    const body = await response.json();

    expect(body.data[0].symbol).toBe('BBB');
    expect(body.data[0][property]).toBe(type === 'trust' ? 5 : 2);
    expect(mockChipFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { date: 'desc' } }));
    expect(property).toBe(expectedKey);
  });

  it.each([
    ['volume', ['BBB', 'CCC', 'AAA']],
    ['gainers', ['CCC', 'AAA', 'BBB']],
    ['losers', ['BBB', 'AAA', 'CCC']],
  ])('ranks latest quotes by %s and falls back to the symbol for missing stock metadata', async (type, expectedSymbols) => {
    mockQuoteFindMany.mockResolvedValue([
      quote('AAA', '2026-03-03', { close: 100, change: 3, volume: 200 }, { name: 'Alpha', industry: 'Tech' }),
      quote('AAA', '2026-03-02', { close: 95, change: 99, volume: 999 }),
      quote('BBB', '2026-03-03', { close: 50, change: -5, volume: 500 }, { name: 'Beta', industry: '' }),
      quote('CCC', '2026-03-03', { close: 75, change: 7, volume: 300 }),
    ]);

    const response = await GET(request(`?type=${type}&limit=3`));
    const body = await response.json();

    expect(body.data.map((row: { symbol: string }) => row.symbol)).toEqual(expectedSymbols);
    expect(body.data.find((row: { symbol: string }) => row.symbol === 'CCC')).toMatchObject({
      name: 'CCC', industry: '', price: 75, change: 7, volume: 300,
      foreignBuy: null, trustBuy: null, dealerBuy: null, totalBuy: null,
    });
    expect(mockQuoteFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500, include: { stock: true } }));
    expect(body.coverage).toMatchObject({ stocks: 8, total: 10, limitations: [] });
  });

  it('builds sector rows from the latest index per name and computes missing percentages safely', async () => {
    mockIndexFindMany.mockResolvedValue([
      { name: 'Tech', date: '2026-03-03', value: 1200, change: 12, changePercent: null },
      { name: 'Tech', date: '2026-03-02', value: 1000, change: 10, changePercent: 1 },
      { name: 'Bank', date: '2026-03-03', value: 0, change: -3, changePercent: null },
      { name: 'TAIEX', date: '2026-03-03', value: 20000, change: 50, changePercent: 0.25 },
      { name: '發行量加權股價指數', date: '2026-03-03', value: 20000, change: 50, changePercent: 0.25 },
    ]);

    const response = await GET(request('?type=sector&limit=10'));
    const body = await response.json();

    expect(body).toMatchObject({ source: 'database', type: 'sector', sample_size: 2 });
    expect(body.data).toEqual([
      expect.objectContaining({ symbol: 'Tech', price: 1200, change: 12, changePercent: 1 }),
      expect.objectContaining({ symbol: 'Bank', price: 0, change: -3, changePercent: null }),
    ]);
    expect(body.data.every((row: { volume: unknown; stockCount: unknown }) => row.volume === null && row.stockCount === null)).toBe(true);
  });

  it('returns empty results for unknown types or a sector with no index rows', async () => {
    const unknown = await GET(request('?type=sentiment'));
    await expect(unknown.json()).resolves.toMatchObject({ source: 'empty', data: [], sample_size: 0, type: 'sentiment' });

    mockIndexFindMany.mockResolvedValue([]);
    const sector = await GET(request('?type=sector'));
    await expect(sector.json()).resolves.toMatchObject({ source: 'empty', data: [], last_updated: '2026-03-03' });
  });

  it('reports low data coverage for institutional and quote sources', async () => {
    mockStockCount.mockResolvedValue(20);
    mockChipGroupBy.mockImplementation(({ by }: { by: string[] }) => (
      Promise.resolve(by[0] === 'stockId' ? [{ stockId: 'AAA' }] : [])
    ));
    mockQuoteGroupBy.mockResolvedValue([{ stockId: 'AAA' }]);

    const institutional = await GET(request('?type=trust'));
    const stock = await institutional.json();
    expect(stock.coverage).toMatchObject({ stocks: 1, total: 20, dates: 0 });
    expect(stock.coverage.limitations).toEqual([
      '資料覆蓋率不足，排行榜僅基於目前可用樣本 (1/20 檔)',
    ]);

    const quoteBased = await GET(request('?type=volume'));
    const quoteBody = await quoteBased.json();
    expect(quoteBody.coverage).toMatchObject({ stocks: 1, total: 20 });
    expect(quoteBody.coverage.limitations[0]).toContain('(1/20 檔)');
  });

  it('returns a safe empty response when the ranking query fails', async () => {
    mockChipFindMany.mockRejectedValue(new Error('database unavailable'));

    const response = await GET(request('?type=foreign'));
    const body = await response.json();

    expect(body).toMatchObject({
      data: [], source: 'error', type: 'foreign', sample_size: 0,
      last_updated: null, coverage: { stocks: 0, total: 0, limitations: ['資料庫查詢失敗'] },
    });
    expect(console.error).toHaveBeenCalledWith('Rankings API error:', expect.any(Error));
  });

  it('keeps an empty list when the last-updated lookup itself fails', async () => {
    mockChipFindFirst.mockRejectedValue(new Error('latest row unavailable'));

    const response = await GET(request('?type=foreign'));
    const body = await response.json();

    expect(body.source).toBe('empty');
    expect(body.last_updated).toBeNull();
  });

  it('defaults to foreign buying and tolerates null dates and quote sort values', async () => {
    mockChipFindFirst.mockResolvedValue(null);

    const defaultResponse = await GET(request());
    const defaultBody = await defaultResponse.json();
    expect(defaultBody.type).toBe('foreign');
    expect(defaultBody.last_updated).toBeNull();

    mockQuoteFindFirst.mockResolvedValue(null);
    mockQuoteFindMany.mockResolvedValue([
      quote('AAA', '2026-03-03', { close: 10, change: null, volume: null }),
      quote('BBB', '2026-03-03', { close: 20, change: null, volume: null }),
    ]);
    const quoteResponse = await GET(request('?type=volume'));
    const quoteBody = await quoteResponse.json();

    expect(quoteBody.last_updated).toBeNull();
    expect(quoteBody.data.map((row: { symbol: string }) => row.symbol)).toEqual(['AAA', 'BBB']);
  });
});
