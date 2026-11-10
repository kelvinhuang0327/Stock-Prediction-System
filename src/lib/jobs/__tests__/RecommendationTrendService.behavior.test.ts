import { RecommendationHistoryService, type RecommendationHistoryRecord } from '../RecommendationHistoryService';
import { RecommendationTrendService } from '../RecommendationTrendService';

const NOW = new Date('2026-04-05T18:00:00.000Z');

function makeHistoryRecord(overrides: Partial<RecommendationHistoryRecord> = {}): RecommendationHistoryRecord {
  return {
    id: 1,
    recommendationKey: 'cooldown_increase|autonomous:monitor|missed_run',
    recommendationType: 'cooldown_increase',
    targetJob: 'autonomous:monitor',
    targetFamily: 'missed_run',
    severity: 'warning',
    rationale: 'Repeated missed runs need a longer cooldown.',
    suggestedAction: 'Increase cooldown.',
    confidence: 0.8,
    status: 'active',
    firstDetectedAt: '2026-03-30T12:00:00.000Z',
    lastDetectedAt: '2026-04-01T12:00:00.000Z',
    resolvedAt: null,
    occurrenceCount: 1,
    metadata: null,
    createdAt: '2026-03-30T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  };
}

function createService(rows: RecommendationHistoryRecord[]) {
  const historyService = {
    listHistory: jest.fn().mockResolvedValue(rows),
  };
  const trendService = new RecommendationTrendService(
    historyService as unknown as RecommendationHistoryService,
  );
  return { trendService, historyService };
}

describe('RecommendationTrendService timeline and window behavior', () => {
  it('uses the 14-day weekly window and forwards recommendation filters', async () => {
    const { trendService, historyService } = createService([]);

    const result = await trendService.build({
      targetJob: 'autonomous:monitor',
      recommendationType: 'cooldown_increase',
      status: 'active',
    }, '14d', 'week', NOW);

    expect(historyService.listHistory).toHaveBeenCalledWith({
      jobName: 'autonomous:monitor',
      recommendationType: 'cooldown_increase',
      status: 'active',
      sortBy: 'latest',
      sortDir: 'desc',
      limit: 500,
      offset: 0,
    }, NOW);
    expect(result).toMatchObject({
      recommendationType: 'cooldown_increase',
      targetJob: 'autonomous:monitor',
      status: 'active',
      window: '14d',
      bucket: 'week',
      summary: {
        windowDays: 14,
        bucketSizeDays: 7,
        bucketCount: 2,
        periodStart: '2026-03-23T00:00:00.000Z',
      },
    });
    expect(result.buckets[0].label).toBe('Week of 2026-03-23');
    expect(result.limitations).toEqual(expect.arrayContaining([
      'No recommendation history found in the selected trend window.',
      'Recommendation trend is sparse, so direction should be read conservatively.',
      'Weekly bucketing smooths spikes, so short-lived bursts may be muted.',
    ]));

    const monthly = await trendService.build({}, '30d', 'day', NOW);
    expect(monthly.summary.windowDays).toBe(30);
    expect(monthly.summary.bucketCount).toBe(30);
    expect(monthly.targetJob).toBeNull();
    expect(monthly.status).toBe('all');
  });

  it('detects oscillating and improving volume across daily buckets', async () => {
    const oscillating = makeHistoryRecord({
      metadata: JSON.stringify({
        observationTimeline: {
          '2026-03-30': 1,
          '2026-03-31': 5,
          '2026-04-01': 2,
          '2026-04-02': 5,
        },
      }),
    });
    const { trendService } = createService([oscillating]);
    const oscillatingResult = await trendService.build({}, '7d', 'day', NOW);
    expect(oscillatingResult.summary.trendDirection).toBe('oscillating');
    expect(oscillatingResult.summary.totalOccurrences).toBe(13);

    const improving = makeHistoryRecord({
      metadata: JSON.stringify({ observationTimeline: { '2026-03-30': 5, '2026-04-03': 1 } }),
    });
    const improvingService = createService([improving]).trendService;
    const improvingResult = await improvingService.build({}, '7d', 'day', NOW);
    expect(improvingResult.summary.trendDirection).toBe('improving');
  });

  it('uses fallback timestamps for active and resolved rows when timelines are missing', async () => {
    const active = makeHistoryRecord({ occurrenceCount: 3 });
    const resolved = makeHistoryRecord({
      id: 2,
      status: 'resolved',
      firstDetectedAt: '2026-03-30T10:00:00.000Z',
      lastDetectedAt: '2026-04-01T10:00:00.000Z',
      resolvedAt: '2026-04-02T10:00:00.000Z',
      occurrenceCount: 2,
    });
    const { trendService } = createService([active, resolved]);

    const result = await trendService.build({}, '7d', 'day', NOW);

    expect(result.summary.totalOccurrences).toBe(7);
    expect(result.summary.totalResolved).toBe(1);
    expect(result.summary.peakBucket).toBe(4);
    expect(result.buckets.find((point) => point.date === '2026-04-01')).toMatchObject({ total: 3, active: 1 });
    expect(result.buckets.find((point) => point.date === '2026-04-02')).toMatchObject({ total: 4, resolved: 1 });
  });

  it('parses numeric timeline strings and ignores malformed, old, or out-of-window dates', async () => {
    const record = makeHistoryRecord({
      metadata: JSON.stringify({
        observationTimeline: {
          '2026-04-01': '4.5 occurrences',
          'invalid-date': 8,
          '2026-03-29': 7,
          '2026-04-02': 'not-a-number',
          '2026-04-06': 9,
          ignoredBoolean: true,
          ignoredNull: null,
        },
        resolutionTimeline: {
          '2026-04-02': '2',
          '2026-04-07': 6,
        },
      }),
    });
    const invalidJson = makeHistoryRecord({ id: 2, metadata: '{not-json', lastDetectedAt: 'bad-date' });
    const arrayMetadata = makeHistoryRecord({ id: 3, metadata: '[]', lastDetectedAt: '2026-03-29T12:00:00.000Z' });
    const { trendService } = createService([record, invalidJson, arrayMetadata]);

    const result = await trendService.build({}, '7d', 'day', NOW);

    expect(result.summary.totalOccurrences).toBe(6.5);
    expect(result.summary.totalResolved).toBe(2);
    expect(result.buckets.find((point) => point.date === '2026-04-01')).toMatchObject({ total: 4.5, active: 4.5 });
    expect(result.buckets.find((point) => point.date === '2026-04-02')).toMatchObject({ total: 2, resolved: 2 });
  });

  it('counts a resolution-only timeline and excludes malformed or out-of-window rows', async () => {
    const resolutionOnly = makeHistoryRecord({
      metadata: JSON.stringify({ resolutionTimeline: { '2026-04-03': 2 } }),
      status: 'resolved',
      occurrenceCount: 0,
    });
    const stale = makeHistoryRecord({
      id: 2,
      status: 'stale',
      metadata: JSON.stringify({ observationTimeline: ['2026-04-01'] }),
      lastDetectedAt: 'bad-date',
      firstDetectedAt: 'bad-date',
    });
    const { trendService } = createService([resolutionOnly, stale]);

    const result = await trendService.build({}, '7d', 'day', NOW);

    expect(result.summary.totalOccurrences).toBe(2);
    expect(result.summary.totalResolved).toBe(2);
    expect(result.buckets.find((point) => point.date === '2026-04-03')).toMatchObject({ total: 2, resolved: 2 });
    expect(result.limitations).not.toContain('No recommendation history found in the selected trend window.');
  });
});
