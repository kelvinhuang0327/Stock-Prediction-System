import { PolicyAuditChartService } from '../PolicyAuditChartService';

function makeChange(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 11,
    policyKey: 'autonomous_alert_policy_v1',
    changedAt: '2026-03-20T12:00:00.000Z',
    changedBy: 'manual',
    oldValue: JSON.stringify({
      severityCooldownHours: { critical: 2, warning: 12, info: 0 },
      jobCooldownOverrides: { 'autonomous:monitor': { critical: 1, warning: 1 } },
      infoNotificationEnabled: false,
      escalationEnabled: true,
      recoveryResetEnabled: true,
    }),
    newValue: JSON.stringify({
      severityCooldownHours: { critical: 4, warning: 18, info: 0 },
      jobCooldownOverrides: { 'autonomous:monitor': { critical: 2, warning: 2 } },
      infoNotificationEnabled: false,
      escalationEnabled: true,
      recoveryResetEnabled: true,
    }),
    changedFields: ['severityCooldownHours.critical', 'severityCooldownHours.warning'],
    reason: 'manual_settings_update',
    metadata: JSON.stringify({ source: 'settings_ui' }),
    createdAt: '2026-03-20T12:00:00.000Z',
    updatedAt: '2026-03-20T12:00:00.000Z',
    ...overrides,
  };
}

function makeDataSource(options: {
  change?: Record<string, unknown> | null;
  alerts?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
} = {}) {
  return {
    getLatestChange: jest.fn().mockResolvedValue(options.change ?? makeChange()),
    getChangeById: jest.fn().mockResolvedValue(options.change ?? makeChange()),
    listJobAlerts: jest.fn().mockResolvedValue(options.alerts ?? []),
    listRecommendations: jest.fn().mockResolvedValue(options.recommendations ?? []),
  };
}

describe('PolicyAuditChartService', () => {
  test('builds a before/after timeline with chart metrics', async () => {
    const service = new PolicyAuditChartService(
      makeDataSource({
        alerts: [
          {
            id: 1,
            jobName: 'autonomous:daily',
            severity: 'critical',
            message: 'failed',
            alertKey: 'a1',
            status: 'resolved',
            firstDetectedAt: '2026-03-10T03:00:00.000Z',
            lastDetectedAt: '2026-03-10T08:00:00.000Z',
            resolvedAt: '2026-03-12T08:00:00.000Z',
            occurrenceCount: 4,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-10T03:00:00.000Z',
            updatedAt: '2026-03-12T08:00:00.000Z',
          },
          {
            id: 2,
            jobName: 'autonomous:daily',
            severity: 'warning',
            message: 'missed run',
            alertKey: 'a2',
            status: 'active',
            firstDetectedAt: '2026-03-11T03:00:00.000Z',
            lastDetectedAt: '2026-03-11T08:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 2,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-11T03:00:00.000Z',
            updatedAt: '2026-03-11T08:00:00.000Z',
          },
          {
            id: 3,
            jobName: 'autonomous:daily',
            severity: 'warning',
            message: 'missed run',
            alertKey: 'a3',
            status: 'resolved',
            firstDetectedAt: '2026-03-21T03:00:00.000Z',
            lastDetectedAt: '2026-03-21T08:00:00.000Z',
            resolvedAt: '2026-03-23T08:00:00.000Z',
            occurrenceCount: 1,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-21T03:00:00.000Z',
            updatedAt: '2026-03-23T08:00:00.000Z',
          },
        ],
        recommendations: [
          {
            id: 1,
            recommendationKey: 'cooldown_increase|autonomous:daily|missed_run',
            recommendationType: 'cooldown_increase',
            targetJob: 'autonomous:daily',
            targetFamily: 'missed_run',
            severity: 'warning',
            rationale: 'noisy',
            suggestedAction: 'Increase cooldown',
            confidence: 0.9,
            status: 'resolved',
            firstDetectedAt: '2026-03-10T03:00:00.000Z',
            lastDetectedAt: '2026-03-11T08:00:00.000Z',
            resolvedAt: '2026-03-13T08:00:00.000Z',
            occurrenceCount: 2,
            metadata: null,
            createdAt: '2026-03-10T03:00:00.000Z',
            updatedAt: '2026-03-13T08:00:00.000Z',
          },
          // After window has no active recommendation noise in this test case.
        ],
      }),
    );

    const result = await service.build({ changeId: 11, windowDays: 14, now: new Date('2026-04-03T12:00:00.000Z') });

    expect(result.change?.id).toBe(11);
    expect(result.changePoint).not.toBeNull();
    expect(result.timeline.some((bucket) => bucket.phase === 'change')).toBe(true);
    expect(result.metrics.alertCount.beforeAvg).toBeGreaterThan(result.metrics.alertCount.afterAvg ?? 0);
    expect(result.metrics.alertCount.impact).toBe('improving');
    expect(result.metrics.criticalRatio.impact).toBe('improving');
    expect(result.metrics.recommendationCount.impact).toBe('improving');
    expect(result.limitations).toEqual([]);
  });

  test('returns insufficient when the chart window is sparse', async () => {
    const service = new PolicyAuditChartService(
      makeDataSource({
        alerts: [],
        recommendations: [],
      }),
    );

    const result = await service.build({ changeId: 11, windowDays: 14, now: new Date('2026-04-03T12:00:00.000Z') });
    expect(result.metrics.alertCount.trend).toBe('insufficient');
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
