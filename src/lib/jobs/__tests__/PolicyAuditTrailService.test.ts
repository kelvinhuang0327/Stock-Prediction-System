import { PolicyAuditTrailService } from '../PolicyAuditTrailService';

function makeChange(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
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
    changedFields: ['severityCooldownHours.critical', 'severityCooldownHours.warning', 'jobCooldownOverrides.autonomous:monitor.critical'],
    reason: 'manual_settings_update',
    metadata: JSON.stringify({ source: 'settings_ui' }),
    createdAt: '2026-03-20T12:00:00.000Z',
    updatedAt: '2026-03-20T12:00:00.000Z',
    ...overrides,
  };
}

function makeDataSource(options: {
  changes?: Array<Record<string, unknown>>;
  beforeAlerts?: Array<Record<string, unknown>>;
  afterAlerts?: Array<Record<string, unknown>>;
  beforeRecommendations?: Array<Record<string, unknown>>;
  afterRecommendations?: Array<Record<string, unknown>>;
} = {}) {
  const changes = options.changes ?? [makeChange()];

  return {
    listChanges: jest.fn().mockResolvedValue(changes),
    listJobAlerts: jest.fn().mockImplementation((start: Date) => {
      if (start.toISOString().startsWith('2026-03-06')) return options.beforeAlerts ?? [];
      if (start.toISOString().startsWith('2026-03-20')) return options.afterAlerts ?? [];
      return [];
    }),
    listRecommendations: jest.fn().mockImplementation((start: Date) => {
      if (start.toISOString().startsWith('2026-03-06')) return options.beforeRecommendations ?? [];
      if (start.toISOString().startsWith('2026-03-20')) return options.afterRecommendations ?? [];
      return [];
    }),
  };
}

describe('PolicyAuditTrailService', () => {
  test('marks a policy change as improved when alerts and recommendations fall', async () => {
    const service = new PolicyAuditTrailService(
      makeDataSource({
        beforeAlerts: [
          {
            id: 1,
            jobName: 'autonomous:monitor',
            severity: 'critical',
            message: 'missed run',
            alertKey: 'a1',
            status: 'active',
            firstDetectedAt: '2026-03-10T00:00:00.000Z',
            lastDetectedAt: '2026-03-19T12:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 4,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-19T12:00:00.000Z',
          },
        ],
        afterAlerts: [
          {
            id: 2,
            jobName: 'autonomous:monitor',
            severity: 'warning',
            message: 'missed run',
            alertKey: 'a2',
            status: 'resolved',
            firstDetectedAt: '2026-03-20T00:00:00.000Z',
            lastDetectedAt: '2026-03-21T12:00:00.000Z',
            resolvedAt: '2026-03-21T18:00:00.000Z',
            occurrenceCount: 1,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-21T18:00:00.000Z',
          },
        ],
        beforeRecommendations: [
          {
            id: 1,
            recommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
            recommendationType: 'cooldown_increase',
            targetJob: 'autonomous:monitor',
            targetFamily: 'missed_run',
            severity: 'warning',
            rationale: 'noisy',
            suggestedAction: 'Increase cooldown',
            confidence: 0.9,
            status: 'active',
            firstDetectedAt: '2026-03-10T00:00:00.000Z',
            lastDetectedAt: '2026-03-19T12:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 3,
            metadata: null,
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-19T12:00:00.000Z',
          },
        ],
        afterRecommendations: [],
      }),
    );

    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-03T12:00:00.000Z') });
    expect(result.audits).toHaveLength(1);
    expect(result.audits[0].result).toBe('improved');
    expect(result.summary.improved).toBe(1);
  });

  test('marks a policy change as worsened when critical and active alerts rise', async () => {
    const service = new PolicyAuditTrailService(
      makeDataSource({
        beforeAlerts: [
          {
            id: 1,
            jobName: 'autonomous:daily',
            severity: 'warning',
            message: 'delayed',
            alertKey: 'b1',
            status: 'resolved',
            firstDetectedAt: '2026-03-10T00:00:00.000Z',
            lastDetectedAt: '2026-03-14T12:00:00.000Z',
            resolvedAt: '2026-03-14T18:00:00.000Z',
            occurrenceCount: 1,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-10T00:00:00.000Z',
            updatedAt: '2026-03-14T18:00:00.000Z',
          },
        ],
        afterAlerts: [
          {
            id: 2,
            jobName: 'autonomous:daily',
            severity: 'critical',
            message: 'failed',
            alertKey: 'b2',
            status: 'active',
            firstDetectedAt: '2026-03-20T00:00:00.000Z',
            lastDetectedAt: '2026-03-23T12:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 5,
            latestJobRunLogId: null,
            metadata: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-23T12:00:00.000Z',
          },
        ],
        beforeRecommendations: [],
        afterRecommendations: [
          {
            id: 2,
            recommendationKey: 'review_scheduler_reliability|autonomous:daily|missed_run',
            recommendationType: 'review_scheduler_reliability',
            targetJob: 'autonomous:daily',
            targetFamily: 'missed_run',
            severity: 'critical',
            rationale: 'unstable',
            suggestedAction: 'Check scheduler',
            confidence: 0.95,
            status: 'active',
            firstDetectedAt: '2026-03-20T00:00:00.000Z',
            lastDetectedAt: '2026-03-23T12:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 4,
            metadata: null,
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-23T12:00:00.000Z',
          },
        ],
      }),
    );

    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-04-03T12:00:00.000Z') });
    expect(result.audits[0].result).toBe('worsened');
    expect(result.summary.worsened).toBe(1);
  });

  test('returns insufficient when the after window is too sparse', async () => {
    const service = new PolicyAuditTrailService(
      makeDataSource({
        beforeAlerts: [],
        afterAlerts: [],
        beforeRecommendations: [],
        afterRecommendations: [],
      }),
    );

    const result = await service.build({ limit: 1, windowDays: 14, now: new Date('2026-03-20T13:00:00.000Z') });
    expect(result.audits[0].result).toBe('insufficient');
    expect(result.summary.insufficient).toBe(1);
  });
});
