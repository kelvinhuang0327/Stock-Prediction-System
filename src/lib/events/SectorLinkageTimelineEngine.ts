import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type SectorTimelineStage = 'early' | 'spreading' | 'mature' | 'fading' | 'unknown';
export type SectorTimelineTrend = 'expanding' | 'stable' | 'contracting';

export interface SectorTimelinePoint {
  date: string;
  sectors: string[];
  symbolCount: number;
  breadth: number;
  linkageStrength: number;
}

export interface SectorLinkageTimelineResult {
  topic: string;
  timeline: SectorTimelinePoint[];
  stage: SectorTimelineStage;
  trend: SectorTimelineTrend;
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

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function resolveCanonicalTopic(topic: string): string {
  const normalized = extractAndNormalizeTopics({ title: topic, summary: topic, relatedThemes: [topic] }).topics;
  return normalized[0] ?? topic.trim();
}

function getTrend(delta: number): SectorTimelineTrend {
  if (delta >= 1) return 'expanding';
  if (delta <= -1) return 'contracting';
  return 'stable';
}

function classifyStage(
  timeline: SectorTimelinePoint[],
  avgRecent: number,
  avgPrevious: number,
  peakBreadth: number,
): SectorTimelineStage {
  const nonZero = timeline.filter((p) => p.symbolCount > 0);
  if (nonZero.length === 0) return 'unknown';
  if (nonZero.length <= 2 && peakBreadth <= 2) return 'early';
  if (avgRecent >= avgPrevious + 1) return 'spreading';
  if (avgPrevious > avgRecent + 1) return 'fading';
  if (peakBreadth >= 5 && Math.abs(avgRecent - avgPrevious) < 1) return 'mature';
  return avgRecent > 0 ? 'mature' : 'unknown';
}

export async function generateSectorLinkageTimeline(params: {
  topic: string;
  days?: number;
  minBreadth?: number;
}): Promise<SectorLinkageTimelineResult> {
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

    const symbolSet = new Set<string>();
    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonicalTopic)) continue;
      parseStringArray(row.relatedSymbols).forEach((s) => symbolSet.add(s.toUpperCase()));
    }

    const stocks = symbolSet.size
      ? await prisma.stock.findMany({
          where: { id: { in: [...symbolSet] } },
          select: { id: true, industry: true },
        })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.id, s.industry?.trim() || '']));
    if (symbolSet.size > 0 && stocks.length === 0) {
      limitations.push('無 sector mapping，已降級為 symbol-only timeline。');
    }

    const byDate = new Map<
      string,
      {
        sectors: Set<string>;
        symbols: Set<string>;
        trustLow: number;
        trustTotal: number;
      }
    >();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      byDate.set(toDateKey(d), { sectors: new Set<string>(), symbols: new Set<string>(), trustLow: 0, trustTotal: 0 });
    }

    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonicalTopic)) continue;
      const dateKey = toDateKey(row.publishedAt);
      const bucket = byDate.get(dateKey);
      if (!bucket) continue;
      const symbols = parseStringArray(row.relatedSymbols).map((s) => s.toUpperCase());
      symbols.forEach((symbol) => {
        bucket.symbols.add(symbol);
        const sector = stockMap.get(symbol);
        if (sector) bucket.sectors.add(sector);
      });
      bucket.trustTotal += 1;
      if (row.trustLevel === 'secondary' || row.trustLevel === 'unknown') bucket.trustLow += 1;
    }

    const timeline: SectorTimelinePoint[] = [...byDate.entries()].map(([date, bucket]) => {
      const symbolCount = bucket.symbols.size;
      const breadth = symbolCount;
      const rawStrength = breadth + bucket.sectors.size * 1.5;
      const lowRatio = bucket.trustTotal > 0 ? bucket.trustLow / bucket.trustTotal : 0;
      const trustAdjustedStrength = lowRatio >= 0.8 ? rawStrength * 0.6 : rawStrength;
      return {
        date,
        sectors: [...bucket.sectors].slice(0, 8),
        symbolCount,
        breadth,
        linkageStrength: Number(trustAdjustedStrength.toFixed(2)),
      };
    });

    const nonZero = timeline.filter((p) => p.breadth >= minBreadth);
    if (nonZero.length === 0) {
      limitations.push('topic 歷史資料不足，timeline 為空或低於 minBreadth。');
      return {
        topic: canonicalTopic,
        timeline: [],
        stage: 'unknown',
        trend: 'stable',
        limitations,
      };
    }

    const recent = timeline.slice(-3);
    const previous = timeline.slice(-6, -3);
    if (previous.length === 0) limitations.push('無前期比較資料，stage 判斷已降級。');
    const avgRecent = recent.reduce((sum, p) => sum + p.breadth, 0) / Math.max(1, recent.length);
    const avgPrevious = previous.reduce((sum, p) => sum + p.breadth, 0) / Math.max(1, previous.length);
    const stage =
      previous.length === 0
        ? 'unknown'
        : classifyStage(timeline, avgRecent, avgPrevious, Math.max(...timeline.map((p) => p.breadth)));
    const trend = previous.length === 0 ? 'stable' : getTrend(avgRecent - avgPrevious);

    const totalTrust = [...byDate.values()].reduce(
      (acc, b) => ({ low: acc.low + b.trustLow, total: acc.total + b.trustTotal }),
      { low: 0, total: 0 },
    );
    if (totalTrust.total > 0 && totalTrust.low / totalTrust.total >= 0.8) {
      limitations.push('來源多為 low-trust，linkage strength 已保守下調。');
    }
    if (nonZero.length <= 2) limitations.push('topic 資料點偏少，stage 可能不穩定。');

    return {
      topic: canonicalTopic,
      timeline,
      stage,
      trend,
      limitations,
    };
  } catch (error) {
    return {
      topic: canonicalTopic,
      timeline: [],
      stage: 'unknown',
      trend: 'stable',
      limitations: [
        'SectorLinkageTimelineEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const SectorLinkageTimelineEngine = {
  generateSectorLinkageTimeline,
};
