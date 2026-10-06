/**
 * p6lite_bucket_schema_diagnosis_utils.test.ts
 *
 * Unit tests for P6BucketSchemaDiagnosisUtils.
 * No Math.random. No corpus modifications. No investment claims.
 */

import {
  normalizeBucketLabel,
  inferExpectedBucketFromScore,
  extractInconsistentCases,
  diagnoseBucketInconsistency,
  summarizeBucketSchemaDiagnosis,
  buildBucketSchemaShortVerdict,
  scanForbiddenClaims,
  ReviewCaseRow,
  CaseDiagnosisResult,
} from '../P6BucketSchemaDiagnosisUtils';

// ─── normalizeBucketLabel ─────────────────────────────────────────────────────

describe('normalizeBucketLabel', () => {
  it('normalizes English standard labels', () => {
    expect(normalizeBucketLabel('Strong')).toBe('Strong');
    expect(normalizeBucketLabel('Watch')).toBe('Watch');
    expect(normalizeBucketLabel('Neutral')).toBe('Neutral');
    expect(normalizeBucketLabel('LowPriority')).toBe('LowPriority');
    expect(normalizeBucketLabel('Low Priority')).toBe('LowPriority');
    expect(normalizeBucketLabel('Low-Priority')).toBe('LowPriority');
  });

  it('normalizes case-insensitive English variants', () => {
    expect(normalizeBucketLabel('strong')).toBe('Strong');
    expect(normalizeBucketLabel('WATCH')).toBe('Watch');
    expect(normalizeBucketLabel('neutral')).toBe('Neutral');
    expect(normalizeBucketLabel('lowpriority')).toBe('LowPriority');
    expect(normalizeBucketLabel('Strong Candidate')).toBe('Strong');
    expect(normalizeBucketLabel('Watch Candidate')).toBe('Watch');
  });

  it('normalizes Chinese labels — 偏多/偏空', () => {
    expect(normalizeBucketLabel('偏多')).toBe('Strong');
    expect(normalizeBucketLabel('強多')).toBe('Strong');
    expect(normalizeBucketLabel('偏空')).toBe('LowPriority');
    expect(normalizeBucketLabel('弱空')).toBe('LowPriority');
  });

  it('normalizes Chinese watch labels', () => {
    expect(normalizeBucketLabel('觀察')).toBe('Watch');
    expect(normalizeBucketLabel('留意')).toBe('Watch');
  });

  it('normalizes Chinese neutral label', () => {
    expect(normalizeBucketLabel('中性')).toBe('Neutral');
  });

  it('normalizes Chinese LowPriority labels', () => {
    expect(normalizeBucketLabel('低優先')).toBe('LowPriority');
    expect(normalizeBucketLabel('低優先度')).toBe('LowPriority');
  });

  it('normalizes InsufficientData variants', () => {
    expect(normalizeBucketLabel('Insufficient Data')).toBe('InsufficientData');
    expect(normalizeBucketLabel('insufficient data')).toBe('InsufficientData');
    expect(normalizeBucketLabel('N/A')).toBe('InsufficientData');
    expect(normalizeBucketLabel('n/a')).toBe('InsufficientData');
    expect(normalizeBucketLabel('NA')).toBe('InsufficientData');
    expect(normalizeBucketLabel('na')).toBe('InsufficientData');
    expect(normalizeBucketLabel('None')).toBe('InsufficientData');
    expect(normalizeBucketLabel('none')).toBe('InsufficientData');
  });

  it('handles whitespace trimming', () => {
    expect(normalizeBucketLabel('  Watch  ')).toBe('Watch');
    expect(normalizeBucketLabel('  偏多  ')).toBe('Strong');
    expect(normalizeBucketLabel('  ')).toBe('Unknown');
  });

  it('returns Unknown for empty and null', () => {
    expect(normalizeBucketLabel('')).toBe('Unknown');
    expect(normalizeBucketLabel(null)).toBe('Unknown');
    expect(normalizeBucketLabel(undefined)).toBe('Unknown');
  });

  it('returns Unknown for unrecognized labels', () => {
    expect(normalizeBucketLabel('RandomLabel')).toBe('Unknown');
    expect(normalizeBucketLabel('XYZ')).toBe('Unknown');
  });
});

// ─── inferExpectedBucketFromScore ─────────────────────────────────────────────

describe('inferExpectedBucketFromScore', () => {
  it('infers Strong for score >= 60', () => {
    expect(inferExpectedBucketFromScore(60)).toBe('Strong');
    expect(inferExpectedBucketFromScore(75)).toBe('Strong');
    expect(inferExpectedBucketFromScore(100)).toBe('Strong');
  });

  it('infers Watch for score 40-59', () => {
    expect(inferExpectedBucketFromScore(40)).toBe('Watch');
    expect(inferExpectedBucketFromScore(50)).toBe('Watch');
    expect(inferExpectedBucketFromScore(59)).toBe('Watch');
  });

  it('infers Neutral for score 30-39', () => {
    expect(inferExpectedBucketFromScore(30)).toBe('Neutral');
    expect(inferExpectedBucketFromScore(35)).toBe('Neutral');
    expect(inferExpectedBucketFromScore(39)).toBe('Neutral');
  });

  it('infers LowPriority for score 0-29', () => {
    expect(inferExpectedBucketFromScore(0)).toBe('LowPriority');
    expect(inferExpectedBucketFromScore(21)).toBe('LowPriority');
    expect(inferExpectedBucketFromScore(29)).toBe('LowPriority');
  });

  it('is deterministic — same input always same output', () => {
    const results = Array.from({ length: 10 }, () => inferExpectedBucketFromScore(25));
    expect(new Set(results).size).toBe(1);
  });

  it('returns InsufficientData for null/undefined/NaN', () => {
    expect(inferExpectedBucketFromScore(null)).toBe('InsufficientData');
    expect(inferExpectedBucketFromScore(undefined)).toBe('InsufficientData');
    expect(inferExpectedBucketFromScore(NaN)).toBe('InsufficientData');
  });
});

// ─── extractInconsistentCases ─────────────────────────────────────────────────

describe('extractInconsistentCases', () => {
  const rows: ReviewCaseRow[] = [
    { caseId: 'A', symbol: '1234', originalAsOfDate: '2025-01-01', horizonDays: 5, scoreBucketConsistency: 'CONSISTENT' },
    { caseId: 'B', symbol: '2345', originalAsOfDate: '2025-01-01', horizonDays: 5, scoreBucketConsistency: 'INCONSISTENT' },
    { caseId: 'C', symbol: '3456', originalAsOfDate: '2025-01-01', horizonDays: 5, scoreBucketConsistency: 'BORDERLINE' },
    { caseId: 'D', symbol: '4567', originalAsOfDate: '2025-01-01', horizonDays: 5, scoreBucketConsistency: 'INCONSISTENT' },
  ];

  it('filters only INCONSISTENT cases', () => {
    const result = extractInconsistentCases(rows);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.caseId)).toEqual(['B', 'D']);
  });

  it('returns empty array when no inconsistent cases', () => {
    const result = extractInconsistentCases([rows[0], rows[2]]);
    expect(result).toHaveLength(0);
  });
});

// ─── diagnoseBucketInconsistency ──────────────────────────────────────────────

describe('diagnoseBucketInconsistency', () => {
  const makeCase = (overrides: Partial<ReviewCaseRow>): ReviewCaseRow => ({
    caseId: 'TEST-001',
    symbol: '1234',
    originalAsOfDate: '2025-12-01',
    horizonDays: 5,
    researchBucket: 'Watch',
    score: 21,
    scoreBucketConsistency: 'INCONSISTENT',
    ...overrides,
  });

  it('classifies Watch + score 21 as SCORE_THRESHOLD_MISMATCH (boundary pattern)', () => {
    const result = diagnoseBucketInconsistency(makeCase({ score: 21, researchBucket: 'Watch' }));
    expect(result.diagnosisCategory).toBe('SCORE_THRESHOLD_MISMATCH');
    expect(result.isWatchLowScoreBoundaryPattern).toBe(true);
    expect(result.recommendedRepairType).toBe('FREEZE_CONTRACT_AS_BOUNDARY');
  });

  it('classifies Watch + score 29 as SCORE_THRESHOLD_MISMATCH (boundary pattern)', () => {
    const result = diagnoseBucketInconsistency(makeCase({ score: 29, researchBucket: 'Watch' }));
    expect(result.diagnosisCategory).toBe('SCORE_THRESHOLD_MISMATCH');
    expect(result.isWatchLowScoreBoundaryPattern).toBe(true);
  });

  it('classifies unknown bucket label as NORMALIZATION_GAP', () => {
    const result = diagnoseBucketInconsistency(makeCase({ researchBucket: 'XYZ_UNDEFINED', score: 50 }));
    expect(result.diagnosisCategory).toBe('NORMALIZATION_GAP');
    expect(result.normalizedBucket).toBe('Unknown');
  });

  it('classifies activeScoringBucket mismatch as SNAPSHOT_CAPTURE_MISMATCH', () => {
    const result = diagnoseBucketInconsistency(
      makeCase({ researchBucket: 'Strong', activeScoringBucket: 'LowPriority', score: 75 })
    );
    expect(result.diagnosisCategory).toBe('SNAPSHOT_CAPTURE_MISMATCH');
    expect(result.recommendedRepairType).toBe('TRACE_SNAPSHOT_CAPTURE');
  });

  it('classifies large score gap as BUCKET_MAPPING_MISMATCH', () => {
    // Watch band is 40-70, but score is 5 → gap = 35 > 15
    const result = diagnoseBucketInconsistency(makeCase({ researchBucket: 'Watch', score: 5 }));
    // score 5 < 20, so not in Watch+low-score boundary (20-39)
    expect(result.diagnosisCategory).toBe('BUCKET_MAPPING_MISMATCH');
    expect(result.isWatchLowScoreBoundaryPattern).toBe(false);
  });

  it('includes whyNoModelChangeNow in all results', () => {
    const result = diagnoseBucketInconsistency(makeCase({}));
    expect(result.whyNoModelChangeNow).toContain('P6-LITE scope');
  });

  it('returns correct caseId/symbol/asOf/horizon', () => {
    const result = diagnoseBucketInconsistency(makeCase({ caseId: 'MY-CASE', symbol: '9999' }));
    expect(result.caseId).toBe('MY-CASE');
    expect(result.symbol).toBe('9999');
    expect(result.asOf).toBe('2025-12-01');
    expect(result.horizon).toBe(5);
  });
});

// ─── summarizeBucketSchemaDiagnosis ──────────────────────────────────────────

describe('summarizeBucketSchemaDiagnosis', () => {
  const makeResult = (overrides: Partial<CaseDiagnosisResult>): CaseDiagnosisResult => ({
    caseId: 'T-001',
    symbol: '1234',
    asOf: '2025-12-01',
    horizon: 5,
    score: 21,
    scoreSource: 'test',
    researchBucket: 'Watch',
    normalizedBucket: 'Watch',
    activeScoringSnapshotBucket: null,
    topLevelBucket: 'Watch',
    scoreSnapshotFields: {},
    isWatchLowScoreBoundaryPattern: true,
    diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH',
    evidence: 'test evidence',
    recommendedRepairType: 'FREEZE_CONTRACT_AS_BOUNDARY',
    whyNoModelChangeNow: 'test',
    ...overrides,
  });

  it('computes byCategoryCount correctly', () => {
    const rows = [
      makeResult({ diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ diagnosisCategory: 'NORMALIZATION_GAP' }),
    ];
    const summary = summarizeBucketSchemaDiagnosis(rows);
    expect(summary.byCategoryCount.SCORE_THRESHOLD_MISMATCH).toBe(2);
    expect(summary.byCategoryCount.NORMALIZATION_GAP).toBe(1);
  });

  it('counts watchLowScoreBoundaryCount correctly', () => {
    const rows = [
      makeResult({ isWatchLowScoreBoundaryPattern: true }),
      makeResult({ isWatchLowScoreBoundaryPattern: true }),
      makeResult({ isWatchLowScoreBoundaryPattern: false }),
    ];
    const summary = summarizeBucketSchemaDiagnosis(rows);
    expect(summary.watchLowScoreBoundaryCount).toBe(2);
  });

  it('proposes BY_DESIGN_BOUNDARY when >=60% are Watch+LowScore pattern', () => {
    const rows = [
      makeResult({ isWatchLowScoreBoundaryPattern: true, diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: true, diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: true, diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: true, diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'SCORE_THRESHOLD_MISMATCH' }),
    ];
    const summary = summarizeBucketSchemaDiagnosis(rows);
    expect(summary.proposedVerdict).toBe('BY_DESIGN_BOUNDARY');
  });

  it('proposes SCHEMA_BUG when dominant category is BUCKET_MAPPING_MISMATCH', () => {
    const rows = [
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'BUCKET_MAPPING_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'BUCKET_MAPPING_MISMATCH' }),
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'NORMALIZATION_GAP' }),
    ];
    const summary = summarizeBucketSchemaDiagnosis(rows);
    expect(summary.proposedVerdict).toBe('SCHEMA_BUG');
  });

  it('proposes NEEDS_CODE_TRACE when dominant category is UNKNOWN', () => {
    const rows = [
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'UNKNOWN_REQUIRES_CODE_TRACE' }),
      makeResult({ isWatchLowScoreBoundaryPattern: false, diagnosisCategory: 'UNKNOWN_REQUIRES_CODE_TRACE' }),
    ];
    const summary = summarizeBucketSchemaDiagnosis(rows);
    expect(summary.proposedVerdict).toBe('NEEDS_CODE_TRACE');
  });
});

// ─── buildBucketSchemaShortVerdict ────────────────────────────────────────────

describe('buildBucketSchemaShortVerdict', () => {
  const makeSummary = (overrides: Partial<ReturnType<typeof summarizeBucketSchemaDiagnosis>>) => ({
    totalInconsistentCases: 5,
    byCategoryCount: {
      BUCKET_MAPPING_MISMATCH: 0,
      SCORE_THRESHOLD_MISMATCH: 5,
      NORMALIZATION_GAP: 0,
      SNAPSHOT_CAPTURE_MISMATCH: 0,
      FACTOR_AGGREGATION_AMBIGUOUS: 0,
      UNKNOWN_REQUIRES_CODE_TRACE: 0,
    },
    watchLowScoreBoundaryCount: 5,
    dominantCategory: 'SCORE_THRESHOLD_MISMATCH' as const,
    observedScoreRange: { min: 21, max: 29 },
    observedBuckets: ['Watch'],
    proposedVerdict: 'BY_DESIGN_BOUNDARY' as const,
    verdictEvidence: 'test evidence',
    ...overrides,
  });

  it('returns BY_DESIGN_BOUNDARY verdict with requiresContractFreeze=true', () => {
    const verdict = buildBucketSchemaShortVerdict(makeSummary({}));
    expect(verdict.verdict).toBe('BY_DESIGN_BOUNDARY');
    expect(verdict.requiresContractFreeze).toBe(true);
  });

  it('returns SCHEMA_BUG verdict with requiresContractFreeze=false', () => {
    const verdict = buildBucketSchemaShortVerdict(
      makeSummary({
        proposedVerdict: 'SCHEMA_BUG',
        dominantCategory: 'BUCKET_MAPPING_MISMATCH',
        watchLowScoreBoundaryCount: 0,
        byCategoryCount: {
          BUCKET_MAPPING_MISMATCH: 3,
          SCORE_THRESHOLD_MISMATCH: 0,
          NORMALIZATION_GAP: 0,
          SNAPSHOT_CAPTURE_MISMATCH: 0,
          FACTOR_AGGREGATION_AMBIGUOUS: 0,
          UNKNOWN_REQUIRES_CODE_TRACE: 0,
        },
      })
    );
    expect(verdict.verdict).toBe('SCHEMA_BUG');
    expect(verdict.requiresContractFreeze).toBe(false);
  });

  it('returns NEEDS_CODE_TRACE verdict with requiresContractFreeze=false', () => {
    const verdict = buildBucketSchemaShortVerdict(
      makeSummary({
        proposedVerdict: 'NEEDS_CODE_TRACE',
        dominantCategory: 'UNKNOWN_REQUIRES_CODE_TRACE',
        watchLowScoreBoundaryCount: 0,
      })
    );
    expect(verdict.verdict).toBe('NEEDS_CODE_TRACE');
    expect(verdict.requiresContractFreeze).toBe(false);
  });

  it('includes watchBoundaryPattern.detected=true when boundary cases exist', () => {
    const verdict = buildBucketSchemaShortVerdict(makeSummary({ watchLowScoreBoundaryCount: 3 }));
    expect(verdict.watchBoundaryPattern.detected).toBe(true);
    expect(verdict.watchBoundaryPattern.caseCount).toBe(3);
  });

  it('includes watchBoundaryPattern.detected=false when no boundary cases', () => {
    const verdict = buildBucketSchemaShortVerdict(makeSummary({ watchLowScoreBoundaryCount: 0 }));
    expect(verdict.watchBoundaryPattern.detected).toBe(false);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('detects ROI in text', () => {
    const matches = scanForbiddenClaims('The model ROI is 20%');
    expect(matches.some(m => m.pattern === 'ROI')).toBe(true);
  });

  it('detects win-rate in text', () => {
    const matches = scanForbiddenClaims('win-rate was 65%');
    expect(matches.some(m => m.pattern === 'win-rate')).toBe(true);
  });

  it('does NOT flag alphaScore as alpha', () => {
    const matches = scanForbiddenClaims('alphaScore: 72');
    expect(matches.some(m => m.pattern === 'alpha (non-alphaScore)')).toBe(false);
  });

  it('detects standalone alpha', () => {
    const matches = scanForbiddenClaims('This strategy has alpha.');
    expect(matches.some(m => m.pattern === 'alpha (non-alphaScore)')).toBe(true);
  });

  it('detects edge in text', () => {
    const matches = scanForbiddenClaims('This model has an edge over the market.');
    expect(matches.some(m => m.pattern === 'edge')).toBe(true);
  });

  it('detects profit in text', () => {
    const matches = scanForbiddenClaims('expected profit is high');
    expect(matches.some(m => m.pattern === 'profit')).toBe(true);
  });

  it('detects outperform in text', () => {
    const matches = scanForbiddenClaims('will outperform the index');
    expect(matches.some(m => m.pattern === 'outperform')).toBe(true);
  });

  it('detects buy in text', () => {
    const matches = scanForbiddenClaims('recommendation: buy this stock');
    expect(matches.some(m => m.pattern === 'buy')).toBe(true);
  });

  it('detects sell in text', () => {
    const matches = scanForbiddenClaims('time to sell at resistance');
    expect(matches.some(m => m.pattern === 'sell')).toBe(true);
  });

  it('detects guaranteed in text', () => {
    const matches = scanForbiddenClaims('guaranteed returns of 10%');
    expect(matches.some(m => m.pattern === 'guaranteed')).toBe(true);
  });

  it('detects investment recommendation', () => {
    const matches = scanForbiddenClaims('This is an investment recommendation.');
    expect(matches.some(m => m.pattern === 'investment recommendation')).toBe(true);
  });

  it('returns empty array for clean text', () => {
    const matches = scanForbiddenClaims('Schema diagnosis only. Observability data. No claims.');
    expect(matches).toHaveLength(0);
  });

  it('skips disclaimer lines', () => {
    const matches = scanForbiddenClaims('disclaimer: No investment recommendation or ROI claims.');
    expect(matches).toHaveLength(0);
  });
});
