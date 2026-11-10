/** @jest-environment jsdom */

import { stockService } from '../stockService';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    stock: { findMany: jest.fn(), findUnique: jest.fn() },
    stockQuote: { findMany: jest.fn() },
    newsEvent: { findMany: jest.fn() },
  },
}));

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
    expect(prisma.stock.findMany).not.toHaveBeenCalled();
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
});
