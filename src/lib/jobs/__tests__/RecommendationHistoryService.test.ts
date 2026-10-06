import { prisma } from '@/lib/prisma';
import { RecommendationHistoryService } from '../RecommendationHistoryService';
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

describe('RecommendationHistoryService', () => {
  const service = new RecommendationHistoryService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('persists recommendations and increments occurrence count on a new day', async () => {
    const day1 = new Date('2026-03-31T12:00:00.000Z');
    const day2 = new Date('2026-04-01T12:00:00.000Z');
    const rec = makeRecommendation();

    const first = await service.syncFromRecommendations([rec], day1);
    expect(first.upserted).toBe(1);

    const stored1 = await service.listHistory({ jobName: 'autonomous:monitor' });
    expect(stored1).toHaveLength(1);
    expect(stored1[0].occurrenceCount).toBe(1);
    expect(stored1[0].status).toBe('active');

    const second = await service.syncFromRecommendations([rec], day2);
    expect(second.upserted).toBe(1);

    const stored2 = await service.listHistory({ jobName: 'autonomous:monitor' });
    expect(stored2).toHaveLength(1);
    expect(stored2[0].occurrenceCount).toBe(2);
  });

  test('resolves missing recommendations and reactivates when they reappear', async () => {
    const day1 = new Date('2026-03-31T12:00:00.000Z');
    const rec = makeRecommendation();

    await service.syncFromRecommendations([rec], day1, { resolveMissing: true, scopeJobs: ['autonomous:monitor'] });

    const resolved = await service.syncFromRecommendations([], new Date('2026-04-01T12:00:00.000Z'), {
      resolveMissing: true,
      scopeJobs: ['autonomous:monitor'],
    });
    expect(resolved.resolved).toBeGreaterThanOrEqual(1);

    const resolvedRows = await service.listHistory({ jobName: 'autonomous:monitor', status: 'resolved' });
    expect(resolvedRows.length).toBeGreaterThan(0);

    await service.syncFromRecommendations([rec], new Date('2026-04-02T12:00:00.000Z'), {
      resolveMissing: true,
      scopeJobs: ['autonomous:monitor'],
    });

    const activeRows = await service.listHistory({ jobName: 'autonomous:monitor', status: 'active' });
    expect(activeRows.length).toBe(1);
    expect(activeRows[0].occurrenceCount).toBeGreaterThanOrEqual(2);
  });

  test('summarizes recommendations by job and type', async () => {
    const now = new Date('2026-03-31T12:00:00.000Z');
    await service.syncFromRecommendations(
      [
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
      now,
      { resolveMissing: false },
    );

    const summary = await service.buildSummary();
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(2);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(1);
    expect(summary.topJobs.length).toBeGreaterThan(0);
    expect(summary.topTypes.length).toBeGreaterThan(0);
  });
});
