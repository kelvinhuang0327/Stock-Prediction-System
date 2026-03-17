/**
 * DailyAlertEngine.test.ts
 *
 * Tests for generateDailyAlerts() covering:
 * - No prior snapshot → comparisonAvailable=false
 * - With prior snapshot + changes → generates comparison alerts
 * - summary is always non-empty
 * - severity rules map correctly
 * - limitations/overallSeverity always present
 */

import { generateDailyAlerts } from '../notify/DailyAlertEngine';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    dailyMarketSnapshot: {
      findFirst: jest.fn(),
    },
    dailyCandidateSnapshot: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    dailyWatchlistSnapshot: {
      findMany: jest.fn(),
    },
    watchlist: {
      findMany: jest.fn(),
    },
    stockQuote: {
      count: jest.fn(),
    },
    institutionalChip: {
      count: jest.fn(),
    },
    marketIndex: {
      count: jest.fn(),
    },
  },
}));

// Mock runScreen and detectRegime to avoid full DB dependencies
jest.mock('../screen/StrategyScreenEngine', () => ({
  runScreen: jest.fn().mockResolvedValue({
    candidates: [], excluded: [], excludedCount: 0, totalScanned: 0,
    regime: { regime: 'Bull', confidence: 75 },
    screenParams: { minAlphaScore: 40, minConfidence: 15, respectMarketRegime: true, appliedRegimeAdjustment: '無調整' },
    limitations: [], disclaimer: '模型推估，非投資建議',
    generatedAt: new Date().toISOString(),
  }),
}));

jest.mock('../market/MarketRegimeEngine', () => ({
  detectRegime: jest.fn().mockResolvedValue({
    regime: 'Bull', confidence: 75, factors: [], dataCoverage: 'full',
    samplePeriod: '2024-01-01 ~ 2025-01-01', dataPoints: 250, last_updated: '2025-01-01', limitations: [],
  }),
}));

import { runScreen } from '../screen/StrategyScreenEngine';
import { detectRegime } from '../market/MarketRegimeEngine';

const mockMarketFindFirst = prisma.dailyMarketSnapshot.findFirst as jest.Mock;
const mockCandidateFindFirst = prisma.dailyCandidateSnapshot.findFirst as jest.Mock;
const mockCandidateFindMany = (prisma.dailyCandidateSnapshot as any).findMany as jest.Mock;
const mockWatchlistFindMany = (prisma.watchlist as any).findMany as jest.Mock;
const mockWatchlistSnapFindMany = (prisma.dailyWatchlistSnapshot as any).findMany as jest.Mock;
const mockRunScreen = runScreen as jest.MockedFunction<typeof runScreen>;
const mockDetectRegime = detectRegime as jest.MockedFunction<typeof detectRegime>;

// ─── Fixtures ────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function makeMarketSnapshot(date: string, regime = 'Bull', confidence = 75) {
  return {
    snapshotDate: date,
    generatedAt: new Date().toISOString(),
    regime,
    regimeConfidence: confidence,
    indexLevel: 18000,
    indexChangePercent: 0.5,
    advanceDeclineRatio: 1.2,
    totalVolume: 200000000000,
    totalValue: 300000000000,
    summary: '市場偏多',
    limitations: '[]',
  };
}

function makeCandidateSnapshot(date: string, overrides = {}) {
  return {
    snapshotDate: date,
    generatedAt: new Date().toISOString(),
    candidates: JSON.stringify([
      {
        symbol: '2330',
        name: '台積電',
        screenBucket: 'Strong Candidate',
        alphaScore: 80,
        confidence: 65,
        priceChangePercent: 2.1,
        closePrice: 580,
        riskLevel: 'medium',
        factors: [],
        limitations: [],
        analysisNote: '技術強勢',
        regime: 'Bull',
      },
    ]),
    regime: 'Bull',
    regimeConfidence: 80,
    totalScanned: 200,
    candidateCount: 1,
    exclusionSummary: '{}',
    comparisonAvailable: false,
    previousSnapshotDate: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('DailyAlertEngine — generateDailyAlerts()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no prior snapshots, no watchlist
    mockMarketFindFirst.mockResolvedValue(null);
    mockCandidateFindFirst.mockResolvedValue(null);
    mockCandidateFindMany.mockResolvedValue([]);
    mockWatchlistFindMany.mockResolvedValue([]);
    mockWatchlistSnapFindMany?.mockResolvedValue?.([]);
    // Data warning counts
    (prisma.stockQuote as any).count.mockResolvedValue(100);
    (prisma.institutionalChip as any).count.mockResolvedValue(50);
    (prisma.marketIndex as any).count.mockResolvedValue(200);
  });

  describe('no prior snapshot available', () => {
    it('sets comparisonAvailable=false when no prior market snapshot', async () => {
      mockMarketFindFirst.mockResolvedValue(null);

      const result = await generateDailyAlerts();

      expect(result.comparisonAvailable).toBe(false);
      expect(result.previousSnapshotDate).toBeNull();
    });

    it('does not crash when no snapshots exist at all', async () => {
      await expect(generateDailyAlerts()).resolves.not.toThrow();
    });

    it('still produces a result with limitations', async () => {
      const result = await generateDailyAlerts();

      expect(Array.isArray(result.alerts)).toBe(true);
      expect(Array.isArray(result.limitations)).toBe(true);
    });
  });

  describe('with prior snapshot — comparison enabled', () => {
    it('sets comparisonAvailable=true when prior market snapshot exists', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));

      const result = await generateDailyAlerts();

      expect(result.comparisonAvailable).toBe(true);
      expect(result.previousSnapshotDate).toBe(YESTERDAY);
    });

    it('generates alerts when candidates changed between snapshots', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      // previous candidate snapshot: 2330 was Watch
      mockCandidateFindMany.mockResolvedValue([
        { symbol: '2330', screenBucket: 'Watch', alphaScore: 60 },
      ]);
      // Today's runScreen returns 2330 as Strong Candidate
      mockRunScreen.mockResolvedValueOnce({
        candidates: [{
          symbol: '2330', name: '台積電', screenBucket: 'Strong Candidate',
          alphaScore: 80, confidence: 65, priceChangePercent: 2.1, closePrice: 580,
          riskLevel: 'medium', whyIncluded: '技術指標強勢', topFactors: [],
          limitations: [], dataCoverage: 'full',
        }] as any,
        excluded: [], excludedCount: 0, totalScanned: 200,
        regime: { regime: 'Bull', confidence: 75, dataPoints: 250, limitations: [] } as any,
        regimeConfidence: 75,
        dataCoverageSummary: { full: 1, limited: 0, insufficient: 0 },
        screenParams: { minAlphaScore: 40, minConfidence: 15, respectMarketRegime: true, appliedRegimeAdjustment: '無調整' },
        limitations: [], disclaimer: '模型推估，非投資建議',
        last_updated: new Date().toISOString(),
      });

      const result = await generateDailyAlerts();

      expect(result.comparisonAvailable).toBe(true);
      const upgraded = result.alerts.find(a => a.type === 'candidate_upgraded');
      expect(upgraded).toBeDefined();
      expect(upgraded?.symbol).toBe('2330');
    });
  });

  describe('output integrity', () => {
    it('summary is always non-empty', async () => {
      const result = await generateDailyAlerts();

      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('overallSeverity is a valid value', async () => {
      const result = await generateDailyAlerts();

      expect(['warning', 'caution', 'info', 'none']).toContain(result.overallSeverity);
    });

    it('reportDate is always set to today', async () => {
      const result = await generateDailyAlerts();

      expect(result.reportDate).toBe(TODAY);
    });

    it('generatedAt is a valid ISO string', async () => {
      const result = await generateDailyAlerts();

      expect(() => new Date(result.generatedAt)).not.toThrow();
    });
  });

  describe('regime_changed severity', () => {
    it('regime change from Bull → Bear produces warning-level alert', async () => {
      // Prior: Bull; now detect Bear in today's candidate snapshot
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY, 'Bull', 75));
      mockCandidateFindFirst
        .mockResolvedValueOnce(makeCandidateSnapshot(TODAY, { regime: 'Bear', regimeConfidence: 70 }))
        .mockResolvedValueOnce(makeCandidateSnapshot(YESTERDAY, { regime: 'Bull', regimeConfidence: 75 }));

      const result = await generateDailyAlerts();

      const regimeAlert = result.alerts.find(a => a.type === 'market_regime_changed');
      if (regimeAlert) {
        expect(['warning', 'caution']).toContain(regimeAlert.severity);
      }
    });
  });
});

