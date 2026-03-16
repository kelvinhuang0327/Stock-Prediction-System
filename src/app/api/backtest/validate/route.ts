/**
 * /api/backtest/validate - 標準化回測驗證 API
 *
 * 使用 StrategyBacktestEngine 進行含交易成本的回測，
 * 並自動執行 benchmark 對照與防自欺驗證。
 *
 * POST body:
 * {
 *   stockId: string,
 *   strategy: 'asset_doubling' | 'ma_cross' | 'rsi',
 *   months: number (3-24),
 *   costs?: 'full' | 'discounted' | 'none'
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  runBacktest,
  buyAndHoldBenchmark,
  compareWithBenchmark,
  type PriceBar,
  type BacktestConfig,
  DEFAULT_CONFIG,
} from '@/lib/backtest/StrategyBacktestEngine';
import {
  AssetDoublingAdapter,
  SimpleMABenchmark,
  RSIBenchmark,
} from '@/lib/backtest/AssetDoublingAdapter';
import {
  TW_STOCK_COSTS,
  TW_STOCK_COSTS_DISCOUNTED,
} from '@/lib/backtest/TradingCostModel';
import {
  validateBacktestResult,
} from '@/lib/backtest/AntiDeceptionValidator';

const STRATEGIES = {
  asset_doubling: AssetDoublingAdapter,
  ma_cross: SimpleMABenchmark,
  rsi: RSIBenchmark,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      stockId,
      strategy: strategyKey = 'asset_doubling',
      months = 12,
      costs: costModel = 'discounted',
    } = body;

    if (!stockId) {
      return NextResponse.json(
        { error: '請提供股票代號 (stockId)' },
        { status: 400 }
      );
    }

    const validMonths = Math.max(3, Math.min(24, months));
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - validMonths);
    const startDateStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Fetch historical data (point-in-time, chronological)
    const quotes = await (prisma as any).stockQuote.findMany({
      where: {
        stockId,
        date: { gte: startDateStr },
      },
      orderBy: { date: 'asc' },
    });

    if (!quotes || quotes.length < 30) {
      return NextResponse.json({
        error: '歷史資料不足',
        detail: `股票 ${stockId} 僅有 ${quotes?.length ?? 0} 筆報價，需至少 30 筆`,
        source: 'database',
        suggestion: '請先同步該股票的歷史資料',
      }, { status: 404 });
    }

    // Convert to PriceBar format
    const data: PriceBar[] = quotes.map((q: any) => ({
      date: q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
    }));

    // Select cost model
    const tradingCosts =
      costModel === 'none' ? { buyCommission: 0, sellCommission: 0, sellTax: 0, slippagePct: 0 } :
      costModel === 'full' ? TW_STOCK_COSTS :
      TW_STOCK_COSTS_DISCOUNTED;

    const config: BacktestConfig = {
      ...DEFAULT_CONFIG,
      costs: tradingCosts,
    };

    // Select strategy
    const strategy = STRATEGIES[strategyKey as keyof typeof STRATEGIES] ?? AssetDoublingAdapter;

    // === Run backtest ===
    const strategyResult = runBacktest(strategy, data, config);

    // === Run benchmark ===
    const benchmarkResult = buyAndHoldBenchmark(data, config);

    // === Compare ===
    const comparison = compareWithBenchmark(strategyResult, benchmarkResult);

    // === Anti-deception validation ===
    const validation = validateBacktestResult(strategyResult);

    return NextResponse.json({
      success: true,
      stockId,
      strategy: {
        name: strategy.name,
        version: strategy.version,
        description: strategy.description,
      },
      period: strategyResult.period,
      dataPoints: data.length,

      // Strategy results
      strategyMetrics: strategyResult.metrics,
      strategyWarnings: strategyResult.warnings,

      // Benchmark results
      benchmarkMetrics: benchmarkResult.metrics,

      // Comparison
      alpha: comparison.alpha,
      excessSharpe: comparison.excessSharpe,
      verdict: comparison.verdict,

      // Validation
      validation: {
        passed: validation.passed,
        trustScore: validation.trustScore,
        summary: validation.summary,
        warnings: validation.warnings,
      },

      // Equity curves for charting
      equityCurves: {
        strategy: strategyResult.equityCurve,
        benchmark: benchmarkResult.equityCurve,
      },

      // Trade details
      trades: strategyResult.trades.map(t => ({
        ...t,
        grossReturn: `${(t.grossReturn * 100).toFixed(2)}%`,
        netReturn: `${(t.netReturn * 100).toFixed(2)}%`,
      })),

      // Cost transparency
      costAnalysis: {
        model: costModel,
        roundTripCostPct: `${((tradingCosts.buyCommission + tradingCosts.sellCommission + tradingCosts.sellTax + 2 * tradingCosts.slippagePct) * 100).toFixed(3)}%`,
        totalCosts: strategyResult.metadata.totalTradingCosts,
        avgCostPerTrade: strategyResult.metadata.avgCostPerTrade,
        costDrag: `${(strategyResult.metrics.costDrag * 100).toFixed(2)}%`,
      },

      // Disclaimers
      disclaimers: [
        '⚠️ 過去績效不保證未來報酬',
        '⚠️ 回測結果基於歷史資料模擬，實際交易可能因市場條件、流動性、滑價等因素而有差異',
        '⚠️ 本系統所有分析均為模型推估，不構成投資建議',
        `⚠️ 交易成本模型: ${costModel === 'none' ? '未計入（僅供對照）' : costModel === 'full' ? '全額手續費' : '6折手續費'}`,
        `⚠️ 回測期間: ${strategyResult.period.start} ~ ${strategyResult.period.end} (${data.length} 個交易日)`,
      ],

      source: 'database',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Backtest validation error:', error);
    return NextResponse.json(
      {
        error: '回測驗證失敗',
        detail: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 }
    );
  }
}
