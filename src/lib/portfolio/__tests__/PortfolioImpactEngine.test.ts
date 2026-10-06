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
});
