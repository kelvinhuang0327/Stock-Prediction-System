import { computeClassifierAccuracy } from '../classifierCalibration';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    classifierCalibrationLog: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, state: 'NORMAL', confidenceScore: 0.8, featuresJson: JSON.stringify({ overallWinRate: 0.5, fullTradeCount: 10 }), thresholdsJson: JSON.stringify({ coldWinRateMin: 0.4, coldMinTrades: 5 }), classifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
        { id: 2, state: 'COLD_REGIME', confidenceScore: 0.6, featuresJson: JSON.stringify({ overallWinRate: 0.2, fullTradeCount: 2 }), thresholdsJson: JSON.stringify({ coldWinRateMin: 0.4, coldMinTrades: 5 }), classifiedAt: new Date() },
      ]),
    },
    classifierThresholds: {
      findFirst: jest.fn().mockResolvedValue({ id: 1, coldWinRateMin: 0.4, correctClassifications: 0 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('Classifier Calibration', () => {
  it('computes accuracy report without throwing and returns numeric fields', async () => {
    const rpt = await computeClassifierAccuracy();
    expect(rpt).toHaveProperty('totalClassifications');
    expect(typeof rpt.accuracyPct).toBe('number');
    expect(typeof rpt.falsePositiveCount).toBe('number');
    expect(typeof rpt.falseNegativeCount).toBe('number');
  });
});
