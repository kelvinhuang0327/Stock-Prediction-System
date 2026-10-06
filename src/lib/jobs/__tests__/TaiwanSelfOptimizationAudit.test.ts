import { buildTaiwanSelfAuditRecommendations } from '../TaiwanSelfOptimizationAudit';

describe('buildTaiwanSelfAuditRecommendations', () => {
  test('produces P0, P1, and P2 recommendations from existing health signals', () => {
    const recommendations = buildTaiwanSelfAuditRecommendations({
      schedulerEnabled: false,
      queuedOptimizationTasks: 4,
      runningOptimizationTasks: 1,
      missedCriticalJobs: ['training:tw-worker-cycle'],
      activeInsights: 12,
      failedJobs: ['training:tw-optimization-miner'],
      delayedJobs: ['training:tw-insight-ingest'],
    });

    expect(recommendations.some((rec) => rec.severity === 'P0')).toBe(true);
    expect(recommendations.some((rec) => rec.severity === 'P1')).toBe(true);
    expect(recommendations.some((rec) => rec.severity === 'P2')).toBe(true);
  });
});