/**
 * marketRegimeResult.ts
 *
 * Service for reading the latest persisted MarketRegimeResult from the DB.
 * This reads from the MarketRegimeResult table populated by the Python
 * persist-market-regime-results.py pipeline stage (P4-03/T-08).
 *
 * IMPORTANT: This is a market context service, NOT a trading recommendation.
 * Regime data describes market conditions only. It is NOT investment advice,
 * does NOT constitute a buy/sell signal, and does NOT imply future performance.
 */

import { prisma } from '@/lib/prisma';
import { resolveCurrentDate } from '@/lib/time/currentDate';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegimeLabel = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'LOW_CONFIDENCE';

export type FreshnessStatus = 'FRESH' | 'STALE' | 'MISSING' | 'FUTURE_DATE_ERROR';

// ─── Freshness Alert Types (T-11) ────────────────────────────────────────────

export type FreshnessAlertLevel =
  | 'FRESH'
  | 'STALE'
  | 'CRITICAL_STALE'
  | 'MISSING'
  | 'FUTURE_DATE_ERROR';

export interface FreshnessAlert {
  alertLevel: FreshnessAlertLevel;
  freshnessLagDays: number | null;
  lastRegimeDate: string | null;
  currentDate: string;
  message: string | null;
  requiresAction: boolean;
}

export interface PersistedRegimeContext {
  date: string;
  regimeLabel: RegimeLabel;
  confidence: number;
  taiexClose: number | null;
  source: string;
  version: string;
  freshnessStatus: FreshnessStatus;
  freshnessLagDays: number;
  warning: string | null;
  isAvailable: true;
}

export interface MissingRegimeContext {
  isAvailable: false;
  freshnessStatus: 'MISSING';
  freshnessLagDays: -1;
  warning: string;
}

export type RegimeContext = PersistedRegimeContext | MissingRegimeContext;

export const ALLOWED_LABELS = new Set<string>(['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_CONFIDENCE']);
const STALE_THRESHOLD_DAYS = 3;

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Computes a freshness alert from a RegimeContext.
 *
 * Alert levels:
 *   FRESH          — lag <= 3 calendar days
 *   STALE          — lag 4–7 calendar days
 *   CRITICAL_STALE — lag > 7 calendar days
 *   MISSING        — no MarketRegimeResult in DB
 *   FUTURE_DATE_ERROR — persisted date > currentDate (data error)
 */
export function computeFreshnessAlert(
  context: RegimeContext,
  currentDate?: string,
): FreshnessAlert {
  const resolvedDate = resolveCurrentDate(currentDate);
  if (!context.isAvailable) {
    return {
      alertLevel: 'MISSING',
      freshnessLagDays: null,
      lastRegimeDate: null,
      currentDate: resolvedDate,
      message: 'No MarketRegimeResult found.',
      requiresAction: true,
    };
  }

  const lag = context.freshnessLagDays;

  if (context.freshnessStatus === 'FUTURE_DATE_ERROR') {
    return {
      alertLevel: 'FUTURE_DATE_ERROR',
      freshnessLagDays: lag,
      lastRegimeDate: context.date,
      currentDate: resolvedDate,
      message: `Persisted regime date ${context.date} is after currentDate ${resolvedDate}.`,
      requiresAction: true,
    };
  }

  if (lag <= 3) {
    return {
      alertLevel: 'FRESH',
      freshnessLagDays: lag,
      lastRegimeDate: context.date,
      currentDate: resolvedDate,
      message: null,
      requiresAction: false,
    };
  }

  if (lag <= 7) {
    return {
      alertLevel: 'STALE',
      freshnessLagDays: lag,
      lastRegimeDate: context.date,
      currentDate: resolvedDate,
      message: `MarketRegimeResult is stale by ${lag} calendar days.`,
      requiresAction: true,
    };
  }

  return {
    alertLevel: 'CRITICAL_STALE',
    freshnessLagDays: lag,
    lastRegimeDate: context.date,
    currentDate: resolvedDate,
    message: `MarketRegimeResult is critically stale by ${lag} calendar days. Immediate refresh required.`,
    requiresAction: true,
  };
}

/**
 * Returns the latest persisted regime context.
 *
 * @param currentDate - Reference date for freshness check.
 *                      Defaults to system date via resolveCurrentDate().
 *                      Pass an explicit value (e.g. '2026-05-06') for test stability.
 * @param asOf - P0-04: Upper bound for the DB query (date <= asOf).
 *               When provided, prevents reading MarketRegimeResult rows after asOf.
 *               If the retrieved row's date exceeds asOf, returns FUTURE_DATE_ERROR.
 */
export async function getLatestMarketRegimeContext(
  currentDate?: string,
  asOf?: string,
): Promise<RegimeContext> {
  const resolvedDate = resolveCurrentDate(currentDate);
  let row: {
    date: string;
    regimeLabel: string;
    confidence: number;
    taiexClose: number | null;
    source: string;
    version: string;
  } | null = null;

  try {
    row = await prisma.marketRegimeResult.findFirst({
      where: asOf ? { date: { lte: asOf } } : undefined,
      orderBy: { date: 'desc' },
      select: {
        date: true,
        regimeLabel: true,
        confidence: true,
        taiexClose: true,
        source: true,
        version: true,
      },
    });
  } catch (err) {
    return {
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: `DB query failed: ${String(err)}`,
    };
  }

  if (!row) {
    return {
      isAvailable: false,
      freshnessStatus: 'MISSING',
      freshnessLagDays: -1,
      warning: 'No MarketRegimeResult records found in DB',
    };
  }

  // P0-04: Safety net — if asOf provided and row.date > asOf, reject
  if (asOf && row.date > asOf) {
    return {
      isAvailable: false,
      freshnessStatus: 'FUTURE_DATE_ERROR',
      freshnessLagDays: -1,
      warning: `MarketRegimeResult sourceDate ${row.date} exceeds asOf ${asOf} — data gate rejected`,
    };
  }

  const lagDays = daysBetween(row.date, resolvedDate);

  let freshnessStatus: FreshnessStatus;
  let warning: string | null = null;

  if (lagDays < 0) {
    freshnessStatus = 'FUTURE_DATE_ERROR';
    warning = `Persisted regime date ${row.date} is after currentDate ${resolvedDate}`;
  } else if (lagDays > STALE_THRESHOLD_DAYS) {
    freshnessStatus = 'STALE';
    warning = `Regime data is ${lagDays} calendar days old (threshold: ${STALE_THRESHOLD_DAYS})`;
  } else {
    freshnessStatus = 'FRESH';
  }

  const label = ALLOWED_LABELS.has(row.regimeLabel)
    ? (row.regimeLabel as RegimeLabel)
    : ('LOW_CONFIDENCE' as RegimeLabel);

  return {
    date: row.date,
    regimeLabel: label,
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
