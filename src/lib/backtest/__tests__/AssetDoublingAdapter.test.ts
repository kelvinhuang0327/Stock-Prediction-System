import { AssetDoublingAdapter, RSIBenchmark, SimpleMABenchmark } from '../AssetDoublingAdapter';
import type { BarContext } from '../StrategyBacktestEngine';

function context(overrides: Partial<BarContext> = {}): BarContext {
  return {
    date: '2026-11-10',
    open: 109,
    high: 112,
    low: 108,
    close: 110,
    volume: 1_000_000,
    history: [{ date: '2026-11-10', open: 109, high: 112, low: 108, close: 110, volume: 1_000_000 }],
    indicators: { ma10: 105, ma20: 103, ma60: 100, rsi: 50, atr: 2, volumeRatio: 1 },
    ...overrides,
  };
}

describe('AssetDoublingAdapter', () => {
  describe('shouldEnter', () => {
    it('requires valid history, a rising MA trend, acceptable RSI, volatility, volume, and distance from MA60', () => {
      expect(AssetDoublingAdapter.shouldEnter(context())).toBe(true);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, ma10: 0 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, ma60: 0 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ close: 105 }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, ma10: 99 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, rsi: 80 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, atr: 6 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, volumeRatio: 0.79 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({
        close: 106,
        indicators: { ...context().indicators, ma10: 105, ma60: 104 },
      }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, rsi: 39 } }))).toBe(false);
      expect(AssetDoublingAdapter.shouldEnter(context({ indicators: { ...context().indicators, rsi: 76 } }))).toBe(false);
    });

    it('allows zero ATR and unspecified volume confirmation when the trend and RSI qualify', () => {
      expect(AssetDoublingAdapter.shouldEnter(context({
        indicators: { ma10: 105, ma20: 103, ma60: 100, rsi: 75, atr: 0, volumeRatio: 0 },
      }))).toBe(true);
      expect(AssetDoublingAdapter.shouldEnter(context({
        indicators: { ma10: 105, ma20: 103, ma60: 100, rsi: 40, atr: 2 },
      }))).toBe(true);
    });
  });

  it('exits below MA20 or on extreme RSI, but otherwise keeps the position', () => {
    const position = { entryDate: '2026-11-01', entryPrice: 100, rawEntryPrice: 100, stopLoss: 90, shares: 10, capitalUsed: 1000, holdingDays: 5 };
    expect(AssetDoublingAdapter.shouldExit(context({ close: 99 }), position)).toBe(true);
    expect(AssetDoublingAdapter.shouldExit(context({ indicators: { ...context().indicators, ma20: 0, rsi: 86 } }), position)).toBe(true);
    expect(AssetDoublingAdapter.shouldExit(context(), position)).toBe(false);
  });

  it('uses ATR or percentage fallback and respects MA20 when calculating stop loss', () => {
    const history = Array.from({ length: 22 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100 + index,
      volume: 1_000,
    }));
    const atrStop = AssetDoublingAdapter.calculateStopLoss(context({ history, indicators: { ...context().indicators, atr: 2, ma20: 110 } }));
    expect(atrStop).toBe(118);

    const maOnlyStop = AssetDoublingAdapter.calculateStopLoss(context({ history, indicators: { ...context().indicators, atr: 0, ma20: 0 } }));
    expect(maOnlyStop).toBeCloseTo(102.3);

    const maHigherStop = AssetDoublingAdapter.calculateStopLoss(context({ history, indicators: { ...context().indicators, atr: 0, ma20: 105 } }));
    expect(maHigherStop).toBe(105);
  });

  it('sizes positions by risk and falls back for non-positive risk or price', () => {
    const sized = AssetDoublingAdapter.positionSizeFraction(context(), 1_000_000);
    expect(sized).toBe(0.25);
    expect(AssetDoublingAdapter.positionSizeFraction(context({ indicators: { ...context().indicators, atr: 100 } }), 1_000_000)).toBe(0.05);
    expect(AssetDoublingAdapter.positionSizeFraction(context({ indicators: { ...context().indicators, atr: 0 } }), 1_000_000)).toBeCloseTo(0.25);
    expect(AssetDoublingAdapter.positionSizeFraction(context({ indicators: { ...context().indicators, atr: -1 } }), 1_000_000)).toBeCloseTo(0.25);
    expect(AssetDoublingAdapter.positionSizeFraction(context({ close: 0 }), 1_000_000)).toBe(0.1);
  });

  it('keeps simple MA and RSI benchmarks deterministic', () => {
    const position = { entryDate: '2026-11-01', entryPrice: 100, rawEntryPrice: 100, stopLoss: 90, shares: 10, capitalUsed: 1000, holdingDays: 5 };
    expect(SimpleMABenchmark.shouldEnter(context())).toBe(true);
    expect(SimpleMABenchmark.shouldEnter(context({ close: 100 }))).toBe(false);
    expect(SimpleMABenchmark.shouldEnter(context({ indicators: { ma10: 0, ma60: 100, rsi: 0 } }))).toBe(false);
    expect(SimpleMABenchmark.shouldExit(context({ indicators: { ...context().indicators, ma10: 90, ma60: 100 } }), position)).toBe(true);
    expect(SimpleMABenchmark.shouldExit(context(), position)).toBe(false);
    expect(SimpleMABenchmark.calculateStopLoss(context())).toBeCloseTo(102.3);
    expect(SimpleMABenchmark.positionSizeFraction(context(), 100)).toBe(0.2);

    expect(RSIBenchmark.shouldEnter(context({ indicators: { ...context().indicators, rsi: 29 } }))).toBe(true);
    expect(RSIBenchmark.shouldEnter(context({ indicators: { ...context().indicators, rsi: 30 } }))).toBe(false);
    expect(RSIBenchmark.shouldExit(context({ indicators: { ...context().indicators, rsi: 71 } }), position)).toBe(true);
    expect(RSIBenchmark.shouldExit(context(), position)).toBe(false);
    expect(RSIBenchmark.calculateStopLoss(context())).toBeCloseTo(102.3);
    expect(RSIBenchmark.positionSizeFraction(context(), 100)).toBe(0.2);
  });
});
