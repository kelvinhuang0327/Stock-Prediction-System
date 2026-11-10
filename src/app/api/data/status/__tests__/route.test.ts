import { GET } from '../route';
import { prisma } from '@/lib/prisma';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
        json: async () => JSON.parse(JSON.stringify(body)) as unknown,
    }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stock: { count: jest.fn() },
    stockQuote: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
    institutionalChip: { count: jest.fn(), groupBy: jest.fn() },
    monthlyRevenue: { count: jest.fn(), groupBy: jest.fn() },
    stockMetrics: { count: jest.fn() },
    marketIndex: { count: jest.fn() },
    financialReport: { count: jest.fn() },
    newsEvent: { count: jest.fn() },
    prediction: { count: jest.fn() },
    doublingFeatures: { count: jest.fn() },
    strategySignal: { count: jest.fn() },
  },
}));

type MockPrisma = {
  stock: { count: jest.Mock };
  stockQuote: { count: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
  institutionalChip: { count: jest.Mock; groupBy: jest.Mock };
  monthlyRevenue: { count: jest.Mock; groupBy: jest.Mock };
  stockMetrics: { count: jest.Mock };
  marketIndex: { count: jest.Mock };
  financialReport: { count: jest.Mock };
  newsEvent: { count: jest.Mock };
  prediction: { count: jest.Mock };
  doublingFeatures: { count: jest.Mock };
  strategySignal: { count: jest.Mock };
};

const db = prisma as unknown as MockPrisma;

type Source = { id: string; grade: string; usable: boolean; stockCount: number; dateRange: { min: string; max: string } | null; rowCount: number };
type Feature = { mode: 'full' | 'limited' | 'unavailable'; missing: string[] };
type DataStatusBody = {
  sources: Source[];
  features: { rankings: Feature; institutional: Feature; signals: Feature; backtest: Feature; watchlist: Feature };
  summary: { total: number };
  error?: string;
};

function rows(count: number) {
  return Array.from({ length: count }, (_, index) => ({ stockId: `stock-${index}` }));
}

async function readResponse() {
  const response = await GET();
  return { status: response.status, body: await response.json() as DataStatusBody };
}

describe('GET /api/data/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.stock.count.mockResolvedValue(0);
    db.stockQuote.count.mockResolvedValue(0);
    db.stockQuote.groupBy.mockResolvedValue([]);
    db.stockQuote.aggregate.mockResolvedValue({ _min: { date: null }, _max: { date: null } });
    db.institutionalChip.count.mockResolvedValue(0);
    db.institutionalChip.groupBy.mockResolvedValue([]);
    db.monthlyRevenue.count.mockResolvedValue(0);
    db.monthlyRevenue.groupBy.mockResolvedValue([]);
    db.stockMetrics.count.mockResolvedValue(0);
    db.marketIndex.count.mockResolvedValue(0);
    db.financialReport.count.mockResolvedValue(0);
    db.newsEvent.count.mockResolvedValue(0);
    db.prediction.count.mockResolvedValue(0);
    db.doublingFeatures.count.mockResolvedValue(0);
    db.strategySignal.count.mockResolvedValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports high-coverage source grades, date ranges, and fully available features', async () => {
    db.stock.count.mockResolvedValue(101);
    db.stockQuote.count.mockResolvedValue(100);
    db.stockQuote.groupBy.mockResolvedValue(rows(50));
    db.stockQuote.aggregate.mockResolvedValue({
      _min: { date: new Date('2025-01-01T00:00:00Z') },
      _max: { date: new Date('2026-01-01T00:00:00Z') },
    });
    db.institutionalChip.count.mockResolvedValue(1);
    db.institutionalChip.groupBy.mockResolvedValue(rows(20));
    db.monthlyRevenue.count.mockResolvedValue(1);
    db.monthlyRevenue.groupBy.mockResolvedValue(rows(500));
    db.stockMetrics.count.mockResolvedValue(1000);
    db.marketIndex.count.mockResolvedValue(100);
    db.financialReport.count.mockResolvedValue(50);
    db.newsEvent.count.mockResolvedValue(1);
    db.prediction.count.mockResolvedValue(1);
    db.doublingFeatures.count.mockResolvedValue(1);
    db.strategySignal.count.mockResolvedValue(1);

    const { status, body } = await readResponse();
    expect(status).toBe(200);
    expect(body.sources.find((source) => source.id === 'stock_master')).toMatchObject({ grade: 'A', usable: true });
    expect(body.sources.find((source) => source.id === 'stock_quote')).toMatchObject({
      grade: 'A', stockCount: 50, dateRange: { min: '2025-01-01T00:00:00.000Z', max: '2026-01-01T00:00:00.000Z' },
    });
    expect(body.sources.find((source) => source.id === 'institutional_chip')?.grade).toBe('B');
    expect(body.sources.find((source) => source.id === 'monthly_revenue')?.grade).toBe('A');
    expect(body.features).toEqual({
      rankings: { mode: 'full', missing: [] },
      institutional: { mode: 'full', missing: [] },
      signals: { mode: 'full', missing: [] },
      backtest: { mode: 'full', missing: [] },
      watchlist: { mode: 'full', missing: [] },
    });
    expect(body.summary.total).toBe(11);
  });

  it('uses intermediate grades at the source thresholds', async () => {
    db.stock.count.mockResolvedValue(100);
    db.stockQuote.count.mockResolvedValue(1);
    db.stockQuote.groupBy.mockResolvedValue(rows(10));
    db.stockQuote.aggregate.mockResolvedValue({ _min: { date: null }, _max: { date: null } });
    db.institutionalChip.count.mockResolvedValue(1);
    db.institutionalChip.groupBy.mockResolvedValue(rows(19));
    db.monthlyRevenue.count.mockResolvedValue(1);
    db.monthlyRevenue.groupBy.mockResolvedValue(rows(1));
    db.stockMetrics.count.mockResolvedValue(999);
    db.marketIndex.count.mockResolvedValue(99);
    db.financialReport.count.mockResolvedValue(49);

    const { body } = await readResponse();
    const source = (id: string) => body.sources.find((item) => item.id === id);
    expect(source('stock_master')?.grade).toBe('B');
    expect(source('stock_quote')?.grade).toBe('B');
    expect(source('stock_quote')?.dateRange).toEqual({ min: '', max: '' });
    expect(source('institutional_chip')?.grade).toBe('C');
    expect(source('monthly_revenue')?.grade).toBe('B');
    expect(source('stock_metrics')?.grade).toBe('C');
    expect(source('market_index')?.grade).toBe('C');
    expect(source('financial_report')?.grade).toBe('C');
  });

  it('reports low but usable sources as grade C', async () => {
    db.stock.count.mockResolvedValue(1);
    db.stockQuote.count.mockResolvedValue(1);
    db.stockQuote.groupBy.mockResolvedValue(rows(1));
    db.institutionalChip.count.mockResolvedValue(1);
    db.institutionalChip.groupBy.mockResolvedValue(rows(1));
    db.monthlyRevenue.count.mockResolvedValue(1);
    db.monthlyRevenue.groupBy.mockResolvedValue(rows(1));
    db.stockMetrics.count.mockResolvedValue(1);
    db.marketIndex.count.mockResolvedValue(1);
    db.financialReport.count.mockResolvedValue(1);

    const { body } = await readResponse();
    const source = (id: string) => body.sources.find((item) => item.id === id);
    expect(source('stock_quote')?.grade).toBe('C');
    expect(source('institutional_chip')?.grade).toBe('C');
    expect(source('stock_metrics')?.grade).toBe('C');
    expect(source('market_index')?.grade).toBe('C');
    expect(source('financial_report')?.grade).toBe('C');
  });

  it('marks missing critical data unavailable and optional gaps limited', async () => {
    db.stock.count.mockResolvedValue(1);
    db.stockQuote.count.mockResolvedValue(3);
    db.stockQuote.groupBy.mockResolvedValue([]);
    db.institutionalChip.count.mockResolvedValue(1);
    db.institutionalChip.groupBy.mockResolvedValue(rows(1));

    const { body } = await readResponse();
    expect(body.features.rankings).toEqual({ mode: 'limited', missing: ['stock_quote'] });
    expect(body.features.institutional).toEqual({ mode: 'full', missing: [] });
    expect(body.features.signals).toEqual({ mode: 'unavailable', missing: ['stock_quote'] });
    expect(body.features.backtest).toEqual({ mode: 'unavailable', missing: ['stock_quote'] });
    expect(body.features.watchlist).toEqual({ mode: 'full', missing: [] });
  });

  it('returns grade D for empty sources and treats missing optional tables as unavailable', async () => {
    db.newsEvent.count.mockRejectedValueOnce(new Error('table unavailable'));

    const { status, body } = await readResponse();
    expect(status).toBe(200);
    expect(body.sources.every((source) => source.grade === 'D' && !source.usable)).toBe(true);
    expect(body.features.rankings.mode).toBe('unavailable');
    expect(body.sources.find((source) => source.id === 'news_event')).toMatchObject({ rowCount: 0, grade: 'D', usable: false });
  });

  it('returns a 500 response when a required query fails', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    db.stock.count.mockRejectedValueOnce(new Error('database unavailable'));

    const { status, body } = await readResponse();
    expect(status).toBe(500);
    expect(body).toEqual({ error: '資料狀態查詢失敗' });
    expect(log).toHaveBeenCalledWith('Data status check error:', expect.any(Error));
  });
});
