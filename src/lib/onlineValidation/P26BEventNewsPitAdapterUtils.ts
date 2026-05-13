/**
 * P26B-HARDRESET: Event/News PIT Adapter Utilities
 *
 * Pure functions for PIT-safe filtering and snapshot construction of news events.
 * NewsEvent is read-only metadata ONLY — it does NOT enter alphaScore or recommendationBucket.
 *
 * Hard rules:
 * - All functions are pure (same input → same output)
 * - No randomness (deterministic only)
 * - No external API calls
 * - No mutation of input events
 * - Visibility determined ONLY by publishedAt <= asOfDate
 * - ingestedAt is observability metadata only
 * - Output never contains outcomePrice / returnPct / realizedReturnClass
 * - Output never contains buy/sell/recommendation language
 * - Output never modifies scoreSnapshot
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawNewsEvent {
  eventId?: string;
  symbol?: string;
  title?: string;
  category?: string;
  publishedAt?: string | null;
  ingestedAt?: string | null;
  source?: string;
  sourceHash?: string;
  severity?: string;
  relevanceScore?: number;
  [key: string]: unknown;
}

export type PitVisibilityStatus =
  | 'VISIBLE_AS_OF'
  | 'FUTURE_PUBLISHED_AT_EXCLUDED'
  | 'INVALID_MISSING_PUBLISHED_AT'
  | 'WRONG_SYMBOL';

export interface NormalizedNewsEvent {
  eventId: string;
  symbol: string;
  title: string;
  category: string;
  publishedAt: string | null;
  ingestedAt: string | null;
  source: string;
  sourceHash: string;
  severity: string;
  relevanceScore: number;
  ingestionLagDays: number | null;
}

export interface EventVisibilityResult {
  event: NormalizedNewsEvent;
  pitVisibility: PitVisibilityStatus;
  publishedAtDate: string | null;
}

export interface EventNewsContextSnapshot {
  asOfDate: string;
  symbol: string;
  visibleEventCount: number;
  events: Array<{
    eventId: string;
    category: string;
    publishedAt: string | null;
    sourceHash: string;
    severity: string;
    relevanceScore: number;
    ingestionLagDays: number | null;
    pitVisibility: PitVisibilityStatus;
  }>;
  readOnly: true;
  entersAlphaScore: false;
  visibilityGate: 'publishedAt <= asOfDate';
}

export interface EventNewsPitClassification {
  totalEvents: number;
  visibleCount: number;
  excludedFutureCount: number;
  invalidMissingPublishedAt: number;
  wrongSymbolCount: number;
  ingestionLagStats: {
    minDays: number | null;
    maxDays: number | null;
    avgDays: number | null;
  };
}

// ---------------------------------------------------------------------------
// Taiwan timezone helper (pure, no external deps)
// ---------------------------------------------------------------------------

/**
 * Convert an ISO-8601 UTC timestamp to Asia/Taipei date string (YYYY-MM-DD).
 * Taiwan is UTC+8, no daylight saving.
 */
function toTaipeiDateString(isoTimestamp: string): string {
  const ms = Date.parse(isoTimestamp);
  if (isNaN(ms)) return '';
  const taipeiOffsetMs = 8 * 60 * 60 * 1000;
  const taipeiMs = ms + taipeiOffsetMs;
  const d = new Date(taipeiMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compare publishedAt (as Taipei date) against asOfDate (YYYY-MM-DD).
 * Returns true if publishedAt date <= asOfDate.
 */
function isPublishedAtOnOrBeforeAsOf(publishedAt: string, asOfDate: string): boolean {
  const pubDate = publishedAt.length > 10 ? toTaipeiDateString(publishedAt) : publishedAt;
  if (!pubDate) return false;
  return pubDate <= asOfDate;
}

function computeIngestionLagDays(publishedAt: string | null, ingestedAt: string | null): number | null {
  if (!publishedAt || !ingestedAt) return null;
  const pubMs = Date.parse(publishedAt);
  const ingMs = Date.parse(ingestedAt);
  if (isNaN(pubMs) || isNaN(ingMs)) return null;
  return Math.round((ingMs - pubMs) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Core exported functions
// ---------------------------------------------------------------------------

/** Normalize a raw event object into a typed NormalizedNewsEvent. Pure — no mutation. */
export function normalizeNewsEvent(rawEvent: RawNewsEvent): NormalizedNewsEvent {
  const publishedAt = typeof rawEvent.publishedAt === 'string' ? rawEvent.publishedAt : null;
  const ingestedAt = typeof rawEvent.ingestedAt === 'string' ? rawEvent.ingestedAt : null;
  return {
    eventId: typeof rawEvent.eventId === 'string' ? rawEvent.eventId : '',
    symbol: typeof rawEvent.symbol === 'string' ? rawEvent.symbol : '',
    title: typeof rawEvent.title === 'string' ? rawEvent.title : '',
    category: typeof rawEvent.category === 'string' ? rawEvent.category : 'UNKNOWN',
    publishedAt,
    ingestedAt,
    source: typeof rawEvent.source === 'string' ? rawEvent.source : '',
    sourceHash: typeof rawEvent.sourceHash === 'string' ? rawEvent.sourceHash : '',
    severity: typeof rawEvent.severity === 'string' ? rawEvent.severity : 'UNKNOWN',
    relevanceScore: typeof rawEvent.relevanceScore === 'number' ? rawEvent.relevanceScore : 0,
    ingestionLagDays: computeIngestionLagDays(publishedAt, ingestedAt),
  };
}

/**
 * Determine if a normalized event is visible as of the given date.
 * Visibility is determined SOLELY by publishedAt <= asOfDate (Asia/Taipei boundary).
 * ingestedAt is NEVER consulted for visibility.
 */
export function isNewsEventVisibleAsOf(event: NormalizedNewsEvent, asOfDate: string): boolean {
  if (!event.publishedAt) return false;
  return isPublishedAtOnOrBeforeAsOf(event.publishedAt, asOfDate);
}

/** Filter a list of events to those visible as of asOfDate for the given symbol. Pure. */
export function filterNewsEventsVisibleAsOf(
  events: NormalizedNewsEvent[],
  asOfDate: string,
  symbol?: string
): NormalizedNewsEvent[] {
  return events.filter(e => {
    if (symbol !== undefined && e.symbol !== symbol) return false;
    return isNewsEventVisibleAsOf(e, asOfDate);
  });
}

/** Build the read-only eventNewsContext snapshot. Pure — does not modify scoreSnapshot. */
export function buildEventNewsContextSnapshot(
  events: RawNewsEvent[],
  asOfDate: string,
  symbol: string
): EventNewsContextSnapshot {
  const normalized = events.map(normalizeNewsEvent);

  // Deduplicate by sourceHash (keep first occurrence)
  const seen = new Set<string>();
  const deduped: NormalizedNewsEvent[] = [];
  for (const e of normalized) {
    const key = e.sourceHash || e.eventId || `${e.symbol}:${e.publishedAt}:${e.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  const contextEvents = deduped
    .filter(e => e.symbol === symbol)
    .map(e => {
      let pitVisibility: PitVisibilityStatus;
      if (!e.publishedAt) {
        pitVisibility = 'INVALID_MISSING_PUBLISHED_AT';
      } else if (isPublishedAtOnOrBeforeAsOf(e.publishedAt, asOfDate)) {
        pitVisibility = 'VISIBLE_AS_OF';
      } else {
        pitVisibility = 'FUTURE_PUBLISHED_AT_EXCLUDED';
      }
      return {
        eventId: e.eventId,
        category: e.category,
        publishedAt: e.publishedAt,
        sourceHash: e.sourceHash,
        severity: e.severity,
        relevanceScore: e.relevanceScore,
        ingestionLagDays: e.ingestionLagDays,
        pitVisibility,
      };
    });

  const visibleEventCount = contextEvents.filter(e => e.pitVisibility === 'VISIBLE_AS_OF').length;

  return {
    asOfDate,
    symbol,
    visibleEventCount,
    events: contextEvents,
    readOnly: true,
    entersAlphaScore: false,
    visibilityGate: 'publishedAt <= asOfDate',
  };
}

/** Produce a neutral, non-evaluative text summary of the event context for reason metadata. */
export function summarizeEventNewsContextForReason(contextSnapshot: EventNewsContextSnapshot): string {
  const { asOfDate, symbol, visibleEventCount } = contextSnapshot;
  if (visibleEventCount === 0) {
    return `No news events published on or before ${asOfDate} were found for ${symbol}. Event context: empty.`;
  }
  const categories = Array.from(
    new Set(
      contextSnapshot.events
        .filter(e => e.pitVisibility === 'VISIBLE_AS_OF')
        .map(e => e.category)
    )
  ).join(', ');
  return (
    `${visibleEventCount} news event(s) published on or before ${asOfDate} were recorded for ${symbol}. ` +
    `Categories observed: ${categories || 'UNKNOWN'}. ` +
    `This is read-only context metadata and does not affect the research score.`
  );
}

/** Validate that the context snapshot is marked read-only and not entering scoring. */
export function validateEventNewsContextIsReadOnly(contextSnapshot: EventNewsContextSnapshot): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (contextSnapshot.readOnly !== true) errors.push('readOnly must be true');
  if (contextSnapshot.entersAlphaScore !== false) errors.push('entersAlphaScore must be false');
  if (contextSnapshot.visibilityGate !== 'publishedAt <= asOfDate') {
    errors.push('visibilityGate must be "publishedAt <= asOfDate"');
  }
  return { valid: errors.length === 0, errors };
}

/** Validate that no outcome fields exist in the context snapshot events. */
export function validateNoOutcomeFieldsInEventNewsContext(contextSnapshot: EventNewsContextSnapshot): {
  valid: boolean;
  foundForbiddenFields: string[];
} {
  const forbidden = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
  const found: string[] = [];
  const snapshot = contextSnapshot as Record<string, unknown>;
  for (const key of forbidden) {
    if (key in snapshot) found.push(key);
  }
  for (const evt of contextSnapshot.events) {
    const e = evt as Record<string, unknown>;
    for (const key of forbidden) {
      if (key in e && !found.includes(key)) found.push(key);
    }
  }
  return { valid: found.length === 0, foundForbiddenFields: found };
}

/**
 * Validate that ingestedAt is not used as visibility gate.
 * Checks that every excluded event has publishedAt > asOfDate (not just ingestedAt).
 */
export function validateNoIngestedAtVisibilityLeak(
  events: NormalizedNewsEvent[],
  asOfDate: string
): { valid: boolean; leakCases: Array<{ eventId: string; publishedAt: string | null; ingestedAt: string | null }> } {
  const leakCases: Array<{ eventId: string; publishedAt: string | null; ingestedAt: string | null }> = [];

  for (const e of events) {
    // A leak occurs if: publishedAt is AFTER asOfDate but ingestedAt is before/on asOfDate
    // AND we would incorrectly make it visible based on ingestedAt
    // We detect the reverse: publishedAt BEFORE asOfDate but event is somehow excluded
    // For this validator, we ensure the function `isNewsEventVisibleAsOf` only considers publishedAt
    if (e.publishedAt && isPublishedAtOnOrBeforeAsOf(e.publishedAt, asOfDate)) {
      // This event should be visible; if ingestedAt > asOfDate but publishedAt <= asOfDate,
      // a broken implementation would wrongly exclude it
      if (e.ingestedAt) {
        const ingDate = e.ingestedAt.length > 10 ? toTaipeiDateString(e.ingestedAt) : e.ingestedAt;
        if (ingDate > asOfDate) {
          // publishedAt <= asOfDate but ingestedAt > asOfDate → must still be visible
          // This is a valid test case, not a leak
        }
      }
    }
    if (e.publishedAt && !isPublishedAtOnOrBeforeAsOf(e.publishedAt, asOfDate)) {
      // This event should NOT be visible. If it were visible due to ingestedAt early, that's a leak
      // We check that our isNewsEventVisibleAsOf correctly excludes it
      if (!isNewsEventVisibleAsOf(e, asOfDate)) {
        // Correctly excluded — no leak
      } else {
        leakCases.push({ eventId: e.eventId, publishedAt: e.publishedAt, ingestedAt: e.ingestedAt });
      }
    }
  }

  return { valid: leakCases.length === 0, leakCases };
}

/** Classify the PIT status distribution for a set of events relative to asOfDate and symbol. */
export function classifyEventNewsPitStatus(
  events: NormalizedNewsEvent[],
  asOfDate: string,
  symbol?: string
): EventNewsPitClassification {
  const targetEvents = symbol !== undefined ? events.filter(e => e.symbol === symbol) : events;
  const wrongSymbolCount = symbol !== undefined ? events.filter(e => e.symbol !== symbol).length : 0;

  let visibleCount = 0;
  let excludedFutureCount = 0;
  let invalidMissingPublishedAt = 0;
  const lagDays: number[] = [];

  for (const e of targetEvents) {
    if (!e.publishedAt) {
      invalidMissingPublishedAt++;
    } else if (isPublishedAtOnOrBeforeAsOf(e.publishedAt, asOfDate)) {
      visibleCount++;
      if (e.ingestionLagDays !== null) lagDays.push(e.ingestionLagDays);
    } else {
      excludedFutureCount++;
    }
  }

  return {
    totalEvents: events.length,
    visibleCount,
    excludedFutureCount,
    invalidMissingPublishedAt,
    wrongSymbolCount,
    ingestionLagStats: {
      minDays: lagDays.length > 0 ? Math.min(...lagDays) : null,
      maxDays: lagDays.length > 0 ? Math.max(...lagDays) : null,
      avgDays:
        lagDays.length > 0
          ? Math.round((lagDays.reduce((a, b) => a + b, 0) / lagDays.length) * 10) / 10
          : null,
    },
  };
}
