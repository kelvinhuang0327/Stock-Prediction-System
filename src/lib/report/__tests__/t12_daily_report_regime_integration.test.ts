/**
 * T-12: DailyReportEngine Deeper Integration Tests
 *
 * Tests that DailyReportEngine includes persisted MarketRegimeResult
 * as marketSummary.regimeContext. No DB writes, no strategy signals,
 * no ROI/win-rate, no H001-H012.
 */

// Mock all heavy dependencies before imports
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/market/MarketRegimeEngine', () => ({
  detectRegime: jest.fn(),
}));

jest.mock('@/lib/marketRegimeResult', () => ({
  getLatestMarketRegimeContext: jest.fn(),
  computeFreshnessAlert: jest.fn(),
  DEFAULT_CURRENT_DATE: '2026-05-06',
}));

jest.mock('@/lib/screen/StrategyScreenEngine', () => ({
  runScreen: jest.fn(),
}));

jest.mock('@/lib/report/DailySnapshotEngine', () => ({
  buildComparison: jest.fn().mockResolvedValue({ comparisonAvailable: false }),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    watchlist: { findMany: jest.fn().mockResolvedValue([]) },
    stockQuote: { findMany: jest.fn().mockResolvedValue([]) },
    marketIndex: { findMany: jest.fn().mockResolvedValue([]) },
    financialReport: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock('@/lib/events/EventSummaryEngine', () => ({
  getMarketEventSummary: jest.fn().mockResolvedValue({
    summary: {
      eventCount: 0, rawCount: 0, dedupedCount: 0, recentThemes: [],
      catalystSummary: 'mock', sourceBreakdown: {},
      trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed', note: 'mock' },
      limitations: [], dataCoverage: 'insufficient', recentEventTitles: [],
    },
    source: 'empty',
  }),
}));

jest.mock('@/lib/events/TopicSurgeEngine', () => ({
  generateTopicSurgeSummary: jest.fn().mockResolvedValue({
    summary: 'mock', topics: [], limitations: [], generatedAt: '2026-05-06T00:00:00Z',
  }),
}));

jest.mock('@/lib/signals/SignalEffectivenessEngine', () => ({
  buildSignalEffectivenessSummary: jest.fn().mockReturnValue({
    window: 5, signals: [], generatedAt: '2026-05-06T00:00:00Z',
    dataNote: 'mock', limitations: [],
  }),
  evaluateAllSignals: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/signals/SignalHistoryBuilder', () => ({
  buildAllSignalHistories: jest.fn().mockResolvedValue([]),
}));

// Silence console.error in tests
jest.spyOn(console, 'error').mockImplementation(() => {});

import { generateDailyReport } from '@/lib/report/DailyReportEngine';
import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { getLatestMarketRegimeContext, computeFreshnessAlert } from '@/lib/marketRegimeResult';

const mockDetectRegime = detectRegime as jest.Mock;
const mockGetLatest = getLatestMarketRegimeContext as jest.Mock;
const mockComputeAlert = computeFreshnessAlert as jest.Mock;

const MOCK_LIVE_REGIME = {
  regime: 'Bull' as const,
  confidence: 80,
  factors: [],
  dataCoverage: 'full' as const,
  samplePeriod: '90d',
  dataPoints: 90,
  last_updated: '2026-05-06T00:00:00Z',
  limitations: [],
};

const MOCK_PERSISTED_CTX = {
  isAvailable: true,
  date: '2026-05-06',
  regimeLabel: 'BULL' as const,
  confidence: 1.0,
  taiexClose: 41138.85,
  source: 'P4_03_MARKET_REGIME_CLASSIFIER',
  version: 'p4_03b_v1',
  freshnessStatus: 'FRESH' as const,
  freshnessLagDays: 0,
  warning: null,
};

const MOCK_FRESH_ALERT = {
  alertLevel: 'FRESH' as const,
  freshnessLagDays: 0,
  lastRegimeDate: '2026-05-06',
  currentDate: '2026-05-06',
  message: null,
  requiresAction: false,
};

const MOCK_SCREEN_RESULT = {
  regime: 'Bull',
  regimeConfidence: 80,
  candidates: [],
  excludedCount: 0,
  excluded: [],
  totalScanned: 0,
  dataCoverageSummary: { full: 0, limited: 0, insufficient: 0 },
  screenParams: {
    minAlphaScore: 60,
    minConfidence: 60,
    respectMarketRegime: true,
    appliedRegimeAdjustment: 'none',
  },
  last_updated: '2026-05-06T00:00:00Z',
  limitations: [],
  disclaimer: 'mock',
};

const FORBIDDEN_FIELDS = [
  'buy', 'sell', 'signal', 'roi', 'win_rate', 'alpha',
  'edge', 'profit', 'recommendation', 'outperform',
];

function flatKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return [key, ...flatKeys(v, key)];
  });
}

const { runScreen } = require('@/lib/screen/StrategyScreenEngine');
const mockRunScreen = runScreen as jest.Mock;

beforeEach(() => {
  mockDetectRegime.mockResolvedValue(MOCK_LIVE_REGIME);
  mockGetLatest.mockResolvedValue(MOCK_PERSISTED_CTX);
  mockComputeAlert.mockReturnValue(MOCK_FRESH_ALERT);
  mockRunScreen.mockResolvedValue(MOCK_SCREEN_RESULT);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('T-12: DailyReportEngine Deeper Integration', () => {
  it('generates report with marketSummary.regimeContext', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext).toBeDefined();
  });

  it('regimeContext.source = PERSISTED_MARKET_REGIME_RESULT when available', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.source).toBe('PERSISTED_MARKET_REGIME_RESULT');
  });

  it('regimeContext.regimeLabel = BULL from persisted result', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.regimeLabel).toBe('BULL');
  });

  it('regimeContext.freshnessAlert.alertLevel = FRESH', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.freshnessAlert.alertLevel).toBe('FRESH');
  });

  it('regimeContext.freshnessAlert.requiresAction = false for FRESH', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.freshnessAlert.requiresAction).toBe(false);
  });

  it('regimeContext.fallbackUsed = false when persisted data available', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.fallbackUsed).toBe(false);
  });

  it('regimeContext.date matches persisted date', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.date).toBe('2026-05-06');
  });

  it('regimeContext.confidence = 1.0', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.confidence).toBe(1.0);
  });

  it('fallback to UNAVAILABLE when persisted context missing', async () => {
    mockGetLatest.mockResolvedValue({
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: 'No records',
    });
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regimeContext?.source).toBe('UNAVAILABLE');
    expect(report.marketSummary.regimeContext?.fallbackUsed).toBe(true);
    expect(report.marketSummary.regimeContext?.freshnessAlert.alertLevel).toBe('MISSING');
  });

  it('existing live regime fields preserved (regime, regimeConfidence, summary)', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regime).toBe('Bull');
    expect(report.marketSummary.regimeConfidence).toBe(80);
    expect(typeof report.marketSummary.summary).toBe('string');
    expect(report.marketSummary.summary.length).toBeGreaterThan(0);
  });

  it('does not contain forbidden fields', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    const keys = flatKeys(report.marketSummary.regimeContext).map(k => k.split('.').pop()!.toLowerCase());
    FORBIDDEN_FIELDS.forEach(field => {
      expect(keys).not.toContain(field);
    });
  });

  it('does not reference H001-H012 hypothesis codes', async () => {
    const report = await generateDailyReport({ includeWatchlist: false });
    const jsonStr = JSON.stringify(report.marketSummary.regimeContext);
    for (let i = 1; i <= 12; i++) {
      const code = `H${String(i).padStart(3, '0')}`;
      expect(jsonStr).not.toContain(`"${code}"`);
    }
  });

  it('getLatestMarketRegimeContext called once per report generation', async () => {
    await generateDailyReport({ includeWatchlist: false });
    expect(mockGetLatest).toHaveBeenCalledTimes(1);
  });

  it('persisted regime data is not used to modify live regime or candidates', async () => {
    // The live regime (detectRegime) should be called independently
    await generateDailyReport({ includeWatchlist: false });
    expect(mockDetectRegime).toHaveBeenCalledTimes(1);
    // persisted context is additive only — regimeContext is separate from regime
    const report = await generateDailyReport({ includeWatchlist: false });
    expect(report.marketSummary.regime).toBe('Bull'); // live regime unchanged
    expect(report.marketSummary.regimeContext?.regimeLabel).toBe('BULL'); // persisted separate
  });
});
