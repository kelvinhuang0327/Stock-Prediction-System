import { RecommendationHistoryService, type RecommendationHistoryStatus } from './RecommendationHistoryService';
import type { PolicyRecommendationType } from './PolicyRecommendationEngine';

export type RecommendationTrendWindow = '7d' | '14d' | '30d';
export type RecommendationTrendBucket = 'day' | 'week';
export type RecommendationTrendDirection = 'improving' | 'worsening' | 'stable' | 'oscillating' | 'insufficient';

export interface RecommendationTrendBucketPoint {
  date: string;
  label: string;
  total: number;
  active: number;
  resolved: number;
}

export interface RecommendationTrendSummary {
  trendDirection: RecommendationTrendDirection;
  totalOccurrences: number;
  totalResolved: number;
  avgPerBucket: number;
  peakBucket: number;
  bucketCount: number;
  windowDays: number;
  bucketSizeDays: number;
  periodStart: string;
  periodEnd: string;
}

export interface RecommendationTrendResult {
  recommendationType: PolicyRecommendationType | null;
  targetJob: string | null;
  status: RecommendationHistoryStatus | 'all';
  window: RecommendationTrendWindow;
  bucket: RecommendationTrendBucket;
  buckets: RecommendationTrendBucketPoint[];
  summary: RecommendationTrendSummary;
  limitations: string[];
  generatedAt: string;
}

export interface RecommendationTrendFilter {
  recommendationType?: PolicyRecommendationType;
  targetJob?: string;
  status?: RecommendationHistoryStatus | 'all';
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function windowToDays(window: RecommendationTrendWindow): number {
  if (window === '7d') return 7;
  if (window === '14d') return 14;
  return 30;
}

function bucketToSizeDays(bucket: RecommendationTrendBucket): number {
  return bucket === 'week' ? 7 : 1;
}

function buildWindowStart(now: Date, windowDays: number): Date {
  return new Date(startOfUtcDay(now).getTime() - Math.max(0, windowDays - 1) * 24 * 60 * 60 * 1000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildLabel(date: Date, bucket: RecommendationTrendBucket): string {
  return bucket === 'week' ? `Week of ${formatDate(date)}` : formatDate(date);
}

function bucketIndexFor(date: Date, start: Date, bucketSizeDays: number): number {
  const diffDays = Math.floor((startOfUtcDay(date).getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / bucketSizeDays);
}

function createEmptyBuckets(start: Date, count: number, bucketSizeDays: number, bucket: RecommendationTrendBucket): RecommendationTrendBucketPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * bucketSizeDays * 24 * 60 * 60 * 1000);
    return {
      date: formatDate(date),
      label: buildLabel(date, bucket),
      total: 0,
      active: 0,
      resolved: 0,
    };
  });
}

function summarizeTrend(buckets: RecommendationTrendBucketPoint[], totalOccurrences: number): RecommendationTrendDirection {
  const nonZeroBuckets = buckets.filter((bucket) => bucket.total > 0 || bucket.active > 0 || bucket.resolved > 0);
  if (buckets.length < 2 || nonZeroBuckets.length < 2 || totalOccurrences === 0) return 'insufficient';

  const midpoint = Math.ceil(buckets.length / 2);
  const firstHalf = buckets.slice(0, midpoint);
  const secondHalf = buckets.slice(midpoint);
  const firstTotal = firstHalf.reduce((sum, bucket) => sum + bucket.total, 0);
  const secondTotal = secondHalf.reduce((sum, bucket) => sum + bucket.total, 0);

  const deltas = buckets
    .map((bucket, index) => (index === 0 ? 0 : bucket.total - buckets[index - 1].total))
    .slice(1)
    .filter((delta) => delta !== 0);
  const signChanges = deltas.reduce((count, delta, index) => {
    if (index === 0) return 0;
    const prev = deltas[index - 1];
    return count + (Math.sign(prev) !== Math.sign(delta) ? 1 : 0);
  }, 0);

  const variation = buckets.reduce((sum, bucket) => sum + Math.abs(bucket.total - totalOccurrences / buckets.length), 0) / Math.max(1, totalOccurrences);

  if (nonZeroBuckets.length >= 4 && (signChanges >= 2 || (variation > 1.0 && firstTotal > 0 && secondTotal > 0))) {
    return 'oscillating';
  }
  if (secondTotal >= Math.max(1, firstTotal) * 1.25) return 'worsening';
  if (secondTotal <= Math.max(1, firstTotal) * 0.75) return 'improving';
  return 'stable';
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readTimeline(metadata: Record<string, unknown>, key: string): Record<string, number> {
  const raw = metadata[key];
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const timeline: Record<string, number> = {};
  for (const [entryKey, entryValue] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entryValue === 'number' && Number.isFinite(entryValue)) {
      timeline[entryKey] = entryValue;
    } else if (typeof entryValue === 'string') {
      const parsed = Number.parseFloat(entryValue);
      if (Number.isFinite(parsed)) timeline[entryKey] = parsed;
    }
  }
  return timeline;
}

export class RecommendationTrendService {
  constructor(private readonly historyService = new RecommendationHistoryService()) {}

  async build(
    filter: RecommendationTrendFilter = {},
    window: RecommendationTrendWindow = '14d',
    bucket: RecommendationTrendBucket = 'day',
    now = new Date(),
  ): Promise<RecommendationTrendResult> {
    const windowDays = windowToDays(window);
    const bucketSizeDays = bucketToSizeDays(bucket);
    const bucketCount = Math.max(1, Math.ceil(windowDays / bucketSizeDays));
    const windowStart = buildWindowStart(now, windowDays);

    const rows = await this.historyService.listHistory(
      {
        jobName: filter.targetJob,
        recommendationType: filter.recommendationType,
        status: filter.status ?? 'all',
        sortBy: 'latest',
        sortDir: 'desc',
        limit: 500,
        offset: 0,
      },
      now,
    );

    const buckets = createEmptyBuckets(windowStart, bucketCount, bucketSizeDays, bucket);
    const filtered = rows.filter((row) => {
      const metadata = parseMetadata(row.metadata);
      const observationTimeline = readTimeline(metadata, 'observationTimeline');
      const resolutionTimeline = readTimeline(metadata, 'resolutionTimeline');
      const hasObservation = Object.keys(observationTimeline).some((key) => {
        const parsed = parseDate(key);
        return parsed ? parsed >= windowStart : false;
      });
      const hasResolution = Object.keys(resolutionTimeline).some((key) => {
        const parsed = parseDate(key);
        return parsed ? parsed >= windowStart : false;
      });
      const fallbackAnchor = parseDate(row.status === 'resolved' ? row.resolvedAt ?? row.lastDetectedAt : row.lastDetectedAt ?? row.firstDetectedAt);
      return hasObservation || hasResolution || (fallbackAnchor ? fallbackAnchor >= windowStart : false);
    });

    for (const row of filtered) {
      const metadata = parseMetadata(row.metadata);
      const observationTimeline = readTimeline(metadata, 'observationTimeline');
      const resolutionTimeline = readTimeline(metadata, 'resolutionTimeline');
      const fallbackAnchor = parseDate(row.status === 'resolved' ? row.resolvedAt ?? row.lastDetectedAt : row.lastDetectedAt ?? row.firstDetectedAt);

      if (Object.keys(observationTimeline).length === 0 && fallbackAnchor && fallbackAnchor >= windowStart) {
        const index = bucketIndexFor(fallbackAnchor, windowStart, bucketSizeDays);
        if (index >= 0 && index < buckets.length) {
          const point = buckets[index];
          point.total += row.occurrenceCount;
          if (row.status === 'active') point.active += 1;
        }
      } else {
        for (const [dateText, count] of Object.entries(observationTimeline)) {
          const date = parseDate(dateText);
          if (!date || date < windowStart) continue;
          const index = bucketIndexFor(date, windowStart, bucketSizeDays);
          if (index < 0 || index >= buckets.length) continue;
          const point = buckets[index];
          point.total += count;
          if (row.status === 'active') point.active += count;
        }
      }

      if (Object.keys(resolutionTimeline).length === 0 && row.status === 'resolved' && fallbackAnchor && fallbackAnchor >= windowStart) {
        const index = bucketIndexFor(fallbackAnchor, windowStart, bucketSizeDays);
        if (index >= 0 && index < buckets.length) {
          const point = buckets[index];
          point.total += row.occurrenceCount;
          point.resolved += 1;
        }
      } else {
        for (const [dateText, count] of Object.entries(resolutionTimeline)) {
          const date = parseDate(dateText);
          if (!date || date < windowStart) continue;
          const index = bucketIndexFor(date, windowStart, bucketSizeDays);
          if (index < 0 || index >= buckets.length) continue;
          const point = buckets[index];
          point.total += count;
          point.resolved += count;
        }
      }
    }

    const totalOccurrences = buckets.reduce((sum, point) => sum + point.total, 0);
    const totalResolved = buckets.reduce((sum, point) => sum + point.resolved, 0);
    const avgPerBucket = buckets.length > 0 ? totalOccurrences / buckets.length : 0;
    const peakBucket = buckets.reduce((max, point) => Math.max(max, point.total), 0);
    const trendDirection = summarizeTrend(buckets, totalOccurrences);

    const limitations = [
      ...(filtered.length === 0 ? ['No recommendation history found in the selected trend window.'] : []),
      ...(buckets.filter((point) => point.total > 0 || point.active > 0 || point.resolved > 0).length < 2
        ? ['Recommendation trend is sparse, so direction should be read conservatively.']
        : []),
      ...(bucket === 'week' ? ['Weekly bucketing smooths spikes, so short-lived bursts may be muted.'] : []),
      'Recommendation trend is derived from persisted lifecycle timestamps, not per-run event snapshots.',
    ];

    return {
      recommendationType: filter.recommendationType ?? null,
      targetJob: filter.targetJob ?? null,
      status: filter.status ?? 'all',
      window,
      bucket,
      buckets,
      summary: {
        trendDirection,
        totalOccurrences,
        totalResolved,
        avgPerBucket,
        peakBucket,
        bucketCount: buckets.length,
        windowDays,
        bucketSizeDays,
        periodStart: windowStart.toISOString(),
        periodEnd: new Date(now).toISOString(),
      },
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
