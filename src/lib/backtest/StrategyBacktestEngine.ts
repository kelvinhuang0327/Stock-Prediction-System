/**
 * StrategyBacktestEngine - 標準化回測引擎
 *
 * 設計原則：
 * 1. 所有交易含交易成本與滑價
 * 2. 不使用未來資料 (point-in-time data only)
 * 3. 倉位限制、現金管理
 * 4. 標準績效指標輸出
 * 5. Benchmark 對照
 * 6. 防自欺機制
 */

import {
  TradingCosts,
  TW_STOCK_COSTS,
  effectiveBuyPrice,
  effectiveSellPrice,
  roundTripCostPct,
} from './TradingCostModel';

// ─── Types ───

export interface StrategyDefinition {
  name: string;
  version: string;
  description: string;

  /** Return true if should enter long on this bar */
  shouldEnter: (context: BarContext) => boolean;
  /** Return true if should exit on this bar */
  shouldExit: (context: BarContext, position: Position) => boolean;
  /** Calculate stop loss price */
  calculateStopLoss: (context: BarContext) => number;
  /** Calculate position size as fraction of capital (0-1) */
  positionSizeFraction: (context: BarContext, capital: number) => number;
}

export interface BarContext {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** All historical bars up to and including current (no future data) */
  history: PriceBar[];
  /** Pre-calculated indicators for current bar */
  indicators: Record<string, number>;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  entryDate: string;
  entryPrice: number;        // effective (after costs)
  rawEntryPrice: number;     // market price
  stopLoss: number;
  shares: number;
  capitalUsed: number;
  holdingDays: number;
}

export interface TradeRecord {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  grossReturn: number;
  netReturn: number;
  tradingCosts: number;
  holdingDays: number;
  exitReason: 'signal' | 'stop_loss' | 'time_stop' | 'end_of_data';
}

export interface BacktestConfig {
  initialCapital: number;
  costs: TradingCosts;
  maxPositionPct: number;      // max % of capital per position (e.g., 0.3)
  maxPositions: number;        // max concurrent positions
  maxHoldingDays: number;      // time stop
  cashReservePct: number;      // min cash reserve (e.g., 0.1)
  requireMinVolume: number;    // min daily volume to trade
}

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 1_000_000,
  costs: TW_STOCK_COSTS,
  maxPositionPct: 0.25,
  maxPositions: 5,
  maxHoldingDays: 60,
  cashReservePct: 0.1,
  requireMinVolume: 100_000,  // 100 lots minimum
};

export interface BacktestResult {
  strategyName: string;
  config: BacktestConfig;
  period: { start: string; end: string };
  trades: TradeRecord[];
  equityCurve: { date: string; equity: number }[];
  metrics: PerformanceMetrics;
  warnings: string[];
  metadata: {
    totalBars: number;
    barsWithPosition: number;
    totalTradingCosts: number;
    avgCostPerTrade: number;
    dataQualityIssues: string[];
  };
}

export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  cagr: number;
  annualizedReturn: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  winRate: number;
  payoffRatio: number;

  // Risk
  maxDrawdown: number;
  maxDrawdownDuration: number;  // in bars
  volatility: number;           // annualized
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  ulcerIndex: number;

  // Trade Quality
  totalTrades: number;
  exposure: number;             // % of time in market
  avgHoldingDays: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;

  // Anti-Deception
  samplePeriodDays: number;
  costDrag: number;             // total cost as % of returns
  breakEvenRate: number;        // min win rate needed to break even
}

// ─── Engine ───

export function runBacktest(
  strategy: StrategyDefinition,
  data: PriceBar[],
  config: BacktestConfig = DEFAULT_CONFIG
): BacktestResult {
  const warnings: string[] = [];
  const dataQualityIssues: string[] = [];

  // === Data Validation ===
  if (data.length < 30) {
    warnings.push(`資料不足: 僅 ${data.length} 根 K 棒，結果可信度極低`);
  }

  // Check chronological order
  for (let i = 1; i < data.length; i++) {
    if (data[i].date <= data[i - 1].date) {
      dataQualityIssues.push(`日期順序錯誤: ${data[i - 1].date} -> ${data[i].date}`);
    }
  }

  // Check for gaps
  const nullPrices = data.filter(d => !d.close || d.close <= 0);
  if (nullPrices.length > 0) {
    dataQualityIssues.push(`${nullPrices.length} 根 K 棒有無效價格`);
  }

  // === Run Backtest ===
  let capital = config.initialCapital;
  const positions: Position[] = [];
  const trades: TradeRecord[] = [];
  const equityCurve: { date: string; equity: number }[] = [];
  let totalTradingCosts = 0;
  let barsWithPosition = 0;

  // Pre-calculate indicators for each bar
  const indicatorCache: Record<string, number>[] = data.map((bar, idx) => {
    const hist = data.slice(0, idx + 1);
    return calculateIndicators(hist);
  });

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    const context: BarContext = {
      date: bar.date,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      history: data.slice(0, i + 1),  // only past + current, no future
      indicators: indicatorCache[i],
    };

    // === Check exits first ===
    const closedPositions: number[] = [];
    for (let p = 0; p < positions.length; p++) {
      const pos = positions[p];
      pos.holdingDays++;

      let exitReason: TradeRecord['exitReason'] | null = null;

      // Stop loss check (use low of the day)
      if (bar.low <= pos.stopLoss) {
        exitReason = 'stop_loss';
      }
      // Time stop
      else if (pos.holdingDays >= config.maxHoldingDays) {
        exitReason = 'time_stop';
      }
      // Strategy exit signal
      else if (strategy.shouldExit(context, pos)) {
        exitReason = 'signal';
      }

      if (exitReason) {
        const exitMarketPrice = exitReason === 'stop_loss'
          ? Math.min(bar.open, pos.stopLoss)  // gap down: exit at open
          : bar.close;
        const exitPrice = effectiveSellPrice(exitMarketPrice, config.costs);
        const proceeds = exitPrice * pos.shares;
        const grossRet = (exitMarketPrice - pos.rawEntryPrice) / pos.rawEntryPrice;
        const netRet = (proceeds - pos.capitalUsed) / pos.capitalUsed;
        const tradeCost = pos.capitalUsed * roundTripCostPct(config.costs);

        capital += proceeds;
        totalTradingCosts += tradeCost;

        trades.push({
          entryDate: pos.entryDate,
          exitDate: bar.date,
          entryPrice: pos.rawEntryPrice,
          exitPrice: exitMarketPrice,
          shares: pos.shares,
          grossReturn: grossRet,
          netReturn: netRet,
          tradingCosts: tradeCost,
          holdingDays: pos.holdingDays,
          exitReason,
        });

        closedPositions.push(p);
      }
    }

    // Remove closed positions (reverse order to preserve indices)
    for (let j = closedPositions.length - 1; j >= 0; j--) {
      positions.splice(closedPositions[j], 1);
    }

    // === Check entries ===
    if (positions.length < config.maxPositions) {
      const availableCapital = capital - config.initialCapital * config.cashReservePct;
      const maxPerPosition = config.initialCapital * config.maxPositionPct;

      if (
        availableCapital > 0 &&
        bar.volume >= config.requireMinVolume &&
        i >= 20 &&  // need minimum history for indicators
        strategy.shouldEnter(context)
      ) {
        const fraction = strategy.positionSizeFraction(context, capital);
        const positionCapital = Math.min(
          capital * fraction,
          maxPerPosition,
          availableCapital
        );

        if (positionCapital > 10000) {  // minimum position size
          const entryMarketPrice = bar.close;
          const entryEffective = effectiveBuyPrice(entryMarketPrice, config.costs);
          const shares = Math.floor(positionCapital / entryEffective / 1000) * 1000; // round to lots

          if (shares >= 1000) {
            const actualCapital = entryEffective * shares;
            capital -= actualCapital;

            positions.push({
              entryDate: bar.date,
              entryPrice: entryEffective,
              rawEntryPrice: entryMarketPrice,
              stopLoss: strategy.calculateStopLoss(context),
              shares,
              capitalUsed: actualCapital,
              holdingDays: 0,
            });
          }
        }
      }
    }

    // Track equity
    if (positions.length > 0) barsWithPosition++;
    const positionValue = positions.reduce((sum, p) => sum + p.shares * bar.close, 0);
    equityCurve.push({
      date: bar.date,
      equity: capital + positionValue,
    });
  }

  // Close remaining positions at end of data
  for (const pos of positions) {
    const lastBar = data[data.length - 1];
    const exitPrice = effectiveSellPrice(lastBar.close, config.costs);
    const proceeds = exitPrice * pos.shares;
    const grossRet = (lastBar.close - pos.rawEntryPrice) / pos.rawEntryPrice;
    const netRet = (proceeds - pos.capitalUsed) / pos.capitalUsed;

    capital += proceeds;
    trades.push({
      entryDate: pos.entryDate,
      exitDate: lastBar.date,
      entryPrice: pos.rawEntryPrice,
      exitPrice: lastBar.close,
      shares: pos.shares,
      grossReturn: grossRet,
      netReturn: netRet,
      tradingCosts: pos.capitalUsed * roundTripCostPct(config.costs),
      holdingDays: pos.holdingDays,
      exitReason: 'end_of_data',
    });
  }

  // Final equity
  const finalEquity = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1].equity
    : config.initialCapital;

  // === Calculate Metrics ===
  const metrics = calculateMetrics(
    trades,
    equityCurve,
    config.initialCapital,
    data.length,
    barsWithPosition,
    totalTradingCosts
  );

  return {
    strategyName: strategy.name,
    config,
    period: {
      start: data[0]?.date ?? '',
      end: data[data.length - 1]?.date ?? '',
    },
    trades,
    equityCurve,
    metrics,
    warnings,
    metadata: {
      totalBars: data.length,
      barsWithPosition,
      totalTradingCosts,
      avgCostPerTrade: trades.length > 0 ? totalTradingCosts / trades.length : 0,
      dataQualityIssues,
    },
  };
}

// ─── Benchmark: Buy & Hold ───

export function buyAndHoldBenchmark(
  data: PriceBar[],
  config: BacktestConfig = DEFAULT_CONFIG
): BacktestResult {
  if (data.length === 0) {
    return emptyResult('Buy & Hold', config);
  }

  const entryPrice = effectiveBuyPrice(data[0].close, config.costs);
  const shares = Math.floor(config.initialCapital / entryPrice / 1000) * 1000;
  const invested = entryPrice * shares;
  const remainingCash = config.initialCapital - invested;

  const equityCurve = data.map(bar => ({
    date: bar.date,
    equity: remainingCash + shares * bar.close,
  }));

  const lastPrice = data[data.length - 1].close;
  const exitPrice = effectiveSellPrice(lastPrice, config.costs);
  const proceeds = exitPrice * shares + remainingCash;
  const netReturn = (proceeds - config.initialCapital) / config.initialCapital;
  const grossReturn = (lastPrice - data[0].close) / data[0].close;
  const tradeCost = invested * roundTripCostPct(config.costs);

  const trade: TradeRecord = {
    entryDate: data[0].date,
    exitDate: data[data.length - 1].date,
    entryPrice: data[0].close,
    exitPrice: lastPrice,
    shares,
    grossReturn,
    netReturn,
    tradingCosts: tradeCost,
    holdingDays: data.length,
    exitReason: 'end_of_data',
  };

  const metrics = calculateMetrics(
    [trade], equityCurve, config.initialCapital, data.length, data.length, tradeCost
  );

  return {
    strategyName: 'Buy & Hold',
    config,
    period: { start: data[0].date, end: data[data.length - 1].date },
    trades: [trade],
    equityCurve,
    metrics,
    warnings: [],
    metadata: {
      totalBars: data.length,
      barsWithPosition: data.length,
      totalTradingCosts: tradeCost,
      avgCostPerTrade: tradeCost,
      dataQualityIssues: [],
    },
  };
}

// ─── Simple MA Crossover Benchmark ───

export function maCrossoverBenchmark(
  data: PriceBar[],
  shortPeriod: number = 10,
  longPeriod: number = 60,
  config: BacktestConfig = DEFAULT_CONFIG
): BacktestResult {
  const strategy: StrategyDefinition = {
    name: `MA${shortPeriod}/${longPeriod} Crossover`,
    version: '1.0',
    description: `Simple MA crossover: buy when MA${shortPeriod} > MA${longPeriod}, sell when MA${shortPeriod} < MA${longPeriod}`,
    shouldEnter: (ctx) => {
      const maShort = ctx.indicators[`ma${shortPeriod}`];
      const maLong = ctx.indicators[`ma${longPeriod}`];
      return maShort > 0 && maLong > 0 && maShort > maLong;
    },
    shouldExit: (ctx) => {
      const maShort = ctx.indicators[`ma${shortPeriod}`];
      const maLong = ctx.indicators[`ma${longPeriod}`];
      return maShort > 0 && maLong > 0 && maShort < maLong;
    },
    calculateStopLoss: (ctx) => ctx.close * 0.93,  // fixed 7% stop
    positionSizeFraction: () => 0.9,  // nearly all-in for benchmark simplicity
  };

  return runBacktest(strategy, data, config);
}

// ─── Indicator Calculations (point-in-time only) ───

function calculateIndicators(history: PriceBar[]): Record<string, number> {
  const indicators: Record<string, number> = {};
  const closes = history.map(h => h.close);
  const n = closes.length;

  // Simple Moving Averages
  for (const period of [5, 10, 20, 60, 120]) {
    if (n >= period) {
      const slice = closes.slice(n - period);
      indicators[`ma${period}`] = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      indicators[`ma${period}`] = 0;
    }
  }

  // RSI (14)
  if (n >= 15) {
    let gains = 0, losses = 0;
    for (let i = n - 14; i < n; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    indicators.rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  } else {
    indicators.rsi = 50;
  }

  // ATR (14)
  if (n >= 15) {
    let atrSum = 0;
    for (let i = n - 14; i < n; i++) {
      const tr = Math.max(
        history[i].high - history[i].low,
        Math.abs(history[i].high - history[i - 1].close),
        Math.abs(history[i].low - history[i - 1].close)
      );
      atrSum += tr;
    }
    indicators.atr = atrSum / 14;
  } else {
    indicators.atr = 0;
  }

  // Volume MA (20)
  if (n >= 20) {
    const volSlice = history.slice(n - 20).map(h => h.volume);
    indicators.volumeMa20 = volSlice.reduce((a, b) => a + b, 0) / 20;
    indicators.volumeRatio = history[n - 1].volume / indicators.volumeMa20;
  }

  return indicators;
}

// ─── Performance Metrics ───

function calculateMetrics(
  trades: TradeRecord[],
  equityCurve: { date: string; equity: number }[],
  initialCapital: number,
  totalBars: number,
  barsWithPosition: number,
  totalTradingCosts: number
): PerformanceMetrics {
  const wins = trades.filter(t => t.netReturn > 0);
  const losses = trades.filter(t => t.netReturn <= 0);

  const totalReturn = equityCurve.length > 0
    ? (equityCurve[equityCurve.length - 1].equity - initialCapital) / initialCapital
    : 0;

  const tradingDaysPerYear = 252;
  const years = totalBars / tradingDaysPerYear;
  const cagr = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  // Daily returns for risk metrics
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push(
      (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity
    );
  }

  // Volatility (annualized)
  const avgDailyReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;
  const variance = dailyReturns.length > 1
    ? dailyReturns.reduce((sum, r) => sum + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length - 1)
    : 0;
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(tradingDaysPerYear);

  // Downside deviation (for Sortino)
  const downsideReturns = dailyReturns.filter(r => r < 0);
  const downsideVariance = downsideReturns.length > 1
    ? downsideReturns.reduce((sum, r) => sum + r ** 2, 0) / downsideReturns.length
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(tradingDaysPerYear);

  // Max Drawdown
  let peak = initialCapital;
  let maxDD = 0;
  let maxDDDuration = 0;
  let currentDDDuration = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
      currentDDDuration = 0;
    } else {
      currentDDDuration++;
      const dd = (peak - point.equity) / peak;
      if (dd > maxDD) maxDD = dd;
      if (currentDDDuration > maxDDDuration) maxDDDuration = currentDDDuration;
    }
  }

  // Ulcer Index
  const drawdowns: number[] = [];
  peak = initialCapital;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    drawdowns.push(((peak - point.equity) / peak) * 100);
  }
  const ulcerIndex = drawdowns.length > 0
    ? Math.sqrt(drawdowns.reduce((sum, d) => sum + d ** 2, 0) / drawdowns.length)
    : 0;

  // Ratios
  const riskFreeRate = 0.02; // 2% annual risk-free
  const excessReturn = cagr - riskFreeRate;
  const sharpe = annualizedVol > 0 ? excessReturn / annualizedVol : 0;
  const sortino = downsideDeviation > 0 ? excessReturn / downsideDeviation : 0;
  const calmar = maxDD > 0 ? cagr / maxDD : 0;

  // Trade metrics
  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + t.netReturn, 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((s, t) => s + t.netReturn, 0) / losses.length)
    : 0;
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const profitFactor = losses.length > 0
    ? Math.abs(wins.reduce((s, t) => s + t.netReturn, 0)) /
      Math.abs(losses.reduce((s, t) => s + t.netReturn, 0))
    : wins.length > 0 ? Infinity : 0;
  const expectancy = trades.length > 0
    ? trades.reduce((s, t) => s + t.netReturn, 0) / trades.length
    : 0;

  // Consecutive wins/losses
  let maxConsWins = 0, maxConsLosses = 0, consWins = 0, consLosses = 0;
  for (const t of trades) {
    if (t.netReturn > 0) {
      consWins++;
      consLosses = 0;
      if (consWins > maxConsWins) maxConsWins = consWins;
    } else {
      consLosses++;
      consWins = 0;
      if (consLosses > maxConsLosses) maxConsLosses = consLosses;
    }
  }

  // Anti-deception: cost drag
  const grossTotalReturn = trades.reduce((s, t) => s + t.grossReturn * (t.shares * t.entryPrice), 0);
  const costDrag = grossTotalReturn !== 0 ? totalTradingCosts / Math.abs(grossTotalReturn) : 0;

  // Break-even win rate given avg win/loss
  const breakEvenRate = avgWin + avgLoss > 0 ? avgLoss / (avgWin + avgLoss) : 0.5;

  return {
    totalReturn: round4(totalReturn),
    cagr: round4(cagr),
    annualizedReturn: round4(cagr),
    profitFactor: round4(profitFactor),
    expectancy: round4(expectancy),
    avgWin: round4(avgWin),
    avgLoss: round4(avgLoss),
    winRate: round4(winRate),
    payoffRatio: round4(payoffRatio),

    maxDrawdown: round4(maxDD),
    maxDrawdownDuration: maxDDDuration,
    volatility: round4(annualizedVol),
    sharpeRatio: round4(sharpe),
    sortinoRatio: round4(sortino),
    calmarRatio: round4(calmar),
    ulcerIndex: round4(ulcerIndex),

    totalTrades: trades.length,
    exposure: totalBars > 0 ? round4(barsWithPosition / totalBars) : 0,
    avgHoldingDays: trades.length > 0
      ? Math.round(trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length)
      : 0,
    maxConsecutiveLosses: maxConsLosses,
    maxConsecutiveWins: maxConsWins,

    samplePeriodDays: totalBars,
    costDrag: round4(costDrag),
    breakEvenRate: round4(breakEvenRate),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function emptyResult(name: string, config: BacktestConfig): BacktestResult {
  return {
    strategyName: name,
    config,
    period: { start: '', end: '' },
    trades: [],
    equityCurve: [],
    metrics: {
      totalReturn: 0, cagr: 0, annualizedReturn: 0, profitFactor: 0,
      expectancy: 0, avgWin: 0, avgLoss: 0, winRate: 0, payoffRatio: 0,
      maxDrawdown: 0, maxDrawdownDuration: 0, volatility: 0,
      sharpeRatio: 0, sortinoRatio: 0, calmarRatio: 0, ulcerIndex: 0,
      totalTrades: 0, exposure: 0, avgHoldingDays: 0,
      maxConsecutiveLosses: 0, maxConsecutiveWins: 0,
      samplePeriodDays: 0, costDrag: 0, breakEvenRate: 0.5,
    },
    warnings: ['無資料可回測'],
    metadata: {
      totalBars: 0, barsWithPosition: 0,
      totalTradingCosts: 0, avgCostPerTrade: 0, dataQualityIssues: [],
    },
  };
}

// ─── Comparison Report ───

export interface ComparisonReport {
  strategy: BacktestResult;
  benchmark: BacktestResult;
  alpha: number;         // strategy CAGR - benchmark CAGR
  excessSharpe: number;
  verdict: string;
  warnings: string[];
}

export function compareWithBenchmark(
  strategyResult: BacktestResult,
  benchmarkResult: BacktestResult
): ComparisonReport {
  const alpha = strategyResult.metrics.cagr - benchmarkResult.metrics.cagr;
  const excessSharpe = strategyResult.metrics.sharpeRatio - benchmarkResult.metrics.sharpeRatio;

  const warnings: string[] = [];

  if (strategyResult.metrics.totalTrades < 30) {
    warnings.push(`交易次數僅 ${strategyResult.metrics.totalTrades} 次，樣本不足，結果不具統計顯著性`);
  }
  if (strategyResult.metrics.samplePeriodDays < 252) {
    warnings.push(`回測期間僅 ${strategyResult.metrics.samplePeriodDays} 天，不足一年，無法評估年度穩定性`);
  }
  if (strategyResult.metrics.sharpeRatio > 3) {
    warnings.push(`Sharpe Ratio ${strategyResult.metrics.sharpeRatio} 異常偏高，可能存在過度擬合或資料問題`);
  }
  if (strategyResult.metrics.maxDrawdown < 0.01 && strategyResult.metrics.totalTrades > 10) {
    warnings.push(`最大回撤 ${(strategyResult.metrics.maxDrawdown * 100).toFixed(2)}% 異常偏低，可能存在生存者偏差`);
  }

  let verdict: string;
  if (alpha > 0.05 && excessSharpe > 0.3 && strategyResult.metrics.totalTrades >= 30) {
    verdict = '策略在此期間優於 benchmark，但需更多 out-of-sample 驗證';
  } else if (alpha > 0) {
    verdict = '策略略優於 benchmark，但優勢不顯著，可能是隨機波動';
  } else {
    verdict = '策略未能優於 benchmark，不建議在此條件下使用';
  }

  return {
    strategy: strategyResult,
    benchmark: benchmarkResult,
    alpha: round4(alpha),
    excessSharpe: round4(excessSharpe),
    verdict,
    warnings: [...strategyResult.warnings, ...warnings],
  };
}
