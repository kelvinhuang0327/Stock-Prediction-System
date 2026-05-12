/**
 * p8preflight_signal_reason_diagnosis_utils.test.ts
 *
 * Unit tests for P8SignalReasonDiagnosisUtils.
 * No Math.random. No corpus modifications. No investment claims.
 */

import {
  normalizeReasonText,
  countFactorTokens,
  classifyGenericReasonDiagnosis,
  summarizeSignalReasonDiagnosis,
  scanForbiddenClaims,
  GenericReasonCaseInput,
  SignalReasonCaseDiagnosis,
} from '../P8SignalReasonDiagnosisUtils';

// ─── normalizeReasonText ──────────────────────────────────────────────────────

describe('normalizeReasonText', () => {
  it('trims whitespace', () => {
    expect(normalizeReasonText('  技術偏多  ')).toBe('技術偏多');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeReasonText('技術偏多  /  法人買超')).toBe('技術偏多  /  法人買超'.trim().replace(/\s+/g, ' '));
  });

  it('returns empty string for null', () => {
    expect(normalizeReasonText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeReasonText(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeReasonText('')).toBe('');
  });

  it('preserves valid multi-token reason', () => {
    expect(normalizeReasonText('技術偏多 / 法人買超')).toBe('技術偏多 / 法人買超');
  });
});

// ─── countFactorTokens ────────────────────────────────────────────────────────

describe('countFactorTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countFactorTokens('')).toBe(0);
  });

  it('returns 1 for single token', () => {
    expect(countFactorTokens('技術偏多')).toBe(1);
    expect(countFactorTokens('法人買超')).toBe(1);
  });

  it('returns 2 for slash-separated tokens', () => {
    expect(countFactorTokens('技術偏多 / 法人買超')).toBe(2);
  });

  it('returns 3 for comma-separated tokens', () => {
    expect(countFactorTokens('技術偏多,動能轉強,法人買超')).toBe(3);
  });

  it('returns correct count for 頓號-separated tokens', () => {
    expect(countFactorTokens('技術偏多、法人買超')).toBe(2);
  });
});

// ─── classifyGenericReasonDiagnosis ──────────────────────────────────────────

describe('classifyGenericReasonDiagnosis', () => {
  const makeCase = (overrides: Partial<GenericReasonCaseInput>): GenericReasonCaseInput => ({
    caseId: 'P5-CASE-TEST',
    symbol: '1234',
    originalAsOfDate: '2025-12-01',
    horizonDays: 5,
    researchBucket: 'Strong',
    score: 75,
    scoringCompletenessStatus: 'COMPLETE',
    signalReasonConsistency: 'GENERIC',
    scoreBucketConsistency: 'CONSISTENT',
    reasonSnapshotSummary: '技術偏多',
    topSignalOrFactor: '技術偏多',
    limitationNotes: ['reasonSnapshot has only one token — limited explainability'],
    ...overrides,
  });

  // ── TEMPLATE_TOO_GENERIC ─────────────────────────────────────────────────────
  it('classifies as TEMPLATE_TOO_GENERIC when COMPLETE scoring + single technical token', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({ scoringCompletenessStatus: 'COMPLETE', scoreBucketConsistency: 'CONSISTENT', reasonSnapshotSummary: '技術偏多' })
    );
    expect(result.diagnosisCategory).toBe('TEMPLATE_TOO_GENERIC');
    expect(result.recommendedRepairType).toBe('ENRICH_REASON_TEMPLATE');
  });

  it('classifies as TEMPLATE_TOO_GENERIC for 技術偏空 with COMPLETE scoring', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({ scoringCompletenessStatus: 'COMPLETE', scoreBucketConsistency: 'CONSISTENT', reasonSnapshotSummary: '技術偏空' })
    );
    expect(result.diagnosisCategory).toBe('TEMPLATE_TOO_GENERIC');
  });

  // ── SNAPSHOT_CAPTURE_MISSING ─────────────────────────────────────────────────
  it('classifies as SNAPSHOT_CAPTURE_MISSING when INCONSISTENT bucket + single token', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({
        scoreBucketConsistency: 'INCONSISTENT',
        scoringCompletenessStatus: 'COMPLETE',
        reasonSnapshotSummary: '技術偏空',
        researchBucket: 'Watch',
        score: 29,
      })
    );
    expect(result.diagnosisCategory).toBe('SNAPSHOT_CAPTURE_MISSING');
    expect(result.recommendedRepairType).toBe('FIX_SNAPSHOT_FACTOR_CAPTURE');
  });

  // ── FACTOR_EXPLANATION_MISSING ───────────────────────────────────────────────
  it('classifies as FACTOR_EXPLANATION_MISSING for 法人買超 with PARTIAL scoring', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({
        scoringCompletenessStatus: 'PARTIAL',
        scoreBucketConsistency: 'CONSISTENT',
        reasonSnapshotSummary: '法人買超',
        topSignalOrFactor: '法人買超',
      })
    );
    expect(result.diagnosisCategory).toBe('FACTOR_EXPLANATION_MISSING');
    expect(result.recommendedRepairType).toBe('ADD_FACTOR_EXPLANATION_LAYER');
  });

  it('classifies as FACTOR_EXPLANATION_MISSING for 籌碼偏多 with COMPLETE scoring', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({
        scoringCompletenessStatus: 'COMPLETE',
        scoreBucketConsistency: 'CONSISTENT',
        reasonSnapshotSummary: '籌碼偏多',
        topSignalOrFactor: '籌碼偏多',
      })
    );
    // 籌碼偏多 contains '籌碼' which is isInstitutionalFactor
    expect(result.diagnosisCategory).toBe('FACTOR_EXPLANATION_MISSING');
  });

  // ── SCORING_ENGINE_UNDEROUTPUT ───────────────────────────────────────────────
  it('classifies as SCORING_ENGINE_UNDEROUTPUT for PARTIAL scoring + single technical token', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({
        scoringCompletenessStatus: 'PARTIAL',
        scoreBucketConsistency: 'CONSISTENT',
        reasonSnapshotSummary: '技術偏多',
      })
    );
    expect(result.diagnosisCategory).toBe('SCORING_ENGINE_UNDEROUTPUT');
    expect(result.recommendedRepairType).toBe('FIX_SCORING_ENGINE_OUTPUT_COMPLETENESS');
  });

  it('classifies as SCORING_ENGINE_UNDEROUTPUT for 動能走弱 with PARTIAL scoring', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({
        scoringCompletenessStatus: 'PARTIAL',
        scoreBucketConsistency: 'CONSISTENT',
        reasonSnapshotSummary: '動能走弱',
      })
    );
    expect(result.diagnosisCategory).toBe('SCORING_ENGINE_UNDEROUTPUT');
  });

  it('returns correct caseId/symbol/asOf/horizon', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({ caseId: 'MY-P8-CASE', symbol: '9876', horizonDays: 20 })
    );
    expect(result.caseId).toBe('MY-P8-CASE');
    expect(result.symbol).toBe('9876');
    expect(result.horizon).toBe(20);
  });

  it('normalizes reason text in result', () => {
    const result = classifyGenericReasonDiagnosis(
      makeCase({ reasonSnapshotSummary: '  技術偏多  ' })
    );
    expect(result.reasonNormalized).toBe('技術偏多');
  });

  it('counts single token correctly', () => {
    const result = classifyGenericReasonDiagnosis(makeCase({ reasonSnapshotSummary: '技術偏多' }));
    expect(result.factorCount).toBe(1);
  });
});

// ─── summarizeSignalReasonDiagnosis ──────────────────────────────────────────

describe('summarizeSignalReasonDiagnosis', () => {
  const makeResult = (overrides: Partial<SignalReasonCaseDiagnosis>): SignalReasonCaseDiagnosis => ({
    caseId: 'T-001',
    symbol: '1234',
    asOf: '2025-12-01',
    horizon: 5,
    reasonRaw: '技術偏多',
    reasonNormalized: '技術偏多',
    factorCount: 1,
    factorSummary: 'single token',
    diagnosisCategory: 'TEMPLATE_TOO_GENERIC',
    evidence: 'test',
    recommendedRepairType: 'ENRICH_REASON_TEMPLATE',
    ...overrides,
  });

  it('counts all 4 categories correctly', () => {
    const rows = [
      makeResult({ diagnosisCategory: 'TEMPLATE_TOO_GENERIC' }),
      makeResult({ diagnosisCategory: 'TEMPLATE_TOO_GENERIC' }),
      makeResult({ diagnosisCategory: 'SNAPSHOT_CAPTURE_MISSING' }),
      makeResult({ diagnosisCategory: 'FACTOR_EXPLANATION_MISSING' }),
      makeResult({ diagnosisCategory: 'SCORING_ENGINE_UNDEROUTPUT' }),
    ];
    const summary = summarizeSignalReasonDiagnosis(rows);
    expect(summary.byCategoryCount.TEMPLATE_TOO_GENERIC).toBe(2);
    expect(summary.byCategoryCount.SNAPSHOT_CAPTURE_MISSING).toBe(1);
    expect(summary.byCategoryCount.FACTOR_EXPLANATION_MISSING).toBe(1);
    expect(summary.byCategoryCount.SCORING_ENGINE_UNDEROUTPUT).toBe(1);
  });

  it('identifies dominant category', () => {
    const rows = [
      makeResult({ diagnosisCategory: 'SCORING_ENGINE_UNDEROUTPUT' }),
      makeResult({ diagnosisCategory: 'SCORING_ENGINE_UNDEROUTPUT' }),
      makeResult({ diagnosisCategory: 'SCORING_ENGINE_UNDEROUTPUT' }),
      makeResult({ diagnosisCategory: 'TEMPLATE_TOO_GENERIC' }),
    ];
    const summary = summarizeSignalReasonDiagnosis(rows);
    expect(summary.dominantCategory).toBe('SCORING_ENGINE_UNDEROUTPUT');
  });

  it('counts single-token reasons', () => {
    const rows = [
      makeResult({ factorCount: 1 }),
      makeResult({ factorCount: 1 }),
      makeResult({ factorCount: 3 }),
    ];
    const summary = summarizeSignalReasonDiagnosis(rows);
    expect(summary.singleTokenReasonCount).toBe(2);
  });

  it('counts partial scoring from rawCases', () => {
    const rawCases = [
      { caseId: 'A', symbol: '1', originalAsOfDate: '2025-01-01', horizonDays: 5, scoringCompletenessStatus: 'PARTIAL' } as GenericReasonCaseInput,
      { caseId: 'B', symbol: '2', originalAsOfDate: '2025-01-01', horizonDays: 5, scoringCompletenessStatus: 'COMPLETE' } as GenericReasonCaseInput,
      { caseId: 'C', symbol: '3', originalAsOfDate: '2025-01-01', horizonDays: 5, scoringCompletenessStatus: 'PARTIAL' } as GenericReasonCaseInput,
    ];
    const summary = summarizeSignalReasonDiagnosis([], rawCases);
    expect(summary.partialScoringCount).toBe(2);
  });

  it('includes keyInsights array', () => {
    const summary = summarizeSignalReasonDiagnosis([makeResult({})]);
    expect(Array.isArray(summary.keyInsights)).toBe(true);
    expect(summary.keyInsights.length).toBeGreaterThan(0);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

describe('P8 scanForbiddenClaims', () => {
  it('detects ROI', () => {
    expect(scanForbiddenClaims('ROI was 15%').some(m => m.pattern === 'ROI')).toBe(true);
  });

  it('detects win-rate', () => {
    expect(scanForbiddenClaims('win rate 60%').some(m => m.pattern === 'win-rate')).toBe(true);
  });

  it('detects alpha (standalone)', () => {
    expect(scanForbiddenClaims('strong alpha factor').some(m => m.pattern === 'alpha (non-alphaScore)')).toBe(true);
  });

  it('does NOT flag alphaScore', () => {
    expect(scanForbiddenClaims('alphaScore: 72').some(m => m.pattern === 'alpha (non-alphaScore)')).toBe(false);
  });

  it('detects edge', () => {
    expect(scanForbiddenClaims('has an edge').some(m => m.pattern === 'edge')).toBe(true);
  });

  it('detects profit', () => {
    expect(scanForbiddenClaims('profit margin').some(m => m.pattern === 'profit')).toBe(true);
  });

  it('detects outperform', () => {
    expect(scanForbiddenClaims('will outperform benchmark').some(m => m.pattern === 'outperform')).toBe(true);
  });

  it('detects buy', () => {
    expect(scanForbiddenClaims('action: buy').some(m => m.pattern === 'buy')).toBe(true);
  });

  it('detects sell', () => {
    expect(scanForbiddenClaims('action: sell').some(m => m.pattern === 'sell')).toBe(true);
  });

  it('detects guaranteed', () => {
    expect(scanForbiddenClaims('guaranteed results').some(m => m.pattern === 'guaranteed')).toBe(true);
  });

  it('detects investment recommendation', () => {
    expect(
      scanForbiddenClaims('investment recommendation issued').some(m => m.pattern === 'investment recommendation')
    ).toBe(true);
  });

  it('returns empty for clean text', () => {
    expect(scanForbiddenClaims('schema diagnosis only, no claims')).toHaveLength(0);
  });

  it('skips disclaimer lines', () => {
    expect(scanForbiddenClaims('disclaimer: no ROI or profit claims')).toHaveLength(0);
  });
});
