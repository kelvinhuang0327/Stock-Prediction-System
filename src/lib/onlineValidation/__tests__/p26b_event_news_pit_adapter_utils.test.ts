/**
 * P26B Tests: Event/News PIT Adapter Utils
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

import {
  normalizeNewsEvent,
  isNewsEventVisibleAsOf,
  filterNewsEventsVisibleAsOf,
  buildEventNewsContextSnapshot,
  summarizeEventNewsContextForReason,
  validateEventNewsContextIsReadOnly,
  validateNoOutcomeFieldsInEventNewsContext,
  validateNoIngestedAtVisibilityLeak,
  classifyEventNewsPitStatus,
  NormalizedNewsEvent,
  RawNewsEvent,
} from '../P26BEventNewsPitAdapterUtils';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ASSET_DATE = '2026-05-13';
const SYMBOL = '2330';

function makeRaw(overrides: Partial<RawNewsEvent> = {}): RawNewsEvent {
  return {
    eventId: 'evt-test',
    symbol: SYMBOL,
    title: 'Test event',
    category: 'EARNINGS',
    publishedAt: '2026-05-10T09:00:00Z',
    ingestedAt: '2026-05-10T10:00:00Z',
    source: 'TWSE',
    sourceHash: 'sha256:testABC',
    severity: 'MEDIUM',
    relevanceScore: 0.7,
    ...overrides,
  };
}

function makeNormalized(overrides: Partial<NormalizedNewsEvent> = {}): NormalizedNewsEvent {
  return normalizeNewsEvent(makeRaw(overrides as Partial<RawNewsEvent>));
}

// ---------------------------------------------------------------------------
// normalizeNewsEvent
// ---------------------------------------------------------------------------

describe('normalizeNewsEvent', () => {
  it('handles complete raw event', () => {
    const e = normalizeNewsEvent(makeRaw());
    expect(e.eventId).toBe('evt-test');
    expect(e.symbol).toBe(SYMBOL);
    expect(e.publishedAt).toBe('2026-05-10T09:00:00Z');
    expect(e.ingestedAt).toBe('2026-05-10T10:00:00Z');
  });

  it('handles missing publishedAt → null', () => {
    const e = normalizeNewsEvent(makeRaw({ publishedAt: null }));
    expect(e.publishedAt).toBeNull();
  });

  it('handles missing ingestedAt → null', () => {
    const e = normalizeNewsEvent(makeRaw({ ingestedAt: undefined }));
    expect(e.ingestedAt).toBeNull();
  });

  it('does not mutate input', () => {
    const raw = makeRaw();
    const original = { ...raw };
    normalizeNewsEvent(raw);
    expect(raw).toEqual(original);
  });

  it('computes ingestionLagDays correctly', () => {
    const e = normalizeNewsEvent(makeRaw({
      publishedAt: '2026-05-10T00:00:00Z',
      ingestedAt: '2026-05-12T00:00:00Z',
    }));
    expect(e.ingestionLagDays).toBe(2);
  });

  it('ingestionLagDays null when publishedAt missing', () => {
    const e = normalizeNewsEvent(makeRaw({ publishedAt: null }));
    expect(e.ingestionLagDays).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isNewsEventVisibleAsOf — PIT tests
// ---------------------------------------------------------------------------

describe('isNewsEventVisibleAsOf', () => {
  it('CASE 1: visible — publishedAt before asOfDate, ingestedAt after asOfDate', () => {
    const e = normalizeNewsEvent(makeRaw({
      publishedAt: '2026-05-10T09:00:00Z',
      ingestedAt: '2026-05-15T08:00:00Z', // after asOf — must NOT block visibility
    }));
    expect(isNewsEventVisibleAsOf(e, ASSET_DATE)).toBe(true);
  });

  it('CASE 2: invisible — publishedAt after asOfDate, ingestedAt before asOfDate', () => {
    const e = normalizeNewsEvent(makeRaw({
      publishedAt: '2026-05-20T09:00:00Z', // future — must not be visible
      ingestedAt: '2026-05-12T08:00:00Z',  // early — must NOT grant visibility
    }));
    expect(isNewsEventVisibleAsOf(e, ASSET_DATE)).toBe(false);
  });

  it('CASE 4: invisible — missing publishedAt', () => {
    const e = normalizeNewsEvent(makeRaw({ publishedAt: null }));
    expect(isNewsEventVisibleAsOf(e, ASSET_DATE)).toBe(false);
  });

  it('CASE 5: visible — publishedAt on same day as asOfDate (Taiwan time)', () => {
    // UTC 15:59 = Taiwan 23:59 on 2026-05-13
    const e = normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-13T15:59:00Z' }));
    expect(isNewsEventVisibleAsOf(e, ASSET_DATE)).toBe(true);
  });

  it('invisible — publishedAt exactly one day after asOfDate', () => {
    const e = normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-14T00:00:00Z' }));
    expect(isNewsEventVisibleAsOf(e, ASSET_DATE)).toBe(false);
  });

  it('ingestedAt does not affect visibility decision', () => {
    // Two events with same publishedAt, different ingestedAt — same result
    const e1 = normalizeNewsEvent(makeRaw({ ingestedAt: '2026-04-01T00:00:00Z' }));
    const e2 = normalizeNewsEvent(makeRaw({ ingestedAt: '2026-06-01T00:00:00Z' }));
    expect(isNewsEventVisibleAsOf(e1, ASSET_DATE)).toBe(isNewsEventVisibleAsOf(e2, ASSET_DATE));
  });

  it('is deterministic — same inputs same output', () => {
    const e = normalizeNewsEvent(makeRaw());
    const r1 = isNewsEventVisibleAsOf(e, ASSET_DATE);
    const r2 = isNewsEventVisibleAsOf(e, ASSET_DATE);
    expect(r1).toBe(r2);
  });
});

// ---------------------------------------------------------------------------
// filterNewsEventsVisibleAsOf
// ---------------------------------------------------------------------------

describe('filterNewsEventsVisibleAsOf', () => {
  it('CASE 3: different symbol filtered out', () => {
    const events = [
      normalizeNewsEvent(makeRaw({ symbol: '0050', publishedAt: '2026-05-10T09:00:00Z' })),
      normalizeNewsEvent(makeRaw({ symbol: SYMBOL, publishedAt: '2026-05-10T09:00:00Z' })),
    ];
    const filtered = filterNewsEventsVisibleAsOf(events, ASSET_DATE, SYMBOL);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].symbol).toBe(SYMBOL);
  });

  it('filters out future publishedAt events', () => {
    const events = [
      normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-10T09:00:00Z' })),
      normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-20T09:00:00Z' })),
    ];
    const filtered = filterNewsEventsVisibleAsOf(events, ASSET_DATE, SYMBOL);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].publishedAt).toBe('2026-05-10T09:00:00Z');
  });

  it('does not mutate input array', () => {
    const events = [normalizeNewsEvent(makeRaw())];
    const original = [...events];
    filterNewsEventsVisibleAsOf(events, ASSET_DATE);
    expect(events).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// buildEventNewsContextSnapshot
// ---------------------------------------------------------------------------

describe('buildEventNewsContextSnapshot', () => {
  const rawEvents: RawNewsEvent[] = [
    makeRaw({ eventId: 'e1', sourceHash: 'sha256:e1', publishedAt: '2026-05-10T09:00:00Z', ingestedAt: '2026-05-15T00:00:00Z' }),
    makeRaw({ eventId: 'e2', sourceHash: 'sha256:e2', publishedAt: '2026-05-20T09:00:00Z' }), // future
    makeRaw({ eventId: 'e3', sourceHash: 'sha256:e3', symbol: '0050', publishedAt: '2026-05-10T09:00:00Z' }), // wrong symbol
    makeRaw({ eventId: 'e4', sourceHash: 'sha256:e4', publishedAt: null }), // missing
  ];

  it('readOnly is true', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    expect(snap.readOnly).toBe(true);
  });

  it('entersAlphaScore is false', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    expect(snap.entersAlphaScore).toBe(false);
  });

  it('visibilityGate is correct', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    expect(snap.visibilityGate).toBe('publishedAt <= asOfDate');
  });

  it('counts only VISIBLE events', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    expect(snap.visibleEventCount).toBe(1); // only e1 is visible for 2330
  });

  it('marks future event as FUTURE_PUBLISHED_AT_EXCLUDED', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    const future = snap.events.find(e => e.eventId === 'e2');
    expect(future?.pitVisibility).toBe('FUTURE_PUBLISHED_AT_EXCLUDED');
  });

  it('marks null publishedAt as INVALID_MISSING_PUBLISHED_AT', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    const invalid = snap.events.find(e => e.eventId === 'e4');
    expect(invalid?.pitVisibility).toBe('INVALID_MISSING_PUBLISHED_AT');
  });

  it('CASE 6: deduplicates by sourceHash', () => {
    const dupe: RawNewsEvent[] = [
      makeRaw({ eventId: 'a1', sourceHash: 'sha256:same', publishedAt: '2026-05-10T09:00:00Z' }),
      makeRaw({ eventId: 'a2', sourceHash: 'sha256:same', publishedAt: '2026-05-10T09:00:00Z' }),
    ];
    const snap = buildEventNewsContextSnapshot(dupe, ASSET_DATE, SYMBOL);
    expect(snap.events).toHaveLength(1);
  });

  it('does not include outcomePrice, returnPct, realizedReturnClass', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    const str = JSON.stringify(snap);
    expect(str).not.toContain('outcomePrice');
    expect(str).not.toContain('returnPct');
    expect(str).not.toContain('realizedReturnClass');
  });

  it('does not contain buy/sell/recommendation language', () => {
    const snap = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    const str = JSON.stringify(snap).toLowerCase();
    expect(str).not.toMatch(/\bbuy\b|\bsell\b|recommendation|guaranteed/);
  });

  it('is deterministic', () => {
    const s1 = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    const s2 = buildEventNewsContextSnapshot(rawEvents, ASSET_DATE, SYMBOL);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });
});

// ---------------------------------------------------------------------------
// summarizeEventNewsContextForReason
// ---------------------------------------------------------------------------

describe('summarizeEventNewsContextForReason', () => {
  it('returns neutral description when no visible events', () => {
    const snap = buildEventNewsContextSnapshot([], ASSET_DATE, SYMBOL);
    const summary = summarizeEventNewsContextForReason(snap);
    expect(summary.toLowerCase()).not.toMatch(/\bbuy\b|\bsell\b|roi|win.rate|profit|outperform|guaranteed/);
    expect(summary).toContain(ASSET_DATE);
  });

  it('returns neutral description with visible events', () => {
    const events = [makeRaw({ publishedAt: '2026-05-10T09:00:00Z' })];
    const snap = buildEventNewsContextSnapshot(events, ASSET_DATE, SYMBOL);
    const summary = summarizeEventNewsContextForReason(snap);
    expect(summary.toLowerCase()).not.toMatch(/\bbuy\b|\bsell\b|roi|win.rate|profit|outperform|guaranteed/);
    expect(summary).toContain('1');
  });

  it('does not produce investment recommendation language', () => {
    const events = [makeRaw({ publishedAt: '2026-05-10T09:00:00Z', category: 'EARNINGS' })];
    const snap = buildEventNewsContextSnapshot(events, ASSET_DATE, SYMBOL);
    const summary = summarizeEventNewsContextForReason(snap);
    expect(summary.toLowerCase()).not.toMatch(/should (buy|sell)|strong buy|target price/);
  });

  it('mentions read-only context metadata', () => {
    const events = [makeRaw({ publishedAt: '2026-05-10T09:00:00Z' })];
    const snap = buildEventNewsContextSnapshot(events, ASSET_DATE, SYMBOL);
    const summary = summarizeEventNewsContextForReason(snap);
    expect(summary.toLowerCase()).toContain('read-only context');
  });
});

// ---------------------------------------------------------------------------
// validateEventNewsContextIsReadOnly
// ---------------------------------------------------------------------------

describe('validateEventNewsContextIsReadOnly', () => {
  it('valid for correct snapshot', () => {
    const snap = buildEventNewsContextSnapshot([], ASSET_DATE, SYMBOL);
    const { valid } = validateEventNewsContextIsReadOnly(snap);
    expect(valid).toBe(true);
  });

  it('fails when readOnly is not true', () => {
    const snap = buildEventNewsContextSnapshot([], ASSET_DATE, SYMBOL);
    // @ts-expect-error
    snap.readOnly = false;
    const { valid, errors } = validateEventNewsContextIsReadOnly(snap);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('readOnly'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateNoOutcomeFieldsInEventNewsContext
// ---------------------------------------------------------------------------

describe('validateNoOutcomeFieldsInEventNewsContext', () => {
  it('valid for clean snapshot', () => {
    const snap = buildEventNewsContextSnapshot([], ASSET_DATE, SYMBOL);
    const { valid } = validateNoOutcomeFieldsInEventNewsContext(snap);
    expect(valid).toBe(true);
  });

  it('detects outcomePrice if injected', () => {
    const snap = buildEventNewsContextSnapshot([], ASSET_DATE, SYMBOL);
    (snap as Record<string, unknown>)['outcomePrice'] = 100;
    const { valid, foundForbiddenFields } = validateNoOutcomeFieldsInEventNewsContext(snap);
    expect(valid).toBe(false);
    expect(foundForbiddenFields).toContain('outcomePrice');
  });
});

// ---------------------------------------------------------------------------
// validateNoIngestedAtVisibilityLeak
// ---------------------------------------------------------------------------

describe('validateNoIngestedAtVisibilityLeak', () => {
  it('no leak for standard events', () => {
    const events = [
      normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-10T09:00:00Z', ingestedAt: '2026-05-15T00:00:00Z' })),
      normalizeNewsEvent(makeRaw({ publishedAt: '2026-05-20T09:00:00Z', ingestedAt: '2026-05-12T00:00:00Z' })),
    ];
    const { valid } = validateNoIngestedAtVisibilityLeak(events, ASSET_DATE);
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// classifyEventNewsPitStatus
// ---------------------------------------------------------------------------

describe('classifyEventNewsPitStatus', () => {
  it('correct counts for fixture events', () => {
    const events = [
      normalizeNewsEvent(makeRaw({ symbol: SYMBOL, publishedAt: '2026-05-10T09:00:00Z' })), // visible
      normalizeNewsEvent(makeRaw({ symbol: SYMBOL, publishedAt: '2026-05-20T09:00:00Z' })), // excluded
      normalizeNewsEvent(makeRaw({ symbol: SYMBOL, publishedAt: null })),                    // invalid
      normalizeNewsEvent(makeRaw({ symbol: '0050', publishedAt: '2026-05-10T09:00:00Z' })), // wrong symbol
    ];
    const result = classifyEventNewsPitStatus(events, ASSET_DATE, SYMBOL);
    expect(result.visibleCount).toBe(1);
    expect(result.excludedFutureCount).toBe(1);
    expect(result.invalidMissingPublishedAt).toBe(1);
    expect(result.wrongSymbolCount).toBe(1);
  });

  it('is deterministic', () => {
    const events = [normalizeNewsEvent(makeRaw())];
    const r1 = classifyEventNewsPitStatus(events, ASSET_DATE, SYMBOL);
    const r2 = classifyEventNewsPitStatus(events, ASSET_DATE, SYMBOL);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

// ---------------------------------------------------------------------------
// Source code integrity checks
// ---------------------------------------------------------------------------

describe('source code integrity', () => {
  it('has no Math.random', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../P26BEventNewsPitAdapterUtils.ts'), 'utf8'
    );
    // Check for actual Math.random() calls, not comments
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('has no external API calls', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../P26BEventNewsPitAdapterUtils.ts'), 'utf8'
    );
    expect(src).not.toMatch(/fetch\(|axios\.|https?\.(get|post)\(/);
  });

  it('does not import external modules', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../P26BEventNewsPitAdapterUtils.ts'), 'utf8'
    );
    expect(src).not.toMatch(/^import.*from ['"][^.]/m);
  });
});
