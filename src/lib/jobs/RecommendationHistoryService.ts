import { prisma } from '../prisma';
import type { JobAlertSeverity } from './types';
import type { PolicyRecommendationRow, PolicyRecommendationType } from './PolicyRecommendationEngine';

export type RecommendationHistoryStatus = 'active' | 'resolved' | 'stale';

export interface RecommendationHistoryRecord {
  id: number;
  recommendationKey: string;
  recommendationType: PolicyRecommendationType;
  targetJob: string;
  targetFamily: string | null;
  severity: JobAlertSeverity;
  rationale: string;
  suggestedAction: string;
  confidence: number;
  status: RecommendationHistoryStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  occurrenceCount: number;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationHistoryFilter {
  jobName?: string;
  recommendationType?: PolicyRecommendationType;
  status?: RecommendationHistoryStatus | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'latest' | 'occurrenceCount' | 'firstDetectedAt';
  sortDir?: 'asc' | 'desc';
}

export interface RecommendationHistorySummary {
  total: number;
  active: number;
  resolved: number;
  stale: number;
  critical: number;
  warning: number;
  info: number;
  topJobs: Array<{ jobName: string; recommendationCount: number }>;
  topTypes: Array<{ recommendationType: PolicyRecommendationType; recommendationCount: number }>;
  recurringRecommendations: RecommendationHistoryRecord[];
  recentResolvedRecommendations: RecommendationHistoryRecord[];
}

export interface RecommendationHistorySyncResult {
  upserted: number;
  resolved: number;
  totalObserved: number;
}

export interface RecommendationHistorySyncOptions {
  resolveMissing?: boolean;
  scopeJobs?: string[];
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toRecord(row: {
  id: number;
  recommendationKey: string;
  recommendationType: string;
  targetJob: string;
  targetFamily: string | null;
  severity: string;
  rationale: string;
  suggestedAction: string;
  confidence: number;
  status: string;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  resolvedAt: Date | null;
  occurrenceCount: number;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RecommendationHistoryRecord {
  return {
    id: row.id,
    recommendationKey: row.recommendationKey,
    recommendationType: row.recommendationType as PolicyRecommendationType,
    targetJob: row.targetJob,
    targetFamily: row.targetFamily,
    severity: row.severity as JobAlertSeverity,
    rationale: row.rationale,
    suggestedAction: row.suggestedAction,
    confidence: row.confidence,
    status: row.status as RecommendationHistoryStatus,
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    resolvedAt: toIso(row.resolvedAt),
    occurrenceCount: row.occurrenceCount,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function buildRecommendationKey(recommendation: Pick<PolicyRecommendationRow, 'recommendationType' | 'targetJob' | 'targetFamily'>): string {
  return [
    recommendation.recommendationType,
    recommendation.targetJob,
    recommendation.targetFamily?.trim() || 'all',
  ].join('|');
}

function defaultSummary(): RecommendationHistorySummary {
  return {
    total: 0,
    active: 0,
    resolved: 0,
    stale: 0,
    critical: 0,
    warning: 0,
    info: 0,
    topJobs: [],
    topTypes: [],
    recurringRecommendations: [],
    recentResolvedRecommendations: [],
  };
}

function safeParseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readMetadataNumber(value: Record<string, unknown>, key: string, fallback = 0): number {
  const raw = value[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readMetadataTimeline(value: Record<string, unknown>, key: string): Record<string, number> {
  const raw = value[key];
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

function incrementTimeline(timeline: Record<string, number>, key: string, amount = 1): Record<string, number> {
  return {
    ...timeline,
    [key]: (timeline[key] ?? 0) + amount,
  };
}

function isSameUtcDay(left: Date | string, right: Date): boolean {
  const leftDay = typeof left === 'string' ? left.slice(0, 10) : dayKey(left);
  return leftDay === dayKey(right);
}

export class RecommendationHistoryService {
  async syncFromRecommendations(
    recommendations: PolicyRecommendationRow[],
    now = new Date(),
    options: RecommendationHistorySyncOptions = {},
  ): Promise<RecommendationHistorySyncResult> {
    const observedKeys = new Set<string>();
    const scopeJobs = new Set(options.scopeJobs ?? recommendations.map((recommendation) => recommendation.targetJob));
    let upserted = 0;

    for (const recommendation of recommendations) {
      const recommendationKey = buildRecommendationKey(recommendation);
      observedKeys.add(recommendationKey);
      const existing = await prisma.recommendationHistory.findUnique({
        where: { recommendationKey },
      });
      const existingMetadata = existing ? safeParseMetadata(existing.metadata) : {};
      const previousResolvedCycles = readMetadataNumber(existingMetadata, 'resolvedCycles', 0);
      const previousReoccurCount = readMetadataNumber(existingMetadata, 'reoccurCount', 0);
      const existingObservationTimeline = readMetadataTimeline(existingMetadata, 'observationTimeline');
      const existingResolutionTimeline = readMetadataTimeline(existingMetadata, 'resolutionTimeline');
      const wasResolvedBefore = existing ? existing.status !== 'active' : false;
      const isSameDay = existing ? isSameUtcDay(existing.lastDetectedAt, now) : false;
      const shouldIncrementOccurrence =
        existing == null ? true : !isSameDay || wasResolvedBefore;
      const observationTimeline = shouldIncrementOccurrence
        ? incrementTimeline(existingObservationTimeline, dayKey(now), 1)
        : existingObservationTimeline;

      const metadata = {
        recommendationType: recommendation.recommendationType,
        targetJob: recommendation.targetJob,
        targetFamily: recommendation.targetFamily ?? null,
        category: recommendation.category,
        observedAt: now.toISOString(),
        lastObservedAt: now.toISOString(),
        lastStatusChangeAt: now.toISOString(),
        resolvedCycles: previousResolvedCycles,
        reoccurCount: previousReoccurCount,
        observationTimeline,
        resolutionTimeline: existingResolutionTimeline,
      };
      const occurrenceCount = existing
        ? shouldIncrementOccurrence
          ? existing.occurrenceCount + 1
          : existing.occurrenceCount
        : 1;
      const nextMetadata = {
        ...(existing ? existingMetadata : {}),
        ...metadata,
      };
      if (wasResolvedBefore) {
        nextMetadata.reoccurCount = previousReoccurCount + 1;
        nextMetadata.lastReoccurAt = now.toISOString();
      }

      await prisma.recommendationHistory.upsert({
        where: { recommendationKey },
        create: {
          recommendationKey,
          recommendationType: recommendation.recommendationType,
          targetJob: recommendation.targetJob,
          targetFamily: recommendation.targetFamily ?? null,
          severity: recommendation.severity,
          rationale: recommendation.rationale,
          suggestedAction: recommendation.suggestedAction,
          confidence: recommendation.confidence,
          status: 'active',
          firstDetectedAt: now,
          lastDetectedAt: now,
          resolvedAt: null,
          occurrenceCount,
          metadata: JSON.stringify({
            ...nextMetadata,
            resolvedCycles: previousResolvedCycles,
            reoccurCount: wasResolvedBefore ? previousReoccurCount + 1 : previousReoccurCount,
            observationTimeline,
            resolutionTimeline: existingResolutionTimeline,
          }),
        },
        update: {
          recommendationType: recommendation.recommendationType,
          targetJob: recommendation.targetJob,
          targetFamily: recommendation.targetFamily ?? null,
          severity: recommendation.severity,
          rationale: recommendation.rationale,
          suggestedAction: recommendation.suggestedAction,
          confidence: recommendation.confidence,
          status: 'active',
          lastDetectedAt: now,
          resolvedAt: null,
          occurrenceCount,
          metadata: JSON.stringify({
            ...nextMetadata,
            occurrenceCount,
            lastObservedAt: now.toISOString(),
            lastStatusChangeAt: now.toISOString(),
            resolvedCycles: previousResolvedCycles,
            reoccurCount: wasResolvedBefore ? previousReoccurCount + 1 : previousReoccurCount,
            observationTimeline,
            resolutionTimeline: existingResolutionTimeline,
          }),
        },
      });
      upserted += 1;
    }

    if (options.resolveMissing !== false) {
      const activeRows = await prisma.recommendationHistory.findMany({
        where: {
          status: 'active',
          ...(scopeJobs.size > 0 ? { targetJob: { in: Array.from(scopeJobs) } } : {}),
        },
      });
      for (const row of activeRows) {
        if (!observedKeys.has(row.recommendationKey)) {
          const existingMetadata = safeParseMetadata(row.metadata);
          const previousResolvedCycles = readMetadataNumber(existingMetadata, 'resolvedCycles', 0);
          const existingResolutionTimeline = readMetadataTimeline(existingMetadata, 'resolutionTimeline');
          await prisma.recommendationHistory.update({
            where: { recommendationKey: row.recommendationKey },
            data: {
              status: 'resolved',
              resolvedAt: now,
              metadata: JSON.stringify({
                ...existingMetadata,
                resolvedAt: now.toISOString(),
                lastStatusChangeAt: now.toISOString(),
                lastResolvedAt: now.toISOString(),
                resolvedCycles: previousResolvedCycles + 1,
                reoccurCount: readMetadataNumber(existingMetadata, 'reoccurCount', 0),
                observationTimeline: readMetadataTimeline(existingMetadata, 'observationTimeline'),
                resolutionTimeline: incrementTimeline(existingResolutionTimeline, dayKey(now), 1),
              }),
            },
          });
        }
      }
    }

    const resolved = await prisma.recommendationHistory.count({
      where: { status: 'resolved', resolvedAt: { gte: startOfUtcDay(now) } },
    });

    return {
      upserted,
      resolved,
      totalObserved: recommendations.length,
    };
  }

  async listHistory(filter: RecommendationHistoryFilter = {}): Promise<RecommendationHistoryRecord[]> {
    const where: Record<string, unknown> = {};
    if (filter.jobName) where.targetJob = filter.jobName;
    if (filter.recommendationType) where.recommendationType = filter.recommendationType;
    if (filter.status && filter.status !== 'all') where.status = filter.status;

    const orderBy =
      filter.sortBy === 'occurrenceCount'
        ? [{ occurrenceCount: (filter.sortDir ?? 'desc') as const }, { lastDetectedAt: 'desc' as const }]
        : filter.sortBy === 'firstDetectedAt'
          ? [{ firstDetectedAt: (filter.sortDir ?? 'desc') as const }, { lastDetectedAt: 'desc' as const }]
          : [{ lastDetectedAt: (filter.sortDir ?? 'desc') as const }, { createdAt: 'desc' as const }];

    const rows = await prisma.recommendationHistory.findMany({
      where,
      orderBy,
      take: filter.limit ?? 200,
      skip: filter.offset ?? 0,
    });

    return rows.map(toRecord);
  }

  async buildSummary(filter: RecommendationHistoryFilter = {}): Promise<RecommendationHistorySummary> {
    const rows = await this.listHistory({
      ...filter,
      limit: filter.limit ?? 500,
      offset: filter.offset ?? 0,
    });

    if (rows.length === 0) return defaultSummary();

    const countsByJob = new Map<string, number>();
    const countsByType = new Map<PolicyRecommendationType, number>();
    const active = rows.filter((row) => row.status === 'active').length;
    const resolved = rows.filter((row) => row.status === 'resolved').length;
    const stale = rows.filter((row) => row.status === 'stale').length;
    const critical = rows.filter((row) => row.severity === 'critical').length;
    const warning = rows.filter((row) => row.severity === 'warning').length;
    const info = rows.filter((row) => row.severity === 'info').length;

    for (const row of rows) {
      countsByJob.set(row.targetJob, (countsByJob.get(row.targetJob) ?? 0) + 1);
      countsByType.set(row.recommendationType, (countsByType.get(row.recommendationType) ?? 0) + 1);
    }

    return {
      total: rows.length,
      active,
      resolved,
      stale,
      critical,
      warning,
      info,
      topJobs: [...countsByJob.entries()]
        .map(([jobName, recommendationCount]) => ({ jobName, recommendationCount }))
        .sort((left, right) => right.recommendationCount - left.recommendationCount)
        .slice(0, 5),
      topTypes: [...countsByType.entries()]
        .map(([recommendationType, recommendationCount]) => ({ recommendationType, recommendationCount }))
        .sort((left, right) => right.recommendationCount - left.recommendationCount)
        .slice(0, 5),
      recurringRecommendations: rows.filter((row) => row.occurrenceCount > 1).slice(0, 10),
      recentResolvedRecommendations: rows.filter((row) => row.status === 'resolved').slice(0, 10),
    };
  }
}
