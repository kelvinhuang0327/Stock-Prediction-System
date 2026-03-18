/**
 * TechnicalSignalCalculator
 *
 * Pure (no I/O) technical signal calculation.
 * Shared between /api/signals (bulk) and /api/stocks/[id]/detail (single-stock).
 *
 * All outputs are model estimates based on rule-based indicator logic.
 * NOT investment advice. Data source: DB historical OHLCV.
 */

// ─── Public Types ────────────────────────────────────────────────

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';

export interface PriceLevel {
  price: number;
  methodology: string;
}

export interface IndicatorDetail {
  name: string;
  value: number | string;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

export interface TechnicalSignalResult {
  symbol: string;
  name: string;
  industry: string;
  currentPrice: number;
  signal: SignalDirection;
  /** 0-100: how strongly aligned (bullish or bearish) the indicators are */
  strength: number;
  signalDate: string;
  dataPeriod: string;
  dataPoints: number;
  watchPrice: PriceLevel;
  buyPrice: PriceLevel;
  stopLoss: PriceLevel;
  targetPrice: PriceLevel;
  indicators: IndicatorDetail[];
}

export interface OHLCVBar {
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface DateRange {
  first: string;
  last: string;
  count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

export function r(n: number): number {
  return Math.round(n * 100) / 100;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  const m = avg(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
}

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(-period - 1).map((v, i, a) => (i === 0 ? 0 : v - a[i - 1])).slice(1);
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? -c : 0));
  const avgGain = avg(gains);
  const avgLoss = avg(losses);
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return r(100 - 100 / (1 + rs));
}

function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateKD(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 9
): { k: number; d: number } {
  const slice = closes.slice(-period);
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highMax = Math.max(...highSlice);
  const lowMin = Math.min(...lowSlice);
  const range = highMax - lowMin;
  const k = range > 0 ? r(((slice[slice.length - 1] - lowMin) / range) * 100) : 50;
  const d = r(k * 0.33 + 50 * 0.67);
  return { k, d };
}

function calculateATR(
  closes: number[],
  highs: number[],
  lows: number[],
  period = 14
): number {
  const trs: number[] = [];
  const sliceH = highs.slice(-period);
  const sliceL = lows.slice(-period);
  const sliceC = closes.slice(-period - 1);
  for (let i = 0; i < period; i++) {
    const h = sliceH[i];
    const l = sliceL[i];
    const prevC = sliceC[i];
    trs.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
  }
  return r(avg(trs));
}

// ─── Main Calculation ─────────────────────────────────────────────

/**
 * Calculate technical signals for a single stock.
 * Returns null if there are fewer than 20 data points.
 *
 * All price levels (buyPrice, stopLoss, etc.) are model estimates.
 * Methodology strings explain each level's derivation.
 */
export function calculateTechnicalSignals(
  symbol: string,
  name: string,
  industry: string,
  currentPrice: number,
  priceHistory: OHLCVBar[],
  dateRange: DateRange,
): TechnicalSignalResult | null {
  if (priceHistory.length < 20) return null;

  const closes = priceHistory.map(p => p.close);
  const highs = priceHistory.map(p => p.high);
  const lows = priceHistory.map(p => p.low);
  const volumes = priceHistory.map(p => p.volume);

  // MA calculations
  const ma5 = avg(closes.slice(-5));
  const ma20 = avg(closes.slice(-20));
  const ma60 = closes.length >= 60 ? avg(closes.slice(-60)) : null;

  // RSI (14-day)
  const rsi = calculateRSI(closes, 14);

  // MACD
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const signalLine = calculateEMA(closes.slice(-9).map(() => macdLine), 9);
  const macdHistogram = macdLine - signalLine;

  // Bollinger Bands (20-day, 2σ)
  const bbMiddle = ma20;
  const bbStd = stddev(closes.slice(-20));
  const bbUpper = bbMiddle + 2 * bbStd;
  const bbLower = bbMiddle - 2 * bbStd;

  // KD Stochastic (9-day)
  const kd = calculateKD(closes, highs, lows, 9);

  // ATR (14-day)
  const atr = calculateATR(closes, highs, lows, 14);

  // Volume analysis
  const avgVol20 = avg(volumes.slice(-20));
  const recentVol = avg(volumes.slice(-3));
  const volumeRatio = avgVol20 > 0 ? recentVol / avgVol20 : 1;

  // ── Signal determination ──
  const indicators: IndicatorDetail[] = [];
  let bullishCount = 0;
  let bearishCount = 0;

  // MA trend
  const maAligned = ma5 > ma20;
  if (currentPrice > ma20) {
    bullishCount++;
    indicators.push({ name: 'MA20', value: r(ma20), signal: 'bullish', description: `股價 ${r(currentPrice)} 在 MA20 (${r(ma20)}) 之上${maAligned ? '，MA5>MA20 多頭排列' : ''}` });
  } else {
    bearishCount++;
    indicators.push({ name: 'MA20', value: r(ma20), signal: 'bearish', description: `股價 ${r(currentPrice)} 在 MA20 (${r(ma20)}) 之下，短期趨勢偏弱` });
  }

  if (ma60 !== null) {
    if (currentPrice > ma60) {
      bullishCount++;
      indicators.push({ name: 'MA60', value: r(ma60), signal: 'bullish', description: `股價在 MA60 (${r(ma60)}) 之上，中期趨勢向上` });
    } else {
      bearishCount++;
      indicators.push({ name: 'MA60', value: r(ma60), signal: 'bearish', description: `股價在 MA60 (${r(ma60)}) 之下，中期趨勢偏弱` });
    }
  }

  // RSI
  if (rsi < 30) {
    bullishCount += 2;
    indicators.push({ name: 'RSI', value: r(rsi), signal: 'bullish', description: `RSI ${r(rsi)} 進入超賣區 (<30)，可能反彈` });
  } else if (rsi > 70) {
    bearishCount += 2;
    indicators.push({ name: 'RSI', value: r(rsi), signal: 'bearish', description: `RSI ${r(rsi)} 進入超買區 (>70)，可能回落` });
  } else {
    indicators.push({ name: 'RSI', value: r(rsi), signal: 'neutral', description: `RSI ${r(rsi)} 在中性區間` });
  }

  // MACD
  if (macdHistogram > 0) {
    bullishCount++;
    indicators.push({ name: 'MACD', value: `${r(macdLine)} / ${r(signalLine)}`, signal: 'bullish', description: `MACD 柱狀圖為正 (${r(macdHistogram)})，多方動能增強` });
  } else {
    bearishCount++;
    indicators.push({ name: 'MACD', value: `${r(macdLine)} / ${r(signalLine)}`, signal: 'bearish', description: `MACD 柱狀圖為負 (${r(macdHistogram)})，空方動能增強` });
  }

  // Bollinger Bands
  if (currentPrice < bbLower) {
    bullishCount++;
    indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'bullish', description: `股價跌破布林下軌 (${r(bbLower)})，可能超跌反彈` });
  } else if (currentPrice > bbUpper) {
    bearishCount++;
    indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'bearish', description: `股價突破布林上軌 (${r(bbUpper)})，可能過熱回落` });
  } else {
    indicators.push({ name: 'BB', value: `${r(bbLower)} - ${r(bbUpper)}`, signal: 'neutral', description: `股價在布林通道內，波動正常` });
  }

  // KD
  if (kd.k < 20 && kd.d < 20) {
    bullishCount++;
    indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'bullish', description: `KD 值偏低，可能出現黃金交叉` });
  } else if (kd.k > 80 && kd.d > 80) {
    bearishCount++;
    indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'bearish', description: `KD 值偏高，可能出現死亡交叉` });
  } else {
    indicators.push({ name: 'KD', value: `K:${r(kd.k)} D:${r(kd.d)}`, signal: 'neutral', description: `KD 值在中性區間` });
  }

  // Volume
  if (volumeRatio > 1.5) {
    const priceUp = currentPrice > closes[closes.length - 2];
    indicators.push({ name: '成交量', value: `${r(volumeRatio)}x`, signal: priceUp ? 'bullish' : 'bearish', description: `近3日量能為 20 日均量的 ${r(volumeRatio)} 倍，${priceUp ? '量增價漲' : '量增價跌需注意'}` });
    if (priceUp) bullishCount++; else bearishCount++;
  } else {
    indicators.push({ name: '成交量', value: `${r(volumeRatio)}x`, signal: 'neutral', description: `量能正常，近3日量能為 20 日均量的 ${r(volumeRatio)} 倍` });
  }

  // ── Signal & strength ──
  const totalSignals = bullishCount + bearishCount;
  const strength = totalSignals > 0 ? Math.round((Math.max(bullishCount, bearishCount) / totalSignals) * 100) : 50;

  let signal: SignalDirection = 'HOLD';
  if (bullishCount >= bearishCount + 3) signal = 'BUY';
  else if (bearishCount >= bullishCount + 3) signal = 'SELL';
  else if (bullishCount > bearishCount) signal = 'WATCH';

  // ── Support / Resistance ──
  const supports = [bbLower, ma60, ma20].filter((v): v is number => v !== null).sort((a, b) => b - a);
  const supportPrice = supports.find(s => s < currentPrice) ?? currentPrice * 0.95;

  const resistances = [bbUpper, ma20, ma60].filter((v): v is number => v !== null).sort((a, b) => a - b);
  const resistPrice = resistances.find(res => res > currentPrice) ?? currentPrice * 1.05;

  const supportLabel = ma60 && supportPrice === r(ma60) ? 'MA60' : supportPrice === r(bbLower) ? '布林下軌' : 'MA20';
  const resistLabel = resistPrice === r(bbUpper) ? '布林上軌' : 'MA';

  return {
    symbol,
    name,
    industry,
    currentPrice: r(currentPrice),
    signal,
    strength,
    signalDate: dateRange.last,
    dataPeriod: `${dateRange.first} ~ ${dateRange.last}`,
    dataPoints: dateRange.count,
    watchPrice: {
      price: r(supportPrice * 1.01),
      methodology: `支撐位 (${r(supportPrice)}) 上方 1%，依據布林下軌/MA 計算`,
    },
    buyPrice: {
      price: r(supportPrice),
      methodology: `主要支撐位：${supportLabel} = ${r(supportPrice)}`,
    },
    stopLoss: {
      price: r(currentPrice - 2 * atr),
      methodology: `股價 - 2×ATR(${r(atr)}) = ${r(currentPrice - 2 * atr)}`,
    },
    targetPrice: {
      price: r(resistPrice),
      methodology: `主要壓力位：${resistLabel} = ${r(resistPrice)}`,
    },
    indicators,
  };
}
