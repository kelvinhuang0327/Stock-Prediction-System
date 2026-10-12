import { PolicyRecommendationEngine } from '../PolicyRecommendationEngine';

function makePolicyState() {
  return {
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
  };
}

function makeEngine(overrides: {
  historySummary?: unknown;
  health?: unknown;
  breakdown?: unknown;
  familyTrend?: unknown;
  resolveDistribution?: unknown;
} = {}) {
  const historyService = {
    buildSummary: jest.fn().mockResolvedValue(
      overrides.historySummary ?? {
        total: 1,
        active: 1,
        resolvedRecently: 0,
        critical: 1,
        warning: 0,
        info: 0,
        topNoisyJobs: [{ jobName: 'autonomous:monitor', occurrenceCount: 8 }],
        recentReoccurAlerts: [],
        recentResolvedAlerts: [],
        severityDistribution: { critical: 1, warning: 0, info: 0 },
      },
    ),
  };
  const healthService = {
    evaluate: jest.fn().mockResolvedValue(
      overrides.health ?? {
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
            healthReason: 'No successful run recorded in the recent 60 minutes window.',
            lastSuccessfulRunAt: null,
            failureStreak: 0,
            summary: 'monitor delayed',
            limitations: [],
          },
        ],
        alerts: [],
        summary: '1 autonomous jobs tracked.',
        limitations: [],
        healthSummary: { total: 1, ok: 0, delayed: 1, failed: 0, neverRan: 0 },
      },
    ),
  };
  const breakdownService = {
    build: jest.fn().mockResolvedValue(
      overrides.breakdown ?? {
        jobName: 'autonomous:monitor',
        families: [
          {
            family: 'missed_run',
            familyLabel: 'Missed run',
            groupingConfidence: 1,
            derivedReason: 'No successful run',
            count: 8,
            totalOccurrences: 16,
            reoccurCount: 6,
            reoccurRate: 0.75,
            avgResolveTimeHours: 1.2,
            criticalCount: 0,
            warningCount: 8,
            infoCount: 0,
            criticalRatio: 0,
            activeCount: 0,
            resolvedCount: 8,
            noisyScore: 20,
            summaryNote: 'missed_run noise',
          },
        ],
        topFamily: {
          family: 'missed_run',
          familyLabel: 'Missed run',
          groupingConfidence: 1,
          derivedReason: 'No successful run',
          count: 8,
          totalOccurrences: 16,
          reoccurCount: 6,
          reoccurRate: 0.75,
          avgResolveTimeHours: 1.2,
          criticalCount: 0,
          warningCount: 8,
          infoCount: 0,
          criticalRatio: 0,
          activeCount: 0,
          resolvedCount: 8,
          noisyScore: 20,
          summaryNote: 'missed_run noise',
        },
        summary: {
          jobName: 'autonomous:monitor',
          totalAlerts: 8,
          totalOccurrences: 16,
          familyCount: 1,
          activeCount: 0,
          resolvedCount: 8,
          topFamily: 'missed_run',
          topFamilyLabel: 'Missed run',
          topFamilyShare: 1,
          overallSummary: 'monitor dominated by missed run',
          source: 'persisted',
        },
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    ),
  };
  const familyTrendService = {
    build: jest.fn().mockResolvedValue(
      overrides.familyTrend ?? {
        jobName: 'autonomous:monitor',
        window: '14d',
        bucket: 'day',
        families: [
          {
            family: 'missed_run',
            familyLabel: 'Missed run',
            buckets: [],
            trendDirection: 'worsening',
            totalOccurrences: 16,
            totalResolved: 8,
            avgPerBucket: 1.2,
            limitations: [],
          },
        ],
        overallSummary: 'missed_run is worsening',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    ),
  };
  const resolveDistributionService = {
    build: jest.fn().mockResolvedValue(
      overrides.resolveDistribution ?? {
        jobName: 'autonomous:monitor',
        days: 30,
        families: [
          {
            family: 'missed_run',
            familyLabel: 'Missed run',
            resolvedCount: 8,
            unresolvedCount: 0,
            avgResolveTimeHours: 1.2,
            medianResolveTimeHours: 1,
            p90ResolveTimeHours: 1.8,
            maxResolveTimeHours: 2,
            unresolvedRatio: 0,
            distributionSummary: 'quick resolves',
            limitations: [],
          },
        ],
        overallSummary: 'quick resolves',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    ),
  };
  const policyLoader = jest.fn().mockResolvedValue(makePolicyState());

  const engine = new PolicyRecommendationEngine(
    historyService as never,
    breakdownService as never,
    familyTrendService as never,
    resolveDistributionService as never,
    healthService as never,
    policyLoader,
  );

  return { engine, historyService, healthService, breakdownService, familyTrendService, resolveDistributionService, policyLoader };
}

describe('PolicyRecommendationEngine', () => {
  test('recommends increasing cooldown when noise is high but recovery is fast', async () => {
    const { engine } = makeEngine({
      breakdown: {
        jobName: 'autonomous:monitor',
        families: [
          {
            family: 'warning',
            familyLabel: 'Warning family',
            groupingConfidence: 1,
            derivedReason: 'repeated warning alerts',
            count: 12,
            totalOccurrences: 24,
            reoccurCount: 10,
            reoccurRate: 0.83,
            avgResolveTimeHours: 1.2,
            criticalCount: 0,
            warningCount: 12,
            infoCount: 0,
            criticalRatio: 0,
            activeCount: 0,
            resolvedCount: 12,
            noisyScore: 30,
            summaryNote: 'warning noise',
          },
        ],
        topFamily: {
          family: 'warning',
          familyLabel: 'Warning family',
          groupingConfidence: 1,
          derivedReason: 'repeated warning alerts',
          count: 12,
          totalOccurrences: 24,
          reoccurCount: 10,
          reoccurRate: 0.83,
          avgResolveTimeHours: 1.2,
          criticalCount: 0,
          warningCount: 12,
          infoCount: 0,
          criticalRatio: 0,
          activeCount: 0,
          resolvedCount: 12,
          noisyScore: 30,
          summaryNote: 'warning noise',
        },
      },
      familyTrend: {
        jobName: 'autonomous:monitor',
        window: '14d',
        bucket: 'day',
        families: [
          {
            family: 'warning',
            familyLabel: 'Warning family',
            buckets: [],
            trendDirection: 'stable',
            totalOccurrences: 24,
            totalResolved: 12,
            avgPerBucket: 1.7,
            limitations: [],
          },
        ],
        overallSummary: 'warning stable',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
      resolveDistribution: {
        jobName: 'autonomous:monitor',
        days: 30,
        families: [
          {
            family: 'warning',
            familyLabel: 'Warning family',
            resolvedCount: 12,
            unresolvedCount: 0,
            avgResolveTimeHours: 1.2,
            medianResolveTimeHours: 1,
            p90ResolveTimeHours: 2,
            maxResolveTimeHours: 2.5,
            unresolvedRatio: 0,
            distributionSummary: 'quick resolves',
            limitations: [],
          },
        ],
        overallSummary: 'quick resolves',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    });

    const result = await engine.build({ jobName: 'autonomous:monitor', limit: 1, now: new Date('2026-03-31T12:00:00.000Z') });

    expect(result.recommendations[0].recommendationType).toBe('cooldown_increase');
    expect(result.recommendations[0].severity).toBe('warning');
  });

  test('recommends scheduler reliability review for worsening missed runs', async () => {
    const { engine } = makeEngine();
    const result = await engine.build({ jobName: 'autonomous:monitor', limit: 1, now: new Date('2026-03-31T12:00:00.000Z') });

    expect(result.recommendations[0].recommendationType).toBe('review_scheduler_reliability');
    expect(result.recommendations[0].severity).toBe('critical');
  });

  test('recommends severity escalation for long-tail consecutive failures', async () => {
    const { engine } = makeEngine({
      breakdown: {
        jobName: 'autonomous:daily',
        families: [
          {
            family: 'consecutive_failure',
            familyLabel: 'Consecutive failure',
            groupingConfidence: 1,
            derivedReason: 'repeated failed runs',
            count: 3,
            totalOccurrences: 12,
            reoccurCount: 2,
            reoccurRate: 0.66,
            avgResolveTimeHours: 9.5,
            criticalCount: 3,
            warningCount: 0,
            infoCount: 0,
            criticalRatio: 1,
            activeCount: 2,
            resolvedCount: 1,
            noisyScore: 18,
            summaryNote: 'consecutive failure tail risk',
          },
        ],
        topFamily: {
          family: 'consecutive_failure',
          familyLabel: 'Consecutive failure',
          groupingConfidence: 1,
          derivedReason: 'repeated failed runs',
          count: 3,
          totalOccurrences: 12,
          reoccurCount: 2,
          reoccurRate: 0.66,
          avgResolveTimeHours: 9.5,
          criticalCount: 3,
          warningCount: 0,
          infoCount: 0,
          criticalRatio: 1,
          activeCount: 2,
          resolvedCount: 1,
          noisyScore: 18,
          summaryNote: 'consecutive failure tail risk',
        },
      },
      familyTrend: {
        jobName: 'autonomous:daily',
        window: '14d',
        bucket: 'day',
        families: [
          {
            family: 'consecutive_failure',
            familyLabel: 'Consecutive failure',
            buckets: [],
            trendDirection: 'worsening',
            totalOccurrences: 12,
            totalResolved: 1,
            avgPerBucket: 0.9,
            limitations: [],
          },
        ],
        overallSummary: 'consecutive failure worsening',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
      resolveDistribution: {
        jobName: 'autonomous:daily',
        days: 30,
        families: [
          {
            family: 'consecutive_failure',
            familyLabel: 'Consecutive failure',
            resolvedCount: 1,
            unresolvedCount: 2,
            avgResolveTimeHours: 9.5,
            medianResolveTimeHours: 9.5,
            p90ResolveTimeHours: 9.5,
            maxResolveTimeHours: 9.5,
            unresolvedRatio: 0.66,
            distributionSummary: 'slow resolves',
            limitations: [],
          },
        ],
        overallSummary: 'slow resolves',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    });

    const result = await engine.build({ jobName: 'autonomous:daily', limit: 1, now: new Date('2026-03-31T12:00:00.000Z') });

    expect(result.recommendations[0].recommendationType).toBe('consider_severity_escalation');
    expect(result.recommendations[0].severity).toBe('critical');
  });

  test('returns no change when the pattern is stable and acceptable', async () => {
    const { engine } = makeEngine({
      breakdown: {
        jobName: 'autonomous:review',
        families: [
          {
            family: 'recovery_event',
            familyLabel: 'Recovery event',
            groupingConfidence: 1,
            derivedReason: 'job recovered',
            count: 2,
            totalOccurrences: 2,
            reoccurCount: 0,
            reoccurRate: 0,
            avgResolveTimeHours: 1,
            criticalCount: 0,
            warningCount: 2,
            infoCount: 0,
            criticalRatio: 0,
            activeCount: 0,
            resolvedCount: 2,
            noisyScore: 2,
            summaryNote: 'low noise',
          },
        ],
        topFamily: {
          family: 'recovery_event',
          familyLabel: 'Recovery event',
          groupingConfidence: 1,
          derivedReason: 'job recovered',
          count: 2,
          totalOccurrences: 2,
          reoccurCount: 0,
          reoccurRate: 0,
          avgResolveTimeHours: 1,
          criticalCount: 0,
          warningCount: 2,
          infoCount: 0,
          criticalRatio: 0,
          activeCount: 0,
          resolvedCount: 2,
          noisyScore: 2,
          summaryNote: 'low noise',
        },
      },
      familyTrend: {
        jobName: 'autonomous:review',
        window: '14d',
        bucket: 'day',
        families: [
          {
            family: 'recovery_event',
            familyLabel: 'Recovery event',
            buckets: [],
            trendDirection: 'improving',
            totalOccurrences: 2,
            totalResolved: 2,
            avgPerBucket: 0.1,
            limitations: [],
          },
        ],
        overallSummary: 'recovery improving',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
      resolveDistribution: {
        jobName: 'autonomous:review',
        days: 30,
        families: [
          {
            family: 'recovery_event',
            familyLabel: 'Recovery event',
            resolvedCount: 2,
            unresolvedCount: 0,
            avgResolveTimeHours: 1,
            medianResolveTimeHours: 1,
            p90ResolveTimeHours: 1,
            maxResolveTimeHours: 1,
            unresolvedRatio: 0,
            distributionSummary: 'fast resolves',
            limitations: [],
          },
        ],
        overallSummary: 'fast resolves',
        limitations: [],
        generatedAt: '2026-03-31T12:00:00.000Z',
      },
    });

    const result = await engine.build({ jobName: 'autonomous:review', limit: 1, now: new Date('2026-03-31T12:00:00.000Z') });

    expect(result.recommendations[0].recommendationType).toBe('no_change_recommended');
    expect(result.recommendations[0].severity).toBe('info');
  });
});
