import { JobAlertHistoryService } from './JobAlertHistoryService';
import { AlertFamilyGroupingService, type AlertFamily, type AlertFamilyGroupingResult } from './AlertFamilyGroupingService';

export type FamilyTrendWindow = '7d' | '14d' | '30d';
export type FamilyTrendBucket = 'day' | 'week';
export type FamilyTrendDirection = 'improving' | 'worsening' | 'stable' | 'oscillating' | 'insufficient';

export interface FamilyTrendBucketPoint {
  date: string;
  label: string;
  total: number;
  active: number;
  resolved: number;
  critical: number;
  warning: number;
  info: number;
}

export interface FamilyTrendRow {
  family: AlertFamily;
  familyLabel: string;
  buckets: FamilyTrendBucketPoint[];
  trendDirection: FamilyTrendDirection;
  totalOccurrences: number;
  totalResolved: number;
  avgPerBucket: number;
  limitations: string[];
}

export interface FamilyTrendResult {
  jobName: string;
  window: FamilyTrendWindow;
  bucket: FamilyTrendBucket;
  families: FamilyTrendRow[];
  overallSummary: string;
  limitations: string[];
  generatedAt: string;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function windowToDays(window: FamilyTrendWindow): number {
  if (window === '7d') return 7;
  if (window === '14d') return 14;
  return 30;
}

function bucketToSizeDays(bucket: FamilyTrendBucket): number {
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

function buildLabel(date: Date, bucket: FamilyTrendBucket): string {
  return bucket === 'week' ? `Week of ${formatDate(date)}` : formatDate(date);
}

function bucketIndexFor(date: Date, start: Date, bucketSizeDays: number): number {
  const diffDays = Math.floor((startOfUtcDay(date).getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / bucketSizeDays);
}

function createEmptyBuckets(start: Date, count: number, bucketSizeDays: number, bucket: FamilyTrendBucket): FamilyTrendBucketPoint[] {
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

function summarizeTrend(buckets: FamilyTrendBucketPoint[], totalOccurrences: number): FamilyTrendDirection {
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

  const variation = buckets.reduce((sum, bucket) => sum + Math.abs(bucket.total - (totalOccurrences / buckets.length)), 0) / Math.max(1, totalOccurrences);

  if (signChanges >= 2 || (nonZeroBuckets.length >= 4 && variation > 1.0 && firstTotal > 0 && secondTotal > 0)) {
    return 'oscillating';
  }
  if (secondTotal >= Math.max(1, firstTotal) * 1.25) return 'worsening';
  if (secondTotal <= Math.max(1, firstTotal) * 0.75) return 'improving';
  return 'stable';
}

function familyLabelFor(family: AlertFamily): string {
  const labels: Record<AlertFamily, string> = {
    never_ran: 'Never ran',
    missed_run: 'Missed run',
    failed_run: 'Failed run',
    consecutive_failure: 'Consecutive failure',
    delayed_run: 'Delayed run',
    recovery_event: 'Recovery event',
    unknown_family: 'Unknown family',
  };
  return labels[family];
}

function sortFamilies(families: Array<{ family: AlertFamily; totalOccurrences: number }>): Array<{ family: AlertFamily; totalOccurrences: number }> {
  return families.sort((left, right) => right.totalOccurrences - left.totalOccurrences);
}

function buildOverallSummary(jobName: string, families: FamilyTrendRow[]): string {
  if (families.length === 0) return `No family trend data was found for ${jobName}.`;
  const sorted = sortFamilies(families.map((family) => ({ family: family.family, totalOccurrences: family.totalOccurrences })));
  const topFamily = sorted[0]?.family;
  const top = families.find((family) => family.family === topFamily) ?? families[0];
  return `${jobName} is led by ${top.familyLabel.toLowerCase()}, and its trend is ${top.trendDirection}.`;
}

export class FamilyTrendService {
  constructor(
    private readonly historyService = new JobAlertHistoryService(),
    private readonly groupingService = new AlertFamilyGroupingService(),
  ) {}

  async build(
    jobName: string,
    window: FamilyTrendWindow = '14d',
    bucket: FamilyTrendBucket = 'day',
    now = new Date(),
  ): Promise<FamilyTrendResult> {
    const windowDays = windowToDays(window);
    const bucketSizeDays = bucketToSizeDays(bucket);
    const bucketCount = Math.max(1, Math.ceil(windowDays / bucketSizeDays));
    const windowStart = buildWindowStart(now, windowDays);
    const rows = await this.historyService.listHistory(
      {
        jobName,
        status: 'all',
        includeResolved: true,
        sortBy: 'latest',
        sortDir: 'desc',
        limit: 500,
        offset: 0,
      },
      now,
    );

    const filtered = rows.filter((row) => {
      const anchor = parseDate(row.resolvedAt ?? row.lastDetectedAt ?? row.firstDetectedAt ?? row.detectedAt);
      return anchor ? anchor >= windowStart : false;
    });

    const families = new Map<
      AlertFamily,
      {
        buckets: FamilyTrendBucketPoint[];
        rowCount: number;
        totalOccurrences: number;
        totalResolved: number;
        limitations: string[];
      }
    >();

    for (const row of filtered) {
      const anchor = parseDate(row.resolvedAt ?? row.lastDetectedAt ?? row.firstDetectedAt ?? row.detectedAt);
      if (!anchor) continue;
      const family: AlertFamilyGroupingResult = this.groupingService.classify({ alert: row });
      const index = bucketIndexFor(anchor, windowStart, bucketSizeDays);
      if (index < 0 || index >= bucketCount) continue;

      const existing =
        families.get(family.family) ??
        {
          buckets: createEmptyBuckets(windowStart, bucketCount, bucketSizeDays, bucket),
          rowCount: 0,
          totalOccurrences: 0,
          totalResolved: 0,
          limitations: [],
        };

      const point = existing.buckets[index];
      point.total += row.occurrenceCount;
      if (row.status === 'active') point.active += 1;
      if (row.status === 'resolved') point.resolved += 1;
      point[row.severity] += 1;

      existing.rowCount += 1;
      existing.totalOccurrences += row.occurrenceCount;
      existing.totalResolved += row.status === 'resolved' ? 1 : 0;
      families.set(family.family, existing);
    }

    const familyRows: FamilyTrendRow[] = Array.from(families.entries()).map(([family, data]) => {
      const trendDirection = summarizeTrend(data.buckets, data.totalOccurrences);
      const nonZeroBuckets = data.buckets.filter((bucketPoint) => bucketPoint.total > 0);
      const avgPerBucket = data.buckets.length > 0 ? data.totalOccurrences / data.buckets.length : 0;
      const limitations = [
        ...(data.rowCount === 0 ? ['No alert rows were found for this family in the selected window.'] : []),
        ...(nonZeroBuckets.length < 2 ? ['Trend is sparse for this family, so direction should be read conservatively.'] : []),
        ...(bucket === 'week' ? ['Weekly bucketing smooths spikes, so short-lived bursts may be muted.'] : []),
      ];

      return {
        family,
        familyLabel: familyLabelFor(family),
        buckets: data.buckets,
        trendDirection,
        totalOccurrences: data.totalOccurrences,
        totalResolved: data.totalResolved,
        avgPerBucket,
        limitations,
      };
    });

    const sortedFamilies = familyRows.sort((left, right) => right.totalOccurrences - left.totalOccurrences || right.totalResolved - left.totalResolved);

    const overallSummary = buildOverallSummary(jobName, sortedFamilies);
    const limitations = [
      ...(filtered.length === 0 ? ['No family trend data was found in the selected window.'] : []),
      ...(sortedFamilies.length < 2 ? ['Only one family was found, so comparison is limited.'] : []),
      'Family trend uses persisted alert history and simple bucketed aggregation.',
    ];

    return {
      jobName,
      window,
      bucket,
      families: sortedFamilies,
      overallSummary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
