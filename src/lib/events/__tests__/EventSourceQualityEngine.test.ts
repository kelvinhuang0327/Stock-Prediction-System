import {
  assessEventSourceQuality,
  assessEventSourceQualityFromRecords,
  buildDegradedEventSourceQuality,
  type EventSourceQualityInput,
} from '../EventSourceQualityEngine';
import type { EventRecord } from '../EventIngestionService';

const emptyBreakdown = { official: 0, mainstream: 0, secondary: 0, unknown: 0 };

function makeInput(overrides: Partial<EventSourceQualityInput> = {}): EventSourceQualityInput {
  return {
    totalEvents: 0,
    rssCount: 0,
    mockCount: 0,
    trustLevelBreakdown: { ...emptyBreakdown },
    sourceTypeTracked: true,
    ...overrides,
  };
}

function makeRecord(sourceType: 'rss' | 'mock', trustLevel: 'official' | 'mainstream' | 'secondary' | 'unknown'): EventRecord {
  return {
    title: 'test',
    summary: 'test summary',
    publishedAt: new Date().toISOString(),
    relatedSymbols: [],
    relatedThemes: [],
    source: sourceType === 'rss' ? 'yahoo' : 'MockEventSource:IR',
    sourceType,
    trustLevel,
    rawUrl: null,
    dataCoverage: 'full',
    titleHash: 'abc123',
  };
}

describe('assessEventSourceQuality', () => {
  describe('INSUFFICIENT_EVENT_DATA cases', () => {
    it('returns INSUFFICIENT when totalEvents === 0', () => {
      const result = assessEventSourceQuality(makeInput({ totalEvents: 0 }));
      expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
      expect(result.confidenceAdjustment).toBe('STRONGLY_LOWER');
      expect(result.limitations.length).toBeGreaterThan(0);
    });

    it('returns INSUFFICIENT when sourceTypeTracked=false and events < 3', () => {
      const result = assessEventSourceQuality(
        makeInput({ totalEvents: 2, rssCount: 2, sourceTypeTracked: false }),
      );
      expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
      expect(result.confidenceAdjustment).toBe('LOWER');
    });

    it('returns INSUFFICIENT when sourceTypeTracked=true and totalEvents < 2', () => {
      const result = assessEventSourceQuality(makeInput({ totalEvents: 1, rssCount: 1 }));
      expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
      expect(result.confidenceAdjustment).toBe('STRONGLY_LOWER');
    });

    it('returns INSUFFICIENT when RSS count < 3 (not enough for confident)', () => {
      const result = assessEventSourceQuality(makeInput({ totalEvents: 2, rssCount: 2, mockCount: 0 }));
      expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
    });
  });

  describe('SIMULATION_DOMINATED cases', () => {
    it('returns SIMULATION_DOMINATED when no RSS events, only mock', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 5,
          rssCount: 0,
          mockCount: 5,
          trustLevelBreakdown: { official: 0, mainstream: 0, secondary: 5, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('SIMULATION_DOMINATED');
      expect(result.confidenceAdjustment).toBe('STRONGLY_LOWER');
      expect(result.limitations.some((l) => l.includes('mock'))).toBe(true);
    });

    it('returns SIMULATION_DOMINATED when mockRatio > 50%', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 10,
          rssCount: 4,
          mockCount: 6,
          trustLevelBreakdown: { official: 0, mainstream: 4, secondary: 6, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('SIMULATION_DOMINATED');
      expect(result.mockRatio).toBeCloseTo(0.6);
    });
  });

  describe('MIXED_SOURCE cases', () => {
    it('returns MIXED_SOURCE when mockRatio > 20% but <= 50%', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 10,
          rssCount: 7,
          mockCount: 3,
          trustLevelBreakdown: { official: 2, mainstream: 5, secondary: 3, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('MIXED_SOURCE');
      expect(result.confidenceAdjustment).toBe('LOWER');
    });

    it('returns MIXED_SOURCE when sourceTypeTracked=false and events >= 3 with good trust', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 5,
          rssCount: 5,
          sourceTypeTracked: false,
          trustLevelBreakdown: { official: 2, mainstream: 2, secondary: 1, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('MIXED_SOURCE');
      expect(result.confidenceAdjustment).toBe('LOWER');
      expect(result.limitations.some((l) => l.includes('資料庫'))).toBe(true);
    });

    it('returns MIXED_SOURCE when RSS is >= 3 but trust is mostly low', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 5,
          rssCount: 5,
          mockCount: 0,
          trustLevelBreakdown: { official: 0, mainstream: 1, secondary: 3, unknown: 1 },
        }),
      );
      expect(result.qualityLabel).toBe('MIXED_SOURCE');
    });
  });

  describe('LIVE_CONFIDENT cases', () => {
    it('returns LIVE_CONFIDENT when all RSS, >= 3, high trust ratio', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 5,
          rssCount: 5,
          mockCount: 0,
          trustLevelBreakdown: { official: 2, mainstream: 2, secondary: 1, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('LIVE_CONFIDENT');
      expect(result.confidenceAdjustment).toBe('NONE');
    });

    it('returns LIVE_CONFIDENT with small mock ratio (<=20%) and good trust', () => {
      const result = assessEventSourceQuality(
        makeInput({
          totalEvents: 10,
          rssCount: 9,
          mockCount: 1,
          trustLevelBreakdown: { official: 4, mainstream: 5, secondary: 1, unknown: 0 },
        }),
      );
      expect(result.qualityLabel).toBe('LIVE_CONFIDENT');
    });
  });

  describe('ratio computation', () => {
    it('computes rssRatio and mockRatio correctly', () => {
      const result = assessEventSourceQuality(
        makeInput({ totalEvents: 10, rssCount: 7, mockCount: 3 }),
      );
      expect(result.rssRatio).toBeCloseTo(0.7);
      expect(result.mockRatio).toBeCloseTo(0.3);
    });

    it('returns zero ratios when totalEvents is 0', () => {
      const result = assessEventSourceQuality(makeInput({ totalEvents: 0 }));
      expect(result.rssRatio).toBe(0);
      expect(result.mockRatio).toBe(0);
    });
  });
});

describe('assessEventSourceQualityFromRecords', () => {
  it('correctly counts rss/mock from EventRecord array', () => {
    const records: EventRecord[] = [
      makeRecord('rss', 'mainstream'),
      makeRecord('rss', 'mainstream'),
      makeRecord('rss', 'official'),
      makeRecord('rss', 'mainstream'),
    ];
    const result = assessEventSourceQualityFromRecords(records, true);
    expect(result.rssCount).toBe(4);
    expect(result.mockCount).toBe(0);
    expect(result.qualityLabel).toBe('LIVE_CONFIDENT');
  });

  it('labels mock-only records as SIMULATION_DOMINATED', () => {
    const records: EventRecord[] = [
      makeRecord('mock', 'secondary'),
      makeRecord('mock', 'secondary'),
      makeRecord('mock', 'secondary'),
    ];
    const result = assessEventSourceQualityFromRecords(records, true);
    expect(result.qualityLabel).toBe('SIMULATION_DOMINATED');
    expect(result.mockCount).toBe(3);
  });

  it('uses sourceTypeTracked=false for DB events conservatively', () => {
    // DB events have all sourceType='rss' hardcoded but may contain mocks
    const records: EventRecord[] = Array.from({ length: 5 }, () => makeRecord('rss', 'secondary'));
    const result = assessEventSourceQualityFromRecords(records, false);
    // Should be MIXED_SOURCE, not LIVE_CONFIDENT (can't confirm RSS origin)
    expect(result.qualityLabel).toBe('MIXED_SOURCE');
    expect(result.limitations.some((l) => l.includes('資料庫'))).toBe(true);
  });

  it('handles empty array → INSUFFICIENT', () => {
    const result = assessEventSourceQualityFromRecords([], true);
    expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
  });
});

describe('buildDegradedEventSourceQuality', () => {
  it('returns INSUFFICIENT with provided reason', () => {
    const result = buildDegradedEventSourceQuality('test reason');
    expect(result.qualityLabel).toBe('INSUFFICIENT_EVENT_DATA');
    expect(result.confidenceAdjustment).toBe('STRONGLY_LOWER');
    expect(result.limitations).toContain('test reason');
    expect(result.totalEvents).toBe(0);
  });
});
