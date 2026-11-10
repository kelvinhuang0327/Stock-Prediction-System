import {
  buyAndHoldBenchmark,
  compareWithBenchmark,
  DEFAULT_CONFIG,
  maCrossoverBenchmark,
  runBacktest,
  type BacktestConfig,
  type PriceBar,
  type StrategyDefinition,
} from '../StrategyBacktestEngine';

function makeBars(
  count: number,
  closeAt: (index: number) => number = () => 100,
): PriceBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = closeAt(index);
    return {
      date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
      open: close,
      high: close + 2,
      low: close - 2,
      close,
      volume: 200_000,
    };
  });
}

function makeConfig(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    ...DEFAULT_CONFIG,
    costs: { buyCommission: 0, sellCommission: 0, sellTax: 0, slippagePct: 0 },
    requireMinVolume: 1,
    ...overrides,
  };
}

function makeStrategy(overrides: Partial<StrategyDefinition> = {}): StrategyDefinition {
  return {
    name: 'Test strategy',
    version: '1',
    description: 'Deterministic test strategy',
    shouldEnter: context => context.history.length === 21,
    shouldExit: () => false,
    calculateStopLoss: context => context.close * 0.9,
    positionSizeFraction: () => 0.8,
    ...overrides,
  };
}

describe('StrategyBacktestEngine', () => {
  it('reports short samples and validates date order and invalid prices', () => {
    const short = runBacktest(makeStrategy(), makeBars(10), makeConfig());
    expect(short.warnings[0]).toContain('資料不足');
    expect(short.period).toEqual({ start: '2025-01-01', end: '2025-01-10' });
    expect(short.metrics.totalTrades).toBe(0);
    expect(short.metrics.profitFactor).toBe(0);

    const invalid = makeBars(30);
    invalid[1].date = invalid[0].date;
    invalid[3].close = 0;
    const result = runBacktest(makeStrategy({ shouldEnter: () => false }), invalid, makeConfig());
    expect(result.metadata.dataQualityIssues).toEqual([
      '日期順序錯誤: 2025-01-01 -> 2025-01-01',
      '1 根 K 棒有無效價格',
    ]);
  });

  it.each(['stop_loss', 'time_stop', 'signal'] as const)(
    'closes a position for %s',
    expectedReason => {
      const bars = makeBars(40, index => index === 22 ? 99 : 100);
      if (expectedReason === 'stop_loss') {
        bars[21].open = 78;
        bars[21].low = 77;
      }
      const strategy = makeStrategy({
        shouldExit: expectedReason === 'signal'
          ? context => context.history.length === 22
          : () => false,
      });
      const config = makeConfig(expectedReason === 'time_stop' ? { maxHoldingDays: 2 } : {});

      const result = runBacktest(strategy, bars, config);
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].exitReason).toBe(expectedReason);
      expect(result.equityCurve).toHaveLength(bars.length);
      expect(result.metadata.totalBars).toBe(bars.length);
    },
  );

  it('closes an open position at end of data and skips entries that fail volume or sizing checks', () => {
    const result = runBacktest(makeStrategy(), makeBars(21), makeConfig());
    expect(result.trades[0].exitReason).toBe('end_of_data');
    expect(result.trades[0].holdingDays).toBe(0);

    const lowVolume = makeBars(30);
    lowVolume.forEach(bar => { bar.volume = 0; });
    expect(runBacktest(makeStrategy(), lowVolume, makeConfig()).trades).toHaveLength(0);

    const noSize = runBacktest(
      makeStrategy({ positionSizeFraction: () => 0 }),
      makeBars(30),
      makeConfig(),
    );
    expect(noSize.trades).toHaveLength(0);
  });

  it('handles empty buy-and-hold data and calculates a nonempty benchmark', () => {
    const config = makeConfig();
    const empty = buyAndHoldBenchmark([], config);
    expect(empty.warnings).toEqual(['無資料可回測']);
    expect(empty.metrics.totalTrades).toBe(0);

    const benchmark = buyAndHoldBenchmark(makeBars(3, index => 100 + index * 10), config);
    expect(benchmark.trades).toHaveLength(1);
    expect(benchmark.trades[0].shares).toBeGreaterThan(0);
    expect(benchmark.metrics.totalReturn).toBeGreaterThan(0);
  });

  it('runs the moving average benchmark and returns comparison warnings and verdicts', () => {
    const bars = makeBars(80, index => 80 + index);
    const benchmark = maCrossoverBenchmark(bars, 5, 20, makeConfig());
    expect(benchmark.strategyName).toBe('MA5/20 Crossover');
    expect(benchmark.trades.length).toBeGreaterThan(0);

    const strategyResult = runBacktest(makeStrategy(), bars, makeConfig());
    strategyResult.metrics = {
      ...strategyResult.metrics,
      cagr: 0.2,
      sharpeRatio: 4,
      maxDrawdown: 0,
      totalTrades: 30,
      samplePeriodDays: 300,
    };
    benchmark.metrics.cagr = 0;
    benchmark.metrics.sharpeRatio = 1;
    const strongComparison = compareWithBenchmark(strategyResult, benchmark);
    expect(strongComparison.verdict).toContain('優於 benchmark');
    expect(strongComparison.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('Sharpe Ratio'),
      expect.stringContaining('最大回撤'),
    ]));

    strategyResult.metrics.cagr = 0;
    const underperforming = compareWithBenchmark(strategyResult, benchmark);
    expect(underperforming.verdict).toContain('未能優於 benchmark');
  });
});
