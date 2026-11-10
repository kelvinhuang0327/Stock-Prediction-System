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

jest.mock('@/lib/events/TopicMomentumEngine', () => ({ generateTopicMomentum: jest.fn() }));
jest.mock('@/lib/events/ThemeDiffusionEngine', () => ({ generateThemeDiffusion: jest.fn() }));
jest.mock('@/lib/events/ThemeLinkageEngine', () => ({ generateThemeLinkage: jest.fn() }));
jest.mock('@/lib/events/SectorRelationGraphEngine', () => ({ generateSectorRelationGraph: jest.fn() }));
jest.mock('@/lib/events/CrossMarketThemeEngine', () => ({ generateCrossMarketTheme: jest.fn() }));
jest.mock('@/lib/events/SectorLinkageTimelineEngine', () => ({ generateSectorLinkageTimeline: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    watchlist: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    stockQuote: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    institutionalChip: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    monthlyRevenue: { count: jest.fn().mockResolvedValue(0) },
    marketIndex: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
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
import { buildComparison } from '@/lib/report/DailySnapshotEngine';
import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { getLatestMarketRegimeContext, computeFreshnessAlert } from '@/lib/marketRegimeResult';
import { getMarketEventSummary } from '@/lib/events/EventSummaryEngine';
import { generateTopicSurgeSummary } from '@/lib/events/TopicSurgeEngine';
import { generateTopicMomentum } from '@/lib/events/TopicMomentumEngine';
import { generateThemeDiffusion } from '@/lib/events/ThemeDiffusionEngine';
import { generateThemeLinkage } from '@/lib/events/ThemeLinkageEngine';
import { generateSectorRelationGraph } from '@/lib/events/SectorRelationGraphEngine';
import { generateCrossMarketTheme } from '@/lib/events/CrossMarketThemeEngine';
import { generateSectorLinkageTimeline } from '@/lib/events/SectorLinkageTimelineEngine';
import { evaluateAllSignals } from '@/lib/signals/SignalEffectivenessEngine';
import { prisma } from '@/lib/prisma';

const mockDetectRegime = detectRegime as jest.Mock;
const mockGetLatest = getLatestMarketRegimeContext as jest.Mock;
const mockComputeAlert = computeFreshnessAlert as jest.Mock;
const mockBuildComparison = buildComparison as jest.Mock;
const mockEventSummary = getMarketEventSummary as jest.Mock;
const mockTopicSurge = generateTopicSurgeSummary as jest.Mock;
const mockTopicMomentum = generateTopicMomentum as jest.Mock;
const mockThemeDiffusion = generateThemeDiffusion as jest.Mock;
const mockThemeLinkage = generateThemeLinkage as jest.Mock;
const mockSectorGraph = generateSectorRelationGraph as jest.Mock;
const mockCrossMarket = generateCrossMarketTheme as jest.Mock;
const mockTimeline = generateSectorLinkageTimeline as jest.Mock;
const mockEvaluateSignals = evaluateAllSignals as jest.Mock;
const mockPrisma = prisma as unknown as Record<string, Record<string, jest.Mock>>;

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
  regime: 'Bull' as const,
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

import { runScreen } from '@/lib/screen/StrategyScreenEngine';
const mockRunScreen = jest.mocked(runScreen);

beforeEach(() => {
  mockPrisma.watchlist.findMany.mockResolvedValue([]);
  mockPrisma.watchlist.count.mockResolvedValue(0);
  mockPrisma.stockQuote.findMany.mockResolvedValue([]);
  mockPrisma.stockQuote.findFirst.mockResolvedValue(null);
  mockPrisma.stockQuote.count.mockResolvedValue(0);
  mockPrisma.institutionalChip.findMany.mockResolvedValue([]);
  mockPrisma.institutionalChip.findFirst.mockResolvedValue(null);
  mockPrisma.institutionalChip.count.mockResolvedValue(0);
  mockPrisma.monthlyRevenue.count.mockResolvedValue(0);
  mockPrisma.marketIndex.findMany.mockResolvedValue([]);
  mockPrisma.marketIndex.findFirst.mockResolvedValue(null);
  mockPrisma.marketIndex.count.mockResolvedValue(0);
  mockDetectRegime.mockResolvedValue(MOCK_LIVE_REGIME);
  mockGetLatest.mockResolvedValue(MOCK_PERSISTED_CTX);
  mockComputeAlert.mockReturnValue(MOCK_FRESH_ALERT);
  mockRunScreen.mockResolvedValue(MOCK_SCREEN_RESULT);
  mockBuildComparison.mockResolvedValue({ comparisonAvailable: false });
  mockEventSummary.mockResolvedValue({
    summary: {
      eventCount: 0, rawCount: 0, dedupedCount: 0, recentThemes: [], catalystSummary: 'mock',
      sourceBreakdown: {}, trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed', note: 'mock' },
      limitations: [], dataCoverage: 'insufficient', recentEventTitles: [],
    },
    source: 'empty',
  });
  mockTopicSurge.mockResolvedValue({ summary: 'mock', topics: [], limitations: [], generatedAt: '2026-05-06T00:00:00Z' });
  mockTopicMomentum.mockResolvedValue({ momentumType: 'rising' });
  mockThemeDiffusion.mockResolvedValue({ diffusionType: 'broad' });
  mockThemeLinkage.mockResolvedValue({ linkedTopics: [] });
  mockSectorGraph.mockResolvedValue({ nodes: [], edges: [] });
  mockCrossMarket.mockResolvedValue({ spreadPattern: 'sector_expansion' });
  mockTimeline.mockResolvedValue({ stage: 'spreading' });
  mockEvaluateSignals.mockResolvedValue([]);
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

  it('summarizes candidates, watchlist movement, persisted sources, and topic linkages', async () => {
    const candidate = {
      symbol: '2330', name: 'TSMC', alphaScore: 90, recommendationBucket: 'Strong Candidate', confidence: 88,
      technicalScore: 90, chipScore: 80, fundamentalScore: 85, marketAdjustment: 0, riskLevel: 'low',
      screenBucket: 'Strong Candidate', whyIncluded: 'strong trend', topFactors: ['momentum'], keyRisks: ['volatility'],
      dataCoverage: 'full', usedSources: ['quote'], missingSources: [], limitations: [], summary: 'candidate',
    };
    mockRunScreen.mockResolvedValue({
      ...MOCK_SCREEN_RESULT,
      candidates: [candidate, { ...candidate, symbol: '2317', name: 'Foxconn', screenBucket: 'Watch' },
        { ...candidate, symbol: '2881', name: 'CTBC', screenBucket: 'Neutral' }],
      totalScanned: 3,
      excludedCount: 1,
    } as never);
    mockPrisma.watchlist.findMany.mockResolvedValue([
      { stockId: '2330', stock: { name: 'TSMC' } },
      { stockId: '2317', stock: { name: 'Foxconn' } },
      { stockId: '2881', stock: { name: 'CTBC' } },
    ]);
    mockPrisma.stockQuote.findMany.mockResolvedValue([
      { stockId: '2330', date: new Date('2026-05-06T00:00:00.000Z'), close: 100, volume: 1000 },
      { stockId: '2317', date: new Date('2026-05-06T00:00:00.000Z'), close: 80, volume: 500 },
    ]);
    mockPrisma.stockQuote.findFirst.mockImplementation(async ({ where }: {
      where?: { stockId?: string; date?: { lte?: string; lt?: Date } };
    }) => {
      if (where?.date?.lte) return where.stockId === '2330' ? { close: 80 } : { close: 90 };
      if (where?.date?.lt) return where.stockId === '2330' ? { close: 90 } : { close: 100 };
      return null;
    });
    mockPrisma.stockQuote.count.mockResolvedValue(20);
    mockPrisma.institutionalChip.count.mockResolvedValue(12);
    mockPrisma.monthlyRevenue.count.mockResolvedValue(6);
    mockPrisma.marketIndex.count.mockResolvedValue(4);
    mockPrisma.watchlist.count.mockResolvedValue(3);
    mockEventSummary.mockResolvedValue({
      summary: {
        eventCount: 4, rawCount: 5, dedupedCount: 1, recentThemes: ['AI伺服器'], catalystSummary: 'events',
        sourceBreakdown: { exchange: 2 }, trustLevelSummary: { official: 2, mainstream: 1, secondary: 1, unknown: 0, dominant: 'official', note: 'trusted' },
        limitations: [], dataCoverage: 'full', recentEventTitles: ['AI demand'],
      },
      source: 'db',
    });
    mockTopicSurge.mockResolvedValue({
      summary: 'one rising topic',
      topics: [{ topic: 'AI伺服器', trustLevelSummary: 'official 2 / mainstream 1' }],
      limitations: [],
      generatedAt: '2026-05-06T00:00:00Z',
    } as never);
    mockThemeLinkage.mockResolvedValue({ linkedTopics: [{ topic: '半導體', linkageStrength: 'strong' }] } as never);
    mockSectorGraph.mockResolvedValue({ nodes: [{ type: 'sector', label: '半導體' }], edges: [] } as never);
    mockCrossMarket.mockResolvedValue({ spreadPattern: 'sector_expansion' } as never);
    mockTimeline.mockResolvedValue({ stage: 'spreading' } as never);

    const report = await generateDailyReport({ candidateLimit: 1 });

    expect(report.candidateSummary).toMatchObject({
      strongCount: 1, watchCount: 1, neutralCount: 1, excludedCount: 1, totalScanned: 3,
    });
    expect(report.candidateSummary.strongCandidates).toHaveLength(1);
    expect(report.candidateSummary.watchCandidates[0].symbol).toBe('2317');
    expect(report.candidateSummary.keyReasons).toEqual(expect.arrayContaining([
      expect.stringContaining('1 檔股票達到 Strong Candidate'),
      expect.stringContaining('1 檔因分數不足'),
      expect.stringContaining('市場環境偏多'),
    ]));
    expect(report.watchlistSummary).toMatchObject({
      totalItems: 3, withQuoteData: 2,
      topGainers: [expect.objectContaining({ symbol: '2330', dailyChange: 11.11, weeklyChange: 25 })],
      topLosers: [expect.objectContaining({ symbol: '2317', dailyChange: -20, weeklyChange: -11.11 })],
      insufficientDataItems: ['2881'],
    });
    expect(report.riskSummary.overallRiskLevel).toBe('moderate');
    expect(report.riskSummary.cautionNotes).toEqual(expect.arrayContaining([
      expect.stringContaining('跌幅超過 3%'),
    ]));
    expect(report.eventSummary.limitations).not.toContain('目前使用即時來源 fallback，資料穩定性較低');
    expect(report.topicSummary.trendItems).toHaveLength(1);
    expect(report.themeLinkageSummary.items).toHaveLength(1);
    expect(report.crossMarketSummary.items).toHaveLength(1);
    expect(report.dataStatusSummary.overallCoverage).toBe('完整');
  });

  it('returns a coherent degraded report when live, event, watchlist, and comparison providers fail', async () => {
    mockDetectRegime.mockRejectedValue(new Error('regime unavailable'));
    mockGetLatest.mockRejectedValue(new Error('persisted regime unavailable'));
    mockRunScreen.mockRejectedValue(new Error('screen unavailable'));
    mockPrisma.watchlist.findMany.mockRejectedValue(new Error('watchlist unavailable'));
    mockEventSummary.mockRejectedValue(new Error('events unavailable'));
    mockTopicSurge.mockRejectedValue(new Error('topics unavailable'));
    mockEvaluateSignals.mockRejectedValue(new Error('signal reliability unavailable'));
    mockBuildComparison.mockRejectedValue(new Error('comparison unavailable'));

    const report = await generateDailyReport();

    expect(report.marketSummary.regime).toBe('Unknown');
    expect(report.marketSummary.regimeContext).toMatchObject({
      source: 'UNAVAILABLE', fallbackUsed: true, warning: 'Failed to fetch persisted MarketRegimeResult',
    });
    expect(report.eventSummary.limitations).toEqual(expect.arrayContaining([
      '事件來源抓取失敗，已降級為空資料',
      '目前使用即時來源 fallback，資料穩定性較低',
    ]));
    expect(report.watchlistSummary.historyNote).toBe('Watchlist 資料無法取得');
    expect(report.topicSummary.limitations).toContain('TopicSurgeEngine 不可用，已降級');
    expect(report.signalReliabilitySummary.limitations).toContain('訊號有效性研究層無法執行，已降級');
    expect(report.candidateSummary.keyReasons).toContain('目前無達到 Strong Candidate 門檻的候選股');
    expect(report.riskSummary.overallRiskLevel).toBe('unknown');
    expect(report.riskSummary.dataInsufficiencyWarning).toBe('候選股掃描無法執行，資料層可能有問題。');
    expect(report.comparison?.comparisonAvailable).toBe(false);
    expect(report.comparison?.market.note).toBe('比較功能暫時無法使用。');
  });

  it('surfaces stale persisted regime freshness without replacing the live regime', async () => {
    mockGetLatest.mockResolvedValue({
      ...MOCK_PERSISTED_CTX,
      freshnessStatus: 'STALE',
      freshnessLagDays: 5,
    });
    mockComputeAlert.mockReturnValue({
      alertLevel: 'STALE',
      freshnessLagDays: 5,
      lastRegimeDate: '2026-05-01',
      currentDate: '2026-05-06',
      message: 'Persisted context is five days old.',
      requiresAction: true,
    });

    const report = await generateDailyReport({ includeWatchlist: false });

    expect(report.marketSummary.regime).toBe('Bull');
    expect(report.marketSummary.regimeContext).toMatchObject({
      source: 'PERSISTED_MARKET_REGIME_RESULT',
      fallbackUsed: false,
      freshnessStatus: 'STALE',
      freshnessAlert: { alertLevel: 'STALE', requiresAction: true },
      warning: 'Persisted context is five days old.',
    });
  });

  it.each([
    { regime: 'Bear', confidence: 80, risk: 'high', marketText: '市場環境偏空', riskText: '整體風險較高' },
    { regime: 'Sideways', confidence: 30, risk: 'moderate', marketText: '偏震盪整理', riskText: '信心度偏低' },
  ])('summarizes $regime risk and confidence conditions', async ({ regime, confidence, risk, marketText, riskText }) => {
    mockDetectRegime.mockResolvedValue({ ...MOCK_LIVE_REGIME, regime, confidence } as never);
    mockRunScreen.mockResolvedValue({ ...MOCK_SCREEN_RESULT, regime } as never);

    const report = await generateDailyReport({ includeWatchlist: false });

    expect(report.marketSummary.summary).toContain(marketText);
    expect(report.riskSummary.overallRiskLevel).toBe(risk);
    expect(report.riskSummary.cautionNotes.join(' ')).toContain(riskText);
    if (regime === 'Bear') {
      expect(report.candidateSummary.keyReasons).toContain('市場環境偏空，候選門檻已自動提高');
    }
  });

  it('distinguishes an empty watchlist from partial market-data coverage', async () => {
    mockPrisma.stockQuote.count.mockResolvedValue(8);
    mockPrisma.institutionalChip.count.mockResolvedValue(3);

    const report = await generateDailyReport();

    expect(report.watchlistSummary).toMatchObject({
      totalItems: 0,
      withQuoteData: 0,
      historyNote: '自選清單目前為空',
      limitations: [],
    });
    expect(report.dataStatusSummary.overallCoverage).toBe('部分');
  });
});
