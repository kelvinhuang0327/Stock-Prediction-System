/**
 * p5walkthrough_review_utils.test.ts
 * P5-HARDRESET PART E — Tests for P5WalkthroughReviewUtils
 *
 * Tests are deterministic — no Math.random, no external calls, no corpus mutation.
 */

import {
  classifyCasePattern,
  evaluateExplainability,
  evaluateScoreBucketConsistency,
  evaluateSignalReasonConsistency,
  evaluateOutcomeMismatchPattern,
  summarizeWalkthroughFindings,
  reviewCase,
  buildLimitationNotes,
  determineFollowupCategory,
  scanForbiddenClaims,
  type WalkthroughCaseInput,
  type CaseReviewResult,
} from '../P5WalkthroughReviewUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<WalkthroughCaseInput> = {}): WalkthroughCaseInput {
  return {
    symbol: 'TEST',
    originalAsOfDate: '2025-10-01',
    horizonDays: 5,
    researchBucket: 'Strong',
    activeScoringBucket: 'Strong Candidate',
    primaryScore: 75,
    scoreDecile: 8,
    returnPct: 5.0,
    returnClass: 'POSITIVE',
    scoringCompletenessStatus: 'COMPLETE',
    signalCount: 10,
    factorCount: 10,
    reasonSnapshot: '技術偏多 / 法人買超',
    ...overrides,
  };
}

// ─── classifyCasePattern ──────────────────────────────────────────────────────

describe('classifyCasePattern', () => {
  it('classifies HIGH_SCORE_NEGATIVE_RETURN correctly', () => {
    const c = makeCase({ primaryScore: 80, returnPct: -3.5, returnClass: 'NEGATIVE' });
    expect(classifyCasePattern(c)).toBe('HIGH_SCORE_NEGATIVE_RETURN');
  });

  it('classifies LOW_SCORE_POSITIVE_RETURN correctly', () => {
    const c = makeCase({ primaryScore: 25, returnPct: 6.0, returnClass: 'POSITIVE' });
    expect(classifyCasePattern(c)).toBe('LOW_SCORE_POSITIVE_RETURN');
  });

  it('classifies HIGH_SCORE_POSITIVE_RETURN correctly', () => {
    const c = makeCase({ primaryScore: 90, returnPct: 10.0, returnClass: 'POSITIVE' });
    expect(classifyCasePattern(c)).toBe('HIGH_SCORE_POSITIVE_RETURN');
  });

  it('classifies LOW_SCORE_NEGATIVE_RETURN correctly', () => {
    const c = makeCase({ primaryScore: 20, returnPct: -5.0, returnClass: 'NEGATIVE' });
    expect(classifyCasePattern(c)).toBe('LOW_SCORE_NEGATIVE_RETURN');
  });

  it('classifies NEUTRAL_FLAT for flat return', () => {
    const c = makeCase({ primaryScore: 50, returnPct: 0.5, returnClass: 'FLAT' });
    expect(classifyCasePattern(c)).toBe('NEUTRAL_FLAT');
  });

  it('returns OTHER for null score', () => {
    const c = makeCase({ primaryScore: null });
    expect(classifyCasePattern(c)).toBe('OTHER');
  });

  it('returns OTHER for MISSING return class', () => {
    const c = makeCase({ primaryScore: 70, returnPct: null, returnClass: 'MISSING' });
    expect(classifyCasePattern(c)).toBe('OTHER');
  });

  it('mid-score positive is OTHER (not high, not low)', () => {
    const c = makeCase({ primaryScore: 50, returnPct: 3.0, returnClass: 'POSITIVE' });
    expect(classifyCasePattern(c)).toBe('OTHER');
  });
});

// ─── evaluateExplainability ───────────────────────────────────────────────────

describe('evaluateExplainability', () => {
  it('COMPLETE when bucket + score + reason all present', () => {
    const c = makeCase({ reasonSnapshot: '技術偏多 / 法人買超' });
    expect(evaluateExplainability(c)).toBe('COMPLETE');
  });

  it('COMPLETE when signals > 0 even without explicit reason text', () => {
    const c = makeCase({ reasonSnapshot: '技術偏多', signalCount: 10 });
    expect(evaluateExplainability(c)).toBe('COMPLETE');
  });

  it('WEAK when reason is empty string', () => {
    const c = makeCase({ reasonSnapshot: '', signalCount: 0, factorCount: 0 });
    expect(evaluateExplainability(c)).toBe('WEAK');
  });

  it('WEAK when reason is too short (< 3 chars)', () => {
    const c = makeCase({ reasonSnapshot: 'X', signalCount: 0, factorCount: 0 });
    expect(evaluateExplainability(c)).toBe('WEAK');
  });

  it('WEAK when no reason AND no signals AND no factors', () => {
    const c = makeCase({ reasonSnapshot: null, signalCount: 0, factorCount: 0 });
    expect(evaluateExplainability(c)).toBe('WEAK');
  });

  it('PARTIAL when only bucket present (no score, no reason)', () => {
    const c = makeCase({ primaryScore: undefined, reasonSnapshot: null, signalCount: 0, factorCount: 0, researchBucket: 'Watch' });
    expect(evaluateExplainability(c)).toBe('PARTIAL');
  });

  it('COMPLETE for PARTIAL completeness case with valid reason', () => {
    // Completeness status PARTIAL doesn't affect explainability dimension
    const c = makeCase({ scoringCompletenessStatus: 'PARTIAL', reasonSnapshot: '技術偏多' });
    expect(evaluateExplainability(c)).toBe('COMPLETE');
  });
});

// ─── evaluateScoreBucketConsistency ──────────────────────────────────────────

describe('evaluateScoreBucketConsistency', () => {
  it('CONSISTENT: Strong bucket score=75 (band 60-100)', () => {
    const c = makeCase({ researchBucket: 'Strong', primaryScore: 75 });
    expect(evaluateScoreBucketConsistency(c)).toBe('CONSISTENT');
  });

  it('CONSISTENT: LowPriority bucket score=35 (band 0-50)', () => {
    const c = makeCase({ researchBucket: 'LowPriority', primaryScore: 35 });
    expect(evaluateScoreBucketConsistency(c)).toBe('CONSISTENT');
  });

  it('CONSISTENT: Watch bucket score=55 (band 40-70)', () => {
    const c = makeCase({ researchBucket: 'Watch', primaryScore: 55 });
    expect(evaluateScoreBucketConsistency(c)).toBe('CONSISTENT');
  });

  it('INCONSISTENT: Strong bucket score=25 (far below band)', () => {
    const c = makeCase({ researchBucket: 'Strong', primaryScore: 25 });
    expect(evaluateScoreBucketConsistency(c)).toBe('INCONSISTENT');
  });

  it('INCONSISTENT: LowPriority bucket score=90 (far above band)', () => {
    const c = makeCase({ researchBucket: 'LowPriority', primaryScore: 90 });
    expect(evaluateScoreBucketConsistency(c)).toBe('INCONSISTENT');
  });

  it('BORDERLINE: Strong bucket score=55 (just below band low=60, within margin=10)', () => {
    const c = makeCase({ researchBucket: 'Strong', primaryScore: 55 });
    expect(evaluateScoreBucketConsistency(c)).toBe('BORDERLINE');
  });

  it('BORDERLINE: LowPriority bucket score=55 (just above band high=50, within margin=10)', () => {
    const c = makeCase({ researchBucket: 'LowPriority', primaryScore: 55 });
    expect(evaluateScoreBucketConsistency(c)).toBe('BORDERLINE');
  });

  it('UNKNOWN when bucket is null', () => {
    const c = makeCase({ researchBucket: undefined });
    expect(evaluateScoreBucketConsistency(c)).toBe('UNKNOWN');
  });

  it('UNKNOWN when score is null', () => {
    const c = makeCase({ primaryScore: null });
    expect(evaluateScoreBucketConsistency(c)).toBe('UNKNOWN');
  });

  it('UNKNOWN when bucket is unrecognized', () => {
    const c = makeCase({ researchBucket: 'InsufficientData' });
    expect(evaluateScoreBucketConsistency(c)).toBe('UNKNOWN');
  });
});

// ─── evaluateSignalReasonConsistency ─────────────────────────────────────────

describe('evaluateSignalReasonConsistency', () => {
  it('CONSISTENT: bullish reason with high score Strong bucket', () => {
    const c = makeCase({ researchBucket: 'Strong', primaryScore: 80, reasonSnapshot: '技術偏多 / 法人買超' });
    expect(evaluateSignalReasonConsistency(c)).toBe('CONSISTENT');
  });

  it('CONSISTENT: bearish reason with low score LowPriority bucket', () => {
    const c = makeCase({ researchBucket: 'LowPriority', activeScoringBucket: 'Avoid', primaryScore: 25, reasonSnapshot: '技術偏空 / 動能走弱' });
    expect(evaluateSignalReasonConsistency(c)).toBe('CONSISTENT');
  });

  it('GENERIC: single-token reason without slash', () => {
    const c = makeCase({ reasonSnapshot: '技術偏多', signalCount: 0 });
    expect(evaluateSignalReasonConsistency(c)).toBe('GENERIC');
  });

  it('GENERIC: very short reason with no signals', () => {
    const c = makeCase({ reasonSnapshot: 'X', signalCount: 0, factorCount: 0 });
    expect(evaluateSignalReasonConsistency(c)).toBe('GENERIC');
  });

  it('CONFLICTING: high score Strong but bearish-only reason', () => {
    const c = makeCase({ researchBucket: 'Strong', primaryScore: 85, reasonSnapshot: '技術偏空 / 動能走弱' });
    expect(evaluateSignalReasonConsistency(c)).toBe('CONFLICTING');
  });

  it('CONFLICTING: LowPriority Avoid but bullish-only reason', () => {
    const c = makeCase({ researchBucket: 'LowPriority', activeScoringBucket: 'Avoid', primaryScore: 20, reasonSnapshot: '技術偏多 / 動能轉強' });
    expect(evaluateSignalReasonConsistency(c)).toBe('CONFLICTING');
  });

  it('UNKNOWN: no reason and no signals', () => {
    const c = makeCase({ reasonSnapshot: null, signalCount: 0, factorCount: 0 });
    expect(evaluateSignalReasonConsistency(c)).toBe('UNKNOWN');
  });

  it('UNKNOWN: empty string reason', () => {
    const c = makeCase({ reasonSnapshot: '', signalCount: 0, factorCount: 0 });
    expect(evaluateSignalReasonConsistency(c)).toBe('UNKNOWN');
  });
});

// ─── evaluateOutcomeMismatchPattern ──────────────────────────────────────────

describe('evaluateOutcomeMismatchPattern', () => {
  it('delegates to classifyCasePattern', () => {
    const c = makeCase({ primaryScore: 80, returnPct: -3.0, returnClass: 'NEGATIVE' });
    expect(evaluateOutcomeMismatchPattern(c)).toBe('HIGH_SCORE_NEGATIVE_RETURN');
  });
});

// ─── summarizeWalkthroughFindings ─────────────────────────────────────────────

describe('summarizeWalkthroughFindings', () => {
  function makeReview(overrides: Partial<CaseReviewResult> = {}): CaseReviewResult {
    return {
      caseId: 'P5-CASE-001',
      symbol: 'TEST',
      originalAsOfDate: '2025-10-01',
      horizonDays: 5,
      researchBucket: 'Strong',
      score: 75,
      scoreDecile: 8,
      scoringCompletenessStatus: 'COMPLETE',
      realizedReturnClass: 'POSITIVE',
      returnPct: 5.0,
      topSignalOrFactor: '技術偏多',
      reasonSnapshotSummary: '技術偏多 / 法人買超',
      explainabilityCompleteness: 'COMPLETE',
      scoreBucketConsistency: 'CONSISTENT',
      signalReasonConsistency: 'CONSISTENT',
      outcomeMismatchPattern: 'HIGH_SCORE_POSITIVE_RETURN',
      followupCategory: 'READY_FOR_NEXT_AUDIT',
      limitationNotes: [],
      // P26A-RENDERER-INTEGRATION additive fields
      renderedReason: '技術偏多 / 法人買超',
      renderedReasonFactorCount: 2,
      reasonRendererVersion: 'p26a-corpus-renderer-v1',
      reasonRendererOutcome: 'ALREADY_RICH',
      dataAvailabilityNote: '',
      ...overrides,
    };
  }

  it('totalCases matches input length', () => {
    const rows = [makeReview(), makeReview({ caseId: 'P5-CASE-002' })];
    const s = summarizeWalkthroughFindings(rows);
    expect(s.totalCases).toBe(2);
  });

  it('byHorizon counts correctly', () => {
    const rows = [
      makeReview({ horizonDays: 5 }),
      makeReview({ horizonDays: 20 }),
      makeReview({ horizonDays: 5 }),
    ];
    const s = summarizeWalkthroughFindings(rows);
    expect(s.byHorizon['5']).toBe(2);
    expect(s.byHorizon['20']).toBe(1);
  });

  it('byExplainabilityCompleteness counts correctly', () => {
    const rows = [
      makeReview({ explainabilityCompleteness: 'COMPLETE' }),
      makeReview({ explainabilityCompleteness: 'COMPLETE' }),
      makeReview({ explainabilityCompleteness: 'PARTIAL' }),
    ];
    const s = summarizeWalkthroughFindings(rows);
    expect(s.byExplainabilityCompleteness['COMPLETE']).toBe(2);
    expect(s.byExplainabilityCompleteness['PARTIAL']).toBe(1);
  });

  it('topLimitationNotes is sorted by count desc', () => {
    const rows = [
      makeReview({ limitationNotes: ['note A', 'note B'] }),
      makeReview({ limitationNotes: ['note A'] }),
      makeReview({ limitationNotes: ['note C'] }),
    ];
    const s = summarizeWalkthroughFindings(rows);
    expect(s.topLimitationNotes[0].note).toBe('note A');
    expect(s.topLimitationNotes[0].count).toBe(2);
  });

  it('is deterministic for same input', () => {
    const rows = [makeReview(), makeReview({ caseId: 'P5-CASE-002', horizonDays: 20 })];
    const s1 = summarizeWalkthroughFindings(rows);
    const s2 = summarizeWalkthroughFindings(rows);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2));
  });

  it('returns empty counts for empty input', () => {
    const s = summarizeWalkthroughFindings([]);
    expect(s.totalCases).toBe(0);
    expect(Object.keys(s.byHorizon).length).toBe(0);
  });
});

// ─── determineFollowupCategory ────────────────────────────────────────────────

describe('determineFollowupCategory', () => {
  it('DATA_COVERAGE_REVIEW for EMPTY completeness', () => {
    expect(determineFollowupCategory('COMPLETE', 'CONSISTENT', 'CONSISTENT', 'EMPTY', 75)).toBe('DATA_COVERAGE_REVIEW');
  });

  it('DATA_COVERAGE_REVIEW for PARTIAL completeness', () => {
    expect(determineFollowupCategory('COMPLETE', 'CONSISTENT', 'CONSISTENT', 'PARTIAL', 75)).toBe('DATA_COVERAGE_REVIEW');
  });

  it('SIGNAL_REASON_REVIEW for WEAK explainability', () => {
    expect(determineFollowupCategory('WEAK', 'CONSISTENT', 'CONSISTENT', 'COMPLETE', 75)).toBe('SIGNAL_REASON_REVIEW');
  });

  it('SIGNAL_REASON_REVIEW for CONFLICTING signal/reason', () => {
    expect(determineFollowupCategory('COMPLETE', 'CONSISTENT', 'CONFLICTING', 'COMPLETE', 75)).toBe('SIGNAL_REASON_REVIEW');
  });

  it('BUCKET_SCHEMA_REVIEW for INCONSISTENT score/bucket', () => {
    expect(determineFollowupCategory('COMPLETE', 'INCONSISTENT', 'CONSISTENT', 'COMPLETE', 75)).toBe('BUCKET_SCHEMA_REVIEW');
  });

  it('SCORE_DISTRIBUTION_REVIEW for BORDERLINE score/bucket', () => {
    expect(determineFollowupCategory('COMPLETE', 'BORDERLINE', 'CONSISTENT', 'COMPLETE', 75)).toBe('SCORE_DISTRIBUTION_REVIEW');
  });

  it('READY_FOR_NEXT_AUDIT when all dimensions pass', () => {
    expect(determineFollowupCategory('COMPLETE', 'CONSISTENT', 'CONSISTENT', 'COMPLETE', 75)).toBe('READY_FOR_NEXT_AUDIT');
  });

  it('DATA_COVERAGE_REVIEW for null score', () => {
    expect(determineFollowupCategory('COMPLETE', 'CONSISTENT', 'CONSISTENT', 'COMPLETE', null)).toBe('DATA_COVERAGE_REVIEW');
  });
});

// ─── buildLimitationNotes ─────────────────────────────────────────────────────

describe('buildLimitationNotes', () => {
  it('returns empty array for fully populated case', () => {
    const c = makeCase();
    const notes = buildLimitationNotes(c);
    expect(notes).toEqual([]);
  });

  it('notes PARTIAL completeness', () => {
    const c = makeCase({ scoringCompletenessStatus: 'PARTIAL' });
    const notes = buildLimitationNotes(c);
    expect(notes.some(n => n.includes('PARTIAL'))).toBe(true);
  });

  it('notes missing reasonSnapshot', () => {
    const c = makeCase({ reasonSnapshot: null });
    const notes = buildLimitationNotes(c);
    expect(notes.some(n => /reasonSnapshot/i.test(n))).toBe(true);
  });

  it('notes zero signalCount', () => {
    const c = makeCase({ signalCount: 0 });
    const notes = buildLimitationNotes(c);
    expect(notes.some(n => /signalCount/i.test(n))).toBe(true);
  });

  it('notes missing returnPct', () => {
    const c = makeCase({ returnPct: null });
    const notes = buildLimitationNotes(c);
    expect(notes.some(n => /returnPct/i.test(n))).toBe(true);
  });
});

// ─── reviewCase ───────────────────────────────────────────────────────────────

describe('reviewCase', () => {
  it('produces deterministic output for same input', () => {
    const c = makeCase();
    const r1 = reviewCase(c, 0);
    const r2 = reviewCase(c, 0);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('assigns sequential caseId', () => {
    const r0 = reviewCase(makeCase(), 0);
    const r1 = reviewCase(makeCase(), 1);
    expect(r0.caseId).toBe('P5-CASE-001');
    expect(r1.caseId).toBe('P5-CASE-002');
  });

  it('topSignalOrFactor is first slash-split token of reasonSnapshot', () => {
    const c = makeCase({ reasonSnapshot: '技術偏多 / 法人買超' });
    const r = reviewCase(c, 0);
    expect(r.topSignalOrFactor).toBe('技術偏多');
  });

  it('topSignalOrFactor is (no signal) when reasonSnapshot is null', () => {
    const c = makeCase({ reasonSnapshot: null });
    const r = reviewCase(c, 0);
    expect(r.topSignalOrFactor).toBe('(no signal)');
  });
});

// ─── scanForbiddenClaims ─────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('detects roi', () => {
    const hits = scanForbiddenClaims('expected ROI is 15%');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].pattern).toBe('roi');
  });

  it('detects win-rate', () => {
    const hits = scanForbiddenClaims('the win-rate is 70%');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].pattern).toBe('win-rate');
  });

  it('detects outperform', () => {
    const hits = scanForbiddenClaims('this system will outperform the index');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects guaranteed', () => {
    const hits = scanForbiddenClaims('returns are guaranteed');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects profit', () => {
    const hits = scanForbiddenClaims('estimated profit: 200k');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects alpha-edge', () => {
    const hits = scanForbiddenClaims('system has alpha-edge over market');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects buy-signal', () => {
    const hits = scanForbiddenClaims('generate a buy-signal for 1234');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('detects sell-signal', () => {
    const hits = scanForbiddenClaims('a sell-signal was triggered');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('returns empty array for clean descriptive text', () => {
    const hits = scanForbiddenClaims(
      'Descriptive distribution comparison only. No performance claims. Descriptive statistics.'
    );
    expect(hits).toEqual([]);
  });

  it('returns empty array for alphaScore field name', () => {
    const hits = scanForbiddenClaims('field: alphaScore value: 75');
    expect(hits).toEqual([]);
  });

  it('returns empty array for disclaimer line', () => {
    const hits = scanForbiddenClaims('disclaimer: this is not investment advice, no ROI claims');
    expect(hits).toEqual([]);
  });
});
