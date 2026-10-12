/**
 * P26C-HARDRESET: FinancialReport Availability PIT Adapter Utils
 *
 * Pure functions for normalizing, filtering, and building PIT-safe context snapshots
 * from FinancialReport data. FinancialReport is read-only metadata only.
 *
 * Visibility gate: availabilityDate <= asOfDate
 * availabilityDate priority: filingDate → announcementDate → publishedAt → availableAt
 * Timezone: UTC+8 (Taiwan, no DST)
 *
 * Disclaimer: No investment recommendations. No ROI/win-rate/profit/outperform/buy/sell claims.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawFinancialReport {
  reportId?: string;
  symbol?: string;
  fiscalYear?: number | string;
  fiscalQuarter?: string;
  reportType?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  filingDate?: string;
  announcementDate?: string;
  publishedAt?: string;
  availableAt?: string;
  source?: string;
  sourceHash?: string;
  ingestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  metrics?: Record<string, number | null>;
}

export interface NormalizedFinancialReport {
  reportId: string;
  symbol: string;
  fiscalYear: string;
  fiscalQuarter: string;
  reportType: string;
  periodStartDate: string | null;
  periodEndDate: string | null;
  filingDate: string | null;
  announcementDate: string | null;
  publishedAt: string | null;
  availableAt: string | null;
  source: string;
  sourceHash: string;
  ingestedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  metrics: Record<string, number | null>;
}

export interface FinancialReportContextEvent {
  reportId: string;
  fiscalYear: string;
  fiscalQuarter: string;
  reportType: string;
  periodEndDate: string | null;
  availabilityDate: string | null;
  availabilityDateSource: 'filingDate' | 'announcementDate' | 'publishedAt' | 'availableAt' | 'MISSING';
  sourceHash: string;
  metricsSummary: Record<string, number | null>;
  ingestionLagDays: number | null;
  pitVisibility:
    | 'VISIBLE_AS_OF'
    | 'FUTURE_AVAILABILITY_DATE_EXCLUDED'
    | 'INVALID_MISSING_AVAILABILITY_DATE'
    | 'WRONG_SYMBOL'
    | 'DUPLICATE_EXCLUDED';
}

export interface FinancialReportContextSnapshot {
  asOfDate: string;
  symbol: string;
  visibleReportCount: number;
  reports: FinancialReportContextEvent[];
  readOnly: true;
  entersAlphaScore: false;
  visibilityGate: 'availabilityDate <= asOfDate';
}

// ---------------------------------------------------------------------------
// Timezone helper (Taiwan UTC+8, no DST)
// ---------------------------------------------------------------------------

function toTaiwanDate(isoTs: string | null | undefined): string | null {
  if (!isoTs) return null;
  try {
    const ms = Date.parse(isoTs);
    if (isNaN(ms)) return null;
    const d = new Date(ms + 8 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function nullableString(v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === '') return null;
  return v;
}

// ---------------------------------------------------------------------------
// normalizeFinancialReport
// ---------------------------------------------------------------------------

export function normalizeFinancialReport(raw: RawFinancialReport): NormalizedFinancialReport {
  return {
    reportId: raw.reportId ?? 'UNKNOWN_REPORT_ID',
    symbol: raw.symbol ?? 'UNKNOWN_SYMBOL',
    fiscalYear: raw.fiscalYear !== undefined && raw.fiscalYear !== null ? String(raw.fiscalYear) : 'UNKNOWN',
    fiscalQuarter: raw.fiscalQuarter ?? 'UNKNOWN',
    reportType: raw.reportType ?? 'unknown',
    periodStartDate: nullableString(raw.periodStartDate),
    periodEndDate: nullableString(raw.periodEndDate),
    filingDate: nullableString(raw.filingDate),
    announcementDate: nullableString(raw.announcementDate),
    publishedAt: nullableString(raw.publishedAt),
    availableAt: nullableString(raw.availableAt),
    source: raw.source ?? 'UNKNOWN',
    sourceHash: raw.sourceHash ?? '',
    ingestedAt: nullableString(raw.ingestedAt),
    createdAt: nullableString(raw.createdAt),
    updatedAt: nullableString(raw.updatedAt),
    metrics: raw.metrics ? { ...raw.metrics } : {},
  };
}

// ---------------------------------------------------------------------------
// resolveFinancialReportAvailabilityDate
// Priority: filingDate → announcementDate → publishedAt → availableAt
// ---------------------------------------------------------------------------

export function resolveFinancialReportAvailabilityDate(
  report: RawFinancialReport | NormalizedFinancialReport
): { date: string | null; source: 'filingDate' | 'announcementDate' | 'publishedAt' | 'availableAt' | 'MISSING' } {
  const filingDate = nullableString(report.filingDate);
  if (filingDate) {
    return { date: toTaiwanDate(filingDate), source: 'filingDate' };
  }

  const announcementDate = nullableString(report.announcementDate);
  if (announcementDate) {
    return { date: toTaiwanDate(announcementDate), source: 'announcementDate' };
  }

  const publishedAt = nullableString(report.publishedAt);
  if (publishedAt) {
    return { date: toTaiwanDate(publishedAt), source: 'publishedAt' };
  }

  const availableAt = nullableString(report.availableAt);
  if (availableAt) {
    return { date: toTaiwanDate(availableAt), source: 'availableAt' };
  }

  return { date: null, source: 'MISSING' };
}

// ---------------------------------------------------------------------------
// isFinancialReportVisibleAsOf
// ---------------------------------------------------------------------------

export function isFinancialReportVisibleAsOf(
  report: RawFinancialReport | NormalizedFinancialReport,
  asOfDate: string
): boolean {
  const { date } = resolveFinancialReportAvailabilityDate(report);
  if (!date) return false;
  return date <= asOfDate;
}

// ---------------------------------------------------------------------------
// filterFinancialReportsVisibleAsOf
// ---------------------------------------------------------------------------

export function filterFinancialReportsVisibleAsOf(
  reports: RawFinancialReport[],
  asOfDate: string
): RawFinancialReport[] {
  return reports.filter(r => isFinancialReportVisibleAsOf(r, asOfDate));
}

// ---------------------------------------------------------------------------
// computeIngestionLagDays
// ingestedAt vs availabilityDate (both Taiwan dates)
// ---------------------------------------------------------------------------

function computeIngestionLagDays(
  ingestedAt: string | null | undefined,
  availabilityDate: string | null
): number | null {
  if (!ingestedAt || !availabilityDate) return null;
  const ingestTaipei = toTaiwanDate(ingestedAt);
  if (!ingestTaipei) return null;
  const avMs = Date.parse(availabilityDate + 'T00:00:00Z');
  const inMs = Date.parse(ingestTaipei + 'T00:00:00Z');
  if (isNaN(avMs) || isNaN(inMs)) return null;
  return Math.round((inMs - avMs) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// buildFinancialReportContextSnapshot
// ---------------------------------------------------------------------------

export function buildFinancialReportContextSnapshot(
  reports: RawFinancialReport[],
  asOfDate: string,
  symbol: string
): FinancialReportContextSnapshot {
  const events: FinancialReportContextEvent[] = [];
  const seenHashes = new Set<string>();

  for (const raw of reports) {
    const norm = normalizeFinancialReport(raw);

    // Wrong symbol
    if (norm.symbol !== symbol) {
      events.push({
        reportId: norm.reportId,
        fiscalYear: norm.fiscalYear,
        fiscalQuarter: norm.fiscalQuarter,
        reportType: norm.reportType,
        periodEndDate: norm.periodEndDate,
        availabilityDate: null,
        availabilityDateSource: 'MISSING',
        sourceHash: norm.sourceHash,
        metricsSummary: norm.metrics,
        ingestionLagDays: null,
        pitVisibility: 'WRONG_SYMBOL',
      });
      continue;
    }

    // Duplicate by sourceHash
    if (norm.sourceHash && seenHashes.has(norm.sourceHash)) {
      events.push({
        reportId: norm.reportId,
        fiscalYear: norm.fiscalYear,
        fiscalQuarter: norm.fiscalQuarter,
        reportType: norm.reportType,
        periodEndDate: norm.periodEndDate,
        availabilityDate: null,
        availabilityDateSource: 'MISSING',
        sourceHash: norm.sourceHash,
        metricsSummary: norm.metrics,
        ingestionLagDays: null,
        pitVisibility: 'DUPLICATE_EXCLUDED',
      });
      continue;
    }

    if (norm.sourceHash) {
      seenHashes.add(norm.sourceHash);
    }

    const { date: availabilityDate, source: availabilityDateSource } =
      resolveFinancialReportAvailabilityDate(norm);

    const ingestionLagDays = computeIngestionLagDays(norm.ingestedAt, availabilityDate);

    let pitVisibility: FinancialReportContextEvent['pitVisibility'];
    if (!availabilityDate) {
      pitVisibility = 'INVALID_MISSING_AVAILABILITY_DATE';
    } else if (availabilityDate <= asOfDate) {
      pitVisibility = 'VISIBLE_AS_OF';
    } else {
      pitVisibility = 'FUTURE_AVAILABILITY_DATE_EXCLUDED';
    }

    events.push({
      reportId: norm.reportId,
      fiscalYear: norm.fiscalYear,
      fiscalQuarter: norm.fiscalQuarter,
      reportType: norm.reportType,
      periodEndDate: norm.periodEndDate,
      availabilityDate,
      availabilityDateSource,
      sourceHash: norm.sourceHash,
      metricsSummary: norm.metrics,
      ingestionLagDays,
      pitVisibility,
    });
  }

  const visibleReportCount = events.filter(e => e.pitVisibility === 'VISIBLE_AS_OF').length;

  return {
    asOfDate,
    symbol,
    visibleReportCount,
    reports: events,
    readOnly: true,
    entersAlphaScore: false,
    visibilityGate: 'availabilityDate <= asOfDate',
  };
}

// ---------------------------------------------------------------------------
// summarizeFinancialReportContextForReason
// Neutral descriptive text only — no investment claims.
// ---------------------------------------------------------------------------

export function summarizeFinancialReportContextForReason(
  contextSnapshot: FinancialReportContextSnapshot
): string {
  const { visibleReportCount, asOfDate, symbol, reports } = contextSnapshot;

  if (visibleReportCount === 0) {
    return (
      `No financial reports with availability date on or before ${asOfDate} were found for ${symbol}. ` +
      `Financial report context is read-only metadata.`
    );
  }

  const reportTypes = [
    ...new Set(
      reports
        .filter(r => r.pitVisibility === 'VISIBLE_AS_OF')
        .map(r => r.reportType || 'unknown')
    ),
  ].join(', ');

  return (
    `${visibleReportCount} financial report(s) with availability date on or before ${asOfDate} were recorded for ${symbol}. ` +
    `Report types: ${reportTypes}. ` +
    `Financial report context is read-only metadata and does not enter scoring.`
  );
}

// ---------------------------------------------------------------------------
// validateFinancialReportContextIsReadOnly
// ---------------------------------------------------------------------------

export function validateFinancialReportContextIsReadOnly(
  snapshot: FinancialReportContextSnapshot
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (snapshot.readOnly !== true) {
    errors.push('readOnly must be true');
  }
  if (snapshot.entersAlphaScore !== false) {
    errors.push('entersAlphaScore must be false');
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// validateNoOutcomeFieldsInFinancialReportContext
// ---------------------------------------------------------------------------

export function validateNoOutcomeFieldsInFinancialReportContext(
  snapshot: FinancialReportContextSnapshot
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const serialized = JSON.stringify(snapshot);
  const forbidden = ['outcomePrice', 'returnPct', 'realizedReturnClass', 'futurePriceMovement', 'postAsOfReport'];
  for (const field of forbidden) {
    if (serialized.includes(field)) {
      errors.push(`Forbidden field '${field}' found in FinancialReport context snapshot`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// validateNoPeriodEndDateVisibilityLeak
// Verifies: any report where periodEndDate <= asOfDate but availabilityDate > asOfDate
// is correctly NOT visible (no leak).
// ---------------------------------------------------------------------------

export function validateNoPeriodEndDateVisibilityLeak(
  reports: RawFinancialReport[],
  asOfDate: string
): { valid: boolean; leaks: string[] } {
  const leaks: string[] = [];

  for (const raw of reports) {
    const norm = normalizeFinancialReport(raw);
    const { date: availabilityDate } = resolveFinancialReportAvailabilityDate(norm);

    // Case: periodEndDate is before or on asOfDate, but availabilityDate is in the future
    if (norm.periodEndDate && norm.periodEndDate <= asOfDate) {
      if (availabilityDate && availabilityDate > asOfDate) {
        // This report should NOT be visible — verify isFinancialReportVisibleAsOf returns false
        const visible = isFinancialReportVisibleAsOf(norm, asOfDate);
        if (visible) {
          leaks.push(
            `LEAK detected: reportId=${norm.reportId} periodEndDate=${norm.periodEndDate} <= asOfDate=${asOfDate} ` +
            `but availabilityDate=${availabilityDate} > asOfDate — should NOT be visible but isVisible=true`
          );
        }
      }
    }
  }

  return { valid: leaks.length === 0, leaks };
}

// ---------------------------------------------------------------------------
// validateNoIngestedAtVisibilityLeak
// Verifies: ingestedAt has no effect on visibility.
// ---------------------------------------------------------------------------

export function validateNoIngestedAtVisibilityLeak(
  reports: RawFinancialReport[],
  asOfDate: string
): { valid: boolean; leaks: string[] } {
  const leaks: string[] = [];

  for (const raw of reports) {
    const norm = normalizeFinancialReport(raw);
    const { date: availabilityDate } = resolveFinancialReportAvailabilityDate(norm);
    const visibleByAvailability = availabilityDate ? availabilityDate <= asOfDate : false;
    const visibleByFunction = isFinancialReportVisibleAsOf(norm, asOfDate);

    if (visibleByAvailability !== visibleByFunction) {
      leaks.push(
        `LEAK detected: reportId=${norm.reportId} ingestedAt=${norm.ingestedAt} ` +
        `visibleByAvailability=${visibleByAvailability} but isFinancialReportVisibleAsOf=${visibleByFunction}`
      );
    }
  }

  return { valid: leaks.length === 0, leaks };
}

// ---------------------------------------------------------------------------
// classifyFinancialReportAvailabilityStatus
// ---------------------------------------------------------------------------

export function classifyFinancialReportAvailabilityStatus(
  reports: RawFinancialReport[],
  asOfDate: string
): {
  total: number;
  visibleAsOf: number;
  futureAvailabilityDateExcluded: number;
  invalidMissingAvailabilityDate: number;
  byAvailabilitySource: Record<string, number>;
} {
  let visibleAsOf = 0;
  let futureAvailabilityDateExcluded = 0;
  let invalidMissingAvailabilityDate = 0;
  const byAvailabilitySource: Record<string, number> = {
    filingDate: 0,
    announcementDate: 0,
    publishedAt: 0,
    availableAt: 0,
    MISSING: 0,
  };

  for (const raw of reports) {
    const { date: availabilityDate, source } = resolveFinancialReportAvailabilityDate(raw);
    byAvailabilitySource[source] = (byAvailabilitySource[source] ?? 0) + 1;

    if (!availabilityDate) {
      invalidMissingAvailabilityDate++;
    } else if (availabilityDate <= asOfDate) {
      visibleAsOf++;
    } else {
      futureAvailabilityDateExcluded++;
    }
  }

  return {
    total: reports.length,
    visibleAsOf,
    futureAvailabilityDateExcluded,
    invalidMissingAvailabilityDate,
    byAvailabilitySource,
  };
}
