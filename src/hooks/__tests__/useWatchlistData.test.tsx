import { act, renderHook, waitFor } from '@testing-library/react';
import { useWatchlistData } from '../useWatchlistData';
import type { Stock } from '@/lib/mockData';
import {
  DEFAULT_WATCHLIST,
  WATCHLIST_VERSION,
  type DbWatchlistItem,
  type ScreeningResult,
} from '@/types/watchlist';

const STORAGE_KEY = 'tw-stock-watchlist';
const MIGRATED_KEY = 'tw-stock-watchlist-migrated';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function makeDbItem(stockId: string, overrides: Partial<DbWatchlistItem> = {}): DbWatchlistItem {
  return {
    id: stockId === '2330' ? 1 : stockId === '2454' ? 2 : 3,
    stockId,
    name: stockId === '2330' ? 'Alpha Tech' : stockId === '2454' ? 'Beta Health' : 'Gamma Capital',
    industry: 'Technology',
    entryPrice: null,
    quantity: null,
    note: null,
    tags: null,
    currentPrice: stockId === '2330' ? 110 : stockId === '2454' ? 30 : 20,
    changePercent: 0,
    dailyChange: stockId === '2330' ? 3 : stockId === '2454' ? -2 : 1,
    weeklyChange: 2,
    volume: stockId === '2330' ? 500 : stockId === '2454' ? 900 : 100,
    volumeChange: 4,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    hasQuoteData: true,
    lastQuoteDate: '2026-01-02',
    ...overrides,
  };
}

function makeStock(symbol: string, overrides: Partial<Stock> = {}): Stock {
  return {
    symbol,
    name: `Stock ${symbol}`,
    price: 100,
    change: 1,
    changePercent: 1,
    volume: 1_000,
    ...overrides,
  };
}

function makeAnalysis(symbol: string): ScreeningResult {
  if (symbol === '2330') {
    return {
      stockId: symbol,
      name: 'Alpha Tech',
      revenueYoY: 30,
      eps: 10,
      chipStrength: 90,
      technicalScore: 80,
      reason: 'Strong data coverage',
      closePrice: 120,
      priceChangePercent: 3,
    };
  }
  if (symbol === '2454') {
    return {
      stockId: symbol,
      name: 'Beta Health',
      revenueYoY: null,
      eps: 0,
      chipStrength: 80,
      technicalScore: 80,
      reason: 'ETF scoring path',
      closePrice: 30,
      priceChangePercent: -2,
      isETF: true,
    };
  }
  return {
    stockId: symbol,
    name: 'Gamma Capital',
    revenueYoY: null,
    eps: 4,
    chipStrength: 50,
    technicalScore: 50,
    reason: 'Provided score',
    closePrice: 22,
    priceChangePercent: 1,
    calculatedScore: 92,
  };
}

interface MockServer {
  items: DbWatchlistItem[];
  calls: Array<{ url: string; method: string; body?: Record<string, unknown> }>;
  failures: Set<string>;
  fetch: jest.MockedFunction<typeof fetch>;
}

function installMockServer(initialItems: DbWatchlistItem[] = []): MockServer {
  const server: MockServer = {
    items: [...initialItems],
    calls: [],
    failures: new Set(),
    fetch: jest.fn(),
  };
  server.fetch.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method}:${url}`;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    server.calls.push({ url, method, body });

    if (server.failures.has(`${key}:throw`)) throw new Error(`network failure: ${key}`);
    if (server.failures.has(key)) return jsonResponse({}, 500);

    if (url === '/api/watchlist' && method === 'GET') {
      return jsonResponse({ data: server.items.map(item => ({ ...item })), last_updated: '2026-01-02T00:00:00.000Z' });
    }
    if (url === '/api/watchlist' && method === 'POST') {
      if (Array.isArray(body?.items)) {
        server.items = (body.items as Array<{ stockId: string; entryPrice?: number; quantity?: number }>)
          .map(item => makeDbItem(item.stockId, {
            entryPrice: item.entryPrice ?? null,
            quantity: item.quantity ?? null,
          }));
        return jsonResponse({ success: true, migrated: server.items.length, skipped: 1, errors: [] });
      }
      const stockId = String(body?.stockId ?? '9999');
      server.items.push(makeDbItem(stockId));
      return jsonResponse({ success: true });
    }
    if (url === '/api/watchlist' && method === 'PATCH') {
      server.items = server.items.map(item => item.stockId === body?.stockId
        ? { ...item, entryPrice: body.entryPrice as number, quantity: body.quantity as number }
        : item);
      return jsonResponse({ success: true });
    }
    if (url.startsWith('/api/watchlist/') && method === 'DELETE') {
      const symbol = url.split('/').at(-1);
      server.items = server.items.filter(item => item.stockId !== symbol);
      return jsonResponse({ success: true });
    }
    if (url === '/api/strategy/analyze' && method === 'POST') {
      const symbol = String(body?.symbol ?? '2330');
      if (server.failures.has(`analyze:${symbol}:throw`)) throw new Error('analysis unavailable');
      if (server.failures.has(`analyze:${symbol}`)) return jsonResponse({}, 503);
      return jsonResponse(makeAnalysis(symbol));
    }
    if (url === '/api/alpha/fusion' && method === 'POST') {
      if (server.failures.has('fusion:throw')) throw new Error('fusion unavailable');
      if (server.failures.has('fusion')) return jsonResponse({}, 503);
      const symbols = body?.symbols as string[] ?? [];
      return jsonResponse({ data: symbols.map((symbol, index) => ({
        symbol,
        alphaScore: [60, 70, 40][index] ?? 50,
        recommendationBucket: 'Watch',
        confidence: 0.8,
      })) });
    }
    if (url === '/api/portfolio/impact' && method === 'POST') {
      if (server.failures.has('impact:throw')) throw new Error('impact unavailable');
      if (server.failures.has('impact')) return jsonResponse({}, 503);
      const symbols = body?.symbols as string[] ?? [];
      return jsonResponse({ results: [...symbols.map(symbol => ({ symbol, level: 2 })), null, { symbol: '' }] });
    }
    return jsonResponse({}, 404);
  });
  global.fetch = server.fetch;
  return server;
}

describe('useWatchlistData', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('loads DB rows, overlays analysis, filters and sorts every supported key, and performs DB CRUD', async () => {
    const server = installMockServer([
      makeDbItem('2330', { entryPrice: 100, quantity: 2 }),
      makeDbItem('2454', { hasQuoteData: false, weeklyChange: 0, volumeChange: 0 }),
      makeDbItem('2317', { entryPrice: 15, quantity: 4 }),
    ]);
    const { result } = renderHook(() => useWatchlistData());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await waitFor(() => expect(result.current.analysisMap['2330']?.calculatedScore).toBe(91));

    expect(result.current.useDbSource).toBe(true);
    expect(result.current.migrationStatus).toBe('db-first');
    expect(result.current.rows.find(row => row.symbol === '2330')).toMatchObject({
      price: 120,
      changePercent: 3,
      marketValue: 240,
      costBasis: 200,
      profitLoss: 40,
      profitLossPercent: 20,
      alphaScore: 60,
      portfolioImpact: { symbol: '2330', level: 2 },
    });
    expect(result.current.rows.find(row => row.symbol === '2454')?.weeklyChange).toBeNull();
    expect(result.current.portfolioSummary).toMatchObject({
      totalValue: 328,
      totalCost: 260,
      totalPL: 68,
      stockCount: 3,
      attackCount: 2,
    });

    act(() => result.current.setSearchQuery('  beta '));
    expect(result.current.rows.map(row => row.symbol)).toEqual(['2454']);
    act(() => result.current.setSearchQuery('2330'));
    expect(result.current.rows.map(row => row.symbol)).toEqual(['2330']);
    act(() => result.current.setSearchQuery(''));

    const expectedOrders: Record<string, { desc: string[]; asc: string[] }> = {
      symbol: { desc: ['2454', '2330', '2317'], asc: ['2317', '2330', '2454'] },
      price: { desc: ['2330', '2454', '2317'], asc: ['2317', '2454', '2330'] },
      changePercent: { desc: ['2330', '2317', '2454'], asc: ['2454', '2317', '2330'] },
      volume: { desc: ['2454', '2330', '2317'], asc: ['2317', '2330', '2454'] },
      score: { desc: ['2317', '2330', '2454'], asc: ['2454', '2330', '2317'] },
      alphaScore: { desc: ['2454', '2330', '2317'], asc: ['2317', '2330', '2454'] },
    };
    for (const [key, order] of Object.entries(expectedOrders)) {
      act(() => result.current.toggleSort(key));
      expect(result.current.rows.map(row => row.symbol)).toEqual(order.desc);
      act(() => result.current.toggleSort(key));
      expect(result.current.rows.map(row => row.symbol)).toEqual(order.asc);
    }
    act(() => result.current.toggleSort('unsupported'));
    expect(result.current.rows.map(row => row.symbol)).toEqual(['2330', '2454', '2317']);

    const callsBeforeDuplicate = server.calls.length;
    await act(async () => result.current.addStock(makeStock('2330')));
    expect(server.calls).toHaveLength(callsBeforeDuplicate);

    await act(async () => result.current.addStock(makeStock('9999')));
    await waitFor(() => expect(result.current.watchlist.some(item => item.symbol === '9999')).toBe(true));
    await act(async () => result.current.updateHoldings('2454', 20, 5));
    expect(result.current.watchlist.find(item => item.symbol === '2454')).toMatchObject({ avgCost: 20, quantity: 5 });
    await act(async () => result.current.removeStock('2317'));
    expect(result.current.watchlist.some(item => item.symbol === '2317')).toBe(false);
  });

  it('migrates saved local holdings to DB and reports skipped records', async () => {
    const localItems = [
      { ...makeStock('2330'), avgCost: 100, quantity: 2 },
      { ...makeStock('2454'), avgCost: 200, quantity: 1 },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems));
    const server = installMockServer();
    const { result } = renderHook(() => useWatchlistData());

    await waitFor(() => expect(result.current.migrationStatus).toBe('completed'));
    expect(result.current.useDbSource).toBe(true);
    expect(result.current.watchlist.map(item => item.symbol)).toEqual(['2330', '2454']);
    expect(result.current.migrationMessage).toContain('略過');
    expect(localStorage.getItem(MIGRATED_KEY)).toBe('true');
    expect(server.calls.some(call => call.method === 'POST' && Array.isArray(call.body?.items))).toBe(true);
  });

  it('falls back to localStorage when it was already migrated, and keeps local CRUD persisted', async () => {
    const original = { ...makeStock('2330'), avgCost: 90, quantity: 3 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([original]));
    localStorage.setItem(MIGRATED_KEY, 'true');
    installMockServer();
    const { result } = renderHook(() => useWatchlistData());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.useDbSource).toBe(false);
    expect(result.current.migrationStatus).toBe('db-first');
    expect(result.current.watchlist).toHaveLength(1);
    expect(result.current.watchlist[0]).toMatchObject({ symbol: '2330', avgCost: 90, quantity: 3, price: 120 });
    await act(async () => result.current.addStock(makeStock('2454')));
    await act(async () => result.current.updateHoldings('2330', 95, 4));
    await act(async () => result.current.removeStock('2454'));

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<{ symbol: string; avgCost?: number; quantity?: number }>;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ symbol: '2330', avgCost: 95, quantity: 4 });
    await act(async () => result.current.addStock(makeStock('2330')));
    expect(result.current.watchlist).toHaveLength(1);
  });

  it('shows local data after a failed migration and handles failed analysis, fusion, and impact requests', async () => {
    const local = makeStock('2330');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([local]));
    const server = installMockServer();
    server.failures.add('POST:/api/watchlist:throw');
    server.failures.add('analyze:2330:throw');
    server.failures.add('fusion:throw');
    server.failures.add('impact:throw');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useWatchlistData());
    await waitFor(() => expect(result.current.migrationStatus).toBe('failed'));
    expect(result.current.useDbSource).toBe(false);
    expect(result.current.rows.map(row => row.symbol)).toEqual(['2330']);
    expect(result.current.migrationMessage).toContain('資料庫連線失敗');
    await act(async () => result.current.refreshAnalysis());
    expect(result.current.analysisMap).toEqual({});
    expect(result.current.isAnalyzing).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('seeds the default list for an empty user and saves the versioned local backup', async () => {
    const server = installMockServer();
    const { result } = renderHook(() => useWatchlistData());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.useDbSource).toBe(true);
    expect(result.current.migrationStatus).toBe('db-first');
    expect(result.current.watchlist).toHaveLength(DEFAULT_WATCHLIST.length);
    expect(localStorage.getItem(MIGRATED_KEY)).toBe('true');
    expect(localStorage.getItem('tw-stock-watchlist-version')).toBe(WATCHLIST_VERSION);
    expect(server.items).toHaveLength(DEFAULT_WATCHLIST.length);
  });

  it('uses default local data when seeding fails and preserves the backup', async () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    const server = installMockServer();
    server.failures.add('POST:/api/watchlist:throw');
    const { result } = renderHook(() => useWatchlistData());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(result.current.useDbSource).toBe(false);
    expect(result.current.migrationStatus).toBe('failed');
    expect(result.current.migrationMessage).toContain('預設清單');
    expect(result.current.watchlist.map(item => item.symbol)).toEqual(DEFAULT_WATCHLIST.map(item => item.symbol));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(DEFAULT_WATCHLIST);
    expect(server.items).toHaveLength(0);
  });
});
