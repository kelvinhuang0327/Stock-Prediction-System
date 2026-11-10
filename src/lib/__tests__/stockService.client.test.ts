/** @jest-environment jsdom */

import { stockService } from '../stockService.client';
import { POPULAR_STOCKS } from '../mockData';

describe('StockService client paths', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('maps successful client search results and handles zero or equal price changes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { code: '2330', name: '台積電', price: 110, change: 10, volume: 100, industry: '半導體', pe: 20, yield: 2.5 },
        { code: '0000', name: '零值', price: 0, change: 0, volume: 0 },
        { code: '1111', name: '相等', price: 10, change: 10 },
      ] }),
    });

    const result = await stockService.searchStocks('台積');

    expect(global.fetch).toHaveBeenCalledWith('/api/stocks?search=%E5%8F%B0%E7%A9%8D&limit=10');
    expect(result).toMatchObject([
      { symbol: '2330', changePercent: 10, industry: '半導體', pe: 20, dividendYield: 2.5 },
      { symbol: '0000', price: 0, change: 0, changePercent: 0, volume: 0 },
      { symbol: '1111', price: 10, change: 10, changePercent: 0, volume: 0 },
    ]);
  });

  it('falls back to mock search when the API is unsuccessful or throws', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect(await stockService.searchStocks('2330')).toEqual(
      expect.arrayContaining([expect.objectContaining({ symbol: '2330' })]),
    );

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network unavailable'));
    expect(await stockService.searchStocks('台積')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: expect.stringContaining('台積') })]),
    );
  });

  it('loads sectors from the API and uses an empty fallback for failed responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'semiconductors' }] });
    expect(await stockService.getSectors()).toEqual([{ id: 'semiconductors' }]);
    expect(global.fetch).toHaveBeenLastCalledWith('/api/sectors');

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect(await stockService.getSectors()).toEqual([]);

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network unavailable'));
    expect(await stockService.getSectors()).toEqual([]);
  });

  it('provides browser-safe stock and market fallbacks without importing Prisma', async () => {
    expect(await stockService.getStock('2330')).toMatchObject({ symbol: '2330' });
    expect(await stockService.getStock('missing')).toBeNull();

    expect(await stockService.getStocksBySector('semiconductor')).toHaveLength(4);
    expect(await stockService.filterStocks({})).toHaveLength(POPULAR_STOCKS.length);
    expect(await stockService.filterStocks({ sector: 'semiconductor' })).toHaveLength(4);
    expect(await stockService.filterStocks({ sector: 'missing' })).toEqual([]);

    const leaders = await stockService.getVolumeLeaders();
    expect(leaders).toHaveLength(10);
    expect(leaders[0].volume).toBeGreaterThanOrEqual(leaders[1].volume);
    expect(await stockService.getVolumeLeaders(2)).toHaveLength(2);
    expect(await stockService.getPopularStocks()).toBe(POPULAR_STOCKS);
    expect(await stockService.getTopGainers()).toHaveLength(10);
    expect(await stockService.getTopLosers()).toHaveLength(10);
    expect(await stockService.getTopLosers(2)).toHaveLength(2);

    expect(await stockService.getEconomicEvents()).toEqual(expect.any(Array));
    expect(await stockService.getMarketBreadth()).toMatchObject({ advancing: 892, declining: 543 });
    expect(await stockService.getForeignInvestorData()).toMatchObject({ trend: 'buying' });
    expect(await stockService.getSentimentData()).toMatchObject({ fearGreedIndex: 75, sentiment: 'bullish' });
    expect(await stockService.getPriceHistory('2330')).toHaveLength(60);
    expect(await stockService.getPriceHistory('2330', 3)).toHaveLength(3);
    expect(await stockService.getPriceHistory('missing', 2)).toHaveLength(2);
  });
});
