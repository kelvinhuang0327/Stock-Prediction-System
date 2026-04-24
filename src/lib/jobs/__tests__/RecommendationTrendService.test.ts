import { prisma } from '@/lib/prisma';
import { RecommendationHistoryService } from '../RecommendationHistoryService';
import { RecommendationTrendService } from '../RecommendationTrendService';
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

describe('RecommendationTrendService', () => {
  const historyService = new RecommendationHistoryService();
  const trendService = new RecommendationTrendService();

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  test('detects worsening trend when recommendation volume grows in the later window', async () => {
    const day1 = new Date('2026-04-03T12:00:00.000Z');
    const day2 = new Date('2026-04-04T12:00:00.000Z');
    const day3 = new Date('2026-04-05T12:00:00.000Z');
    const now = new Date('2026-04-05T18:00:00.000Z');

    await historyService.syncFromRecommendations([makeRecommendation()], day1, { resolveMissing: false });
    await historyService.syncFromRecommendations(
      [
        makeRecommendation(),
        makeRecommendation({
          targetFamily: 'failed_run',
          recommendationType: 'review_monitor_frequency',
          rationale: 'monitor cadence is bursty',
          suggestedAction: 'Review monitor frequency',
        }),
      ],
      day2,
      { resolveMissing: false },
    );
    await historyService.syncFromRecommendations(
      [
        makeRecommendation(),
        makeRecommendation({
          targetFamily: 'failed_run',
          recommendationType: 'review_monitor_frequency',
          rationale: 'monitor cadence is bursty',
          suggestedAction: 'Review monitor frequency',
        }),
        makeRecommendation({
          targetFamily: 'consecutive_failure',
          recommendationType: 'consider_severity_escalation',
          severity: 'critical',
          rationale: 'repeated failures are accumulating',
          suggestedAction: 'Consider severity escalation',
        }),
      ],
      day3,
      { resolveMissing: false },
    );

    const result = await trendService.build({ targetJob: 'autonomous:monitor' }, '7d', 'day', now);
    expect(result.summary.totalOccurrences).toBeGreaterThan(0);
    expect(result.summary.trendDirection).toBe('worsening');
    expect(result.buckets.some((bucket) => bucket.total > 0)).toBe(true);
  });

  test('detects stable trend when recommendation volume is balanced across halves', async () => {
    const day1 = new Date('2026-03-30T12:00:00.000Z');
    const day2 = new Date('2026-04-04T12:00:00.000Z');
    const now = new Date('2026-04-05T18:00:00.000Z');

    await historyService.syncFromRecommendations([makeRecommendation()], day1, { resolveMissing: false });
    await historyService.syncFromRecommendations(
      [
        makeRecommendation({
          targetFamily: 'failed_run',
          recommendationType: 'review_monitor_frequency',
          rationale: 'monitor cadence is bursty',
          suggestedAction: 'Review monitor frequency',
        }),
      ],
      day2,
      { resolveMissing: false },
    );

    const result = await trendService.build({ targetJob: 'autonomous:monitor' }, '7d', 'day', now);
    expect(result.summary.trendDirection).toBe('stable');
  });

  test('returns insufficient when no history exists', async () => {
    const result = await trendService.build({ targetJob: 'autonomous:monitor' }, '7d', 'day', new Date('2026-04-05T18:00:00.000Z'));
    expect(result.summary.trendDirection).toBe('insufficient');
    expect(result.buckets).toHaveLength(7);
  });
});
