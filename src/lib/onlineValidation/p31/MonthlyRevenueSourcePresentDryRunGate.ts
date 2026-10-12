/**
 * P31 — MonthlyRevenue Source-Present Dry-Run Gate
 *
 * Pure TypeScript module for row-level and batch dry-run gate logic.
 * No DB access. No side effects. Deterministic.
 *
 * DISCLAIMER: Structural gate contract only. Does not constitute investment advice.
 * MonthlyRevenue entersAlphaScore = false. ALWAYS.
 * Results must not be used as buy/sell/hold signals or investment recommendations.
 */

import {
  MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION,
  MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER,
  MONTHLY_REVENUE_DRY_RUN_CONTRACT,
} from './MonthlyRevenueDryRunContract';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DryRunGateClassification =
  | "MONTHLY_REVENUE_DRY_RUN_READY"
  | "MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE"
  | "MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK"
  | "MONTHLY_REVENUE_DRY_RUN_BLOCKED_LOW_CONFIDENCE"
  | "MONTHLY_REVENUE_DRY_RUN_NOT_APPLICABLE";

export interface MonthlyRevenueRowMetadata {
  stockId: string;
  year: number;
  month: number;
  releaseDate: Date | null;
  releaseDateSource: string | null;
  releaseDateConfidence: string | null;
  [key: string]: unknown;
}

export interface DryRunGateResult {
  classification: DryRunGateClassification;
  passes: boolean;
  blockedReason?: string;
  entersAlphaScore: false;
  paperOnly: true;
  dryRun: true;
}

export interface DryRunBatchScanResult {
  totalRows: number;
  readyRows: number;
  blockedRows: number;
  blockedReasons: Record<string, number>;
  overallClassification: DryRunGateClassification;
  coveragePct: number;
  entersAlphaScore: false;
  paperOnly: true;
  dryRun: true;
  version: string;
  disclaimer: string;
}

// ─── Leakage fields (forbidden in row output) ─────────────────────────────────

const LEAKAGE_FIELDS = [
  'returnPct',
  'outcomePrice',
  'realizedReturn',
  'forwardReturn',
  'predictedPrice',
  'futurePrice',
  'expectedReturn',
  'profitLoss',
  'winRate',
  'edgeScore',
  'alphaScore',
  'prediction',
  'recommendation',
  'signal',
  'alpha',
  'score',
];

// ─── Helper: compute revenue month end date ───────────────────────────────────

/**
 * Returns the last day of the given revenue month as a Date (UTC midnight).
 * e.g. year=2026, month=1 → 2026-01-31T00:00:00.000Z
 */
function getRevenueMonthEndDate(year: number, month: number): Date {
  // Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month, 0)); // month is 1-indexed; Date.UTC month is 0-indexed
}

// ─── Row-level gate ───────────────────────────────────────────────────────────

/**
 * Check whether a single MonthlyRevenue row satisfies the source-present dry-run gate.
 *
 * Checks in order:
 * 1. releaseDate non-null → else BLOCKED_MISSING_RELEASE_DATE
 * 2. releaseDateSource non-null → else BLOCKED_MISSING_RELEASE_DATE
 * 3. if asOfDate provided, releaseDate <= asOfDate → else BLOCKED_LEAKAGE_RISK
 * 4. revenueMonth end date < releaseDate → else BLOCKED_LEAKAGE_RISK
 * 5. no leakage fields in row → else BLOCKED_LEAKAGE_RISK
 * 6. READY if all pass
 */
export function checkRowDryRunGate(
  row: MonthlyRevenueRowMetadata,
  asOfDate?: Date
): DryRunGateResult {
  // Check 1: releaseDate present
  if (row.releaseDate === null || row.releaseDate === undefined) {
    return {
      classification: "MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE",
      passes: false,
      blockedReason: "releaseDate is null — cannot determine data availability date",
      entersAlphaScore: false,
      paperOnly: true,
      dryRun: true,
    };
  }

  // Check 2: releaseDateSource present
  if (row.releaseDateSource === null || row.releaseDateSource === undefined) {
    return {
      classification: "MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE",
      passes: false,
      blockedReason: "releaseDateSource is null — provenance of releaseDate unknown",
      entersAlphaScore: false,
      paperOnly: true,
      dryRun: true,
    };
  }

  const releaseDate = row.releaseDate instanceof Date
    ? row.releaseDate
    : new Date(row.releaseDate as string);

  // Check 3: if asOfDate provided, releaseDate must be <= asOfDate
  if (asOfDate !== undefined) {
    if (releaseDate > asOfDate) {
      return {
        classification: "MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK",
        passes: false,
        blockedReason: `releaseDate (${releaseDate.toISOString()}) is after asOfDate (${asOfDate.toISOString()}) — future leakage risk`,
        entersAlphaScore: false,
        paperOnly: true,
        dryRun: true,
      };
    }
  }

  // Check 4: revenueMonth end date must be < releaseDate (release must be after month ends)
  const monthEnd = getRevenueMonthEndDate(row.year, row.month);
  if (releaseDate <= monthEnd) {
    return {
      classification: "MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK",
      passes: false,
      blockedReason: `releaseDate (${releaseDate.toISOString()}) is not after revenue month end (${monthEnd.toISOString()}) — revenue month cannot be the availability date`,
      entersAlphaScore: false,
      paperOnly: true,
      dryRun: true,
    };
  }

  // Check 5: no leakage fields
  for (const field of LEAKAGE_FIELDS) {
    if (field in row) {
      return {
        classification: "MONTHLY_REVENUE_DRY_RUN_BLOCKED_LEAKAGE_RISK",
        passes: false,
        blockedReason: `Row contains leakage field: "${field}"`,
        entersAlphaScore: false,
        paperOnly: true,
        dryRun: true,
      };
    }
  }

  // All checks passed
  return {
    classification: "MONTHLY_REVENUE_DRY_RUN_READY",
    passes: true,
    entersAlphaScore: false,
    paperOnly: true,
    dryRun: true,
  };
}

// ─── Batch scan ───────────────────────────────────────────────────────────────

/**
 * Scan all rows and aggregate gate results.
 */
export function buildDryRunBatchScanResult(
  rows: MonthlyRevenueRowMetadata[],
  asOfDate?: Date
): DryRunBatchScanResult {
  const totalRows = rows.length;
  let readyRows = 0;
  let blockedRows = 0;
  const blockedReasons: Record<string, number> = {};

  for (const row of rows) {
    const result = checkRowDryRunGate(row, asOfDate);
    if (result.passes) {
      readyRows++;
    } else {
      blockedRows++;
      const reason = result.blockedReason ?? result.classification;
      blockedReasons[reason] = (blockedReasons[reason] ?? 0) + 1;
    }
  }

  const overallClassification: DryRunGateClassification =
    totalRows === 0
      ? "MONTHLY_REVENUE_DRY_RUN_NOT_APPLICABLE"
      : blockedRows === 0
        ? "MONTHLY_REVENUE_DRY_RUN_READY"
        : "MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE";

  const coveragePct = totalRows === 0 ? 0 : Math.round((readyRows / totalRows) * 100);

  return {
    totalRows,
    readyRows,
    blockedRows,
    blockedReasons,
    overallClassification,
    coveragePct,
    entersAlphaScore: false,
    paperOnly: true,
    dryRun: true,
    version: MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION,
    disclaimer: MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER,
  };
}

// ─── Count-based batch scan ───────────────────────────────────────────────────

/**
 * Build a DryRunBatchScanResult from aggregate counts (for use with DB query results).
 * When all counts equal totalRows: overallClassification = MONTHLY_REVENUE_DRY_RUN_READY.
 */
export function buildDryRunGateScanFromCounts(
  totalRows: number,
  withReleaseDate: number,
  withSource: number,
  withConfidence: number
): DryRunBatchScanResult {
  const missingReleaseDate = totalRows - withReleaseDate;
  const missingSource = totalRows - withSource;
  const missingConfidence = totalRows - withConfidence;

  const totalBlocked = Math.max(missingReleaseDate, missingSource, missingConfidence);
  const readyRows = totalRows - totalBlocked;
  const blockedRows = totalBlocked;

  const blockedReasons: Record<string, number> = {};
  if (missingReleaseDate > 0) {
    blockedReasons['releaseDate is null — cannot determine data availability date'] = missingReleaseDate;
  }
  if (missingSource > 0) {
    blockedReasons['releaseDateSource is null — provenance of releaseDate unknown'] = missingSource;
  }
  if (missingConfidence > 0) {
    blockedReasons['releaseDateConfidence is null'] = missingConfidence;
  }

  const allReady =
    withReleaseDate === totalRows &&
    withSource === totalRows &&
    withConfidence === totalRows;

  const overallClassification: DryRunGateClassification =
    totalRows === 0
      ? "MONTHLY_REVENUE_DRY_RUN_NOT_APPLICABLE"
      : allReady
        ? "MONTHLY_REVENUE_DRY_RUN_READY"
        : "MONTHLY_REVENUE_DRY_RUN_BLOCKED_MISSING_RELEASE_DATE";

  const coveragePct = totalRows === 0 ? 0 : Math.round((readyRows / totalRows) * 100);

  return {
    totalRows,
    readyRows,
    blockedRows,
    blockedReasons,
    overallClassification,
    coveragePct,
    entersAlphaScore: false,
    paperOnly: true,
    dryRun: true,
    version: MONTHLY_REVENUE_DRY_RUN_CONTRACT_VERSION,
    disclaimer: MONTHLY_REVENUE_DRY_RUN_CONTRACT_DISCLAIMER,
  };
}
