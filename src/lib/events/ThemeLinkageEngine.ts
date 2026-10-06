import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type LinkageStrength = 'weak' | 'moderate' | 'strong';

export interface LinkedTopic {
  topic: string;
  coOccurrence: number;
  overlapSymbols: string[];
  trustLevelSummary: string;
  linkageStrength: LinkageStrength;
}

export interface ThemeLinkageResult {
  topic: string;
  linkedTopics: LinkedTopic[];
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

function strengthRank(level: LinkageStrength): number {
  if (level === 'strong') return 2;
  if (level === 'moderate') return 1;
  return 0;
}

function trustSummary(stats: { official: number; mainstream: number; secondary: number; unknown: number }): { text: string; lowRatio: number } {
  const total = stats.official + stats.mainstream + stats.secondary + stats.unknown;
  const low = stats.secondary + stats.unknown;
  const lowRatio = total > 0 ? low / total : 0;
  return {
    text: `official ${stats.official} / mainstream ${stats.mainstream} / secondary ${stats.secondary} / unknown ${stats.unknown}`,
    lowRatio,
  };
}

function classifyStrength(coOccurrence: number, overlapSymbols: number, sourceDiversity: number): LinkageStrength {
  if (coOccurrence >= 4 && overlapSymbols >= 2 && sourceDiversity >= 2) return 'strong';
  if (coOccurrence >= 2 && overlapSymbols >= 1) return 'moderate';
  return 'weak';
}

export async function generateThemeLinkage(params: {
  topic: string;
  days?: number;
  minStrength?: LinkageStrength;
  includeSymbols?: boolean;
}): Promise<ThemeLinkageResult> {
  const topic = params.topic.trim();
  const days = Math.min(Math.max(params.days ?? 7, 1), 30);
  const minStrength = params.minStrength ?? 'weak';
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

    type Acc = {
      coOccurrence: number;
      symbols: Set<string>;
      sources: Set<string>;
      official: number;
      mainstream: number;
      secondary: number;
      unknown: number;
    };
    const map = new Map<string, Acc>();

    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonical)) continue;
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      for (const other of normalized) {
        if (other === canonical) continue;
        const acc = map.get(other) ?? {
          coOccurrence: 0,
          symbols: new Set<string>(),
          sources: new Set<string>(),
          official: 0,
          mainstream: 0,
          secondary: 0,
          unknown: 0,
        };
        acc.coOccurrence += 1;
        symbols.forEach((s) => acc.symbols.add(s));
        acc.sources.add(row.source);
        if (row.trustLevel === 'official' || row.trustLevel === 'mainstream' || row.trustLevel === 'secondary') {
          acc[row.trustLevel] += 1;
        } else {
          acc.unknown += 1;
        }
        map.set(other, acc);
      }
    }

    const linkedTopics = [...map.entries()]
      .map(([name, acc]): LinkedTopic => {
        let linkageStrength = classifyStrength(acc.coOccurrence, acc.symbols.size, acc.sources.size);
        const trust = trustSummary(acc);
        if (trust.lowRatio >= 0.8 && linkageStrength === 'strong') linkageStrength = 'moderate';
        if (trust.lowRatio >= 0.9 && linkageStrength === 'moderate') linkageStrength = 'weak';
        return {
          topic: name,
          coOccurrence: acc.coOccurrence,
          overlapSymbols: includeSymbols ? [...acc.symbols].slice(0, 12) : [],
          trustLevelSummary: trust.text,
          linkageStrength,
        };
      })
      .filter((item) => strengthRank(item.linkageStrength) >= strengthRank(minStrength))
      .sort((a, b) => {
        if (strengthRank(b.linkageStrength) !== strengthRank(a.linkageStrength)) {
          return strengthRank(b.linkageStrength) - strengthRank(a.linkageStrength);
        }
        return b.coOccurrence - a.coOccurrence;
      })
      .slice(0, 8);

    if (linkedTopics.length === 0) limitations.push('無共同出現資料或主題資料不足，已回傳空連動結構。');
    if (linkedTopics.some((t) => /secondary|unknown/.test(t.trustLevelSummary) && t.linkageStrength !== 'weak')) {
      limitations.push('部分連動來源低可信，已保守下調 linkage 強度。');
    }

    return { topic: canonical, linkedTopics, limitations };
  } catch (error) {
    return {
      topic,
      linkedTopics: [],
      limitations: [
        'ThemeLinkageEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const ThemeLinkageEngine = {
  generateThemeLinkage,
};
