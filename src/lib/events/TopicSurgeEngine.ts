import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type TopicSurgeLevel = 'none' | 'watch' | 'surging';
export type ThemeDiffusionLevel = 'single-stock theme' | 'multi-stock theme' | 'broadening theme';

export interface TopicSurgeResult {
  topic: string;
  recentCount: number;
  previousCount: number;
  delta: number;
  surgeLevel: TopicSurgeLevel;
  diffusionLevel: ThemeDiffusionLevel;
  relatedSymbols: string[];
  trustLevelSummary: string;
  limitations: string[];
}

export interface TopicSurgeResponse {
  summary: string;
  topics: TopicSurgeResult[];
  limitations: string[];
  generatedAt: string;
}

export interface TopicSurgeParams {
  days?: number;
  minSurgeLevel?: TopicSurgeLevel;
  includeSymbols?: boolean;
  maxTopics?: number;
  symbol?: string;
}

interface TopicAccumulator {
  topic: string;
  recentCount: number;
  previousCount: number;
  recentSymbols: Set<string>;
  previousSymbols: Set<string>;
  recentSources: Set<string>;
  official: number;
  mainstream: number;
  secondary: number;
  unknown: number;
  limitations: string[];
}

const SURGE_RANK: Record<TopicSurgeLevel, number> = { none: 0, watch: 1, surging: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function pickTrustLevel(value: string): 'official' | 'mainstream' | 'secondary' | 'unknown' {
  if (value === 'official' || value === 'mainstream' || value === 'secondary') return value;
  return 'unknown';
}

function computeSurgeLevel(recent: number, previous: number, comparisonAvailable: boolean): TopicSurgeLevel {
  if (recent === 0) return 'none';
  if (!comparisonAvailable) return recent >= 3 ? 'watch' : 'none';
  if ((previous === 0 && recent >= 3) || (recent >= previous + 2 && recent >= Math.ceil(previous * 1.5))) {
    return 'surging';
  }
  if (recent > previous && recent >= 2) return 'watch';
  return 'none';
}

function computeDiffusionLevel(
  recentSymbols: number,
  previousSymbols: number,
  sourceCount: number,
): ThemeDiffusionLevel {
  if (recentSymbols >= 4 && recentSymbols >= previousSymbols + 2 && sourceCount >= 3) return 'broadening theme';
  if (recentSymbols >= 2) return 'multi-stock theme';
  return 'single-stock theme';
}

function trustSummary(acc: TopicAccumulator): { text: string; lowTrustRatio: number } {
  const total = acc.official + acc.mainstream + acc.secondary + acc.unknown;
  const low = acc.secondary + acc.unknown;
  const lowTrustRatio = total === 0 ? 0 : low / total;
  const note =
    acc.official + acc.mainstream > 0
      ? '主流/官方來源佔比存在'
      : '來源多為次級或未知，需保守解讀';
  return {
    text: `official ${acc.official} / mainstream ${acc.mainstream} / secondary ${acc.secondary} / unknown ${acc.unknown}（${note}）`,
    lowTrustRatio,
  };
}

function buildSummary(topics: TopicSurgeResult[], limitations: string[]): string {
  if (topics.length === 0) {
    return limitations.length > 0 ? '主題升溫資料有限，僅提供降級摘要。' : '近期未偵測到明確主題升溫。';
  }
  const surging = topics.filter((t) => t.surgeLevel === 'surging').length;
  const broadening = topics.filter((t) => t.diffusionLevel === 'broadening theme').length;
  if (surging > 0) return `近期有 ${surging} 個主題呈升溫，${broadening} 個主題具擴散跡象，請持續觀察。`;
  return `近期有 ${topics.length} 個主題具觀察價值，擴散程度仍需持續追蹤。`;
}

export async function generateTopicSurgeSummary(params?: TopicSurgeParams): Promise<TopicSurgeResponse> {
  const days = Math.min(Math.max(params?.days ?? 3, 1), 7);
  const minLevel = params?.minSurgeLevel ?? 'none';
  const maxTopics = Math.min(Math.max(params?.maxTopics ?? 5, 1), 20);
  const includeSymbols = params?.includeSymbols !== false;
  const symbolFilter = params?.symbol?.trim().toUpperCase();
  const limitations: string[] = [];

  try {
    const now = new Date();
    const recentStart = new Date(now.getTime() - days * DAY_MS);
    const previousStart = new Date(recentStart.getTime() - days * DAY_MS);

    const [recentRows, previousRows] = await Promise.all([
      prisma.newsEvent.findMany({
        where: { publishedAt: { gte: recentStart, lt: now } },
        orderBy: { publishedAt: 'desc' },
        take: 500,
      }),
      prisma.newsEvent.findMany({
        where: { publishedAt: { gte: previousStart, lt: recentStart } },
        orderBy: { publishedAt: 'desc' },
        take: 500,
      }),
    ]);

    if (recentRows.length < 2) limitations.push('NewsEvent 數量偏少，主題升溫判斷可信度有限。');
    const comparisonAvailable = previousRows.length > 0;
    if (!comparisonAvailable) limitations.push('無前期比較視窗資料，已降級為保守主題觀察。');

    const map = new Map<string, TopicAccumulator>();
    const upsert = (topic: string): TopicAccumulator => {
      const existing = map.get(topic);
      if (existing) return existing;
      const created: TopicAccumulator = {
        topic,
        recentCount: 0,
        previousCount: 0,
        recentSymbols: new Set<string>(),
        previousSymbols: new Set<string>(),
        recentSources: new Set<string>(),
        official: 0,
        mainstream: 0,
        secondary: 0,
        unknown: 0,
        limitations: [],
      };
      map.set(topic, created);
      return created;
    };

    for (const row of recentRows) {
      const relatedThemes = parseStringArray(row.relatedThemes);
      const normalization = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes,
      });
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      if (symbolFilter && !symbols.includes(symbolFilter)) continue;
      const trust = pickTrustLevel(row.trustLevel);
      for (const topic of normalization.topics) {
        const bucket = upsert(topic);
        bucket.recentCount += 1;
        symbols.forEach((s) => bucket.recentSymbols.add(s));
        bucket.recentSources.add(row.source);
        bucket[trust] += 1;
        bucket.limitations.push(...normalization.limitations);
      }
    }

    for (const row of previousRows) {
      const relatedThemes = parseStringArray(row.relatedThemes);
      const normalization = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes,
      });
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      if (symbolFilter && !symbols.includes(symbolFilter)) continue;
      for (const topic of normalization.topics) {
        const bucket = upsert(topic);
        bucket.previousCount += 1;
        symbols.forEach((s) => bucket.previousSymbols.add(s));
      }
    }

    const topics = [...map.values()]
      .map((acc): TopicSurgeResult => {
        let surgeLevel = computeSurgeLevel(acc.recentCount, acc.previousCount, comparisonAvailable);
        const diffusionLevel = computeDiffusionLevel(
          acc.recentSymbols.size,
          acc.previousSymbols.size,
          acc.recentSources.size,
        );
        const trust = trustSummary(acc);
        const topicLimitations = [...new Set(acc.limitations)];

        if (trust.lowTrustRatio >= 0.85 && surgeLevel === 'surging') {
          surgeLevel = 'watch';
          topicLimitations.push('來源多為 low-trust，已降級為 watch。');
        }
        if (trust.lowTrustRatio >= 0.95) {
          topicLimitations.push('幾乎全為 secondary/unknown 來源，請保守解讀。');
        }

        return {
          topic: acc.topic,
          recentCount: acc.recentCount,
          previousCount: acc.previousCount,
          delta: acc.recentCount - acc.previousCount,
          surgeLevel,
          diffusionLevel,
          relatedSymbols: includeSymbols ? [...acc.recentSymbols].slice(0, 12) : [],
          trustLevelSummary: trust.text,
          limitations: topicLimitations,
        };
      })
      .filter((item) => SURGE_RANK[item.surgeLevel] >= SURGE_RANK[minLevel])
      .sort((a, b) => {
        if (SURGE_RANK[b.surgeLevel] !== SURGE_RANK[a.surgeLevel]) return SURGE_RANK[b.surgeLevel] - SURGE_RANK[a.surgeLevel];
        if (b.delta !== a.delta) return b.delta - a.delta;
        return b.recentCount - a.recentCount;
      })
      .slice(0, maxTopics);

    return {
      summary: buildSummary(topics, limitations),
      topics,
      limitations,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      summary: '主題升溫分析暫時不可用（已降級）。',
      topics: [],
      limitations: [
        'TopicSurgeEngine 查詢失敗，已回傳降級結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const TopicSurgeEngine = {
  generateTopicSurgeSummary,
};
