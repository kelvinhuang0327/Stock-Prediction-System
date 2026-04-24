import { JobAlertHistoryService } from './JobAlertHistoryService';
import type { JobAlertRecord } from './types';

export type JobAlertTrendWindow = '7d' | '14d' | '30d';
export type JobAlertTrendBucket = 'day' | 'week';

export interface JobAlertTrendBucketPoint {
  date: string;
  label: string;
  total: number;
  active: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
}

export interface JobAlertTrendSummary {
  trendDirection: 'improving' | 'worsening' | 'stable' | 'insufficient';
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

export interface JobAlertTrendResult {
  jobName: string | null;
  window: JobAlertTrendWindow;
  bucket: JobAlertTrendBucket;
  buckets: JobAlertTrendBucketPoint[];
  summary: JobAlertTrendSummary;
  limitations: string[];
  generatedAt: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function windowToDays(window: JobAlertTrendWindow): number {
  if (window === '7d') return 7;
  if (window === '14d') return 14;
  return 30;
}

function bucketToSizeDays(bucket: JobAlertTrendBucket): number {
  return bucket === 'week' ? 7 : 1;
}

function buildWindowStart(now: Date, windowDays: number): Date {
  return new Date(startOfUtcDay(now).getTime() - Math.max(0, windowDays - 1) * 24 * 60 * 60 * 1000);
}

function parseDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildLabel(date: Date, bucket: JobAlertTrendBucket): string {
  return bucket === 'week' ? `Week of ${formatDate(date)}` : formatDate(date);
}

function bucketIndexFor(date: Date, start: Date, bucketSizeDays: number): number {
  const diffDays = Math.floor((startOfUtcDay(date).getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / bucketSizeDays);
}

function summarizeTrend(buckets: JobAlertTrendBucketPoint[], totalOccurrences: number): JobAlertTrendSummary['trendDirection'] {
  const nonZeroBuckets = buckets.filter((bucket) => bucket.total > 0 || bucket.active > 0 || bucket.resolved > 0);
  if (buckets.length < 2 || nonZeroBuckets.length < 2 || totalOccurrences === 0) return 'insufficient';

  const midpoint = Math.ceil(buckets.length / 2);
  const firstHalf = buckets.slice(0, midpoint);
  const secondHalf = buckets.slice(midpoint);
  const firstTotal = firstHalf.reduce((sum, bucket) => sum + bucket.total, 0);
  const secondTotal = secondHalf.reduce((sum, bucket) => sum + bucket.total, 0);

  if (firstTotal === 0 && secondTotal === 0) return 'insufficient';
  if (secondTotal >= Math.max(1, firstTotal) * 1.25) return 'worsening';
  if (secondTotal <= Math.max(1, firstTotal) * 0.75) return 'improving';
  return 'stable';
}

function createEmptyBuckets(start: Date, count: number, bucketSizeDays: number, bucket: JobAlertTrendBucket): JobAlertTrendBucketPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * bucketSizeDays * 24 * 60 * 60 * 1000);
    return {
      date: formatDate(date),
      label: buildLabel(date, bucket),
      total: 0,
      active: 0,
      resolved: 0,
      critical: 0,
      warning: 0,
      info: 0,
    };
  });
}

function addCounts(point: JobAlertTrendBucketPoint, row: JobAlertRecord): void {
  point.total += row.occurrenceCount;
  if (row.status === 'active') point.active += 1;
  if (row.status === 'resolved') point.resolved += 1;
  point[row.severity] += 1;
}

export class JobAlertTrendService {
  constructor(private readonly historyService = new JobAlertHistoryService()) {}

  async build(
    jobName: string | null | undefined,
    window: JobAlertTrendWindow = '14d',
    bucket: JobAlertTrendBucket = 'day',
    now = new Date(),
  ): Promise<JobAlertTrendResult> {
    const windowDays = windowToDays(window);
    const bucketSizeDays = bucketToSizeDays(bucket);
    const bucketCount = Math.max(1, Math.ceil(windowDays / bucketSizeDays));
    const windowStart = buildWindowStart(now, windowDays);
    const rawAlerts = await this.historyService.listHistory(
      {
        jobName: jobName == null ? undefined : jobName,
        status: 'all',
        includeResolved: true,
        sortBy: 'latest',
        sortDir: 'desc',
        limit: 500,
        offset: 0,
      },
      now,
    );

    const buckets = createEmptyBuckets(windowStart, bucketCount, bucketSizeDays, bucket);
    const filtered = rawAlerts.filter((row) => {
      const date = parseDate(row.resolvedAt ?? row.lastDetectedAt ?? row.firstDetectedAt ?? row.detectedAt);
      return date ? date >= windowStart : false;
    });

    for (const row of filtered) {
      const anchor = parseDate(row.resolvedAt ?? row.lastDetectedAt ?? row.firstDetectedAt ?? row.detectedAt);
      if (anchor == null) continue;
      const index = bucketIndexFor(anchor, windowStart, bucketSizeDays);
      if (index < 0 || index >= buckets.length) continue;
      addCounts(buckets[index], row);
    }

    const totalOccurrences = buckets.reduce((sum, point) => sum + point.total, 0);
    const totalResolved = buckets.reduce((sum, point) => sum + point.resolved, 0);
    const avgPerBucket = buckets.length > 0 ? totalOccurrences / buckets.length : 0;
    const peakBucket = buckets.reduce((max, point) => Math.max(max, point.total), 0);
    const trendDirection = summarizeTrend(buckets, totalOccurrences);

    const limitations = [
      ...(filtered.length === 0 ? ['No alerts found in the selected trend window.'] : []),
      ...(buckets.filter((point) => point.total > 0).length < 2 ? ['Trend is sparse, so direction should be read conservatively.'] : []),
      ...(bucket === 'week' ? ['Weekly bucketing smooths spikes, so short-lived bursts may be muted.'] : []),
    ];

    return {
      jobName: jobName == null ? null : jobName,
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
