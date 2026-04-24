import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export interface GraphNode {
  id: string;
  type: 'topic' | 'sector' | 'symbol';
  label: string;
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  strength: number;
  relationType: string;
}

export interface SectorRelationGraphResult {
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
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

export async function generateSectorRelationGraph(params: {
  topic: string;
  days?: number;
  minStrength?: number;
  includeSymbols?: boolean;
}): Promise<SectorRelationGraphResult> {
  const topic = params.topic.trim();
  const days = Math.min(Math.max(params.days ?? 7, 1), 30);
  const minStrength = Math.max(params.minStrength ?? 1, 1);
  const includeSymbols = params.includeSymbols !== false;
  const limitations: string[] = [];

  try {
    const canonical = extractAndNormalizeTopics({ title: topic, summary: topic, relatedThemes: [topic] }).topics[0] ?? topic;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.newsEvent.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: 'desc' },
      take: 1200,
    });

    const symbolCount = new Map<string, number>();
    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonical)) continue;
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      symbols.forEach((s) => symbolCount.set(s, (symbolCount.get(s) ?? 0) + 1));
    }

    if (symbolCount.size === 0) {
      return {
        topic: canonical,
        nodes: [{ id: `topic:${canonical}`, type: 'topic', label: canonical, weight: 1 }],
        edges: [],
        limitations: ['topic 資料不足，無法建立關聯圖。'],
      };
    }

    const symbols = [...symbolCount.keys()];
    const stocks = await prisma.stock.findMany({
      where: { id: { in: symbols } },
      select: { id: true, industry: true, name: true },
    });
    const stockMap = new Map(stocks.map((s) => [s.id, s]));

    const nodes: GraphNode[] = [{ id: `topic:${canonical}`, type: 'topic', label: canonical, weight: symbolCount.size }];
    const edges: GraphEdge[] = [];
    const sectorCount = new Map<string, number>();

    for (const [symbol, count] of symbolCount.entries()) {
      const stock = stockMap.get(symbol);
      const sector = stock?.industry?.trim() || null;
      if (!includeSymbols && !sector) continue;
      if (includeSymbols) {
        nodes.push({
          id: `symbol:${symbol}`,
          type: 'symbol',
          label: `${symbol}${stock?.name ? ` ${stock.name}` : ''}`,
          weight: count,
        });
      }
      if (sector) {
        sectorCount.set(sector, (sectorCount.get(sector) ?? 0) + count);
        if (includeSymbols) {
          edges.push({
            source: `sector:${sector}`,
            target: `symbol:${symbol}`,
            strength: count,
            relationType: 'sector_contains_symbol',
          });
        }
      } else {
        edges.push({
          source: `topic:${canonical}`,
          target: `symbol:${symbol}`,
          strength: count,
          relationType: 'topic_mentions_symbol',
        });
      }
    }

    if (sectorCount.size > 0) {
      for (const [sector, weight] of sectorCount.entries()) {
        nodes.push({ id: `sector:${sector}`, type: 'sector', label: sector, weight });
        edges.push({
          source: `topic:${canonical}`,
          target: `sector:${sector}`,
          strength: weight,
          relationType: 'topic_links_sector',
        });
      }
    } else {
      limitations.push('無可用 sector mapping，已降級為 topic → symbol 關係。');
    }

    const filteredEdges = edges.filter((e) => e.strength >= minStrength);
    if (filteredEdges.length === 0) limitations.push('edge 強度不足或資料過少，已回傳簡化關係。');

    return {
      topic: canonical,
      nodes: nodes.slice(0, 60),
      edges: filteredEdges.slice(0, 120),
      limitations,
    };
  } catch (error) {
    return {
      topic,
      nodes: [],
      edges: [],
      limitations: [
        'SectorRelationGraphEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const SectorRelationGraphEngine = {
  generateSectorRelationGraph,
};
