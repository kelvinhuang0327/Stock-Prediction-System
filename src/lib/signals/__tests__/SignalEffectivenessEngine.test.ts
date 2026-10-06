import { evaluateSignalEffectiveness } from '../SignalEffectivenessEngine';
import type { SignalHistory, SignalObservation } from '../types';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: {
      findMany: jest.fn(),
    },
    marketIndex: {
      findMany: jest.fn(),
    },
  },
}));

const mockStockQuoteFindMany = prisma.stockQuote.findMany as jest.Mock;
const mockMarketIndexFindMany = prisma.marketIndex.findMany as jest.Mock;

const marketRows = makeMarketRows(80, 1000, 1);
const symbolSeries: Record<string, Array<{ date: string; close: number }>> = {};

function makeDate(offset: number): string {
  const base = new Date('2026-01-01T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

function makeMarketRows(length: number, start: number, step: number) {
  return Array.from({ length }, (_, index) => ({
    date: makeDate(index),
    value: start + index * step,
  }));
}

function makeStockRows(symbol: string, values: number[]) {
  return values.map((close, index) => ({
    stockId: symbol,
    date: makeDate(index),
    close,
  }));
}

function makeHistory(signalType: SignalHistory['signalType'], observations: SignalObservation[]): SignalHistory {
  return {
    signalType,
    observations,
    limitations: [],
  };
}

describe('SignalEffectivenessEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarketIndexFindMany.mockResolvedValue(marketRows);
    mockStockQuoteFindMany.mockImplementation(async ({ where }: { where: { stockId: string } }) => {
      return symbolSeries[where.stockId] ?? [];
    });
  });

  it('classifies stable, positive, regime-robust signals as STRONG_SIGNAL', async () => {
    symbolSeries.STRONG = makeStockRows('STRONG', Array.from({ length: 80 }, (_, index) => 120 + index * 2));

    const observations = Array.from({ length: 30 }, (_, index) => ({
      signalType: 'strong_alpha_candidate' as const,
      symbol: 'STRONG',
      date: makeDate(index),
      context: {
        regime: index % 3 === 0 ? 'Bull' : index % 3 === 1 ? 'Bear' : 'Neutral',
      },
    }));

    const result = await evaluateSignalEffectiveness(
      makeHistory('strong_alpha_candidate', observations),
      5,
    );

    expect(result.sampleSize).toBe(30);
    expect(result.excessReturn).toBeGreaterThan(0);
    expect(result.classification).toBe('STRONG_SIGNAL');
    expect(result.regimeBreakdown.bull?.sampleSize).toBeGreaterThanOrEqual(5);
    expect(result.regimeBreakdown.bear?.sampleSize).toBeGreaterThanOrEqual(5);
    expect(result.regimeBreakdown.neutral?.sampleSize).toBeGreaterThanOrEqual(5);
  });

  it('classifies regime-fragile signals as CONDITIONAL_SIGNAL', async () => {
    const values = Array.from({ length: 80 }, (_, index) => {
      if (index < 40) return 150 + index * 2;
      return 230 - (index - 40) * 2;
    });
    symbolSeries.COND = makeStockRows('COND', values);

    const bullDates = [5, 7, 9, 11, 13, 15];
    const bearDates = [45, 47, 49, 51, 53, 55];
    const observations = [
      ...bullDates.map((index) => ({
        signalType: 'topic_surging' as const,
        symbol: 'COND',
        date: makeDate(index),
        context: { regime: 'Bull', topic: 'AI' },
      })),
      ...bearDates.map((index) => ({
        signalType: 'topic_surging' as const,
        symbol: 'COND',
        date: makeDate(index),
        context: { regime: 'Bear', topic: 'AI' },
      })),
    ];

    const result = await evaluateSignalEffectiveness(
      makeHistory('topic_surging', observations),
      5,
    );

    expect(result.sampleSize).toBe(12);
    expect(result.classification).toBe('CONDITIONAL_SIGNAL');
    expect((result.regimeBreakdown.bull?.avgReturn ?? 0)).toBeGreaterThan(0);
    expect((result.regimeBreakdown.bear?.avgReturn ?? 0)).toBeLessThan(0);
  });

  it('forces NOISE in degraded mode when regime data is missing', async () => {
    symbolSeries.MISSING = makeStockRows('MISSING', Array.from({ length: 80 }, (_, index) => 80 + index * 1.8));

    const observations = Array.from({ length: 12 }, (_, index) => ({
      signalType: 'chip_accumulation_signal' as const,
      symbol: 'MISSING',
      date: makeDate(index + 10),
      context: {},
    }));

    const result = await evaluateSignalEffectiveness(
      makeHistory('chip_accumulation_signal', observations),
      5,
    );

    expect(result.sampleSize).toBe(12);
    expect(result.classification).toBe('NOISE');
    expect(result.limitations.join(' ')).toContain('regime');
  });

  it('forces NOISE when effective sample size is below 10', async () => {
    symbolSeries.SMALL = makeStockRows('SMALL', Array.from({ length: 80 }, (_, index) => 60 + index * 1.5));

    const observations = Array.from({ length: 6 }, (_, index) => ({
      signalType: 'theme_diffusing' as const,
      symbol: 'SMALL',
      date: makeDate(index + 20),
      context: { regime: 'Bull', topic: 'Robotics' },
    }));

    const result = await evaluateSignalEffectiveness(
      makeHistory('theme_diffusing', observations),
      5,
    );

    expect(result.sampleSize).toBe(6);
    expect(result.classification).toBe('NOISE');
    expect(result.limitations.join(' ')).toContain('最低研究門檻');
  });
});
