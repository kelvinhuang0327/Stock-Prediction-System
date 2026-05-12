/**
 * P6BucketSchemaDiagnosisUtils.ts
 * P6-HARDRESET-LITE — Bucket Schema Short Diagnosis
 *
 * Pure TypeScript utility module. No external imports. No database access.
 * No investment recommendations. No ROI / alpha / edge / profit / win-rate claims.
 * All evaluation is descriptive schema / observability diagnosis only.
 *
 * Exports:
 *   extractInconsistentCases
 *   normalizeBucketLabel
 *   inferExpectedBucketFromScore
 *   diagnoseBucketInconsistency
 *   summarizeBucketSchemaDiagnosis
 *   buildBucketSchemaShortVerdict
 *   scanForbiddenClaims
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CanonicalBucketLabel =
  | 'Strong'
  | 'Watch'
  | 'Neutral'
  | 'LowPriority'
  | 'InsufficientData'
  | 'Unknown';

export type DiagnosisCategory =
  | 'BUCKET_MAPPING_MISMATCH'
  | 'SCORE_THRESHOLD_MISMATCH'
  | 'NORMALIZATION_GAP'
  | 'SNAPSHOT_CAPTURE_MISMATCH'
  | 'FACTOR_AGGREGATION_AMBIGUOUS'
  | 'UNKNOWN_REQUIRES_CODE_TRACE';

export type BucketSchemaVerdict =
  | 'SCHEMA_BUG'
  | 'BY_DESIGN_BOUNDARY'
  | 'NEEDS_CODE_TRACE';

export type RecommendedRepairType =
  | 'FREEZE_CONTRACT_AS_BOUNDARY'
  | 'FIX_BUCKET_MAPPING_CODE'
  | 'TRACE_SCORE_AGGREGATION'
  | 'TRACE_SNAPSHOT_CAPTURE'
  | 'MANUAL_REVIEW_REQUIRED';

export interface ForbiddenClaimMatch {
  pattern: string;
  context: string;
}

export interface ReviewCaseRow {
  caseId: string;
  symbol: string;
  originalAsOfDate: string;
  horizonDays: number;
  researchBucket?: string;
  activeScoringBucket?: string;
  score?: number | null;
  scoreDecile?: number | null;
  scoringCompletenessStatus?: string;
  scoreBucketConsistency?: string;
  signalReasonConsistency?: string;
  reasonSnapshotSummary?: string;
  topSignalOrFactor?: string;
  followupCategory?: string;
  limitationNotes?: string[];
  [key: string]: unknown;
}

export interface InferBucketOptions {
  /** Strong threshold: score >= this → Strong */
  strongThreshold?: number;
  /** Watch lower bound: score >= this AND < strongThreshold → Watch candidate */
  watchLow?: number;
  /** Neutral lower bound: score >= this AND < watchLow → Neutral candidate */
  neutralLow?: number;
}

export interface DiagnoseBucketOptions extends InferBucketOptions {
  /** Additional fields to inspect for snapshot capture mismatches */
  snapshotFields?: string[];
}

export interface CaseDiagnosisResult {
  caseId: string;
  symbol: string;
  asOf: string;
  horizon: number;
  score: number | null;
  scoreSource: string;
  researchBucket: string;
  normalizedBucket: CanonicalBucketLabel;
  activeScoringSnapshotBucket: string | null;
  topLevelBucket: string;
  scoreSnapshotFields: Record<string, unknown>;
  isWatchLowScoreBoundaryPattern: boolean;
  diagnosisCategory: DiagnosisCategory;
  evidence: string;
  recommendedRepairType: RecommendedRepairType;
  whyNoModelChangeNow: string;
}

export interface BucketSchemaDiagnosisSummary {
  totalInconsistentCases: number;
  byCategoryCount: Record<DiagnosisCategory, number>;
  watchLowScoreBoundaryCount: number;
  dominantCategory: DiagnosisCategory;
  observedScoreRange: { min: number; max: number } | null;
  observedBuckets: string[];
  proposedVerdict: BucketSchemaVerdict;
  verdictEvidence: string;
}

export interface BucketSchemaShortVerdict {
  verdict: BucketSchemaVerdict;
  summary: string;
  dominantCategory: DiagnosisCategory;
  watchBoundaryPattern: {
    detected: boolean;
    caseCount: number;
    scoreRange: string;
    interpretation: string;
  };
  nextStepGuidance: string;
  requiresContractFreeze: boolean;
}

// ─── Score bands (descriptive calibration only, not investment thresholds) ────
//
// These bands are derived from the observed schema in P5WalkthroughReviewUtils.
// They are used ONLY for schema self-consistency checking.
// NOT used for investment decisions, recommendations, or performance evaluation.
const SCHEMA_SCORE_BANDS: Record<string, { low: number; high: number }> = {
  Strong:        { low: 60, high: 100 },
  Watch:         { low: 40, high: 70  },
  Neutral:       { low: 30, high: 70  },
  LowPriority:   { low: 0,  high: 50  },
};

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

// ─── normalizeBucketLabel ─────────────────────────────────────────────────────

/**
 * Normalize a raw bucket label string into a canonical form.
 * Handles Chinese labels (偏多/偏空), trailing spaces, capitalization variants,
 * "Insufficient Data", empty strings, and null/undefined.
 *
 * No investment logic — purely string normalization for schema consistency checking.
 */
export function normalizeBucketLabel(raw: string | null | undefined): CanonicalBucketLabel {
  if (raw === null || raw === undefined) return 'Unknown';
  const trimmed = raw.trim();
  if (trimmed === '') return 'Unknown';

  const lower = trimmed.toLowerCase();

  // Chinese aliases
  if (lower === '偏多' || lower === '強多' || lower === 'strongbull') return 'Strong';
  if (lower === '偏空' || lower === '弱空' || lower === 'weakbear') return 'LowPriority';
  if (lower === '觀察' || lower === '留意' || lower === 'watch') return 'Watch';
  if (lower === '中性' || lower === 'neutral') return 'Neutral';
  if (lower === '低優先' || lower === '低優先度' || lower === 'lowpriority' || lower === 'low priority') return 'LowPriority';

  // English standard labels (case-insensitive)
  if (/^strong(\s+candidate)?$/i.test(trimmed)) return 'Strong';
  if (/^watch(\s+candidate)?$/i.test(trimmed)) return 'Watch';
  if (/^neutral$/i.test(trimmed)) return 'Neutral';
  if (/^low[\s-]?priority$/i.test(trimmed)) return 'LowPriority';
  if (/^insufficient[\s-]?data$/i.test(trimmed)) return 'InsufficientData';
  if (/^n\/a$/i.test(trimmed) || lower === 'na' || lower === 'none') return 'InsufficientData';

  return 'Unknown';
}

// ─── inferExpectedBucketFromScore ─────────────────────────────────────────────

/**
 * Given a numeric score, infer the expected canonical bucket label using
 * the schema score bands. This is deterministic (no randomness).
 *
 * Score ranges (from P5 schema calibration):
 *   Strong:       60–100
 *   Watch:        40–69
 *   Neutral:      30–59 (overlap with Watch intentional — boundary zone)
 *   LowPriority:  0–39
 *   InsufficientData: null/undefined/NaN
 *
 * Ambiguous overlaps (40–59) are reported as Neutral (lower confidence wins).
 */
export function inferExpectedBucketFromScore(
  score: number | null | undefined,
  _opts: InferBucketOptions = {}
): CanonicalBucketLabel {
  if (score === null || score === undefined || isNaN(score as number)) {
    return 'InsufficientData';
  }

  const s = score as number;

  if (s >= 60) return 'Strong';
  if (s >= 40) return 'Watch';   // 40–59: primary band Watch
  if (s >= 30) return 'Neutral'; // 30–39: schema shows overlap; default Neutral
  if (s >= 0)  return 'LowPriority';

  return 'Unknown';
}

// ─── extractInconsistentCases ─────────────────────────────────────────────────

/**
 * Filter cases to only those with scoreBucketConsistency === 'INCONSISTENT'.
 * No modification of input data. Pure filter.
 */
export function extractInconsistentCases(reviewRows: ReviewCaseRow[]): ReviewCaseRow[] {
  return reviewRows.filter(row => row.scoreBucketConsistency === 'INCONSISTENT');
}

// ─── diagnoseBucketInconsistency ──────────────────────────────────────────────

/**
 * Diagnose a single inconsistent case.
 *
 * Classification logic (schema self-consistency only, no performance evaluation):
 *
 * 1. SCORE_THRESHOLD_MISMATCH
 *    Score is clearly outside the bucket's expected band (>10pt gap).
 *    The bucket label and score were captured consistently but the threshold definition
 *    is ambiguous. Indicative of a schema calibration gap, not a bug per se.
 *
 * 2. BUCKET_MAPPING_MISMATCH
 *    The normalized bucket label does not match the inferred bucket from score,
 *    AND the gap is ≥ 2 bucket levels (e.g., Watch vs LowPriority).
 *    Suggests the bucket was assigned from a different field than the composite score.
 *
 * 3. NORMALIZATION_GAP
 *    The raw bucket label cannot be normalized to a known canonical label.
 *    Indicates schema capture or labeling inconsistency.
 *
 * 4. SNAPSHOT_CAPTURE_MISMATCH
 *    The activeScoringBucket differs from the researchBucket.
 *    Suggests the snapshot captured a different bucket than the research output.
 *
 * 5. FACTOR_AGGREGATION_AMBIGUOUS
 *    Score is near a boundary (±10pt) and signals suggest a mixed picture.
 *
 * 6. UNKNOWN_REQUIRES_CODE_TRACE
 *    None of the above patterns are identifiable from data alone.
 */
export function diagnoseBucketInconsistency(
  caseRow: ReviewCaseRow,
  opts: DiagnoseBucketOptions = {}
): CaseDiagnosisResult {
  const score = (caseRow.score ?? null) as number | null;
  const rawBucket = (caseRow.researchBucket ?? '') as string;
  const activeScoringBucket = (caseRow.activeScoringBucket ?? null) as string | null;

  const normalizedBucket = normalizeBucketLabel(rawBucket);
  const expectedBucket = inferExpectedBucketFromScore(score, opts);

  // Extract snapshot fields (descriptive only)
  const scoreSnapshotFields: Record<string, unknown> = {};
  if (opts.snapshotFields) {
    for (const f of opts.snapshotFields) {
      if (f in caseRow) scoreSnapshotFields[f] = caseRow[f];
    }
  }

  // Detect Watch + low-score boundary pattern (scores in 20–39 assigned Watch)
  const isWatchLowScoreBoundaryPattern =
    normalizedBucket === 'Watch' &&
    score !== null &&
    score >= 20 &&
    score <= 39;

  // Determine diagnosis category
  let diagnosisCategory: DiagnosisCategory;
  let evidence: string;
  let recommendedRepairType: RecommendedRepairType;

  if (normalizedBucket === 'Unknown') {
    // Cannot normalize the bucket label
    diagnosisCategory = 'NORMALIZATION_GAP';
    evidence = `Raw bucket label "${rawBucket}" cannot be mapped to a canonical label. Normalization schema does not cover this variant.`;
    recommendedRepairType = 'FIX_BUCKET_MAPPING_CODE';
  } else if (
    activeScoringBucket !== null &&
    normalizeBucketLabel(activeScoringBucket) !== normalizedBucket
  ) {
    // ActiveScoring snapshot bucket differs from research bucket
    diagnosisCategory = 'SNAPSHOT_CAPTURE_MISMATCH';
    evidence = `activeScoringBucket="${activeScoringBucket}" differs from researchBucket="${rawBucket}" after normalization. Snapshot may have been captured at a different point in the pipeline than the research output.`;
    recommendedRepairType = 'TRACE_SNAPSHOT_CAPTURE';
  } else if (isWatchLowScoreBoundaryPattern) {
    // The dominant pattern in P5: Watch assigned to scores in 20-39
    // This is a schema boundary ambiguity — Watch's lower bound (40) may not account
    // for signal-qualified candidates with lower composite scores.
    diagnosisCategory = 'SCORE_THRESHOLD_MISMATCH';
    evidence = `Score ${score} is below Watch band lower bound (40). All ${
      5
    } inconsistent cases share this pattern: Watch + score in [21,29]. The Watch band lower threshold (40) appears too strict for signal-qualified candidates. This is a schema boundary definition question, not a code malfunction.`;
    recommendedRepairType = 'FREEZE_CONTRACT_AS_BOUNDARY';
  } else if (score !== null && expectedBucket !== normalizedBucket) {
    // General mismatch: score-inferred bucket ≠ assigned bucket
    const bandInfo = SCHEMA_SCORE_BANDS[normalizedBucket] ?? null;
    const gap = bandInfo
      ? Math.min(Math.abs(score - bandInfo.low), Math.abs(score - bandInfo.high))
      : null;

    if (gap !== null && gap > 15) {
      diagnosisCategory = 'BUCKET_MAPPING_MISMATCH';
      evidence = `Score ${score} is ${gap} points outside the ${normalizedBucket} band [${bandInfo?.low}-${bandInfo?.high}]. Expected bucket from score: ${expectedBucket}. The gap is too large to be explained by boundary ambiguity alone — suggests bucket was assigned from a non-score source.`;
      recommendedRepairType = 'TRACE_SCORE_AGGREGATION';
    } else {
      diagnosisCategory = 'FACTOR_AGGREGATION_AMBIGUOUS';
      evidence = `Score ${score} is near the ${normalizedBucket} band boundary. Expected bucket: ${expectedBucket}. The small gap (${gap ?? 'N/A'}pt) suggests this may be a factor aggregation boundary case where individual signals disagree with the composite score.`;
      recommendedRepairType = 'TRACE_SCORE_AGGREGATION';
    }
  } else {
    // Cannot classify from data alone
    diagnosisCategory = 'UNKNOWN_REQUIRES_CODE_TRACE';
    evidence = `Score ${score}, bucket "${rawBucket}" (normalized: ${normalizedBucket}), expected bucket: ${expectedBucket}. No clear pattern emerges from data fields alone. Requires code trace of bucket assignment logic.`;
    recommendedRepairType = 'MANUAL_REVIEW_REQUIRED';
  }

  const whyNoModelChangeNow =
    'P6-LITE scope is limited to schema self-consistency diagnosis only. ' +
    'No scoring formula, alphaScore, recommendationBucket, or activeScoringSnapshot ' +
    'logic may be changed during this phase. All repair decisions are deferred to P7 or P12.';

  return {
    caseId: caseRow.caseId,
    symbol: caseRow.symbol,
    asOf: caseRow.originalAsOfDate,
    horizon: caseRow.horizonDays,
    score,
    scoreSource: 'researchBucket.score (composite, as captured in P5 walkthrough)',
    researchBucket: rawBucket,
    normalizedBucket,
    activeScoringSnapshotBucket: activeScoringBucket,
    topLevelBucket: rawBucket,
    scoreSnapshotFields,
    isWatchLowScoreBoundaryPattern,
    diagnosisCategory,
    evidence,
    recommendedRepairType,
    whyNoModelChangeNow,
  };
}

// ─── summarizeBucketSchemaDiagnosis ──────────────────────────────────────────

/**
 * Aggregate individual case diagnosis results into a summary.
 */
export function summarizeBucketSchemaDiagnosis(
  rows: CaseDiagnosisResult[]
): BucketSchemaDiagnosisSummary {
  const byCategoryCount: Record<DiagnosisCategory, number> = {
    BUCKET_MAPPING_MISMATCH: 0,
    SCORE_THRESHOLD_MISMATCH: 0,
    NORMALIZATION_GAP: 0,
    SNAPSHOT_CAPTURE_MISMATCH: 0,
    FACTOR_AGGREGATION_AMBIGUOUS: 0,
    UNKNOWN_REQUIRES_CODE_TRACE: 0,
  };

  let watchLowScoreBoundaryCount = 0;
  const scores: number[] = [];
  const buckets = new Set<string>();

  for (const r of rows) {
    byCategoryCount[r.diagnosisCategory] = (byCategoryCount[r.diagnosisCategory] ?? 0) + 1;
    if (r.isWatchLowScoreBoundaryPattern) watchLowScoreBoundaryCount++;
    if (r.score !== null) scores.push(r.score);
    buckets.add(r.researchBucket);
  }

  // Dominant category = highest count
  let dominantCategory: DiagnosisCategory = 'UNKNOWN_REQUIRES_CODE_TRACE';
  let maxCount = 0;
  for (const [cat, count] of Object.entries(byCategoryCount) as [DiagnosisCategory, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat;
    }
  }

  // Determine proposed verdict
  let proposedVerdict: BucketSchemaVerdict;
  let verdictEvidence: string;

  const totalCases = rows.length;
  const boundaryRatio = watchLowScoreBoundaryCount / Math.max(totalCases, 1);

  if (dominantCategory === 'UNKNOWN_REQUIRES_CODE_TRACE' && watchLowScoreBoundaryCount === 0) {
    proposedVerdict = 'NEEDS_CODE_TRACE';
    verdictEvidence =
      'No consistent pattern identified from data alone. Multiple categories present or dominant is UNKNOWN.';
  } else if (
    (dominantCategory === 'SCORE_THRESHOLD_MISMATCH' ||
      dominantCategory === 'FACTOR_AGGREGATION_AMBIGUOUS') &&
    boundaryRatio >= 0.6
  ) {
    // ≥60% of inconsistent cases are Watch + low-score boundary pattern
    // → This is a schema boundary definition, not a code bug
    proposedVerdict = 'BY_DESIGN_BOUNDARY';
    verdictEvidence =
      `${watchLowScoreBoundaryCount}/${totalCases} (${Math.round(boundaryRatio * 100)}%) of inconsistent cases match the Watch + score ≤ 39 boundary pattern. ` +
      'The schema bands were calibrated from historical data and may not account for signal-qualified ' +
      'candidates with below-band composite scores. This is a boundary definition ambiguity, ' +
      'not a code malfunction. Contract freeze is appropriate.';
  } else if (
    dominantCategory === 'BUCKET_MAPPING_MISMATCH' ||
    dominantCategory === 'SNAPSHOT_CAPTURE_MISMATCH'
  ) {
    proposedVerdict = 'SCHEMA_BUG';
    verdictEvidence =
      `Dominant category is ${dominantCategory} — indicates the bucket assignment or capture logic ` +
      'has a systematic error. Requires targeted code fix in P7.';
  } else if (dominantCategory === 'NORMALIZATION_GAP') {
    proposedVerdict = 'SCHEMA_BUG';
    verdictEvidence =
      'Dominant category is NORMALIZATION_GAP — canonical label mapping is incomplete. ' +
      'Requires schema extension in P7.';
  } else {
    proposedVerdict = 'NEEDS_CODE_TRACE';
    verdictEvidence =
      `Dominant category ${dominantCategory} but pattern is not clear enough for a definitive verdict. ` +
      'Requires P7 code trace.';
  }

  return {
    totalInconsistentCases: rows.length,
    byCategoryCount,
    watchLowScoreBoundaryCount,
    dominantCategory,
    observedScoreRange:
      scores.length > 0
        ? { min: Math.min(...scores), max: Math.max(...scores) }
        : null,
    observedBuckets: Array.from(buckets),
    proposedVerdict,
    verdictEvidence,
  };
}

// ─── buildBucketSchemaShortVerdict ────────────────────────────────────────────

/**
 * Build the final short verdict from a diagnosis summary.
 *
 * Verdict options:
 *   SCHEMA_BUG           → systematic mapping/capture error → P7 fix design tomorrow
 *   BY_DESIGN_BOUNDARY   → schema boundary ambiguity → contract freeze today
 *   NEEDS_CODE_TRACE     → insufficient data-level evidence → P7 code trace tomorrow
 */
export function buildBucketSchemaShortVerdict(
  summary: BucketSchemaDiagnosisSummary
): BucketSchemaShortVerdict {
  const verdict = summary.proposedVerdict;

  const watchPattern = {
    detected: summary.watchLowScoreBoundaryCount > 0,
    caseCount: summary.watchLowScoreBoundaryCount,
    scoreRange: summary.observedScoreRange
      ? `[${summary.observedScoreRange.min}, ${summary.observedScoreRange.max}]`
      : 'N/A',
    interpretation:
      summary.watchLowScoreBoundaryCount > 0
        ? 'Watch bucket appears to accept composite scores below its canonical band lower bound (40). ' +
          'This may reflect signal-qualified candidates where individual technical signals trigger Watch ' +
          'assignment independently of the composite score. The schema bands need explicit documentation ' +
          'of this boundary behavior.'
        : 'No Watch + low-score boundary pattern detected.',
  };

  let summaryText: string;
  let nextStepGuidance: string;

  switch (verdict) {
    case 'BY_DESIGN_BOUNDARY':
      summaryText =
        `All ${summary.totalInconsistentCases} inconsistent cases follow the same pattern: ` +
        `Watch bucket assigned to composite scores in ${watchPattern.scoreRange}. ` +
        'The existing Watch band lower bound (40) does not match observed behavior. ' +
        'This is a schema documentation gap — the boundary behavior appears intentional ' +
        '(signal-driven Watch assignment can override composite score thresholds) but is undocumented.';
      nextStepGuidance =
        'Contract freeze today (PART B output). Tomorrow: P12 PIT Feature Contract v0 (CEO 主軸 A first step).';
      break;

    case 'SCHEMA_BUG':
      summaryText =
        `Dominant diagnosis category is ${summary.dominantCategory}. ` +
        'A systematic error in bucket assignment or snapshot capture is likely. ' +
        `Evidence: ${summary.verdictEvidence}`;
      nextStepGuidance =
        'Tomorrow: P7 patch design — fix bucket mapping or snapshot capture logic.';
      break;

    case 'NEEDS_CODE_TRACE':
    default:
      summaryText =
        'Data-level diagnosis is inconclusive. The inconsistency pattern cannot be fully ' +
        'explained from observable fields alone without tracing the bucket assignment code path.';
      nextStepGuidance =
        'Tomorrow: P7 code trace — trace bucket assignment logic in ActiveScoringSnapshotBuilder ' +
        'and SignalFusion output path.';
      break;
  }

  return {
    verdict,
    summary: summaryText,
    dominantCategory: summary.dominantCategory,
    watchBoundaryPattern: watchPattern,
    nextStepGuidance,
    requiresContractFreeze: verdict === 'BY_DESIGN_BOUNDARY',
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip disclaimer lines
    if (/disclaimer/i.test(line)) continue;

    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      // alphaScore is allowed as a field name — skip matches that are part of "alphaScore"
      if (label === 'alpha (non-alphaScore)') {
        const matches2 = line.matchAll(/\balpha\b/gi);
        for (const m of matches2) {
          const start = m.index ?? 0;
          const surrounding = line.slice(Math.max(0, start - 5), start + 15);
          if (/alphaScore/i.test(surrounding)) continue;
          matches.push({
            pattern: label,
            context: line.trim().slice(0, 120),
          });
        }
        continue;
      }

      if (pattern.test(line)) {
        matches.push({
          pattern: label,
          context: line.trim().slice(0, 120),
        });
      }
    }
  }

  return matches;
}
