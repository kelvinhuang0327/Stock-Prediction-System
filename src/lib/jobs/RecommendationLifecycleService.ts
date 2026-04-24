import { RecommendationHistoryService, type RecommendationHistoryStatus } from './RecommendationHistoryService';
import type { PolicyRecommendationType } from './PolicyRecommendationEngine';
import type { JobAlertSeverity } from './types';

export interface RecommendationLifecycleRow {
  recommendationKey: string;
  recommendationType: PolicyRecommendationType;
  targetJob: string;
  targetFamily: string | null;
  severity: JobAlertSeverity;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
  currentStatus: RecommendationHistoryStatus;
  resolvedCount: number;
  reoccurCount: number;
  daysOpen: number;
  lifecycleSummary: string;
  limitations: string[];
}

export interface RecommendationLifecycleSummary {
  total: number;
  active: number;
  resolved: number;
  stale: number;
  recurring: number;
  resolvedCycles: number;
  reoccurCount: number;
  avgOccurrences: number;
  topRecommendationKey: string | null;
}

export interface RecommendationLifecycleResult {
  recommendationKey: string | null;
  recommendationType: PolicyRecommendationType | null;
  targetJob: string | null;
  status: RecommendationHistoryStatus | 'all';
  recommendations: RecommendationLifecycleRow[];
  summary: RecommendationLifecycleSummary;
  limitations: string[];
  generatedAt: string;
}

export interface RecommendationLifecycleFilter {
  recommendationKey?: string;
  recommendationType?: PolicyRecommendationType;
  targetJob?: string;
  status?: RecommendationHistoryStatus | 'all';
  limit?: number;
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

function readNumber(metadata: Record<string, unknown>, key: string, fallback = 0): number {
  const value = metadata[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function buildLifecycleSummary(row: RecommendationLifecycleRow): string {
  if (row.currentStatus === 'resolved') {
    return `Resolved after ${row.occurrenceCount} observations, with ${row.reoccurCount} reoccurrence(s) across ${row.daysOpen} day(s).`;
  }
  if (row.currentStatus === 'stale') {
    return `Marked stale after ${row.occurrenceCount} observations, with ${row.reoccurCount} reoccurrence(s) across ${row.daysOpen} day(s).`;
  }
  return `Currently active after ${row.occurrenceCount} observations, with ${row.reoccurCount} reoccurrence(s) across ${row.daysOpen} day(s).`;
}

export class RecommendationLifecycleService {
  constructor(private readonly historyService = new RecommendationHistoryService()) {}

  async build(filter: RecommendationLifecycleFilter = {}, now = new Date()): Promise<RecommendationLifecycleResult> {
    const limit = Number.isFinite(filter.limit ?? NaN) ? Math.max(1, Math.min(50, Math.floor(filter.limit ?? 10))) : 10;

    let rows = await this.historyService.listHistory(
      {
        jobName: filter.targetJob,
        recommendationType: filter.recommendationType,
        status: filter.status ?? 'all',
        sortBy: 'occurrenceCount',
        sortDir: 'desc',
        limit,
        offset: 0,
      },
      now,
    );

    if (filter.recommendationKey) {
      const exact = rows.find((row) => row.recommendationKey === filter.recommendationKey);
      rows = exact ? [exact] : [];
      if (rows.length === 0) {
        const allRows = await this.historyService.listHistory(
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
        rows = allRows.filter((row) => row.recommendationKey === filter.recommendationKey);
      }
    }

    const recommendations = rows.map((row) => {
      const metadata = parseMetadata(row.metadata);
      const resolvedCount = Math.max(readNumber(metadata, 'resolvedCycles', row.status === 'resolved' ? 1 : 0), row.status === 'resolved' ? 1 : 0);
      const reoccurCount = Math.max(readNumber(metadata, 'reoccurCount', Math.max(0, row.occurrenceCount - 1)), 0);
      const lifecycleRow: RecommendationLifecycleRow = {
        recommendationKey: row.recommendationKey,
        recommendationType: row.recommendationType,
        targetJob: row.targetJob,
        targetFamily: row.targetFamily,
        severity: row.severity,
        firstDetectedAt: row.firstDetectedAt,
        lastDetectedAt: row.lastDetectedAt,
        resolvedAt: row.resolvedAt,
        occurrenceCount: row.occurrenceCount,
        currentStatus: row.status,
        resolvedCount,
        reoccurCount,
        daysOpen: daysBetween(row.firstDetectedAt, row.resolvedAt ?? row.lastDetectedAt),
        lifecycleSummary: '',
        limitations: [
          ...(resolvedCount === 0 && row.status === 'active' ? ['Lifecycle is ongoing, so resolved cycle count is still evolving.'] : []),
          ...(reoccurCount === 0 ? ['No reoccurrence has been observed yet.'] : []),
        ],
      };
      lifecycleRow.lifecycleSummary = buildLifecycleSummary(lifecycleRow);
      return lifecycleRow;
    });

    const summary: RecommendationLifecycleSummary = {
      total: recommendations.length,
      active: recommendations.filter((item) => item.currentStatus === 'active').length,
      resolved: recommendations.filter((item) => item.currentStatus === 'resolved').length,
      stale: recommendations.filter((item) => item.currentStatus === 'stale').length,
      recurring: recommendations.filter((item) => item.reoccurCount > 0).length,
      resolvedCycles: recommendations.reduce((sum, item) => sum + item.resolvedCount, 0),
      reoccurCount: recommendations.reduce((sum, item) => sum + item.reoccurCount, 0),
      avgOccurrences:
        recommendations.length > 0 ? recommendations.reduce((sum, item) => sum + item.occurrenceCount, 0) / recommendations.length : 0,
      topRecommendationKey: recommendations[0]?.recommendationKey ?? null,
    };

    const limitations = [
      ...(recommendations.length === 0 ? ['No recommendation lifecycle data matched the current filters.'] : []),
      ...(recommendations.length > 0 && recommendations.every((row) => row.reoccurCount === 0)
        ? ['No reoccurrence has been observed in the selected set.']
        : []),
      'Lifecycle is derived from persisted recommendation timestamps and metadata counters.',
    ];

    return {
      recommendationKey: filter.recommendationKey ?? null,
      recommendationType: filter.recommendationType ?? null,
      targetJob: filter.targetJob ?? null,
      status: filter.status ?? 'all',
      recommendations,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
