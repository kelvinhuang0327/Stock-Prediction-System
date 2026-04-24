import { buildRelevantInsights } from '../RelevanceInsightsService';

jest.mock('@/lib/market/MarketRegimeEngine', () => ({
  detectRegime: jest.fn(),
}));

jest.mock('@/lib/events/EventSummaryEngine', () => ({
  getEventSummaryForSymbol: jest.fn(),
  getMarketEventSummary: jest.fn(),
}));

jest.mock('@/lib/events/TopicSurgeEngine', () => ({
  generateTopicSurgeSummary: jest.fn(),
}));

jest.mock('@/lib/portfolio/PortfolioImpactSnapshotEngine', () => ({
  getLatestPortfolioImpactSnapshot: jest.fn(),
}));

jest.mock('@/lib/portfolio/PortfolioImpactEngine', () => ({
  generatePortfolioImpacts: jest.fn(),
}));

jest.mock('@/lib/signals/SignalEffectivenessBatchService', () => ({
  buildSignalEffectivenessBatch: jest.fn(),
  buildDegradedSignalEffectivenessBatch: jest.fn(),
}));

jest.mock('@/lib/signals/SignalHistoryBuilder', () => ({
  buildAllSignalHistories: jest.fn(),
}));

const { detectRegime } = jest.requireMock('@/lib/market/MarketRegimeEngine');
const { getEventSummaryForSymbol, getMarketEventSummary } = jest.requireMock('@/lib/events/EventSummaryEngine');
const { generateTopicSurgeSummary } = jest.requireMock('@/lib/events/TopicSurgeEngine');
const { getLatestPortfolioImpactSnapshot } = jest.requireMock('@/lib/portfolio/PortfolioImpactSnapshotEngine');
const { generatePortfolioImpacts } = jest.requireMock('@/lib/portfolio/PortfolioImpactEngine');
const { buildSignalEffectivenessBatch, buildDegradedSignalEffectivenessBatch } = jest.requireMock('@/lib/signals/SignalEffectivenessBatchService');
const { buildAllSignalHistories } = jest.requireMock('@/lib/signals/SignalHistoryBuilder');

const emptyEventSummary = {
  eventCount: 0,
  rawCount: 0,
  dedupedCount: 0,
  recentThemes: [],
  catalystSummary: '事件資料不足',
  sourceBreakdown: {},
  trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0, dominant: 'mixed', note: '來源不足' },
  limitations: ['事件資料不足'],
  dataCoverage: 'insufficient',
  recentEventTitles: [],
};

describe('RelevanceInsightsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    detectRegime.mockResolvedValue({ regime: 'Bull', confidence: 78 });
    buildSignalEffectivenessBatch.mockResolvedValue({
      window: 5,
      results: [],
      generatedAt: new Date().toISOString(),
      limitations: [],
    });
    buildDegradedSignalEffectivenessBatch.mockResolvedValue({
      window: 5,
      results: [],
      generatedAt: new Date().toISOString(),
      limitations: ['degraded'],
    });
    buildAllSignalHistories.mockResolvedValue([]);
    getMarketEventSummary.mockResolvedValue({ summary: emptyEventSummary, source: 'empty' });
    getEventSummaryForSymbol.mockResolvedValue({ summary: emptyEventSummary, source: 'empty' });
    generateTopicSurgeSummary.mockResolvedValue({
      summary: '主題資料不足',
      topics: [],
      limitations: ['主題資料不足'],
      generatedAt: new Date().toISOString(),
    });
    getLatestPortfolioImpactSnapshot.mockResolvedValue({
      snapshot: {
        snapshotDate: '2026-03-19',
        scope: 'watchlist',
        symbols: [],
        summary: '尚無組合快照資料',
        themeConcentration: { topThemes: [], concentrationLevel: 'unknown', explanation: '資料不足' },
        sectorConcentration: { sectors: [], concentrationLevel: 'unknown', chainBias: 'unknown', explanation: '資料不足' },
        riskClusters: { overallRiskLevel: 'unknown', clusters: [] },
        regimeExposure: {
          regime: 'Unknown',
          confidence: 0,
          offensiveExposure: 0,
          defensiveExposure: 0,
          neutralExposure: 0,
          sensitivity: 'unknown',
          note: '資料不足',
        },
        limitations: ['portfolio snapshot 暫時不可用'],
      },
      comparison: {
        comparisonAvailable: false,
        previousSnapshotDate: null,
        compareWindow: '1d',
        themeChanged: false,
        sectorChanged: false,
        riskChanged: false,
        regimeExposureChanged: false,
        summaryNote: 'comparison unavailable',
        details: {
          themeLevelChange: { from: 'unknown', to: 'unknown' },
          sectorLevelChange: { from: 'unknown', to: 'unknown' },
          riskLevelChange: { from: 'unknown', to: 'unknown' },
          regimeChange: { from: 'Unknown', to: 'Unknown', fromSensitivity: 'unknown', toSensitivity: 'unknown' },
          topThemeChange: { from: null, to: null },
          topSectorChange: { from: null, to: null },
        },
      },
    });
    generatePortfolioImpacts.mockResolvedValue([
      {
        symbol: '2330',
        alphaContext: { alphaScore: 81, bucket: 'High Alpha', confidence: 76 },
        regimeContext: { regime: 'Bull', confidence: 78, implication: '順風環境' },
        topicContext: { topics: [] },
        eventContext: { eventCount: 0, recentAlertTypes: [], trustLevelSummary: '來源不足' },
        crossMarketContext: { spreadPattern: 'unavailable', spreadSpeed: 'unavailable', positionInChain: 'unclear' },
        riskContext: { riskLevel: 'elevated', warnings: ['估值波動偏高'] },
        narrative: '研究脈絡仍需保守解讀',
        limitations: ['portfolio impact limited'],
      },
    ]);
  });

  it('returns a conservative empty state when watchlist has no usable holdings', async () => {
    const result = await buildRelevantInsights({ mode: 'watchlist', maxItems: 3 });

    expect(result.insights).toEqual([]);
    expect(result.limitations).toContain('watchlist 缺少可用持倉資料，已保守降級為空狀態');
  });

  it('includes source drill-down metadata and factor breakdown for symbol insights', async () => {
    buildSignalEffectivenessBatch.mockResolvedValue({
      window: 5,
      results: [
        {
          signalType: 'strong_alpha_candidate',
          sampleSize: 38,
          hitRate: 0.63,
          avgReturn: 0.024,
          excessReturn: 0.011,
          stabilityScore: 0.82,
          classification: 'STRONG_SIGNAL',
          limitations: [],
          effectiveness: {
            signalType: 'strong_alpha_candidate',
            window: 5,
            sampleSize: 38,
            hitRate: 0.63,
            avgReturn: 0.024,
            excessReturn: 0.011,
            volatility: 0.02,
            regimeBreakdown: {
              bull: { sampleSize: 18, avgReturn: 0.03, hitRate: 0.67 },
              bear: { sampleSize: 8, avgReturn: -0.01, hitRate: 0.38 },
              neutral: { sampleSize: 12, avgReturn: 0.01, hitRate: 0.5 },
            },
            persistence: { avgDuration: 2.4, continuationRate: 0.42 },
            stabilityScore: 0.82,
            classification: 'STRONG_SIGNAL',
            limitations: [],
          },
        },
      ],
      generatedAt: new Date().toISOString(),
      limitations: [],
    });
    buildAllSignalHistories.mockResolvedValue([
      {
        signalType: 'strong_alpha_candidate',
        observations: [
          {
            signalType: 'strong_alpha_candidate',
            symbol: '2330',
            date: '2026-03-18',
            context: {},
          },
        ],
      },
    ]);

    const result = await buildRelevantInsights({ mode: 'symbol', symbol: '2330', maxItems: 3 });
    const signalInsight = result.insights.find((insight) => insight.category === 'signal');

    expect(signalInsight).toBeDefined();
    expect(signalInsight?.sourceTarget).toBe('/stocks/2330?tab=signals#stock-signal-effectiveness');
    expect(signalInsight?.sourceRef).toBe('訊號有效性（研究）');
    expect(signalInsight?.breakdown).toHaveLength(6);
  });
});
