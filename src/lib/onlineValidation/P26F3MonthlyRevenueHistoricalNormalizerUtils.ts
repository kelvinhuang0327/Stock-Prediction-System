// P26F3-HARDRESET: MonthlyRevenue Historical Normalizer Utils
// DISCLAIMER: Does not constitute investment advice.
// No DB write. No corpus overwrite. No scoring formula change. Dry-run only.
// Pure functions. No Math.random. No external API. No mutation. Deterministic rowHash.

export interface RawHistoricalMonthlyRevenueRow {
  stockId?: string;
  symbol?: string;
  year?: number | string;
  month?: number | string;
  revenue?: number | string | null;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  [key: string]: unknown;
}

export interface NormalizedHistoricalMonthlyRevenueRow {
  stockId: string;
  year: number;
  month: number;
  revenue: number | null;
  revenueMissing: boolean;
  releaseDate: string | null;
  releaseDateMissing: boolean;
  releaseDateSource: string;
  releaseDateConfidence: string;
  needsManualReview: boolean;
  rowHash: string;
  dryRunOnly: true;
  dbWriteAllowed: false;
  corpusWriteAllowed: false;
  normalizationStatus: "VALID" | "REVENUE_MISSING" | "RELEASE_DATE_MISSING" | "INVALID_PERIOD" | "OUTCOME_FIELD_REJECTED";
  normalizationNote: string;
}

const OUTCOME_FIELDS = ["outcomePrice", "returnPct", "realizedReturnClass"];

export function normalizeHistoricalMonthlyRevenueRow(rawRow: RawHistoricalMonthlyRevenueRow): NormalizedHistoricalMonthlyRevenueRow {
  // No mutation — work from copy
  const row = Object.assign({}, rawRow);

  // Reject outcome fields
  for (const field of OUTCOME_FIELDS) {
    if (field in row && row[field] !== undefined && row[field] !== null) {
      return {
        stockId: String(row.stockId || row.symbol || "UNKNOWN"),
        year: Number(row.year) || 0,
        month: Number(row.month) || 0,
        revenue: null,
        revenueMissing: true,
        releaseDate: null,
        releaseDateMissing: true,
        releaseDateSource: "MISSING_RELEASE_DATE",
        releaseDateConfidence: "REJECTED",
        needsManualReview: true,
        rowHash: buildHistoricalMonthlyRevenueRowHash({ stockId: "REJECTED", year: 0, month: 0, revenue: null, releaseDate: null }),
        dryRunOnly: true,
        dbWriteAllowed: false,
        corpusWriteAllowed: false,
        normalizationStatus: "OUTCOME_FIELD_REJECTED",
        normalizationNote: `Rejected: outcome field present (${field})`,
      };
    }
  }

  const stockId = String(row.stockId || row.symbol || "UNKNOWN");
  const year = Number(row.year);
  const month = Number(row.month);

  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return {
      stockId,
      year: isNaN(year) ? 0 : year,
      month: isNaN(month) ? 0 : month,
      revenue: null,
      revenueMissing: true,
      releaseDate: null,
      releaseDateMissing: true,
      releaseDateSource: "MISSING_RELEASE_DATE",
      releaseDateConfidence: "UNKNOWN",
      needsManualReview: true,
      rowHash: buildHistoricalMonthlyRevenueRowHash({ stockId, year: 0, month: 0, revenue: null, releaseDate: null }),
      dryRunOnly: true,
      dbWriteAllowed: false,
      corpusWriteAllowed: false,
      normalizationStatus: "INVALID_PERIOD",
      normalizationNote: `Invalid year=${row.year} or month=${row.month}`,
    };
  }

  const revenue = (row.revenue !== null && row.revenue !== undefined) ? Number(row.revenue) : null;
  const revenueMissing = revenue === null || isNaN(revenue);
  const releaseDate = row.releaseDate ? String(row.releaseDate) : null;
  const releaseDateMissing = !releaseDate;

  const releaseDateSource = classifyHistoricalReleaseDateSource(row);
  const releaseDateConfidence = releaseDateSource === "VERIFIED_OFFICIAL_DATE"
    ? "HIGH"
    : releaseDateSource === "INFERRED_NEXT_MONTH_10TH"
    ? "LOW"
    : "UNKNOWN";
  const needsManualReview = releaseDateSource !== "VERIFIED_OFFICIAL_DATE";

  const rowHash = buildHistoricalMonthlyRevenueRowHash({ stockId, year, month, revenue: revenueMissing ? null : revenue, releaseDate });

  let normalizationStatus: NormalizedHistoricalMonthlyRevenueRow["normalizationStatus"];
  let normalizationNote: string;

  if (revenueMissing) {
    normalizationStatus = "REVENUE_MISSING";
    normalizationNote = "Revenue data not available";
  } else if (releaseDateMissing) {
    normalizationStatus = "RELEASE_DATE_MISSING";
    normalizationNote = "ReleaseDate not available — needs manual review";
  } else {
    normalizationStatus = "VALID";
    normalizationNote = "Row normalized successfully";
  }

  return {
    stockId,
    year,
    month,
    revenue: revenueMissing ? null : revenue,
    revenueMissing,
    releaseDate,
    releaseDateMissing,
    releaseDateSource,
    releaseDateConfidence,
    needsManualReview,
    rowHash,
    dryRunOnly: true,
    dbWriteAllowed: false,
    corpusWriteAllowed: false,
    normalizationStatus,
    normalizationNote,
  };
}

export function buildHistoricalMonthlyRevenueRowHash(row: { stockId: string; year: number; month: number; revenue: number | null; releaseDate: string | null }): string {
  const key = `${row.stockId}|${row.year}|${row.month}|${row.revenue ?? "null"}|${row.releaseDate ?? "null"}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function classifyHistoricalReleaseDateSource(row: RawHistoricalMonthlyRevenueRow): string {
  if (!row.releaseDate) return "MISSING_RELEASE_DATE";
  if (row.releaseDateSource === "OFFICIAL") return "VERIFIED_OFFICIAL_DATE";
  if (row.releaseDateSource === "INFERRED_NEXT_MONTH_10TH") return "INFERRED_NEXT_MONTH_10TH";
  return "NEEDS_MANUAL_REVIEW";
}

export function validateHistoricalMonthlyRevenueRow(row: NormalizedHistoricalMonthlyRevenueRow): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (!row.stockId || row.stockId === "UNKNOWN") violations.push("stockId is missing or UNKNOWN");
  if (!row.dryRunOnly) violations.push("dryRunOnly must be true");
  if (row.dbWriteAllowed !== false) violations.push("dbWriteAllowed must be false");
  if (row.corpusWriteAllowed !== false) violations.push("corpusWriteAllowed must be false");
  for (const f of OUTCOME_FIELDS) {
    if (f in row) violations.push(`Outcome field present: ${f}`);
  }
  return { valid: violations.length === 0, violations };
}

export function normalizeHistoricalMonthlyRevenueBatch(rows: RawHistoricalMonthlyRevenueRow[]): NormalizedHistoricalMonthlyRevenueRow[] {
  return rows.map(r => normalizeHistoricalMonthlyRevenueRow(r));
}

export function summarizeHistoricalNormalization(rows: NormalizedHistoricalMonthlyRevenueRow[]): object {
  const allDryRunOnly = rows.every(r => r.dryRunOnly === true);
  const allDbWriteDisabled = rows.every(r => r.dbWriteAllowed === false);
  return {
    total: rows.length,
    valid: rows.filter(r => r.normalizationStatus === "VALID").length,
    revenueMissing: rows.filter(r => r.normalizationStatus === "REVENUE_MISSING").length,
    releaseDateMissing: rows.filter(r => r.normalizationStatus === "RELEASE_DATE_MISSING").length,
    invalidPeriod: rows.filter(r => r.normalizationStatus === "INVALID_PERIOD").length,
    outcomeFieldRejected: rows.filter(r => r.normalizationStatus === "OUTCOME_FIELD_REJECTED").length,
    allDryRunOnly,
    allDbWriteDisabled,
  };
}

export function validateHistoricalRowsNoOutcomeFields(rows: NormalizedHistoricalMonthlyRevenueRow[]): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (const f of OUTCOME_FIELDS) {
      if (f in rows[i]) violations.push(`Row ${i}: outcome field present: ${f}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateHistoricalRowsDryRunOnly(rows: NormalizedHistoricalMonthlyRevenueRow[]): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].dryRunOnly) violations.push(`Row ${i}: dryRunOnly is not true`);
    if (rows[i].dbWriteAllowed !== false) violations.push(`Row ${i}: dbWriteAllowed is not false`);
  }
  return { valid: violations.length === 0, violations };
}
