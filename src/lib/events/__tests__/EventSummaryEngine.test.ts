import { summarizeEventBundle } from '../EventSummaryEngine';
import type { IngestedEventBundle } from '../EventIngestionService';

function emptyBundle(): IngestedEventBundle {
  return {
    events: [],
    rawCount: 0,
    dedupedCount: 0,
    sourceBreakdown: {},
    trustLevelSummary: {
      official: 0,
      mainstream: 0,
      secondary: 0,
      unknown: 0,
      dominant: 'mixed',
      note: '目前無可用事件來源。',
    },
    limitations: [],
    dataCoverage: 'insufficient',
  };
}

describe('EventSummaryEngine', () => {
  it('returns complete degraded structure for empty events', () => {
    const summary = summarizeEventBundle(emptyBundle());
    expect(summary.eventCount).toBe(0);
    expect(summary.rawCount).toBe(0);
    expect(summary.recentThemes).toEqual([]);
    expect(summary.catalystSummary.length).toBeGreaterThan(0);
    expect(summary.trustLevelSummary.unknown).toBe(0);
    expect(summary.dataCoverage).toBe('insufficient');
  });
});
