/**
 * RegimeContextLoader.ts — T-05C Persisted MarketRegimeResult Loader
 *
 * Read-only loader: queries persisted MarketRegimeResult records from DB
 * and transforms them into a Map<string, PersistedRegimeContext> for
 * injection into WalkForwardEngine.buildWalkForwardSkeleton().
 *
 * SAFETY CONTRACT:
 * - T-05C: read-only loader, persisted MarketRegimeResult only
 * - no regime recomputation
 * - no production write, no DB write (read query only)
 * - no external API, no LLM call
 * - no strategy mutation, no performance claim
 * - no H001-H012
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';
import { prisma } from '@/lib/prisma';
import { ALLOWED_LABELS } from '@/lib/marketRegimeResult';
import type { PersistedRegimeContext, RegimeLabel } from '@/lib/marketRegimeResult';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of a MarketRegimeResult row selected by loadRegimeContextMap. */
export interface RegimeResultRow {
  date: string;
  regimeLabel: string;
  confidence: number;
  taiexClose: number | null;
  source: string;
  version: string;
}

/** Minimal Prisma-compatible interface for testability (injectable). */
export interface PrismaClientLike {
  marketRegimeResult: {
    findMany: (args: {
      where?: { date?: { gte?: string; lte?: string } };
      orderBy?: { date: 'asc' | 'desc' };
      select?: Partial<Record<string, boolean>>;
    }) => Promise<RegimeResultRow[]>;
  };
}

/** Coverage summary returned by validateRegimeContextCoverage(). Observability only. */
export interface RegimeContextCoverageSummary {
  startDate: string;
  endDate: string;
  expectedDateCount: number;
  availableContextCount: number;
  missingContextCount: number;
  coverageRatio: number;
  firstAvailableDate: string | null;
  lastAvailableDate: string | null;
  status: 'PASS' | 'WARN' | 'FAIL';
  statusNote: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when normalizeRegimeContextDateKey receives an input it cannot parse. */
export class InvalidDateKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateKeyError';
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Generates weekday (Mon-Fri) dates in [startDate, endDate] for coverage estimation.
 * Simplified trading calendar approximation: excludes Sat/Sun only.
 */
function generateExpectedWeekdays(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Normalizes a Date object or date string to a YYYY-MM-DD key using UTC.
 *
 * Deterministic, locale-independent, timezone-stable.
 * Throws InvalidDateKeyError on unrecognized input.
 *
 * @param input - A Date object, ISO date string, or YYYY-MM-DD string
 */
export function normalizeRegimeContextDateKey(input: Date | string): string {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new InvalidDateKeyError(`Invalid Date object provided to normalizeRegimeContextDateKey`);
    }
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();

  // Accept bare YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      throw new InvalidDateKeyError(`Invalid YYYY-MM-DD value: "${s}"`);
    }
    return s;
  }

  // Attempt to parse full ISO string (e.g. YYYY-MM-DDTHH:MM:SSZ) → YYYY-MM-DD portion via UTC
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  throw new InvalidDateKeyError(`Cannot normalize to YYYY-MM-DD: "${input}"`);
}

/**
 * Maps a MarketRegimeResult DB row to PersistedRegimeContext.
 *
 * Only transfers observability/context fields:
 *   date, regimeLabel, confidence, taiexClose, source, version
 *
 * Fields intentionally excluded (raw market indicators used for regime computation):
 *   taiexMa50, taiexMa200, taiexReturn1d, taiexReturn20d, taiexVolatility20d,
 *   marketBreadthProxy, evidenceJson, missingFeaturesJson, pitSafetyJson
 *
 * Missing/null fields preserved as null. Unknown regimeLabel normalized to LOW_CONFIDENCE.
 *
 * @param row           - DB record from MarketRegimeResult
 * @param referenceDate - Optional reference date for freshness calculation.
 *                        Defaults to row.date (lag = 0) when omitted.
 */
export function mapMarketRegimeResultToPersistedContext(
  row: RegimeResultRow,
  referenceDate?: string,
): PersistedRegimeContext {
  const rowDate = resolveCurrentDate(row.date);
  const refDate = referenceDate ? resolveCurrentDate(referenceDate) : rowDate;

  const lagDays = Math.round(
    (new Date(refDate + 'T00:00:00Z').getTime() - new Date(rowDate + 'T00:00:00Z').getTime()) /
      86_400_000,
  );

  const regimeLabel: RegimeLabel = ALLOWED_LABELS.has(row.regimeLabel)
    ? (row.regimeLabel as RegimeLabel)
    : 'LOW_CONFIDENCE';

  let freshnessStatus: 'FRESH' | 'STALE' | 'MISSING' | 'FUTURE_DATE_ERROR';
  let warning: string | null = null;

  if (lagDays < 0) {
    freshnessStatus = 'FUTURE_DATE_ERROR';
    warning = `Regime date ${rowDate} is after reference date ${refDate}`;
  } else if (lagDays <= 3) {
    freshnessStatus = 'FRESH';
  } else {
    freshnessStatus = 'STALE';
    warning = `Regime data is ${lagDays} calendar days old`;
  }

  if (!ALLOWED_LABELS.has(row.regimeLabel)) {
    const labelNote = `Unknown regime label "${row.regimeLabel}" normalized to LOW_CONFIDENCE`;
    warning = warning ? `${warning}; ${labelNote}` : labelNote;
  }

  return {
    date: rowDate,
    regimeLabel,
    confidence: row.confidence,
    taiexClose: row.taiexClose,
    source: row.source,
    version: row.version,
    freshnessStatus,
    freshnessLagDays: lagDays,
    warning,
    isAvailable: true,
  };
}

/**
 * Loads persisted MarketRegimeResult for a date range and returns a
 * read-only Map<string, PersistedRegimeContext> for injection into
 * WalkForwardEngine.buildWalkForwardSkeleton().
 *
 * DB reads are SELECT only. No INSERT, UPDATE, or DELETE.
 * Returns an empty Map on DB error — never throws.
 * Empty Map is an explicit "unavailable" state in WalkForwardEngine.
 *
 * @param startDate - Start of date range (YYYY-MM-DD, inclusive)
 * @param endDate   - End of date range (YYYY-MM-DD, inclusive)
 * @param client    - Optional injectable Prisma-like client. Defaults to production prisma.
 */
export async function loadRegimeContextMap(
  startDate: string,
  endDate: string,
  client?: PrismaClientLike,
): Promise<Map<string, PersistedRegimeContext>> {
  const resolvedStart = resolveCurrentDate(startDate);
  const resolvedEnd = resolveCurrentDate(endDate);

  const db: PrismaClientLike = client ?? (prisma as unknown as PrismaClientLike);

  let rows: RegimeResultRow[];
  try {
    rows = await db.marketRegimeResult.findMany({
      where: {
        date: {
          gte: resolvedStart,
          lte: resolvedEnd,
        },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        regimeLabel: true,
        confidence: true,
        taiexClose: true,
        source: true,
        version: true,
      },
    });
  } catch {
    // Explicit unavailable state — do not throw
    return new Map();
  }

  const contextMap = new Map<string, PersistedRegimeContext>();
  for (const row of rows) {
    try {
      const key = normalizeRegimeContextDateKey(row.date);
      const ctx = mapMarketRegimeResultToPersistedContext(row);
      contextMap.set(key, ctx);
    } catch {
      // Skip unparseable row dates — preserves partial coverage
    }
  }

  return contextMap;
}

/**
 * Validates regime context map coverage against expected weekday trading dates.
 *
 * Returns an observability coverage summary with PASS / WARN / FAIL status.
 * No performance fields. No strategy claims.
 *
 * Coverage thresholds:
 *   PASS  — coverage >= 90%
 *   WARN  — coverage 50%–89%
 *   FAIL  — coverage < 50%
 *
 * @param startDate  - Start of date range (YYYY-MM-DD)
 * @param endDate    - End of date range (YYYY-MM-DD)
 * @param contextMap - Loaded context map from loadRegimeContextMap()
 */
export function validateRegimeContextCoverage(
  startDate: string,
  endDate: string,
  contextMap: Map<string, PersistedRegimeContext>,
): RegimeContextCoverageSummary {
  const resolvedStart = resolveCurrentDate(startDate);
  const resolvedEnd = resolveCurrentDate(endDate);

  const expectedDates = generateExpectedWeekdays(resolvedStart, resolvedEnd);
  const expectedDateCount = expectedDates.length;

  const availableDates = expectedDates.filter(d => contextMap.has(d));
  const availableContextCount = availableDates.length;
  const missingContextCount = expectedDateCount - availableContextCount;

  const coverageRatio =
    expectedDateCount === 0
      ? 0
      : Math.round((availableContextCount / expectedDateCount) * 10000) / 10000;

  const firstAvailableDate = availableDates.length > 0 ? availableDates[0] : null;
  const lastAvailableDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : null;

  let status: 'PASS' | 'WARN' | 'FAIL';
  let statusNote: string;

  if (expectedDateCount === 0) {
    status = 'WARN';
    statusNote = 'No expected trading dates in range. Coverage cannot be evaluated.';
  } else if (coverageRatio >= 0.9) {
    status = 'PASS';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% meets 90% threshold. Adequate for walk-forward skeleton.`;
  } else if (coverageRatio >= 0.5) {
    status = 'WARN';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% is below 90% threshold. Partial context only.`;
  } else {
    status = 'FAIL';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% is below 50%. Walk-forward skeleton context mostly MISSING.`;
  }

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
    expectedDateCount,
    availableContextCount,
    missingContextCount,
    coverageRatio,
    firstAvailableDate,
    lastAvailableDate,
    status,
    statusNote,
  };
}
