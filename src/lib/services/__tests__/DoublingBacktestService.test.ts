jest.mock('../../backtest/BacktestRunner', () => ({
  BacktestRunner: jest.fn(),
}));

import { BacktestRunner } from '../../backtest/BacktestRunner';
import { DoublingBacktestService } from '../DoublingBacktestService';
import type { TradeResult } from '../../backtest/BacktestRunner';

const mockBacktestRunner = BacktestRunner as jest.MockedClass<typeof BacktestRunner>;

describe('DoublingBacktestService', () => {
  let run: jest.Mock;
  let service: DoublingBacktestService;

  beforeEach(() => {
    jest.clearAllMocks();
    run = jest.fn().mockResolvedValue([]);
    mockBacktestRunner.mockImplementation(() => ({ run } as unknown as BacktestRunner));
    service = new DoublingBacktestService();
  });

  test('uses configured dates, overlap step, horizon, and stop loss for the underlying runner', async () => {
    await service.runBacktest(12, 6);

    expect(run).toHaveBeenCalledTimes(1);
    const [strategy, config] = run.mock.calls[0];
    expect(strategy.name).toContain('Asset Doubling');
    expect(config.stepDays).toBe(3);
    expect(config.holdingPeriodDays).toBe(6);
    expect(config.stopLoss).toBe(0.1);
    expect(config.endDate.getTime() - config.startDate.getTime()).toBeGreaterThanOrEqual(18 * 24 * 60 * 60 * 1000);
    expect(config.endDate.getTime() - config.startDate.getTime()).toBeLessThan(19 * 24 * 60 * 60 * 1000);
  });

  test('groups trades by entry date, summarizes wins, and sorts windows newest first', async () => {
    const trades: TradeResult[] = [
      { stockId: 'OLD-WIN', entryDate: '2026-01-02', entryPrice: 10, exitDate: '2026-01-12', exitPrice: 12, returnPercent: 20, reason: 'old setup' },
      { stockId: 'NEW-LOSS', entryDate: '2026-02-01', entryPrice: 20, exitDate: '2026-02-03', exitPrice: 18, returnPercent: -10, reason: 'stop hit' },
      { stockId: 'OLD-LOSS', entryDate: '2026-01-02', entryPrice: 10, exitDate: '2026-01-06', exitPrice: 9, returnPercent: -10, reason: 'risk exit' },
    ];
    run.mockResolvedValueOnce(trades);

    const windows = await service.runBacktest(30, 10);

    expect(windows).toEqual([
      {
        startDate: '2026-02-01',
        endDate: '2026-02-01 +10d',
        candidates: [{ stockId: 'NEW-LOSS', returnPercent: -10, reason: 'stop hit', exitReason: 'Stop Loss' }],
        averageReturn: -10,
        successRate: 0,
      },
      {
        startDate: '2026-01-02',
        endDate: '2026-01-02 +10d',
        candidates: [
          { stockId: 'OLD-WIN', returnPercent: 20, reason: 'old setup', exitReason: 'Target/Time' },
          { stockId: 'OLD-LOSS', returnPercent: -10, reason: 'risk exit', exitReason: 'Stop Loss' },
        ],
        averageReturn: 5,
        successRate: 50,
      },
    ]);
  });

  test('returns no windows when the backtest finds no trades', async () => {
    await expect(service.runBacktest()).resolves.toEqual([]);
    const [, config] = run.mock.calls[0];
    expect(config.holdingPeriodDays).toBe(10);
    expect(config.stopLoss).toBe(0.1);
  });
});
