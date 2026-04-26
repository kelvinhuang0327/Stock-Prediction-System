describe('signalStateClassifier', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('returns TRUE_EXHAUSTED when not enough full trades or insufficient coverage', async () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/prisma', () => ({
        prisma: {
          simulatedTrade: { findMany: jest.fn().mockResolvedValue([]) },
          strategyLearningInsight: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
          autonomousResearchSnapshot: { findFirst: jest.fn().mockResolvedValue({ dataCoverage: 'insufficient' }) },
          classifierCalibrationLog: { create: jest.fn().mockResolvedValue(null) },
          classifierThresholds: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue(null) },
        },
      }));

      // require after mocking
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { classifySignalState } = require('../signalStateClassifier');
      return classifySignalState().then((res: any) => {
        expect(res.state).toBe('TRUE_EXHAUSTED');
        expect(res.reason).toMatch(/fullTradeCount|dataCoverage/);
      });
    });
  });

  test('returns COLD_REGIME when overall win rate below threshold', async () => {
    jest.isolateModules(() => {
      const trades = Array.from({ length: 6 }, (_, i) => ({ setupType: 'trend', pnlPct: -1, tradeMode: 'full' }));
      jest.doMock('@/lib/prisma', () => ({
        prisma: {
          simulatedTrade: { findMany: jest.fn().mockResolvedValue(trades) },
          strategyLearningInsight: { findFirst: jest.fn().mockResolvedValue({ adjustmentSuggestions: '[]' }), count: jest.fn().mockResolvedValue(0) },
          autonomousResearchSnapshot: { findFirst: jest.fn().mockResolvedValue({ dataCoverage: 'full' }) },
          classifierCalibrationLog: { create: jest.fn().mockResolvedValue(null) },
          classifierThresholds: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue(null) },
        },
      }));

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { classifySignalState } = require('../signalStateClassifier');
      return classifySignalState().then((res: any) => {
        expect(res.state).toBe('COLD_REGIME');
        expect(res.features.fullTradeCount).toBeGreaterThanOrEqual(6);
      });
    });
  });
});
