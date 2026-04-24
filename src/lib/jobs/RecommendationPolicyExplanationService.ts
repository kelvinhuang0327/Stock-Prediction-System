import { loadAutonomousAlertPolicyState, type AutonomousAlertPolicyState } from './AutonomousAlertPolicyStore';
import { RecommendationHistoryService } from './RecommendationHistoryService';
import { RecommendationTrendService, type RecommendationTrendDirection } from './RecommendationTrendService';
import { RecommendationLifecycleService } from './RecommendationLifecycleService';
import { NoisySourceBreakdownService } from './NoisySourceBreakdownService';
import { JobHealthService } from './JobHealthService';
import { PolicyRecommendationEngine, type PolicyRecommendationRow, type PolicyRecommendationType } from './PolicyRecommendationEngine';
import type { JobAlertSeverity } from './types';

export type RecommendationExplanationTone = 'critical' | 'warning' | 'info' | 'neutral';

export interface RecommendationPolicyExplanationEvidence {
  key: string;
  label: string;
  detail: string;
  tone: RecommendationExplanationTone;
}

export interface RecommendationPolicyExplanationRow {
  recommendationKey: string;
  recommendationType: PolicyRecommendationType;
  targetJob: string;
  targetFamily: string | null;
  severity: JobAlertSeverity;
  rationaleSummary: string;
  evidence: RecommendationPolicyExplanationEvidence[];
  suggestedAction: string;
  confidence: number;
  status: 'active' | 'resolved' | 'stale';
  lastSeenAt: string;
  relatedTrendDirection: RecommendationTrendDirection | 'insufficient';
  relatedLifecycleSummary: string;
  limitations: string[];
}

export interface RecommendationPolicyExplanationSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<PolicyRecommendationType, number>;
  topJobs: Array<{ jobName: string; explanationCount: number }>;
}

export interface RecommendationPolicyExplanationResult {
  policy: AutonomousAlertPolicyState;
  explanations: RecommendationPolicyExplanationRow[];
  summary: RecommendationPolicyExplanationSummary;
  limitations: string[];
  generatedAt: string;
}

export interface RecommendationPolicyExplanationFilter {
  jobName?: string;
  recommendationType?: PolicyRecommendationType;
  limit?: number;
  now?: Date;
}

interface ExplanationContext {
  recommendation: PolicyRecommendationRow;
  historyRows: Awaited<ReturnType<RecommendationHistoryService['listHistory']>>;
  trend: Awaited<ReturnType<RecommendationTrendService['build']>>;
  lifecycle: Awaited<ReturnType<RecommendationLifecycleService['build']>>;
  noisyBreakdown: Awaited<ReturnType<NoisySourceBreakdownService['build']>> | null;
  healthStatus: string | null;
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(5, Math.floor(value ?? fallback)));
}

function buildByType(): Record<PolicyRecommendationType, number> {
  return {
    cooldown_increase: 0,
    cooldown_decrease: 0,
    review_monitor_frequency: 0,
    review_scheduler_reliability: 0,
    consider_severity_escalation: 0,
    consider_severity_downgrade: 0,
    no_change_recommended: 0,
  };
}

function buildEvidenceForContext(context: ExplanationContext): RecommendationPolicyExplanationEvidence[] {
  const { recommendation, historyRows, trend, lifecycle, noisyBreakdown, healthStatus } = context;
  const evidence: RecommendationPolicyExplanationEvidence[] = [];
  const topFamily = noisyBreakdown?.topFamily ?? null;
  const lifecycleRow = lifecycle.recommendations[0] ?? null;
  const trendDirection = trend.summary.trendDirection;
  const mostRecentHistory = historyRows[0] ?? null;
  const recentFamily = mostRecentHistory?.targetFamily ?? null;
  const resolveHours = topFamily?.avgResolveTimeHours ?? null;
  const reoccurCount = lifecycleRow?.reoccurCount ?? 0;
  const unresolved = lifecycleRow && lifecycleRow.currentStatus === 'active' ? 1 : 0;
  const noisyScore = topFamily?.noisyScore ?? 0;

  if (recommendation.recommendationType === 'cooldown_increase') {
    if ((lifecycleRow?.occurrenceCount ?? 0) >= 2) {
      evidence.push({
        key: 'high_occurrence',
        label: 'High occurrence',
        detail: `Observed ${lifecycleRow?.occurrenceCount ?? 0} repeated recommendation cycle(s).`,
        tone: 'warning',
      });
    }
    if (reoccurCount > 0) {
      evidence.push({
        key: 'frequent_reoccur',
        label: 'Frequent reoccur',
        detail: `The same recommendation reoccurred ${reoccurCount} time(s).`,
        tone: 'warning',
      });
    }
    if (resolveHours !== null && resolveHours <= 3) {
      evidence.push({
        key: 'mostly_resolved_quickly',
        label: 'Mostly resolved quickly',
        detail: `Top noisy family resolves in about ${resolveHours.toFixed(1)}h on average.`,
        tone: 'info',
      });
    }
    if (trendDirection === 'stable' || trendDirection === 'improving') {
      evidence.push({
        key: 'stable_trend',
        label: 'Stable trend',
        detail: `Trend is ${trendDirection}, so the issue looks more noisy than worsening.`,
        tone: 'neutral',
      });
    }
    if (noisyScore >= 8) {
      evidence.push({
        key: 'noise_heavy',
        label: 'Noise-heavy source',
        detail: `Top noisy source score is ${noisyScore.toFixed(1)}, which supports increasing cooldown.`,
        tone: 'warning',
      });
    }
  }

  if (recommendation.recommendationType === 'review_scheduler_reliability') {
    if (topFamily?.family === 'missed_run' || topFamily?.family === 'delayed_run') {
      evidence.push({
        key: 'scheduler_related_pattern',
        label: 'Scheduler-related pattern',
        detail: `Top noisy family is ${topFamily.familyLabel.toLowerCase()}.`,
        tone: 'critical',
      });
    }
    if (trendDirection === 'worsening' || trendDirection === 'oscillating') {
      evidence.push({
        key: 'worsening_trend',
        label: 'Worsening trend',
        detail: `Trend direction is ${trendDirection}, which suggests timing or reliability issues.`,
        tone: 'critical',
      });
    }
    if (unresolved > 0) {
      evidence.push({
        key: 'unresolved_open',
        label: 'Unresolved open cycle',
        detail: 'The recommendation lifecycle is still active.',
        tone: 'warning',
      });
    }
    if (healthStatus === 'failed' || healthStatus === 'delayed') {
      evidence.push({
        key: 'health_reliability_issue',
        label: 'Health signal',
        detail: `Current job health is ${healthStatus}, which supports scheduler review.`,
        tone: 'critical',
      });
    }
  }

  if (recommendation.recommendationType === 'consider_severity_escalation') {
    if ((topFamily?.criticalRatio ?? 0) >= 0.5) {
      evidence.push({
        key: 'critical_heavy',
        label: 'Critical-heavy',
        detail: `Critical ratio is ${(Math.max(0, topFamily?.criticalRatio ?? 0) * 100).toFixed(1)}%.`,
        tone: 'critical',
      });
    }
    if (topFamily?.avgResolveTimeHours !== null && topFamily?.avgResolveTimeHours !== undefined) {
      evidence.push({
        key: 'slow_recovery',
        label: 'Slow recovery',
        detail: `Average resolve time is ${topFamily.avgResolveTimeHours.toFixed(1)}h.`,
        tone: 'warning',
      });
    }
    if ((lifecycleRow?.resolvedCount ?? 0) > 0) {
      evidence.push({
        key: 'resolved_cycles',
        label: 'Resolved cycles',
        detail: `Lifecycle has ${lifecycleRow?.resolvedCount ?? 0} resolved cycle(s), but signal still reappears.`,
        tone: 'warning',
      });
    }
  }

  if (recommendation.recommendationType === 'consider_severity_downgrade') {
    if ((topFamily?.criticalRatio ?? 0) < 0.25) {
      evidence.push({
        key: 'low_critical_ratio',
        label: 'Low critical ratio',
        detail: `Critical ratio stays below 25%, so the signal is mostly warning-level.`,
        tone: 'info',
      });
    }
    if (resolveHours !== null && resolveHours <= 2) {
      evidence.push({
        key: 'fast_resolution',
        label: 'Fast resolution',
        detail: `Average resolve time is ${resolveHours.toFixed(1)}h, so the issue closes quickly.`,
        tone: 'info',
      });
    }
    if (trendDirection === 'stable' || trendDirection === 'improving') {
      evidence.push({
        key: 'benign_trend',
        label: 'Benign trend',
        detail: `Trend is ${trendDirection}, so the family does not appear to be worsening.`,
        tone: 'neutral',
      });
    }
  }

  if (recommendation.recommendationType === 'review_monitor_frequency') {
    if (trendDirection === 'oscillating' || trendDirection === 'worsening') {
      evidence.push({
        key: 'cadence_mismatch',
        label: 'Cadence mismatch',
        detail: `Trend is ${trendDirection}, which often appears when the monitoring window is not aligned.`,
        tone: 'warning',
      });
    }
    if (recentFamily === 'missed_run' || recentFamily === 'delayed_run') {
      evidence.push({
        key: 'missed_or_delayed',
        label: 'Missed / delayed',
        detail: `Recent history points to ${recentFamily}.`,
        tone: 'warning',
      });
    }
  }

  if (recommendation.recommendationType === 'no_change_recommended') {
    if (trendDirection === 'stable' || trendDirection === 'improving') {
      evidence.push({
        key: 'stable_or_improving',
        label: 'Stable / improving',
        detail: `Trend remains ${trendDirection}.`,
        tone: 'neutral',
      });
    }
    if ((noisyScore ?? 0) < 12) {
      evidence.push({
        key: 'acceptable_noise',
        label: 'Acceptable noise',
        detail: `Top noisy score stays at ${noisyScore.toFixed(1)}, which is within a manageable range.`,
        tone: 'info',
      });
    }
    if ((historyRows[0]?.occurrenceCount ?? 0) <= 1) {
      evidence.push({
        key: 'low_repeat',
        label: 'Low repeat',
        detail: 'No meaningful repeat pattern has accumulated yet.',
        tone: 'neutral',
      });
    }
  }

  if (evidence.length === 0) {
    evidence.push({
      key: 'limited_signal',
      label: 'Limited signal',
      detail: 'The current evidence is sparse, so the recommendation should be interpreted conservatively.',
      tone: 'neutral',
    });
  }

  return evidence.slice(0, 5);
}

function buildRationaleSummary(recommendation: PolicyRecommendationRow, evidence: RecommendationPolicyExplanationEvidence[]): string {
  const primary = evidence[0]?.label ?? 'Limited signal';
  return `${recommendation.recommendationType}: ${recommendation.rationale} Key evidence: ${primary}.`;
}

function summarizeResult(explanations: RecommendationPolicyExplanationRow[]): RecommendationPolicyExplanationSummary {
  const byType = buildByType();
  const jobMap = new Map<string, number>();
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const item of explanations) {
    byType[item.recommendationType] += 1;
    if (item.severity === 'critical') critical += 1;
    else if (item.severity === 'warning') warning += 1;
    else info += 1;
    jobMap.set(item.targetJob, (jobMap.get(item.targetJob) ?? 0) + 1);
  }

  return {
    total: explanations.length,
    critical,
    warning,
    info,
    byType,
    topJobs: [...jobMap.entries()]
      .map(([jobName, explanationCount]) => ({ jobName, explanationCount }))
      .sort((left, right) => right.explanationCount - left.explanationCount)
      .slice(0, 5),
  };
}

export class RecommendationPolicyExplanationService {
  constructor(
    private readonly policyLoader = loadAutonomousAlertPolicyState,
    private readonly recommendationEngine = new PolicyRecommendationEngine(),
    private readonly historyService = new RecommendationHistoryService(),
    private readonly trendService = new RecommendationTrendService(),
    private readonly lifecycleService = new RecommendationLifecycleService(),
    private readonly noisySourceBreakdownService = new NoisySourceBreakdownService(),
    private readonly jobHealthService = new JobHealthService(),
  ) {}

  async build(input: RecommendationPolicyExplanationFilter = {}): Promise<RecommendationPolicyExplanationResult> {
    const now = input.now ?? new Date();
    const limit = clampLimit(input.limit, 4);
    const policy = await this.policyLoader().catch(() => null);
    const recommendationsResult = await this.recommendationEngine.build({
      jobName: input.jobName,
      severity: undefined,
      limit,
      now,
    });
    const jobHealth = await this.jobHealthService.evaluate(now).catch(() => null);

    const targetRecommendations = recommendationsResult.recommendations.slice(0, limit);
    const explanations: RecommendationPolicyExplanationRow[] = [];

    for (const recommendation of targetRecommendations) {
      const [historyRows, trend, lifecycle, noisyBreakdown] = await Promise.all([
        this.historyService.listHistory(
          {
            jobName: recommendation.targetJob,
            recommendationType: recommendation.recommendationType,
            status: 'all',
            sortBy: 'latest',
            sortDir: 'desc',
            limit: 20,
            offset: 0,
          },
          now,
        ),
        this.trendService.build(
          {
            recommendationType: recommendation.recommendationType,
            targetJob: recommendation.targetJob,
            status: 'all',
          },
          '14d',
          'day',
          now,
        ),
        this.lifecycleService.build(
          {
            recommendationType: recommendation.recommendationType,
            targetJob: recommendation.targetJob,
            status: 'all',
            limit: 5,
          },
          now,
        ),
        this.noisySourceBreakdownService.build(recommendation.targetJob, 30, now).catch(() => null),
      ]);
      const healthStatus = jobHealth?.jobs.find((job) => job.jobName === recommendation.targetJob)?.healthStatus ?? null;
      const evidence = buildEvidenceForContext({
        recommendation,
        historyRows,
        trend,
        lifecycle,
        noisyBreakdown,
        healthStatus,
      });
      const mostRecentHistory = historyRows[0] ?? null;

      explanations.push({
        recommendationKey: `${recommendation.recommendationType}|${recommendation.targetJob}|${recommendation.targetFamily ?? 'all'}`,
        recommendationType: recommendation.recommendationType,
        targetJob: recommendation.targetJob,
        targetFamily: recommendation.targetFamily ?? null,
        severity: recommendation.severity,
        rationaleSummary: buildRationaleSummary(recommendation, evidence),
        evidence,
        suggestedAction: recommendation.suggestedAction,
        confidence: recommendation.confidence,
        status: mostRecentHistory?.status ?? 'active',
        lastSeenAt: mostRecentHistory?.lastDetectedAt ?? now.toISOString(),
        relatedTrendDirection: trend.summary.trendDirection,
        relatedLifecycleSummary: lifecycle.recommendations[0]?.lifecycleSummary ?? 'No lifecycle data available.',
        limitations: [
          ...(recommendation.limitations ?? []),
          ...(trend.limitations ?? []),
          ...(lifecycle.limitations ?? []),
          ...(noisyBreakdown?.limitations ?? []),
        ].slice(0, 6),
      });
    }

    const summary = summarizeResult(explanations);
    const limitations = [
      ...(recommendationsResult.limitations ?? []),
      ...(explanations.length === 0 ? ['No recommendation explanation could be derived from the current signal.'] : []),
      'Explanations are advisory only and are not auto-applied.',
      ...(policy?.limitations ?? []),
    ];

    return {
      policy: policy ?? recommendationsResult.policy,
      explanations,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }
}
