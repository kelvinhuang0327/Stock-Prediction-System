// P26F2-HARDRESET: MonthlyRevenue ReleaseDate Inference Utilities
// ZERO external imports — pure TypeScript, no side-effects, no DB access

interface MonthlyRevenueDbRow {
  id: number;
  stockId: string;
  year: number;
  month: number;
  revenue: number;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  createdAt: string | Date;
}

interface ReleaseDateCandidate {
  id: number;
  stockId: string;
  year: number;
  month: number;
  revenue: number;
  yoyGrowth: number | null;
  momGrowth: number | null;
  originalReleaseDate: null;
  candidateReleaseDate: string | "INVALID";
  releaseDateSourceCandidate: "INFERRED_NEXT_MONTH_10TH";
  releaseDateConfidenceCandidate: "LOW";
  needsManualReview: true;
  dryRunOnly: true;
  productionWriteAllowed: false;
  populationStatus: "CANDIDATE_GENERATED" | "INVALID_YEAR_MONTH" | "EXISTING_RELEASE_DATE_KEEP";
  reason: string;
}

export function normalizeMonthlyRevenueRowForReleaseDate(row: MonthlyRevenueDbRow): MonthlyRevenueDbRow {
  return {
    id: row.id,
    stockId: row.stockId,
    year: row.year,
    month: row.month,
    revenue: row.revenue,
    yoyGrowth: row.yoyGrowth ?? null,
    momGrowth: row.momGrowth ?? null,
    createdAt: row.createdAt,
  };
}

export function inferMonthlyRevenueCandidateReleaseDate(row: MonthlyRevenueDbRow): string {
  const { year, month } = row;
  if (year < 2000 || year > 2100) return "INVALID";
  if (month < 1 || month > 12) return "INVALID";
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mm = String(nextMonth).padStart(2, '0');
  return `${nextYear}-${mm}-10`;
}

export function classifyReleaseDatePopulationStatus(
  row: MonthlyRevenueDbRow & { releaseDate?: string | null }
): string {
  if (row.releaseDate != null) return "EXISTING_RELEASE_DATE_KEEP";
  if (row.month < 1 || row.month > 12 || row.year < 2000 || row.year > 2100) return "INVALID_YEAR_MONTH";
  return "CANDIDATE_GENERATED";
}

export function buildReleaseDatePopulationCandidate(row: MonthlyRevenueDbRow): ReleaseDateCandidate {
  const candidateDate = inferMonthlyRevenueCandidateReleaseDate(row);
  const populationStatus: "CANDIDATE_GENERATED" | "INVALID_YEAR_MONTH" =
    candidateDate === "INVALID" ? "INVALID_YEAR_MONTH" : "CANDIDATE_GENERATED";
  const reason =
    candidateDate === "INVALID"
      ? `invalid year=${row.year} or month=${row.month}`
      : `inferred from year=${row.year}, month=${row.month} using NEXT_MONTH_10TH rule`;
  return {
    id: row.id,
    stockId: row.stockId,
    year: row.year,
    month: row.month,
    revenue: row.revenue,
    yoyGrowth: row.yoyGrowth ?? null,
    momGrowth: row.momGrowth ?? null,
    originalReleaseDate: null,
    candidateReleaseDate: candidateDate,
    releaseDateSourceCandidate: "INFERRED_NEXT_MONTH_10TH",
    releaseDateConfidenceCandidate: "LOW",
    needsManualReview: true,
    dryRunOnly: true,
    productionWriteAllowed: false,
    populationStatus,
    reason,
  };
}

export function buildReleaseDatePopulationBatch(rows: MonthlyRevenueDbRow[]): ReleaseDateCandidate[] {
  return rows.map((row) => buildReleaseDatePopulationCandidate(row));
}

export function validateReleaseDateCandidateNoOutcomeFields(
  candidate: ReleaseDateCandidate
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const forbidden = ["outcomePrice", "returnPct", "realizedReturnClass"];
  for (const f of forbidden) {
    if (f in (candidate as Record<string, unknown>)) {
      violations.push(`Forbidden outcome field found: ${f}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function validateReleaseDateCandidateIsDryRunOnly(
  candidate: ReleaseDateCandidate
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (candidate.dryRunOnly !== true) violations.push("dryRunOnly must be true");
  if (candidate.productionWriteAllowed !== false) violations.push("productionWriteAllowed must be false");
  return { valid: violations.length === 0, violations };
}

export function validateReleaseDateCandidateDoesNotOverwriteExisting(
  row: MonthlyRevenueDbRow & { releaseDate?: string | null },
  candidate: ReleaseDateCandidate
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  if (row.releaseDate != null && candidate.populationStatus !== "EXISTING_RELEASE_DATE_KEEP") {
    violations.push(
      `Row ${row.id} has existing releaseDate but candidate populationStatus is ${candidate.populationStatus}`
    );
  }
  return { valid: violations.length === 0, violations };
}

export function summarizeReleaseDatePopulationBatch(candidates: ReleaseDateCandidate[]): object {
  const candidateGeneratedCount = candidates.filter((c) => c.populationStatus === "CANDIDATE_GENERATED").length;
  const existingReleaseDateKeepCount = candidates.filter((c) => c.populationStatus === "EXISTING_RELEASE_DATE_KEEP").length;
  const invalidYearMonthCount = candidates.filter((c) => c.populationStatus === "INVALID_YEAR_MONTH").length;
  const allDryRunOnly = candidates.every((c) => c.dryRunOnly === true);
  const allProductionWriteDisabled = candidates.every((c) => c.productionWriteAllowed === false);
  const noOutcomeFields = candidates.every((c) => {
    const keys = Object.keys(c as Record<string, unknown>);
    return !keys.includes("outcomePrice") && !keys.includes("returnPct") && !keys.includes("realizedReturnClass");
  });
  const validDates = candidates
    .map((c) => c.candidateReleaseDate)
    .filter((d): d is string => typeof d === "string" && d !== "INVALID");
  const sorted = [...validDates].sort();
  return {
    totalCandidates: candidates.length,
    candidateGeneratedCount,
    existingReleaseDateKeepCount,
    invalidYearMonthCount,
    allDryRunOnly,
    allProductionWriteDisabled,
    noOutcomeFields,
    earliestCandidateDate: sorted.length > 0 ? sorted[0] : null,
    latestCandidateDate: sorted.length > 0 ? sorted[sorted.length - 1] : null,
  };
}
