import { prisma } from '@/lib/prisma';
import type { JobAlertRecord } from './types';
import type { RecommendationHistoryRecord } from './RecommendationHistoryService';
import { PolicyChangeHistoryService, type PolicyChangeHistoryRecord } from './PolicyChangeHistoryService';

export type PolicyAuditChartTrendDirection = 'up' | 'down' | 'flat' | 'insufficient';
export type PolicyAuditChartImpact = 'improving' | 'worsening' | 'neutral' | 'insufficient';
export type PolicyAuditChartMagnitude = 'small' | 'medium' | 'large' | 'none';
export type PolicyAuditChartPhase = 'before' | 'change' | 'after';

export interface PolicyAuditChartMetric {
  beforeAvg: number | null;
  afterAvg: number | null;
  trend: PolicyAuditChartTrendDirection;
  impact: PolicyAuditChartImpact;
  magnitude: PolicyAuditChartMagnitude;
  delta: number | null;
  deltaPct: number | null;
}

export interface PolicyAuditChartBucket {
  date: string;
  label: string;
  phase: PolicyAuditChartPhase;
  alertCount: number;
  criticalCount: number;
  resolvedCount: number;
  reoccurCount: number;
  recommendationCount: number;
}

export interface PolicyAuditChartChangePoint {
  date: string;
  label: string;
  index: number;
}

export interface PolicyAuditChartResult {
  change: PolicyChangeHistoryRecord | null;
  timeline: PolicyAuditChartBucket[];
  metrics: {
    alertCount: PolicyAuditChartMetric;
    criticalRatio: PolicyAuditChartMetric;
    reoccurRate: PolicyAuditChartMetric;
    avgResolveTime: PolicyAuditChartMetric;
    recommendationCount: PolicyAuditChartMetric;
  };
  changePoint: PolicyAuditChartChangePoint | null;
  windowDays: number;
  beforeWindowLabel: string | null;
  afterWindowLabel: string | null;
  limitations: string[];
  generatedAt: string;
}

export interface PolicyAuditChartFilter {
  changeId?: number;
  windowDays?: 7 | 14 | 30;
  now?: Date;
}

export interface PolicyAuditChartDataSource {
  getLatestChange(): Promise<PolicyChangeHistoryRecord | null>;
  getChangeById(id: number): Promise<PolicyChangeHistoryRecord | null>;
  listJobAlerts(start: Date, end: Date): Promise<JobAlertRecord[]>;
  listRecommendations(start: Date, end: Date): Promise<RecommendationHistoryRecord[]>;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function clampWindowDays(value: 7 | 14 | 30 | undefined): 7 | 14 | 30 {
  if (value === 7 || value === 14 || value === 30) return value;
  return 14;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLabel(date: Date): string {
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function safeRatio(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function magnitudeForDelta(deltaPct: number | null): PolicyAuditChartMagnitude {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return 'none';
  const magnitude = Math.abs(deltaPct);
  if (magnitude < 0.1) return 'small';
  if (magnitude < 0.3) return 'medium';
  return 'large';
}

function buildTrendMetric(beforeAvg: number | null, afterAvg: number | null, lowerBetter: boolean): PolicyAuditChartMetric {
  if (beforeAvg === null || afterAvg === null) {
    return {
      beforeAvg,
      afterAvg,
      trend: 'insufficient',
      impact: 'insufficient',
      magnitude: 'none',
      delta: null,
      deltaPct: null,
    };
  }

  const delta = afterAvg - beforeAvg;
  const denominator = Math.max(Math.abs(beforeAvg), 1);
  const deltaPct = delta / denominator;
  const significanceThreshold = Math.max(0.05, Math.abs(beforeAvg) * 0.1);
  const rawTrend: PolicyAuditChartTrendDirection = Math.abs(delta) < significanceThreshold ? 'flat' : delta > 0 ? 'up' : 'down';
  const impact: PolicyAuditChartImpact =
    rawTrend === 'flat'
      ? 'neutral'
      : lowerBetter
        ? rawTrend === 'down'
          ? 'improving'
          : 'worsening'
        : rawTrend === 'up'
          ? 'improving'
          : 'worsening';

  return {
    beforeAvg,
    afterAvg,
    trend: rawTrend,
    impact,
    magnitude: magnitudeForDelta(deltaPct),
    delta,
    deltaPct,
  };
}

function markMetricInsufficient(metric: PolicyAuditChartMetric): PolicyAuditChartMetric {
  return {
    ...metric,
    trend: 'insufficient',
    impact: 'insufficient',
    magnitude: 'none',
  };
}

function isWithin(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

function createBuckets(start: Date, end: Date, changeDate: Date): Array<{ start: Date; end: Date; date: string; label: string; phase: PolicyAuditChartPhase }> {
  const buckets: Array<{ start: Date; end: Date; date: string; label: string; phase: PolicyAuditChartPhase }> = [];
  const changeKey = dayKey(changeDate);
  let cursor = startOfUtcDay(start);
  const endKey = dayKey(end);

  while (cursor <= startOfUtcDay(end)) {
    const next = addDays(cursor, 1);
    const key = dayKey(cursor);
    const phase: PolicyAuditChartPhase =
      key < changeKey ? 'before' : key === changeKey ? 'change' : 'after';
    buckets.push({
      start: cursor,
      end: next,
      date: key,
      label: formatLabel(cursor),
      phase,
    });
    cursor = next;
    if (key === endKey) break;
  }

  return buckets;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function defaultDataSource(): PolicyAuditChartDataSource {
  return {
    getLatestChange: async () => {
      const service = new PolicyChangeHistoryService();
      return service.getLatestChange();
    },
    getChangeById: async (id: number) => {
      const service = new PolicyChangeHistoryService();
      return service.getChangeById(id);
    },
    listJobAlerts: async (start: Date, end: Date) => {
      const rows = await prisma.jobAlert.findMany({
        where: {
          firstDetectedAt: { lte: end },
          OR: [{ resolvedAt: null }, { resolvedAt: { gte: start } }],
        },
      });
      return rows.map((row) => ({
        id: row.id,
        jobName: row.jobName,
        severity: row.severity as JobAlertRecord['severity'],
        message: row.message,
        alertKey: row.alertKey,
        status: row.status as JobAlertRecord['status'],
        firstDetectedAt: row.firstDetectedAt.toISOString(),
        lastDetectedAt: row.lastDetectedAt.toISOString(),
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        occurrenceCount: row.occurrenceCount,
        latestJobRunLogId: row.latestJobRunLogId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    listRecommendations: async (start: Date, end: Date) => {
      const rows = await prisma.recommendationHistory.findMany({
        where: {
          firstDetectedAt: { lte: end },
          OR: [{ resolvedAt: null }, { resolvedAt: { gte: start } }],
        },
      });
      return rows.map((row) => ({
        id: row.id,
        recommendationKey: row.recommendationKey,
        recommendationType: row.recommendationType as RecommendationHistoryRecord['recommendationType'],
        targetJob: row.targetJob,
        targetFamily: row.targetFamily,
        severity: row.severity as RecommendationHistoryRecord['severity'],
        rationale: row.rationale,
        suggestedAction: row.suggestedAction,
        confidence: row.confidence,
        status: row.status as RecommendationHistoryRecord['status'],
        firstDetectedAt: row.firstDetectedAt.toISOString(),
        lastDetectedAt: row.lastDetectedAt.toISOString(),
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        occurrenceCount: row.occurrenceCount,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  };
}

export class PolicyAuditChartService {
  constructor(private readonly dataSource: PolicyAuditChartDataSource = defaultDataSource()) {}

  async build(filter: PolicyAuditChartFilter = {}): Promise<PolicyAuditChartResult> {
    const windowDays = clampWindowDays(filter.windowDays);
    const change =
      filter.changeId !== undefined
        ? await this.dataSource.getChangeById(filter.changeId)
        : await this.dataSource.getLatestChange();

    if (!change) {
      return {
        change: null,
        timeline: [],
        metrics: {
          alertCount: buildTrendMetric(null, null, true),
          criticalRatio: buildTrendMetric(null, null, true),
          reoccurRate: buildTrendMetric(null, null, true),
          avgResolveTime: buildTrendMetric(null, null, true),
          recommendationCount: buildTrendMetric(null, null, true),
        },
        changePoint: null,
        windowDays,
        beforeWindowLabel: null,
        afterWindowLabel: null,
        limitations: ['No policy change history is available yet.'],
        generatedAt: new Date().toISOString(),
      };
    }

    const changedAt = parseDate(change.changedAt) ?? (filter.now ?? new Date());
    const now = filter.now ?? new Date();
    const beforeStart = addDays(startOfUtcDay(changedAt), -windowDays);
    const afterEnd = addDays(startOfUtcDay(changedAt), windowDays + 1);
    const effectiveEnd = now < afterEnd ? now : afterEnd;
    const changeDayStart = startOfUtcDay(changedAt);

    const [alerts, recommendations] = await Promise.all([
      this.dataSource.listJobAlerts(beforeStart, effectiveEnd),
      this.dataSource.listRecommendations(beforeStart, effectiveEnd),
    ]);

    const buckets = createBuckets(beforeStart, effectiveEnd, changedAt);
    const timeline: PolicyAuditChartBucket[] = buckets.map((bucket) => {
      const bucketAlerts = alerts.filter((row) => {
        const detectedAt = parseDate(row.firstDetectedAt);
        return detectedAt ? isWithin(detectedAt, bucket.start, bucket.end) : false;
      });
      const bucketRecommendations = recommendations.filter((row) => {
        const detectedAt = parseDate(row.firstDetectedAt);
        return detectedAt ? isWithin(detectedAt, bucket.start, bucket.end) : false;
      });

      return {
        date: bucket.date,
        label: bucket.label,
        phase: bucket.phase,
        alertCount: bucketAlerts.length,
        criticalCount: bucketAlerts.filter((row) => row.severity === 'critical').length,
        resolvedCount: bucketAlerts.filter((row) => row.status === 'resolved' && row.resolvedAt !== null).length,
        reoccurCount: bucketAlerts.filter((row) => row.occurrenceCount > 1).length,
        recommendationCount: bucketRecommendations.length,
      };
    });

    const beforeBuckets = timeline.filter((bucket) => bucket.phase === 'before');
    const afterBuckets = timeline.filter((bucket) => bucket.phase !== 'before');
    const beforeAlerts = alerts.filter((row) => {
      const detectedAt = parseDate(row.firstDetectedAt);
      return detectedAt ? detectedAt < changeDayStart : false;
    });
    const afterAlerts = alerts.filter((row) => {
      const detectedAt = parseDate(row.firstDetectedAt);
      return detectedAt ? detectedAt >= changeDayStart : false;
    });
    const beforeRecommendations = recommendations.filter((row) => {
      const detectedAt = parseDate(row.firstDetectedAt);
      return detectedAt ? detectedAt < changeDayStart : false;
    });
    const afterRecommendations = recommendations.filter((row) => {
      const detectedAt = parseDate(row.firstDetectedAt);
      return detectedAt ? detectedAt >= changeDayStart : false;
    });

    const beforeResolvedAlerts = beforeAlerts.filter((row) => row.status === 'resolved' && row.resolvedAt !== null);
    const afterResolvedAlerts = afterAlerts.filter((row) => row.status === 'resolved' && row.resolvedAt !== null);
    const beforeResolvedTimes = beforeResolvedAlerts
      .map((row) => {
        const detectedAt = parseDate(row.firstDetectedAt);
        const resolvedAt = parseDate(row.resolvedAt ?? undefined);
        if (!detectedAt || !resolvedAt) return null;
        return Math.max(0, (resolvedAt.getTime() - detectedAt.getTime()) / (60 * 60 * 1000));
      })
      .filter((value): value is number => value !== null);
    const afterResolvedTimes = afterResolvedAlerts
      .map((row) => {
        const detectedAt = parseDate(row.firstDetectedAt);
        const resolvedAt = parseDate(row.resolvedAt ?? undefined);
        if (!detectedAt || !resolvedAt) return null;
        return Math.max(0, (resolvedAt.getTime() - detectedAt.getTime()) / (60 * 60 * 1000));
      })
      .filter((value): value is number => value !== null);

    const beforeAlertCount = beforeAlerts.length;
    const afterAlertCount = afterAlerts.length;
    const beforeCriticalCount = beforeAlerts.filter((row) => row.severity === 'critical').length;
    const afterCriticalCount = afterAlerts.filter((row) => row.severity === 'critical').length;
    const beforeReoccurCount = beforeAlerts.filter((row) => row.occurrenceCount > 1).length;
    const afterReoccurCount = afterAlerts.filter((row) => row.occurrenceCount > 1).length;

    const beforeBucketCount = Math.max(1, beforeBuckets.length);
    const afterBucketCount = Math.max(1, afterBuckets.length);

    const beforeCriticalRatio = safeRatio(beforeCriticalCount, beforeAlertCount);
    const afterCriticalRatio = safeRatio(afterCriticalCount, afterAlertCount);
    const beforeReoccurRate = safeRatio(beforeReoccurCount, beforeAlertCount);
    const afterReoccurRate = safeRatio(afterReoccurCount, afterAlertCount);
    const beforeRecommendationCount = beforeRecommendations.length;
    const afterRecommendationCount = afterRecommendations.length;

    let metrics = {
      alertCount: buildTrendMetric(beforeAlertCount / beforeBucketCount, afterAlertCount / afterBucketCount, true),
      criticalRatio: buildTrendMetric(beforeCriticalRatio, afterCriticalRatio, true),
      reoccurRate: buildTrendMetric(beforeReoccurRate, afterReoccurRate, true),
      avgResolveTime: buildTrendMetric(average(beforeResolvedTimes), average(afterResolvedTimes), true),
      recommendationCount: buildTrendMetric(
        beforeRecommendationCount / beforeBucketCount,
        afterRecommendationCount / afterBucketCount,
        true,
      ),
    };

    const changePointIndex = timeline.findIndex((bucket) => bucket.date === dayKey(changeDayStart));
    const changePoint =
      changePointIndex >= 0
        ? {
            date: toIso(changeDayStart),
            label: formatLabel(changeDayStart),
            index: changePointIndex,
          }
        : null;

    const limitations: string[] = [];
    const totalSignals = beforeAlertCount + afterAlertCount + beforeRecommendationCount + afterRecommendationCount;
    if (totalSignals < 4) {
      limitations.push('Timeline data is sparse, so the visual comparison should be read conservatively.');
      if (
        beforeAlertCount === 0 &&
        afterAlertCount === 0 &&
        beforeRecommendationCount === 0 &&
        afterRecommendationCount === 0
      ) {
        metrics = {
          alertCount: markMetricInsufficient(metrics.alertCount),
          criticalRatio: markMetricInsufficient(metrics.criticalRatio),
          reoccurRate: markMetricInsufficient(metrics.reoccurRate),
          avgResolveTime: markMetricInsufficient(metrics.avgResolveTime),
          recommendationCount: markMetricInsufficient(metrics.recommendationCount),
        };
      }
    }
    if (afterBuckets.length < Math.max(2, Math.floor(windowDays / 2))) {
      limitations.push('The after window is relatively short, so post-change effects may still be incomplete.');
    }

    const beforeWindowLabel = `${beforeStart.toISOString().slice(0, 10)} → ${changeDayStart.toISOString().slice(0, 10)}`;
    const afterWindowLabel = `${changeDayStart.toISOString().slice(0, 10)} → ${effectiveEnd.toISOString().slice(0, 10)}`;

    return {
      change,
      timeline,
      metrics,
      changePoint,
      windowDays,
      beforeWindowLabel,
      afterWindowLabel,
      limitations,
      generatedAt: new Date().toISOString(),
    };
  }
}
