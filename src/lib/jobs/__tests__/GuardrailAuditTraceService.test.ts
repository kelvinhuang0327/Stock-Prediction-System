import { GuardrailAuditTraceService } from '../GuardrailAuditTraceService';
import type { PolicyAuditTrailResult } from '../PolicyAuditTrailService';
import type { PolicyRollbackHintResult } from '../PolicyRollbackHintService';

function makeChange(overrides: Partial<PolicyAuditTrailResult['changes'][number]> = {}): PolicyAuditTrailResult['changes'][number] {
  return {
    id: 1,
    policyKey: 'autonomous_alert_policy_v1',
    changedAt: '2026-04-01T12:00:00.000Z',
    changedBy: 'manual',
    oldValue: '{}',
    newValue: '{}',
    changedFields: ['severityCooldownHours.critical'],
    reason: 'manual_settings_update',
    guardrailCount: 1,
    guardrailSummary: {
      total: 1,
      info: 0,
      warning: 0,
      critical: 1,
      requiresConfirmation: true,
    },
    requiresConfirmation: true,
    guardrailDetails: [
      {
        severity: 'critical',
        ruleKey: 'critical_cooldown_too_long',
        title: 'Critical cooldown looks too long',
        message: 'Critical cooldown would move from 2h to 12h.',
        rationale: 'This may delay important alerts.',
        suggestedCheck: 'Confirm response window.',
      },
    ],
    highestGuardrailSeverity: 'critical',
    metadata: JSON.stringify({ source: 'settings_ui' }),
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeAudit(
  overrides: Partial<PolicyAuditTrailResult['audits'][number]> = {},
): PolicyAuditTrailResult['audits'][number] {
  return {
    change: makeChange(),
    windowDays: 14,
    before: {
      alertCount: 10,
      activeAlerts: 4,
      criticalCount: 3,
      criticalRatio: 0.3,
      reoccurCount: 4,
      reoccurRate: 0.4,
      avgResolveTimeHours: 10,
      recommendationCount: 5,
      activeRecommendations: 2,
      recommendationResolvedCount: 1,
    },
    after: {
      alertCount: 4,
      activeAlerts: 1,
      criticalCount: 1,
      criticalRatio: 0.25,
      reoccurCount: 1,
      reoccurRate: 0.25,
      avgResolveTimeHours: 5,
      recommendationCount: 2,
      activeRecommendations: 1,
      recommendationResolvedCount: 1,
    },
    result: 'improved',
    evidence: [],
    summary: 'ok',
    limitations: [],
    ...overrides,
  };
}

function makeHint(
  overrides: Partial<PolicyRollbackHintResult['hints'][number]> = {},
): PolicyRollbackHintResult['hints'][number] {
  return {
    change: makeChange(),
    windowDays: 14,
    hintType: 'keep_change',
    rationale: 'The change appears to reduce alert noise without pushing critical risk higher.',
    evidence: ['Alert count ↓', 'Resolve time ↓'],
    confidence: 0.85,
    limitations: [],
    auditResult: 'improved',
    before: makeAudit().before,
    after: makeAudit().after,
    chart: {
      change: null,
      timeline: [],
      metrics: {
        alertCount: {
          beforeAvg: 10,
          afterAvg: 4,
          trend: 'down',
          impact: 'improving',
          magnitude: 'large',
          delta: -6,
          deltaPct: -0.6,
        },
        criticalRatio: {
          beforeAvg: 0.3,
          afterAvg: 0.25,
          trend: 'down',
          impact: 'improving',
          magnitude: 'small',
          delta: -0.05,
          deltaPct: -0.1666666667,
        },
        reoccurRate: {
          beforeAvg: 0.4,
          afterAvg: 0.25,
          trend: 'down',
          impact: 'improving',
          magnitude: 'medium',
          delta: -0.15,
          deltaPct: -0.375,
        },
        avgResolveTime: {
          beforeAvg: 10,
          afterAvg: 5,
          trend: 'down',
          impact: 'improving',
          magnitude: 'large',
          delta: -5,
          deltaPct: -0.5,
        },
        recommendationCount: {
          beforeAvg: 5,
          afterAvg: 2,
          trend: 'down',
          impact: 'improving',
          magnitude: 'medium',
          delta: -3,
          deltaPct: -0.6,
        },
      },
      changePoint: { date: '2026-04-01T00:00:00.000Z', label: '04/01', index: 1 },
      windowDays: 14,
      beforeWindowLabel: 'before',
      afterWindowLabel: 'after',
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    },
    ...overrides,
  };
}

function makeDeps(
  audit: PolicyAuditTrailResult,
  hints: PolicyRollbackHintResult,
) {
  return {
    buildAuditTrail: jest.fn().mockResolvedValue(audit),
    buildRollbackHints: jest.fn().mockResolvedValue(hints),
  };
}

describe('GuardrailAuditTraceService', () => {
  test('marks a guardrail hit when the audit window worsens in the same direction', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [
        makeAudit({
          result: 'worsened',
          before: {
            alertCount: 10,
            activeAlerts: 2,
            criticalCount: 1,
            criticalRatio: 0.1,
            reoccurCount: 2,
            reoccurRate: 0.2,
            avgResolveTimeHours: 4,
            recommendationCount: 3,
            activeRecommendations: 1,
            recommendationResolvedCount: 1,
          },
          after: {
            alertCount: 4,
            activeAlerts: 4,
            criticalCount: 2,
            criticalRatio: 0.5,
            reoccurCount: 1,
            reoccurRate: 0.25,
            avgResolveTimeHours: 8,
            recommendationCount: 1,
            activeRecommendations: 1,
            recommendationResolvedCount: 0,
          },
        }),
      ],
      summary: {
        total: 1,
        improved: 0,
        unchanged: 0,
        worsened: 1,
        insufficient: 0,
        latestChangedAt: '2026-04-01T12:00:00.000Z',
        topChangedFields: [{ field: 'severityCooldownHours.critical', count: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const hints = {
      hints: [makeHint({ auditResult: 'worsened', hintType: 'consider_rollback' })],
      summary: {
        total: 1,
        keepChange: 0,
        reviewChange: 0,
        considerRollback: 1,
        insufficientEvidence: 0,
        topJobs: [{ jobName: 'autonomous_alert_policy_v1', hintCount: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const service = new GuardrailAuditTraceService(makeDeps(audit, hints));
    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0].guardrailHitAssessment).toBe('hit');
    expect(result.traces[0].matchedGuardrailRuleKeys).toContain('critical_cooldown_too_long');
  });

  test('marks a partial hit when only some guardrails align', async () => {
    const audit = {
      changes: [
        makeChange({
          guardrailCount: 2,
          guardrailDetails: [
            {
              severity: 'critical',
              ruleKey: 'critical_cooldown_too_long',
              title: 'Critical cooldown looks too long',
              message: 'Critical cooldown would move from 2h to 12h.',
              rationale: 'This may delay important alerts.',
              suggestedCheck: 'Confirm response window.',
            },
            {
              severity: 'warning',
              ruleKey: 'info_notify_short_cooldown',
              title: 'Info notifications may still be noisy',
              message: 'Info notifications are enabled with a short cooldown.',
              rationale: 'A short info cooldown can create repeated notifications.',
              suggestedCheck: 'Check whether info alerts need to be delivered this frequently.',
            },
          ],
          guardrailSummary: {
            total: 2,
            info: 0,
            warning: 1,
            critical: 1,
            requiresConfirmation: true,
          },
          highestGuardrailSeverity: 'critical',
        }),
      ],
      audits: [
        makeAudit({
          result: 'worsened',
          after: {
            alertCount: 4,
            activeAlerts: 2,
            criticalCount: 2,
            criticalRatio: 0.5,
            reoccurCount: 1,
            reoccurRate: 0.25,
            avgResolveTimeHours: 5,
            recommendationCount: 2,
            activeRecommendations: 1,
            recommendationResolvedCount: 1,
          },
        }),
      ],
      summary: {
        total: 1,
        improved: 0,
        unchanged: 0,
        worsened: 1,
        insufficient: 0,
        latestChangedAt: '2026-04-01T12:00:00.000Z',
        topChangedFields: [{ field: 'severityCooldownHours.critical', count: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const hints = {
      hints: [makeHint({ auditResult: 'worsened', hintType: 'consider_rollback' })],
      summary: {
        total: 1,
        keepChange: 0,
        reviewChange: 0,
        considerRollback: 1,
        insufficientEvidence: 0,
        topJobs: [{ jobName: 'autonomous_alert_policy_v1', hintCount: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const service = new GuardrailAuditTraceService(makeDeps(audit, hints));
    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.traces[0].guardrailHitAssessment).toBe('partial_hit');
    expect(result.traces[0].matchedGuardrailCount).toBeGreaterThan(0);
  });

  test('marks not confirmed when the audit improves instead of worsening', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [
        makeAudit({
          result: 'improved',
          after: {
            alertCount: 2,
            activeAlerts: 0,
            criticalCount: 0,
            criticalRatio: 0,
            reoccurCount: 0,
            reoccurRate: 0,
            avgResolveTimeHours: 2,
            recommendationCount: 0,
            activeRecommendations: 0,
            recommendationResolvedCount: 1,
          },
        }),
      ],
      summary: {
        total: 1,
        improved: 1,
        unchanged: 0,
        worsened: 0,
        insufficient: 0,
        latestChangedAt: '2026-04-01T12:00:00.000Z',
        topChangedFields: [{ field: 'severityCooldownHours.critical', count: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const hints = {
      hints: [makeHint({ auditResult: 'improved', hintType: 'keep_change' })],
      summary: {
        total: 1,
        keepChange: 1,
        reviewChange: 0,
        considerRollback: 0,
        insufficientEvidence: 0,
        topJobs: [{ jobName: 'autonomous_alert_policy_v1', hintCount: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const service = new GuardrailAuditTraceService(makeDeps(audit, hints));
    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.traces[0].guardrailHitAssessment).toBe('not_confirmed');
  });

  test('falls back to insufficient when guardrail evidence is missing', async () => {
    const audit = {
      changes: [makeChange({ guardrailCount: 0, guardrailDetails: [], guardrailSummary: {
        total: 0,
        info: 0,
        warning: 0,
        critical: 0,
        requiresConfirmation: false,
      }, highestGuardrailSeverity: null })],
      audits: [makeAudit({ result: 'insufficient' })],
      summary: {
        total: 1,
        improved: 0,
        unchanged: 0,
        worsened: 0,
        insufficient: 1,
        latestChangedAt: '2026-04-01T12:00:00.000Z',
        topChangedFields: [{ field: 'severityCooldownHours.critical', count: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const hints = {
      hints: [makeHint({ auditResult: 'insufficient', hintType: 'insufficient_evidence' })],
      summary: {
        total: 1,
        keepChange: 0,
        reviewChange: 0,
        considerRollback: 0,
        insufficientEvidence: 1,
        topJobs: [{ jobName: 'autonomous_alert_policy_v1', hintCount: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const service = new GuardrailAuditTraceService(makeDeps(audit, hints));
    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.traces[0].guardrailHitAssessment).toBe('insufficient');
  });
});

