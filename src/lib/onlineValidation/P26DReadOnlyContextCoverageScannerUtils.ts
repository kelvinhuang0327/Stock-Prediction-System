// P26DReadOnlyContextCoverageScannerUtils.ts
// P26D: Read-Only Context Coverage Scanner for NewsEvent and FinancialReport adapters
// ZERO external imports. Pure functions only. No random number generation. No mutation.
// FORBIDDEN: Never read outcomePrice, returnPct, realizedReturnClass.

export interface NewsEventRow {
  publishedAt?: string;
  ingestedAt?: string;
  symbol?: string;
  eventType?: string;
  sourceHash?: string;
  [key: string]: unknown;
}

export interface FinancialReportRow {
  filingDate?: string | null;
  announcementDate?: string | null;
  publishedAt?: string | null;
  availableAt?: string | null;
  ingestedAt?: string | null;
  symbol?: string;
  sourceHash?: string;
  [key: string]: unknown;
}

export interface NewsEventCoverageSummary {
  total: number;
  visible: number;
  future: number;
  invalid: number;
  entersAlphaScore: false;
}

export interface FinancialReportCoverageSummary {
  total: number;
  visible: number;
  future: number;
  invalid: number;
  noAvailabilityDate: number;
  entersAlphaScore: false;
}

export interface ReadOnlyContextCoverageSummary {
  news: NewsEventCoverageSummary;
  financial: FinancialReportCoverageSummary;
  asOfDate: string;
  contextsReadOnly: true;
  sourceMappingRequired: boolean;
}

function toDateStr(ts: string): string {
  const ms = Date.parse(ts);
  if (isNaN(ms)) return "";
  // Taiwan UTC+8 inline conversion
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function scanNewsEventContextCoverage(
  fixturesOrRows: NewsEventRow[],
  asOfDate: string
): NewsEventCoverageSummary {
  let visible = 0;
  let future = 0;
  let invalid = 0;

  for (const row of fixturesOrRows) {
    if (!row.publishedAt) {
      invalid++;
      continue;
    }
    const dateStr = toDateStr(row.publishedAt);
    if (!dateStr) {
      invalid++;
      continue;
    }
    if (dateStr <= asOfDate) {
      visible++;
    } else {
      future++;
    }
  }

  return {
    total: fixturesOrRows.length,
    visible,
    future,
    invalid,
    entersAlphaScore: false,
  };
}

function resolveAvailabilityDate(row: FinancialReportRow): string | null {
  const candidates = [row.filingDate, row.announcementDate, row.publishedAt, row.availableAt];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}

export function scanFinancialReportContextCoverage(
  fixturesOrRows: FinancialReportRow[],
  asOfDate: string
): FinancialReportCoverageSummary {
  let visible = 0;
  let future = 0;
  let invalid = 0;
  let noAvailabilityDate = 0;

  for (const row of fixturesOrRows) {
    const availabilityDate = resolveAvailabilityDate(row);
    if (availabilityDate === null) {
      noAvailabilityDate++;
      continue;
    }
    const dateStr = toDateStr(availabilityDate) || availabilityDate.slice(0, 10);
    if (!dateStr) {
      invalid++;
      continue;
    }
    if (dateStr <= asOfDate) {
      visible++;
    } else {
      future++;
    }
  }

  return {
    total: fixturesOrRows.length,
    visible,
    future,
    invalid,
    noAvailabilityDate,
    entersAlphaScore: false,
  };
}

export function summarizeReadOnlyContextCoverage(
  newsSummary: NewsEventCoverageSummary,
  financialSummary: FinancialReportCoverageSummary,
  asOfDate: string
): ReadOnlyContextCoverageSummary {
  const sourceMappingRequired =
    newsSummary.total > 0 || financialSummary.total > 0;

  return {
    news: newsSummary,
    financial: financialSummary,
    asOfDate,
    contextsReadOnly: true,
    sourceMappingRequired,
  };
}

export function validateReadOnlyContextsDoNotEnterScoring(summary: ReadOnlyContextCoverageSummary): {
  valid: boolean;
  reason: string;
} {
  const newsOk = summary.news.entersAlphaScore === false;
  const financialOk = summary.financial.entersAlphaScore === false;
  if (!newsOk || !financialOk) {
    return {
      valid: false,
      reason: "One or more contexts have entersAlphaScore !== false — scoring invariance broken",
    };
  }
  return {
    valid: true,
    reason: "All contexts have entersAlphaScore=false. No scoring path modification.",
  };
}

export function validateContextCoverageNoForbiddenClaims(summary: ReadOnlyContextCoverageSummary): {
  valid: boolean;
  reason: string;
  forbiddenFound: string[];
} {
  const summaryStr = JSON.stringify(summary);
  const forbidden = ["ROI", "profit", "buy", "sell", "outperform", "win-rate", "guaranteed"];
  const found = forbidden.filter((term) => summaryStr.includes(term));
  return {
    valid: found.length === 0,
    reason:
      found.length === 0
        ? "No forbidden claims found in context coverage summary."
        : `Forbidden claims found: ${found.join(", ")}`,
    forbiddenFound: found,
  };
}

export function validateContextCoverageNoOutcomeFields(summary: ReadOnlyContextCoverageSummary): {
  valid: boolean;
  reason: string;
} {
  const summaryKeys = JSON.stringify(summary);
  const forbidden = ["outcomePrice", "returnPct", "realizedReturnClass"];
  const found = forbidden.filter((f) => summaryKeys.includes(f));
  if (found.length > 0) {
    return {
      valid: false,
      reason: `Forbidden outcome fields found in summary: ${found.join(", ")}`,
    };
  }
  return {
    valid: true,
    reason: "No outcome fields (outcomePrice/returnPct/realizedReturnClass) in context coverage summary.",
  };
}
