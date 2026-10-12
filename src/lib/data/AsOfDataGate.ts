/**
 * AsOfDataGate.ts — P0-01 As-of Date Gate / Future-Date Quarantine
 *
 * Ensures all MVP research queries only use data from asOfDate or earlier.
 * Provides future-date detection and quarantine without deleting any rows.
 *
 * SAFETY CONTRACT:
 * - P0-01: as-of data gate | future-date quarantine | research tool only
 * - no DB write, no external API, no LLM call
 * - no auto trading, no precision prediction claim
 * - no strategy mutation, no performance claim, no edge claim
 *
 * Not investment advice. Not a trading system.
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';

// ─── Constants ─────────────────────────────────────────────────────────────

export const P001_TASK_NAME = 'P0-01_AS_OF_DATA_GATE';

/** Minimum reasonable date for historical data (before this → anomalous). */
export const ABNORMAL_DATE_THRESHOLD = '2000-01-01';

/** Date format used in DB: YYYYMMDD string. */
export const DB_DATE_FORMAT = 'YYYYMMDD';

// ─── Errors ────────────────────────────────────────────────────────────────

export class InvalidAsOfDateError extends Error {
  constructor(input: unknown) {
    super(
      `P0-01 AsOfDataGate: invalid asOfDate input "${String(input)}". ` +
      `Expected YYYY-MM-DD format.`,
    );
    this.name = 'InvalidAsOfDateError';
  }
}

export class FutureDateViolationError extends Error {
  constructor(futureDates: string[], asOfDate: string) {
    super(
      `P0-01 AsOfDataGate: future-date violation detected. ` +
      `asOfDate=${asOfDate}, futureDates=[${futureDates.slice(0, 5).join(', ')}]`,
    );
    this.name = 'FutureDateViolationError';
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

/** Supported table names for as-of where clause generation. */
export type AsOfTableName =
  | 'StockQuote'
  | 'MarketIndex'
  | 'InstitutionalChip'
  | 'NewsEvent'
  | 'MonthlyRevenue'
  | 'FinancialReport';

/** As-of where clause for Prisma queries. */
export interface AsOfWhereClause {
  tableName: AsOfTableName;
  dateField: string;
  asOfDate: string;
  /** Ready-to-use Prisma where fragment. */
  prismaWhere: { date?: { lte: string }; reportDate?: { lte: string } };
}

/** Summary of future-date rows detected in a table. */
export interface FutureDateRowsSummary {
  tableName: string;
  asOfDate: string;
  futureRowCount: number;
  latestFutureDate: string | null;
  affectedSymbols: string[];
  /** PASS = no future rows; WARN = future rows exist but gate can exclude; FAIL = would contaminate query */
  status: 'PASS' | 'WARN' | 'FAIL';
  observabilityNote: string;
}

/** Summary of abnormal historical rows detected in a table. */
export interface AbnormalHistoricalRowsSummary {
  tableName: string;
  threshold: string;
  abnormalRowCount: number;
  earliestAbnormalDate: string | null;
  status: 'PASS' | 'WARN' | 'FAIL';
  observabilityNote: string;
}

/** Overall as-of data readiness summary. */
export interface AsOfDataReadinessSummary {
  asOfDate: string;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  futureDateSummaries: FutureDateRowsSummary[];
  abnormalHistoricalSummaries: AbnormalHistoricalRowsSummary[];
  passCount: number;
  warnCount: number;
  failCount: number;
  observabilityNote: string;
}

/** Injectable Prisma-like client for future-date detection (test-friendly). */
export interface AsOfGatePrismaLike {
  stockQuote: {
    findMany: (args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
      distinct?: string[];
    }) => Promise<{ date: string; stockId?: string }[]>;
  };
  marketIndex: {
    findMany: (args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
      distinct?: string[];
    }) => Promise<{ date: string }[]>;
  };
  institutionalChip: {
    findMany: (args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
      distinct?: string[];
    }) => Promise<{ date: string; stockId?: string }[]>;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const YYYYMMDD_REGEX = /^\d{8}$/;

/**
 * Normalizes a date string to YYYY-MM-DD for comparison.
 * Accepts both YYYY-MM-DD and YYYYMMDD formats.
 */
function normalizeToISO(dateStr: string): string {
  if (ISO_DATE_REGEX.test(dateStr)) return dateStr;
  if (YYYYMMDD_REGEX.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr; // Return as-is; will fail comparison
}

/**
 * Converts YYYY-MM-DD to YYYYMMDD for DB where clauses.
 * DB stores dates as YYYYMMDD strings.
 */
function toDbFormat(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Resolves the as-of date for research queries.
 *
 * - If no input provided: uses resolveCurrentDate() (no hardcoded TODAY_CAP)
 * - If valid YYYY-MM-DD provided: uses that date
 * - If invalid: throws InvalidAsOfDateError
 *
 * @param input - Optional explicit as-of date (YYYY-MM-DD)
 */
export function resolveAsOfDate(input?: string | null): string {
  if (input === undefined || input === null || input === '') {
    return resolveCurrentDate();
  }
  if (!ISO_DATE_REGEX.test(input)) {
    throw new InvalidAsOfDateError(input);
  }
  return input;
}

/**
 * Builds a Prisma-compatible where clause fragment to enforce date <= asOfDate.
 *
 * DB stores dates as YYYYMMDD strings — both YYYYMMDD and YYYY-MM-DD formats
 * are handled. The where clause uses string comparison (lexicographic), which
 * is correct for both formats as long as they are consistent.
 *
 * @param tableName - Which table to build clause for
 * @param asOfDate  - As-of date in YYYY-MM-DD format
 */
export function buildAsOfWhereClause(
  tableName: AsOfTableName,
  asOfDate: string,
): AsOfWhereClause {
  const resolvedAsOf = resolveAsOfDate(asOfDate);
  // DB stores as YYYYMMDD — convert for consistent comparison
  const dbAsOf = toDbFormat(resolvedAsOf);

  const dateFieldMap: Record<AsOfTableName, string> = {
    StockQuote: 'date',
    MarketIndex: 'date',
    InstitutionalChip: 'date',
    NewsEvent: 'date',
    MonthlyRevenue: 'date', // MonthlyRevenue uses year+month, but gate uses date field if present
    FinancialReport: 'date', // FinancialReport uses year+quarter, but gate uses date field if present
  };

  const dateField = dateFieldMap[tableName];

  // For most tables, date <= asOfDate (YYYYMMDD string comparison)
  const prismaWhere: AsOfWhereClause['prismaWhere'] = {
    date: { lte: dbAsOf },
  };

  return {
    tableName,
    dateField,
    asOfDate: resolvedAsOf,
    prismaWhere,
  };
}

/**
 * Asserts that no row in the provided list has a date after asOfDate.
 *
 * Throws FutureDateViolationError if any future date is found.
 * Never silently ignores future dates.
 *
 * @param dates    - Array of date strings (YYYY-MM-DD or YYYYMMDD)
 * @param asOfDate - Reference date in YYYY-MM-DD format
 */
export function assertNoFutureDateUsage(dates: string[], asOfDate: string): void {
  const resolvedAsOf = resolveAsOfDate(asOfDate);
  const futureDates = dates.filter(d => {
    const iso = normalizeToISO(d);
    return iso > resolvedAsOf;
  });
  if (futureDates.length > 0) {
    throw new FutureDateViolationError(futureDates, resolvedAsOf);
  }
}

/**
 * Detects future-date rows in StockQuote, MarketIndex, InstitutionalChip.
 *
 * Read-only: does NOT write or delete any rows.
 * Returns quarantine summary for observability.
 *
 * @param asOfDate     - Reference date (YYYY-MM-DD)
 * @param prismaClient - Injectable client for testing
 */
export async function detectFutureDateRows(
  asOfDate: string,
  prismaClient: AsOfGatePrismaLike,
): Promise<FutureDateRowsSummary[]> {
  const resolvedAsOf = resolveAsOfDate(asOfDate);
  const dbAsOf = toDbFormat(resolvedAsOf);
  const summaries: FutureDateRowsSummary[] = [];

  // StockQuote
  try {
    const futureRows = await prismaClient.stockQuote.findMany({
      where: { date: { gt: dbAsOf } as unknown as Record<string, unknown> },
      select: { date: true, stockId: true },
    });
    const affectedSymbols = [...new Set(futureRows.map(r => r.stockId ?? 'unknown'))];
    const latestFutureDate = futureRows.length > 0
      ? futureRows.map(r => normalizeToISO(r.date)).sort().at(-1) ?? null
      : null;
    summaries.push({
      tableName: 'StockQuote',
      asOfDate: resolvedAsOf,
      futureRowCount: futureRows.length,
      latestFutureDate,
      affectedSymbols,
      status: futureRows.length === 0 ? 'PASS' : 'WARN',
      observabilityNote:
        futureRows.length === 0
          ? 'No future-date rows in StockQuote.'
          : `${futureRows.length} future-date rows in StockQuote. ` +
            `buildAsOfWhereClause will exclude them from queries.`,
    });
  } catch {
    summaries.push({
      tableName: 'StockQuote',
      asOfDate: resolvedAsOf,
      futureRowCount: -1,
      latestFutureDate: null,
      affectedSymbols: [],
      status: 'WARN',
      observabilityNote: 'Could not query StockQuote for future-date detection.',
    });
  }

  // MarketIndex
  try {
    const futureRows = await prismaClient.marketIndex.findMany({
      where: { date: { gt: dbAsOf } as unknown as Record<string, unknown> },
      select: { date: true },
    });
    const latestFutureDate = futureRows.length > 0
      ? futureRows.map(r => normalizeToISO(r.date)).sort().at(-1) ?? null
      : null;
    summaries.push({
      tableName: 'MarketIndex',
      asOfDate: resolvedAsOf,
      futureRowCount: futureRows.length,
      latestFutureDate,
      affectedSymbols: [],
      status: futureRows.length === 0 ? 'PASS' : 'WARN',
      observabilityNote:
        futureRows.length === 0
          ? 'No future-date rows in MarketIndex.'
          : `${futureRows.length} future-date rows in MarketIndex. ` +
            `buildAsOfWhereClause will exclude them from queries.`,
    });
  } catch {
    summaries.push({
      tableName: 'MarketIndex',
      asOfDate: resolvedAsOf,
      futureRowCount: -1,
      latestFutureDate: null,
      affectedSymbols: [],
      status: 'WARN',
      observabilityNote: 'Could not query MarketIndex for future-date detection.',
    });
  }

  // InstitutionalChip
  try {
    const futureRows = await prismaClient.institutionalChip.findMany({
      where: { date: { gt: dbAsOf } as unknown as Record<string, unknown> },
      select: { date: true, stockId: true },
    });
    const affectedSymbols = [...new Set(futureRows.map(r => r.stockId ?? 'unknown'))];
    const latestFutureDate = futureRows.length > 0
      ? futureRows.map(r => normalizeToISO(r.date)).sort().at(-1) ?? null
      : null;
    summaries.push({
      tableName: 'InstitutionalChip',
      asOfDate: resolvedAsOf,
      futureRowCount: futureRows.length,
      latestFutureDate,
      affectedSymbols,
      status: futureRows.length === 0 ? 'PASS' : 'WARN',
      observabilityNote:
        futureRows.length === 0
          ? 'No future-date rows in InstitutionalChip.'
          : `${futureRows.length} future-date rows in InstitutionalChip. ` +
            `buildAsOfWhereClause will exclude them from queries.`,
    });
  } catch {
    summaries.push({
      tableName: 'InstitutionalChip',
      asOfDate: resolvedAsOf,
      futureRowCount: -1,
      latestFutureDate: null,
      affectedSymbols: [],
      status: 'WARN',
      observabilityNote: 'Could not query InstitutionalChip for future-date detection.',
    });
  }

  return summaries;
}

/**
 * Detects anomalous historical rows (e.g., dates around 1970).
 *
 * Read-only: does NOT write or delete any rows.
 *
 * @param dates         - Array of date strings from a table
 * @param tableName     - Name of the table being checked
 * @param threshold     - Dates before this are anomalous (default: ABNORMAL_DATE_THRESHOLD)
 */
export function detectAbnormalHistoricalRows(
  dates: string[],
  tableName: string,
  threshold: string = ABNORMAL_DATE_THRESHOLD,
): AbnormalHistoricalRowsSummary {
  const thresholdDb = toDbFormat(threshold);

  const abnormal = dates.filter(d => {
    const iso = normalizeToISO(d);
    const db = toDbFormat(iso);
    return db < thresholdDb;
  });

  const earliestAbnormal = abnormal.length > 0
    ? abnormal.map(d => normalizeToISO(d)).sort()[0]
    : null;

  return {
    tableName,
    threshold,
    abnormalRowCount: abnormal.length,
    earliestAbnormalDate: earliestAbnormal,
    status: abnormal.length === 0 ? 'PASS' : 'WARN',
    observabilityNote:
      abnormal.length === 0
        ? `No abnormal historical dates in ${tableName}.`
        : `${abnormal.length} dates before ${threshold} detected in ${tableName}. ` +
          `Earliest: ${earliestAbnormal}. Requires quarantine policy or data cleaning.`,
  };
}

/**
 * Validates overall as-of data readiness.
 *
 * Aggregates future-date and abnormal historical row detection.
 * Returns PASS/WARN/FAIL based on severity.
 *
 * FAIL: future rows would contaminate queries (gate not in place).
 * WARN: future rows exist but as-of gate can exclude them; or abnormal dates present.
 * PASS: no issues detected.
 *
 * @param futureDateSummaries       - From detectFutureDateRows()
 * @param abnormalHistoricalSummaries - From detectAbnormalHistoricalRows()
 * @param asOfDate                  - Reference as-of date
 */
export function validateAsOfDataReadiness(
  futureDateSummaries: FutureDateRowsSummary[],
  abnormalHistoricalSummaries: AbnormalHistoricalRowsSummary[],
  asOfDate: string,
): AsOfDataReadinessSummary {
  const resolvedAsOf = resolveAsOfDate(asOfDate);

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const s of [...futureDateSummaries, ...abnormalHistoricalSummaries]) {
    if (s.status === 'PASS') passCount++;
    else if (s.status === 'WARN') warnCount++;
    else failCount++;
  }

  let overallStatus: 'PASS' | 'WARN' | 'FAIL';
  if (failCount > 0) {
    overallStatus = 'FAIL';
  } else if (warnCount > 0) {
    overallStatus = 'WARN';
  } else {
    overallStatus = 'PASS';
  }

  return {
    asOfDate: resolvedAsOf,
    overallStatus,
    futureDateSummaries,
    abnormalHistoricalSummaries,
    passCount,
    warnCount,
    failCount,
    observabilityNote:
      'As-of data readiness check. Future rows flagged as WARN are excluded by ' +
      'buildAsOfWhereClause(). Not a strategy validation. Not investment advice.',
  };
}
