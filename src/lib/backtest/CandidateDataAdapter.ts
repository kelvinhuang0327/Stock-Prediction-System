/**
 * CandidateDataAdapter.ts — T-05E PIT-safe Candidate Data Adapter
 *
 * Point-in-time safe read-only candidate snapshot adapter for WalkForwardEngine.
 * Ensures candidate data is only sourced from rebalanceDate or earlier.
 *
 * SAFETY CONTRACT:
 * - T-05E: PIT-safe candidate data adapter | read-only candidate snapshots
 * - sourceDate <= rebalanceDate (no future data leak)
 * - no DB write, no external API, no LLM call
 * - no strategy mutation, no performance claim, no edge claim
 * - no H001-H012
 *
 * This is NOT a trading recommendation. NOT investment advice.
 * NOT ROI evidence. NOT win-rate evidence. NOT proof of any edge.
 */

import { resolveCurrentDate } from '@/lib/time/currentDate';

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when normalizeCandidateSnapshotDateKey receives input it cannot parse. */
export class InvalidCandidateSnapshotDateKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCandidateSnapshotDateKeyError';
  }
}

// ─── Prisma-like Injectable Interface ────────────────────────────────────────

/**
 * Raw DB row shape expected from StockQuote + Stock join.
 * Maps to what Prisma would return with `include: { stock: true }`.
 */
export interface CandidateRawRow {
  stockId: string;
  date: string; // DB-native date string (YYYYMMDD or YYYY-MM-DD)
  close?: number | null;
  volume?: number | null;
  stock?: {
    name?: string | null;
    industry?: string | null;
    listingDate?: string | null;
  } | null;
}

/**
 * Minimal injectable Prisma-like client interface for CandidateDataAdapter.
 * Enables test mocking without real DB dependency.
 */
export interface CandidateAdapterPrismaLike {
  stockQuote: {
    findMany: (args: {
      where: {
        date: { lte: string };
        stockId?: { in: string[] };
      };
      include?: { stock?: boolean };
      orderBy?: Array<{ stockId?: 'asc' | 'desc'; date?: 'asc' | 'desc' }>;
      take?: number;
      distinct?: string[];
    }) => Promise<CandidateRawRow[]>;
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Observability-only status for a single candidate snapshot. */
export type CandidateDataAvailabilityStatus =
  | 'AVAILABLE'
  | 'MISSING'
  | 'STALE'
  | 'INVALID_FUTURE_DATE'
  | 'INSUFFICIENT_DATA';

/**
 * Observability-only candidate snapshot.
 *
 * Contains only neutral data availability metadata.
 * No strategy fields. No performance fields. No forbidden terms.
 */
export interface CandidateSnapshot {
  /** Stock symbol / ticker. */
  symbol: string;
  /** Reference date for this snapshot query (YYYY-MM-DD). */
  snapshotDate: string;
  /** The actual date of the source data used (YYYY-MM-DD). */
  sourceDate: string | null;
  /** Days between sourceDate and snapshotDate (lower = fresher). Null if sourceDate missing. */
  dataFreshnessDays: number | null;
  /** Observability availability status. */
  dataAvailabilityStatus: CandidateDataAvailabilityStatus;
  /** Neutral observability fields available in source record. */
  observableFields: {
    hasClose: boolean;
    hasVolume: boolean;
    hasIndustry: boolean;
    hasListingDate: boolean;
  };
  /**
   * Deterministic sort key for rule-only ranking.
   * Based on alphabetical symbol order — not a strategy selection.
   */
  ruleOnlySortKey: string;
  /** Reasons this candidate was flagged or excluded (observability only). */
  exclusionReasons: string[];
  /** Label identifying the data source used. */
  sourceLabel: string;
}

/** Configuration for loadCandidateSnapshotsForDate(). */
export interface CandidateSnapshotLoadConfig {
  /** Maximum number of candidates to return. */
  maxCandidates?: number;
  /**
   * Maximum allowed staleness in calendar days.
   * If sourceDate is more than minDataFreshnessDays before rebalanceDate,
   * candidate is marked STALE.
   */
  minDataFreshnessDays?: number;
  /** If provided, only return snapshots for these symbols. */
  allowedSymbols?: string[];
  /** Label for the data source (used in sourceLabel field). */
  dataSourceLabel?: string;
}

/** Result from loadCandidateSnapshotsForDate(). */
export interface CandidateSnapshotLoadResult {
  rebalanceDate: string;
  snapshots: CandidateSnapshot[];
  candidateSource: 'PIT_SAFE_CANDIDATE_SNAPSHOT';
  totalLoaded: number;
  observabilityNote: string;
}

/** Freshness validation result for a single candidate snapshot. */
export interface CandidateSnapshotFreshnessResult {
  symbol: string;
  rebalanceDate: string;
  sourceDate: string | null;
  dataFreshnessDays: number | null;
  status: 'PASS' | 'WARN' | 'FAIL';
  statusNote: string;
}

/** Coverage summary for a set of candidate snapshots. */
export interface CandidateSnapshotCoverageSummary {
  candidateCount: number;
  availableCount: number;
  missingCount: number;
  staleCount: number;
  invalidFutureDataCount: number;
  coverageRatio: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  statusNote: string;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Converts a date string from YYYYMMDD to YYYY-MM-DD.
 * Returns the input unchanged if it already looks like YYYY-MM-DD.
 */
function normalizeDateFromDb(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

/**
 * Converts YYYY-MM-DD to YYYYMMDD for DB-native date comparison.
 * Handles both formats gracefully.
 */
function toDbDateFormat(dateStr: string): string {
  if (/^\d{8}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.replace(/-/g, '');
  return dateStr;
}

/** Compute calendar days between two YYYY-MM-DD dates. */
function daysBetween(earlier: string, later: string): number {
  const a = new Date(earlier + 'T00:00:00Z');
  const b = new Date(later + 'T00:00:00Z');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Exported Functions ───────────────────────────────────────────────────────

/**
 * Normalizes a Date or date string to YYYY-MM-DD.
 *
 * Deterministic, timezone-stable (UTC-based).
 * Throws InvalidCandidateSnapshotDateKeyError on invalid input.
 *
 * @param input - A Date object, ISO string, or YYYY-MM-DD / YYYYMMDD string
 */
export function normalizeCandidateSnapshotDateKey(input: Date | string): string {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new InvalidCandidateSnapshotDateKeyError(
        `Invalid Date object provided to normalizeCandidateSnapshotDateKey`,
      );
    }
    return input.toISOString().slice(0, 10);
  }

  const s = String(input).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      throw new InvalidCandidateSnapshotDateKeyError(`Invalid YYYY-MM-DD value: "${s}"`);
    }
    return s;
  }

  // YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(s)) {
    const normalized = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const d = new Date(normalized + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      throw new InvalidCandidateSnapshotDateKeyError(`Invalid YYYYMMDD value: "${s}"`);
    }
    return normalized;
  }

  // ISO-like string
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  throw new InvalidCandidateSnapshotDateKeyError(
    `Cannot normalize to YYYY-MM-DD: "${input}"`,
  );
}

/**
 * Maps a raw DB row (StockQuote + Stock) to a PIT-safe observability-only CandidateSnapshot.
 *
 * Only preserves observability / data-availability fields.
 * Does NOT output strategy fields, performance fields, or forbidden terms.
 * Missing fields are explicitly flagged — never auto-filled.
 *
 * @param row          - Raw DB row from stockQuote.findMany()
 * @param rebalanceDate - Reference date (YYYY-MM-DD) — PIT boundary
 * @param sourceLabel  - Label for the data source
 */
export function mapStockDataToCandidateSnapshot(
  row: CandidateRawRow,
  rebalanceDate: string,
  sourceLabel: string = 'STOCK_QUOTE_DB',
): CandidateSnapshot {
  const symbol = row.stockId;
  const snapshotDate = rebalanceDate;
  const rawSourceDate = row.date ? normalizeDateFromDb(row.date) : null;

  let dataFreshnessDays: number | null = null;
  let dataAvailabilityStatus: CandidateDataAvailabilityStatus;
  const exclusionReasons: string[] = [];

  if (!rawSourceDate) {
    dataAvailabilityStatus = 'MISSING';
    exclusionReasons.push('source-date-missing');
  } else if (rawSourceDate > rebalanceDate) {
    // PIT violation — future data
    dataAvailabilityStatus = 'INVALID_FUTURE_DATE';
    exclusionReasons.push(`pit-violation: sourceDate ${rawSourceDate} > rebalanceDate ${rebalanceDate}`);
    dataFreshnessDays = daysBetween(rebalanceDate, rawSourceDate); // positive = future
  } else {
    dataFreshnessDays = daysBetween(rawSourceDate, rebalanceDate);
    if (dataFreshnessDays === 0 || dataFreshnessDays <= 7) {
      dataAvailabilityStatus = 'AVAILABLE';
    } else if (dataFreshnessDays <= 30) {
      dataAvailabilityStatus = 'STALE';
      exclusionReasons.push(`stale-data: ${dataFreshnessDays} days old`);
    } else {
      dataAvailabilityStatus = 'INSUFFICIENT_DATA';
      exclusionReasons.push(`insufficient: data ${dataFreshnessDays} days old`);
    }
  }

  return {
    symbol,
    snapshotDate,
    sourceDate: rawSourceDate,
    dataFreshnessDays,
    dataAvailabilityStatus,
    observableFields: {
      hasClose: row.close !== null && row.close !== undefined,
      hasVolume: row.volume !== null && row.volume !== undefined,
      hasIndustry: !!(row.stock?.industry),
      hasListingDate: !!(row.stock?.listingDate),
    },
    ruleOnlySortKey: symbol, // Alphabetical deterministic sort key
    exclusionReasons,
    sourceLabel,
  };
}

/**
 * Validates that a candidate snapshot's sourceDate does not exceed rebalanceDate.
 *
 * Returns FAIL if sourceDate > rebalanceDate (PIT violation).
 * Returns WARN if sourceDate is null/missing.
 * Returns PASS if sourceDate <= rebalanceDate and data is available.
 *
 * Does NOT auto-correct invalid snapshots.
 *
 * @param rebalanceDate - Reference date (YYYY-MM-DD) — PIT boundary
 * @param snapshot      - Candidate snapshot to validate
 */
export function validateCandidateSnapshotFreshness(
  rebalanceDate: string,
  snapshot: CandidateSnapshot,
): CandidateSnapshotFreshnessResult {
  const { symbol, sourceDate, dataFreshnessDays } = snapshot;

  if (sourceDate === null || sourceDate === undefined) {
    return {
      symbol,
      rebalanceDate,
      sourceDate: null,
      dataFreshnessDays: null,
      status: 'WARN',
      statusNote: `sourceDate is missing for candidate ${symbol}. Cannot verify PIT safety.`,
    };
  }

  if (sourceDate > rebalanceDate) {
    return {
      symbol,
      rebalanceDate,
      sourceDate,
      dataFreshnessDays,
      status: 'FAIL',
      statusNote: `PIT VIOLATION: sourceDate ${sourceDate} is after rebalanceDate ${rebalanceDate} for candidate ${symbol}.`,
    };
  }

  return {
    symbol,
    rebalanceDate,
    sourceDate,
    dataFreshnessDays,
    status: 'PASS',
    statusNote: `sourceDate ${sourceDate} <= rebalanceDate ${rebalanceDate}. PIT-safe. Freshness: ${dataFreshnessDays ?? 'unknown'} days.`,
  };
}

/**
 * Computes coverage summary for a set of candidate snapshots.
 *
 * PASS  — coverageRatio >= 0.7 and invalidFutureDataCount === 0
 * WARN  — coverageRatio >= 0.4 or some invalidFutureData
 * FAIL  — coverageRatio < 0.4 or invalidFutureDataCount > 0 with < 50% available
 *
 * No performance fields. No strategy claims.
 *
 * @param snapshots - Array of CandidateSnapshot to evaluate
 */
export function validateCandidateSnapshotCoverage(
  snapshots: CandidateSnapshot[],
): CandidateSnapshotCoverageSummary {
  const candidateCount = snapshots.length;

  if (candidateCount === 0) {
    return {
      candidateCount: 0,
      availableCount: 0,
      missingCount: 0,
      staleCount: 0,
      invalidFutureDataCount: 0,
      coverageRatio: 0,
      status: 'WARN',
      statusNote: 'No candidate snapshots provided. Coverage cannot be evaluated.',
    };
  }

  const availableCount = snapshots.filter(s => s.dataAvailabilityStatus === 'AVAILABLE').length;
  const missingCount = snapshots.filter(s => s.dataAvailabilityStatus === 'MISSING').length;
  const staleCount = snapshots.filter(s => s.dataAvailabilityStatus === 'STALE').length;
  const invalidFutureDataCount = snapshots.filter(
    s => s.dataAvailabilityStatus === 'INVALID_FUTURE_DATE',
  ).length;

  const coverageRatio = Math.round((availableCount / candidateCount) * 10000) / 10000;

  let status: 'PASS' | 'WARN' | 'FAIL';
  let statusNote: string;

  if (invalidFutureDataCount > 0 && availableCount / candidateCount < 0.5) {
    status = 'FAIL';
    statusNote = `${invalidFutureDataCount} PIT violations detected and coverage ${(coverageRatio * 100).toFixed(1)}% < 50%.`;
  } else if (coverageRatio >= 0.7 && invalidFutureDataCount === 0) {
    status = 'PASS';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% (${availableCount}/${candidateCount}). No PIT violations.`;
  } else if (coverageRatio >= 0.4 || invalidFutureDataCount > 0) {
    status = 'WARN';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% or PIT violations (${invalidFutureDataCount}) detected. Review candidate data.`;
  } else {
    status = 'FAIL';
    statusNote = `Coverage ${(coverageRatio * 100).toFixed(1)}% < 40%. Insufficient candidate data for observability.`;
  }

  return {
    candidateCount,
    availableCount,
    missingCount,
    staleCount,
    invalidFutureDataCount,
    coverageRatio,
    status,
    statusNote,
  };
}

/**
 * Loads PIT-safe candidate snapshots for a given rebalanceDate.
 *
 * Queries the injected DB client for StockQuote records where
 * date <= rebalanceDate (PIT-safe, no future data).
 *
 * Returns the most-recent record per stock within the lookback window.
 * All output is observability-only — no strategy fields, no performance fields.
 *
 * Falls back gracefully on DB errors (returns empty array with error note).
 * No DB writes. No external API. No LLM. Read-only.
 *
 * @param rebalanceDate  - Reference date (YYYY-MM-DD); PIT boundary
 * @param prismaClient   - Injectable Prisma-like client for test mocking
 * @param loadConfig     - Optional load configuration
 */
export async function loadCandidateSnapshotsForDate(
  rebalanceDate: string,
  prismaClient: CandidateAdapterPrismaLike,
  loadConfig: CandidateSnapshotLoadConfig = {},
): Promise<CandidateSnapshotLoadResult> {
  const resolvedDate = resolveCurrentDate(rebalanceDate);
  const dbDateLte = toDbDateFormat(resolvedDate); // YYYYMMDD for DB query

  const {
    maxCandidates = 50,
    minDataFreshnessDays = 30,
    allowedSymbols,
    dataSourceLabel = 'STOCK_QUOTE_DB',
  } = loadConfig;

  let rawRows: CandidateRawRow[] = [];

  try {
    const whereClause: Parameters<CandidateAdapterPrismaLike['stockQuote']['findMany']>[0]['where'] = {
      date: { lte: dbDateLte },
    };

    if (allowedSymbols && allowedSymbols.length > 0) {
      whereClause.stockId = { in: allowedSymbols };
    }

    rawRows = await prismaClient.stockQuote.findMany({
      where: whereClause,
      include: { stock: true },
      orderBy: [{ stockId: 'asc' }, { date: 'desc' }],
      take: maxCandidates * 10, // Fetch extra to allow dedup per stock
    });
  } catch {
    return {
      rebalanceDate: resolvedDate,
      snapshots: [],
      candidateSource: 'PIT_SAFE_CANDIDATE_SNAPSHOT',
      totalLoaded: 0,
      observabilityNote:
        `DB query failed for rebalanceDate ${resolvedDate}. Returning empty snapshot set. ` +
        'No strategy conclusions. Observability only.',
    };
  }

  // Deduplicate: keep most-recent record per stock (orderBy date desc)
  const seenSymbols = new Set<string>();
  const dedupedRows: CandidateRawRow[] = [];
  for (const row of rawRows) {
    if (!seenSymbols.has(row.stockId)) {
      seenSymbols.add(row.stockId);
      dedupedRows.push(row);
    }
    if (dedupedRows.length >= maxCandidates) break;
  }

  // Map to observability-only snapshots
  const snapshots: CandidateSnapshot[] = dedupedRows.map(row =>
    mapStockDataToCandidateSnapshot(row, resolvedDate, dataSourceLabel),
  );

  // Apply freshness filter — mark stale if beyond minDataFreshnessDays
  for (const snapshot of snapshots) {
    if (
      snapshot.dataAvailabilityStatus === 'AVAILABLE' &&
      snapshot.dataFreshnessDays !== null &&
      snapshot.dataFreshnessDays > minDataFreshnessDays
    ) {
      (snapshot as { dataAvailabilityStatus: CandidateDataAvailabilityStatus }).dataAvailabilityStatus = 'STALE';
      snapshot.exclusionReasons.push(`freshness-filter: ${snapshot.dataFreshnessDays} days > ${minDataFreshnessDays} day threshold`);
    }
  }

  return {
    rebalanceDate: resolvedDate,
    snapshots,
    candidateSource: 'PIT_SAFE_CANDIDATE_SNAPSHOT',
    totalLoaded: snapshots.length,
    observabilityNote:
      `PIT-safe candidate snapshots for rebalanceDate ${resolvedDate}. ` +
      `sourceDate <= rebalanceDate enforced. No future data. ` +
      `Observability only. No strategy conclusions. No performance claims.`,
  };
}
