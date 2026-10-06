import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type DiffusionType = 'single' | 'cluster' | 'broad';

export interface ThemeDiffusionNode {
  symbol: string;
  eventCount: number;
}

export interface ThemeDiffusionResult {
  topic: string;
  nodes: ThemeDiffusionNode[];
  breadth: number;
  diffusionType: DiffusionType;
  sourceDiversity: number;
  limitations: string[];
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function resolveCanonicalTopic(topic: string): string {
  const normalized = extractAndNormalizeTopics({ title: topic, summary: topic, relatedThemes: [topic] }).topics;
  return normalized[0] ?? topic.trim();
}

function getDiffusionType(breadth: number): DiffusionType {
  if (breadth >= 5) return 'broad';
  if (breadth >= 2) return 'cluster';
  return 'single';
}

export async function generateThemeDiffusion(params: {
  topic: string;
  days?: number;
  minCount?: number;
}): Promise<ThemeDiffusionResult> {
  const topic = params.topic.trim();
  const days = Math.min(Math.max(params.days ?? 7, 1), 30);
  const minCount = Math.max(params.minCount ?? 1, 0);
  const canonicalTopic = resolveCanonicalTopic(topic);
  const limitations: string[] = [];

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.newsEvent.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: 'desc' },
      take: 1200,
    });

    const symbolMap = new Map<string, number>();
    const sourceSet = new Set<string>();
    let lowTrustCount = 0;
    let total = 0;

    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonicalTopic)) continue;
      total += 1;
      if (row.trustLevel === 'secondary' || row.trustLevel === 'unknown') lowTrustCount++;
      sourceSet.add(row.source);
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      symbols.forEach((s) => symbolMap.set(s, (symbolMap.get(s) ?? 0) + 1));
    }

    const nodes = [...symbolMap.entries()]
      .map(([symbol, eventCount]) => ({ symbol, eventCount }))
      .filter((n) => n.eventCount >= minCount || minCount === 0)
      .sort((a, b) => b.eventCount - a.eventCount);

    const breadth = nodes.length;
    if (total === 0) {
      limitations.push('topic 事件不足，無法建立擴散圖。');
      return {
        topic: canonicalTopic,
        nodes: [],
        breadth: 0,
        diffusionType: 'single',
        sourceDiversity: 0,
        limitations,
      };
    }
    if (breadth <= 1) limitations.push('symbol 數量偏少，擴散判斷有限。');
    if (total > 0 && lowTrustCount / total >= 0.8) limitations.push('來源多為低可信度，擴散解讀需保守。');

    return {
      topic: canonicalTopic,
      nodes: nodes.slice(0, 20),
      breadth,
      diffusionType: getDiffusionType(breadth),
      sourceDiversity: sourceSet.size,
      limitations,
    };
  } catch (error) {
    return {
      topic: canonicalTopic,
      nodes: [],
      breadth: 0,
      diffusionType: 'single',
      sourceDiversity: 0,
      limitations: [
        'ThemeDiffusionEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const ThemeDiffusionEngine = {
  generateThemeDiffusion,
};
