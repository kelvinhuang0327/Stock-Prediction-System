jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: { groupBy: jest.fn() },
    institutionalChip: { groupBy: jest.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import {
  getBatchCoverage,
  getCoverageSummary,
  getStockCoverage,
  getTierSymbols,
  invalidateCoverageCache,
} from '../CoverageService';

const mockedPrisma = prisma as unknown as {
  stockQuote: { groupBy: jest.Mock };
  institutionalChip: { groupBy: jest.Mock };
};

function seedCoverageRows(): void {
  const freshDate = new Date().toISOString().slice(0, 10);
  const staleDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  mockedPrisma.stockQuote.groupBy.mockResolvedValue([
    { stockId: 'A250', _count: { _all: 250 } },
    { stockId: 'B60', _count: { _all: 60 } },
    { stockId: 'C10', _count: { _all: 10 } },
    { stockId: 'C40', _count: { _all: 40 } },
    { stockId: 'C80', _count: { _all: 80 } },
    { stockId: 'C150', _count: { _all: 150 } },
  ]);
  mockedPrisma.institutionalChip.groupBy.mockResolvedValue([
    { stockId: 'A250', _count: { _all: 25 }, _max: { date: freshDate } },
    { stockId: 'B60', _count: { _all: 5 }, _max: { date: staleDate } },
    { stockId: 'CHIP_ONLY', _count: { _all: 3 }, _max: { date: null } },
  ]);
}

describe('CoverageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCoverageCache();
    seedCoverageRows();
  });

  it('classifies coverage tiers and applies history/chip limitations', async () => {
    const full = await getStockCoverage('A250');
    expect(full).toMatchObject({
      tier: 'A',
      tierLabel: '完整分析 (Tier A)',
      quoteDays: 250,
      hasChip: true,
      chipDatesAvailable: 25,
      capabilities: { canBacktest: true, canMA200: true, canMA60: true, canBasicSignals: true, chipFresh: true },
      limitations: [],
    });

    const moderate = await getStockCoverage('B60');
    expect(moderate.tier).toBe('B');
    expect(moderate.capabilities).toMatchObject({ canBacktest: false, canMA60: true, hasChipData: true, chipFresh: false });
    expect(moderate.limitations).toEqual([
      '歷史資料不足回測 (60天，需≥100天)',
      '法人資料可能過時，ChipScore 準確性降低',
    ]);

    await expect(getStockCoverage('C10')).resolves.toMatchObject({
      tier: 'C',
      capabilities: { canBasicSignals: false, hasChipData: false },
      limitations: ['歷史資料極度不足 (<20天)，分析極度受限', '無法人籌碼資料，ChipAgent 輸出 Insufficient'],
    });
    await expect(getStockCoverage('C40')).resolves.toMatchObject({
      limitations: ['歷史資料偏少 (40天)，技術指標受限', '無法人籌碼資料，ChipAgent 輸出 Insufficient'],
    });
    await expect(getStockCoverage('C80')).resolves.toMatchObject({
      limitations: ['歷史資料不足回測 (80天，需≥100天)', '無法人籌碼資料，ChipAgent 輸出 Insufficient'],
    });
    await expect(getStockCoverage('C150')).resolves.toMatchObject({
      limitations: ['歷史資料不足長期技術分析 (150天，需≥250天for MA200)', '無法人籌碼資料，ChipAgent 輸出 Insufficient'],
    });
  });

  it('returns fallback records for unknown symbols and maps a batch request', async () => {
    await expect(getStockCoverage('MISSING')).resolves.toMatchObject({
      symbol: 'MISSING',
      quoteDays: 0,
      hasChip: false,
      chipLatestDate: null,
      chipDatesAvailable: 0,
      tier: 'C',
      limitations: ['此股票無任何歷史資料'],
    });

    const batch = await getBatchCoverage(['A250', 'CHIP_ONLY', 'MISSING']);
    expect(batch.get('A250')?.tier).toBe('A');
    expect(batch.get('CHIP_ONLY')).toMatchObject({ tier: 'C', quoteDays: 0, hasChip: true, chipDatesAvailable: 3 });
    expect(batch.get('MISSING')?.limitations).toEqual(['此股票無任何歷史資料']);
  });

  it('filters symbols at each tier and computes aggregate totals', async () => {
    await expect(getTierSymbols('A')).resolves.toEqual(['A250']);
    await expect(getTierSymbols('B')).resolves.toEqual(['A250', 'B60']);
    await expect(getTierSymbols('C')).resolves.toEqual(['A250', 'B60', 'C10', 'C40', 'C80', 'C150', 'CHIP_ONLY']);

    const summary = await getCoverageSummary();
    expect(summary).toMatchObject({ tierA: 1, tierB: 1, tierC: 5, total: 7, quoteOnlyStocks: 4, chipOnlyStocks: 1 });
    expect(summary.lastComputedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockedPrisma.stockQuote.groupBy).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.institutionalChip.groupBy).toHaveBeenCalledTimes(1);
  });

  it('reuses cached data and reloads it after invalidation', async () => {
    await getStockCoverage('A250');
    await getStockCoverage('B60');
    expect(mockedPrisma.stockQuote.groupBy).toHaveBeenCalledTimes(1);

    invalidateCoverageCache();
    await getStockCoverage('A250');
    expect(mockedPrisma.stockQuote.groupBy).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.institutionalChip.groupBy).toHaveBeenCalledTimes(2);
  });

  it('propagates database query failures instead of caching partial results', async () => {
    mockedPrisma.stockQuote.groupBy.mockRejectedValue(new Error('database unavailable'));
    await expect(getCoverageSummary()).rejects.toThrow('database unavailable');
    expect(mockedPrisma.institutionalChip.groupBy).not.toHaveBeenCalled();
  });
});
