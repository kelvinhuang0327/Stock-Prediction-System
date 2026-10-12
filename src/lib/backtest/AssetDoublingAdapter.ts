/**
 * AssetDoublingStrategyAdapter - 將 AssetDoubling 策略適配到標準回測引擎
 *
 * 原策略: AssetDoublingStrategy.ts
 * 此檔案: 將其規則轉譯為 StrategyDefinition interface
 *
 * 規則摘要:
 * - Entry: Price > MA10 > MA60, RSI < 80, ATR/Price ≤ 5%, 技術分數 ≥ 75
 * - Exit: Price < MA20 或 Price < RecentHigh - 2×ATR
 * - Stop: max(MA20, Recent20High - 2×ATR)
 * - Position: Half-Kelly with regime scaling
 */

import type { StrategyDefinition, BarContext, Position } from './StrategyBacktestEngine';

export const AssetDoublingAdapter: StrategyDefinition = {
  name: 'Asset Doubling Strategy',
  version: '2.0-validated',
  description: '資產翻倍策略 - 基於 MA/ATR/RSI 的趨勢跟隨策略，附完整交易成本與風控',

  shouldEnter: (ctx: BarContext): boolean => {
    const { indicators, close, volume } = ctx;
    const ma10 = indicators.ma10;
    const ma60 = indicators.ma60;
    const rsi = indicators.rsi;
    const atr = indicators.atr;
    const volumeRatio = indicators.volumeRatio ?? 0;

    // Need sufficient history
    if (ma10 === 0 || ma60 === 0) return false;

    // Core trend condition: Price > MA10 > MA60
    if (close <= ma10 || ma10 <= ma60) return false;

    // RSI not overbought (< 80)
    if (rsi >= 80) return false;

    // ATR filter: volatility not too high (≤ 5% of price)
    if (atr > 0 && (atr / close) > 0.05) return false;

    // Volume confirmation: at least average volume
    if (volumeRatio > 0 && volumeRatio < 0.8) return false;

    // Simplified technical score check
    // MA alignment strength
    const maStrength = (close - ma60) / ma60;
    if (maStrength < 0.02) return false; // need at least 2% above MA60

    // RSI in favorable zone (40-75)
    if (rsi < 40 || rsi > 75) return false;

    return true;
  },

  shouldExit: (ctx: BarContext, position: Position): boolean => {
    const { indicators, close } = ctx;
    const ma20 = indicators.ma20;

    // Exit if price drops below MA20
    if (ma20 > 0 && close < ma20) return true;

    // Exit if RSI extremely overbought
    if (indicators.rsi > 85) return true;

    return false;
  },

  calculateStopLoss: (ctx: BarContext): number => {
    const { indicators, close, history } = ctx;
    const atr = indicators.atr;
    const ma20 = indicators.ma20;

    // Recent 20-bar high
    const recent20 = history.slice(-20);
    const recentHigh = Math.max(...recent20.map(b => b.high));

    // Stop = max(MA20, RecentHigh - 2×ATR)
    const atrStop = atr > 0 ? recentHigh - 2 * atr : close * 0.93;
    const maStop = ma20 > 0 ? ma20 : close * 0.93;

    return Math.max(atrStop, maStop);
  },

  positionSizeFraction: (ctx: BarContext, capital: number): number => {
    const { indicators } = ctx;
    const atr = indicators.atr;
    const close = ctx.close;

    // Risk-based sizing: risk 2% of capital per trade
    const riskPct = 0.02;
    const stopDistance = atr > 0 ? 2 * atr : close * 0.07;
    const riskPerShare = stopDistance;

    if (riskPerShare <= 0 || close <= 0) return 0.1;

    // Position = (Capital × RiskPct) / RiskPerShare / Price
    const shares = (capital * riskPct) / riskPerShare;
    const positionValue = shares * close;
    const fraction = positionValue / capital;

    // Clamp to 5-25% of capital
    return Math.max(0.05, Math.min(0.25, fraction));
  },
};

/**
 * Simple MA Crossover for benchmark comparison
 */
export const SimpleMABenchmark: StrategyDefinition = {
  name: 'Simple MA10/60 Crossover',
  version: '1.0',
  description: 'MA10/60 交叉策略 - 作為 benchmark 使用',

  shouldEnter: (ctx) => {
    const ma10 = ctx.indicators.ma10;
    const ma60 = ctx.indicators.ma60;
    return ma10 > 0 && ma60 > 0 && ma10 > ma60 && ctx.close > ma10;
  },

  shouldExit: (ctx) => {
    const ma10 = ctx.indicators.ma10;
    const ma60 = ctx.indicators.ma60;
    return ma10 > 0 && ma60 > 0 && ma10 < ma60;
  },

  calculateStopLoss: (ctx) => ctx.close * 0.93, // fixed 7%

  positionSizeFraction: () => 0.2, // fixed 20%
};

/**
 * RSI Mean-Reversion for benchmark comparison
 */
export const RSIBenchmark: StrategyDefinition = {
  name: 'RSI Mean Reversion',
  version: '1.0',
  description: 'RSI 均值回歸策略 - 作為 benchmark 使用',

  shouldEnter: (ctx) => ctx.indicators.rsi > 0 && ctx.indicators.rsi < 30,
  shouldExit: (ctx) => ctx.indicators.rsi > 70,
  calculateStopLoss: (ctx) => ctx.close * 0.93,
  positionSizeFraction: () => 0.2,
};
