import type { StockDataPoint } from '@/types/stock';
import {
  calculateADX,
  calculateAllIndicators,
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateCMF,
  calculateEMA,
  calculateIchimoku,
  calculateKD,
  calculateMACD,
  calculateMFI,
  calculateOBV,
  calculateParabolicSAR,
  calculatePivotPoints,
  calculateRSI,
  calculateSMA,
  calculateStochRSI,
  calculateVolumeProfile,
  calculateVWAP,
  calculateWilliamsR,
} from '../technicalIndicators';

function makeBars(
  count: number,
  closeAt: (index: number) => number = index => 100 + index * 0.35 + Math.sin(index / 2) * 2,
  volumeAt: (index: number) => number = index => 1_000 + index * 10,
): StockDataPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const close = closeAt(index);
    return {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      open: close - 0.2,
      high: close + 1,
      low: close - 1,
      close,
      volume: volumeAt(index),
    };
  });
}

describe('technical indicators', () => {
  it('calculates moving averages and Bollinger bands after their warm-up windows', () => {
    const bars = makeBars(30);
    const sma = calculateSMA(bars, 5);
    const ema = calculateEMA(sma, 5);
    const bands = calculateBollingerBands(sma, 5, 2);

    expect(sma[3].ma5).toBeUndefined();
    expect(sma[4].ma5).toBeDefined();
    expect((ema[0] as unknown as Record<string, unknown>).ema5).toBe(bars[0].close);
    expect(bands[3].bbMiddle).toBeUndefined();
    expect(bands[29].bbUpper).toBeGreaterThan(bands[29].bbMiddle ?? Infinity);
    expect(bands[29].bbLower).toBeLessThan(bands[29].bbMiddle ?? -Infinity);
  });

  it('calculates oscillators and volatility indicators on rising, falling, and flat data', () => {
    const rising = makeBars(80, index => 100 + index);
    const falling = makeBars(80, index => 200 - index * 0.4);
    const flat = makeBars(80, () => 100, () => 0);

    expect(calculateKD(rising, 9).at(-1)?.k).toBeDefined();
    expect(calculateMACD(rising).at(-1)?.osc).toBeDefined();
    expect(calculateRSI(rising, 14).at(-1)?.rsi).toBe(100);
    expect(calculateRSI(falling, 14).at(-1)?.rsi).toBe(0);
    expect(calculateATR(rising, 14).at(-1)?.atr).toBeGreaterThan(0);
    expect(calculateWilliamsR(rising, 14).at(-1)?.williamsR).toBeDefined();
    expect(calculateCCI(flat, 20).at(-1)?.cci).toBe(0);
    expect(calculateKD(flat, 9).at(-1)?.k).toBe(50);
    expect(calculateWilliamsR(flat, 14).at(-1)?.williamsR).toBe(-50);
  });

  it('covers flow and volume indicators, including empty and zero-range inputs', () => {
    const bars = makeBars(40);
    const flat = makeBars(40, () => 100, () => 0);

    expect(calculateVolumeProfile([])).toEqual([]);
    expect(calculateVolumeProfile(bars, 8)).toHaveLength(8);
    expect(calculateOBV(bars).at(-1)?.obv).toBeDefined();
    expect(calculateVWAP(flat).at(-1)?.vwap).toBe(100);
    expect(calculateMFI(bars, 14).at(-1)?.mfi).toBeDefined();
    expect(calculateCMF(flat, 20).at(-1)?.cmf).toBe(0);
    expect(calculatePivotPoints(bars)).toHaveLength(bars.length);
    expect(calculatePivotPoints(bars)[1].pivotPoint).toBeDefined();
  });

  it('calculates trend indicators and returns early for insufficient ADX history', () => {
    const bars = makeBars(80);
    const short = bars.slice(0, 10) as ReturnType<typeof calculateSMA>;
    const adx = calculateADX(calculateSMA(bars, 5), 14);
    const ichimoku = calculateIchimoku(calculateSMA(bars, 5), 9, 26, 52);
    const sar = calculateParabolicSAR(calculateSMA(bars, 5));

    expect(calculateADX(short, 14)).toBe(short);
    expect(adx.at(-1)?.adx).toBeDefined();
    expect(adx.at(-1)?.plusDI).toBeDefined();
    expect(ichimoku.at(-1)?.senkouSpanB).toBeDefined();
    expect(sar.at(-1)?.sar).toBeDefined();
    const oneBar = short.slice(0, 1);
    expect(calculateParabolicSAR(oneBar)).toBe(oneBar);
  });

  it('calculates Stochastic RSI and all-indicator options', () => {
    const bars = makeBars(80);
    const withRsi = calculateRSI(calculateSMA(bars, 5), 14);
    const stochastic = calculateStochRSI(withRsi, 14, 14, 3);
    const all = calculateAllIndicators(bars);
    const selected = calculateAllIndicators(bars, {
      sma: [3],
      ema: [3],
      bollinger: { period: 4, multiplier: 2 },
      kd: { period: 3 },
      macd: false,
      rsi: { period: 3 },
      atr: { period: 3 },
      williamsR: { period: 3 },
      cci: { period: 4 },
      includeOBV: false,
    });

    expect(stochastic.at(-1)?.stochRsiK).toBeDefined();
    expect(all.at(-1)?.ma60).toBeDefined();
    expect(all.at(-1)?.obv).toBeDefined();
    expect((selected.at(-1) as unknown as Record<string, unknown>).ma3).toBeDefined();
    expect(selected.at(-1)).not.toHaveProperty('dif');
    expect(selected.at(-1)?.obv).toBeUndefined();
  });
});
