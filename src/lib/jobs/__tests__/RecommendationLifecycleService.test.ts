import { prisma } from '@/lib/prisma';
import { RecommendationHistoryService } from '../RecommendationHistoryService';
import { RecommendationLifecycleService } from '../RecommendationLifecycleService';
import type { PolicyRecommendationRow } from '../PolicyRecommendationEngine';

const jobNames = ['autonomous:daily', 'autonomous:monitor', 'autonomous:review', 'autonomous:learning'] as const;

function makeRecommendation(overrides: Partial<PolicyRecommendationRow> = {}): PolicyRecommendationRow {
  return {
    category: 'policy',
    targetJob: 'autonomous:monitor',
    targetFamily: 'missed_run',
    recommendationType: 'cooldown_increase',
    severity: 'warning',
    rationale: 'fast recovery and repeated noise',
    suggestedAction: 'Increase cooldown',
    confidence: 0.9,
    limitations: [],
    ...overrides,
  };
}

async function cleanup() {
  await prisma.recommendationHistory.deleteMany({
    where: { targetJob: { in: [...jobNames] } },
  });
}

describe('RecommendationLifecycleService', () => {
  const historyService = new RecommendationHistoryService();
  const lifecycleService = new RecommendationLifecycleService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('tracks resolved and reoccur lifecycle counts for a recommendation', async () => {
    const day1 = new Date('2026-04-01T12:00:00.000Z');
    const day2 = new Date('2026-04-02T12:00:00.000Z');
    const day3 = new Date('2026-04-03T12:00:00.000Z');
    const day4 = new Date('2026-04-04T12:00:00.000Z');

    const rec = makeRecommendation();
    await historyService.syncFromRecommendations([rec], day1, { resolveMissing: true, scopeJobs: ['autonomous:monitor'] });
    await historyService.syncFromRecommendations([], day2, { resolveMissing: true, scopeJobs: ['autonomous:monitor'] });
    await historyService.syncFromRecommendations([rec], day3, { resolveMissing: true, scopeJobs: ['autonomous:monitor'] });
    await historyService.syncFromRecommendations([], day4, { resolveMissing: true, scopeJobs: ['autonomous:monitor'] });

    const rows = await historyService.listHistory({ jobName: 'autonomous:monitor', status: 'all' });
    expect(rows).toHaveLength(1);

    const result = await lifecycleService.build({ recommendationKey: rows[0].recommendationKey }, day4);
    expect(result.recommendations).toHaveLength(1);
    expect(result.summary.total).toBe(1);
    expect(result.summary.resolvedCycles).toBeGreaterThanOrEqual(2);
    expect(result.summary.reoccurCount).toBeGreaterThanOrEqual(1);

    const lifecycle = result.recommendations[0];
    expect(lifecycle.currentStatus).toBe('resolved');
    expect(lifecycle.resolvedCount).toBeGreaterThanOrEqual(2);
    expect(lifecycle.reoccurCount).toBeGreaterThanOrEqual(1);
    expect(lifecycle.lifecycleSummary).toContain('Resolved');
  });

  test('returns empty degraded lifecycle when no matching recommendation exists', async () => {
    const result = await lifecycleService.build({ recommendationKey: 'missing-key' }, new Date('2026-04-05T12:00:00.000Z'));
    expect(result.recommendations).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });
});
