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
import { detectRegime } from '../market/MarketRegimeEngine';
import { fuseBatch } from '../alpha/SignalFusionEngine';
import { generateEventAlerts } from '../events/EventAlertEngine';

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

jest.mock('../alpha/SignalFusionEngine', () => ({ fuseBatch: jest.fn().mockResolvedValue([]) }));
jest.mock('../events/EventAlertEngine', () => ({
  generateEventAlerts: jest.fn().mockResolvedValue({ summary: 'no events', alerts: [], limitations: [] }),
}));

import { runScreen } from '../screen/StrategyScreenEngine';

type MockPrismaType = {
  dailyMarketSnapshot: { findFirst: jest.Mock };
  dailyCandidateSnapshot: { findFirst: jest.Mock; findMany: jest.Mock };
  dailyWatchlistSnapshot: { findMany: jest.Mock };
  watchlist: { findMany: jest.Mock };
  stockQuote: { count: jest.Mock };
  institutionalChip: { count: jest.Mock };
  marketIndex: { count: jest.Mock };
};

const mockPrisma = prisma as unknown as MockPrismaType;

const mockMarketFindFirst = mockPrisma.dailyMarketSnapshot.findFirst;
const mockCandidateFindFirst = mockPrisma.dailyCandidateSnapshot.findFirst;
const mockCandidateFindMany = mockPrisma.dailyCandidateSnapshot.findMany;
const mockWatchlistFindMany = mockPrisma.watchlist.findMany;
const mockWatchlistSnapFindMany = mockPrisma.dailyWatchlistSnapshot.findMany;
const mockRunScreen = runScreen as jest.MockedFunction<typeof runScreen>;
const mockDetectRegime = detectRegime as jest.MockedFunction<typeof detectRegime>;
const mockFuseBatch = fuseBatch as jest.MockedFunction<typeof fuseBatch>;
const mockGenerateEventAlerts = generateEventAlerts as jest.MockedFunction<typeof generateEventAlerts>;


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
    mockPrisma.stockQuote.count.mockResolvedValue(100);
    mockPrisma.institutionalChip.count.mockResolvedValue(50);
    mockPrisma.marketIndex.count.mockResolvedValue(200);
    mockFuseBatch.mockResolvedValue([]);
    mockGenerateEventAlerts.mockResolvedValue({ summary: 'no events', alerts: [], limitations: [], generatedAt: TODAY });
    mockDetectRegime.mockResolvedValue({ regime: 'Bull', confidence: 75 } as never);
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
          symbol: '2330', name: '台積電', isETF: false, screenBucket: 'Strong Candidate',
          recommendationBucket: 'Strong Candidate', technicalScore: 75, chipScore: 70,
          fundamentalScore: 65, marketAdjustment: 5,
          alphaScore: 80, confidence: 65, priceChangePercent: 2.1, closePrice: 580,
          riskLevel: 'medium' as const, whyIncluded: '技術指標強勢', topFactors: [],
          keyRisks: [], limitations: [], dataCoverage: 'full' as const,
          usedSources: [], missingSources: [], summary: '測試候選',
        }],
        excluded: [], excludedCount: 0, totalScanned: 200,
        regime: 'Bull',
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
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY, 'Bull', 75));
      mockDetectRegime.mockResolvedValue({ regime: 'Bear', confidence: 30 } as never);

      const result = await generateDailyAlerts();

      const regimeAlert = result.alerts.find(a => a.type === 'market_regime_changed');
      expect(regimeAlert).toMatchObject({ severity: 'warning', previousValue: 'Bull', currentValue: 'Bear' });
      expect(regimeAlert?.body).toContain('偏低');
      expect(regimeAlert?.body).toContain('建議保守解讀所有訊號');
    });

    it.each([
      ['Bull', 'Sideways', 50, 'warning', '中等', '震盪環境'],
      ['Bull', 'Unknown', 80, 'warning', '較高', '環境不明'],
      ['Bear', 'Bull', 40, 'info', '中等', '偏多環境'],
    ])('uses the conservative message for %s → %s', async (previous, current, confidence, severity, confidenceLabel, tone) => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY, previous, 75));
      mockDetectRegime.mockResolvedValue({ regime: current, confidence } as never);
      const result = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false, includeEventAlerts: false });
      const regimeAlert = result.alerts.find((alert) => alert.type === 'market_regime_changed');
      expect(regimeAlert?.severity).toBe(severity);
      expect(regimeAlert?.body).toContain(confidenceLabel);
      expect(regimeAlert?.body).toContain(tone);
    });

    it('omits the comparison alert when regime detection fails', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      mockDetectRegime.mockRejectedValueOnce(new Error('market data unavailable'));
      const result = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false, includeEventAlerts: false });
      expect(result.alerts.some((alert) => alert.type === 'market_regime_changed')).toBe(false);
    });
  });

  describe('comparison changes and data coverage', () => {
    it('reports candidate upgrades, downgrades, alpha changes, and newly insufficient data', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      mockCandidateFindMany.mockResolvedValue([
        { symbol: 'UP', screenBucket: 'Watch', alphaScore: 50 },
        { symbol: 'DOWN', screenBucket: 'Strong Candidate', alphaScore: 70 },
        { symbol: 'FLAT', screenBucket: 'Neutral', alphaScore: 30 },
        { symbol: 'DATA', screenBucket: 'Watch', alphaScore: 40 },
        { symbol: 'EXCLUDED', screenBucket: 'Excluded', alphaScore: 20 },
      ]);
      mockRunScreen.mockResolvedValueOnce({
        candidates: [
          { symbol: 'UP', name: '升級', screenBucket: 'Strong Candidate', alphaScore: 60, whyIncluded: 'strength', dataCoverage: 'full' },
          { symbol: 'DOWN', name: '降級', screenBucket: 'Excluded', alphaScore: 60, whyIncluded: '', dataCoverage: 'limited' },
          { symbol: 'FLAT', name: '改善', screenBucket: 'Neutral', alphaScore: 36, whyIncluded: '', dataCoverage: 'full' },
          { symbol: 'DATA', name: '資料不足', screenBucket: 'Watch', alphaScore: 40, whyIncluded: '', dataCoverage: 'insufficient' },
          { symbol: 'EXCLUDED', name: '排除', screenBucket: 'Watch', alphaScore: 20, whyIncluded: '', dataCoverage: 'insufficient' },
        ],
      } as never);

      const result = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false, includeEventAlerts: false });
      expect(result.alerts.map((alert) => alert.type)).toEqual(expect.arrayContaining([
        'candidate_upgraded', 'candidate_downgraded', 'alpha_improved', 'alpha_dropped', 'newly_insufficient_data',
      ]));
      expect(result.alerts.find((alert) => alert.type === 'candidate_downgraded')?.severity).toBe('caution');
      expect(result.alerts.filter((alert) => alert.type === 'newly_insufficient_data')).toHaveLength(1);
    });

    it('keeps going when candidate screening or snapshot lookups fail', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      mockCandidateFindMany.mockRejectedValueOnce(new Error('snapshot unavailable'));
      mockPrisma.stockQuote.count.mockRejectedValueOnce(new Error('quotes unavailable'));
      mockPrisma.institutionalChip.count.mockRejectedValueOnce(new Error('chips unavailable'));
      mockPrisma.marketIndex.count.mockRejectedValueOnce(new Error('index unavailable'));
      mockRunScreen.mockRejectedValueOnce(new Error('screen failed'));
      const result = await generateDailyAlerts({ includeWatchlist: false, includeEventAlerts: false });
      expect(result.limitations).toContain('StrategyScreenEngine 無法執行，候選升降級提醒略過。');
      expect(result.alerts.map((alert) => alert.type)).toContain('data_quality_warning');
    });

    it('emits stock-quote and market-index warnings, and honors disabled data warnings', async () => {
      mockPrisma.stockQuote.count.mockResolvedValue(0);
      mockPrisma.institutionalChip.count.mockResolvedValue(0);
      mockPrisma.marketIndex.count.mockResolvedValue(99);
      const missingQuotes = await generateDailyAlerts({ includeWatchlist: false, includeEventAlerts: false });
      expect(missingQuotes.alerts.filter((alert) => alert.type === 'data_quality_warning')).toHaveLength(2);
      expect(missingQuotes.overallSeverity).toBe('warning');

      mockPrisma.stockQuote.count.mockResolvedValue(10);
      const missingChips = await generateDailyAlerts({ includeWatchlist: false, includeEventAlerts: false });
      expect(missingChips.alerts.some((alert) => alert.title === '法人籌碼資料缺失')).toBe(true);

      const withoutWarnings = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false, includeEventAlerts: false });
      expect(mockPrisma.stockQuote.count).toHaveBeenCalledTimes(2);
      expect(withoutWarnings.alerts.some((alert) => alert.type === 'data_quality_warning')).toBe(false);
    });
  });

  describe('watchlist and event reminders', () => {
    it('reports watchlist risk escalation and newly insufficient scoring', async () => {
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      mockWatchlistSnapFindMany.mockResolvedValue([
        { symbol: '2330', alphaScore: null, riskLevel: null, recommendationBucket: null },
        { symbol: '2317', alphaScore: null, riskLevel: 'low', recommendationBucket: 'Watch' },
      ]);
      mockWatchlistFindMany.mockResolvedValue([
        { stockId: '2330', stock: { name: '台積電' } },
        { stockId: '2317', stock: null },
      ]);
      mockFuseBatch.mockResolvedValue([
        { symbol: '2330', alphaScore: 30, recommendationBucket: 'Insufficient Data' },
        { symbol: '2317', alphaScore: 50, recommendationBucket: 'Strong Candidate' },
      ] as never);

      const result = await generateDailyAlerts({ includeDataWarnings: false, includeEventAlerts: false });
      expect(result.alerts.map((alert) => alert.type)).toContain('watchlist_risk_escalated');
      expect(result.alerts.some((alert) => alert.type === 'newly_insufficient_data' && alert.symbol === '2330')).toBe(true);
      expect(result.alerts.find((alert) => alert.type === 'watchlist_risk_escalated')?.body).toContain('?');
    });

    it('deduplicates and sorts event alerts, and degrades when the event engine fails', async () => {
      mockGenerateEventAlerts
        .mockResolvedValueOnce({ summary: 'market summary', alerts: [{ type: 'market_event_increase', severity: 'warning', title: 'same', message: 'market' }], limitations: ['m'] } as never)
        .mockResolvedValueOnce({ summary: 'watch summary', alerts: [{ type: 'market_event_increase', severity: 'info', title: 'same', message: 'duplicate' }, { type: 'catalyst_watch', severity: 'caution', title: 'watch', message: 'watch' }], limitations: ['w'] } as never)
        .mockResolvedValueOnce({ summary: 'candidate summary', alerts: [], limitations: ['c'] } as never);
      mockMarketFindFirst.mockResolvedValue(makeMarketSnapshot(YESTERDAY));
      mockDetectRegime.mockResolvedValue({ regime: 'Bear', confidence: 75 } as never);
      const result = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false, minSeverity: 'info', maxItems: 1 });
      expect(result.eventAlertSummary).toBe('market summary；watch summary；candidate summary');
      expect(result.eventAlerts.map((alert) => alert.title)).toEqual(['same', 'watch']);
      expect(result.eventAlerts[0].severity).toBe('warning');
      expect(result.limitations).toEqual(expect.arrayContaining(['[event/market] m', '[event/watchlist] w', '[event/candidates] c']));
      expect(result.alerts).toHaveLength(1);

      mockGenerateEventAlerts.mockRejectedValueOnce(new Error('event service down'));
      const degraded = await generateDailyAlerts({ includeDataWarnings: false, includeWatchlist: false });
      expect(degraded.eventAlertSummary).toBe('事件提醒暫時不可用（已降級）');
      expect(degraded.limitations).toContain('事件提醒引擎不可用，已降級略過 event alerts');
      expect(degraded.eventAlerts).toEqual([]);
    });
  });
});

