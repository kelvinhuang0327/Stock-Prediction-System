import { JobAlertHistoryService } from './JobAlertHistoryService';
import { NoisySourceBreakdownService } from './NoisySourceBreakdownService';
import { FamilyTrendService, type FamilyTrendRow } from './FamilyTrendService';
import { ResolveTimeDistributionService } from './ResolveTimeDistributionService';
import { JobHealthService } from './JobHealthService';
import {
  loadAutonomousAlertPolicyState,
  type AutonomousAlertPolicyState,
} from './AutonomousAlertPolicyStore';
import type { JobAlertSeverity, JobHealthReport } from './types';

export type PolicyRecommendationType =
  | 'cooldown_increase'
  | 'cooldown_decrease'
  | 'review_monitor_frequency'
  | 'review_scheduler_reliability'
  | 'consider_severity_escalation'
  | 'consider_severity_downgrade'
  | 'no_change_recommended';

export type PolicyRecommendationCategory = 'policy' | 'scheduler' | 'severity' | 'monitoring';

export interface PolicyRecommendationRow {
  category: PolicyRecommendationCategory;
  targetJob: string;
  targetFamily?: string | null;
  recommendationType: PolicyRecommendationType;
  severity: JobAlertSeverity;
  rationale: string;
  suggestedAction: string;
  confidence: number;
  limitations: string[];
}

export interface PolicyRecommendationSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  byType: Record<PolicyRecommendationType, number>;
  byCategory: Record<PolicyRecommendationCategory, number>;
  jobCount: number;
  topJobs: Array<{ jobName: string; recommendationCount: number }>;
}

export interface PolicyRecommendationResult {
  recommendations: PolicyRecommendationRow[];
  summary: PolicyRecommendationSummary;
  policy: AutonomousAlertPolicyState;
  generatedAt: string;
  limitations: string[];
}

export interface PolicyRecommendationInput {
  jobName?: string;
  severity?: JobAlertSeverity;
  limit?: number;
  now?: Date;
}

interface JobAnalyticsBundle {
  jobName: string;
  noisyFamily: string | null;
  noisyFamilyLabel: string | null;
  noisyFamilyTrend: FamilyTrendRow | null;
  resolveDistribution: Awaited<ReturnType<ResolveTimeDistributionService['build']>> | null;
  breakdown: Awaited<ReturnType<NoisySourceBreakdownService['build']>> | null;
  healthRow: JobHealthReport['jobs'][number] | null;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function categoryFor(type: PolicyRecommendationType): PolicyRecommendationCategory {
  if (type === 'review_scheduler_reliability') return 'scheduler';
  if (type === 'consider_severity_escalation' || type === 'consider_severity_downgrade') return 'severity';
  if (type === 'review_monitor_frequency') return 'monitoring';
  return 'policy';
}

function defaultLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  const parsed = Math.floor(value ?? fallback);
  return Math.max(1, Math.min(10, parsed));
}

function buildNoChangeReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  const trend = bundle.noisyFamilyTrend?.trendDirection ?? (bundle.breakdown?.topFamily ? 'stable' : 'insufficient');
  const familyLabel = bundle.noisyFamilyLabel ?? 'Noisy source';
  return {
    rationale: `${familyLabel} is currently stable or improving, and the current policy is already sufficient.`,
    suggestedAction: 'No policy change is recommended at this time; keep monitoring the current alert pattern.',
    confidence: trend === 'stable' ? 0.74 : trend === 'improving' ? 0.8 : 0.55,
    limitations: ['Recommendation is conservative because the current signal does not justify a policy change.'],
  };
}

function buildCooldownIncreaseReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  const family = bundle.breakdown?.topFamily;
  return {
    rationale: `${bundle.jobName} shows repeated ${family?.familyLabel?.toLowerCase() ?? 'alert cycles'} with fast recovery, which looks noisy rather than high-risk.`,
    suggestedAction: 'Increase cooldown for this job or family to reduce repeated notifications while keeping critical exceptions intact.',
    confidence: 0.9,
    limitations: ['This recommendation assumes the alert is noisy and not hiding a slower-moving operational issue.'],
  };
}

function buildCooldownDecreaseReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  return {
    rationale: `${bundle.jobName} has sparse but meaningful alerts, and the current cooldown may be too long for timely awareness.`,
    suggestedAction: 'Consider shortening cooldown for this job so important alerts surface sooner.',
    confidence: 0.62,
    limitations: ['This is only appropriate when the alert volume is low but the operational impact is still material.'],
  };
}

function buildSchedulerReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  const familyTrend = bundle.noisyFamilyTrend;
  const familyLabel = bundle.noisyFamilyLabel ?? 'missed/delayed run';
  const direction = familyTrend?.trendDirection ?? 'insufficient';
  return {
    rationale: `The dominant noise source is ${familyLabel.toLowerCase()}, and its trend is ${direction}; this usually points to scheduling or runtime reliability rather than pure policy noise.`,
    suggestedAction: 'Review scheduler timing, job window coverage, and runtime completion to reduce missed or delayed runs.',
    confidence: direction === 'worsening' ? 0.94 : direction === 'oscillating' ? 0.88 : 0.8,
    limitations: ['Do not suppress this pattern until the scheduler / runner path is verified.'],
  };
}

function buildEscalationReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  return {
    rationale: `Critical or unresolved alerts are persisting for ${bundle.jobName}, and the resolve-time distribution shows slow recovery or long tails.`,
    suggestedAction: 'Consider escalating the severity for this family or keeping the current severity with higher operational priority.',
    confidence: 0.88,
    limitations: ['This recommendation is about preserving signal, not increasing notification noise.'],
  };
}

function buildDowngradeReason(bundle: JobAnalyticsBundle): { rationale: string; suggestedAction: string; confidence: number; limitations: string[] } {
  return {
    rationale: `Most alerts for ${bundle.jobName} are low-impact, resolve quickly, and the trend is stable or improving.`,
    suggestedAction: 'Consider lowering the severity of the least impactful warning family, or treat it as info in the future.',
    confidence: 0.66,
    limitations: ['Only downgrade when it is clear the alerts are operationally benign and not masking a later failure mode.'],
  };
}

function buildRecommendationFromBundle(bundle: JobAnalyticsBundle): PolicyRecommendationRow {
  const families = bundle.breakdown?.families ?? [];
  const topFamily = bundle.breakdown?.topFamily ?? families[0] ?? null;
  const trend = bundle.noisyFamilyTrend?.trendDirection ?? 'insufficient';
  const resolveRow = bundle.resolveDistribution?.families.find((family) => family.family === topFamily?.family) ?? bundle.resolveDistribution?.families[0] ?? null;
  const avgResolve = resolveRow?.avgResolveTimeHours ?? topFamily?.avgResolveTimeHours ?? null;
  const unresolvedRatio = resolveRow?.unresolvedRatio ?? null;
  const reoccurRate = topFamily?.reoccurRate ?? null;
  const criticalRatio = topFamily?.criticalRatio ?? null;
  const warningCount = topFamily?.warningCount ?? 0;
  const criticalCount = topFamily?.criticalCount ?? 0;

  const baseLimitations = [
    ...(bundle.breakdown?.limitations ?? []),
    ...(bundle.noisyFamilyTrend?.limitations ?? []),
    ...(bundle.resolveDistribution?.limitations ?? []),
  ];

  const familyName = topFamily?.family ?? null;

  let type: PolicyRecommendationType = 'no_change_recommended';
  let severity: JobAlertSeverity = 'info';
  let rationale = '';
  let suggestedAction = '';
  let confidence = 0.55;
  let limitations = [...baseLimitations];

  const noisyQuickRecovery =
    reoccurRate !== null &&
    reoccurRate >= 0.5 &&
    avgResolve !== null &&
    avgResolve <= 3 &&
    (trend === 'stable' || trend === 'improving');

  const criticalSlowRecovery =
    (criticalRatio !== null && criticalRatio >= 0.5) &&
    (unresolvedRatio !== null && unresolvedRatio >= 0.35) &&
    (avgResolve !== null && avgResolve >= 6);

  const missedWorsening =
    (familyName === 'missed_run' || familyName === 'delayed_run') &&
    (trend === 'worsening' || trend === 'oscillating');

  const monitorFrequencyMismatch =
    (familyName === 'missed_run' || familyName === 'delayed_run') &&
    trend === 'oscillating' &&
    !missedWorsening;

  const consecutiveFailureLongTail =
    familyName === 'consecutive_failure' &&
    (avgResolve !== null && avgResolve >= 6 || unresolvedRatio !== null && unresolvedRatio >= 0.25);

  const warningHeavyQuick =
    warningCount >= Math.max(2, criticalCount * 2) &&
    (avgResolve !== null ? avgResolve <= 2 : false) &&
    (trend === 'stable' || trend === 'improving') &&
    (criticalRatio ?? 0) < 0.25 &&
    (topFamily?.noisyScore ?? 0) >= 8;

  const sparseButMeaningful =
    (topFamily?.count ?? 0) <= 2 &&
    (criticalRatio ?? 0) >= 0.5 &&
    (avgResolve ?? 0) >= 4;

  if (missedWorsening) {
    type = 'review_scheduler_reliability';
    severity = 'critical';
    ({ rationale, suggestedAction, confidence, limitations } = buildSchedulerReason(bundle));
  } else if (monitorFrequencyMismatch) {
    type = 'review_monitor_frequency';
    severity = 'warning';
    rationale = `The ${familyLabelForTop(bundle)} pattern looks bursty and oscillating, which can point to a monitoring cadence mismatch rather than a hard scheduler failure.`;
    suggestedAction = 'Review the monitor cadence and alert window to make sure the job is checked often enough without creating bursty duplicates.';
    confidence = 0.74;
    limitations = [...limitations, 'This recommendation should not be used if the root cause is already known to be a scheduler defect.'];
  } else if (criticalSlowRecovery || consecutiveFailureLongTail) {
    type = 'consider_severity_escalation';
    severity = 'critical';
    ({ rationale, suggestedAction, confidence, limitations } = buildEscalationReason(bundle));
  } else if (noisyQuickRecovery) {
    type = 'cooldown_increase';
    severity = 'warning';
    ({ rationale, suggestedAction, confidence, limitations } = buildCooldownIncreaseReason(bundle));
  } else if (warningHeavyQuick) {
    type = 'consider_severity_downgrade';
    severity = 'warning';
    ({ rationale, suggestedAction, confidence, limitations } = buildDowngradeReason(bundle));
  } else if (sparseButMeaningful) {
    type = 'cooldown_decrease';
    severity = 'warning';
    ({ rationale, suggestedAction, confidence, limitations } = buildCooldownDecreaseReason(bundle));
  } else if (
    (trend === 'stable' || trend === 'improving') &&
    (topFamily?.noisyScore ?? 0) < 12 &&
    (bundle.breakdown?.summary?.source ?? 'empty') !== 'empty'
  ) {
    type = 'no_change_recommended';
    severity = 'info';
    ({ rationale, suggestedAction, confidence, limitations } = buildNoChangeReason(bundle));
  } else if ((bundle.healthRow?.healthStatus === 'delayed' || bundle.healthRow?.healthStatus === 'failed') && familyName == null) {
    type = 'review_monitor_frequency';
    severity = 'warning';
    rationale = `The job health report is degraded and the dominant family could not be isolated clearly for ${bundle.jobName}.`;
    suggestedAction = 'Review monitoring frequency and make sure the job health window matches the job’s expected cadence.';
    confidence = 0.58;
    limitations = [...limitations, 'Recommendation confidence is lower because the family signal is weak.'];
  } else {
    type = 'no_change_recommended';
    severity = 'info';
    ({ rationale, suggestedAction, confidence, limitations } = buildNoChangeReason(bundle));
  }

  return {
    category: categoryFor(type),
    targetJob: bundle.jobName,
    targetFamily: familyName,
    recommendationType: type,
    severity,
    rationale,
    suggestedAction,
    confidence: clampConfidence(confidence),
    limitations,
  };
}

function familyLabelForTop(bundle: JobAnalyticsBundle): string {
  return bundle.noisyFamilyLabel ?? bundle.breakdown?.topFamily?.familyLabel ?? 'Noisy source';
}

function summarizeRecommendations(recommendations: PolicyRecommendationRow[]): PolicyRecommendationSummary {
  const byType = {
    cooldown_increase: 0,
    cooldown_decrease: 0,
    review_monitor_frequency: 0,
    review_scheduler_reliability: 0,
    consider_severity_escalation: 0,
    consider_severity_downgrade: 0,
    no_change_recommended: 0,
  };
  const byCategory = {
    policy: 0,
    scheduler: 0,
    severity: 0,
    monitoring: 0,
  };
  const jobMap = new Map<string, number>();
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const recommendation of recommendations) {
    byType[recommendation.recommendationType] += 1;
    byCategory[recommendation.category] += 1;
    if (recommendation.severity === 'critical') critical += 1;
    else if (recommendation.severity === 'warning') warning += 1;
    else info += 1;
    jobMap.set(recommendation.targetJob, (jobMap.get(recommendation.targetJob) ?? 0) + 1);
  }

  return {
    total: recommendations.length,
    critical,
    warning,
    info,
    byType,
    byCategory,
    jobCount: jobMap.size,
    topJobs: [...jobMap.entries()]
      .map(([jobName, recommendationCount]) => ({ jobName, recommendationCount }))
      .sort((left, right) => right.recommendationCount - left.recommendationCount),
  };
}

export class PolicyRecommendationEngine {
  constructor(
    private readonly historyService = new JobAlertHistoryService(),
    private readonly breakdownService = new NoisySourceBreakdownService(),
    private readonly familyTrendService = new FamilyTrendService(),
    private readonly resolveDistributionService = new ResolveTimeDistributionService(),
    private readonly healthService = new JobHealthService(),
    private readonly policyLoader = loadAutonomousAlertPolicyState,
  ) {}

  async build(input: PolicyRecommendationInput = {}): Promise<PolicyRecommendationResult> {
    const now = input.now ?? new Date();
    const limit = defaultLimit(input.limit, 5);
    const historySummary = await this.historyService.buildSummary({ days: 14 }, now);
    const jobHealth = await this.healthService.evaluate(now);
    const policyState = await this.policyLoader().catch(() => null);
    const failedJobs = jobHealth.jobs.filter((job) => job.healthStatus === 'failed').map((job) => job.jobName);
    const missedJobs = jobHealth.jobs.filter((job) => job.missed).map((job) => job.jobName);
    const neverRanJobs = jobHealth.jobs.filter((job) => job.status === 'never-ran').map((job) => job.jobName);

    const candidateJobs = input.jobName
      ? [input.jobName]
      : [
          ...historySummary.topNoisyJobs.map((item) => item.jobName),
          ...failedJobs,
          ...missedJobs,
          ...neverRanJobs,
        ];

    const targetJobs = Array.from(new Set(candidateJobs)).slice(0, limit);

    const bundles: JobAnalyticsBundle[] = [];
    for (const jobName of targetJobs) {
      const [breakdown, familyTrend, resolveDistribution] = await Promise.all([
        this.breakdownService.build(jobName, 30, now).catch(() => null),
        this.familyTrendService.build(jobName, '14d', 'day', now).catch(() => null),
        this.resolveDistributionService.build(jobName, 30, now).catch(() => null),
      ]);
      const healthRow = jobHealth.jobs.find((job) => job.jobName === jobName) ?? null;
      const noisyFamily = breakdown?.topFamily?.family ?? null;
      const noisyFamilyLabel = breakdown?.topFamily?.familyLabel ?? null;
      const noisyFamilyTrend = noisyFamily
        ? familyTrend?.families.find((family) => family.family === noisyFamily) ?? familyTrend?.families[0] ?? null
        : familyTrend?.families[0] ?? null;

      bundles.push({
        jobName,
        noisyFamily,
        noisyFamilyLabel,
        noisyFamilyTrend,
        resolveDistribution,
        breakdown,
        healthRow,
      });
    }

    let recommendations = bundles.map((bundle) => buildRecommendationFromBundle(bundle));
    if (input.severity) {
      recommendations = recommendations.filter((recommendation) => recommendation.severity === input.severity);
    }

    const summary = summarizeRecommendations(recommendations);
    const limitations = [
      ...(historySummary.total === 0 ? ['No alert history was available, so recommendations are limited.'] : []),
      ...(jobHealth.jobs.length === 0 ? ['No job health data was available.'] : []),
      ...(recommendations.length === 0 ? ['No actionable recommendation could be derived from the current signal.'] : []),
      'Recommendations are advisory only and are not auto-applied to policy settings.',
      ...(policyState?.limitations ?? []),
    ];

    return {
      recommendations,
      summary,
      policy: policyState ?? {
        source: 'default',
        config: {
          severityCooldownHours: { critical: 2, warning: 12, info: 0 },
          jobCooldownOverrides: { 'autonomous:monitor': { critical: 1, warning: 1 } },
          infoNotificationEnabled: false,
          escalationEnabled: true,
          recoveryResetEnabled: true,
        },
        summary: {
          defaults: {
            severityCooldownHours: { critical: 2, warning: 12, info: 0 },
            infoNotificationEnabled: false,
            escalationEnabled: true,
            recoveryResetEnabled: true,
          },
          jobOverrides: { 'autonomous:monitor': { critical: 1, warning: 1 } },
          infoNotificationEnabled: false,
          escalationEnabled: true,
          recoveryResetEnabled: true,
        },
        defaults: {
          severityCooldownHours: { critical: 2, warning: 12, info: 0 },
          jobCooldownOverrides: { 'autonomous:monitor': { critical: 1, warning: 1 } },
          infoNotificationEnabled: false,
          escalationEnabled: true,
          recoveryResetEnabled: true,
        },
        updatedAt: null,
        limitations: ['Using default autonomous alert policy settings.'],
      },
      generatedAt: now.toISOString(),
      limitations,
    };
  }
}
