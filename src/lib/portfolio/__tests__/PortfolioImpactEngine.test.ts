import { generatePortfolioDecisionSupport, generatePortfolioImpacts } from '../PortfolioImpactEngine';

jest.mock('@/lib/market/MarketRegimeEngine', () => ({
  detectRegime: jest.fn(),
}));
jest.mock('@/lib/alpha/SignalFusionEngine', () => ({
  fuseBatch: jest.fn(),
}));
jest.mock('@/lib/events/EventSummaryEngine', () => ({
  getEventSummaryForSymbol: jest.fn(),
}));
jest.mock('@/lib/events/EventAlertEngine', () => ({
  generateEventAlerts: jest.fn(),
}));
jest.mock('@/lib/events/TopicSurgeEngine', () => ({
  generateTopicSurgeSummary: jest.fn(),
}));
jest.mock('@/lib/events/TopicMomentumEngine', () => ({
  generateTopicMomentum: jest.fn(),
}));
jest.mock('@/lib/events/ThemeDiffusionEngine', () => ({
  generateThemeDiffusion: jest.fn(),
}));
jest.mock('@/lib/events/CrossMarketThemeEngine', () => ({
  generateCrossMarketTheme: jest.fn(),
}));
jest.mock('@/lib/events/SectorLinkageTimelineEngine', () => ({
  generateSectorLinkageTimeline: jest.fn(),
}));
jest.mock('@/lib/events/ThemeLinkageEngine', () => ({
  generateThemeLinkage: jest.fn(),
}));
jest.mock('@/lib/events/SectorRelationGraphEngine', () => ({
  generateSectorRelationGraph: jest.fn(),
}));
jest.mock('@/lib/research/MultiAgentResearchEngine', () => ({
  runMultiAgentResearch: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    stock: { findMany: jest.fn() },
  },
}));

import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { fuseBatch } from '@/lib/alpha/SignalFusionEngine';
import { getEventSummaryForSymbol } from '@/lib/events/EventSummaryEngine';
import { generateEventAlerts } from '@/lib/events/EventAlertEngine';
import { generateTopicSurgeSummary } from '@/lib/events/TopicSurgeEngine';
import { generateTopicMomentum } from '@/lib/events/TopicMomentumEngine';
import { generateThemeDiffusion } from '@/lib/events/ThemeDiffusionEngine';
import { generateCrossMarketTheme } from '@/lib/events/CrossMarketThemeEngine';
import { generateSectorLinkageTimeline } from '@/lib/events/SectorLinkageTimelineEngine';
import { generateThemeLinkage } from '@/lib/events/ThemeLinkageEngine';
import { generateSectorRelationGraph } from '@/lib/events/SectorRelationGraphEngine';
import { runMultiAgentResearch } from '@/lib/research/MultiAgentResearchEngine';
import { prisma } from '@/lib/prisma';

const mockDetectRegime = detectRegime as jest.Mock;
const mockFuseBatch = fuseBatch as jest.Mock;
const mockEventSummary = getEventSummaryForSymbol as jest.Mock;
const mockEventAlerts = generateEventAlerts as jest.Mock;
const mockTopicSurge = generateTopicSurgeSummary as jest.Mock;
const mockMomentum = generateTopicMomentum as jest.Mock;
const mockDiffusion = generateThemeDiffusion as jest.Mock;
const mockCross = generateCrossMarketTheme as jest.Mock;
const mockTimeline = generateSectorLinkageTimeline as jest.Mock;
const mockThemeLinkage = generateThemeLinkage as jest.Mock;
const mockSectorGraph = generateSectorRelationGraph as jest.Mock;
const mockResearch = runMultiAgentResearch as jest.Mock;
const mockStockFindMany = prisma.stock.findMany as jest.Mock;

describe('PortfolioImpactEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectRegime.mockResolvedValue({ regime: 'Bull', confidence: 72 });
    mockFuseBatch.mockResolvedValue([
      { symbol: '2330', alphaScore: 78, recommendationBucket: 'Strong Candidate', confidence: 68 },
    ]);
    mockEventSummary.mockResolvedValue({
      summary: {
        eventCount: 3,
        trustLevelSummary: { official: 1, mainstream: 1, secondary: 1, unknown: 0 },
      },
    });
    mockEventAlerts.mockResolvedValue({ alerts: [{ type: 'symbol_new_event' }] });
    mockTopicSurge.mockResolvedValue({
      topics: [{ topic: 'AI伺服器' }],
    });
    mockMomentum.mockResolvedValue({ momentumType: 'rising' });
    mockDiffusion.mockResolvedValue({ diffusionType: 'broad' });
    mockCross.mockResolvedValue({
      spreadPattern: 'sector_expansion',
      spreadSpeed: 'moderate',
      originCluster: { symbols: ['2330'] },
      spreadClusters: [],
    });
    mockTimeline.mockResolvedValue({ stage: 'spreading' });
    mockThemeLinkage.mockResolvedValue({ linkedTopics: [] });
    mockSectorGraph.mockResolvedValue({ nodes: [], edges: [] });
    mockResearch.mockReturnValue({
      viewpoints: [{ name: 'RiskAgent', limitations: [] }],
      keyRisks: [],
      limitations: [],
    });
    mockStockFindMany.mockResolvedValue([{ id: '2330', industry: '半導體業' }]);
  });

  it('generates narrative with alpha, regime, and topic context', async () => {
    const results = await generatePortfolioImpacts(['2330']);
    expect(results[0].symbol).toBe('2330');
    expect(results[0].narrative).toMatch(/Alpha 78/);
    expect(results[0].narrative).toMatch(/Bull/);
    expect(results[0].narrative).toMatch(/AI伺服器/);
  });

  it('changes narrative by topic stage', async () => {
    mockTimeline.mockResolvedValueOnce({ stage: 'fading' });
    const results = await generatePortfolioImpacts(['2330']);
    expect(results[0].narrative).toMatch(/fading/);
  });

  it('returns degraded structure when data is missing', async () => {
    mockFuseBatch.mockResolvedValueOnce([]);
    mockEventSummary.mockResolvedValueOnce(null);
    mockTopicSurge.mockResolvedValueOnce({ topics: [] });
    const results = await generatePortfolioImpacts(['2330']);
    expect(results[0].alphaContext.bucket).toBe('Insufficient Data');
    expect(results[0].topicContext.topics).toEqual([]);
    expect(results[0].limitations.length).toBeGreaterThan(0);
  });

  it('generates portfolio-level concentration/risk/regime structure', async () => {
    const result = await generatePortfolioDecisionSupport(['2330'], { weights: { '2330': 10 } });
    expect(result.themeConcentration.topThemes.length).toBeGreaterThanOrEqual(0);
    expect(result.sectorConcentration.sectors.length).toBeGreaterThan(0);
    expect(result.regimeExposure.regime).toBe('Bull');
    expect(result.summary).toMatch(/研究/);
  });

  it('returns full degraded JSON on empty symbols', async () => {
    const result = await generatePortfolioDecisionSupport([]);
    expect(result.themeConcentration.topThemes).toEqual([]);
    expect(result.sectorConcentration.sectors).toEqual([]);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('normalizes symbols and returns a stable fallback when upstream impact providers fail', async () => {
    mockDetectRegime.mockRejectedValue(new Error('regime unavailable'));
    mockFuseBatch.mockRejectedValue(new Error('fusion unavailable'));
    mockEventSummary.mockRejectedValue(new Error('events unavailable'));
    mockEventAlerts.mockRejectedValue(new Error('alerts unavailable'));
    mockTopicSurge.mockRejectedValue(new Error('topics unavailable'));

    const results = await generatePortfolioImpacts([' 2330 ', '', '2330']);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      symbol: '2330',
      alphaContext: { bucket: 'Insufficient Data', confidence: 0, alphaScore: 0 },
      regimeContext: { regime: 'Unknown', confidence: 0 },
      topicContext: { topics: [] },
      crossMarketContext: { positionInChain: 'unclear' },
    });
    expect(results[0].limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('無可用 alpha/fusion'),
      expect.stringContaining('事件資料不足'),
      expect.stringContaining('無 topic 資料'),
    ]));
    expect(results[0].riskContext.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('信心偏低'),
    ]));
  });

  it('classifies topic-chain roles and escalates risk in a bear regime', async () => {
    mockDetectRegime.mockResolvedValue({ regime: 'Bear', confidence: 74 });
    mockFuseBatch.mockResolvedValue([
      { symbol: '2330', alphaScore: 82, recommendationBucket: 'Strong Candidate', confidence: 80 },
      { symbol: '2317', alphaScore: 60, recommendationBucket: 'Neutral', confidence: 70 },
      { symbol: '2603', alphaScore: 35, recommendationBucket: 'Avoid', confidence: 30 },
      { symbol: '9999', alphaScore: 55, recommendationBucket: 'Watch', confidence: 40 },
    ]);
    mockEventSummary.mockResolvedValue({
      summary: {
        eventCount: 2,
        trustLevelSummary: { official: 0, mainstream: 0, secondary: 2, unknown: 0 },
      },
    });
    mockTopicSurge.mockResolvedValue({ topics: [{ topic: 'AI伺服器' }] });
    mockCross.mockResolvedValue({
      spreadPattern: 'sector_expansion',
      spreadSpeed: 'fast',
      originCluster: { symbols: ['2330'] },
      spreadClusters: [
        { symbols: ['2317'], spreadDelay: 2 },
        { symbols: ['2603'], spreadDelay: 4 },
      ],
    });

    const results = await generatePortfolioImpacts(['2330', '2317', '2603', '9999']);

    expect(results.map((impact) => impact.topicContext.topics[0].role)).toEqual([
      'origin', 'follower', 'late', 'unclear',
    ]);
    expect(results.map((impact) => impact.riskContext.riskLevel)).toEqual([
      'high', 'high', 'elevated', 'elevated',
    ]);
    expect(results[2].riskContext.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('信心偏低'),
      expect.stringContaining('低可信度'),
      expect.stringContaining('市場偏空'),
    ]));
    expect(results[0].regimeContext.implication).toContain('偏空環境');
  });

  it('calculates weighted concentration, linkage, risk, and pro-cyclical exposure', async () => {
    const topicBySymbol: Record<string, string> = {
      '2330': 'AI伺服器',
      '2454': 'AI伺服器',
      '2317': '雲端服務',
      '2382': '雲端服務',
      '2002': '鋼鐵循環',
    };
    mockFuseBatch.mockResolvedValue([
      { symbol: '2330', alphaScore: 80, recommendationBucket: 'Strong Candidate', confidence: 80 },
      { symbol: '2454', alphaScore: 75, recommendationBucket: 'Strong Candidate', confidence: 78 },
      { symbol: '2317', alphaScore: 70, recommendationBucket: 'Watch', confidence: 74 },
      { symbol: '2382', alphaScore: 50, recommendationBucket: 'Neutral', confidence: 65 },
      { symbol: '2002', alphaScore: 30, recommendationBucket: 'Avoid', confidence: 72 },
    ]);
    mockTopicSurge.mockImplementation(async ({ symbol }: { symbol: string }) => ({
      topics: [{ topic: topicBySymbol[symbol] }],
    }));
    mockStockFindMany.mockResolvedValue([
      { id: '2330', industry: '半導體業' },
      { id: '2454', industry: '半導體業' },
      { id: '2317', industry: '電腦及週邊設備業' },
      { id: '2382', industry: '電腦及週邊設備業' },
      { id: '2002', industry: '鋼鐵工業' },
    ]);
    mockThemeLinkage.mockResolvedValue({
      linkedTopics: [{ topic: '雲端服務', linkageStrength: 'strong', overlapSymbols: ['2330'] }],
    });
    mockSectorGraph.mockResolvedValue({
      nodes: [
        { type: 'sector', label: '半導體' },
        { type: 'sector', label: '電子製造' },
        { type: 'sector', label: '鋼鐵' },
      ],
      edges: [],
    });

    const result = await generatePortfolioDecisionSupport(
      ['2330', '2454', '2317', '2382', '2002'],
      { weights: { '2330': 40, '2454': 10, '2317': 25, '2382': 15, '2002': 10 } },
    );

    expect(result.themeConcentration.topThemes.map(({ theme, weight }) => [theme, weight])).toEqual([
      ['AI伺服器', 50],
      ['雲端服務', 40],
      ['鋼鐵循環', 10],
    ]);
    expect(result.themeConcentration.concentrationLevel).toBe('moderate');
    expect(result.themeConcentration.topThemes[0].linkageSignals).toContain('雲端服務:strong');
    expect(result.sectorConcentration.concentrationLevel).toBe('moderate');
    expect(result.sectorConcentration.chainBias).toBe('cross-sector chain observed');
    expect(result.riskClusters.overallRiskLevel).toBe('high');
    expect(result.regimeExposure).toMatchObject({
      offensiveExposure: 75,
      defensiveExposure: 10,
      neutralExposure: 15,
      sensitivity: 'pro-cyclical',
    });
  });

  it('documents missing topic and sector data and marks unavailable regime exposure unknown', async () => {
    mockDetectRegime.mockRejectedValue(new Error('regime unavailable'));
    mockFuseBatch.mockResolvedValue([]);
    mockEventSummary.mockResolvedValue({
      summary: {
        eventCount: 0,
        trustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0 },
      },
    });
    mockTopicSurge.mockResolvedValue({ topics: [] });
    mockStockFindMany.mockResolvedValue([]);

    const result = await generatePortfolioDecisionSupport([' 9999 ']);

    expect(result.themeConcentration).toMatchObject({ topThemes: [], concentrationLevel: 'unknown' });
    expect(result.sectorConcentration).toMatchObject({
      sectors: [{ sector: 'unknown', weight: 100, symbols: ['9999'] }],
      concentrationLevel: 'high',
      chainBias: 'unknown',
    });
    expect(result.riskClusters.overallRiskLevel).toBe('elevated');
    expect(result.regimeExposure.sensitivity).toBe('unknown');
    expect(result.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('無事件/主題資料'),
      expect.stringContaining('缺少 sector mapping'),
    ]));
  });
});
