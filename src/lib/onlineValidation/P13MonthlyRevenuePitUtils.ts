/**
 * P13-HARDRESET PART B: MonthlyRevenue PIT Contract Utility
 *
 * Defines deterministic rules for MonthlyRevenue PIT (Point-In-Time) gate.
 * Taiwan monthly revenue is released ~10th of the following month.
 *
 * SAFETY CONTRACT:
 * - Does NOT write production DB.
 * - Does NOT modify scoring formulas or bucket thresholds.
 * - Does NOT use stock price / returnPct / realizedReturnClass to infer releaseDate.
 * - Does NOT use outcomeDate / horizonDays to infer releaseDate.
 * - All inference is deterministic and documented.
 * - No ROI / win-rate / alpha / profit claims.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type ReleaseDateSource =
  | 'AUTHORITATIVE'
  | 'INFERRED_NEXT_MONTH_10TH'
  | 'MISSING'
  | 'INVALID'
  | 'FUTURE';

export type ReleaseDateConfidence = 'HIGH' | 'MEDIUM' | 'LOW_TO_MEDIUM' | 'NONE';

export interface MonthlyRevenueRecord {
  stockId?: string;
  year?: number | null;
  month?: number | null;
  revenue?: number | null;
  yoyGrowth?: number | null;
  momGrowth?: number | null;
  releaseDate?: string | null; // ISO date string YYYY-MM-DD if present
}

export interface NormalizedMonthlyRevenueRecord extends MonthlyRevenueRecord {
  normalized: true;
  periodValid: boolean;
  releaseDatePresent: boolean;
  releaseDateFormatValid: boolean | null;
}

export interface InferredReleaseDate {
  releaseDate: string | null; // YYYY-MM-DD or null if can't infer
  releaseDateSource: ReleaseDateSource;
  confidence: ReleaseDateConfidence;
  repairNeeded: boolean;
  reason: string;
}

export interface ReleaseDateValidation {
  valid: boolean;
  releaseDate: string | null;
  releaseDateSource: ReleaseDateSource;
  errors: string[];
  warnings: string[];
}

export interface AvailabilityResult {
  available: boolean;
  reason: string;
  releaseDateUsed: string | null;
  releaseDateSource: ReleaseDateSource;
  confidence: ReleaseDateConfidence;
  repairNeeded: boolean;
}

export interface MonthlyRevenuePitContract {
  contractId: string;
  contractVersion: string;
  generatedAt: string;
  sourceTable: 'MonthlyRevenue';
  pitRiskLevel: 'HIGH';
  currentGateType: 'YEAR_MONTH_PERIOD_GATE';
  targetGateType: 'RELEASE_DATE_GATE';
  releaseDateFieldExists: false;
  releaseDateFieldRequired: true;
  inferenceRule: string;
  inferenceRuleSource: string;
  forbiddenInferenceInputs: string[];
  repairStatus: 'REPAIR_REQUIRED';
  repairPriority: 'P0';
  repairDescription: string;
  pitSafetyRequirements: PitSafetyRequirement[];
  nonGoals: string[];
}

export interface PitSafetyRequirement {
  id: string;
  requirement: string;
  enforcement: 'HARD' | 'SOFT';
  status: 'ACTIVE' | 'PENDING_REPAIR';
}

export interface MonthlyRevenuePitRepairPlan {
  planId: string;
  generatedAt: string;
  repairItems: RepairItem[];
  overallStatus: 'PLAN_COMPLETE' | 'PLAN_PARTIAL' | 'PLAN_BLOCKED';
}

export interface RepairItem {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  description: string;
  requiredAction: string;
  blocking: boolean;
  estimatedEffort: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
}

export interface RepairPlanSummary {
  planId: string;
  totalItems: number;
  blockers: number;
  overallStatus: string;
  p0Items: string[];
  p1Items: string[];
  p2Items: string[];
}

export interface ForbiddenClaimsHit {
  label: string;
  matchedText: string;
  lineNumber: number;
  context: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Taiwan monthly revenue release rule (deterministic).
 * Source: TWSE/MOPS official regulation — revenue announced by 10th of following month.
 */
export const TAIWAN_REVENUE_RELEASE_DAY = 10;

/**
 * Fields that must never be used to infer releaseDate.
 */
export const FORBIDDEN_INFERENCE_INPUTS: ReadonlyArray<string> = [
  'outcomePrice',
  'returnPct',
  'realizedReturnClass',
  'futurePrice',
  'horizonReturnPct',
  'outcomeDate',
  'horizonDays',
  'baselineResult',
  'outcomeClose',
];

const FORBIDDEN_CLAIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/i, label: 'ROI' },
  { pattern: /win[\s-]rate/i, label: 'win-rate' },
  { pattern: /\bprofit\b/i, label: 'profit' },
  { pattern: /\boutperform\b/i, label: 'outperform' },
  { pattern: /\bbeat\b/i, label: 'beat' },
  { pattern: /\bguaranteed\b/i, label: 'guaranteed' },
  { pattern: /investment recommendation/i, label: 'investment recommendation' },
  { pattern: /\balpha\b/i, label: 'alpha' },
  { pattern: /\bedge\b/i, label: 'edge' },
  { pattern: /\b(buy|sell)\b/i, label: 'buy/sell' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/**
 * Given year=Y, month=M, compute the inferred releaseDate:
 * the 10th day of the following calendar month.
 * Deterministic. Does not use any stock price or outcome data.
 */
function computeInferredReleaseDate(year: number, month: number): string {
  // Next month — handle December → January roll
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  const mm = String(nextMonth).padStart(2, '0');
  const dd = String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0');
  return `${nextYear}-${mm}-${dd}`;
}

// ── Exported Functions ───────────────────────────────────────────────────────

/**
 * Normalize a raw MonthlyRevenue-like record.
 * Returns a validated, typed object. Does not modify DB.
 */
export function normalizeMonthlyRevenueRecord(
  record: unknown
): NormalizedMonthlyRevenueRecord {
  const r = (record ?? {}) as Record<string, unknown>;

  const year = typeof r['year'] === 'number' ? r['year'] : null;
  const month = typeof r['month'] === 'number' ? r['month'] : null;
  const periodValid =
    year !== null &&
    month !== null &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    year >= 1900 &&
    year <= 2100;

  const releaseDateRaw =
    typeof r['releaseDate'] === 'string' ? r['releaseDate'] : null;
  const releaseDatePresent = releaseDateRaw !== null;
  const releaseDateFormatValid = releaseDatePresent
    ? isValidIsoDate(releaseDateRaw!)
    : null;

  return {
    stockId: typeof r['stockId'] === 'string' ? r['stockId'] : undefined,
    year: year ?? undefined,
    month: month ?? undefined,
    revenue:
      typeof r['revenue'] === 'number' ? r['revenue'] : null,
    yoyGrowth:
      typeof r['yoyGrowth'] === 'number' ? r['yoyGrowth'] : null,
    momGrowth:
      typeof r['momGrowth'] === 'number' ? r['momGrowth'] : null,
    releaseDate: releaseDateRaw,
    normalized: true,
    periodValid,
    releaseDatePresent,
    releaseDateFormatValid,
  };
}

/**
 * Infer the releaseDate for a MonthlyRevenue record.
 *
 * Priority:
 * 1. If releaseDate present and valid → AUTHORITATIVE (no inference needed)
 * 2. If releaseDate present but invalid → INVALID
 * 3. If year/month present → INFERRED_NEXT_MONTH_10TH
 * 4. Otherwise → MISSING
 *
 * MUST NOT use stock prices, returnPct, realizedReturnClass, outcomeDate, horizonDays.
 */
export function inferMonthlyRevenueReleaseDate(
  record: MonthlyRevenueRecord,
  options?: { allowInference?: boolean }
): InferredReleaseDate {
  const allowInference = options?.allowInference !== false;

  // Case 1: authoritative releaseDate present
  if (record.releaseDate !== null && record.releaseDate !== undefined) {
    if (isValidIsoDate(record.releaseDate)) {
      return {
        releaseDate: record.releaseDate,
        releaseDateSource: 'AUTHORITATIVE',
        confidence: 'HIGH',
        repairNeeded: false,
        reason: 'releaseDate field is authoritative and valid.',
      };
    } else {
      return {
        releaseDate: null,
        releaseDateSource: 'INVALID',
        confidence: 'NONE',
        repairNeeded: true,
        reason: `releaseDate field exists but is not a valid ISO date: "${record.releaseDate}"`,
      };
    }
  }

  // Case 2: No releaseDate — try inference from year/month
  if (!allowInference) {
    return {
      releaseDate: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      repairNeeded: true,
      reason: 'releaseDate missing and inference is disabled.',
    };
  }

  const year = record.year;
  const month = record.month;

  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    year < 1900 ||
    year > 2100
  ) {
    return {
      releaseDate: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      repairNeeded: true,
      reason: 'year/month fields missing or invalid. Cannot infer releaseDate.',
    };
  }

  const inferredDate = computeInferredReleaseDate(year, month);

  return {
    releaseDate: inferredDate,
    releaseDateSource: 'INFERRED_NEXT_MONTH_10TH',
    confidence: 'LOW_TO_MEDIUM',
    repairNeeded: true,
    reason: `Inferred from Taiwan revenue release convention: 10th day of following month (year=${year}, month=${month} → ${inferredDate}). This is an approximation. Actual release date may vary. repairNeeded=true until authoritative releaseDate is stored.`,
  };
}

/**
 * Validate a releaseDate for a MonthlyRevenue record.
 * Checks format, logic consistency, and future date status.
 */
export function validateMonthlyRevenueReleaseDate(
  record: MonthlyRevenueRecord,
  options?: { asOfDate?: string }
): ReleaseDateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const inferred = inferMonthlyRevenueReleaseDate(record);

  if (inferred.releaseDateSource === 'MISSING') {
    errors.push('releaseDate is missing and year/month are invalid — cannot validate.');
    return {
      valid: false,
      releaseDate: null,
      releaseDateSource: 'MISSING',
      errors,
      warnings,
    };
  }

  if (inferred.releaseDateSource === 'INVALID') {
    errors.push(`releaseDate is invalid: "${record.releaseDate}"`);
    return {
      valid: false,
      releaseDate: null,
      releaseDateSource: 'INVALID',
      errors,
      warnings,
    };
  }

  const releaseDate = inferred.releaseDate!;

  // Future date check
  const now = new Date().toISOString().slice(0, 10);
  if (releaseDate > now) {
    warnings.push(`releaseDate ${releaseDate} is in the future (today=${now}).`);
  }

  // Period consistency: releaseDate should be after the reporting period end
  if (
    typeof record.year === 'number' &&
    typeof record.month === 'number'
  ) {
    const expectedMin = computeInferredReleaseDate(record.year, record.month);
    // releaseDate should be on or after the inferred minimum
    if (
      inferred.releaseDateSource === 'AUTHORITATIVE' &&
      releaseDate < expectedMin
    ) {
      warnings.push(
        `releaseDate ${releaseDate} is before expected minimum ${expectedMin} for period ${record.year}/${record.month}.`
      );
    }
  }

  if (inferred.releaseDateSource === 'INFERRED_NEXT_MONTH_10TH') {
    warnings.push(
      'Using INFERRED_NEXT_MONTH_10TH fallback. repairNeeded=true until authoritative releaseDate stored.'
    );
  }

  return {
    valid: errors.length === 0,
    releaseDate,
    releaseDateSource: inferred.releaseDateSource,
    errors,
    warnings,
  };
}

/**
 * Determine if a MonthlyRevenue record is available as-of a given date.
 *
 * Rules:
 * - If releaseDate exists and valid: available iff releaseDate <= asOfDate
 * - If no releaseDate: infer as nextMonth 10th; apply same gate; mark repairNeeded
 * - If year/month missing: unavailable
 * - Does NOT use price / return / outcome data
 */
export function isMonthlyRevenueAvailableAsOf(
  record: MonthlyRevenueRecord,
  asOfDate: string,
  options?: { allowInference?: boolean }
): AvailabilityResult {
  if (!isValidIsoDate(asOfDate)) {
    return {
      available: false,
      reason: `asOfDate "${asOfDate}" is not a valid ISO date (YYYY-MM-DD).`,
      releaseDateUsed: null,
      releaseDateSource: 'MISSING',
      confidence: 'NONE',
      repairNeeded: true,
    };
  }

  const inferred = inferMonthlyRevenueReleaseDate(record, options);

  if (inferred.releaseDate === null) {
    return {
      available: false,
      reason: inferred.reason,
      releaseDateUsed: null,
      releaseDateSource: inferred.releaseDateSource,
      confidence: inferred.confidence,
      repairNeeded: true,
    };
  }

  const available = inferred.releaseDate <= asOfDate;

  return {
    available,
    reason: available
      ? `releaseDate ${inferred.releaseDate} <= asOfDate ${asOfDate} (source: ${inferred.releaseDateSource})`
      : `releaseDate ${inferred.releaseDate} > asOfDate ${asOfDate} — data not yet released (source: ${inferred.releaseDateSource})`,
    releaseDateUsed: inferred.releaseDate,
    releaseDateSource: inferred.releaseDateSource,
    confidence: inferred.confidence,
    repairNeeded: inferred.repairNeeded,
  };
}

/**
 * Build the MonthlyRevenue PIT contract document.
 * Purely descriptive — does not write DB or modify scoring.
 */
export function buildMonthlyRevenuePitContract(
  options?: { generatedAt?: string }
): MonthlyRevenuePitContract {
  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  return {
    contractId: 'p13-monthly-revenue-pit-contract-v0',
    contractVersion: 'p13-monthly-revenue-pit-contract-v0',
    generatedAt,
    sourceTable: 'MonthlyRevenue',
    pitRiskLevel: 'HIGH',
    currentGateType: 'YEAR_MONTH_PERIOD_GATE',
    targetGateType: 'RELEASE_DATE_GATE',
    releaseDateFieldExists: false,
    releaseDateFieldRequired: true,
    inferenceRule:
      'Taiwan monthly revenue is officially released by the 10th calendar day of the following month (TWSE/MOPS regulation). Inferred releaseDate = year of period + (month of period + 1), day 10. December rolls to January of the next year.',
    inferenceRuleSource: 'TWSE/MOPS monthly revenue disclosure regulation',
    forbiddenInferenceInputs: FORBIDDEN_INFERENCE_INPUTS as string[],
    repairStatus: 'REPAIR_REQUIRED',
    repairPriority: 'P0',
    repairDescription:
      'Add releaseDate (DateTime?) field to MonthlyRevenue schema. Backfill existing records: releaseDate = 10th day of following month, mark releaseDateSource = INFERRED_NEXT_MONTH_10TH. Update all query gates to use releaseDate <= asOfDate. Requires explicit production migration approval before execution.',
    pitSafetyRequirements: [
      {
        id: 'P13-MR-001',
        requirement: 'All MonthlyRevenue queries must gate by releaseDate <= asOfDate (or inferred releaseDate when field absent).',
        enforcement: 'HARD',
        status: 'PENDING_REPAIR',
      },
      {
        id: 'P13-MR-002',
        requirement: 'releaseDate must never be inferred from stock price, returnPct, realizedReturnClass, outcomeDate, or horizonDays.',
        enforcement: 'HARD',
        status: 'ACTIVE',
      },
      {
        id: 'P13-MR-003',
        requirement: 'Records with inferred releaseDate must be labeled releaseDateSource=INFERRED_NEXT_MONTH_10TH and repairNeeded=true.',
        enforcement: 'HARD',
        status: 'ACTIVE',
      },
      {
        id: 'P13-MR-004',
        requirement: 'FundamentalResearchService.buildFundamentalResearchContextForSymbol must not return revenue records whose inferred releaseDate > asOfDate.',
        enforcement: 'SOFT',
        status: 'PENDING_REPAIR',
      },
      {
        id: 'P13-MR-005',
        requirement: 'Production DB migration must be explicitly approved before any schema changes are applied.',
        enforcement: 'HARD',
        status: 'ACTIVE',
      },
    ],
    nonGoals: [
      'This contract does NOT modify scoring formulas, alphaScore, or recommendationBucket.',
      'This contract does NOT write production DB.',
      'This contract does NOT produce ROI figures, win rates, alpha calculations, profit estimates, or performance guarantees.',
      'This contract does NOT modify P0/P1/P3/P4 corpus or simulation_snapshot_corpus.',
      'This contract does NOT tune releaseDate based on realized returns or outcome data.',
      'This contract does NOT modify ManualReview* modules.',
    ],
  };
}

/**
 * Validate a MonthlyRevenuePitContract for structural completeness.
 */
export function validateMonthlyRevenuePitContract(
  contract: MonthlyRevenuePitContract
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!contract.contractId) errors.push('Missing contractId');
  if (!contract.contractVersion) errors.push('Missing contractVersion');
  if (contract.pitRiskLevel !== 'HIGH') errors.push(`Expected pitRiskLevel=HIGH, got ${contract.pitRiskLevel}`);
  if (contract.releaseDateFieldExists !== false) errors.push('releaseDateFieldExists should be false');
  if (contract.releaseDateFieldRequired !== true) errors.push('releaseDateFieldRequired should be true');
  if (!contract.inferenceRule) errors.push('Missing inferenceRule');
  if (!Array.isArray(contract.forbiddenInferenceInputs) || contract.forbiddenInferenceInputs.length === 0) {
    errors.push('forbiddenInferenceInputs must be a non-empty array');
  }
  if (!Array.isArray(contract.pitSafetyRequirements) || contract.pitSafetyRequirements.length === 0) {
    errors.push('pitSafetyRequirements must be a non-empty array');
  }
  if (!Array.isArray(contract.nonGoals) || contract.nonGoals.length === 0) {
    errors.push('nonGoals must be a non-empty array');
  }
  if (contract.repairStatus !== 'REPAIR_REQUIRED') {
    warnings.push(`repairStatus is ${contract.repairStatus}, expected REPAIR_REQUIRED`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Summarize a MonthlyRevenue PIT repair plan.
 */
export function summarizeMonthlyRevenuePitRepairPlan(
  plan: MonthlyRevenuePitRepairPlan
): RepairPlanSummary {
  const blockers = plan.repairItems.filter(i => i.blocking && i.status !== 'DONE');
  const p0 = plan.repairItems.filter(i => i.priority === 'P0');
  const p1 = plan.repairItems.filter(i => i.priority === 'P1');
  const p2 = plan.repairItems.filter(i => i.priority === 'P2');

  return {
    planId: plan.planId,
    totalItems: plan.repairItems.length,
    blockers: blockers.length,
    overallStatus: plan.overallStatus,
    p0Items: p0.map(i => i.description),
    p1Items: p1.map(i => i.description),
    p2Items: p2.map(i => i.description),
  };
}

/**
 * Scan text for forbidden investment claims.
 * Skips lines that contain "disclaimer".
 * Returns all hits with line numbers and context.
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimsHit[] {
  const hits: ForbiddenClaimsHit[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    // Skip lines that are disclaimers
    if (lineLower.includes('disclaimer')) continue;
    // Skip lines explicitly about non-goals (contain "does NOT" or "does not")
    if (lineLower.includes('does not') || lineLower.includes('does not')) continue;

    for (const { pattern, label } of FORBIDDEN_CLAIM_PATTERNS) {
      if (label === 'alpha' && lineLower.includes('alphascore')) continue;
      if (label === 'edge' && (lineLower.includes('knowledge') || lineLower.includes('hedge'))) continue;
      if (pattern.test(line)) {
        hits.push({
          label,
          matchedText: line.trim(),
          lineNumber: i + 1,
          context: [lines[i - 1] ?? '', line, lines[i + 1] ?? ''].join('\n'),
        });
      }
    }
  }

  return hits;
}
