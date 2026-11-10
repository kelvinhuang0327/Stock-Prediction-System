/** @jest-environment node */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stockQuote: { findFirst: jest.fn(), findMany: jest.fn() },
    marketIndex: { findFirst: jest.fn(), findMany: jest.fn() },
    stock: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/market/MarketRegimeEngine', () => ({ detectRegime: jest.fn() }));
jest.mock('@/lib/screen/StrategyScreenEngine', () => ({ runScreen: jest.fn() }));
jest.mock('@/lib/fundamentals/FundamentalResearchService', () => ({
  buildFundamentalResearchContextForSymbol: jest.fn(),
}));
jest.mock('@/lib/events/EventSummaryEngine', () => ({
  getEventSummaryForSymbol: jest.fn(),
  getMarketEventSummary: jest.fn(),
}));

import { buildAutonomousResearchSnapshot } from '../AutonomousResearchEngine';
import { prisma } from '@/lib/prisma';

const mockStockQuoteFindFirst = prisma.stockQuote.findFirst as jest.Mock;
const mockStockQuoteFindMany = prisma.stockQuote.findMany as jest.Mock;
const mockMarketIndexFindFirst = prisma.marketIndex.findFirst as jest.Mock;
const mockMarketIndexFindMany = prisma.marketIndex.findMany as jest.Mock;
const mockStockFindUnique = prisma.stock.findUnique as jest.Mock;
const mockDetectRegime = jest.requireMock('@/lib/market/MarketRegimeEngine').detectRegime as jest.Mock;
const mockRunScreen = jest.requireMock('@/lib/screen/StrategyScreenEngine').runScreen as jest.Mock;
const mockBuildFundamentalContext = jest.requireMock('@/lib/fundamentals/FundamentalResearchService').buildFundamentalResearchContextForSymbol as jest.Mock;
const mockGetEventSummaryForSymbol = jest.requireMock('@/lib/events/EventSummaryEngine').getEventSummaryForSymbol as jest.Mock;
const mockGetMarketEventSummary = jest.requireMock('@/lib/events/EventSummaryEngine').getMarketEventSummary as jest.Mock;

const AS_OF = '2026-04-05';

function regime(overrides: Record<string, unknown> = {}) {
  return {
    regime: 'Bull',
    confidence: 82,
    factors: [],
    dataCoverage: 'full',
    samplePeriod: '2026-01-01 ~ 2026-04-05',
    dataPoints: 100,
    last_updated: AS_OF,
    limitations: [],
    ...overrides,
  };
}

function candidate(symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    symbol,
    name: `Stock ${symbol}`,
    screenBucket: 'Other',
    recommendationBucket: 'Watch',
    alphaScore: 72,
    confidence: 55,
    priceChangePercent: 1,
    keyRisks: [],
    ...overrides,
  };
}

function fundamentalContext(overrides: {
  summary?: string;
  dataCoverage?: string;
  keyRisks?: string[];
  overlaySummary?: string;
  overlayLimitations?: string[];
} = {}) {
  return {
    fundamentals: {
      dataCoverage: overrides.dataCoverage ?? 'full',
      summary: overrides.summary ?? '營運偏正向，仍需追蹤後續資料。',
      keyRisks: overrides.keyRisks ?? ['fundamental risk'],
    },
    overlay: {
      summary: overrides.overlaySummary ?? '研究脈絡待確認',
      limitations: overrides.overlayLimitations ?? ['one', 'two', 'three'],
    },
  };
}

describe('buildAutonomousResearchSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectRegime.mockResolvedValue(regime());
    mockRunScreen.mockResolvedValue({
      candidates: [],
      dataCoverageSummary: { full: 1 },
      limitations: [],
    });
    mockGetMarketEventSummary.mockResolvedValue({
      summary: { sourceQuality: { qualityLabel: 'LIVE_CONFIDENT' }, limitations: [] },
    });
    mockGetEventSummaryForSymbol.mockResolvedValue(null);
    mockBuildFundamentalContext.mockResolvedValue(null);
    mockStockQuoteFindFirst.mockResolvedValue({ date: AS_OF });
    mockStockQuoteFindMany.mockResolvedValue([
      { change: 1 }, { change: 1 }, { change: 1 }, { change: 1 }, { change: 1 }, { change: 1 },
      { change: -1 }, { change: -1 }, { change: -1 }, { change: -1 },
    ]);
    mockMarketIndexFindFirst.mockResolvedValue({ date: AS_OF, changePercent: 1.2 });
    mockMarketIndexFindMany.mockResolvedValue([]);
    mockStockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: `Company ${where.id}`,
      industry: '半導體',
    }));
  });

  it('builds an as-of snapshot, ranks sector strength, and classifies the first five eligible candidates', async () => {
    const candidates = [
      candidate('A', { screenBucket: 'Strong Candidate', confidence: 80, keyRisks: ['price risk', 'liquidity risk', 'ignored risk'] }),
      candidate('B', { screenBucket: 'Strong Candidate', confidence: 65, priceChangePercent: 0 }),
      candidate('C', { recommendationBucket: 'Strong Candidate', priceChangePercent: undefined }),
      candidate('D', { screenBucket: 'Watch' }),
      candidate('E', { screenBucket: 'Other', priceChangePercent: -1, keyRisks: undefined }),
      candidate('F'),
      candidate('X', { screenBucket: 'Excluded' }),
    ];
    mockRunScreen.mockResolvedValue({
      candidates,
      dataCoverageSummary: { full: 4 },
      limitations: ['screen limit', 'shared limit'],
    });
    mockGetMarketEventSummary.mockResolvedValue({
      summary: { sourceQuality: { qualityLabel: 'LIVE_CONFIDENT' }, limitations: ['shared limit', 'event limit'] },
    });
    mockMarketIndexFindMany.mockResolvedValue([
      { name: 'Tech類指數', changePercent: 1.2 },
      { name: 'Bank類指數', changePercent: -0.8 },
      { name: 'Food類指數', changePercent: 0.1 },
      { name: 'Shipping類指數', changePercent: 0.6 },
      { name: 'Glass類指數', changePercent: -0.5 },
      { name: 'Steel類指數', changePercent: 0.4 },
      { name: 'Computer類指數', changePercent: 0.9 },
      { name: 'Textile類指數', changePercent: -0.2 },
      { name: 'Plastic類指數', changePercent: 0.7 },
      { name: 'Cement類指數', changePercent: -1.1 },
    ]);
    mockStockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => (
      where.id === 'C' ? null : { id: where.id, name: `Company ${where.id}`, industry: null }
    ));
    mockBuildFundamentalContext.mockImplementation(async ({ symbol }: { symbol: string }) => {
      if (symbol === 'A') return fundamentalContext({ overlaySummary: '事件來源支持事件脈絡', overlayLimitations: [] });
      if (symbol === 'B') return fundamentalContext({ overlaySummary: '沒有事件', overlayLimitations: ['1', '2', '3'] });
      if (symbol === 'D') throw new Error('fundamental service unavailable');
      if (symbol === 'E') {
        return {
          fundamentals: { dataCoverage: 'limited', summary: '資料有限', keyRisks: undefined },
          overlay: { summary: '研究脈絡', limitations: ['1', '2', '3'] },
        };
      }
      return fundamentalContext();
    });
    mockGetEventSummaryForSymbol.mockImplementation(async ({ symbol }: { symbol: string }) => {
      if (symbol === 'D') throw new Error('event service unavailable');
      if (symbol === 'A') return { summary: { sourceQuality: { qualityLabel: 'LIVE_CONFIDENT' } } };
      if (symbol === 'E') return { summary: {} };
      return null;
    });

    const snapshot = await buildAutonomousResearchSnapshot({ asOf: AS_OF });

    expect(snapshot.marketState).toBe('trending');
    expect(snapshot.dataCoverage).toBe('full');
    expect(snapshot.snapshotDate).toBe(AS_OF);
    expect(snapshot.candidateStocks.map((item) => item.symbol)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(snapshot.candidateStocks.map((item) => item.setupType)).toEqual([
      'event', 'fundamental', 'trend', 'rebound', 'rebound',
    ]);
    expect(snapshot.candidateStocks.map((item) => item.conviction)).toEqual(['high', 'high', 'low', 'mid', 'low']);
    expect(snapshot.candidateStocks[0].riskFactors).toEqual([
      'price risk', 'liquidity risk', 'fundamental risk',
    ]);
    expect(snapshot.candidateStocks[0].supportingSignals).toContain('eventQuality: LIVE_CONFIDENT');
    expect(snapshot.candidateStocks[2].supportingSignals).toContain('fundamentalCoverage: unavailable');
    expect(snapshot.candidateStocks[4].supportingSignals).toEqual(expect.arrayContaining([
      'fundamentalCoverage: limited', 'eventQuality: n/a',
    ]));
    expect(snapshot.candidateStocks[4].riskFactors).toEqual([]);
    expect(snapshot.sectorStrength).toHaveLength(8);
    expect(snapshot.sectorStrength[0]).toMatchObject({ name: 'Tech類指數', direction: 'strong' });
    expect(snapshot.sectorStrength.some((sector) => sector.direction === 'neutral')).toBe(true);
    expect(snapshot.sectorStrength.some((sector) => sector.direction === 'weak')).toBe(true);
    expect(snapshot.topInsights).toHaveLength(3);
    expect(snapshot.riskSignals).toEqual([]);
    expect(snapshot.limitations).toEqual(['screen limit', 'shared limit', 'event limit']);
    expect(mockRunScreen).toHaveBeenCalledWith({ maxResults: 20, respectMarketRegime: true, asOf: AS_OF });
    expect(mockStockQuoteFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { date: { lte: AS_OF } } }));
    expect(mockMarketIndexFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { name: '發行量加權股價指數', date: { lte: AS_OF } } }));
    expect(mockBuildFundamentalContext).toHaveBeenCalledTimes(4);
    expect(mockGetEventSummaryForSymbol).toHaveBeenCalledTimes(5);
    expect(mockStockFindUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'X' } }));
  });

  it('falls back to an insufficient snapshot when market, screen, events, and quotes are unavailable', async () => {
    mockDetectRegime.mockRejectedValue(new Error('regime unavailable'));
    mockRunScreen.mockRejectedValue(new Error('screen unavailable'));
    mockGetMarketEventSummary.mockRejectedValue(new Error('events unavailable'));
    mockStockQuoteFindFirst.mockResolvedValue(null);
    mockMarketIndexFindFirst.mockResolvedValue(null);

    const snapshot = await buildAutonomousResearchSnapshot();

    expect(snapshot.marketRegime).toBe('Unknown');
    expect(snapshot.marketState).toBe('震盪');
    expect(snapshot.dataCoverage).toBe('insufficient');
    expect(snapshot.sectorStrength).toEqual([]);
    expect(snapshot.candidateStocks).toEqual([]);
    expect(snapshot.riskSignals).toEqual([
      '市場廣度偏弱，追強需要更高確認。',
      '事件來源可信度未達最高等級，事件結論需保守。',
      '資料覆蓋率未達 full，提案與模擬倉位需保守。',
    ]);
    expect(snapshot.topInsights).toHaveLength(2);
    expect(snapshot.limitations).toEqual(['市場環境不可用']);
    expect(snapshot.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockStockQuoteFindMany).not.toHaveBeenCalled();
    expect(mockMarketIndexFindMany).not.toHaveBeenCalled();
  });

  it('keeps coverage limited when any full-coverage input is incomplete', async () => {
    mockDetectRegime.mockResolvedValue(regime({ dataCoverage: 'limited' }));
    mockRunScreen.mockResolvedValue({ candidates: [], dataCoverageSummary: { full: 0 }, limitations: [] });
    mockGetMarketEventSummary.mockResolvedValue({
      summary: { sourceQuality: { qualityLabel: 'DELAYED' }, limitations: [] },
    });

    const snapshot = await buildAutonomousResearchSnapshot();

    expect(snapshot.dataCoverage).toBe('limited');
    expect(snapshot.riskSignals).toEqual([
      '事件來源可信度未達最高等級，事件結論需保守。',
      '資料覆蓋率未達 full，提案與模擬倉位需保守。',
    ]);

    mockDetectRegime.mockResolvedValue(regime({ dataCoverage: 'full' }));
    mockRunScreen.mockResolvedValue({ candidates: [], dataCoverageSummary: { full: 1 }, limitations: [] });
    const delayedEvents = await buildAutonomousResearchSnapshot();
    expect(delayedEvents.dataCoverage).toBe('limited');

    mockRunScreen.mockRejectedValue(new Error('screen unavailable'));
    const noScreen = await buildAutonomousResearchSnapshot();
    expect(noScreen.dataCoverage).toBe('limited');
  });

  it.each([
    ['Bear', 0.8, 1, 'defensive'],
    ['Unknown', 0.4, -1, 'defensive'],
    ['Sideways', 0.6, 0.1, 'recovery'],
    ['Sideways', 0.6, -0.1, '震盪'],
    ['Bull', 0.55, null, 'trending'],
    ['Bull', 0.5, 0, 'recovery'],
    ['Unknown', 0.4, null, '震盪'],
  ])('maps regime %s and breadth %s to %s', async (marketRegime, breadth, changePercent, expected) => {
    const positiveCount = Math.round(breadth * 10);
    mockDetectRegime.mockResolvedValue(regime({ regime: marketRegime }));
    mockStockQuoteFindMany.mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      change: index < positiveCount ? 1 : -1,
    })));
    mockMarketIndexFindFirst.mockResolvedValue(changePercent === null ? null : { date: AS_OF, changePercent });

    const snapshot = await buildAutonomousResearchSnapshot();

    expect(snapshot.marketState).toBe(expected);
  });
});
