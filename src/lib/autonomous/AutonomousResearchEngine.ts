import { prisma } from '../prisma';
import { detectRegime } from '../market/MarketRegimeEngine';
import { runScreen, type ScreenCandidate } from '../screen/StrategyScreenEngine';
import { buildFundamentalResearchContextForSymbol } from '../fundamentals/FundamentalResearchService';
import { getEventSummaryForSymbol, getMarketEventSummary } from '../events/EventSummaryEngine';
import type {
  AutonomousMarketState,
  AutonomousResearchCandidate,
  AutonomousResearchSnapshot,
  SectorStrengthItem,
} from './types';
import type { FundamentalResearchContext } from '../fundamentals/FundamentalResearchService';

function computeMarketState(
  regime: Awaited<ReturnType<typeof detectRegime>>,
  breadthRatio: number,
  taiexChangePct: number | null,
): AutonomousMarketState {
  if (regime.regime === 'Bear' || (taiexChangePct != null && taiexChangePct < -0.5 && breadthRatio < 0.45)) {
    return 'defensive';
  }
  if (regime.regime === 'Sideways') {
    return taiexChangePct != null && taiexChangePct > 0 && breadthRatio > 0.5 ? 'recovery' : '震盪';
  }
  if (regime.regime === 'Bull' && breadthRatio >= 0.55) {
    return 'trending';
  }
  return breadthRatio >= 0.5 ? 'recovery' : '震盪';
}

async function buildSectorStrength(latestDate: string | null, _asOf?: string | null): Promise<SectorStrengthItem[]> {
  if (!latestDate) return [];
  const rows = await prisma.marketIndex.findMany({
    where: {
      date: latestDate,
      name: { endsWith: '類指數' },
    },
    select: { name: true, changePercent: true },
  });
  return rows
    .map((row) => {
      const score = row.changePercent;
      return {
        name: row.name,
        averageChangePercent: score,
        stockCount: 1,
        direction: score >= 0.5 ? 'strong' : score <= -0.5 ? 'weak' : 'neutral',
      } as SectorStrengthItem;
    })
    .sort((a, b) => b.averageChangePercent - a.averageChangePercent)
    .slice(0, 8);
}

function thesisForSetup(setupType: AutonomousResearchCandidate['setupType'], context: FundamentalResearchContext | null, marketState: AutonomousMarketState): string {
  const fundamentalLine = context?.fundamentals.summary ?? '基本面資料有限，僅以現有研究脈絡判讀。';
  switch (setupType) {
    case 'trend':
      return `技術/量化條件已轉強，且目前市場屬 ${marketState}，可持續追蹤趨勢延續性；${fundamentalLine}`;
    case 'rebound':
      return `短線結構偏弱但具修復條件，需等待轉強確認；${fundamentalLine}`;
    case 'event':
      return `事件脈絡清楚且來源可信度足夠，需觀察是否能轉化為價格與籌碼延續；${fundamentalLine}`;
    case 'fundamental':
      return `營收/獲利/估值脈絡仍可追蹤，需等待市場對體質的重新定價；${fundamentalLine}`;
  }
}

function setupTypeForCandidate(candidate: ScreenCandidate, context: FundamentalResearchContext | null, marketState: AutonomousMarketState): AutonomousResearchCandidate['setupType'] {
  const fundamentals = context?.fundamentals;
  const hasStrongFundamental = fundamentals?.dataCoverage === 'full' && fundamentals.summary.includes('偏正向');
  const hasEventSupport = (context?.overlay?.limitations ?? []).length < 3 && context?.overlay?.summary?.includes('事件');
  if (hasEventSupport) return 'event';
  if (hasStrongFundamental && candidate.priceChangePercent >= 0) return 'fundamental';
  if ((candidate.screenBucket === 'Strong Candidate' || candidate.recommendationBucket === 'Strong Candidate') && marketState !== 'defensive') return 'trend';
  return 'rebound';
}

function convictionForCandidate(candidate: ScreenCandidate, context: FundamentalResearchContext | null): 'low' | 'mid' | 'high' {
  if (candidate.screenBucket === 'Strong Candidate' && candidate.confidence >= 60 && context?.fundamentals.dataCoverage === 'full') return 'high';
  if (candidate.screenBucket === 'Strong Candidate' || candidate.screenBucket === 'Watch') return 'mid';
  return 'low';
}

function buildRiskSignals(breadthRatio: number, eventQuality: string, dataCoverage: string): string[] {
  const signals: string[] = [];
  if (breadthRatio < 0.45) signals.push('市場廣度偏弱，追強需要更高確認。');
  if (eventQuality !== 'LIVE_CONFIDENT') signals.push('事件來源可信度未達最高等級，事件結論需保守。');
  if (dataCoverage !== 'full') signals.push('資料覆蓋率未達 full，提案與模擬倉位需保守。');
  return signals;
}

function buildTopInsights(
  marketState: AutonomousMarketState,
  breadthRatio: number,
  regime: string,
  regimeConfidence: number,
  sectorStrength: SectorStrengthItem[],
): string[] {
  const insights = [
    `市場狀態為 ${marketState}，對應 regime ${regime}（信心 ${regimeConfidence}%）。`,
    `廣度比率約 ${(breadthRatio * 100).toFixed(1)}%，屬研究上的第一層風險指標。`,
  ];
  if (sectorStrength[0]) {
    insights.push(`相對強勢族群為 ${sectorStrength[0].name}（${sectorStrength[0].averageChangePercent.toFixed(2)}%）。`);
  }
  return insights;
}

export async function buildAutonomousResearchSnapshot(options?: {
  /** Rolling simulation date ceiling (YYYY-MM-DD). When set, all data queries
   *  are capped to this date so the research engine sees the same universe
   *  as the simulation, not future real-world data. */
  asOf?: string;
}): Promise<AutonomousResearchSnapshot> {
  const asOf = options?.asOf ?? null;

  const [regime, screenResult, marketEvents] = await Promise.all([
    detectRegime().catch(() => ({
      regime: 'Unknown' as const,
      confidence: 0,
      factors: [],
      dataCoverage: 'insufficient' as const,
      samplePeriod: 'N/A',
      dataPoints: 0,
      last_updated: null,
      limitations: ['市場環境不可用'],
    })),
    runScreen({ maxResults: 20, respectMarketRegime: true, asOf: asOf ?? undefined }).catch(() => null),
    getMarketEventSummary({ days: 1, limit: 30 }).catch(() => null),
  ]);

  const latestQuoteDate = await prisma.stockQuote.findFirst({
    where: asOf ? { date: { lte: asOf } } : undefined,
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  const latestDateIso = latestQuoteDate ? latestQuoteDate.date : null;
  const latestQuoteRows = latestDateIso
    ? await prisma.stockQuote.findMany({ where: { date: latestDateIso }, select: { change: true } })
    : [];
  const breadthRatio = latestQuoteRows.length > 0
    ? latestQuoteRows.filter((r) => r.change > 0).length / latestQuoteRows.length
    : 0;
  const taiexLatest = await prisma.marketIndex.findFirst({
    where: asOf
      ? { name: '發行量加權股價指數', date: { lte: asOf } }
      : { name: '發行量加權股價指數' },
    orderBy: { date: 'desc' },
    select: { date: true, changePercent: true },
  });
  const sectorStrength = await buildSectorStrength(latestDateIso, asOf);
  const marketState = computeMarketState(regime, breadthRatio, taiexLatest?.changePercent ?? null);

  const candidateRows = (screenResult?.candidates ?? [])
    .slice(0, 10)
    .filter((c) => c.screenBucket !== 'Excluded');

  const candidateContexts = await Promise.all(
    candidateRows.slice(0, 5).map(async (candidate) => {
      const stock = await prisma.stock.findUnique({
        where: { id: candidate.symbol },
        select: { id: true, name: true, industry: true },
      });
      const context = stock
        ? await buildFundamentalResearchContextForSymbol({
            symbol: stock.id,
            name: stock.name,
            industry: stock.industry ?? '未分類',
          }).catch(() => null)
        : null;
      const eventSummary = await getEventSummaryForSymbol({ symbol: candidate.symbol, days: 7, limit: 10 }).catch(() => null);

      return {
        symbol: candidate.symbol,
        name: candidate.name,
        context,
        eventSummary,
        candidate,
      };
    }),
  );

  const candidates: AutonomousResearchCandidate[] = candidateContexts.map(({ symbol, name, context, eventSummary, candidate }) => {
    const setupType = setupTypeForCandidate(candidate, context, marketState);
    const conviction = convictionForCandidate(candidate, context);
    const thesis = thesisForSetup(setupType, context, marketState);
    const supportingSignals = [
      `screenBucket: ${candidate.screenBucket}`,
      `alphaScore: ${candidate.alphaScore}`,
      context ? `fundamentalCoverage: ${context.fundamentals.dataCoverage}` : 'fundamentalCoverage: unavailable',
      eventSummary ? `eventQuality: ${eventSummary.summary.sourceQuality?.qualityLabel ?? 'n/a'}` : 'eventQuality: unavailable',
    ];
    const riskFactors = [
      ...(candidate.keyRisks ?? []).slice(0, 2),
      ...(context?.fundamentals.keyRisks ?? []).slice(0, 2) ?? [],
    ];
      return {
        symbol,
        name,
        screenBucket: candidate.screenBucket,
        setupType,
        alphaScore: candidate.alphaScore,
        recommendationBucket: candidate.recommendationBucket,
        confidence: candidate.confidence,
        priceChangePercent: candidate.priceChangePercent ?? 0,
        conviction,
        thesis,
        supportingSignals,
        riskFactors,
      };
  });

  const eventQuality = marketEvents?.summary.sourceQuality?.qualityLabel ?? 'INSUFFICIENT_EVENT_DATA';
  const riskSignals = buildRiskSignals(breadthRatio, eventQuality, screenResult?.dataCoverageSummary.full ? 'full' : 'limited');
  const topInsights = buildTopInsights(
    marketState,
    breadthRatio,
    regime.regime,
    regime.confidence,
    sectorStrength,
  );

  const dataCoverage = regime.dataCoverage === 'full' && (screenResult?.dataCoverageSummary.full ?? 0) > 0 && eventQuality === 'LIVE_CONFIDENT'
    ? 'full'
    : regime.dataCoverage === 'insufficient'
      ? 'insufficient'
      : 'limited';

  const limitations = [
    ...new Set([
      ...regime.limitations,
      ...(screenResult?.limitations ?? []),
      ...(marketEvents?.summary.limitations ?? []),
    ]),
  ];

  return {
    generatedAt: new Date().toISOString(),
    snapshotDate: latestDateIso ?? new Date().toISOString().slice(0, 10),
    marketState,
    marketRegime: regime.regime,
    marketRegimeConfidence: regime.confidence,
    sectorStrength,
    candidateStocks: candidates,
    riskSignals,
    topInsights,
    dataCoverage,
    limitations,
  };
}
