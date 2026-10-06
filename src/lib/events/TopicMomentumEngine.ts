import { prisma } from '@/lib/prisma';
import { extractAndNormalizeTopics } from '@/lib/events/TopicNormalizationService';

export type TopicMomentumType = 'spike' | 'rising' | 'stable' | 'cooling' | 'unknown';

export interface TopicMomentumPoint {
  date: string;
  count: number;
}

export interface TopicMomentumResult {
  topic: string;
  timeline: TopicMomentumPoint[];
  momentumType: TopicMomentumType;
  peak: number;
  avg: number;
  recentTrend: number;
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

function classifyMomentum(timeline: TopicMomentumPoint[], days: number): { type: TopicMomentumType; recentTrend: number } {
  if (timeline.length < Math.min(3, days)) return { type: 'unknown', recentTrend: 0 };
  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  const counts = sorted.map((p) => p.count);
  const half = Math.max(1, Math.floor(Math.min(days, counts.length) / 2));
  const recent = counts.slice(-half);
  const previous = counts.slice(-half * 2, -half);
  if (previous.length === 0) return { type: 'unknown', recentTrend: 0 };

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
  const trend = recentAvg - previousAvg;
  const peak = Math.max(...counts);

  if (peak >= Math.max(4, previousAvg * 2.5) && counts[counts.length - 1] < peak * 0.75) return { type: 'spike', recentTrend: trend };
  if (trend >= 1) return { type: 'rising', recentTrend: trend };
  if (trend <= -1) return { type: 'cooling', recentTrend: trend };
  return { type: 'stable', recentTrend: trend };
}

export async function generateTopicMomentum(params: {
  topic: string;
  days?: number;
  minCount?: number;
}): Promise<TopicMomentumResult> {
  const topic = params.topic.trim();
  const days = Math.min(Math.max(params.days ?? 7, 1), 30);
  const minCount = Math.max(params.minCount ?? 1, 0);
  const canonicalTopic = resolveCanonicalTopic(topic);
  const limitations: string[] = [];

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.newsEvent.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: 'asc' },
      take: 1200,
    });

    const byDate = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      byDate.set(toDateKey(d), 0);
    }

    for (const row of rows) {
      const normalized = extractAndNormalizeTopics({
        title: row.title,
        summary: row.summary ?? '',
        relatedThemes: parseStringArray(row.relatedThemes),
      }).topics;
      if (!normalized.includes(canonicalTopic)) continue;
      const dateKey = toDateKey(row.publishedAt);
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + 1);
    }

    const timeline = [...byDate.entries()]
      .map(([date, count]) => ({ date, count }))
      .filter((p) => p.count >= minCount || minCount === 0);

    if (timeline.length === 0) {
      limitations.push('topic 資料不足，無可用時間序列。');
      return {
        topic: canonicalTopic,
        timeline: [],
        momentumType: 'unknown',
        peak: 0,
        avg: 0,
        recentTrend: 0,
        limitations,
      };
    }

    const peak = Math.max(...timeline.map((p) => p.count));
    const avg = timeline.reduce((a, b) => a + b.count, 0) / Math.max(1, timeline.length);
    const momentum = classifyMomentum(timeline, Math.min(6, days));
    if (timeline.length < 6) limitations.push('歷史資料不足 6 天，momentum 判斷可能偏弱。');

    return {
      topic: canonicalTopic,
      timeline,
      momentumType: momentum.type,
      peak,
      avg: Number(avg.toFixed(2)),
      recentTrend: Number(momentum.recentTrend.toFixed(2)),
      limitations,
    };
  } catch (error) {
    return {
      topic: canonicalTopic,
      timeline: [],
      momentumType: 'unknown',
      peak: 0,
      avg: 0,
      recentTrend: 0,
      limitations: [
        'TopicMomentumEngine 查詢失敗，已降級為空結構',
        error instanceof Error ? error.message : 'unknown error',
      ],
    };
  }
}

export const TopicMomentumEngine = {
  generateTopicMomentum,
};
