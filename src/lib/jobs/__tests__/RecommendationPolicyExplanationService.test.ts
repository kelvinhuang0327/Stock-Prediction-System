import { RecommendationPolicyExplanationService } from '../RecommendationPolicyExplanationService';
import type { PolicyRecommendationRow } from '../PolicyRecommendationEngine';

function makeRecommendation(overrides: Partial<PolicyRecommendationRow> = {}): PolicyRecommendationRow {
  return {
    category: 'policy',
    targetJob: 'autonomous:monitor',
    targetFamily: 'missed_run',
    recommendationType: 'cooldown_increase',
    severity: 'warning',
    rationale: 'fast recovery and repeated noise',
    suggestedAction: 'Increase cooldown',
    confidence: 0.91,
    limitations: [],
    ...overrides,
  };
}

function makeService(overrides: {
  recommendations?: PolicyRecommendationRow[];
  historyRows?: Array<Record<string, unknown>>;
  trendDirection?: 'improving' | 'worsening' | 'stable' | 'oscillating' | 'insufficient';
  lifecycleRows?: Array<Record<string, unknown>>;
  noisyBreakdown?: Record<string, unknown>;
  healthStatus?: string;
} = {}) {
  const policyLoader = jest.fn().mockResolvedValue({
    source: 'persisted' as const,
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
    updatedAt: '2026-03-31T12:00:00.000Z',
    limitations: [],
  });

  const recommendationEngine = {
    build: jest.fn().mockResolvedValue({
      recommendations:
        overrides.recommendations ?? [
          makeRecommendation(),
          makeRecommendation({
            targetJob: 'autonomous:daily',
            recommendationType: 'review_scheduler_reliability',
            severity: 'critical',
            targetFamily: 'missed_run',
            rationale: 'scheduler is unstable',
            suggestedAction: 'Check scheduler reliability',
          }),
        ],
      summary: {
        total: 2,
        byType: {
          cooldown_increase: 1,
          cooldown_decrease: 0,
          review_monitor_frequency: 0,
          review_scheduler_reliability: 1,
          consider_severity_escalation: 0,
          consider_severity_downgrade: 0,
          no_change_recommended: 0,
        },
      },
      policy: {
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
        updatedAt: '2026-03-31T12:00:00.000Z',
        limitations: [],
      },
      limitations: [],
    }),
  };

  const historyService = {
    listHistory: jest.fn().mockResolvedValue(
      overrides.historyRows ?? [
        {
          recommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
          recommendationType: 'cooldown_increase',
          targetJob: 'autonomous:monitor',
          targetFamily: 'missed_run',
          severity: 'warning',
          rationale: 'fast recovery and repeated noise',
          suggestedAction: 'Increase cooldown',
          confidence: 0.91,
          status: 'active',
          firstDetectedAt: '2026-03-31T00:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
          resolvedAt: null,
          occurrenceCount: 3,
          metadata: JSON.stringify({
            observationTimeline: { '2026-03-31': 3 },
            resolutionTimeline: {},
            resolvedCycles: 0,
            reoccurCount: 2,
          }),
          createdAt: '2026-03-31T00:00:00.000Z',
          updatedAt: '2026-03-31T12:00:00.000Z',
        },
      ],
    ),
  };

  const trendService = {
    build: jest.fn().mockResolvedValue({
      recommendationType: 'cooldown_increase',
      targetJob: 'autonomous:monitor',
      status: 'all',
      window: '14d',
      bucket: 'day',
      buckets: [],
      summary: {
        trendDirection: overrides.trendDirection ?? 'stable',
        totalOccurrences: 3,
        totalResolved: 1,
        avgPerBucket: 0.5,
        peakBucket: 1,
        bucketCount: 14,
        windowDays: 14,
        bucketSizeDays: 1,
        periodStart: '2026-03-18T00:00:00.000Z',
        periodEnd: '2026-03-31T00:00:00.000Z',
      },
      limitations: [],
      generatedAt: '2026-03-31T12:00:00.000Z',
    }),
  };

  const lifecycleService = {
    build: jest.fn().mockResolvedValue({
      recommendationKey: null,
      recommendationType: 'cooldown_increase',
      targetJob: 'autonomous:monitor',
      status: 'all',
      recommendations:
        overrides.lifecycleRows ?? [
          {
            recommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
            recommendationType: 'cooldown_increase',
            targetJob: 'autonomous:monitor',
            targetFamily: 'missed_run',
            severity: 'warning',
            firstDetectedAt: '2026-03-31T00:00:00.000Z',
            lastDetectedAt: '2026-03-31T12:00:00.000Z',
            resolvedAt: null,
            occurrenceCount: 3,
            currentStatus: 'active',
            resolvedCount: 1,
            reoccurCount: 2,
            daysOpen: 1,
            lifecycleSummary: 'Currently active after 3 observations.',
            limitations: [],
          },
        ],
      summary: {
        total: 1,
        active: 1,
        resolved: 0,
        stale: 0,
        recurring: 1,
        resolvedCycles: 1,
        reoccurCount: 2,
        avgOccurrences: 3,
        topRecommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
      },
      limitations: [],
      generatedAt: '2026-03-31T12:00:00.000Z',
    }),
  };

  const noisySourceBreakdownService = {
    build: jest.fn().mockResolvedValue(
      overrides.noisyBreakdown ?? {
        jobName: 'autonomous:monitor',
        families: [
          {
            family: 'missed_run',
            familyLabel: 'Missed run',
            groupingConfidence: 1,
            derivedReason: 'No successful run',
            count: 3,
            totalOccurrences: 3,
            reoccurCount: 2,
            reoccurRate: 0.67,
            avgResolveTimeHours: 2,
            criticalCount: 0,
            warningCount: 3,
            infoCount: 0,
            criticalRatio: 0,
            activeCount: 1,
            resolvedCount: 2,
            noisyScore: 13,
            summaryNote: 'missed run heavy',
          },
        ],
        topFamily: {
          family: 'missed_run',
          familyLabel: 'Missed run',
          groupingConfidence: 1,
          derivedReason: 'No successful run',
          count: 3,
          totalOccurrences: 3,
          reoccurCount: 2,
          reoccurRate: 0.67,
          avgResolveTimeHours: 2,
          criticalCount: 0,
          warningCount: 3,
          infoCount: 0,
          criticalRatio: 0,
          activeCount: 1,
          resolvedCount: 2,
          noisyScore: 13,
          summaryNote: 'missed run heavy',
        },
        summary: {
          jobName: 'autonomous:monitor',
          totalAlerts: 3,
          totalOccurrences: 3,
          familyCount: 1,
          activeCount: 1,
          resolvedCount: 2,
          topFamily: 'missed_run',
          topFamilyLabel: 'Missed run',
          topFamilyShare: 1,
          overallSummary: 'missed run dominates',
          source: 'persisted',
        },
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    ),
  };

  const jobHealthService = {
    evaluate: jest.fn().mockResolvedValue(
      overrides.healthStatus
        ? {
            jobs: [
              {
                jobName: 'autonomous:monitor',
                scheduledFor: '2026-03-31T12:30:00.000Z',
                latestRun: null,
                missed: true,
                canRerun: true,
                triggerSource: null,
                runMode: null,
                lastErrorMessage: null,
                status: 'never-ran',
                healthStatus: overrides.healthStatus,
                healthReason: 'health reason',
                lastSuccessfulRunAt: null,
                failureStreak: 0,
                summary: 'health summary',
                limitations: [],
              },
            ],
            alerts: [],
            summary: '1 job tracked.',
            limitations: [],
            healthSummary: { total: 1, ok: 0, delayed: 1, failed: 0, neverRan: 0 },
          }
        : {
            jobs: [
              {
                jobName: 'autonomous:monitor',
                scheduledFor: '2026-03-31T12:30:00.000Z',
                latestRun: null,
                missed: true,
                canRerun: true,
                triggerSource: null,
                runMode: null,
                lastErrorMessage: null,
                status: 'never-ran',
                healthStatus: 'delayed',
                healthReason: 'health reason',
                lastSuccessfulRunAt: null,
                failureStreak: 0,
                summary: 'health summary',
                limitations: [],
              },
            ],
            alerts: [],
            summary: '1 job tracked.',
            limitations: [],
            healthSummary: { total: 1, ok: 0, delayed: 1, failed: 0, neverRan: 0 },
          },
    ),
  };

  const service = new RecommendationPolicyExplanationService(
    policyLoader as never,
    recommendationEngine as never,
    historyService as never,
    trendService as never,
    lifecycleService as never,
    noisySourceBreakdownService as never,
    jobHealthService as never,
  );

  return { service, policyLoader, recommendationEngine, historyService, trendService, lifecycleService, noisySourceBreakdownService, jobHealthService };
}

describe('RecommendationPolicyExplanationService', () => {
  test('builds evidence-backed explanations for cooldown increase', async () => {
    const { service } = makeService();
    const result = await service.build({ limit: 1, now: new Date('2026-03-31T12:00:00.000Z') });

    expect(result.explanations).toHaveLength(1);
    const explanation = result.explanations[0];
    expect(explanation.recommendationType).toBe('cooldown_increase');
    expect(explanation.evidence.map((item) => item.key)).toEqual(
      expect.arrayContaining(['high_occurrence', 'frequent_reoccur', 'mostly_resolved_quickly', 'stable_trend', 'noise_heavy']),
    );
    expect(explanation.rationaleSummary).toContain('cooldown_increase');
    expect(explanation.relatedTrendDirection).toBe('stable');
  });

  test('supports scheduler reliability explanations and degraded empty state', async () => {
    const { service } = makeService({
      recommendations: [
        makeRecommendation({
          targetJob: 'autonomous:monitor',
          recommendationType: 'review_scheduler_reliability',
          severity: 'critical',
          targetFamily: 'missed_run',
          rationale: 'scheduler is unstable',
          suggestedAction: 'Check scheduler reliability',
        }),
      ],
      historyRows: [
        {
          recommendationKey: 'review_scheduler_reliability|autonomous:monitor|missed_run',
          recommendationType: 'review_scheduler_reliability',
          targetJob: 'autonomous:monitor',
          targetFamily: 'missed_run',
          severity: 'critical',
          rationale: 'scheduler is unstable',
          suggestedAction: 'Check scheduler reliability',
          confidence: 0.97,
          status: 'active',
          firstDetectedAt: '2026-03-31T10:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
          resolvedAt: null,
          occurrenceCount: 2,
          metadata: JSON.stringify({
            observationTimeline: { '2026-03-31': 2 },
            resolutionTimeline: {},
            resolvedCycles: 0,
            reoccurCount: 1,
          }),
          createdAt: '2026-03-31T10:00:00.000Z',
          updatedAt: '2026-03-31T12:00:00.000Z',
        },
      ],
      trendDirection: 'worsening',
      lifecycleRows: [
        {
          recommendationKey: 'review_scheduler_reliability|autonomous:monitor|missed_run',
          recommendationType: 'review_scheduler_reliability',
          targetJob: 'autonomous:monitor',
          targetFamily: 'missed_run',
          severity: 'critical',
          firstDetectedAt: '2026-03-31T10:00:00.000Z',
          lastDetectedAt: '2026-03-31T12:00:00.000Z',
          resolvedAt: null,
          occurrenceCount: 2,
          currentStatus: 'active',
          resolvedCount: 0,
          reoccurCount: 1,
          daysOpen: 0,
          lifecycleSummary: 'Currently active after 2 observations.',
          limitations: [],
        },
      ],
      noisyBreakdown: {
        jobName: 'autonomous:monitor',
        families: [
          {
            family: 'missed_run',
            familyLabel: 'Missed run',
            groupingConfidence: 1,
            derivedReason: 'No successful run',
            count: 2,
            totalOccurrences: 2,
            reoccurCount: 1,
            reoccurRate: 0.5,
            avgResolveTimeHours: 5,
            criticalCount: 2,
            warningCount: 0,
            infoCount: 0,
            criticalRatio: 1,
            activeCount: 1,
            resolvedCount: 1,
            noisyScore: 18,
            summaryNote: 'missed run critical-heavy',
          },
        ],
        topFamily: {
          family: 'missed_run',
          familyLabel: 'Missed run',
          groupingConfidence: 1,
          derivedReason: 'No successful run',
          count: 2,
          totalOccurrences: 2,
          reoccurCount: 1,
          reoccurRate: 0.5,
          avgResolveTimeHours: 5,
          criticalCount: 2,
          warningCount: 0,
          infoCount: 0,
          criticalRatio: 1,
          activeCount: 1,
          resolvedCount: 1,
          noisyScore: 18,
          summaryNote: 'missed run critical-heavy',
        },
        summary: {
          jobName: 'autonomous:monitor',
          totalAlerts: 2,
          totalOccurrences: 2,
          familyCount: 1,
          activeCount: 1,
          resolvedCount: 1,
          topFamily: 'missed_run',
          topFamilyLabel: 'Missed run',
          topFamilyShare: 1,
          overallSummary: 'missed run dominates',
          source: 'persisted',
        },
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
      healthStatus: 'failed',
    });

    const result = await service.build({ recommendationType: 'review_scheduler_reliability', limit: 1 });
    expect(result.explanations).toHaveLength(1);
    const explanation = result.explanations[0];
    expect(explanation.evidence.map((item) => item.key)).toEqual(
      expect.arrayContaining(['scheduler_related_pattern', 'worsening_trend', 'unresolved_open', 'health_reliability_issue']),
    );
    expect(explanation.relatedTrendDirection).toBe('worsening');
  });

  test('returns degraded empty state when recommendation engine yields no rows', async () => {
    const { service } = makeService({
      recommendations: [],
      historyRows: [],
      lifecycleRows: [],
      noisyBreakdown: {
        jobName: 'autonomous:monitor',
        families: [],
        topFamily: null,
        summary: {
          jobName: 'autonomous:monitor',
          totalAlerts: 0,
          totalOccurrences: 0,
          familyCount: 0,
          activeCount: 0,
          resolvedCount: 0,
          topFamily: null,
          topFamilyLabel: null,
          topFamilyShare: 0,
          overallSummary: 'No noisy source data.',
          source: 'persisted',
        },
        limitations: ['No noisy source data.'],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    });

    const result = await service.build({ limit: 1 });
    expect(result.explanations).toHaveLength(0);
    expect(result.limitations.some((item) => item.includes('No recommendation explanation could be derived'))).toBe(true);
  });
});
