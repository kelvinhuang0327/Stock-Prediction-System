jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    watchlist: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stock: { findUnique: jest.fn() },
    stockQuote: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/cache', () => ({
  apiCache: { get: jest.fn().mockReturnValue(null), set: jest.fn(), invalidate: jest.fn() },
}));

jest.mock('@/lib/fundamentals/FundamentalResearchService', () => ({
  buildFundamentalResearchContextForSymbol: jest.fn().mockResolvedValue({ overlay: { riskLevel: 'low', summary: 'covered' } }),
}));

import { prisma } from '@/lib/prisma';
import { apiCache } from '@/lib/cache';
import { buildFundamentalResearchContextForSymbol } from '@/lib/fundamentals/FundamentalResearchService';
import { GET, PATCH, POST } from '../route';

const mockedPrisma = prisma as unknown as {
  watchlist: { findMany: jest.Mock; upsert: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  stock: { findUnique: jest.Mock };
  stockQuote: { findFirst: jest.Mock };
};
const mockedCache = apiCache as unknown as { get: jest.Mock; set: jest.Mock; invalidate: jest.Mock };
const mockedFundamentals = buildFundamentalResearchContextForSymbol as jest.MockedFunction<typeof buildFundamentalResearchContextForSymbol>;

function requestWithBody(body: unknown): Request {
  return { json: async () => body } as Request;
}

describe('/api/watchlist routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.get.mockReturnValue(null);
    mockedPrisma.watchlist.findMany.mockResolvedValue([]);
    mockedPrisma.watchlist.upsert.mockResolvedValue({ id: 1, stockId: '2330' });
    mockedPrisma.watchlist.findUnique.mockResolvedValue({ stockId: '2330' });
    mockedPrisma.watchlist.update.mockResolvedValue({ stockId: '2330', note: 'updated' });
    mockedPrisma.stock.findUnique.mockResolvedValue({ id: '2330' });
    mockedPrisma.stockQuote.findFirst.mockResolvedValue(null);
    mockedFundamentals.mockResolvedValue({ overlay: { riskLevel: 'low', summary: 'covered' } } as never);
  });

  it('returns a cached watchlist without querying Prisma', async () => {
    const cached = { data: [{ stockId: '2330' }], sample_size: 1 };
    mockedCache.get.mockReturnValue(cached);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBe(cached);
    expect(mockedPrisma.watchlist.findMany).not.toHaveBeenCalled();
  });

  it('formats quote changes, applies fundamental overlays, and degrades failed overlays', async () => {
    mockedPrisma.watchlist.findMany.mockResolvedValue([
      {
        id: 1,
        stockId: '2330',
        stock: {
          name: 'TSMC', industry: null,
          quotes: [
            { close: 110, volume: 300, date: '2026-11-10' },
            { close: 100, volume: 200, date: '2026-11-09' },
            { close: 80, volume: 100, date: '2026-11-03' },
          ],
        },
        entryPrice: 100, quantity: 2, note: 'hold', tags: ['core'], addedAt: 'a', updatedAt: 'b',
      },
      {
        id: 2,
        stockId: '2317',
        stock: { name: 'Hon Hai', industry: 'Tech', quotes: [] },
        entryPrice: null, quantity: null, note: null, tags: [], addedAt: 'c', updatedAt: 'd',
      },
    ]);
    mockedPrisma.stockQuote.findFirst.mockResolvedValue({ date: '2026-11-10' });
    mockedFundamentals.mockImplementation(async ({ symbol }) => {
      if (symbol === '2317') throw new Error('fundamental source unavailable');
      return { overlay: { riskLevel: 'low', summary: 'healthy' } } as never;
    });

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({ sample_size: 2, last_updated: '2026-11-10', coverage: { total: 2, withQuotes: 1 } });
    expect(body.data[0]).toMatchObject({
      stockId: '2330', name: 'TSMC', industry: '', currentPrice: 110,
      changePercent: 10, dailyChange: 10, weeklyChange: 37.5, volume: 300, volumeChange: 100,
      hasQuoteData: true, lastQuoteDate: '2026-11-10', fundamentalOverlay: { summary: 'healthy' },
    });
    expect(body.data[1]).toMatchObject({
      stockId: '2317', currentPrice: 0, changePercent: 0, dailyChange: 0, weeklyChange: 0,
      volume: 0, volumeChange: 0, hasQuoteData: false, lastQuoteDate: null,
      fundamentalOverlay: { riskLevel: 'unknown', limitations: ['基本面 overlay 建立失敗，已降級。'] },
    });
    expect(mockedCache.set).toHaveBeenCalledWith('watchlist:list', body, 120);
  });

  it('returns an empty cached response when the database has no watchlist rows', async () => {
    const response = await GET();
    const body = await response.json();
    expect(body).toMatchObject({ data: [], sample_size: 0, last_updated: null, coverage: { total: 0, withQuotes: 0 } });
    expect(mockedFundamentals).not.toHaveBeenCalled();
  });

  it('returns a safe 500 response when watchlist retrieval fails', async () => {
    mockedPrisma.watchlist.findMany.mockRejectedValue(new Error('database offline'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ data: [], coverage: { total: 0, withQuotes: 0 } });
    expect(errorSpy).toHaveBeenCalledWith('Watchlist GET error:', expect.any(Error));
  });

  it('bulk-imports known stocks and reports missing rows and per-item failures', async () => {
    mockedPrisma.stock.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'missing') return null;
      if (where.id === 'broken') throw new Error('lookup failed');
      return { id: where.id };
    });

    const response = await POST(requestWithBody({ items: [
      {},
      { stockId: 'missing' },
      { stockId: '2330', entryPrice: 100 },
      { stockId: 'broken' },
    ] }));

    await expect(response.json()).resolves.toEqual({
      success: true,
      migrated: 1,
      skipped: 2,
      errors: ['missing: 股票不存在於資料庫', 'broken: lookup failed'],
    });
    expect(mockedPrisma.watchlist.upsert).toHaveBeenCalledTimes(1);
    expect(mockedCache.invalidate).toHaveBeenCalledWith('watchlist:');
  });

  it('rejects a missing single stock ID and upserts a valid single item', async () => {
    await expect((await POST(requestWithBody({ items: 'not-an-array' }))).json()).resolves.toEqual({ error: 'Stock ID is required' });
    const response = await POST(requestWithBody({ stockId: '2330', entryPrice: 0, quantity: 0, note: '' }));
    await expect(response.json()).resolves.toEqual({ id: 1, stockId: '2330' });
    expect(mockedPrisma.watchlist.upsert).toHaveBeenCalledWith({
      where: { stockId: '2330' },
      update: { entryPrice: 0, quantity: 0, note: '' },
      create: { stockId: '2330', entryPrice: 0, quantity: 0, note: '' },
    });
    expect(mockedCache.invalidate).toHaveBeenCalledWith('watchlist:');
  });

  it('converts malformed POST bodies and database errors into safe responses', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(await POST({ json: async () => { throw new Error('bad JSON'); } } as unknown as Request)).toMatchObject({ status: 500 });

    mockedPrisma.watchlist.upsert.mockRejectedValue(new Error('database unavailable'));
    const response = await POST(requestWithBody({ stockId: '2330' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to add to watchlist' });
    expect(errorSpy).toHaveBeenCalledWith('Watchlist POST error:', expect.any(Error));
  });

  it('validates PATCH fields, updates only provided values, and handles missing records', async () => {
    await expect((await PATCH(requestWithBody({ note: 'missing symbol' }))).json()).resolves.toEqual({ error: 'Stock ID is required' });

    mockedPrisma.watchlist.findUnique.mockResolvedValue(null);
    const missing = await PATCH(requestWithBody({ stockId: '9999' }));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: 'Stock not in watchlist' });

    mockedPrisma.watchlist.findUnique.mockResolvedValue({ stockId: '2330' });
    const response = await PATCH(requestWithBody({ stockId: '2330', note: 'updated', tags: ['core'] }));
    await expect(response.json()).resolves.toEqual({ stockId: '2330', note: 'updated' });
    expect(mockedPrisma.watchlist.update).toHaveBeenCalledWith({
      where: { stockId: '2330' },
      data: { note: 'updated', tags: ['core'] },
    });
    expect(mockedCache.invalidate).toHaveBeenCalledWith('watchlist:');
  });

  it('returns safe PATCH errors for invalid JSON and database failures', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(await PATCH({ json: async () => { throw new Error('bad JSON'); } } as unknown as Request)).toMatchObject({ status: 500 });

    mockedPrisma.watchlist.update.mockRejectedValue(new Error('write failed'));
    const response = await PATCH(requestWithBody({ stockId: '2330', entryPrice: 100 }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to update watchlist item' });
    expect(errorSpy).toHaveBeenCalledWith('Watchlist PATCH error:', expect.any(Error));
  });
});
