jest.mock('../MarketStatusService', () => ({
  marketStatusService: { getRegimeHistory: jest.fn() },
}));
jest.mock('../DoublingBacktestService', () => ({
  doublingBacktestService: { runBacktest: jest.fn() },
}));

import { marketStatusService } from '../MarketStatusService';
import { doublingBacktestService } from '../DoublingBacktestService';
import { ProTraderSimulationService } from '../ProTraderSimulationService';

const mockRegimeHistory = marketStatusService.getRegimeHistory as jest.Mock;
const mockBacktest = doublingBacktestService.runBacktest as jest.Mock;
const service = new ProTraderSimulationService();

describe('ProTraderSimulationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns finite zero risk metrics when no market history is available', async () => {
    mockRegimeHistory.mockResolvedValue([]);
    mockBacktest.mockResolvedValue([]);

    const result = await service.runSimulation({
      initialCapital: 100_000,
      maxDrawdown: 10,
      style: 'TREND',
    });

    expect(result).toMatchObject({
      history: [],
      logs: [],
      finalEquity: 100_000,
      returnPercent: 0,
      maxDrawdown: 0,
      metrics: { sharpeRatio: 0, winRate: 0, totalTrades: 0 },
    });
    expect(Number.isFinite(result.metrics.sharpeRatio)).toBe(true);
  });

  test('maps regime phases, merges same-day opportunities, and closes winning and losing trades', async () => {
    const regimes = [
      { date: '2026-01-01', regime: 'BULL', scalingFactor: 2, index: 100 },
      { date: '2026-01-02', regime: 'CORRECTION', scalingFactor: 0.8, index: 99 },
      { date: '2026-01-03', regime: 'BEAR', scalingFactor: 0.5, index: 97 },
      { date: '2026-01-04', regime: 'NEUTRAL', scalingFactor: 1, index: 98 },
      { date: '2026-01-05', regime: 'CORRECTION', scalingFactor: 0.8, index: 97 },
      { date: '2026-01-06', regime: 'CORRECTION', scalingFactor: 0.8, index: 98 },
      { date: '2026-01-07', regime: 'BULL', scalingFactor: 1, index: 100 },
      { date: '2026-01-08', regime: 'UNKNOWN', scalingFactor: 1, index: 100 },
      { date: '2026-01-09', regime: 'BULL', scalingFactor: 1, index: 101 },
      { date: '2026-01-10', regime: 'BEAR', scalingFactor: 0.5, index: 96 },
      { date: '2026-01-11', regime: 'BEAR', scalingFactor: 0.5, index: 95 },
    ];
    mockRegimeHistory.mockResolvedValue(regimes);
    mockBacktest.mockResolvedValue([
      {
        startDate: '2026-01-01',
        candidates: [
          { stockId: 'WIN', returnPercent: 20 },
          { stockId: 'LOSS-A', returnPercent: -15 },
        ],
      },
      {
        startDate: '2026-01-01',
        candidates: [
          { stockId: 'LOSS-B', returnPercent: -5 },
        ],
      },
      {
        startDate: '2026-01-02',
        candidates: [{ stockId: 'CORR-A', returnPercent: 2 }, { stockId: 'CORR-B', returnPercent: 1 }],
      },
      {
        startDate: '2026-01-06',
        candidates: [
          { stockId: 'CORR-C', returnPercent: 3 },
          { stockId: 'CORR-D', returnPercent: 2 },
          { stockId: 'CORR-E', returnPercent: 1 },
        ],
      },
      {
        startDate: '2026-01-07',
        candidates: [{ stockId: 'BULL-SMALL', returnPercent: 3 }],
      },
      {
        startDate: '2026-01-09',
        candidates: [
          { stockId: 'BULL-A', returnPercent: 3 },
          { stockId: 'BULL-B', returnPercent: 2 },
          { stockId: 'BULL-C', returnPercent: 1 },
        ],
      },
    ]);

    const result = await service.runSimulation({
      initialCapital: 100_000,
      maxDrawdown: 1,
      style: 'SWING',
    });

    expect(mockRegimeHistory).toHaveBeenCalledWith(365);
    expect(mockBacktest).toHaveBeenCalledWith(365, 60);
    expect(regimes[0].date).toBe('2026-01-01');
    expect(result.history.map((day) => day.phase)).toEqual([
      'EXPANSION', 'DEFENSE', 'DEFENSE', 'RECON', 'DEFENSE', 'RECON',
      'RECON', 'RECON', 'EXPANSION', 'DEFENSE', 'DEFENSE',
    ]);
    expect(result.logs).toEqual(expect.arrayContaining([
      expect.stringContaining('BOUGHT WIN @ EXPANSION'),
      expect.stringContaining('SOLD LOSS-A (Loss)'),
      expect.stringContaining('SOLD LOSS-B (Loss)'),
      expect.stringContaining('SOLD WIN (Win)'),
      expect.stringContaining('MAX DRAWDOWN HIT'),
    ]));
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(3);
    expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(result.history.every((day) => Number.isFinite(day.drawdown))).toBe(true);
  });
});
