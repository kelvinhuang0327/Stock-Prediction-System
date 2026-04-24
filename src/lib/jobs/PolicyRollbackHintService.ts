import { PolicyAuditChartService, type PolicyAuditChartResult } from './PolicyAuditChartService';
import { PolicyAuditTrailService, type PolicyAuditTrailResult } from './PolicyAuditTrailService';
import type { PolicyChangeHistoryRecord } from './PolicyChangeHistoryService';

export type PolicyRollbackHintType =
  | 'keep_change'
  | 'review_change'
  | 'consider_rollback'
  | 'insufficient_evidence';

export interface PolicyRollbackHintRow {
  change: PolicyChangeHistoryRecord;
  windowDays: number;
  hintType: PolicyRollbackHintType;
  rationale: string;
  evidence: string[];
  confidence: number;
  limitations: string[];
  auditResult: PolicyAuditTrailResult['audits'][number]['result'];
  before: PolicyAuditTrailResult['audits'][number]['before'];
  after: PolicyAuditTrailResult['audits'][number]['after'];
  chart: PolicyAuditChartResult;
}

export interface PolicyRollbackHintSummary {
  total: number;
  keepChange: number;
  reviewChange: number;
  considerRollback: number;
  insufficientEvidence: number;
  topJobs: Array<{ jobName: string; hintCount: number }>;
}

export interface PolicyRollbackHintResult {
  hints: PolicyRollbackHintRow[];
  summary: PolicyRollbackHintSummary;
  limitations: string[];
  generatedAt: string;
}

export interface PolicyRollbackHintFilter {
  limit?: number;
  changeId?: number;
  windowDays?: 7 | 14 | 30;
  now?: Date;
}

export interface PolicyRollbackHintDataSource {
  buildAuditTrail(input: PolicyRollbackHintFilter): Promise<PolicyAuditTrailResult>;
  buildAuditChart(changeId: number, windowDays: 7 | 14 | 30, now: Date): Promise<PolicyAuditChartResult>;
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(value ?? fallback)));
}

function clampWindowDays(value: 7 | 14 | 30 | undefined): 7 | 14 | 30 {
  if (value === 7 || value === 14 || value === 30) return value;
  return 14;
}

function metricTrendLabel(metric: PolicyAuditChartResult['metrics'][keyof PolicyAuditChartResult['metrics']], lowerBetter = true): string {
  if (metric.trend === 'insufficient') return 'insufficient';
  if (metric.trend === 'flat') return 'flat';
  if (lowerBetter) return metric.trend === 'down' ? 'down' : 'up';
  return metric.trend === 'up' ? 'up' : 'down';
}

function metricSentence(
  label: string,
  metric: PolicyAuditChartResult['metrics'][keyof PolicyAuditChartResult['metrics']],
  lowerBetter = true,
): string | null {
  if (metric.beforeAvg === null || metric.afterAvg === null) return null;
  const before = metric.beforeAvg;
  const after = metric.afterAvg;
  const arrow = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
  const trendLabel = metricTrendLabel(metric, lowerBetter);
  const valueText = `${before.toFixed(before >= 10 ? 0 : 2)} → ${after.toFixed(after >= 10 ? 0 : 2)}`;
  return `${label} ${arrow} ${trendLabel} (${valueText})`;
}

function isMeaningfulImprovement(metric: PolicyAuditChartResult['metrics'][keyof PolicyAuditChartResult['metrics']], lowerBetter = true): boolean {
  return metric.impact === 'improving' && metric.trend !== 'insufficient' && lowerBetter;
}

function isMeaningfulWorsening(metric: PolicyAuditChartResult['metrics'][keyof PolicyAuditChartResult['metrics']], lowerBetter = true): boolean {
  return metric.impact === 'worsening' && metric.trend !== 'insufficient' && lowerBetter;
}

function buildEvidence(chart: PolicyAuditChartResult): string[] {
  return [
    metricSentence('Alert count', chart.metrics.alertCount),
    metricSentence('Critical ratio', chart.metrics.criticalRatio),
    metricSentence('Reoccur rate', chart.metrics.reoccurRate),
    metricSentence('Resolve time', chart.metrics.avgResolveTime),
    metricSentence('Recommendation count', chart.metrics.recommendationCount),
  ].filter((value): value is string => Boolean(value));
}

function hasStrongImprovement(chart: PolicyAuditChartResult): boolean {
  const metrics = chart.metrics;
  return (
    isMeaningfulImprovement(metrics.alertCount) &&
    isMeaningfulImprovement(metrics.reoccurRate) &&
    isMeaningfulImprovement(metrics.avgResolveTime) &&
    !isMeaningfulWorsening(metrics.criticalRatio)
  );
}

function hasMixedSignals(chart: PolicyAuditChartResult): boolean {
  const impacts = Object.values(chart.metrics).map((metric) => metric.impact);
  const improving = impacts.filter((impact) => impact === 'improving').length;
  const worsening = impacts.filter((impact) => impact === 'worsening').length;
  return improving > 0 && worsening > 0;
}

function buildHintType(
  auditResult: PolicyAuditTrailResult['audits'][number]['result'],
  chart: PolicyAuditChartResult,
): PolicyRollbackHintType {
  const insufficient = auditResult === 'insufficient' || chart.metrics.alertCount.trend === 'insufficient';
  if (insufficient) return 'insufficient_evidence';

  if (hasStrongImprovement(chart)) return 'keep_change';

  const alertCountDown = chart.metrics.alertCount.impact === 'improving';
  const criticalRatioUp = chart.metrics.criticalRatio.impact === 'worsening';
  const reoccurDown = chart.metrics.reoccurRate.impact === 'improving';
  const resolveTimeUp = chart.metrics.avgResolveTime.impact === 'worsening';
  const unresolvedUp = chart.metrics.alertCount.afterAvg !== null && chart.metrics.alertCount.beforeAvg !== null
    ? chart.metrics.alertCount.afterAvg > chart.metrics.alertCount.beforeAvg * 1.1
    : false;
  const criticalRiskIsMaterial =
    chart.metrics.criticalRatio.magnitude === 'large' ||
    chart.metrics.avgResolveTime.magnitude === 'large' ||
    chart.metrics.avgResolveTime.magnitude === 'medium' ||
    unresolvedUp;

  if (alertCountDown && criticalRatioUp) {
    return criticalRiskIsMaterial && resolveTimeUp ? 'consider_rollback' : 'review_change';
  }

  if (unresolvedUp && resolveTimeUp) {
    return 'consider_rollback';
  }

  if (hasMixedSignals(chart)) {
    return 'review_change';
  }

  if (alertCountDown && reoccurDown && !criticalRatioUp) {
    return 'keep_change';
  }

  return 'review_change';
}

function buildRationale(
  hintType: PolicyRollbackHintType,
  chart: PolicyAuditChartResult,
): string {
  if (hintType === 'keep_change') {
    return 'The change appears to reduce alert noise without pushing critical risk or recovery time higher.';
  }
  if (hintType === 'consider_rollback') {
    return 'The change may be suppressing alerts while shifting risk into unresolved or slower-to-resolve issues.';
  }
  if (hintType === 'insufficient_evidence') {
    return 'There is not enough post-change data to make a confident rollback judgment.';
  }
  if (chart.metrics.criticalRatio.impact === 'worsening') {
    return 'The change shows mixed results: lower alert volume, but the remaining issues look more critical.';
  }
  return 'The change shows mixed signals and is worth a human review before any policy adjustment.';
}

function buildConfidence(hintType: PolicyRollbackHintType, chart: PolicyAuditChartResult): number {
  if (hintType === 'insufficient_evidence') return 0.2;
  const impacts = Object.values(chart.metrics).filter((metric) => metric.impact !== 'insufficient');
  const aligned = impacts.filter((metric) => metric.impact === 'improving').length;
  const opposing = impacts.filter((metric) => metric.impact === 'worsening').length;
  const base = hintType === 'keep_change' ? 0.75 : hintType === 'consider_rollback' ? 0.7 : 0.55;
  const confidence = base + (aligned - opposing) * 0.05;
  return Math.max(0.25, Math.min(0.95, Math.round(confidence * 100) / 100));
}

function defaultSummary(): PolicyRollbackHintSummary {
  return {
    total: 0,
    keepChange: 0,
    reviewChange: 0,
    considerRollback: 0,
    insufficientEvidence: 0,
    topJobs: [],
  };
}

export class PolicyRollbackHintService {
  constructor(private readonly deps: PolicyRollbackHintDataSource = {
    buildAuditTrail: (input) => new PolicyAuditTrailService().build(input),
    buildAuditChart: (changeId, windowDays, now) => new PolicyAuditChartService().build({ changeId, windowDays, now }),
  }) {}

  async build(filter: PolicyRollbackHintFilter = {}): Promise<PolicyRollbackHintResult> {
    const now = filter.now ?? new Date();
    const limit = clampLimit(filter.limit, 5);
    const windowDays = clampWindowDays(filter.windowDays);
    const auditTrail = await this.deps.buildAuditTrail({
      changeId: filter.changeId,
      limit,
      windowDays,
      now,
    });

    const changes = filter.changeId ? auditTrail.changes.slice(0, 1) : auditTrail.changes.slice(0, limit);
    const hints: PolicyRollbackHintRow[] = [];

    for (const change of changes) {
      const audit = auditTrail.audits.find((row) => row.change.id === change.id);
      if (!audit) continue;

      const chart = await this.deps.buildAuditChart(change.id, windowDays, now);
      const hintType = buildHintType(audit.result, chart);
      const evidence = buildEvidence(chart);
      const limitations = [
        ...audit.limitations,
        ...chart.limitations,
        ...(hintType === 'insufficient_evidence' ? ['The hint is advisory only because the post-change evidence is still sparse.'] : []),
      ];

      hints.push({
        change,
        windowDays,
        hintType,
        rationale: buildRationale(hintType, chart),
        evidence,
        confidence: buildConfidence(hintType, chart),
        limitations,
        auditResult: audit.result,
        before: audit.before,
        after: audit.after,
        chart,
      });
    }

    const summary: PolicyRollbackHintSummary = hints.reduce<PolicyRollbackHintSummary>(
      (acc, hint) => {
        acc.total += 1;
        if (hint.hintType === 'keep_change') acc.keepChange += 1;
        else if (hint.hintType === 'review_change') acc.reviewChange += 1;
        else if (hint.hintType === 'consider_rollback') acc.considerRollback += 1;
        else acc.insufficientEvidence += 1;
        const jobName = hint.change.policyKey;
        const existing = acc.topJobs.find((item) => item.jobName === jobName);
        if (existing) existing.hintCount += 1;
        else acc.topJobs.push({ jobName, hintCount: 1 });
        return acc;
      },
      defaultSummary(),
    );

    summary.topJobs.sort((left, right) => right.hintCount - left.hintCount);

    const limitations = [
      ...(auditTrail.limitations ?? []),
      ...(hints.length === 0 ? ['No rollback hints are available yet.'] : []),
      'Rollback hints are advisory only and do not auto-apply or revert policy changes.',
    ];

    return {
      hints,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
