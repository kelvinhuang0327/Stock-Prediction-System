import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { chipAnomalyScanner } from '@/lib/scanners/ChipAnomalyScanner';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) => ({ status: 200, json: async () => body }),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    institutionalChip: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    stock: { findMany: jest.fn() },
    stockQuote: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/scanners/ChipAnomalyScanner', () => ({
  chipAnomalyScanner: { scanStock: jest.fn(), calculateAnomalyScore: jest.fn() },
}));

const chipModel = (prisma as unknown as { institutionalChip: {
  count: jest.Mock;
  groupBy: jest.Mock;
  findMany: jest.Mock;
} }).institutionalChip;
const stockModels = prisma as unknown as {
  stock: { findMany: jest.Mock };
  stockQuote: { findFirst: jest.Mock };
};
const mockedChipAnomalyScanner = chipAnomalyScanner as unknown as {
  scanStock: jest.Mock;
  calculateAnomalyScore: jest.Mock;
};

function request(query = '') {
  return {
    nextUrl: new URL(`http://localhost/api/institutional${query}`),
  } as Parameters<typeof GET>[0];
}

function chipRows(totalBuy: number) {
  return Array.from({ length: 20 }, (_, index) => ({
    stockId: '2330',
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    totalBuy: index >= 15 ? totalBuy : 0,
  }));
}

function signal(anomalyType: string, severity = 'HIGH') {
  return { anomalyType, severity, score: 80, reasoning: `${anomalyType} evidence` };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('GET /api/institutional', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chipModel.count.mockResolvedValue(0);
    chipModel.groupBy.mockResolvedValue([]);
    chipModel.findMany.mockResolvedValue([]);
    stockModels.stock.findMany.mockResolvedValue([]);
    stockModels.stockQuote.findFirst.mockResolvedValue(null);
    mockedChipAnomalyScanner.scanStock.mockResolvedValue([]);
    mockedChipAnomalyScanner.calculateAnomalyScore.mockReturnValue(42);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the explicit empty-data response when no chip records or stock groups exist', async () => {
    const noRows = await GET(request());
    expect(noRows.status).toBe(200);
    expect(await json(noRows)).toMatchObject({
      data: [], source: 'empty',
      coverage: { stocksWithChipData: 0, totalChipRows: 0, minRequired: 20 },
    });
    expect(chipModel.groupBy).not.toHaveBeenCalled();

    chipModel.count.mockResolvedValueOnce(25);
    chipModel.groupBy.mockResolvedValueOnce([]);
    const noGroups = await GET(request());
    expect(await json(noGroups)).toMatchObject({ data: [], source: 'empty' });
    expect(chipModel.groupBy).toHaveBeenCalledTimes(1);
  });

  it('returns empty scan results for no stock rows, insufficient history, or no detected signals', async () => {
    chipModel.count.mockResolvedValue(19);
    chipModel.groupBy.mockResolvedValue([{ stockId: '2330' }]);
    const noStocks = await GET(request());
    expect(await json(noStocks)).toMatchObject({
      data: [], source: 'empty',
      coverage: { stocksWithChipData: 1, totalChipRows: 19, limitations: ['僅 1 檔股票有籌碼資料 (需 ≥20 天才可分析)'] },
    });

    stockModels.stock.findMany.mockResolvedValueOnce([{ id: '2330', name: '台積電', industry: null }]);
    chipModel.findMany.mockResolvedValueOnce(chipRows(10).slice(0, 19));
    const tooShort = await GET(request());
    expect(await json(tooShort)).toMatchObject({ data: [], source: 'empty' });
    expect(mockedChipAnomalyScanner.scanStock).not.toHaveBeenCalled();

    chipModel.count.mockResolvedValue(100);
    chipModel.groupBy.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ stockId: String(index) })));
    stockModels.stock.findMany.mockResolvedValueOnce([{ id: '2330', name: '台積電', industry: null }]);
    chipModel.findMany.mockResolvedValueOnce(chipRows(10));
    mockedChipAnomalyScanner.scanStock.mockResolvedValueOnce([]);
    const noSignals = await GET(request());
    expect(await json(noSignals)).toMatchObject({
      data: [], source: 'empty', coverage: { stocksWithChipData: 20, totalChipRows: 100, limitations: [] },
    });
  });

  it('maps anomaly signals, estimates all phases, applies severity filtering, sorting, and limits', async () => {
    chipModel.count.mockResolvedValue(100);
    chipModel.groupBy.mockResolvedValue(Array.from({ length: 20 }, (_, index) => ({ stockId: String(index) })));
    stockModels.stock.findMany.mockResolvedValue([
      { id: 'SURGE', name: '急速集中', industry: '半導體' },
      { id: 'TRUST', name: '投信佈局', industry: null },
      { id: 'SELL', name: '近期賣超', industry: '電子' },
      { id: 'WATCH', name: '持續觀察', industry: '其他' },
    ]);
    chipModel.findMany
      .mockResolvedValueOnce(chipRows(100))
      .mockResolvedValueOnce(chipRows(10))
      .mockResolvedValueOnce(chipRows(-10))
      .mockResolvedValueOnce(chipRows(0));
    mockedChipAnomalyScanner.scanStock
      .mockResolvedValueOnce([signal('CONCENTRATION_SURGE')])
      .mockResolvedValueOnce([signal('TRUST_ACCUMULATION')])
      .mockResolvedValueOnce([signal('CONCENTRATION_SURGE')])
      .mockResolvedValueOnce([signal('COLD_BROKER_BUY', 'LOW')]);
    mockedChipAnomalyScanner.calculateAnomalyScore
      .mockReturnValueOnce(95)
      .mockReturnValueOnce(85)
      .mockReturnValueOnce(75)
      .mockReturnValueOnce(10);
    stockModels.stockQuote.findFirst
      .mockResolvedValueOnce({ close: 120, change: 2, volume: 1000 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ close: 30, change: -1, volume: 200 })
      .mockResolvedValueOnce(null);

    const res = await GET(request('?limit=10'));
    const body = await json(res);
    const data = body.data as Array<Record<string, unknown>>;
    expect(res.status).toBe(200);
    expect(data).toHaveLength(4);
    expect(data.map((row) => row.symbol)).toEqual(['SURGE', 'TRUST', 'SELL', 'WATCH']);
    expect(data[0]).toMatchObject({
      name: '急速集中', industry: '半導體', price: 120, change: 2, volume: 1000,
      anomalyScore: 95, phase: '可能拉抬期', signals: [{ type: 'CONCENTRATION_SURGE', severity: 'HIGH' }],
    });
    expect(data[1]).toMatchObject({ name: '投信佈局', industry: '', price: null, phase: '可能佈局期' });
    expect(data[2]).toMatchObject({ name: '近期賣超', industry: '電子', price: 30, phase: '可能出貨期' });
    expect(data[3]).toMatchObject({ name: '持續觀察', phase: '觀察中', price: null });
    expect(chipModel.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { stockId: 'SURGE' }, take: 60 }));
    expect(mockedChipAnomalyScanner.calculateAnomalyScore).toHaveBeenCalledTimes(4);
  });

  it('filters severity after scanning and orders results before applying the requested limit', async () => {
    chipModel.count.mockResolvedValue(100);
    chipModel.groupBy.mockResolvedValue([{ stockId: 'A' }, { stockId: 'B' }, { stockId: 'C' }]);
    stockModels.stock.findMany.mockResolvedValue([
      { id: 'A', name: 'A', industry: 'A' },
      { id: 'B', name: 'B', industry: 'B' },
      { id: 'C', name: 'C', industry: 'C' },
    ]);
    chipModel.findMany.mockResolvedValue(chipRows(1));
    mockedChipAnomalyScanner.scanStock
      .mockResolvedValueOnce([signal('COLD_BROKER_BUY', 'LOW')])
      .mockResolvedValueOnce([signal('COLD_BROKER_BUY', 'HIGH')])
      .mockResolvedValueOnce([signal('COLD_BROKER_BUY', 'HIGH')]);
    mockedChipAnomalyScanner.calculateAnomalyScore.mockReturnValueOnce(30).mockReturnValueOnce(95).mockReturnValueOnce(80);

    const res = await GET(request('?severity=HIGH&limit=1'));
    expect((await json(res)).data).toMatchObject([
      { symbol: 'B', anomalyScore: 95 },
    ]);
  });

  it('returns an error payload and status 200 when database access throws', async () => {
    chipModel.count.mockRejectedValueOnce(new Error('database unavailable'));
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({
      data: [], source: 'error', methodology: '', disclaimer: '',
      coverage: { stocksWithChipData: 0, totalChipRows: 0, limitations: ['資料庫查詢失敗'] },
    });
  });
});
