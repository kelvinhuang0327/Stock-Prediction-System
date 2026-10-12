import { prisma } from '@/lib/prisma';
import type { JobAlertRecord } from './types';
import type { RecommendationHistoryRecord } from './RecommendationHistoryService';
import { AUTONOMOUS_ALERT_POLICY_SETTING_KEY } from './AutonomousAlertPolicyConfig';
import type { PolicyChangeHistoryRecord } from './PolicyChangeHistoryService';

export type PolicyAuditResult = 'improved' | 'unchanged' | 'worsened' | 'insufficient';

export interface PolicyAuditWindowMetrics {
  alertCount: number;
  activeAlerts: number;
  criticalCount: number;
  criticalRatio: number | null;
  reoccurCount: number;
  reoccurRate: number | null;
  avgResolveTimeHours: number | null;
  recommendationCount: number;
  activeRecommendations: number;
  recommendationResolvedCount: number;
}

export interface PolicyAuditTrailRow {
  change: PolicyChangeHistoryRecord;
  windowDays: number;
  before: PolicyAuditWindowMetrics;
  after: PolicyAuditWindowMetrics;
  result: PolicyAuditResult;
  evidence: string[];
  summary: string;
  limitations: string[];
}

export interface PolicyAuditTrailSummary {
  total: number;
  improved: number;
  unchanged: number;
  worsened: number;
  insufficient: number;
  latestChangedAt: string | null;
  topChangedFields: Array<{ field: string; count: number }>;
}

export interface PolicyAuditTrailResult {
  changes: PolicyChangeHistoryRecord[];
  audits: PolicyAuditTrailRow[];
  summary: PolicyAuditTrailSummary;
  limitations: string[];
  generatedAt: string;
}

export interface PolicyAuditTrailFilter {
  limit?: number;
  changeId?: number;
  windowDays?: 7 | 14 | 30;
  now?: Date;
}

export interface PolicyAuditDataSource {
  listChanges(limit: number): Promise<PolicyChangeHistoryRecord[]>;
  listJobAlerts(start: Date, end: Date): Promise<JobAlertRecord[]>;
  listRecommendations(start: Date, end: Date): Promise<RecommendationHistoryRecord[]>;
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(value ?? fallback)));
}

function clampWindowDays(value: 7 | 14 | 30 | undefined): 7 | 14 | 30 {
  if (value === 7 || value === 14 || value === 30) return value;
  return 14;
}

function dayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function overlap(start: Date, end: Date, fromIso: string, toIso: string | null): boolean {
  const from = parseDate(fromIso);
  const to = parseDate(toIso ?? undefined);
  if (!from) return false;
  return from < end && (!to || to >= start);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function safeRatio(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

function buildWindowMetrics(
  alerts: JobAlertRecord[],
  recommendations: RecommendationHistoryRecord[],
  start: Date,
  end: Date,
): PolicyAuditWindowMetrics {
  const overlappingAlerts = alerts.filter((row) => overlap(start, end, row.firstDetectedAt, row.resolvedAt));
  const overlappingRecommendations = recommendations.filter((row) => overlap(start, end, row.firstDetectedAt, row.resolvedAt));

  const resolvedAlerts = overlappingAlerts.filter((row) => row.status === 'resolved' && row.resolvedAt !== null);
  const resolveTimes = resolvedAlerts
    .map((row) => {
      const first = parseDate(row.firstDetectedAt);
      const resolvedAt = parseDate(row.resolvedAt ?? undefined);
      if (!first || !resolvedAt) return null;
      return Math.max(0, (resolvedAt.getTime() - first.getTime()) / (60 * 60 * 1000));
    })
    .filter((value): value is number => value !== null);

  const alertCount = overlappingAlerts.length;
  const criticalCount = overlappingAlerts.filter((row) => row.severity === 'critical').length;
  const reoccurCount = overlappingAlerts.filter((row) => row.occurrenceCount > 1).length;

  return {
    alertCount,
    activeAlerts: overlappingAlerts.filter((row) => row.status === 'active').length,
    criticalCount,
    criticalRatio: safeRatio(criticalCount, alertCount),
    reoccurCount,
    reoccurRate: safeRatio(reoccurCount, alertCount),
    avgResolveTimeHours: mean(resolveTimes),
    recommendationCount: overlappingRecommendations.length,
    activeRecommendations: overlappingRecommendations.filter((row) => row.status === 'active').length,
    recommendationResolvedCount: overlappingRecommendations.filter((row) => row.status === 'resolved').length,
  };
}

function formatMetric(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(value >= 10 ? 0 : 2);
}

function compareLowerBetter(
  before: number | null,
  after: number | null,
  options: { label: string; improvementThreshold?: number; worseningThreshold?: number; weight?: number },
): { score: number; evidence: string[] } {
  const improvementThreshold = options.improvementThreshold ?? 0.15;
  const worseningThreshold = options.worseningThreshold ?? 0.15;
  const weight = options.weight ?? 1;
  if (before === null || after === null) return { score: 0, evidence: [] };
  if (before === 0 && after === 0) {
    return { score: 0, evidence: [`${options.label} stayed at 0.`] };
  }
  const denominator = Math.max(Math.abs(before), 1);
  const delta = (after - before) / denominator;
  if (delta <= -improvementThreshold) {
    return { score: weight, evidence: [`${options.label} improved from ${formatMetric(before)} to ${formatMetric(after)}.`] };
  }
  if (delta >= worseningThreshold) {
    return { score: -weight, evidence: [`${options.label} worsened from ${formatMetric(before)} to ${formatMetric(after)}.`] };
  }
  return { score: 0, evidence: [`${options.label} stayed roughly unchanged (${formatMetric(before)} → ${formatMetric(after)}).`] };
}

function summarizeTrend(result: PolicyAuditResult): string {
  if (result === 'improved') return 'The post-change window looks more stable and lower-noise.';
  if (result === 'worsened') return 'The post-change window shows more risk or operational friction.';
  if (result === 'unchanged') return 'The change did not materially alter the observed alert pattern.';
  return 'The available data is too sparse to judge the effect of this change.';
}

function summarizeTopFields(changes: PolicyChangeHistoryRecord[]): Array<{ field: string; count: number }> {
  const counts = new Map<string, number>();
  for (const change of changes) {
    for (const field of change.changedFields) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function buildAuditResult(before: PolicyAuditWindowMetrics, after: PolicyAuditWindowMetrics): {
  result: PolicyAuditResult;
  evidence: string[];
  limitations: string[];
} {
  const evidence: string[] = [];
  const limitations: string[] = [];

  const comparisons = [
    compareLowerBetter(before.alertCount, after.alertCount, { label: 'Alert count', weight: 1 }),
    compareLowerBetter(before.activeAlerts, after.activeAlerts, { label: 'Active alerts', weight: 2 }),
    compareLowerBetter(before.criticalRatio, after.criticalRatio, { label: 'Critical ratio', weight: 2, improvementThreshold: 0.08, worseningThreshold: 0.08 }),
    compareLowerBetter(before.reoccurRate, after.reoccurRate, { label: 'Reoccur rate', weight: 1, improvementThreshold: 0.08, worseningThreshold: 0.08 }),
    compareLowerBetter(before.avgResolveTimeHours, after.avgResolveTimeHours, { label: 'Average resolve time', weight: 1, improvementThreshold: 0.12, worseningThreshold: 0.12 }),
    compareLowerBetter(before.recommendationCount, after.recommendationCount, { label: 'Recommendation count', weight: 1 }),
  ];

  let score = 0;
  for (const comparison of comparisons) {
    score += comparison.score;
    evidence.push(...comparison.evidence);
  }

  const hardWorsening =
    (before.activeAlerts >= 0 && after.activeAlerts > before.activeAlerts) ||
    (before.criticalRatio !== null && after.criticalRatio !== null && after.criticalRatio >= before.criticalRatio + 0.1) ||
    (before.avgResolveTimeHours !== null &&
      after.avgResolveTimeHours !== null &&
      after.avgResolveTimeHours >= before.avgResolveTimeHours * 1.25);

  const hardImprovement =
    (before.activeAlerts > 0 && after.activeAlerts < before.activeAlerts) ||
    (before.criticalRatio !== null && after.criticalRatio !== null && after.criticalRatio <= before.criticalRatio - 0.08) ||
    (before.avgResolveTimeHours !== null &&
      after.avgResolveTimeHours !== null &&
      after.avgResolveTimeHours <= before.avgResolveTimeHours * 0.8);

  const totalSignals = before.alertCount + after.alertCount + before.recommendationCount + after.recommendationCount;
  if (totalSignals < 3) {
    limitations.push('The comparison window is too sparse to judge policy impact confidently.');
    return { result: 'insufficient', evidence, limitations };
  }

  if (hardWorsening || score <= -2) {
    return {
      result: 'worsened',
      evidence,
      limitations: [
        ...limitations,
        ...(after.activeAlerts > before.activeAlerts ? ['Active alerts increased after the policy change.'] : []),
        ...(after.criticalRatio !== null && before.criticalRatio !== null && after.criticalRatio >= before.criticalRatio + 0.1
          ? ['Critical ratio moved higher after the policy change.']
          : []),
      ],
    };
  }

  if (hardImprovement || score >= 2) {
    return {
      result: 'improved',
      evidence,
      limitations: [
        ...limitations,
        ...(after.alertCount > before.alertCount ? ['Alert count improved, but the aggregate volume is still not zero.'] : []),
      ],
    };
  }

  return {
    result: 'unchanged',
    evidence,
    limitations: [...limitations, 'The observed changes are small or mixed, so no strong conclusion is warranted.'],
  };
}

function defaultDataSource(): PolicyAuditDataSource {
  return {
    async listChanges(limit: number): Promise<PolicyChangeHistoryRecord[]> {
      const rows = await prisma.policyChangeHistory.findMany({
        where: { policyKey: AUTONOMOUS_ALERT_POLICY_SETTING_KEY },
        orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.max(1, Math.min(100, limit)),
      });

      return rows.map((row) => ({
        id: row.id,
        policyKey: row.policyKey,
        changedAt: row.changedAt.toISOString(),
        changedBy: row.changedBy,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changedFields: (() => {
          try {
            const parsed = JSON.parse(row.changedFields) as unknown;
            return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
          } catch {
            return [];
          }
        })(),
        reason: row.reason,
        guardrailCount: row.guardrailCount,
        guardrailSummary: (() => {
          try {
            return row.guardrailSummary ? JSON.parse(row.guardrailSummary) : null;
          } catch {
            return null;
          }
        })(),
        requiresConfirmation: row.requiresConfirmation,
        guardrailDetails: (() => {
          try {
            const parsed = row.guardrailDetails ? JSON.parse(row.guardrailDetails) : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        highestGuardrailSeverity:
          row.highestGuardrailSeverity === 'info' || row.highestGuardrailSeverity === 'warning' || row.highestGuardrailSeverity === 'critical'
            ? row.highestGuardrailSeverity
            : null,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async listJobAlerts(start: Date, end: Date): Promise<JobAlertRecord[]> {
      const rows = await prisma.jobAlert.findMany({
        where: {
          firstDetectedAt: { lt: end },
          OR: [
            { resolvedAt: null },
            { resolvedAt: { gte: start } },
          ],
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
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        occurrenceCount: row.occurrenceCount,
        latestJobRunLogId: row.latestJobRunLogId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    async listRecommendations(start: Date, end: Date): Promise<RecommendationHistoryRecord[]> {
      const rows = await prisma.recommendationHistory.findMany({
        where: {
          firstDetectedAt: { lt: end },
          OR: [
            { resolvedAt: null },
            { resolvedAt: { gte: start } },
          ],
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
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        occurrenceCount: row.occurrenceCount,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  };
}

export class PolicyAuditTrailService {
  constructor(private readonly dataSource: PolicyAuditDataSource = defaultDataSource()) {}

  async build(input: PolicyAuditTrailFilter = {}): Promise<PolicyAuditTrailResult> {
    const now = input.now ?? new Date();
    const limit = clampLimit(input.limit, 5);
    const windowDays = clampWindowDays(input.windowDays);
    const changes = await this.dataSource.listChanges(input.changeId ? 100 : limit);
    const selectedChanges = input.changeId ? changes.filter((change) => change.id === input.changeId) : changes;
    const audits: PolicyAuditTrailRow[] = [];

    for (const change of selectedChanges) {
      const changedAt = parseDate(change.changedAt) ?? now;
      const beforeStart = new Date(changedAt.getTime() - dayMs(windowDays));
      const beforeEnd = changedAt;
      const afterStart = changedAt;
      const afterEnd = new Date(Math.min(now.getTime(), changedAt.getTime() + dayMs(windowDays)));

      const [alertsBefore, alertsAfter, recommendationsBefore, recommendationsAfter] = await Promise.all([
        this.dataSource.listJobAlerts(beforeStart, beforeEnd),
        this.dataSource.listJobAlerts(afterStart, afterEnd),
        this.dataSource.listRecommendations(beforeStart, beforeEnd),
        this.dataSource.listRecommendations(afterStart, afterEnd),
      ]);

      const before = buildWindowMetrics(alertsBefore, recommendationsBefore, beforeStart, beforeEnd);
      const after = buildWindowMetrics(alertsAfter, recommendationsAfter, afterStart, afterEnd);
      const comparison = buildAuditResult(before, after);

      audits.push({
        change,
        windowDays,
        before,
        after,
        result: comparison.result,
        evidence: comparison.evidence,
        summary: summarizeTrend(comparison.result),
        limitations: [
          ...comparison.limitations,
          ...(afterEnd.getTime() - afterStart.getTime() < dayMs(windowDays)
            ? ['The after-window is shorter than the requested comparison window.']
            : []),
        ],
      });
    }

    const summary: PolicyAuditTrailSummary = {
      total: audits.length,
      improved: audits.filter((row) => row.result === 'improved').length,
      unchanged: audits.filter((row) => row.result === 'unchanged').length,
      worsened: audits.filter((row) => row.result === 'worsened').length,
      insufficient: audits.filter((row) => row.result === 'insufficient').length,
      latestChangedAt: audits[0]?.change.changedAt ?? null,
      topChangedFields: summarizeTopFields(selectedChanges),
    };

    const limitations = [
      ...(changes.length === 0 ? ['No policy changes have been recorded yet.'] : []),
      ...(audits.some((row) => row.result === 'insufficient')
        ? ['At least one audit window is too sparse or too recent for a strong conclusion.']
        : []),
      'Audit results are advisory and do not auto-apply any policy change.',
    ];

    return {
      changes: selectedChanges,
      audits,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
