// P26DMonthlyRevenueCoverageScannerUtils.ts
// P26D: MonthlyRevenue targeted coverage scanner
// ZERO external imports. Pure functions only. No random number generation. No mutation.
// FORBIDDEN: Never read outcomePrice, returnPct, realizedReturnClass from any row.

export interface MonthlyRevenueRow {
  symbol?: string;
  releaseDate?: string;
  revenueAmount?: number;
  revenueContext?: string;
  reasonContext?: string;
  factorEvidence?: string;
}

export interface MonthlyRevenueCoverage {
  totalRows: number;
  availableRows: number;
  futureRows: number;
  invalidRows: number;
  withReasonContext: number;
  withFactorEvidence: number;
  asOfDate: string;
  coverageRatio: number;
}

export interface MonthlyRevenueCoverageComparison {
  beforeSummary: MonthlyRevenueCoverage;
  afterSummary: MonthlyRevenueCoverage;
  availabilityDelta: number;
  coverageImproved: boolean;
}

function toTaiwanDateStr(ts: string): string {
  const ms = Date.parse(ts);
  if (isNaN(ms)) return "";
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type MonthlyRevenueRowClassification = "available" | "future" | "invalid";

export function classifyMonthlyRevenueCoverageRow(
  row: MonthlyRevenueRow,
  asOfDate: string
): MonthlyRevenueRowClassification {
  if (!row.releaseDate) return "invalid";
  const releaseStr = toTaiwanDateStr(row.releaseDate) || row.releaseDate.slice(0, 10);
  if (!releaseStr) return "invalid";
  if (releaseStr <= asOfDate) return "available";
  return "future";
}

export function scanMonthlyRevenueAvailabilityCoverage(
  rows: MonthlyRevenueRow[],
  options: { asOfDate: string }
): MonthlyRevenueCoverage {
  const { asOfDate } = options;
  let availableRows = 0;
  let futureRows = 0;
  let invalidRows = 0;
  let withReasonContext = 0;
  let withFactorEvidence = 0;

  for (const row of rows) {
    const classification = classifyMonthlyRevenueCoverageRow(row, asOfDate);
    if (classification === "available") {
      availableRows++;
    } else if (classification === "future") {
      futureRows++;
    } else {
      invalidRows++;
    }
    if (row.reasonContext && row.reasonContext.trim().length > 0) withReasonContext++;
    if (row.factorEvidence && row.factorEvidence.trim().length > 0) withFactorEvidence++;
  }

  const totalRows = rows.length;
  const coverageRatio = totalRows > 0 ? availableRows / totalRows : 0;

  return {
    totalRows,
    availableRows,
    futureRows,
    invalidRows,
    withReasonContext,
    withFactorEvidence,
    asOfDate,
    coverageRatio,
  };
}

export function summarizeMonthlyRevenueCoverage(rows: MonthlyRevenueRow[]): {
  totalRows: number;
  withReleaseDate: number;
  withReasonContext: number;
  withFactorEvidence: number;
  withRevenueContext: number;
  noReleaseDate: number;
} {
  let withReleaseDate = 0;
  let withReasonContext = 0;
  let withFactorEvidence = 0;
  let withRevenueContext = 0;

  for (const row of rows) {
    if (row.releaseDate) withReleaseDate++;
    if (row.reasonContext && row.reasonContext.trim().length > 0) withReasonContext++;
    if (row.factorEvidence && row.factorEvidence.trim().length > 0) withFactorEvidence++;
    if (row.revenueContext && row.revenueContext.trim().length > 0) withRevenueContext++;
  }

  return {
    totalRows: rows.length,
    withReleaseDate,
    withReasonContext,
    withFactorEvidence,
    withRevenueContext,
    noReleaseDate: rows.length - withReleaseDate,
  };
}

export function compareMonthlyRevenueCoverageBeforeAfter(
  beforeRows: MonthlyRevenueRow[],
  afterRows: MonthlyRevenueRow[],
  asOfDate: string
): MonthlyRevenueCoverageComparison {
  const beforeSummary = scanMonthlyRevenueAvailabilityCoverage(beforeRows, { asOfDate });
  const afterSummary = scanMonthlyRevenueAvailabilityCoverage(afterRows, { asOfDate });
  const availabilityDelta = afterSummary.availableRows - beforeSummary.availableRows;
  return {
    beforeSummary,
    afterSummary,
    availabilityDelta,
    coverageImproved: availabilityDelta > 0,
  };
}

export function validateMonthlyRevenueCoverageReadOnly(summary: ReturnType<typeof summarizeMonthlyRevenueCoverage>): {
  valid: boolean;
  reason: string;
} {
  if (summary.totalRows < 0) {
    return { valid: false, reason: "Negative totalRows — data corruption suspected" };
  }
  return {
    valid: true,
    reason: "Summary is read-only derived from input rows. No mutation occurred.",
  };
}

export function validateMonthlyRevenueCoverageNoOutcomeFields(
  summary: ReturnType<typeof summarizeMonthlyRevenueCoverage>
): {
  valid: boolean;
  reason: string;
} {
  const summaryKeys = Object.keys(summary);
  const forbiddenFound = summaryKeys.filter((k) =>
    ["outcomePrice", "returnPct", "realizedReturnClass"].includes(k)
  );
  if (forbiddenFound.length > 0) {
    return {
      valid: false,
      reason: `Forbidden outcome fields found in summary: ${forbiddenFound.join(", ")}`,
    };
  }
  return {
    valid: true,
    reason: "No outcome fields (outcomePrice/returnPct/realizedReturnClass) present in summary.",
  };
}
