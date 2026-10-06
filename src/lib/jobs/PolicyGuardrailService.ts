import type { AutonomousAlertPolicyConfig, AutonomousAlertPolicyState } from './AutonomousAlertPolicyStore';
import type { PolicyRecommendationResult, PolicyRecommendationType } from './PolicyRecommendationEngine';
import type { PolicyRollbackHintResult } from './PolicyRollbackHintService';
import type { RecommendationPolicyExplanationResult } from './RecommendationPolicyExplanationService';

export type PolicyGuardrailSeverity = 'info' | 'warning' | 'critical';

export interface PolicyGuardrailRow {
  severity: PolicyGuardrailSeverity;
  ruleKey: string;
  title: string;
  message: string;
  rationale: string;
  suggestedCheck: string;
}

export interface PolicyGuardrailSummary {
  total: number;
  info: number;
  warning: number;
  critical: number;
  requiresConfirmation: boolean;
}

export interface PolicyGuardrailResult {
  guardrails: PolicyGuardrailRow[];
  summary: PolicyGuardrailSummary;
  limitations: string[];
  generatedAt: string;
}

export interface PolicyGuardrailInput {
  currentPolicy: AutonomousAlertPolicyState;
  proposedPolicy: Partial<AutonomousAlertPolicyConfig>;
  currentRecommendations?: Pick<PolicyRecommendationResult, 'recommendations' | 'summary'> | null;
  rollbackHints?: Pick<PolicyRollbackHintResult, 'hints' | 'summary'> | null;
  policyExplanations?: Pick<RecommendationPolicyExplanationResult, 'explanations' | 'summary'> | null;
  now?: Date;
}

interface GuardrailContext {
  current: AutonomousAlertPolicyConfig;
  proposed: AutonomousAlertPolicyConfig;
  recommendations: Pick<PolicyRecommendationResult, 'recommendations' | 'summary'> | null;
  rollbackHints: Pick<PolicyRollbackHintResult, 'hints' | 'summary'> | null;
  explanations: Pick<RecommendationPolicyExplanationResult, 'explanations' | 'summary'> | null;
  now: Date;
}

const DEFAULT_OUTPUT_LIMITATIONS = [
  'Policy guardrails are advisory only and do not automatically block saving.',
  'Guardrails use the current alert / recommendation snapshot, so very recent changes may not be fully reflected.',
];

function countByType(
  items: Array<{ recommendationType: PolicyRecommendationType }>,
): Record<PolicyRecommendationType, number> {
  return {
    cooldown_increase: items.filter((item) => item.recommendationType === 'cooldown_increase').length,
    cooldown_decrease: items.filter((item) => item.recommendationType === 'cooldown_decrease').length,
    review_monitor_frequency: items.filter((item) => item.recommendationType === 'review_monitor_frequency').length,
    review_scheduler_reliability: items.filter((item) => item.recommendationType === 'review_scheduler_reliability').length,
    consider_severity_escalation: items.filter((item) => item.recommendationType === 'consider_severity_escalation').length,
    consider_severity_downgrade: items.filter((item) => item.recommendationType === 'consider_severity_downgrade').length,
    no_change_recommended: items.filter((item) => item.recommendationType === 'no_change_recommended').length,
  };
}

function makeGuardrail(
  guardrails: PolicyGuardrailRow[],
  severity: PolicyGuardrailSeverity,
  ruleKey: string,
  title: string,
  message: string,
  rationale: string,
  suggestedCheck: string,
): void {
  guardrails.push({
    severity,
    ruleKey,
    title,
    message,
    rationale,
    suggestedCheck,
  });
}

function buildCooldownGuardrails(ctx: GuardrailContext, guardrails: PolicyGuardrailRow[]): void {
  const currentCritical = ctx.current.severityCooldownHours.critical;
  const currentWarning = ctx.current.severityCooldownHours.warning;
  const proposedCritical = ctx.proposed.severityCooldownHours.critical;
  const proposedWarning = ctx.proposed.severityCooldownHours.warning;
  const proposedInfo = ctx.proposed.severityCooldownHours.info;

  if (proposedCritical > Math.max(12, currentCritical * 4)) {
    makeGuardrail(
      guardrails,
      'critical',
      'critical_cooldown_too_long',
      'Critical cooldown looks too long',
      `Critical cooldown would move from ${currentCritical}h to ${proposedCritical}h.`,
      'This may delay important alerts long enough to hide a real operational issue.',
      'Confirm that critical alerts still need to surface within an operationally short window.',
    );
  } else if (proposedCritical > Math.max(6, currentCritical * 2.5)) {
    makeGuardrail(
      guardrails,
      'warning',
      'critical_cooldown_expanded',
      'Critical cooldown is expanding',
      `Critical cooldown would move from ${currentCritical}h to ${proposedCritical}h.`,
      'A wider critical window can reduce noise, but it may also delay high-signal alerts.',
      'Check whether the proposed cooldown still matches the acceptable response window.',
    );
  }

  if (proposedWarning > Math.max(24, proposedCritical * 8)) {
    makeGuardrail(
      guardrails,
      'critical',
      'warning_cooldown_far_too_long',
      'Warning cooldown is far above the critical window',
      `Warning cooldown would move from ${currentWarning}h to ${proposedWarning}h.`,
      'This gap is large enough that warning-level signals may disappear for too long.',
      'Confirm that warning alerts should remain visible across a much longer window than critical alerts.',
    );
  } else if (proposedWarning > Math.max(12, proposedCritical * 4)) {
    makeGuardrail(
      guardrails,
      'warning',
      'warning_cooldown_too_long',
      'Warning cooldown may be too long',
      `Warning cooldown would move from ${currentWarning}h to ${proposedWarning}h.`,
      'Long warning cooldowns can make the signal look quieter than it really is.',
      'Check whether warning alerts still need to be surfaced within the current review cadence.',
    );
  }

  const infoEnabled = Boolean(ctx.proposed.infoNotificationEnabled);
  if (infoEnabled) {
    if (proposedInfo <= 0.25) {
      makeGuardrail(
        guardrails,
        'critical',
        'info_notify_too_frequent',
        'Info notifications are effectively unthrottled',
        `Info notifications are enabled with a ${proposedInfo}h cooldown.`,
        'Info alerts at this cadence are likely to create unnecessary noise.',
        'Consider turning info notifications off or lengthening the info cooldown.',
      );
    } else if (proposedInfo < 2) {
      makeGuardrail(
        guardrails,
        'warning',
        'info_notify_short_cooldown',
        'Info notifications may still be noisy',
        `Info notifications are enabled with a ${proposedInfo}h cooldown.`,
        'A short info cooldown can create repeated low-priority notifications.',
        'Check whether info-level alerts need to be delivered that frequently.',
      );
    } else if (proposedInfo > 24) {
      makeGuardrail(
        guardrails,
        'warning',
        'info_notify_stale',
        'Info notifications may be too delayed',
        `Info notifications are enabled with a ${proposedInfo}h cooldown.`,
        'A very long info cooldown can make the channel feel stale and less useful.',
        'Confirm whether info alerts are meant to stay in a long review window.',
      );
    }
  }
}

function buildToggleGuardrails(ctx: GuardrailContext, guardrails: PolicyGuardrailRow[]): void {
  const recommendationCounts = countByType(ctx.recommendations?.recommendations ?? []);
  const explanationCounts = countByType(ctx.explanations?.explanations ?? []);
  const rollbackConsidered = ctx.rollbackHints?.summary.considerRollback ?? 0;
  const strongSchedulerSignals =
    recommendationCounts.review_scheduler_reliability > 0 || explanationCounts.review_scheduler_reliability > 0;
  const escalationSignals =
    recommendationCounts.consider_severity_escalation > 0 || explanationCounts.consider_severity_escalation > 0;
  const downgradeSignals =
    recommendationCounts.consider_severity_downgrade > 0 || explanationCounts.consider_severity_downgrade > 0;
  const cooldownNoiseSignals =
    recommendationCounts.cooldown_increase > 0 || explanationCounts.cooldown_increase > 0;

  if (!ctx.proposed.escalationEnabled) {
    makeGuardrail(
      guardrails,
      escalationSignals ? 'critical' : 'warning',
      'escalation_disabled',
      'Escalation is turned off',
      'Severity escalation is disabled in the proposed policy.',
      escalationSignals
        ? 'Current recommendations indicate that some signals deserve higher severity, so disabling escalation may hide an important risk.'
        : 'Even if the current signal is not severe, disabling escalation removes an important safety valve for future issues.',
      'Confirm that the current alert families do not need a path to escalate when they become more serious.',
    );
  }

  if (!ctx.proposed.recoveryResetEnabled) {
    makeGuardrail(
      guardrails,
      rollbackConsidered > 0 || cooldownNoiseSignals ? 'warning' : 'info',
      'recovery_reset_disabled',
      'Recovery reset is turned off',
      'Resolved alerts will no longer auto-reset in the proposed policy.',
      'This can keep previously healed signals looking active and make lifecycle recovery harder to see.',
      'Confirm that alert recovery should stay manual for this policy.',
    );
  }

  if (ctx.proposed.infoNotificationEnabled && !ctx.current.infoNotificationEnabled) {
    makeGuardrail(
      guardrails,
      'warning',
      'info_notify_enabled',
      'Info notifications are enabled',
      'The proposed policy turns on info notifications.',
      'This is useful only if the extra low-priority volume is intentional and reviewed often enough.',
      'Check whether the info channel is ready for higher notification volume.',
    );
  }

  if (strongSchedulerSignals && (ctx.proposed.severityCooldownHours.critical > ctx.current.severityCooldownHours.critical * 1.25 || ctx.proposed.severityCooldownHours.warning > ctx.current.severityCooldownHours.warning * 1.25)) {
    makeGuardrail(
      guardrails,
      'warning',
      'scheduler_signal_masked',
      'Scheduler-related signals may be getting masked',
      'Current recommendations point to scheduler or monitor cadence issues, but the proposed policy mainly widens cooldowns.',
      'If the root cause is scheduling reliability, changing cooldown alone may only hide the symptom.',
      'Review the scheduler / monitor path before relying on a wider cooldown to absorb the noise.',
    );
  }

  if (downgradeSignals && ctx.proposed.severityCooldownHours.warning > ctx.current.severityCooldownHours.warning) {
    makeGuardrail(
      guardrails,
      'warning',
      'severity_downgrade_conflict',
      'A downgrade recommendation is already present',
      'Current recommendations already include severity downgrade pressure, but the proposed policy keeps warning alerts at a longer cadence.',
      'This may be fine, but it should be checked so the policy does not over-suppress a still-useful signal.',
      'Confirm that the warning family is truly benign before extending suppression further.',
    );
  }

  if (rollbackConsidered > 0 && ctx.proposed.severityCooldownHours.critical > ctx.current.severityCooldownHours.critical * 1.25) {
    makeGuardrail(
      guardrails,
      'critical',
      'rollback_hint_conflict',
      'Rollback hints already show risk',
      'Current rollback hints already lean toward review or rollback, but the proposed change makes suppression stronger.',
      'That combination often means the change is masking symptoms rather than improving the system.',
      'Recheck the latest rollback hints before making the policy less sensitive.',
    );
  }
}

function buildMonitorOverrideGuardrails(ctx: GuardrailContext, guardrails: PolicyGuardrailRow[]): void {
  const override = ctx.proposed.jobCooldownOverrides['autonomous:monitor'] ?? null;
  if (!override) return;

  const current = ctx.current.jobCooldownOverrides['autonomous:monitor'] ?? {};
  const currentCritical = current.critical ?? ctx.current.severityCooldownHours.critical;
  const currentWarning = current.warning ?? ctx.current.severityCooldownHours.warning;

  if (override.critical !== undefined) {
    if (override.critical <= Math.max(0.25, currentCritical * 0.5)) {
      makeGuardrail(
        guardrails,
        'critical',
        'monitor_override_too_short',
        'Monitor critical override is too short',
        `autonomous:monitor critical override would move from ${currentCritical}h to ${override.critical}h.`,
        'A very short monitor override can create repeated notifications and reduce signal quality.',
        'Check whether the monitor job truly needs this much more frequent critical alerting.',
      );
    } else if (override.critical >= Math.max(6, currentCritical * 4)) {
      makeGuardrail(
        guardrails,
        'warning',
        'monitor_override_too_long',
        'Monitor critical override is too long',
        `autonomous:monitor critical override would move from ${currentCritical}h to ${override.critical}h.`,
        'A very long monitor override can delay important signals even when the global policy is tighter.',
        'Confirm the monitor cadence still matches the expected runtime window.',
      );
    }
  }

  if (override.warning !== undefined) {
    if (override.warning <= Math.max(0.25, currentWarning * 0.5)) {
      makeGuardrail(
        guardrails,
        'warning',
        'monitor_warning_override_too_short',
        'Monitor warning override is short',
        `autonomous:monitor warning override would move from ${currentWarning}h to ${override.warning}h.`,
        'This can still be okay, but it may create warning-level noise if the job is bursty.',
        'Check whether warning alerts for the monitor job are expected to arrive this frequently.',
      );
    } else if (override.warning >= Math.max(6, currentWarning * 4)) {
      makeGuardrail(
        guardrails,
        'warning',
        'monitor_warning_override_too_long',
        'Monitor warning override is long',
        `autonomous:monitor warning override would move from ${currentWarning}h to ${override.warning}h.`,
        'This may be appropriate for a low-noise job, but it can also hide bursts of warnings for too long.',
        'Confirm the monitor job still needs a long warning window.',
      );
    }
  }
}

function buildRecommendationConflictGuardrails(ctx: GuardrailContext, guardrails: PolicyGuardrailRow[]): void {
  const recommendationCounts = countByType(ctx.recommendations?.recommendations ?? []);
  const latestHint = ctx.rollbackHints?.hints?.[0] ?? null;
  const isRollbackRisk = latestHint?.hintType === 'consider_rollback';

  if (recommendationCounts.cooldown_increase > 0 && ctx.proposed.severityCooldownHours.critical < ctx.current.severityCooldownHours.critical * 0.75) {
    makeGuardrail(
      guardrails,
      'critical',
      'cooldown_recommendation_conflict',
      'Current recommendations point the other way',
      'The current recommendation set leans toward increasing cooldown, but the proposed policy shortens critical cooldown.',
      'That usually means the proposed change is more likely to reintroduce noise than to improve signal quality.',
      'Reconcile the proposed cooldown with the latest noisy-source recommendations before saving.',
    );
  }

  if (recommendationCounts.review_scheduler_reliability > 0 && ctx.proposed.severityCooldownHours.warning > ctx.current.severityCooldownHours.warning * 1.1) {
    makeGuardrail(
      guardrails,
      'warning',
      'scheduler_recommendation_conflict',
      'Scheduler recommendations are still active',
      'Current recommendations say the scheduler / monitor path needs review, but the proposed policy mainly widens the warning window.',
      'This can reduce noise, but it does not address the scheduling issue itself.',
      'Review the scheduler path before relying on a wider warning cooldown to absorb alerts.',
    );
  }

  if (recommendationCounts.consider_severity_escalation > 0 && !ctx.proposed.escalationEnabled) {
    makeGuardrail(
      guardrails,
      'critical',
      'escalation_recommendation_conflict',
      'Escalation is recommended but disabled',
      'Current recommendations still suggest that some alerts deserve stronger severity handling.',
      'Turning escalation off may hide a risk that the analytics layer is trying to preserve.',
      'Reconfirm whether any active family still needs severity escalation before disabling it.',
    );
  }

  if (isRollbackRisk && (ctx.proposed.severityCooldownHours.critical > ctx.current.severityCooldownHours.critical || !ctx.proposed.recoveryResetEnabled)) {
    makeGuardrail(
      guardrails,
      'critical',
      'rollback_hint_conflict',
      'Rollback hint already warns about the current direction',
      'The latest rollback hint already points to a riskier suppression pattern, and the proposed policy goes further in that direction.',
      'This increases the chance that the policy will suppress symptoms instead of improving the underlying issue.',
      'Review the latest rollback hint before applying a more suppressive policy.',
    );
  }
}

export class PolicyGuardrailService {
  async build(input: PolicyGuardrailInput): Promise<PolicyGuardrailResult> {
    const now = input.now ?? new Date();
    const current = input.currentPolicy.config;
    const proposed = this.normalizeProposed(current, input.proposedPolicy);
    const context: GuardrailContext = {
      current,
      proposed,
      recommendations: input.currentRecommendations ?? null,
      rollbackHints: input.rollbackHints ?? null,
      explanations: input.policyExplanations ?? null,
      now,
    };

    const guardrails: PolicyGuardrailRow[] = [];
    buildCooldownGuardrails(context, guardrails);
    buildToggleGuardrails(context, guardrails);
    buildMonitorOverrideGuardrails(context, guardrails);
    buildRecommendationConflictGuardrails(context, guardrails);

    const summary: PolicyGuardrailSummary = {
      total: guardrails.length,
      info: guardrails.filter((row) => row.severity === 'info').length,
      warning: guardrails.filter((row) => row.severity === 'warning').length,
      critical: guardrails.filter((row) => row.severity === 'critical').length,
      requiresConfirmation: guardrails.some((row) => row.severity === 'critical'),
    };

    const limitations = [
      ...DEFAULT_OUTPUT_LIMITATIONS,
      ...(input.currentRecommendations ? [] : ['Current recommendations were not available, so some conflict checks were conservative.']),
      ...(input.rollbackHints ? [] : ['Rollback hints were not available, so only static guardrails were applied.']),
      ...(input.policyExplanations ? [] : ['Policy explanations were not available, so explanation-aware checks were limited.']),
    ];

    return {
      guardrails,
      summary,
      limitations,
      generatedAt: now.toISOString(),
    };
  }

  private normalizeProposed(
    current: AutonomousAlertPolicyConfig,
    proposed: Partial<AutonomousAlertPolicyConfig>,
  ): AutonomousAlertPolicyConfig {
    const merged: AutonomousAlertPolicyConfig = {
      severityCooldownHours: {
        critical: proposed.severityCooldownHours?.critical ?? current.severityCooldownHours.critical,
        warning: proposed.severityCooldownHours?.warning ?? current.severityCooldownHours.warning,
        info: proposed.severityCooldownHours?.info ?? current.severityCooldownHours.info,
      },
      jobCooldownOverrides: {
        ...current.jobCooldownOverrides,
        ...(proposed.jobCooldownOverrides ?? {}),
      },
      infoNotificationEnabled: proposed.infoNotificationEnabled ?? current.infoNotificationEnabled,
      escalationEnabled: proposed.escalationEnabled ?? current.escalationEnabled,
      recoveryResetEnabled: proposed.recoveryResetEnabled ?? current.recoveryResetEnabled,
    };

    return merged;
  }
}
