/**
 * P5WalkthroughReviewUtils.ts
 * P5-HARDRESET PART B — Walkthrough Review Rubric Contract
 *
 * Pure TypeScript utility module. No external imports. No database access.
 * No investment recommendations. No ROI / alpha / edge / profit / win-rate claims.
 * All evaluation is descriptive / observability only.
 *
 * Exports:
 *   classifyCasePattern
 *   evaluateExplainability
 *   evaluateScoreBucketConsistency
 *   evaluateSignalReasonConsistency
 *   evaluateOutcomeMismatchPattern
 *   summarizeWalkthroughFindings
 *   scanForbiddenClaims
 *
 * P26A-RENDERER-INTEGRATION-HARDRESET:
 *   reviewCase() now integrates P26ACorpusReasonRenderer to enrich single-token
 *   reasonSnapshot at read/display time using factorSnapshot content.
 *   Additive fields added to CaseReviewResult: renderedReason, renderedReasonFactorCount,
 *   reasonRendererVersion, reasonRendererOutcome, dataAvailabilityNote.
 *   All existing fields preserved. No scoring change. No DB write.
 */

import {
  renderReasonFromCorpusSnapshot,
  buildDataCoverageNote,
  CORPUS_REASON_RENDERER_VERSION,
} from './P26ACorpusReasonRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RealizedReturnClass = 'POSITIVE' | 'NEGATIVE' | 'FLAT' | 'MISSING';
export type ScoringCompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'EMPTY' | string;

export interface WalkthroughCaseInput {
  label?: string;
  symbol: string;
  originalAsOfDate: string;
  horizonDays: number;
  researchBucket?: string;       // e.g. Strong / Watch / Neutral / LowPriority
  activeScoringBucket?: string;  // e.g. 'Strong Candidate' / 'Watch' / 'Avoid' / 'Neutral'
  primaryScore?: number | null;
  scoreDecile?: number | null;
  returnPct?: number | null;
  returnClass?: RealizedReturnClass | string;
  scoringCompletenessStatus?: ScoringCompletenessStatus;
  signalCount?: number | null;
  factorCount?: number | null;
  reasonSnapshot?: string | null;
  closePriceAtPrediction?: number | null;
  stableHashKey?: string;
  // P26A-RENDERER-INTEGRATION: additive optional fields for display-time enrichment
  factorSnapshot?: string[];     // from activeScoringSnapshot.factorSnapshot — used by renderer
  usedSources?: string[];        // for data availability note
  missingSources?: string[];     // for data availability note
  // P28C-RENDERER-REPAIR: pass actual scoreSnapshot so renderer uses real tech/chip scores
  scoreSnapshot?: { technicalScore: number; chipScore: number; [key: string]: number };
}

export type ExplainabilityCompleteness = 'COMPLETE' | 'PARTIAL' | 'WEAK';
export type ScoreBucketConsistency = 'CONSISTENT' | 'BORDERLINE' | 'INCONSISTENT' | 'UNKNOWN';
export type SignalReasonConsistency = 'CONSISTENT' | 'GENERIC' | 'CONFLICTING' | 'UNKNOWN';
export type OutcomeMismatchPattern =
  | 'HIGH_SCORE_NEGATIVE_RETURN'
  | 'LOW_SCORE_POSITIVE_RETURN'
  | 'HIGH_SCORE_POSITIVE_RETURN'
  | 'LOW_SCORE_NEGATIVE_RETURN'
  | 'NEUTRAL_FLAT'
  | 'OTHER';

export type FollowupCategory =
  | 'SCORE_DISTRIBUTION_REVIEW'
  | 'BUCKET_SCHEMA_REVIEW'
  | 'SIGNAL_REASON_REVIEW'
  | 'DATA_COVERAGE_REVIEW'
  | 'READY_FOR_NEXT_AUDIT'
  | 'NO_ACTION';

export interface CaseReviewResult {
  caseId: string;
  symbol: string;
  originalAsOfDate: string;
  horizonDays: number;
  researchBucket: string;
  score: number | null;
  scoreDecile: number | null;
  scoringCompletenessStatus: string;
  realizedReturnClass: string;
  returnPct: number | null;
  topSignalOrFactor: string;
  reasonSnapshotSummary: string;
  explainabilityCompleteness: ExplainabilityCompleteness;
  scoreBucketConsistency: ScoreBucketConsistency;
  signalReasonConsistency: SignalReasonConsistency;
  outcomeMismatchPattern: OutcomeMismatchPattern;
  followupCategory: FollowupCategory;
  limitationNotes: string[];
  // P26A-RENDERER-INTEGRATION: additive display fields — do NOT use for scoring
  renderedReason: string;
  renderedReasonFactorCount: number;
  reasonRendererVersion: string;
  reasonRendererOutcome: string;
  dataAvailabilityNote: string;
}

export interface WalkthroughSummary {
  totalCases: number;
  byHorizon: Record<string, number>;
  byBucket: Record<string, number>;
  byScoreDecile: Record<string, number>;
  byExplainabilityCompleteness: Record<ExplainabilityCompleteness, number>;
  byScoreBucketConsistency: Record<ScoreBucketConsistency, number>;
  bySignalReasonConsistency: Record<SignalReasonConsistency, number>;
  byOutcomeMismatchPattern: Record<OutcomeMismatchPattern, number>;
  byFollowupCategory: Record<FollowupCategory, number>;
  topLimitationNotes: Array<{ note: string; count: number }>;
}

export interface ForbiddenClaimMatch {
  pattern: string;
  context: string;
}

// ─── Bucket score bands ────────────────────────────────────────────────────────
// These are the expected score ranges for each research bucket (descriptive calibration only).
// NOT used for any investment decision.
const BUCKET_SCORE_BANDS: Record<string, { low: number; high: number }> = {
  Strong: { low: 60, high: 100 },
  Watch: { low: 40, high: 70 },
  Neutral: { low: 30, high: 70 },
  LowPriority: { low: 0, high: 50 },
};

// ─── classifyCasePattern ──────────────────────────────────────────────────────

/**
 * Classify the outcome mismatch pattern for a case.
 * This is purely descriptive — it describes how score and realized return
 * are distributed relative to each other. No performance claims.
 */
export function classifyCasePattern(caseRow: WalkthroughCaseInput): OutcomeMismatchPattern {
  const score = caseRow.primaryScore ?? null;
  const derivedReturnClass = (caseRow.returnPct !== undefined && caseRow.returnPct !== null)
    ? (caseRow.returnPct > 1.0 ? 'POSITIVE' : caseRow.returnPct < 0 ? 'NEGATIVE' : 'FLAT')
    : 'MISSING';
  const returnClass = caseRow.returnClass ?? derivedReturnClass;

  if (score === null) return 'OTHER';

  const isHighScore = score >= 65;
  const isLowScore = score < 40;

  if (returnClass === 'MISSING') return 'OTHER';
  if (returnClass === 'NEGATIVE' && isHighScore) return 'HIGH_SCORE_NEGATIVE_RETURN';
  if (returnClass === 'POSITIVE' && isLowScore) return 'LOW_SCORE_POSITIVE_RETURN';
  if (returnClass === 'POSITIVE' && isHighScore) return 'HIGH_SCORE_POSITIVE_RETURN';
  if (returnClass === 'NEGATIVE' && isLowScore) return 'LOW_SCORE_NEGATIVE_RETURN';
  if (returnClass === 'FLAT') return 'NEUTRAL_FLAT';
  return 'OTHER';
}

// ─── evaluateExplainability ────────────────────────────────────────────────────

/**
 * Evaluate explainability completeness of a walkthrough case.
 * COMPLETE: has bucket, score, and non-empty reason/signal/factor
 * PARTIAL: missing one dimension but still readable
 * WEAK: reason/signal/factor insufficient to explain score
 */
export function evaluateExplainability(caseRow: WalkthroughCaseInput): ExplainabilityCompleteness {
  const hasBucket = !!(caseRow.researchBucket || caseRow.activeScoringBucket);
  const hasScore = caseRow.primaryScore !== null && caseRow.primaryScore !== undefined;
  const hasReason = !!(caseRow.reasonSnapshot && caseRow.reasonSnapshot.trim().length > 0);
  const hasSignals = (caseRow.signalCount ?? 0) > 0;
  const hasFactors = (caseRow.factorCount ?? 0) > 0;

  const hasExplanation = hasReason || hasSignals || hasFactors;

  if (hasBucket && hasScore && hasExplanation) {
    // Check if reason is too short or generic (single character / empty-like)
    const reasonLen = (caseRow.reasonSnapshot || '').trim().length;
    if (reasonLen < 3) return 'WEAK';
    return 'COMPLETE';
  }
  if (hasBucket && hasScore && !hasExplanation) return 'WEAK';
  if (hasBucket || hasScore) return 'PARTIAL';
  return 'WEAK';
}

// ─── evaluateScoreBucketConsistency ──────────────────────────────────────────

/**
 * Evaluate whether the score is consistent with the research bucket label.
 * CONSISTENT: score falls within expected band for bucket
 * BORDERLINE: score is within 10 points of the band boundary
 * INCONSISTENT: score is clearly outside expected band for bucket
 * UNKNOWN: insufficient data
 */
export function evaluateScoreBucketConsistency(caseRow: WalkthroughCaseInput): ScoreBucketConsistency {
  const bucket = caseRow.researchBucket;
  const score = caseRow.primaryScore ?? null;

  if (!bucket || score === null || score === undefined) return 'UNKNOWN';

  const band = BUCKET_SCORE_BANDS[bucket];
  if (!band) return 'UNKNOWN';

  const BORDERLINE_MARGIN = 10;

  if (score >= band.low && score <= band.high) return 'CONSISTENT';

  // Check borderline (within margin of either boundary)
  const nearLow = score >= band.low - BORDERLINE_MARGIN && score < band.low;
  const nearHigh = score > band.high && score <= band.high + BORDERLINE_MARGIN;
  if (nearLow || nearHigh) return 'BORDERLINE';

  return 'INCONSISTENT';
}

// ─── evaluateSignalReasonConsistency ─────────────────────────────────────────

/**
 * Evaluate whether the signal/reason snapshot is internally consistent.
 * CONSISTENT: signals and reason text point in the same direction
 * GENERIC: reason is too vague to verify consistency
 * CONFLICTING: signals and reason appear to contradict
 * UNKNOWN: insufficient data
 *
 * Note: This is a lightweight text-pattern heuristic for observability only.
 * It does NOT make investment recommendations.
 */
export function evaluateSignalReasonConsistency(caseRow: WalkthroughCaseInput): SignalReasonConsistency {
  const reason = caseRow.reasonSnapshot ?? '';
  const bucket = caseRow.researchBucket ?? '';
  const activeBucket = caseRow.activeScoringBucket ?? '';
  const score = caseRow.primaryScore ?? null;
  const signalCount = caseRow.signalCount ?? 0;
  const factorCount = caseRow.factorCount ?? 0;

  if (!reason && signalCount === 0 && factorCount === 0) return 'UNKNOWN';

  // Check for very generic / empty reasons
  const reasonLen = reason.trim().length;
  if (reasonLen === 0) return 'UNKNOWN';
  if (reasonLen < 5 && signalCount === 0) return 'GENERIC';

  // Detect conflicting patterns:
  // High score (>=65) but reason contains bearish keywords
  const bearishKeywords = /偏空|空方|走弱|下跌|賣超|動能轉弱/;
  const bullishKeywords = /偏多|多頭|買超|轉強/;

  const hasBearishReason = bearishKeywords.test(reason);
  const hasBullishReason = bullishKeywords.test(reason);

  if (score !== null) {
    // High score + bearish reason = conflict
    if (score >= 70 && hasBearishReason && !hasBullishReason) return 'CONFLICTING';
    // Low score + bullish reason = conflict (if no bearish qualifier)
    if (score <= 30 && hasBullishReason && !hasBearishReason) return 'CONFLICTING';
  }

  // Bucket vs reason conflict
  if ((bucket === 'Strong' || activeBucket === 'Strong Candidate') && hasBearishReason && !hasBullishReason) return 'CONFLICTING';
  if ((bucket === 'LowPriority' || activeBucket === 'Avoid') && hasBullishReason && !hasBearishReason) return 'CONFLICTING';

  // Check generic: single keyword only, no supporting context
  const hasSlash = reason.includes('/');
  const wordCount = reason.trim().split(/[\s\/]+/).filter(w => w.length > 0).length;
  if (!hasSlash && wordCount <= 1) return 'GENERIC';

  return 'CONSISTENT';
}

// ─── evaluateOutcomeMismatchPattern ──────────────────────────────────────────

/**
 * Classify the outcome mismatch pattern. Delegates to classifyCasePattern.
 * Provided as a named export per rubric contract.
 */
export function evaluateOutcomeMismatchPattern(caseRow: WalkthroughCaseInput): OutcomeMismatchPattern {
  return classifyCasePattern(caseRow);
}

// ─── Determine followup category ─────────────────────────────────────────────

/**
 * Determine the recommended followup category based on review dimensions.
 * This is an engineering review direction only. Not an investment recommendation.
 */
export function determineFollowupCategory(
  explainability: ExplainabilityCompleteness,
  scoreBucket: ScoreBucketConsistency,
  signalReason: SignalReasonConsistency,
  completeness: ScoringCompletenessStatus,
  score: number | null
): FollowupCategory {
  // Data coverage issue: PARTIAL/EMPTY completeness
  if (completeness === 'EMPTY') return 'DATA_COVERAGE_REVIEW';
  if (completeness === 'PARTIAL') return 'DATA_COVERAGE_REVIEW';

  // Explainability weak → signal/reason review
  if (explainability === 'WEAK') return 'SIGNAL_REASON_REVIEW';

  // Conflicting signals → signal/reason review
  if (signalReason === 'CONFLICTING') return 'SIGNAL_REASON_REVIEW';

  // Bucket inconsistency → bucket schema review
  if (scoreBucket === 'INCONSISTENT') return 'BUCKET_SCHEMA_REVIEW';

  // Generic reason → signal/reason review
  if (signalReason === 'GENERIC') return 'SIGNAL_REASON_REVIEW';

  // Score near boundary (borderline) → score distribution review
  if (scoreBucket === 'BORDERLINE') return 'SCORE_DISTRIBUTION_REVIEW';

  // Score decile concerns: null score
  if (score === null) return 'DATA_COVERAGE_REVIEW';

  // All dimensions OK
  if (explainability === 'COMPLETE' && scoreBucket === 'CONSISTENT' && signalReason === 'CONSISTENT') {
    return 'READY_FOR_NEXT_AUDIT';
  }

  return 'NO_ACTION';
}

// ─── Build limitation notes ───────────────────────────────────────────────────

export function buildLimitationNotes(caseRow: WalkthroughCaseInput): string[] {
  const notes: string[] = [];

  if (caseRow.scoringCompletenessStatus === 'PARTIAL') {
    notes.push('Scoring completeness is PARTIAL — some dimension data was unavailable');
  }
  if (caseRow.scoringCompletenessStatus === 'EMPTY') {
    notes.push('Scoring completeness is EMPTY — no scoring data available');
  }
  if (!caseRow.reasonSnapshot || caseRow.reasonSnapshot.trim().length === 0) {
    notes.push('reasonSnapshot is empty — cannot evaluate signal/reason consistency');
  } else {
    const wordCount = caseRow.reasonSnapshot.trim().split(/[\s\/]+/).filter((w: string) => w.length > 0).length;
    if (wordCount <= 1) {
      notes.push('reasonSnapshot has only one token — limited explainability');
    }
  }
  if ((caseRow.signalCount ?? 0) === 0) {
    notes.push('signalCount = 0 — no signals available for review');
  }
  if ((caseRow.factorCount ?? 0) === 0) {
    notes.push('factorCount = 0 — no factors available for review');
  }
  if (caseRow.returnPct === null || caseRow.returnPct === undefined) {
    notes.push('returnPct missing — realized return not available for this horizon');
  }
  if (caseRow.primaryScore === null || caseRow.primaryScore === undefined) {
    notes.push('primaryScore missing — cannot evaluate score/bucket consistency');
  }

  return notes;
}

// ─── reviewCase ───────────────────────────────────────────────────────────────

/**
 * Produce a full CaseReviewResult for a single walkthrough case.
 *
 * P26A-RENDERER-INTEGRATION: Integrates P26ACorpusReasonRenderer at display time.
 * If factorSnapshot is provided in caseRow, single-token reasonSnapshot is enriched.
 * All existing fields (reasonSnapshotSummary, topSignalOrFactor, etc.) are preserved.
 * New additive fields (renderedReason, renderedReasonFactorCount, etc.) are appended.
 * No scoring change. No DB write. Deterministic.
 */
export function reviewCase(caseRow: WalkthroughCaseInput, caseIndex: number): CaseReviewResult {
  const explainability = evaluateExplainability(caseRow);
  const scoreBucketConsistency = evaluateScoreBucketConsistency(caseRow);
  const signalReasonConsistency = evaluateSignalReasonConsistency(caseRow);
  const outcomeMismatchPattern = classifyCasePattern(caseRow);
  const completeness = caseRow.scoringCompletenessStatus ?? 'UNKNOWN';
  const score = caseRow.primaryScore ?? null;

  const followupCategory = determineFollowupCategory(
    explainability, scoreBucketConsistency, signalReasonConsistency, completeness, score
  );

  const limitationNotes = buildLimitationNotes(caseRow);

  const reasonSnapshotSummary = caseRow.reasonSnapshot
    ? caseRow.reasonSnapshot.trim().substring(0, 100)
    : '(no reason)';

  const topSignalOrFactor = caseRow.reasonSnapshot
    ? caseRow.reasonSnapshot.trim().split('/')[0].trim()
    : '(no signal)';

  // P26A-RENDERER-INTEGRATION: apply display-time renderer
  // Build a minimal snapshot-compatible object for the renderer
  const minimalSnapshot = {
    reasonSnapshot: caseRow.reasonSnapshot ?? '',
    factorSnapshot: caseRow.factorSnapshot ?? [],
    alphaScore: caseRow.primaryScore ?? 0,
    researchBucket: caseRow.researchBucket ?? '',
    // Required fields for ActiveScoringSnapshot type compatibility
    symbol: caseRow.symbol,
    asOfDate: caseRow.originalAsOfDate,
    horizonDays: caseRow.horizonDays,
    usedSources: caseRow.usedSources ?? [],
    missingSources: caseRow.missingSources ?? [],
    completenessStatus: caseRow.scoringCompletenessStatus ?? 'UNKNOWN',
    scoreSnapshot: caseRow.scoreSnapshot ?? { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    signalTags: [],
    stableHashKey: caseRow.stableHashKey ?? '',
  };

  const rendered = renderReasonFromCorpusSnapshot(minimalSnapshot as unknown as Parameters<typeof renderReasonFromCorpusSnapshot>[0]);

  const dataAvailabilityNote = buildDataCoverageNote(
    caseRow.usedSources ?? [],
    caseRow.missingSources ?? [],
    caseRow.originalAsOfDate,
  );

  return {
    caseId: `P5-CASE-${String(caseIndex + 1).padStart(3, '0')}`,
    symbol: caseRow.symbol,
    originalAsOfDate: caseRow.originalAsOfDate,
    horizonDays: caseRow.horizonDays,
    researchBucket: caseRow.researchBucket ?? '(unknown)',
    score: score,
    scoreDecile: caseRow.scoreDecile ?? null,
    scoringCompletenessStatus: completeness,
    realizedReturnClass: caseRow.returnClass ?? 'MISSING',
    returnPct: caseRow.returnPct ?? null,
    topSignalOrFactor,
    reasonSnapshotSummary,
    explainabilityCompleteness: explainability,
    scoreBucketConsistency,
    signalReasonConsistency,
    outcomeMismatchPattern,
    followupCategory,
    limitationNotes,
    // Additive renderer fields — display only, NOT used for scoring
    renderedReason: rendered.renderedText,
    renderedReasonFactorCount: rendered.factorCount,
    reasonRendererVersion: rendered.rendererVersion,
    reasonRendererOutcome: rendered.outcome,
    dataAvailabilityNote,
  };
}

// ─── summarizeWalkthroughFindings ──────────────────────────────────────────────

/**
 * Aggregate review results into a summary.
 * Deterministic — no random operations.
 */
export function summarizeWalkthroughFindings(reviewRows: CaseReviewResult[]): WalkthroughSummary {
  const countMap = <T extends string>(field: (r: CaseReviewResult) => T): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const r of reviewRows) {
      const k = field(r);
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };

  const byHorizon = countMap(r => String(r.horizonDays));
  const byBucket = countMap(r => r.researchBucket);
  const byScoreDecile = countMap(r => String(r.scoreDecile ?? 'null'));
  const byExplainabilityCompleteness = countMap(r => r.explainabilityCompleteness) as Record<ExplainabilityCompleteness, number>;
  const byScoreBucketConsistency = countMap(r => r.scoreBucketConsistency) as Record<ScoreBucketConsistency, number>;
  const bySignalReasonConsistency = countMap(r => r.signalReasonConsistency) as Record<SignalReasonConsistency, number>;
  const byOutcomeMismatchPattern = countMap(r => r.outcomeMismatchPattern) as Record<OutcomeMismatchPattern, number>;
  const byFollowupCategory = countMap(r => r.followupCategory) as Record<FollowupCategory, number>;

  // Top limitation notes (deterministic sort by count desc, then text asc)
  const noteCounts: Record<string, number> = {};
  for (const r of reviewRows) {
    for (const n of r.limitationNotes) {
      noteCounts[n] = (noteCounts[n] ?? 0) + 1;
    }
  }
  const topLimitationNotes = Object.entries(noteCounts)
    .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))
    .slice(0, 10)
    .map(([note, count]) => ({ note, count }));

  return {
    totalCases: reviewRows.length,
    byHorizon,
    byBucket,
    byScoreDecile,
    byExplainabilityCompleteness,
    byScoreBucketConsistency,
    bySignalReasonConsistency,
    byOutcomeMismatchPattern,
    byFollowupCategory,
    topLimitationNotes,
  };
}

// ─── scanForbiddenClaims ───────────────────────────────────────────────────────

/**
 * Scan text for forbidden investment claim language.
 * Returns an array of matches (empty = clean).
 *
 * Allowed exceptions:
 * - Field names: alphaScore, alphaScoreValue, researchBucket, scoreSnapshot
 * - Disclaimer context lines
 * - Lines within scanForbiddenClaims pattern definitions
 */
export function scanForbiddenClaims(text: string): ForbiddenClaimMatch[] {
  const patterns: Array<{ name: string; re: RegExp }> = [
    { name: 'roi', re: /\broi\b/i },
    { name: 'win-rate', re: /\bwin[\s-]rate\b/i },
    { name: 'outperform', re: /\boutperform\b/i },
    { name: 'guaranteed', re: /\bguaranteed\b/i },
    { name: 'profit', re: /\bprofit\b/i },
    { name: 'trading-edge', re: /\btrading[\s-]edge\b/i },
    { name: 'alpha-edge', re: /\balpha[\s-]edge\b/i },
    { name: 'beat-market', re: /\bbeat[\s-]market\b|\bbeat the market\b/i },
    { name: 'buy-signal', re: /\bbuy[\s-]signal\b/i },
    { name: 'sell-signal', re: /\bsell[\s-]signal\b/i },
    { name: 'investment-recommendation', re: /\binvestment[\s-]recommendation\b/i },
    { name: 'expected-return', re: /\bexpected[\s-]return\b/i },
    { name: 'predicted-return', re: /\bpredicted[\s-]return\b/i },
  ];

  // Lines that are allowed despite matching
  const ALLOWED_LINE_PATTERNS = [
    /disclaimer/i,
    /scanForbiddenClaims/i,
    /forbidden.*pattern|pattern.*forbidden/i,
    /alphaScore|alphaScoreValue|researchBucket|scoreSnapshot/i,
    /not investment advice/i,
    /no.*claim/i,
    /this is not/i,
  ];

  const matches: ForbiddenClaimMatch[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (ALLOWED_LINE_PATTERNS.some(re => re.test(trimmed))) continue;

    for (const { name, re } of patterns) {
      if (re.test(trimmed)) {
        matches.push({ pattern: name, context: trimmed.substring(0, 120) });
        break; // one match per line is enough
      }
    }
  }

  return matches;
}
