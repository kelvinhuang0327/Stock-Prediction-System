import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type SpreadPattern = 'early_cluster' | 'sector_expansion' | 'broad_market' | 'unclear';
export type SpreadSpeed = 'slow' | 'moderate' | 'fast';

export interface SpreadCluster {
  symbols: string[];
  sector?: string;
  firstSeenDate: string;
  spreadDelay: number;
}

export interface CrossMarketThemeResult {
  topic: string;
  originCluster: {
    symbols: string[];
    sector?: string;
    firstSeenDate: string;
  };
  spreadClusters: SpreadCluster[];
  spreadPattern: SpreadPattern;
  spreadSpeed: SpreadSpeed;
  trustLevelSummary: string;
  limitations: string[];
}

type TrustStats = {
  official: number;
  mainstream: number;
  secondary: number;
  unknown: number;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function dayDiff(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDate}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((to - from) / (24 * 60 * 60 * 1000)));
}

function resolveCanonicalTopic(topic: string): string {
  const normalized = extractAndNormalizeTopics({ title: topic, summary: topic, relatedThemes: [topic] }).topics;
  return normalized[0] ?? topic.trim();
}

function trustSummary(stats: TrustStats): { text: string; lowRatio: number } {
  const total = stats.official + stats.mainstream + stats.secondary + stats.unknown;
  const lowRatio = total > 0 ? (stats.secondary + stats.unknown) / total : 0;
  return {
    text: `official ${stats.official} / mainstream ${stats.mainstream} / secondary ${stats.secondary} / unknown ${stats.unknown}`,
    lowRatio,
  };
}

function reduceSpeed(speed: SpreadSpeed): SpreadSpeed {
  if (speed === 'fast') return 'moderate';
  if (speed === 'moderate') return 'slow';
  return 'slow';
}

function classifySpreadPattern(sectorCount: number, symbolCount: number): SpreadPattern {
  if (symbolCount === 0) return 'unclear';
  if (sectorCount >= 3 || symbolCount >= 8) return 'broad_market';
  if (sectorCount >= 2 || symbolCount >= 3) return 'sector_expansion';
  if (symbolCount >= 1) return 'early_cluster';
  return 'unclear';
}

function classifySpreadSpeed(delays: number[]): SpreadSpeed {
  if (delays.length === 0) return 'slow';
  const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
  if (avg <= 1) return 'fast';
  if (avg <= 3) return 'moderate';
  return 'slow';
}

export async function generateCrossMarketTheme(params: {
  topic: string;
  days?: number;
  minBreadth?: number;
}): Promise<CrossMarketThemeResult> {
  const topic = params.topic.trim();
  const days = Math.min(Math.max(params.days ?? 14, 3), 30);
  const minBreadth = Math.max(params.minBreadth ?? 1, 1);
  const canonicalTopic = resolveCanonicalTopic(topic);
  const limitations: string[] = [];

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.newsEvent.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: 'asc' },
      take: 2000,
    });

    const symbolFirstSeen = new Map<string, string>();
    const symbolCount = new Map<string, number>();
    const stats: TrustStats = { official: 0, mainstream: 0, secondary: 0, unknown: 0 };

    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonicalTopic)) continue;

      if (row.trustLevel === 'official' || row.trustLevel === 'mainstream' || row.trustLevel === 'secondary') {
        stats[row.trustLevel] += 1;
      } else {
        stats.unknown += 1;
      }

      const dateKey = toDateKey(row.publishedAt);
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      for (const symbol of symbols) {
        symbolCount.set(symbol, (symbolCount.get(symbol) ?? 0) + 1);
        const prev = symbolFirstSeen.get(symbol);
        if (!prev || dateKey < prev) symbolFirstSeen.set(symbol, dateKey);
      }
    }

    if (symbolFirstSeen.size < minBreadth) {
      limitations.push('topic 涉及股票數不足，傳導路徑判斷有限。');
    }
    if (symbolFirstSeen.size === 0) {
      return {
        topic: canonicalTopic,
        originCluster: { symbols: [], firstSeenDate: '' },
        spreadClusters: [],
        spreadPattern: 'unclear',
        spreadSpeed: 'slow',
        trustLevelSummary: trustSummary(stats).text,
        limitations: ['topic 資料不足，無法建立跨板塊傳導結構。', ...limitations],
      };
    }

    const symbols = [...symbolFirstSeen.keys()];
    const stocks = await prisma.stock.findMany({
      where: { id: { in: symbols } },
      select: { id: true, industry: true },
    });
    const stockMap = new Map(stocks.map((s) => [s.id, s.industry?.trim() || '']));
    if (stocks.length === 0) limitations.push('無 sector mapping，已降級為 symbol-only 傳導分析。');

    const clusterMap = new Map<
      string,
      { symbols: Set<string>; firstSeenDate: string; sector?: string }
    >();
    for (const [symbol, firstSeenDate] of symbolFirstSeen.entries()) {
      const sector = stockMap.get(symbol) || undefined;
      const clusterKey = sector ? `sector:${sector}` : `symbol:${symbol}`;
      const cluster = clusterMap.get(clusterKey) ?? {
        symbols: new Set<string>(),
        firstSeenDate,
        sector,
      };
      cluster.symbols.add(symbol);
      if (firstSeenDate < cluster.firstSeenDate) cluster.firstSeenDate = firstSeenDate;
      clusterMap.set(clusterKey, cluster);
    }

    const clusters = [...clusterMap.values()].sort((a, b) => a.firstSeenDate.localeCompare(b.firstSeenDate));
    const origin = clusters[0];
    const spreadClusters: SpreadCluster[] = clusters.slice(1).map((cluster) => ({
      symbols: [...cluster.symbols].slice(0, 20),
      sector: cluster.sector,
      firstSeenDate: cluster.firstSeenDate,
      spreadDelay: dayDiff(origin.firstSeenDate, cluster.firstSeenDate),
    }));

    const sectorCount = new Set(clusters.map((c) => c.sector).filter(Boolean)).size;
    let spreadPattern = classifySpreadPattern(sectorCount, symbolFirstSeen.size);
    let spreadSpeed = classifySpreadSpeed(spreadClusters.map((c) => c.spreadDelay));
    const trust = trustSummary(stats);

    if (trust.lowRatio >= 0.8) {
      spreadSpeed = reduceSpeed(spreadSpeed);
      if (spreadPattern === 'broad_market') spreadPattern = 'sector_expansion';
      limitations.push('來源多為 low-trust，已保守下調傳導速度/擴散判斷。');
    }
    if (trust.lowRatio >= 0.95) {
      spreadSpeed = 'slow';
      limitations.push('幾乎全為低可信來源，傳導解讀僅供研究觀察。');
    }
    if (spreadClusters.length === 0) limitations.push('尚未觀察到明確跨群擴散，可能仍處 early cluster。');

    return {
      topic: canonicalTopic,
      originCluster: {
        symbols: [...origin.symbols].slice(0, 20),
        sector: origin.sector,
        firstSeenDate: origin.firstSeenDate,
      },
      spreadClusters: spreadClusters.slice(0, 20),
      spreadPattern,
      spreadSpeed,
      trustLevelSummary: trust.text,
      limitations,
    };
  } catch (error) {
    return {
      topic: canonicalTopic,
      originCluster: { symbols: [], firstSeenDate: '' },
      spreadClusters: [],
      spreadPattern: 'unclear',
      spreadSpeed: 'slow',
      trustLevelSummary: 'official 0 / mainstream 0 / secondary 0 / unknown 0',
      limitations: [
        'CrossMarketThemeEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const CrossMarketThemeEngine = {
  generateCrossMarketTheme,
};

