/** @jest-environment node */

export {};

const mockCalculateAllIndicators = jest.fn();

jest.mock('@/lib/technicalIndicators', () => ({
  calculateAllIndicators: mockCalculateAllIndicators,
}));

function makeStock(stockId: string, quoteCount = 20, overrides: Record<string, unknown> = {}) {
  const quotes = Array.from({ length: quoteCount }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    close: 100,
    high: 101,
    low: 99,
    open: 100,
    volume: 2_000,
  }));
  return {
    stockId,
    name: `Stock ${stockId}`,
    quotes,
    monthlyRevenues: [],
    financialReports: [],
    institutionalChips: [],
    ...overrides,
  };
}

function quoteIndicators(overrides: Record<string, unknown> = {}, previousClose = 95) {
  const previousDays = Array.from({ length: 5 }, () => ({
    close: previousClose, open: previousClose, high: previousClose + 1,
    low: previousClose - 1, volume: 1_000,
  }));
  return [
    ...previousDays,
    {
      close: 100,
      open: 99,
      high: 101,
      low: 99,
      volume: 5_000,
      atr: 3,
      ma5: 99,
      ma10: 98,
      ma20: 97,
      rsi: 70,
      dif: 2,
      dem: 1,
      ...overrides,
    },
  ];
}

describe('DayTradePrepStrategy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips insufficient history and candidates that miss volume, volatility, or close-strength filters', async () => {
    mockCalculateAllIndicators
      .mockReturnValueOnce(quoteIndicators({ volume: 1_999 }))
      .mockReturnValueOnce(quoteIndicators({ atr: 1.99 }))
      .mockReturnValueOnce(quoteIndicators({ high: 103.6 }));

    const { DayTradePrepStrategy } = await import('../DayTradePrepStrategy');
    const results = await new DayTradePrepStrategy().screen([
      makeStock('short', 19),
      makeStock('low-volume'),
      makeStock('low-atr'),
      makeStock('weak-close'),
    ]);

    expect(results).toEqual([]);
    expect(mockCalculateAllIndicators).toHaveBeenCalledTimes(3);
    expect(mockCalculateAllIndicators.mock.calls[0][0][0].close).toBe(100);
  });

  it('scores a liquid, volatile candidate and caps the combined score at 100', async () => {
    mockCalculateAllIndicators.mockReturnValue(quoteIndicators({
      close: 100, open: 100, high: 101, volume: 12_000, atr: 5,
    }));

    const { DayTradePrepStrategy } = await import('../DayTradePrepStrategy');
    const results = await new DayTradePrepStrategy().screen([
      makeStock('2330', 20, { institutionalChips: [{ totalBuy: 500 }] }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      stockId: '2330',
      technicalScore: 100,
      closePrice: 100,
      riskLevel: 'High',
      riskScore: 90,
      potentialLabel: '⚡ 極度活潑',
    });
    expect(results[0].reason).toContain('ATR 5.0%');
  });

  it('accepts the minimum volume and ATR thresholds without optional chip support', async () => {
    mockCalculateAllIndicators.mockReturnValue(quoteIndicators({
      close: 100, open: 100, high: 102.5, volume: 2_000, atr: 2,
    }, 100));

    const { DayTradePrepStrategy } = await import('../DayTradePrepStrategy');
    const results = await new DayTradePrepStrategy().screen([makeStock('0050')]);

    expect(results).toHaveLength(1);
    expect(results[0].technicalScore).toBe(50);
    expect(results[0].potentialLabel).toBe('🌊 當沖熱門');
  });
});

describe('MomentumSwingStrategy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects short history, weak trends, inactive volume, and RSI outside the strength range', async () => {
    mockCalculateAllIndicators
      .mockReturnValueOnce(quoteIndicators({ close: 99, ma5: 100 }))
      .mockReturnValueOnce(quoteIndicators({ close: 101, ma5: 100, ma10: 101 }))
      .mockReturnValueOnce(quoteIndicators({ close: 101, ma5: 100, ma10: 99, ma20: 102 }))
      .mockReturnValueOnce(quoteIndicators({ close: 101, volume: 1_000 }))
      .mockReturnValueOnce(quoteIndicators({ close: 101, rsi: 54 }))
      .mockReturnValueOnce(quoteIndicators({ close: 101, rsi: 86 }));

    const { MomentumSwingStrategy } = await import('../MomentumSwingStrategy');
    const results = await new MomentumSwingStrategy().screen([
      makeStock('short', 19),
      makeStock('below-ma5'),
      makeStock('ma5-below-ma10'),
      makeStock('below-ma20'),
      makeStock('low-volume'),
      makeStock('weak-rsi'),
      makeStock('overbought'),
    ]);

    expect(results).toEqual([]);
    expect(mockCalculateAllIndicators).toHaveBeenCalledTimes(6);
  });

  it('scores strong volume, aligned trend, MACD, positive chip flow, and supporting fundamentals', async () => {
    mockCalculateAllIndicators.mockReturnValue(quoteIndicators({
      close: 110, ma5: 108, ma10: 106, ma20: 104, volume: 3_000, rsi: 70, dif: 2, dem: 1,
    }));

    const { MomentumSwingStrategy } = await import('../MomentumSwingStrategy');
    const results = await new MomentumSwingStrategy().screen([
      makeStock('2330', 20, {
        institutionalChips: [{ totalBuy: 200 }, { totalBuy: 200 }, { totalBuy: 200 }],
        monthlyRevenues: [{ year: 2026, month: 10, yoyGrowth: 25 }],
        financialReports: [{ year: 2026, quarter: 3, eps: 2.5 }],
      }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      stockId: '2330',
      technicalScore: 100,
      chipStrength: 100,
      revenueYoY: 25,
      eps: 2.5,
      potentialLabel: '🔥 爆量攻擊',
      riskLevel: 'Medium',
    });
    expect(results[0].reason).toContain('量增 (3.0x)');
  });

  it('keeps the base score for modest volume, neutral chips, and no MACD confirmation', async () => {
    mockCalculateAllIndicators.mockReturnValue(quoteIndicators({
      close: 110, ma5: 108, ma10: 106, ma20: 104, volume: 1_500, rsi: 55, dif: 1, dem: 2,
    }));

    const { MomentumSwingStrategy } = await import('../MomentumSwingStrategy');
    const results = await new MomentumSwingStrategy().screen([
      makeStock('neutral', 20, { institutionalChips: [{ totalBuy: -500 }, { totalBuy: 500 }] }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      technicalScore: 60,
      chipStrength: 50,
      potentialLabel: '📈 溫和放量',
      revenueYoY: 0,
      eps: 0,
    });
  });
});
