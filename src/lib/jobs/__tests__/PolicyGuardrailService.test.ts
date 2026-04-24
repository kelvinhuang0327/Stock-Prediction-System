import { PolicyGuardrailService } from '../PolicyGuardrailService';
import type { AutonomousAlertPolicyState } from '../AutonomousAlertPolicyStore';
import type { PolicyRecommendationResult } from '../PolicyRecommendationEngine';
import type { PolicyRollbackHintResult } from '../PolicyRollbackHintService';
import type { RecommendationPolicyExplanationResult } from '../RecommendationPolicyExplanationService';

function makeCurrentPolicy(): AutonomousAlertPolicyState {
  return {
    source: 'persisted',
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
    updatedAt: '2026-04-01T00:00:00.000Z',
    limitations: [],
  };
}

function makeRecommendations(overrides: Partial<PolicyRecommendationResult> = {}): PolicyRecommendationResult {
  return {
    recommendations: [
      {
        category: 'policy',
        targetJob: 'autonomous:monitor',
        targetFamily: 'missed_run',
        recommendationType: 'cooldown_increase',
        severity: 'warning',
        rationale: 'noisy',
        suggestedAction: 'Increase cooldown',
        confidence: 0.9,
        limitations: [],
      },
      {
        category: 'scheduler',
        targetJob: 'autonomous:daily',
        targetFamily: 'missed_run',
        recommendationType: 'review_scheduler_reliability',
        severity: 'critical',
        rationale: 'scheduler instability',
        suggestedAction: 'Check scheduler',
        confidence: 0.95,
        limitations: [],
      },
    ],
    summary: {
      total: 2,
      critical: 1,
      warning: 1,
      info: 0,
      byType: {
        cooldown_increase: 1,
        cooldown_decrease: 0,
        review_monitor_frequency: 0,
        review_scheduler_reliability: 1,
        consider_severity_escalation: 0,
        consider_severity_downgrade: 0,
        no_change_recommended: 0,
      },
      byCategory: {
        policy: 1,
        scheduler: 1,
        severity: 0,
        monitoring: 0,
      },
      jobCount: 2,
      topJobs: [{ jobName: 'autonomous:monitor', recommendationCount: 1 }],
    },
    policy: makeCurrentPolicy(),
    generatedAt: '2026-04-01T00:00:00.000Z',
    limitations: [],
    ...overrides,
  };
}

function makeRollbackHints(): PolicyRollbackHintResult {
  return {
    hints: [
      {
        change: {
          id: 1,
          policyKey: 'autonomous_alert_policy_v1',
          changedAt: '2026-03-30T12:00:00.000Z',
          changedBy: 'manual',
          oldValue: '{}',
          newValue: '{}',
          changedFields: ['severityCooldownHours.critical'],
          reason: 'manual_settings_update',
          metadata: null,
          createdAt: '2026-03-30T12:00:00.000Z',
          updatedAt: '2026-03-30T12:00:00.000Z',
        },
        windowDays: 14,
        hintType: 'consider_rollback',
        rationale: 'risky suppression',
        evidence: ['Alert count ↓', 'Critical ratio ↑'],
        confidence: 0.88,
        limitations: [],
        auditResult: 'worsened',
        before: {
          alertCount: 10,
          activeAlerts: 3,
          criticalCount: 4,
          criticalRatio: 0.4,
          reoccurCount: 4,
          reoccurRate: 0.4,
          avgResolveTimeHours: 5,
          recommendationCount: 4,
          activeRecommendations: 2,
          recommendationResolvedCount: 2,
        },
        after: {
          alertCount: 6,
          activeAlerts: 4,
          criticalCount: 4,
          criticalRatio: 0.66,
          reoccurCount: 3,
          reoccurRate: 0.5,
          avgResolveTimeHours: 7,
          recommendationCount: 3,
          activeRecommendations: 2,
          recommendationResolvedCount: 1,
        },
        chart: {
          change: null,
          timeline: [],
          metrics: {
            alertCount: {
              beforeAvg: 10,
              afterAvg: 6,
              trend: 'down',
              impact: 'improving',
              magnitude: 'medium',
              delta: -4,
              deltaPct: -0.4,
            },
            criticalRatio: {
              beforeAvg: 0.4,
              afterAvg: 0.66,
              trend: 'up',
              impact: 'worsening',
              magnitude: 'large',
              delta: 0.26,
              deltaPct: 0.65,
            },
            reoccurRate: {
              beforeAvg: 0.4,
              afterAvg: 0.5,
              trend: 'up',
              impact: 'worsening',
              magnitude: 'small',
              delta: 0.1,
              deltaPct: 0.25,
            },
            avgResolveTime: {
              beforeAvg: 5,
              afterAvg: 7,
              trend: 'up',
              impact: 'worsening',
              magnitude: 'medium',
              delta: 2,
              deltaPct: 0.4,
            },
            recommendationCount: {
              beforeAvg: 4,
              afterAvg: 3,
              trend: 'down',
              impact: 'improving',
              magnitude: 'small',
              delta: -1,
              deltaPct: -0.25,
            },
          },
          changePoint: null,
          windowDays: 14,
          beforeWindowLabel: 'before',
          afterWindowLabel: 'after',
          limitations: [],
          generatedAt: '2026-04-01T00:00:00.000Z',
        },
      },
    ],
    summary: {
      total: 1,
      keepChange: 0,
      reviewChange: 0,
      considerRollback: 1,
      insufficientEvidence: 0,
      topJobs: [{ jobName: 'autonomous:monitor', hintCount: 1 }],
    },
    limitations: [],
    generatedAt: '2026-04-01T00:00:00.000Z',
  };
}

function makeExplanations(): RecommendationPolicyExplanationResult {
  return {
    policy: makeCurrentPolicy(),
    explanations: [
      {
        recommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
        recommendationType: 'cooldown_increase',
        targetJob: 'autonomous:monitor',
        targetFamily: 'missed_run',
        severity: 'warning',
        rationaleSummary: 'noise heavy',
        evidence: [],
        suggestedAction: 'Increase cooldown',
        confidence: 0.9,
        status: 'active',
        lastSeenAt: '2026-04-01T00:00:00.000Z',
        relatedTrendDirection: 'stable',
        relatedLifecycleSummary: 'active',
        limitations: [],
      },
      {
        recommendationKey: 'review_scheduler_reliability|autonomous:daily|missed_run',
        recommendationType: 'review_scheduler_reliability',
        targetJob: 'autonomous:daily',
        targetFamily: 'missed_run',
        severity: 'critical',
        rationaleSummary: 'scheduler issue',
        evidence: [],
        suggestedAction: 'Review scheduler',
        confidence: 0.95,
        status: 'active',
        lastSeenAt: '2026-04-01T00:00:00.000Z',
        relatedTrendDirection: 'worsening',
        relatedLifecycleSummary: 'active',
        limitations: [],
      },
    ],
    summary: {
      total: 2,
      critical: 1,
      warning: 1,
      info: 0,
      byType: {
        cooldown_increase: 1,
        cooldown_decrease: 0,
        review_monitor_frequency: 0,
        review_scheduler_reliability: 1,
        consider_severity_escalation: 0,
        consider_severity_downgrade: 0,
        no_change_recommended: 0,
      },
      topJobs: [{ jobName: 'autonomous:monitor', explanationCount: 1 }],
    },
    limitations: [],
    generatedAt: '2026-04-01T00:00:00.000Z',
  };
}

describe('PolicyGuardrailService', () => {
  test('flags critical guardrails for overly long critical cooldown and disabled escalation', async () => {
    const service = new PolicyGuardrailService();
    const result = await service.build({
      currentPolicy: makeCurrentPolicy(),
      proposedPolicy: {
        severityCooldownHours: { critical: 18, warning: 40, info: 0 },
        jobCooldownOverrides: { 'autonomous:monitor': { critical: 0.25, warning: 0.25 } },
        infoNotificationEnabled: true,
        escalationEnabled: false,
        recoveryResetEnabled: false,
      },
      currentRecommendations: makeRecommendations(),
      rollbackHints: makeRollbackHints(),
      policyExplanations: makeExplanations(),
      now: new Date('2026-04-04T00:00:00.000Z'),
    });

    expect(result.summary.requiresConfirmation).toBe(true);
    expect(result.guardrails.some((item) => item.ruleKey === 'critical_cooldown_too_long')).toBe(true);
    expect(result.guardrails.some((item) => item.ruleKey === 'escalation_disabled')).toBe(true);
    expect(result.guardrails.some((item) => item.ruleKey === 'rollback_hint_conflict')).toBe(true);
  });

  test('flags warning guardrails for info notification and monitor override changes', async () => {
    const service = new PolicyGuardrailService();
    const result = await service.build({
      currentPolicy: makeCurrentPolicy(),
      proposedPolicy: {
        severityCooldownHours: { critical: 3, warning: 16, info: 0.5 },
        jobCooldownOverrides: { 'autonomous:monitor': { critical: 0.4, warning: 0.4 } },
        infoNotificationEnabled: true,
        escalationEnabled: true,
        recoveryResetEnabled: true,
      },
      currentRecommendations: makeRecommendations({
        recommendations: [
          {
            category: 'policy',
            targetJob: 'autonomous:monitor',
            targetFamily: 'missed_run',
            recommendationType: 'cooldown_increase',
            severity: 'warning',
            rationale: 'noise',
            suggestedAction: 'Increase cooldown',
            confidence: 0.9,
            limitations: [],
          },
        ],
      }),
      rollbackHints: null,
      policyExplanations: null,
      now: new Date('2026-04-04T00:00:00.000Z'),
    });

    expect(result.summary.requiresConfirmation).toBe(true);
    expect(result.guardrails.some((item) => item.ruleKey === 'info_notify_short_cooldown')).toBe(true);
    expect(result.guardrails.some((item) => item.ruleKey === 'monitor_override_too_short')).toBe(true);
  });

  test('returns only advisory or informational guardrails for a mild policy', async () => {
    const service = new PolicyGuardrailService();
    const result = await service.build({
      currentPolicy: makeCurrentPolicy(),
      proposedPolicy: {
        severityCooldownHours: { critical: 2, warning: 12, info: 0 },
        jobCooldownOverrides: { 'autonomous:monitor': { critical: 1, warning: 1 } },
        infoNotificationEnabled: false,
        escalationEnabled: true,
        recoveryResetEnabled: true,
      },
      currentRecommendations: null,
      rollbackHints: null,
      policyExplanations: null,
      now: new Date('2026-04-04T00:00:00.000Z'),
    });

    expect(result.summary.critical).toBe(0);
    expect(result.summary.warning).toBe(0);
    expect(result.summary.info).toBeGreaterThanOrEqual(0);
  });
});
