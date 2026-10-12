/**
 * MonthlyRevenueAvailability.ts
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. Governance / PIT gate only.
 *
 * P17-HARDRESET: MonthlyRevenue releaseDate PIT availability helper.
 *
 * Rules:
 * 1. releaseDate present → available iff releaseDate <= asOfDate
 * 2. releaseDate missing + allowInferredReleaseDate=true → infer next-month-10th,
 *    releaseDateSource=INFERRED_NEXT_MONTH_10TH, releaseDateConfidence=LOW_TO_MEDIUM
 * 3. releaseDate missing + allowInferredReleaseDate=false → unavailable
 * 4. missing year/month → unavailable
 * 5. invalid month (0 or >12) → unavailable
 * 6. No outcome / returnPct / realizedReturnClass used
 * 7. Deterministic (no Math.random)
 */

// ─── Constants ──────────────────────────────────────────────────────────────

export const TAIWAN_REVENUE_RELEASE_DAY = 10;
export const INFERRED_RELEASE_DATE_SOURCE = 'INFERRED_NEXT_MONTH_10TH';
export const INFERRED_RELEASE_DATE_CONFIDENCE = 'LOW_TO_MEDIUM';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MonthlyRevenueRecord {
  stockId?: string | null;
  year: number | null | undefined;
  month: number | null | undefined;
  revenue?: number | null;
  releaseDate?: string | Date | null;
  releaseDateSource?: string | null;
  releaseDateConfidence?: string | null;
}

export interface MonthlyRevenueAvailabilityOptions {
  /** Allow falling back to inferred release date when explicit is missing */
  allowInferredReleaseDate?: boolean;
}

export interface MonthlyRevenueAvailabilityResult {
  available: boolean;
  stockId?: string | null;
  year?: number | null;
  month?: number | null;
  releaseDate: string | null;
  releaseDateSource: string | null;
  releaseDateConfidence: string | null;
  asOfDate: string;
  reason: string;
  inferred: boolean;
}

export interface MonthlyRevenueAvailabilityExplanation extends MonthlyRevenueAvailabilityResult {
  rule: string;
  details: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Compute the inferred release date for a given year/month.
 * Taiwan rule: revenue released on the 10th of the following month.
 * month=12 → year+1, month=1 → DATE(year+1, 1, 10)
 */
function inferReleaseDateString(year: number, month: number): string {
  if (month === 12) {
    return `${year + 1}-01-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`;
}

/**
 * Normalize a releaseDate value to an ISO date string (YYYY-MM-DD) or null.
 * Accepts Date objects or string. Does not interpret outcome/return fields.
 */
function toDateString(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    // Use UTC date parts to avoid timezone shift
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Accept YYYY-MM-DD or ISO 8601
  const s = String(value).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

/**
 * Compare two YYYY-MM-DD strings lexicographically (works for ISO dates).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ─── Exported API ────────────────────────────────────────────────────────────

/**
 * Infer the release date for a MonthlyRevenue record if it is missing.
 * Returns null if year/month is invalid.
 */
export function inferMonthlyRevenueReleaseDate(
  record: MonthlyRevenueRecord,
  _options?: MonthlyRevenueAvailabilityOptions,
): { releaseDate: string | null; releaseDateSource: string; releaseDateConfidence: string } | null {
  const year = record.year;
  const month = record.month;
  if (year === null || year === undefined || month === null || month === undefined) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;
  return {
    releaseDate: inferReleaseDateString(year, month),
    releaseDateSource: INFERRED_RELEASE_DATE_SOURCE,
    releaseDateConfidence: INFERRED_RELEASE_DATE_CONFIDENCE,
  };
}

/**
 * Normalize a MonthlyRevenue record's releaseDate to a canonical string.
 * If present (any format), converts to YYYY-MM-DD.
 */
export function normalizeMonthlyRevenueReleaseDate(
  record: MonthlyRevenueRecord,
): { releaseDate: string | null; releaseDateSource: string | null; releaseDateConfidence: string | null } {
  const normalized = toDateString(record.releaseDate);
  return {
    releaseDate: normalized,
    releaseDateSource: record.releaseDateSource ?? null,
    releaseDateConfidence: record.releaseDateConfidence ?? null,
  };
}

/**
 * Core PIT gate: determine if a MonthlyRevenue record is available as of a given date.
 *
 * Rules applied in order:
 * 1. Invalid year/month → unavailable
 * 2. releaseDate present → available iff releaseDate <= asOfDate
 * 3. releaseDate missing + allowInferredReleaseDate=true → infer + apply rule 2
 * 4. releaseDate missing + allowInferredReleaseDate=false → unavailable
 */
export function isMonthlyRevenueAvailableAsOf(
  record: MonthlyRevenueRecord,
  asOfDate: string,
  options?: MonthlyRevenueAvailabilityOptions,
): MonthlyRevenueAvailabilityResult {
  const allowInferred = options?.allowInferredReleaseDate ?? false;
  const baseResult = {
    stockId: record.stockId ?? null,
    year: record.year,
    month: record.month,
    asOfDate,
  };

  // Rule 4: missing year/month
  if (record.year === null || record.year === undefined) {
    return {
      ...baseResult,
      available: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      reason: 'missing year — unavailable',
      inferred: false,
    };
  }
  if (record.month === null || record.month === undefined) {
    return {
      ...baseResult,
      available: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      reason: 'missing month — unavailable',
      inferred: false,
    };
  }

  // Rule 5: invalid month
  if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12) {
    return {
      ...baseResult,
      available: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      reason: `invalid month ${record.month} — unavailable`,
      inferred: false,
    };
  }

  // Rule 2: explicit releaseDate present
  const explicitReleaseDate = toDateString(record.releaseDate);
  if (explicitReleaseDate !== null) {
    const isInferred = record.releaseDateSource === INFERRED_RELEASE_DATE_SOURCE;
    if (isInferred && !allowInferred) {
      return {
        ...baseResult,
        available: false,
        releaseDate: explicitReleaseDate,
        releaseDateSource: record.releaseDateSource ?? null,
        releaseDateConfidence: record.releaseDateConfidence ?? null,
        reason: `inferred releaseDate but allowInferredReleaseDate=false — unavailable`,
        inferred: true,
      };
    }
    const available = compareDates(explicitReleaseDate, asOfDate) <= 0;
    return {
      ...baseResult,
      available,
      releaseDate: explicitReleaseDate,
      releaseDateSource: record.releaseDateSource ?? null,
      releaseDateConfidence: record.releaseDateConfidence ?? null,
      reason: available
        ? `releaseDate (${explicitReleaseDate}) <= asOfDate (${asOfDate}) — available`
        : `releaseDate (${explicitReleaseDate}) > asOfDate (${asOfDate}) — unavailable`,
      inferred: isInferred,
    };
  }

  // Rule 3: inferred
  if (allowInferred) {
    const inferred = inferMonthlyRevenueReleaseDate(record);
    if (inferred && inferred.releaseDate) {
      const available = compareDates(inferred.releaseDate, asOfDate) <= 0;
      return {
        ...baseResult,
        available,
        releaseDate: inferred.releaseDate,
        releaseDateSource: inferred.releaseDateSource,
        releaseDateConfidence: inferred.releaseDateConfidence,
        reason: available
          ? `inferred releaseDate (${inferred.releaseDate}) <= asOfDate (${asOfDate}) — available`
          : `inferred releaseDate (${inferred.releaseDate}) > asOfDate (${asOfDate}) — unavailable`,
        inferred: true,
      };
    }
    return {
      ...baseResult,
      available: false,
      releaseDate: null,
      releaseDateSource: null,
      releaseDateConfidence: null,
      reason: 'could not infer releaseDate — unavailable',
      inferred: false,
    };
  }

  // Rule 4: no releaseDate, no inferred allowed
  return {
    ...baseResult,
    available: false,
    releaseDate: null,
    releaseDateSource: null,
    releaseDateConfidence: null,
    reason: 'no releaseDate and allowInferredReleaseDate=false — unavailable',
    inferred: false,
  };
}

/**
 * Filter an array of MonthlyRevenue records to those available as of asOfDate.
 * Records without a releaseDate are excluded by default (allowInferredReleaseDate=false).
 */
export function filterMonthlyRevenueAvailableAsOf<T extends MonthlyRevenueRecord>(
  records: T[],
  asOfDate: string,
  options?: MonthlyRevenueAvailabilityOptions,
): T[] {
  return records.filter(record => {
    const result = isMonthlyRevenueAvailableAsOf(record, asOfDate, options);
    return result.available;
  });
}

/**
 * Validate a MonthlyRevenueAvailabilityResult for required fields.
 */
export function validateMonthlyRevenueAvailabilityResult(
  result: MonthlyRevenueAvailabilityResult,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof result.available !== 'boolean') errors.push('available must be boolean');
  if (typeof result.reason !== 'string' || result.reason.trim() === '') errors.push('reason must be non-empty string');
  if (typeof result.asOfDate !== 'string') errors.push('asOfDate must be string');
  if (typeof result.inferred !== 'boolean') errors.push('inferred must be boolean');
  return { valid: errors.length === 0, errors };
}

/**
 * Produce a human-readable explanation of the availability decision.
 */
export function explainMonthlyRevenueAvailability(
  record: MonthlyRevenueRecord,
  asOfDate: string,
  options?: MonthlyRevenueAvailabilityOptions,
): MonthlyRevenueAvailabilityExplanation {
  const result = isMonthlyRevenueAvailableAsOf(record, asOfDate, options);
  let rule: string;
  let details: string;

  if (!result.available && (record.year === null || record.year === undefined)) {
    rule = 'RULE_4_MISSING_YEAR';
    details = 'Record has no year — cannot determine availability';
  } else if (!result.available && (record.month === null || record.month === undefined)) {
    rule = 'RULE_4_MISSING_MONTH';
    details = 'Record has no month — cannot determine availability';
  } else if (!result.available && result.releaseDate === null && !result.inferred) {
    rule = 'RULE_4_NO_RELEASE_DATE';
    details = `No releaseDate on record for ${record.year}/${record.month}. Set allowInferredReleaseDate=true to use Taiwan 10th-of-next-month inference.`;
  } else if (result.inferred) {
    rule = result.available ? 'RULE_3_INFERRED_AVAILABLE' : 'RULE_3_INFERRED_UNAVAILABLE';
    details = `releaseDate inferred via Taiwan RELEASE_DAY=${TAIWAN_REVENUE_RELEASE_DAY}: ${result.releaseDate}. Confidence: ${result.releaseDateConfidence}.`;
  } else {
    rule = result.available ? 'RULE_2_EXPLICIT_AVAILABLE' : 'RULE_2_EXPLICIT_UNAVAILABLE';
    details = `Explicit releaseDate=${result.releaseDate}, asOfDate=${asOfDate}.`;
  }

  return { ...result, rule, details };
}
