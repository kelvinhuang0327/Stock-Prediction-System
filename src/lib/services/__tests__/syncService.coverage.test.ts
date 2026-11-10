jest.mock('../../prisma', () => ({
  prisma: {
    syncLog: { create: jest.fn().mockResolvedValue({}) },
    stock: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([{ id: '2330' }]) },
    stockQuote: { upsert: jest.fn().mockResolvedValue({}) },
    stockMetrics: { upsert: jest.fn().mockResolvedValue({}) },
    marketIndex: { upsert: jest.fn().mockResolvedValue({}) },
    monthlyRevenue: { upsert: jest.fn().mockResolvedValue({}) },
    institutionalChip: { upsert: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock('../../api/twseApi', () => ({
  twseApi: {
    getQuarterlyFinancialReportsSummary: jest.fn().mockResolvedValue([]),
    getCompanyInfoList: jest.fn().mockResolvedValue([]),
    getLatestMarketSnapshot: jest.fn().mockResolvedValue({ quotes: [], indices: [], source: 'test', date: '2026-11-10' }),
    getStockMetrics: jest.fn().mockResolvedValue([]),
    getMonthlyRevenueSummary: jest.fn().mockResolvedValue([]),
    getHistorySeries: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/lib/fundamental/FinancialReportSync', () => ({
  upsertFinancialReports: jest.fn().mockResolvedValue({ count: 0, limitations: [] }),
}));

jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, access: jest.fn(), readFile: jest.fn() };
});

import { access, readFile } from 'node:fs/promises';
import { prisma } from '../../prisma';
import { twseApi } from '../../api/twseApi';
import { upsertFinancialReports } from '@/lib/fundamental/FinancialReportSync';
import { syncService } from '../syncService';

const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const api = twseApi as unknown as Record<string, jest.Mock>;
const reportsUpsert = upsertFinancialReports as jest.MockedFunction<typeof upsertFinancialReports>;
const accessMock = access as unknown as jest.Mock;
const readFileMock = readFile as unknown as jest.Mock;
const originalFetch = globalThis.fetch;

const report = { stockId: '2330', year: 2025, quarter: 1, eps: 2.5, netIncome: 20, operatingIncome: 25 };
const company = { code: '2330', name: 'TSMC', shortName: 'TSMC', industry: 'Semiconductor', shares: 100, capital: 50, listingDate: '1994-09-05' };
const quote = { code: '2330', name: 'TSMC', date: '2026-11-10', open: 100, high: 105, low: 98, close: 103, volume: 1000, tradeValue: 103000, change: 3, transactions: 20 };

describe('syncService behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FINANCIAL_REPORTS_FILE;
    db.syncLog!.create!.mockResolvedValue({});
    db.stock!.upsert!.mockResolvedValue({});
    db.stock!.findMany!.mockResolvedValue([{ id: '2330' }]);
    db.stockQuote!.upsert!.mockResolvedValue({});
    db.stockMetrics!.upsert!.mockResolvedValue({});
    db.marketIndex!.upsert!.mockResolvedValue({});
    db.monthlyRevenue!.upsert!.mockResolvedValue({});
    db.institutionalChip!.upsert!.mockResolvedValue({});
    api.getQuarterlyFinancialReportsSummary!.mockResolvedValue([]);
    api.getCompanyInfoList!.mockResolvedValue([]);
    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [], indices: [], source: 'test', date: '2026-11-10' });
    api.getStockMetrics!.mockResolvedValue([]);
    api.getMonthlyRevenueSummary!.mockResolvedValue([]);
    api.getHistorySeries!.mockResolvedValue([]);
    reportsUpsert.mockResolvedValue({ count: 0, limitations: [] });
    accessMock.mockRejectedValue(new Error('missing'));
    readFileMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: originalFetch });
    else delete (globalThis as unknown as { fetch?: unknown }).fetch;
    delete process.env.FINANCIAL_REPORTS_FILE;
  });

  it('treats empty OpenAPI financial reports as a successful no-op', async () => {
    await expect(syncService.syncFinancialReportsFromOpenApi()).resolves.toMatchObject({ success: true, count: 0, source: 'openapi' });
    expect(db.syncLog!.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'success', records: 0 }) }));
  });

  it('upserts OpenAPI reports and returns source limitations', async () => {
    api.getQuarterlyFinancialReportsSummary!.mockResolvedValue([report]);
    reportsUpsert.mockResolvedValue({ count: 1, limitations: ['partial source'] });

    await expect(syncService.syncFinancialReportsFromOpenApi()).resolves.toMatchObject({ success: true, count: 1, source: 'openapi', limitations: ['partial source'] });
    expect(reportsUpsert).toHaveBeenCalledWith([report]);
  });

  it('logs OpenAPI report failures and returns the original error', async () => {
    const error = new Error('endpoint unavailable');
    api.getQuarterlyFinancialReportsSummary!.mockRejectedValue(error);

    await expect(syncService.syncFinancialReportsFromOpenApi()).resolves.toMatchObject({ success: false, error });
    expect(db.syncLog!.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: String(error) }) }));
  });

  it('resolves an explicit or environment-provided report path and returns null when none exists', async () => {
    accessMock.mockResolvedValue(undefined);
    await expect(syncService.resolveFinancialReportFilePath('/tmp/reports.json')).resolves.toBe('/tmp/reports.json');

    process.env.FINANCIAL_REPORTS_FILE = '/tmp/env-reports.json';
    accessMock.mockImplementation(async (filePath: string) => {
      if (filePath === '/tmp/env-reports.json') return undefined;
      throw new Error('not found');
    });
    await expect(syncService.resolveFinancialReportFilePath()).resolves.toBe('/tmp/env-reports.json');

    accessMock.mockRejectedValue(new Error('not found'));
    await expect(syncService.resolveFinancialReportFilePath('/tmp/missing.json')).resolves.toBeNull();
  });

  it('logs sync records and swallows a database logging failure', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    db.syncLog!.create!.mockRejectedValue(new Error('log table unavailable'));

    await expect(syncService.logSync('test', 'failed', 2, 30, 'failure')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('Failed to log sync:', expect.any(Error));
  });

  it('syncs basic company data and returns failure when the API rejects', async () => {
    api.getCompanyInfoList!.mockResolvedValue([company, { ...company, code: '2317', shares: 0, capital: 0 }]);
    await expect(syncService.syncBasicInfo()).resolves.toEqual({ success: true, count: 2 });
    expect(db.stock!.upsert).toHaveBeenCalledTimes(2);
    expect(db.stock!.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ shares: 0, capital: 0 }) }));

    api.getCompanyInfoList!.mockRejectedValue(new Error('company feed unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncBasicInfo()).resolves.toMatchObject({ success: false });
    expect(errorSpy).toHaveBeenCalledWith('Basic Info Sync Failed:', expect.any(Error));
  });

  it('syncs daily quotes, rejects an empty snapshot, and reports database failures', async () => {
    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [quote], indices: [], source: 'fixture', date: quote.date });
    await expect(syncService.syncDailyQuotes()).resolves.toEqual({ success: true, count: 1, source: 'fixture', date: quote.date });
    expect(db.stockQuote!.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ stockId: '2330', close: 103 }) }));

    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [], indices: [], source: 'fixture', date: quote.date });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncDailyQuotes()).resolves.toMatchObject({ success: false, error: expect.any(Error) });
    expect(errorSpy).toHaveBeenCalledWith('Daily Quotes Sync Failed:', expect.any(Error));
  });

  it('syncs metrics with the snapshot date or today and catches API errors', async () => {
    api.getStockMetrics!.mockResolvedValue([{ code: '2330', name: 'TSMC', pe: 20, pb: 4, dividendYield: 1.2 }]);
    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [], indices: [], source: 'fixture', date: '' });
    await expect(syncService.syncMetrics()).resolves.toMatchObject({ success: true, count: 1 });
    const metricsWrite = db.stockMetrics!.upsert.mock.calls[0]![0] as { where: { stockId_date: { date: string } } };
    expect(metricsWrite.where.stockId_date.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    api.getStockMetrics!.mockRejectedValue(new Error('metrics unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncMetrics()).resolves.toMatchObject({ success: false });
    expect(errorSpy).toHaveBeenCalledWith('Stock Metrics Sync Failed:', expect.any(Error));
  });

  it('requires a market date for indices and persists valid snapshots', async () => {
    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [], indices: [{ name: 'TAIEX', value: 22000, change: 10, changePercent: 0.1 }], source: 'fixture', date: '2026-11-10' });
    await expect(syncService.syncMarketIndices()).resolves.toMatchObject({ success: true, count: 1, date: '2026-11-10' });

    api.getLatestMarketSnapshot!.mockResolvedValue({ quotes: [], indices: [], source: 'fixture', date: '' });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncMarketIndices()).resolves.toMatchObject({ success: false });
    expect(errorSpy).toHaveBeenCalledWith('Market Index Sync Failed:', expect.any(Error));
  });

  it('syncs monthly revenue and catches malformed-source failures', async () => {
    api.getMonthlyRevenueSummary!.mockResolvedValue([{ code: '2330', month: '11301', revenue: 100, yoyGrowth: 5, momGrowth: 2 }]);
    await expect(syncService.syncRealRevenue()).resolves.toEqual({ success: true, count: 1 });
    expect(db.monthlyRevenue!.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { stockId_year_month: { stockId: '2330', year: 2024, month: 1 } },
      create: expect.objectContaining({ releaseDate: expect.any(Date), releaseDateSource: expect.any(String) }),
    }));

    api.getMonthlyRevenueSummary!.mockRejectedValue(new Error('revenue unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncRealRevenue()).resolves.toMatchObject({ success: false });
    expect(errorSpy).toHaveBeenCalledWith('Real Revenue Sync Failed:', expect.any(Error));
  });

  it.each([
    ['a JSON array', JSON.stringify([report])],
    ['a reports envelope', JSON.stringify({ reports: [report] })],
  ])('loads local reports from %s', async (_label, contents) => {
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(contents);
    reportsUpsert.mockResolvedValue({ count: 1, limitations: [] });

    await expect(syncService.syncFinancialReportsFromLocalFile('/tmp/reports.json')).resolves.toMatchObject({ success: true, count: 1, source: 'local_file' });
    expect(reportsUpsert).toHaveBeenCalledWith([report]);
  });

  it('falls back to OpenAPI when the local report file is missing or empty', async () => {
    const fallback = jest.spyOn(syncService, 'syncFinancialReportsFromOpenApi').mockResolvedValue({ success: true, count: 7, source: 'openapi', limitations: [] });
    await expect(syncService.syncFinancialReportsFromLocalFile('/tmp/missing.json')).resolves.toMatchObject({ count: 7 });
    expect(fallback).toHaveBeenCalledTimes(1);

    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('{"reports":[]}');
    await expect(syncService.syncFinancialReportsFromLocalFile('/tmp/empty.json')).resolves.toMatchObject({ count: 7 });
    expect(fallback).toHaveBeenCalledTimes(2);
  });

  it('falls back on ENOENT and reports invalid local JSON', async () => {
    const fallback = jest.spyOn(syncService, 'syncFinancialReportsFromOpenApi').mockResolvedValue({ success: true, count: 3, source: 'openapi', limitations: [] });
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT: file missing'), { code: 'ENOENT' }));
    await expect(syncService.syncFinancialReportsFromLocalFile('/tmp/raced.json')).resolves.toMatchObject({ count: 3 });

    readFileMock.mockResolvedValue('{broken');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncFinancialReportsFromLocalFile('/tmp/invalid.json')).resolves.toMatchObject({ success: false, source: 'local_file' });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Financial Reports Sync Failed:', expect.any(Error));
  });

  it('handles non-trading days and imports only rows for known stocks', async () => {
    const fetchSpy = globalThis.fetch as unknown as jest.Mock;
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ stat: 'NO DATA', data: [] }) } as Response);
    await expect(syncService.syncInstitutionalChip('20261110')).resolves.toEqual({ success: true, count: 0, date: '2026-11-10' });

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ stat: 'OK', data: [
        ['2330', 'TSMC', '1', '2', '1,234', '2', '1', '500', '-3', '1,731'],
        ['9999', 'Unknown', '0', '0', '0', '0', '0', '0', '0', '0'],
      ] }),
    } as Response);
    await expect(syncService.syncInstitutionalChip('20261110')).resolves.toEqual({ success: true, count: 1, date: '2026-11-10' });
    expect(db.institutionalChip!.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { stockId: '2330', date: '2026-11-10', foreignBuy: 1234, trustBuy: 500, dealerBuy: -3, totalBuy: 1731 },
    }));
  });

  it('logs HTTP and institutional-chip write failures', async () => {
    const fetchSpy = globalThis.fetch as unknown as jest.Mock;
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncService.syncInstitutionalChip('20261110')).resolves.toMatchObject({ success: false, count: 0, error: expect.any(Error) });

    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ stat: 'OK', data: [['2330', 'TSMC', '0', '0', '1', '0', '0', '2', '3', '6']] }) } as Response);
    db.institutionalChip!.upsert!.mockRejectedValue(new Error('write failed'));
    await expect(syncService.syncInstitutionalChip('20261110')).resolves.toMatchObject({ success: false, count: 0 });
    expect(errorSpy).toHaveBeenCalledWith('[syncService] institutional_chip failed:', expect.any(Error));
  });

  it('returns each sync result from the full-sync coordinator', async () => {
    const expected = { success: true, count: 1 };
    jest.spyOn(syncService, 'syncBasicInfo').mockResolvedValue(expected);
    jest.spyOn(syncService, 'syncDailyQuotes').mockResolvedValue({ ...expected, source: 'openapi', date: '2026-11-10' });
    jest.spyOn(syncService, 'syncMetrics').mockResolvedValue({ ...expected, date: '2026-11-10' });
    jest.spyOn(syncService, 'syncMarketIndices').mockResolvedValue({ ...expected, source: 'openapi', date: '2026-11-10' });
    jest.spyOn(syncService, 'syncRealRevenue').mockResolvedValue(expected);
    jest.spyOn(syncService, 'syncFinancialReportsFromLocalFile').mockResolvedValue({ ...expected, source: 'local_file', limitations: [] });
    jest.spyOn(syncService, 'syncInstitutionalChip').mockResolvedValue({ ...expected, date: '2026-11-10' });

    await expect(syncService.syncAll()).resolves.toEqual({
      basicInfo: expected,
      dailyQuotes: { ...expected, source: 'openapi', date: '2026-11-10' },
      metrics: { ...expected, date: '2026-11-10' },
      indices: { ...expected, source: 'openapi', date: '2026-11-10' },
      realRevenue: expected,
      financialReports: { ...expected, source: 'local_file', limitations: [] },
      chip: { ...expected, date: '2026-11-10' },
    });
  });

  it('handles empty and populated stock history and catches history errors', async () => {
    await expect(syncService.syncStockHistory('2330')).resolves.toEqual({ success: true, count: 0 });
    api.getHistorySeries!.mockResolvedValue([{ date: '2026-11-10', open: 0, high: 105, low: 98, close: 103, volume: 100, tradeValue: 1, change: 2, transactions: 4 }]);
    await expect(syncService.syncStockHistory('2330', 6)).resolves.toEqual({ success: true, count: 1 });
    expect(api.getHistorySeries).toHaveBeenLastCalledWith('2330', 6);
    expect(db.stockQuote!.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ open: 0, close: 103 }) }));

    api.getHistorySeries!.mockRejectedValue(new Error('history unavailable'));
    await expect(syncService.syncStockHistory('2330')).resolves.toMatchObject({ success: false });
  });
});
