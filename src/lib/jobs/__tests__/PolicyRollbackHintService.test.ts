import { PolicyRollbackHintService } from '../PolicyRollbackHintService';
import type { PolicyAuditChartResult } from '../PolicyAuditChartService';
import type { PolicyAuditTrailResult } from '../PolicyAuditTrailService';

function makeChange(id = 1) {
  return {
    id,
    policyKey: 'autonomous_alert_policy_v1',
    changedAt: '2026-04-01T12:00:00.000Z',
    changedBy: 'manual',
    oldValue: '{}',
    newValue: '{}',
    changedFields: ['severityCooldownHours.critical'],
    reason: 'manual_settings_update',
    metadata: JSON.stringify({ source: 'settings_ui' }),
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
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

function makeChart(
  overrides: Partial<PolicyAuditChartResult> = {},
): PolicyAuditChartResult {
  return {
    change: makeChange(),
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
    beforeWindowLabel: '2026-03-18 → 2026-04-01',
    afterWindowLabel: '2026-04-01 → 2026-04-04',
    limitations: [],
    generatedAt: '2026-04-04T00:00:00.000Z',
    ...overrides,
  };
}

function makeDeps(audit: PolicyAuditTrailResult, chart: PolicyAuditChartResult) {
  return {
    buildAuditTrail: jest.fn().mockResolvedValue(audit),
    buildAuditChart: jest.fn().mockResolvedValue(chart),
  };
}

describe('PolicyRollbackHintService', () => {
  test('keeps change when alerts fall without critical regression', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [makeAudit()],
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

    const service = new PolicyRollbackHintService(makeDeps(audit, makeChart()));
    const result = await service.build({ changeId: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.hints[0].hintType).toBe('keep_change');
    expect(result.hints[0].rationale).toContain('reduce alert noise');
  });

  test('flags rollback risk when critical ratio rises despite lower alert count', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [
        makeAudit({
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
          result: 'worsened',
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

    const chart = makeChart({
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
          beforeAvg: 0.1,
          afterAvg: 0.5,
          trend: 'up',
          impact: 'worsening',
          magnitude: 'large',
          delta: 0.4,
          deltaPct: 4,
        },
        reoccurRate: {
          beforeAvg: 0.2,
          afterAvg: 0.25,
          trend: 'up',
          impact: 'worsening',
          magnitude: 'small',
          delta: 0.05,
          deltaPct: 0.25,
        },
        avgResolveTime: {
          beforeAvg: 4,
          afterAvg: 8,
          trend: 'up',
          impact: 'worsening',
          magnitude: 'large',
          delta: 4,
          deltaPct: 1,
        },
        recommendationCount: {
          beforeAvg: 3,
          afterAvg: 1,
          trend: 'down',
          impact: 'improving',
          magnitude: 'medium',
          delta: -2,
          deltaPct: -0.6667,
        },
      },
    });

    const service = new PolicyRollbackHintService(makeDeps(audit, chart));
    const result = await service.build({ changeId: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.hints[0].hintType).toBe('consider_rollback');
    expect(result.hints[0].evidence.some((item) => item.includes('Critical ratio'))).toBe(true);
  });

  test('returns review_change for mixed signals', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [
        makeAudit({
          result: 'unchanged',
          before: {
            alertCount: 8,
            activeAlerts: 2,
            criticalCount: 2,
            criticalRatio: 0.25,
            reoccurCount: 3,
            reoccurRate: 0.375,
            avgResolveTimeHours: 5,
            recommendationCount: 4,
            activeRecommendations: 1,
            recommendationResolvedCount: 1,
          },
          after: {
            alertCount: 6,
            activeAlerts: 2,
            criticalCount: 2,
            criticalRatio: 0.3333333333,
            reoccurCount: 2,
            reoccurRate: 0.3333333333,
            avgResolveTimeHours: 5.2,
            recommendationCount: 3,
            activeRecommendations: 1,
            recommendationResolvedCount: 1,
          },
        }),
      ],
      summary: {
        total: 1,
        improved: 0,
        unchanged: 1,
        worsened: 0,
        insufficient: 0,
        latestChangedAt: '2026-04-01T12:00:00.000Z',
        topChangedFields: [{ field: 'severityCooldownHours.critical', count: 1 }],
      },
      limitations: [],
      generatedAt: '2026-04-04T00:00:00.000Z',
    };

    const chart = makeChart({
      metrics: {
        alertCount: {
          beforeAvg: 8,
          afterAvg: 6,
          trend: 'down',
          impact: 'improving',
          magnitude: 'small',
          delta: -2,
          deltaPct: -0.25,
        },
        criticalRatio: {
          beforeAvg: 0.25,
          afterAvg: 0.3333333333,
          trend: 'up',
          impact: 'worsening',
          magnitude: 'small',
          delta: 0.0833333333,
          deltaPct: 0.3333333332,
        },
        reoccurRate: {
          beforeAvg: 0.375,
          afterAvg: 0.3333333333,
          trend: 'down',
          impact: 'improving',
          magnitude: 'small',
          delta: -0.0416666667,
          deltaPct: -0.1111111112,
        },
        avgResolveTime: {
          beforeAvg: 5,
          afterAvg: 5.2,
          trend: 'up',
          impact: 'worsening',
          magnitude: 'small',
          delta: 0.2,
          deltaPct: 0.04,
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
    });

    const service = new PolicyRollbackHintService(makeDeps(audit, chart));
    const result = await service.build({ changeId: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.hints[0].hintType).toBe('review_change');
    expect(result.hints[0].evidence.some((item) => item.includes('Critical ratio'))).toBe(true);
  });

  test('returns insufficient_evidence when audit data is sparse', async () => {
    const audit = {
      changes: [makeChange()],
      audits: [
        makeAudit({
          result: 'insufficient',
          before: {
            alertCount: 0,
            activeAlerts: 0,
            criticalCount: 0,
            criticalRatio: null,
            reoccurCount: 0,
            reoccurRate: null,
            avgResolveTimeHours: null,
            recommendationCount: 0,
            activeRecommendations: 0,
            recommendationResolvedCount: 0,
          },
          after: {
            alertCount: 0,
            activeAlerts: 0,
            criticalCount: 0,
            criticalRatio: null,
            reoccurCount: 0,
            reoccurRate: null,
            avgResolveTimeHours: null,
            recommendationCount: 0,
            activeRecommendations: 0,
            recommendationResolvedCount: 0,
          },
        }),
      ],
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

    const chart = makeChart({
      metrics: {
        alertCount: {
          beforeAvg: null,
          afterAvg: null,
          trend: 'insufficient',
          impact: 'insufficient',
          magnitude: 'none',
          delta: null,
          deltaPct: null,
        },
        criticalRatio: {
          beforeAvg: null,
          afterAvg: null,
          trend: 'insufficient',
          impact: 'insufficient',
          magnitude: 'none',
          delta: null,
          deltaPct: null,
        },
        reoccurRate: {
          beforeAvg: null,
          afterAvg: null,
          trend: 'insufficient',
          impact: 'insufficient',
          magnitude: 'none',
          delta: null,
          deltaPct: null,
        },
        avgResolveTime: {
          beforeAvg: null,
          afterAvg: null,
          trend: 'insufficient',
          impact: 'insufficient',
          magnitude: 'none',
          delta: null,
          deltaPct: null,
        },
        recommendationCount: {
          beforeAvg: null,
          afterAvg: null,
          trend: 'insufficient',
          impact: 'insufficient',
          magnitude: 'none',
          delta: null,
          deltaPct: null,
        },
      },
      limitations: ['Sparse chart data.'],
    });

    const service = new PolicyRollbackHintService(makeDeps(audit, chart));
    const result = await service.build({ changeId: 1, windowDays: 14, now: new Date('2026-04-04T00:00:00.000Z') });

    expect(result.hints[0].hintType).toBe('insufficient_evidence');
    expect(result.hints[0].confidence).toBeLessThan(0.5);
  });
});
