import { detectRegime } from '@/lib/market/MarketRegimeEngine';
import { fuseBatch } from '@/lib/alpha/SignalFusionEngine';
import { getEventSummaryForSymbol } from '@/lib/events/EventSummaryEngine';
import { generateEventAlerts } from '@/lib/events/EventAlertEngine';
import { generateTopicSurgeSummary } from '@/lib/events/TopicSurgeEngine';
import { generateTopicMomentum } from '@/lib/events/TopicMomentumEngine';
import { generateThemeDiffusion } from '@/lib/events/ThemeDiffusionEngine';
import { generateThemeLinkage } from '@/lib/events/ThemeLinkageEngine';
import { generateSectorRelationGraph } from '@/lib/events/SectorRelationGraphEngine';
import { generateCrossMarketTheme } from '@/lib/events/CrossMarketThemeEngine';
import { generateSectorLinkageTimeline } from '@/lib/events/SectorLinkageTimelineEngine';
import { runMultiAgentResearch } from '@/lib/research/MultiAgentResearchEngine';
import { getSectorMapping } from '@/lib/data/SectorMapping';
import { prisma } from '@/lib/prisma';
import type { PortfolioDecisionSupport, PortfolioImpact, PortfolioRiskLevel, TopicRole } from '@/types/portfolio';

function regimeImplication(regime: string): string {
  if (regime === 'Bull') return '偏多環境下題材延續性可能較高，但仍需留意波動。';
  if (regime === 'Bear') return '偏空環境下題材傳導可能中斷，需保守觀察。';
  if (regime === 'Sideways') return '震盪環境下主題延續度通常不穩定。';
  return '市場環境資料不足，脈絡判斷可信度有限。';
}

function deriveRiskLevel(bucket: string, regime: string, confidence: number): string {
  let level: 'low' | 'moderate' | 'elevated' | 'high' | 'unknown' = 'unknown';
  if (bucket === 'Strong Candidate') level = 'moderate';
  else if (bucket === 'Watch') level = 'moderate';
  else if (bucket === 'Neutral') level = 'elevated';
  else if (bucket === 'Avoid') level = 'high';
  else if (bucket === 'Insufficient Data') level = 'unknown';

  if (regime === 'Bear' && level === 'moderate') level = 'elevated';
  if (regime === 'Bear' && level === 'elevated') level = 'high';
  if (confidence < 45 && level !== 'unknown') level = 'elevated';
  return level;
}

function summarizeTrust(summary: { official: number; mainstream: number; secondary: number; unknown: number }): string {
  return `official ${summary.official} / mainstream ${summary.mainstream} / secondary ${summary.secondary} / unknown ${summary.unknown}`;
}

function resolveTopicRole(symbol: string, crossMarket: Awaited<ReturnType<typeof generateCrossMarketTheme>> | null): TopicRole {
  if (!crossMarket) return 'unclear';
  if (crossMarket.originCluster.symbols.includes(symbol)) return 'origin';
  const delays = crossMarket.spreadClusters
    .filter((c) => c.symbols.includes(symbol))
    .map((c) => c.spreadDelay)
    .sort((a, b) => a - b);
  const delay = delays[0];
  if (delay == null) return 'unclear';
  if (delay <= 1) return 'early';
  if (delay <= 3) return 'follower';
  return 'late';
}

function buildNarrative(impact: PortfolioImpact): string {
  const topic = impact.topicContext.topics[0];
  const topicText = topic
    ? `主題「${topic.topic}」處於 ${topic.stage}，動能 ${topic.momentumType}、擴散 ${topic.diffusionType}，角色偏 ${topic.role}。`
    : '目前缺少可用主題脈絡資料。';
  return [
    `${impact.symbol} 在量化層為 ${impact.alphaContext.bucket}（Alpha ${impact.alphaContext.alphaScore}，信心 ${impact.alphaContext.confidence}%）。`,
    `市場環境為 ${impact.regimeContext.regime}（${impact.regimeContext.confidence}%），${impact.regimeContext.implication}`,
    topicText,
    `跨板塊傳導型態為 ${impact.crossMarketContext.spreadPattern} / ${impact.crossMarketContext.spreadSpeed}，鏈上位置 ${impact.crossMarketContext.positionInChain}。`,
    `近期事件 ${impact.eventContext.eventCount} 則；以上僅供研究脈絡觀察，非交易建議。`,
  ].join(' ');
}

export async function generatePortfolioImpacts(symbols: string[]): Promise<PortfolioImpact[]> {
  const cleaned = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  if (cleaned.length === 0) return [];

  const [regime, fusionResults] = await Promise.all([
    detectRegime().catch(() => null),
    fuseBatch(cleaned).catch(() => []),
  ]);
  const fusionMap = new Map(fusionResults.map((f) => [f.symbol.toUpperCase(), f]));

  return Promise.all(
    cleaned.map(async (symbol): Promise<PortfolioImpact> => {
      const limitations: string[] = [];
      const fusion = fusionMap.get(symbol);
      if (!fusion) limitations.push('無可用 alpha/fusion 資料，已使用最小脈絡。');

      const alphaContext = {
        alphaScore: fusion?.alphaScore ?? 0,
        bucket: fusion?.recommendationBucket ?? 'Insufficient Data',
        confidence: fusion?.confidence ?? 0,
      };
      const regimeContext = {
        regime: regime?.regime ?? 'Unknown',
        confidence: regime?.confidence ?? 0,
        implication: regimeImplication(regime?.regime ?? 'Unknown'),
      };

      const [eventRes, alertRes, topicSurge] = await Promise.all([
        getEventSummaryForSymbol({ symbol, days: 7, limit: 20 }).catch(() => null),
        generateEventAlerts({ mode: 'symbol', symbol, days: 1, minSeverity: 'info' }).catch(() => null),
        generateTopicSurgeSummary({ days: 3, minSurgeLevel: 'watch', includeSymbols: true, maxTopics: 5, symbol }).catch(() => null),
      ]);

      const eventContext = {
        eventCount: eventRes?.summary.eventCount ?? 0,
        recentAlertTypes: (alertRes?.alerts ?? []).map((a) => a.type),
        trustLevelSummary: eventRes?.summary ? summarizeTrust(eventRes.summary.trustLevelSummary) : 'official 0 / mainstream 0 / secondary 0 / unknown 0',
      };
      if (!eventRes || eventContext.eventCount === 0) limitations.push('事件資料不足，eventContext 已降級。');

      const topicRows = topicSurge?.topics ?? [];
      if (topicRows.length === 0) limitations.push('無 topic 資料，topicContext 為空。');

      const topicContextItems = await Promise.all(
        topicRows.slice(0, 2).map(async (row) => {
          const [momentum, diffusion, crossMarket, timeline] = await Promise.all([
            generateTopicMomentum({ topic: row.topic, days: 7, minCount: 0 }).catch(() => null),
            generateThemeDiffusion({ topic: row.topic, days: 7, minCount: 0 }).catch(() => null),
            generateCrossMarketTheme({ topic: row.topic, days: 14, minBreadth: 1 }).catch(() => null),
            generateSectorLinkageTimeline({ topic: row.topic, days: 14, minBreadth: 1 }).catch(() => null),
          ]);
          const role = resolveTopicRole(symbol, crossMarket);
          if (!crossMarket) limitations.push(`主題 ${row.topic} 缺少跨板塊資料，role 降級。`);
          return {
            topic: row.topic,
            stage: timeline?.stage ?? 'unknown',
            momentumType: momentum?.momentumType ?? 'unknown',
            diffusionType: diffusion?.diffusionType ?? 'single',
            role,
            _crossMarket: crossMarket,
          };
        }),
      );

      const primary = topicContextItems[0];
      const crossMarketContext = {
        spreadPattern: primary?._crossMarket?.spreadPattern ?? 'unavailable',
        spreadSpeed: primary?._crossMarket?.spreadSpeed ?? 'unavailable',
        positionInChain: primary?.role ?? 'unclear',
      };
      if (!primary?._crossMarket) limitations.push('無 cross-market 傳導資料，positionInChain 設為 unclear。');

      const riskWarnings: string[] = [];
      if (alphaContext.confidence < 45) riskWarnings.push('量化信心偏低，脈絡解讀需保守。');
      if (eventRes && eventRes.summary.trustLevelSummary.official + eventRes.summary.trustLevelSummary.mainstream === 0 && eventRes.summary.eventCount > 0) {
        riskWarnings.push('事件來源偏低可信度，主題延續性不確定。');
      }
      if (regimeContext.regime === 'Bear') riskWarnings.push('市場偏空，題材擴散可能中斷。');
      const riskContext = {
        riskLevel: deriveRiskLevel(alphaContext.bucket, regimeContext.regime, alphaContext.confidence),
        warnings: riskWarnings,
      };

      const result: PortfolioImpact = {
        symbol,
        alphaContext,
        regimeContext,
        topicContext: {
          topics: topicContextItems.map((item) => ({
            topic: item.topic,
            stage: item.stage,
            momentumType: item.momentumType,
            diffusionType: item.diffusionType,
            role: item.role,
          })),
        },
        eventContext,
        crossMarketContext,
        riskContext,
        narrative: '',
        limitations: [...new Set(limitations)],
      };
      result.narrative = buildNarrative(result);
      return result;
    }),
  );
}

function inferDataCoverage(impact: PortfolioImpact): 'full' | 'limited' | 'insufficient' {
  const hasAlpha = impact.alphaContext.bucket !== 'Insufficient Data';
  const hasTopic = impact.topicContext.topics.length > 0;
  const hasEvent = impact.eventContext.eventCount > 0;
  if (hasAlpha && hasTopic && hasEvent) return 'full';
  if (hasAlpha || hasTopic || hasEvent) return 'limited';
  return 'insufficient';
}

function severityRank(level: PortfolioRiskLevel): number {
  if (level === 'high') return 4;
  if (level === 'elevated') return 3;
  if (level === 'moderate') return 2;
  if (level === 'low') return 1;
  return 0;
}

function buildSummary(result: PortfolioDecisionSupport): string {
  return [
    `組合主題集中度 ${result.themeConcentration.concentrationLevel}，產業集中度 ${result.sectorConcentration.concentrationLevel}。`,
    `風險群聚等級 ${result.riskClusters.overallRiskLevel}，市場曝險為 ${result.regimeExposure.sensitivity}。`,
    '此輸出為研究脈絡輔助，不構成交易建議。',
  ].join(' ');
}

export async function generatePortfolioDecisionSupport(
  symbols: string[],
  options?: { weights?: Record<string, number> }
): Promise<PortfolioDecisionSupport> {
  const cleaned = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  const limitations: string[] = [];
  if (cleaned.length === 0) {
    return {
      summary: '目前無可分析之組合標的，僅回傳降級結果。',
      themeConcentration: {
        topThemes: [],
        concentrationLevel: 'unknown',
        explanation: '無可用標的資料，無法判斷主題集中度。',
      },
      sectorConcentration: {
        sectors: [],
        concentrationLevel: 'unknown',
        chainBias: 'unknown',
        explanation: '無可用標的資料，無法判斷產業集中度。',
      },
      riskClusters: {
        overallRiskLevel: 'unknown',
        clusters: [],
      },
      regimeExposure: {
        regime: 'Unknown',
        confidence: 0,
        offensiveExposure: 0,
        defensiveExposure: 0,
        neutralExposure: 0,
        sensitivity: 'unknown',
        note: '無可用標的資料。',
      },
      limitations: ['symbol list is empty'],
    };
  }

  const [impacts, stocks, regime] = await Promise.all([
    generatePortfolioImpacts(cleaned),
    prisma.stock.findMany({ where: { id: { in: cleaned } }, select: { id: true, industry: true } }).catch(() => []),
    detectRegime().catch(() => null),
  ]);
  const stockMap = new Map(stocks.map((s) => [s.id.toUpperCase(), s]));
  const weightInput = options?.weights ?? {};
  const weights = new Map<string, number>();
  for (const symbol of cleaned) {
    const weight = Number(weightInput[symbol] ?? 1);
    weights.set(symbol, Number.isFinite(weight) && weight > 0 ? weight : 1);
  }
  const totalWeight = Math.max(1, [...weights.values()].reduce((a, b) => a + b, 0));

  // Theme concentration (TopicSurge + Diffusion + Linkage traces from impacts and linkage engine)
  const themeAgg = new Map<string, { weight: number; symbols: Set<string>; linkageSignals: Set<string> }>();
  for (const impact of impacts) {
    for (const topic of impact.topicContext.topics) {
      const cur = themeAgg.get(topic.topic) ?? { weight: 0, symbols: new Set<string>(), linkageSignals: new Set<string>() };
      cur.weight += weights.get(impact.symbol) ?? 1;
      cur.symbols.add(impact.symbol);
      if (topic.diffusionType !== 'single') cur.linkageSignals.add(`diffusion:${topic.diffusionType}`);
      if (topic.role !== 'unclear') cur.linkageSignals.add(`role:${topic.role}`);
      themeAgg.set(topic.topic, cur);
    }
  }
  const topThemes = [...themeAgg.entries()]
    .map(([theme, v]) => ({
      theme,
      weight: Number(((v.weight / totalWeight) * 100).toFixed(2)),
      symbols: [...v.symbols],
      linkageSignals: [...v.linkageSignals].slice(0, 4),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  const primaryTheme = topThemes[0];
  const secondaryTheme = topThemes[1];
  let themeLevel: 'low' | 'moderate' | 'high' | 'unknown' = 'unknown';
  if (primaryTheme) {
    if (primaryTheme.weight >= 55) themeLevel = 'high';
    else if (primaryTheme.weight >= 30 || (primaryTheme.weight + (secondaryTheme?.weight ?? 0)) >= 65) themeLevel = 'moderate';
    else themeLevel = 'low';
  } else {
    limitations.push('無事件/主題資料，themeConcentration 降級。');
  }

  if (primaryTheme?.theme) {
    const linkage = await generateThemeLinkage({
      topic: primaryTheme.theme,
      days: 14,
      minStrength: 'weak',
      includeSymbols: true,
    }).catch(() => null);
    const linkHits = linkage?.linkedTopics.filter((i) => i.overlapSymbols.some((s) => cleaned.includes(s.toUpperCase()))) ?? [];
    if (linkHits.length > 0 && primaryTheme) {
      primaryTheme.linkageSignals.push(...linkHits.slice(0, 2).map((h) => `${h.topic}:${h.linkageStrength}`));
    }
  }

  // Sector concentration (SectorMapping + relation graph)
  const sectorAgg = new Map<string, { weight: number; symbols: Set<string> }>();
  let unknownSectorCount = 0;
  for (const symbol of cleaned) {
    const industry = stockMap.get(symbol)?.industry ?? null;
    const mapping = getSectorMapping(symbol, industry);
    const sector = mapping?.sector ?? 'unknown';
    if (sector === 'unknown') unknownSectorCount++;
    const cur = sectorAgg.get(sector) ?? { weight: 0, symbols: new Set<string>() };
    cur.weight += weights.get(symbol) ?? 1;
    cur.symbols.add(symbol);
    sectorAgg.set(sector, cur);
  }
  if (unknownSectorCount > 0) limitations.push(`${unknownSectorCount} 檔缺少 sector mapping，已標示 unknown。`);
  const sectors = [...sectorAgg.entries()]
    .map(([sector, v]) => ({
      sector,
      weight: Number(((v.weight / totalWeight) * 100).toFixed(2)),
      symbols: [...v.symbols],
    }))
    .sort((a, b) => b.weight - a.weight);
  const topSectorWeight = sectors[0]?.weight ?? 0;
  const sectorLevel: 'low' | 'moderate' | 'high' | 'unknown' =
    sectors.length === 0
      ? 'unknown'
      : topSectorWeight >= 60
        ? 'high'
        : topSectorWeight >= 35
          ? 'moderate'
          : 'low';

  let chainBias = 'unknown';
  if (primaryTheme?.theme) {
    const graph = await generateSectorRelationGraph({
      topic: primaryTheme.theme,
      days: 14,
      minStrength: 1,
      includeSymbols: true,
    }).catch(() => null);
    const graphSectors = new Set((graph?.nodes ?? []).filter((n) => n.type === 'sector').map((n) => n.label));
    if (graphSectors.size >= 3) chainBias = 'cross-sector chain observed';
    else if (graphSectors.size >= 1) chainBias = 'single/limited sector chain';
  }

  // Risk clusters (RiskAgent + bucket + coverage)
  const clusterMap = new Map<string, { symbols: string[]; reason: string; level: PortfolioRiskLevel }>();
  const riskLevels: PortfolioRiskLevel[] = [];
  for (const impact of impacts) {
    const coverage = inferDataCoverage(impact);
    const research = runMultiAgentResearch({
      symbol: impact.symbol,
      marketRegime: (impact.regimeContext.regime as 'Bull' | 'Bear' | 'Sideways' | 'Unknown') ?? 'Unknown',
      regimeConfidence: impact.regimeContext.confidence,
      alphaScore: impact.alphaContext.alphaScore,
      bucket: impact.alphaContext.bucket,
      confidence: impact.alphaContext.confidence,
      dataCoverage: coverage,
      technicalScore: impact.alphaContext.alphaScore,
      chipScore: impact.alphaContext.alphaScore,
      fundamentalScore: impact.alphaContext.alphaScore,
      marketAdjustment: 0,
      eventCount: impact.eventContext.eventCount,
      eventTrustLevelSummary: { official: 0, mainstream: 0, secondary: 0, unknown: 0 },
      recentThemes: impact.topicContext.topics.map((t) => t.topic),
      catalystSummary: impact.narrative,
      limitations: impact.limitations,
    });
    const riskAgent = research.viewpoints.find((v) => v.name === 'RiskAgent');
    const riskLevel = impact.riskContext.riskLevel as PortfolioRiskLevel;
    riskLevels.push(riskLevel);

    if (riskLevel === 'high' || impact.alphaContext.bucket === 'Avoid') {
      const key = 'high-risk-bucket';
      const cur = clusterMap.get(key) ?? { symbols: [], reason: '多檔標的落在高風險 bucket（Avoid / high risk）。', level: 'high' as PortfolioRiskLevel };
      cur.symbols.push(impact.symbol);
      clusterMap.set(key, cur);
    }
    if (coverage === 'insufficient') {
      const key = 'insufficient-data';
      const cur = clusterMap.get(key) ?? { symbols: [], reason: '多檔標的資料覆蓋不足，研究可信度受限。', level: 'elevated' as PortfolioRiskLevel };
      cur.symbols.push(impact.symbol);
      clusterMap.set(key, cur);
    }
    const topTheme = impact.topicContext.topics[0]?.topic;
    if (topTheme && impact.eventContext.eventCount > 0 && impact.eventContext.trustLevelSummary.includes('official 0 / mainstream 0')) {
      const key = `low-trust-theme:${topTheme}`;
      const cur = clusterMap.get(key) ?? {
        symbols: [],
        reason: `同主題 (${topTheme}) 事件來源偏低可信度，需保守解讀。`,
        level: 'elevated' as PortfolioRiskLevel,
      };
      cur.symbols.push(impact.symbol);
      clusterMap.set(key, cur);
    }
    if (riskAgent?.limitations.length) {
      limitations.push(...riskAgent.limitations.slice(0, 1));
    }
  }
  const clusters = [...clusterMap.entries()]
    .map(([clusterType, v]) => ({
      clusterType,
      riskLevel: v.level,
      symbols: [...new Set(v.symbols)],
      reason: v.reason,
    }))
    .filter((c) => c.symbols.length > 0)
    .sort((a, b) => severityRank(b.riskLevel) - severityRank(a.riskLevel));
  const overallRiskLevel: PortfolioRiskLevel =
    clusters[0]?.riskLevel ??
    (riskLevels.length === 0
      ? 'unknown'
      : riskLevels.some((r) => r === 'high')
        ? 'high'
        : riskLevels.some((r) => r === 'elevated')
          ? 'elevated'
          : riskLevels.some((r) => r === 'moderate')
            ? 'moderate'
            : 'low');

  // Regime exposure
  const weighted = impacts.map((impact) => ({ impact, weight: weights.get(impact.symbol) ?? 1 }));
  const offensiveWeight = weighted
    .filter((x) => x.impact.alphaContext.bucket === 'Strong Candidate' || x.impact.alphaContext.bucket === 'Watch')
    .reduce((s, x) => s + x.weight, 0);
  const defensiveWeight = weighted
    .filter((x) => x.impact.alphaContext.bucket === 'Avoid' || x.impact.riskContext.riskLevel === 'high')
    .reduce((s, x) => s + x.weight, 0);
  const neutralWeight = Math.max(0, totalWeight - offensiveWeight - defensiveWeight);
  const offensiveExposure = Number(((offensiveWeight / totalWeight) * 100).toFixed(2));
  const defensiveExposure = Number(((defensiveWeight / totalWeight) * 100).toFixed(2));
  const neutralExposure = Number(((neutralWeight / totalWeight) * 100).toFixed(2));
  const sensitivity: 'defensive' | 'balanced' | 'pro-cyclical' | 'unknown' =
    regime == null
      ? 'unknown'
      : offensiveExposure >= 55 && defensiveExposure < 20
        ? 'pro-cyclical'
        : defensiveExposure >= 35
          ? 'defensive'
          : 'balanced';
  const regimeExposure = {
    regime: regime?.regime ?? 'Unknown',
    confidence: regime?.confidence ?? 0,
    offensiveExposure,
    defensiveExposure,
    neutralExposure,
    sensitivity,
    note:
      regime?.regime === 'Bear' && offensiveExposure >= 50
        ? '目前組合在偏空環境下具較高順景氣曝險，需保守解讀波動風險。'
        : regime?.regime === 'Bull' && defensiveExposure >= 35
          ? '目前組合在偏多環境下仍保留防禦配置，進攻性相對有限。'
          : '組合在當前市場環境下呈中性曝險，適合持續追蹤主題與風險變化。',
  };

  const result: PortfolioDecisionSupport = {
    summary: '',
    themeConcentration: {
      topThemes,
      concentrationLevel: themeLevel,
      explanation:
        topThemes.length === 0
          ? '無可用主題資料，無法判斷集中度。'
          : `主題權重前兩名合計 ${Number(((topThemes[0].weight + (topThemes[1]?.weight ?? 0))).toFixed(2))}% ，集中度評估為 ${themeLevel}。`,
    },
    sectorConcentration: {
      sectors,
      concentrationLevel: sectorLevel,
      chainBias,
      explanation:
        sectors.length === 0
          ? '無可用 sector 資料，無法判斷產業集中。'
          : `主要產業為 ${sectors.slice(0, 3).map((s) => `${s.sector}(${s.weight}%)`).join('、')}。`,
    },
    riskClusters: {
      overallRiskLevel,
      clusters,
    },
    regimeExposure,
    limitations: [...new Set(limitations)],
  };
  result.summary = buildSummary(result);
  return result;
}

export const PortfolioImpactEngine = {
  generatePortfolioImpacts,
  generatePortfolioDecisionSupport,
};
