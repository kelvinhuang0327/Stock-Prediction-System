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

function populatedSnapshot(symbols: string[] = ['2330'], limitations: string[] = []) {
  return {
    snapshot: {
      snapshotDate: '2026-03-19',
      scope: 'watchlist',
      symbols,
      summary: '組合包含集中風險與市場題材變化',
      themeConcentration: { topThemes: [{ theme: 'AI', symbols: ['2330'] }], concentrationLevel: 'medium', explanation: 'AI 集中' },
      sectorConcentration: { sectors: [{ sector: '半導體', symbols: ['2330'] }], concentrationLevel: 'medium', chainBias: 'upstream', explanation: '半導體集中' },
      riskClusters: { overallRiskLevel: 'elevated', clusters: [{ clusterType: 'sector', reason: '產業集中', symbols: ['2330'] }] },
      regimeExposure: { regime: 'Bull', confidence: 78, offensiveExposure: 0.7, defensiveExposure: 0.1, neutralExposure: 0.2, sensitivity: 'high', note: '偏積極' },
      limitations,
    },
    comparison: {
      comparisonAvailable: true,
      previousSnapshotDate: '2026-03-18',
      compareWindow: '1d',
      themeChanged: true,
      sectorChanged: true,
      riskChanged: true,
      regimeExposureChanged: true,
      summaryNote: '組合結構與風險狀態較昨日改變',
      details: {
        themeLevelChange: { from: 'low', to: 'medium' },
        sectorLevelChange: { from: 'low', to: 'medium' },
        riskLevelChange: { from: 'medium', to: 'elevated' },
        regimeChange: { from: 'Neutral', to: 'Bull', fromSensitivity: 'low', toSensitivity: 'high' },
        topThemeChange: { from: '金融', to: 'AI' },
        topSectorChange: { from: '金融', to: '半導體' },
      },
    },
  };
}

function eventSummary(overrides: Record<string, unknown> = {}) {
  return {
    ...emptyEventSummary,
    eventCount: 5,
    rawCount: 6,
    dedupedCount: 5,
    recentThemes: ['AI server'],
    catalystSummary: 'AI 伺服器需求與供應鏈變化',
    trustLevelSummary: { official: 4, mainstream: 1, secondary: 0, unknown: 0, dominant: 'official', note: '高可信來源' },
    limitations: [],
    dataCoverage: 'full',
    recentEventTitles: ['Demand improves'],
    ...overrides,
  };
}

function signalResult(
  signalType: 'topic_surging' | 'theme_diffusing' | 'strong_alpha_candidate' | 'chip_accumulation_signal',
  sampleSize: number,
  classification: 'STRONG_SIGNAL' | 'CONDITIONAL_SIGNAL' | 'WEAK_SIGNAL' | 'NOISE',
  limitations: string[],
  avgDuration: number,
  continuationRate: number,
  regimeBreakdown = { bull: { sampleSize: 5, avgReturn: 0.02, hitRate: 0.6 }, bear: { sampleSize: 5, avgReturn: 0, hitRate: 0.5 }, neutral: { sampleSize: 5, avgReturn: -0.01, hitRate: 0.4 } },
) {
  const effectiveness = {
    signalType, window: 5, sampleSize, hitRate: 0.62, avgReturn: 0.024, excessReturn: 0.011,
    volatility: 0.02, regimeBreakdown, persistence: { avgDuration, continuationRate },
    stabilityScore: 0.82, classification, limitations,
  };
  return {
    signalType, sampleSize, hitRate: 0.62, avgReturn: 0.024, excessReturn: 0.011,
    stabilityScore: 0.82, classification, limitations, effectiveness,
  };
}

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

  it('requires a symbol for symbol mode and clamps the requested insight count', async () => {
    const missingSymbol = await buildRelevantInsights({ mode: 'symbol', maxItems: 0 });
    expect(missingSymbol.insights).toEqual([]);
    expect(missingSymbol.limitations).toEqual(['mode=symbol requires symbol']);
    expect(detectRegime).not.toHaveBeenCalled();

    const oneItem = await buildRelevantInsights({ mode: 'report', maxItems: 0 });
    expect(oneItem.insights).toHaveLength(1);

    const capped = await buildRelevantInsights({ mode: 'symbol', symbol: '2330', maxItems: 100 });
    expect(capped.insights.length).toBeLessThanOrEqual(10);
    expect(buildSignalEffectivenessBatch).toHaveBeenCalledWith({ symbol: '2330', window: 5 });
  });

  it.each([
    ['SIMULATION_DOMINATED', 5, { official: 0, mainstream: 0, secondary: 4, unknown: 1 }, '模擬主導'],
    ['INSUFFICIENT_EVENT_DATA', 0, { official: 5, mainstream: 0, secondary: 0, unknown: 0 }, '無明確高可信度事件催化'],
    ['MIXED_SOURCE', 3, { official: 3, mainstream: 1, secondary: 1, unknown: 0 }, 'AI server'],
    ['LIVE_CONFIDENT', 4, { official: 4, mainstream: 0, secondary: 0, unknown: 0 }, 'AI server'],
    ['LIVE_CONFIDENT', 4, { official: 1, mainstream: 1, secondary: 1, unknown: 1 }, 'AI server'],
  ])('applies the %s event-source trust guardrail', async (qualityLabel, count, trustCounts, summaryPart) => {
    getLatestPortfolioImpactSnapshot.mockResolvedValue(populatedSnapshot(['2330'], ['portfolio partial']));
    getMarketEventSummary.mockResolvedValue({
      summary: eventSummary({
        eventCount: count,
        trustLevelSummary: { ...trustCounts, dominant: 'mixed', note: 'fixture' },
        sourceQuality: {
          totalEvents: count,
          rssCount: Math.max(0, count - 2),
          mockCount: Math.min(count, 2),
          rssRatio: count ? Math.max(0, count - 2) / count : 0,
          mockRatio: count ? Math.min(count, 2) / count : 0,
          trustLevelBreakdown: trustCounts,
          qualityLabel,
          confidenceAdjustment: qualityLabel === 'LIVE_CONFIDENT' ? 'NONE' : 'LOWER',
          limitations: ['source limitation one', 'source limitation two', 'source limitation three'],
          explanation: 'fixture source quality',
        },
      }),
      source: 'fixture',
    });

    const result = await buildRelevantInsights({ mode: 'report', maxItems: 10 });
    const event = result.insights.find(insight => insight.category === 'event');

    expect(event).toBeDefined();
    expect(event?.summary.toLowerCase()).toContain(summaryPart.toLowerCase());
    expect(event?.qualityOverlay?.sections.eventSourceQuality).toBe(qualityLabel);
    if (qualityLabel === 'SIMULATION_DOMINATED') {
      expect(event?.limitations).toEqual(expect.arrayContaining(['[SIMULATION_DOMINATED] 事件研究結論以模擬來源為主（mock 40%），可信度大幅降低', 'source limitation three']));
    } else if (qualityLabel === 'INSUFFICIENT_EVENT_DATA') {
      expect(event?.limitations).toContain('[INSUFFICIENT_EVENT_DATA] 事件資料不足，無法形成可信研究結論');
    } else if (qualityLabel === 'MIXED_SOURCE') {
      expect(event?.limitations).toContain('[MIXED_SOURCE] 事件來源混合，含模擬事件 2 則，建議保守解讀');
      expect(event?.limitations).not.toContain('source limitation three');
    } else {
      expect(event?.limitations).toContain('source limitation one');
      expect(event?.limitations).not.toContain('source limitation two');
    }
  });

  it('builds report insights across portfolio, topic and signal quality branches', async () => {
    getLatestPortfolioImpactSnapshot.mockResolvedValue(populatedSnapshot(['2330', '2317', '2454', '2308', '2603'], ['first', 'second', 'third']));
    getMarketEventSummary.mockResolvedValue({ summary: eventSummary(), source: 'fixture' });
    generateTopicSurgeSummary.mockResolvedValue({
      summary: 'Topic fixtures',
      generatedAt: '2026-03-19T00:00:00.000Z',
      limitations: ['global topic caveat'],
      topics: [
        { topic: 'broad', recentCount: 8, previousCount: 1, delta: 7, surgeLevel: 'surging', diffusionLevel: 'broadening theme', relatedSymbols: ['2330'], trustLevelSummary: 'official 8 / mainstream 2 / secondary 0 / unknown 0', limitations: [] },
        { topic: 'mixed trust', recentCount: 4, previousCount: 2, delta: 2, surgeLevel: 'surging', diffusionLevel: 'single-stock theme', relatedSymbols: ['OTHER'], trustLevelSummary: 'official 1 / mainstream 1 / secondary 1 / unknown 2', limitations: ['one', 'two', 'three'] },
        { topic: 'empty counts', recentCount: 0, previousCount: 0, delta: 0, surgeLevel: 'none', diffusionLevel: 'single-stock theme', relatedSymbols: [], trustLevelSummary: 'official 0 / mainstream 0 / secondary 0 / unknown 0', limitations: [] },
        { topic: 'watch', recentCount: 2, previousCount: 2, delta: 0, surgeLevel: 'watch', diffusionLevel: 'multi-stock theme', relatedSymbols: ['OTHER'], trustLevelSummary: 'official 1 / mainstream 0 / secondary 3 / unknown 2', limitations: ['limited', 'secondary'] },
        { topic: 'fallback trust', recentCount: 1, previousCount: 1, delta: 0, surgeLevel: 'none', diffusionLevel: 'single-stock theme', relatedSymbols: [], trustLevelSummary: 'official source pending', limitations: ['unknown'] },
      ],
    });
    buildSignalEffectivenessBatch.mockResolvedValue({
      window: 5,
      generatedAt: '2026-03-19T00:00:00.000Z',
      limitations: [],
      results: [
        signalResult('strong_alpha_candidate', 40, 'STRONG_SIGNAL', [], 3, 0.1),
        signalResult('topic_surging', 15, 'NOISE', [], 1.1, 0.2, {
          bull: { sampleSize: 3, avgReturn: 0.02, hitRate: 0.6 },
          bear: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
          neutral: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
        }),
        signalResult('theme_diffusing', 5, 'CONDITIONAL_SIGNAL', ['missing source'], 2.2, 0.4, {
          bull: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
          bear: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
          neutral: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
        }),
        signalResult('chip_accumulation_signal', 8, 'WEAK_SIGNAL', ['ordinary limitation'], 0, 0, {
          bull: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
          bear: { sampleSize: 1, avgReturn: 0, hitRate: 0.5 },
          neutral: { sampleSize: 0, avgReturn: 0, hitRate: 0 },
        }),
      ],
    });
    buildAllSignalHistories.mockResolvedValue([
      { signalType: 'strong_alpha_candidate', observations: [{ signalType: 'strong_alpha_candidate', symbol: '2330', date: '2026-03-18', context: {} }], limitations: [] },
      { signalType: 'topic_surging', observations: [], limitations: [] },
    ]);

    const result = await buildRelevantInsights({ mode: 'report', maxItems: 20 });

    expect(result.insights).toHaveLength(10);
    expect(result.insights.some(insight => insight.category === 'portfolio')).toBe(true);
    expect(result.insights.some(insight => insight.category === 'risk')).toBe(true);
    expect(result.insights.some(insight => insight.category === 'event')).toBe(true);
    expect(result.insights.some(insight => insight.category === 'signal')).toBe(true);
    expect(result.insights.some(insight => insight.category === 'topic')).toBe(true);
    expect(getLatestPortfolioImpactSnapshot).toHaveBeenCalledWith({ scope: 'watchlist', comparison: true, compareWindow: '1d' });
  });

  it('keeps watchlist holdings and routes portfolio, risk, and topic insights to their source views', async () => {
    getLatestPortfolioImpactSnapshot.mockResolvedValue(populatedSnapshot(['2330']));
    generateTopicSurgeSummary.mockResolvedValue({
      summary: 'One topic', generatedAt: '2026-03-19T00:00:00.000Z', limitations: [],
      topics: [{ topic: 'AI', recentCount: 2, previousCount: 1, delta: 1, surgeLevel: 'watch', diffusionLevel: 'multi-stock theme', relatedSymbols: ['2330'], trustLevelSummary: 'official 2 / mainstream 0 / secondary 0 / unknown 0', limitations: [] }],
    });

    const result = await buildRelevantInsights({ mode: 'watchlist', maxItems: 10 });

    expect(result.insights.find(insight => insight.category === 'portfolio')?.sourceTarget).toBe('/watchlist#watchlist-portfolio-context');
    expect(result.insights.find(insight => insight.category === 'risk')?.sourceTarget).toBe('/watchlist#watchlist-risk-context');
    expect(result.insights.find(insight => insight.category === 'topic')?.title).toContain('AI');
    expect(result.limitations).not.toContain('watchlist 缺少可用持倉資料，已保守降級為空狀態');
  });

  it('falls back to degraded symbol evidence when every source rejects', async () => {
    detectRegime.mockRejectedValueOnce(new Error('regime unavailable'));
    buildSignalEffectivenessBatch.mockRejectedValueOnce(new Error('batch unavailable'));
    buildDegradedSignalEffectivenessBatch.mockResolvedValueOnce({ window: 5, results: [], generatedAt: '2026-03-19T00:00:00.000Z', limitations: ['degraded signal batch'] });
    buildAllSignalHistories.mockRejectedValueOnce(new Error('history unavailable'));
    getEventSummaryForSymbol.mockRejectedValueOnce(new Error('events unavailable'));
    generateTopicSurgeSummary.mockRejectedValueOnce(new Error('topics unavailable'));
    generatePortfolioImpacts.mockRejectedValueOnce(new Error('impact unavailable'));

    const result = await buildRelevantInsights({ mode: 'symbol', symbol: ' 2330 ', maxItems: 10 });

    expect(buildSignalEffectivenessBatch).toHaveBeenCalledWith({ symbol: '2330', window: 5 });
    expect(buildDegradedSignalEffectivenessBatch).toHaveBeenCalledWith(5, '2330', 'signal batch unavailable');
    expect(result.insights.some(insight => insight.category === 'risk' && insight.summary.includes('portfolio impact 暫時不可用'))).toBe(true);
    expect(result.insights.some(insight => insight.category === 'event' && insight.limitations.includes('事件資料暫時不可用'))).toBe(true);
    expect(result.insights.some(insight => insight.category === 'topic' && insight.summary.includes('缺少可用主題升溫資料'))).toBe(true);
  });

  it('uses the impact topic coverage fallback and handles an empty risk warning list', async () => {
    generatePortfolioImpacts.mockResolvedValue([{
      symbol: '2330',
      alphaContext: { alphaScore: 25, bucket: 'Moderate Alpha', confidence: 50 },
      regimeContext: { regime: 'Unknown', confidence: 0, implication: '資料不足' },
      topicContext: { topics: [] },
      eventContext: { eventCount: 0, recentAlertTypes: [], trustLevelSummary: '來源不足' },
      crossMarketContext: { spreadPattern: 'unavailable', spreadSpeed: 'unavailable', positionInChain: 'unclear' },
      riskContext: { riskLevel: 'low', warnings: [] },
      narrative: 'No urgent risk',
      limitations: [],
    }]);

    const result = await buildRelevantInsights({ mode: 'symbol', symbol: '2330', maxItems: 10 });
    const risk = result.insights.find(insight => insight.category === 'risk');

    expect(risk?.summary).toContain('目前無額外高優先風險警示');
    expect(risk?.limitations).toEqual([]);
  });

  it('uses the conservative report snapshot when portfolio and market sources fail', async () => {
    detectRegime.mockRejectedValueOnce(new Error('regime unavailable'));
    buildSignalEffectivenessBatch.mockRejectedValueOnce(new Error('batch unavailable'));
    buildDegradedSignalEffectivenessBatch.mockResolvedValueOnce({ window: 5, results: [], generatedAt: '2026-03-19T00:00:00.000Z', limitations: ['degraded'] });
    buildAllSignalHistories.mockRejectedValueOnce(new Error('history unavailable'));
    getMarketEventSummary.mockRejectedValueOnce(new Error('events unavailable'));
    generateTopicSurgeSummary.mockRejectedValueOnce(new Error('topics unavailable'));
    getLatestPortfolioImpactSnapshot.mockRejectedValueOnce(new Error('snapshot unavailable'));

    const result = await buildRelevantInsights({ mode: 'report', maxItems: -1 });

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]?.limitations).toContain('portfolio snapshot 暫時不可用');
    expect(result.insights[0]?.sourceTarget).toContain('/report/daily#');
  });
});
