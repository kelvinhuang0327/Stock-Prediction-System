/**
 * P8SignalReasonDiagnosisUtils.ts
 * P8-PREFLIGHT — Signal / Reason Generic Diagnosis
 *
 * Pure TypeScript utility module. No external imports. No database access.
 * No investment recommendations. No ROI / alpha / edge / profit / win-rate claims.
 * All evaluation is descriptive root-cause pre-classification only.
 *
 * Exports:
 *   normalizeReasonText
 *   countFactorTokens
 *   classifyGenericReasonDiagnosis
 *   summarizeSignalReasonDiagnosis
 *   scanForbiddenClaims
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalReasonDiagnosisCategory =
  | 'TEMPLATE_TOO_GENERIC'
  | 'SNAPSHOT_CAPTURE_MISSING'
  | 'FACTOR_EXPLANATION_MISSING'
  | 'SCORING_ENGINE_UNDEROUTPUT'
  | 'UNKNOWN_REQUIRES_CODE_TRACE';

export type RecommendedRepairType =
  | 'ENRICH_REASON_TEMPLATE'
  | 'FIX_SNAPSHOT_FACTOR_CAPTURE'
  | 'ADD_FACTOR_EXPLANATION_LAYER'
  | 'FIX_SCORING_ENGINE_OUTPUT_COMPLETENESS'
  | 'MANUAL_REVIEW_REQUIRED';

export interface ForbiddenClaimMatch {
  pattern: string;
  context: string;
}

export interface GenericReasonCaseInput {
  caseId: string;
  symbol: string;
  originalAsOfDate: string;
  horizonDays: number;
  researchBucket?: string;
  score?: number | null;
  scoringCompletenessStatus?: string;
  signalReasonConsistency?: string;
  scoreBucketConsistency?: string;
  reasonSnapshotSummary?: string | null;
  topSignalOrFactor?: string | null;
  limitationNotes?: string[];
  [key: string]: unknown;
}

export interface SignalReasonCaseDiagnosis {
  caseId: string;
  symbol: string;
  asOf: string;
  horizon: number;
  reasonRaw: string;
  reasonNormalized: string;
  factorCount: number;
  factorSummary: string;
  diagnosisCategory: SignalReasonDiagnosisCategory;
  evidence: string;
  recommendedRepairType: RecommendedRepairType;
}

export interface SignalReasonDiagnosisSummary {
  totalGenericCases: number;
  byCategoryCount: Record<SignalReasonDiagnosisCategory, number>;
  dominantCategory: SignalReasonDiagnosisCategory;
  singleTokenReasonCount: number;
  partialScoringCount: number;
  factorTypeSummary: Record<string, number>;
  keyInsights: string[];
}

// ─── FORBIDDEN CLAIMS PATTERNS ────────────────────────────────────────────────
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bROI\b/i,                        label: 'ROI'                    },
  { pattern: /win[\s-]rate/i,                   label: 'win-rate'               },
  { pattern: /\balpha\b(?!\s*Score)/i,          label: 'alpha (non-alphaScore)' },
  { pattern: /\bedge\b/i,                       label: 'edge'                   },
  { pattern: /\bprofit\b/i,                     label: 'profit'                 },
  { pattern: /\boutperform\b/i,                 label: 'outperform'             },
  { pattern: /\bbeat\b/i,                       label: 'beat'                   },
  { pattern: /\bbuy\b/i,                        label: 'buy'                    },
  { pattern: /\bsell\b/i,                       label: 'sell'                   },
  { pattern: /\bguaranteed\b/i,                 label: 'guaranteed'             },
  { pattern: /investment\s+recommendation/i,    label: 'investment recommendation' },
];

// ─── Single-token reason patterns (recognized generic signal names) ────────────
// These are the known "top-level signal labels" that appear as sole reason text.
// A reason consisting ONLY of one of these tokens is considered too generic —
// it describes the category but not the underlying data/indicators.
const SINGLE_TOKEN_REASON_PATTERNS: string[] = [
  '技術偏多',  // technical bullish
  '技術偏空',  // technical bearish
  '法人買超',  // institutional net buy
  '法人賣超',  // institutional net sell
  '動能走弱',  // momentum weakening
  '動能轉強',  // momentum strengthening
  '籌碼偏多',  // chip/position bullish
  '籌碼偏空',  // chip/position bearish
  '基本面偏多', // fundamental bullish
  '基本面偏空', // fundamental bearish
];

// ─── normalizeReasonText ──────────────────────────────────────────────────────

/**
 * Normalize a raw reason snapshot text:
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Replace null/undefined with empty string
 */
export function normalizeReasonText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ');
}

// ─── countFactorTokens ────────────────────────────────────────────────────────

/**
 * Count the number of distinct factor tokens in a reason string.
 * Tokens are separated by " / " or "、" or "," (common delimiters in reason snapshots).
 * A single token (no delimiter) = 1.
 * Empty string = 0.
 */
export function countFactorTokens(reasonNormalized: string): number {
  if (!reasonNormalized) return 0;
  // Split on common delimiters
  const tokens = reasonNormalized.split(/\s*[\/、,]\s*/).filter(t => t.trim().length > 0);
  return tokens.length;
}

// ─── isSingleTokenGeneric ─────────────────────────────────────────────────────

/**
 * Returns true if the normalized reason is a single known generic signal token.
 * Internal helper.
 */
function isSingleTokenGeneric(reasonNormalized: string): boolean {
  const trimmed = reasonNormalized.trim();
  return SINGLE_TOKEN_REASON_PATTERNS.includes(trimmed);
}

// ─── classifyGenericReasonDiagnosis ──────────────────────────────────────────

/**
 * Classify a single generic-reason case into one of 5 root-cause categories.
 *
 * Classification rules (in priority order):
 *
 * 1. SNAPSHOT_CAPTURE_MISSING
 *    Condition: scoreBucketConsistency === 'INCONSISTENT' AND signalReasonConsistency === 'GENERIC'
 *    Interpretation: The snapshot captured a bucket that conflicts with the score,
 *    AND the reason is generic. The root cause is likely that the snapshot failed to capture
 *    the factor that triggered the bucket assignment (e.g., a signal-based Watch override).
 *
 * 2. FACTOR_EXPLANATION_MISSING
 *    Condition: reason is a single token AND that token is a non-technical factor
 *    (e.g., 法人買超 — institutional buying). Factor type is known but data/detail is absent.
 *
 * 3. SCORING_ENGINE_UNDEROUTPUT
 *    Condition: scoringCompletenessStatus === 'PARTIAL' AND reason is single token.
 *    The scoring engine did not fully output all factor dimensions, leaving the reason
 *    with only the top-level signal.
 *
 * 4. TEMPLATE_TOO_GENERIC
 *    Condition: scoringCompletenessStatus === 'COMPLETE' AND reason is a single
 *    known generic token. The engine had complete data but the reason template
 *    only emitted the category-level label.
 *
 * 5. UNKNOWN_REQUIRES_CODE_TRACE
 *    None of the above patterns match.
 */
export function classifyGenericReasonDiagnosis(
  caseRow: GenericReasonCaseInput
): SignalReasonCaseDiagnosis {
  const reasonRaw = caseRow.reasonSnapshotSummary ?? '';
  const reasonNormalized = normalizeReasonText(reasonRaw);
  const factorCount = countFactorTokens(reasonNormalized);
  const topSignal = normalizeReasonText(caseRow.topSignalOrFactor ?? '');
  const scoringStatus = (caseRow.scoringCompletenessStatus ?? 'UNKNOWN').toUpperCase();
  const bucketConsistency = caseRow.scoreBucketConsistency ?? '';
  const isInconsistentBucket = bucketConsistency === 'INCONSISTENT';
  const isPartialScoring = scoringStatus === 'PARTIAL';
  const isCompleteScoring = scoringStatus === 'COMPLETE';
  const isSingleToken = isSingleTokenGeneric(reasonNormalized);

  // Factor type classification (for factor summary)
  const isInstitutionalFactor =
    reasonNormalized.includes('法人') ||
    reasonNormalized.includes('籌碼');
  const isTechnicalFactor =
    reasonNormalized.includes('技術') ||
    reasonNormalized.includes('動能');

  const factorSummary = isSingleToken
    ? `Single token: "${reasonNormalized}" (${
        isInstitutionalFactor ? 'institutional/chip factor' :
        isTechnicalFactor     ? 'technical signal factor' :
                                'unclassified factor'
      }). No supporting indicators or data values captured.`
    : `Multi-token reason: "${reasonNormalized}" (${factorCount} tokens). Reason is specific enough for inspection.`;

  let diagnosisCategory: SignalReasonDiagnosisCategory;
  let evidence: string;
  let recommendedRepairType: RecommendedRepairType;

  // Rule 1: SNAPSHOT_CAPTURE_MISSING — bucket inconsistency + generic reason
  if (isInconsistentBucket && isSingleToken) {
    diagnosisCategory = 'SNAPSHOT_CAPTURE_MISSING';
    evidence =
      `scoreBucketConsistency=INCONSISTENT AND reason="${reasonNormalized}" is a single generic token. ` +
      `The snapshot did not capture the factor that triggered the bucket assignment. ` +
      `Without this factor in the snapshot, the reason cannot be more specific. ` +
      `Root cause: snapshot capture pipeline did not persist the bucket-triggering factor.`;
    recommendedRepairType = 'FIX_SNAPSHOT_FACTOR_CAPTURE';
  }
  // Rule 2: FACTOR_EXPLANATION_MISSING — institutional/chip factor, single token
  else if (isSingleToken && isInstitutionalFactor) {
    diagnosisCategory = 'FACTOR_EXPLANATION_MISSING';
    evidence =
      `reason="${reasonNormalized}" identifies an institutional/chip factor but provides no detail ` +
      `(e.g., which institutions, net volume, date range). ` +
      `scoringCompletenessStatus=${scoringStatus}. ` +
      `The factor label is captured but the underlying data explaining it is absent.`;
    recommendedRepairType = 'ADD_FACTOR_EXPLANATION_LAYER';
  }
  // Rule 3: SCORING_ENGINE_UNDEROUTPUT — partial scoring + single token
  else if (isPartialScoring && isSingleToken) {
    diagnosisCategory = 'SCORING_ENGINE_UNDEROUTPUT';
    evidence =
      `scoringCompletenessStatus=PARTIAL AND reason="${reasonNormalized}" is a single generic token. ` +
      `The scoring engine did not fully compute all factor dimensions, leaving the reason ` +
      `with only the top-level signal label. Supporting factor data was not available at capture time.`;
    recommendedRepairType = 'FIX_SCORING_ENGINE_OUTPUT_COMPLETENESS';
  }
  // Rule 4: TEMPLATE_TOO_GENERIC — complete scoring + single token
  else if (isCompleteScoring && isSingleToken) {
    diagnosisCategory = 'TEMPLATE_TOO_GENERIC';
    evidence =
      `scoringCompletenessStatus=COMPLETE AND reason="${reasonNormalized}" is a single generic token. ` +
      `The scoring engine had all required data but the reason template only emitted ` +
      `the category-level signal name. The template needs to be enriched to include ` +
      `supporting indicator values and context (e.g., MA direction, RSI level, volume trend).`;
    recommendedRepairType = 'ENRICH_REASON_TEMPLATE';
  }
  // Rule 5: UNKNOWN
  else {
    diagnosisCategory = 'UNKNOWN_REQUIRES_CODE_TRACE';
    evidence =
      `reason="${reasonNormalized}", factorCount=${factorCount}, scoringStatus=${scoringStatus}, ` +
      `bucketConsistency=${bucketConsistency}. ` +
      `No pattern from the above rules matches. Requires code trace of reason generation path.`;
    recommendedRepairType = 'MANUAL_REVIEW_REQUIRED';
  }

  return {
    caseId: caseRow.caseId,
    symbol: caseRow.symbol,
    asOf: caseRow.originalAsOfDate,
    horizon: caseRow.horizonDays,
    reasonRaw,
    reasonNormalized,
    factorCount,
    factorSummary,
    diagnosisCategory,
    evidence,
    recommendedRepairType,
  };
}

// ─── summarizeSignalReasonDiagnosis ──────────────────────────────────────────

/**
 * Aggregate individual case diagnoses into a summary.
 */
export function summarizeSignalReasonDiagnosis(
  cases: SignalReasonCaseDiagnosis[],
  rawCases?: GenericReasonCaseInput[]
): SignalReasonDiagnosisSummary {
  const byCategoryCount: Record<SignalReasonDiagnosisCategory, number> = {
    TEMPLATE_TOO_GENERIC:         0,
    SNAPSHOT_CAPTURE_MISSING:     0,
    FACTOR_EXPLANATION_MISSING:   0,
    SCORING_ENGINE_UNDEROUTPUT:   0,
    UNKNOWN_REQUIRES_CODE_TRACE:  0,
  };

  let singleTokenReasonCount = 0;
  let partialScoringCount = 0;
  const factorTypeSummary: Record<string, number> = {};

  for (const c of cases) {
    byCategoryCount[c.diagnosisCategory]++;
    if (c.factorCount <= 1) singleTokenReasonCount++;

    // Count factor types
    const token = c.reasonNormalized.trim();
    factorTypeSummary[token] = (factorTypeSummary[token] ?? 0) + 1;
  }

  // Count partial scoring from raw cases
  if (rawCases) {
    for (const rc of rawCases) {
      if ((rc.scoringCompletenessStatus ?? '').toUpperCase() === 'PARTIAL') {
        partialScoringCount++;
      }
    }
  }

  // Dominant category
  let dominantCategory: SignalReasonDiagnosisCategory = 'UNKNOWN_REQUIRES_CODE_TRACE';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(byCategoryCount) as [SignalReasonDiagnosisCategory, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat;
    }
  }

  // Key insights
  const keyInsights: string[] = [
    `${singleTokenReasonCount}/${cases.length} cases have single-token reason snapshots — insufficient for factor-level explainability.`,
    `${partialScoringCount}/${cases.length} cases have PARTIAL scoring completeness — the engine did not output all factor dimensions.`,
    `Dominant root-cause category: ${dominantCategory} (${byCategoryCount[dominantCategory]} cases).`,
    'No reason or signal logic has been modified during this diagnosis phase.',
    'All repair actions are deferred to P8 execution phase (future sprint).',
  ];

  return {
    totalGenericCases: cases.length,
    byCategoryCount,
    dominantCategory,
    singleTokenReasonCount,
    partialScoringCount,
    factorTypeSummary,
    keyInsights,
  };
}

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

/**
 * Scan text for forbidden investment-related claims.
 * Returns matches with context. Empty array = clean.
 *
 * Allowed exceptions:
 * - "alphaScore" (field name, not a performance claim)
 * - Text in disclaimer blocks
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimMatch[] {
  const matches: ForbiddenClaimMatch[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Skip disclaimer lines
    if (/disclaimer/i.test(line)) continue;

    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      if (label === 'alpha (non-alphaScore)') {
        for (const m of line.matchAll(/\balpha\b/gi)) {
          const start = m.index ?? 0;
          const surrounding = line.slice(Math.max(0, start - 5), start + 15);
          if (/alphaScore/i.test(surrounding)) continue;
          matches.push({ pattern: label, context: line.trim().slice(0, 120) });
        }
        continue;
      }

      if (pattern.test(line)) {
        matches.push({ pattern: label, context: line.trim().slice(0, 120) });
      }
    }
  }

  return matches;
}
