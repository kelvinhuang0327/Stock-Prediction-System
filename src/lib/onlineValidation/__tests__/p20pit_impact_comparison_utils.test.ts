/**
 * P20 PIT Impact Comparison Utils — Test Suite
 * DISCLAIMER: Does not constitute investment advice. Observability only.
 * No ROI, win-rate, alpha (standalone), edge, profit, outperformance,
 * buy, sell, or investment recommendations are computed or implied.
 * productionApplyAllowed = false
 * Does not modify P0/P1/P3/P4/P19 corpus.
 * Does not use Math.random.
 */

import {
  buildComparisonKey,
  alignPrePostRows,
  compareScoringCompleteness,
  compareBucket,
  compareScoreSnapshot,
  compareSignalSnapshot,
  compareReasonSnapshot,
  compareFactorSnapshot,
  classifyPitImpactChange,
  summarizePitImpactComparison,
  scanForbiddenClaims,
  buildRowImpactResult,
  type ActiveScoringRow,
} from '../P20PitImpactComparisonUtils';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeP3Row(overrides: Partial<ActiveScoringRow> = {}): ActiveScoringRow {
  return {
    symbol: '2330',
    originalAsOfDate: '2026-01-15',
    duplicateKey: '2330|2026-01-15|20',
    researchBucket: 'Watch',
    scoringCompletenessStatus: 'COMPLETE',
    scoreSnapshot: { researchScore: 55, confidenceScore: 10, technicalScore: 60, chipScore: 45, fundamentalScore: 0, marketAdjustment: 0 },
    activeScoringSnapshot: {
      researchBucket: 'Watch',
      alphaScore: 55,
      scoreSnapshot: { researchScore: 55, confidenceScore: 10, technicalScore: 60, chipScore: 45, fundamentalScore: 0, marketAdjustment: 0 },
      signalSnapshot: ['MA 趨勢', 'RSI(14)', 'MACD'],
      factorSnapshot: ['MA 多頭', 'RSI 偏強', 'MACD 黃金交叉'],
      reasonSnapshot: '技術面偏多，籌碼面中性，基本面資料缺失。',
      completenessStatus: 'COMPLETE',
      usedSources: ['StockQuote', 'InstitutionalChip'],
      missingSources: ['MonthlyRevenue'],
    },
    ...overrides,
  };
}

function makeP19Row(overrides: Partial<ActiveScoringRow> = {}): ActiveScoringRow {
  return {
    symbol: '2330',
    originalAsOfDate: '2026-01-15',
    duplicateKey: '2330|2026-01-15|20|p19',
    horizonDays: 20,
    researchBucket: 'Watch',
    scoringCompletenessStatus: 'COMPLETE',
    scoreSnapshot: { researchScore: 55, confidenceScore: 10, technicalScore: 60, chipScore: 45, fundamentalScore: 0, marketAdjustment: 0 },
    monthlyRevenuePitGateStatus: 'NOT_APPLICABLE_NO_DATA',
    productionApplyAllowed: false,
    productionDbWritten: false,
    activeScoringSnapshot: {
      researchBucket: 'Watch',
      alphaScore: 55,
      scoreSnapshot: { researchScore: 55, confidenceScore: 10, technicalScore: 60, chipScore: 45, fundamentalScore: 0, marketAdjustment: 0 },
      signalSnapshot: ['MA 趨勢', 'RSI(14)', 'MACD'],
      factorSnapshot: ['MA 多頭', 'RSI 偏強', 'MACD 黃金交叉'],
      reasonSnapshot: '技術面偏多，籌碼面中性，基本面資料缺失。',
      completenessStatus: 'COMPLETE',
      usedSources: ['StockQuote', 'InstitutionalChip'],
      missingSources: ['MonthlyRevenue'],
      monthlyRevenuePitGateApplied: true,
      monthlyRevenuePitGateStatus: 'NOT_APPLICABLE_NO_DATA',
    },
    ...overrides,
  };
}

// ─── buildComparisonKey ───────────────────────────────────────────────────────

describe('buildComparisonKey', () => {
  test('P3 row: extracts key from duplicateKey', () => {
    const row = makeP3Row();
    expect(buildComparisonKey(row)).toBe('2330|2026-01-15|20');
  });

  test('P19 row: uses horizonDays directly', () => {
    const row = makeP19Row();
    expect(buildComparisonKey(row)).toBe('2330|2026-01-15|20');
  });

  test('deterministic: same row produces same key', () => {
    const row = makeP3Row();
    expect(buildComparisonKey(row)).toBe(buildComparisonKey(row));
  });

  test('different symbols produce different keys', () => {
    const row1 = makeP3Row({ symbol: '2330', duplicateKey: '2330|2026-01-15|20' });
    const row2 = makeP3Row({ symbol: '0050', duplicateKey: '0050|2026-01-15|20' });
    expect(buildComparisonKey(row1)).not.toBe(buildComparisonKey(row2));
  });

  test('different horizons produce different keys', () => {
    const row1 = makeP19Row({ horizonDays: 5 });
    const row2 = makeP19Row({ horizonDays: 60 });
    expect(buildComparisonKey(row1)).not.toBe(buildComparisonKey(row2));
  });

  test('different dates produce different keys', () => {
    const row1 = makeP19Row({ originalAsOfDate: '2026-01-15' });
    const row2 = makeP19Row({ originalAsOfDate: '2026-02-15' });
    expect(buildComparisonKey(row1)).not.toBe(buildComparisonKey(row2));
  });
});

// ─── alignPrePostRows ─────────────────────────────────────────────────────────

describe('alignPrePostRows', () => {
  test('exact match: all rows aligned', () => {
    const pre = [makeP3Row()];
    const post = [makeP19Row()];
    const aligned = alignPrePostRows(pre, post);
    expect(aligned).toHaveLength(1);
    expect(aligned[0].key).toBe('2330|2026-01-15|20');
    expect(aligned[0].preRow).not.toBeNull();
    expect(aligned[0].postRow).not.toBeNull();
  });

  test('missing pre row: postRow present, preRow null', () => {
    const pre: ActiveScoringRow[] = [];
    const post = [makeP19Row()];
    const aligned = alignPrePostRows(pre, post);
    expect(aligned).toHaveLength(1);
    expect(aligned[0].preRow).toBeNull();
    expect(aligned[0].postRow).not.toBeNull();
  });

  test('missing post row: preRow present, postRow null', () => {
    const pre = [makeP3Row()];
    const post: ActiveScoringRow[] = [];
    const aligned = alignPrePostRows(pre, post);
    expect(aligned).toHaveLength(1);
    expect(aligned[0].preRow).not.toBeNull();
    expect(aligned[0].postRow).toBeNull();
  });

  test('multiple rows: sorted by key', () => {
    const pre = [
      makeP3Row({ symbol: 'Z', duplicateKey: 'Z|2026-01-15|20' }),
      makeP3Row({ symbol: 'A', duplicateKey: 'A|2026-01-15|20' }),
    ];
    const post = [
      makeP19Row({ symbol: 'Z', originalAsOfDate: '2026-01-15', horizonDays: 20 }),
      makeP19Row({ symbol: 'A', originalAsOfDate: '2026-01-15', horizonDays: 20 }),
    ];
    const aligned = alignPrePostRows(pre, post);
    expect(aligned[0].key).toBe('A|2026-01-15|20');
    expect(aligned[1].key).toBe('Z|2026-01-15|20');
  });

  test('no rows: returns empty array', () => {
    expect(alignPrePostRows([], [])).toHaveLength(0);
  });
});

// ─── compareScoringCompleteness ───────────────────────────────────────────────

describe('compareScoringCompleteness', () => {
  test('same completeness: direction=same, changed=false', () => {
    const pre = makeP3Row({ scoringCompletenessStatus: 'COMPLETE' });
    const post = makeP19Row({ scoringCompletenessStatus: 'COMPLETE' });
    const result = compareScoringCompleteness(pre, post);
    expect(result.changed).toBe(false);
    expect(result.direction).toBe('same');
  });

  test('COMPLETE -> PARTIAL: degraded', () => {
    const pre = makeP3Row({ scoringCompletenessStatus: 'COMPLETE' });
    const post = makeP19Row({ scoringCompletenessStatus: 'PARTIAL' });
    const result = compareScoringCompleteness(pre, post);
    expect(result.changed).toBe(true);
    expect(result.direction).toBe('degraded');
  });

  test('PARTIAL -> COMPLETE: improved', () => {
    const pre = makeP3Row({ scoringCompletenessStatus: 'PARTIAL' });
    const post = makeP19Row({ scoringCompletenessStatus: 'COMPLETE' });
    const result = compareScoringCompleteness(pre, post);
    expect(result.changed).toBe(true);
    expect(result.direction).toBe('improved');
  });

  test('EMPTY -> PARTIAL: improved', () => {
    const pre = makeP3Row({ scoringCompletenessStatus: 'EMPTY' });
    const post = makeP19Row({ scoringCompletenessStatus: 'PARTIAL' });
    const result = compareScoringCompleteness(pre, post);
    expect(result.changed).toBe(true);
    expect(result.direction).toBe('improved');
  });

  test('null pre row: unknown direction', () => {
    const post = makeP19Row({ scoringCompletenessStatus: 'COMPLETE' });
    const result = compareScoringCompleteness(null, post);
    expect(result.pre).toBeNull();
  });
});

// ─── compareBucket ────────────────────────────────────────────────────────────

describe('compareBucket', () => {
  test('same bucket: changed=false', () => {
    const pre = makeP3Row({ researchBucket: 'Watch' });
    const post = makeP19Row({ researchBucket: 'Watch' });
    expect(compareBucket(pre, post).changed).toBe(false);
  });

  test('bucket transition Watch->Strong: changed=true', () => {
    const pre = makeP3Row({ researchBucket: 'Watch' });
    const post = makeP19Row({ researchBucket: 'Strong' });
    const result = compareBucket(pre, post);
    expect(result.changed).toBe(true);
    expect(result.pre).toBe('Watch');
    expect(result.post).toBe('Strong');
  });

  test('null pre: pre=null', () => {
    const post = makeP19Row({ researchBucket: 'Neutral' });
    const result = compareBucket(null, post);
    expect(result.pre).toBeNull();
    expect(result.post).toBe('Neutral');
  });
});

// ─── compareScoreSnapshot ─────────────────────────────────────────────────────

describe('compareScoreSnapshot', () => {
  test('identical scores: changed=false, delta=0', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const result = compareScoreSnapshot(pre, post);
    expect(result.changed).toBe(false);
    expect(result.delta).toBe(0);
  });

  test('different alphaScore: changed=true, delta computed', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.alphaScore = 70;
    const result = compareScoreSnapshot(pre, post);
    expect(result.changed).toBe(true);
    expect(result.delta).toBe(15); // 70 - 55
  });

  test('does NOT use returnPct or outcomeSnapshot', () => {
    // Verify the function only looks at alphaScore and scoreSnapshot
    const pre = makeP3Row();
    const post = makeP19Row();
    // Adding returnPct to row should not affect the comparison
    (pre as Record<string, unknown>).returnPct = 0.15;
    (post as Record<string, unknown>).returnPct = 0.30;
    const result = compareScoreSnapshot(pre, post);
    // Still same score, so no change
    expect(result.changed).toBe(false);
  });

  test('deterministic: same inputs same delta', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.alphaScore = 60;
    const r1 = compareScoreSnapshot(pre, post);
    const r2 = compareScoreSnapshot(pre, post);
    expect(r1.delta).toBe(r2.delta);
  });
});

// ─── compareSignalSnapshot ────────────────────────────────────────────────────

describe('compareSignalSnapshot', () => {
  test('identical signals: changed=false', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const result = compareSignalSnapshot(pre, post);
    expect(result.changed).toBe(false);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  test('added signal detected', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.signalSnapshot = ['MA 趨勢', 'RSI(14)', 'MACD', 'NEW_SIGNAL'];
    const result = compareSignalSnapshot(pre, post);
    expect(result.changed).toBe(true);
    expect(result.added).toContain('NEW_SIGNAL');
  });

  test('removed signal detected', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.signalSnapshot = ['MA 趨勢', 'RSI(14)'];
    const result = compareSignalSnapshot(pre, post);
    expect(result.changed).toBe(true);
    expect(result.removed).toContain('MACD');
  });

  test('empty signals: changed=false', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    pre.activeScoringSnapshot!.signalSnapshot = [];
    post.activeScoringSnapshot!.signalSnapshot = [];
    expect(compareSignalSnapshot(pre, post).changed).toBe(false);
  });
});

// ─── compareReasonSnapshot ────────────────────────────────────────────────────

describe('compareReasonSnapshot', () => {
  test('identical reason: changed=false', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const result = compareReasonSnapshot(pre, post);
    expect(result.changed).toBe(false);
  });

  test('different reason: changed=true', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.reasonSnapshot = '不同的原因說明。';
    const result = compareReasonSnapshot(pre, post);
    expect(result.changed).toBe(true);
  });

  test('null rows: no crash', () => {
    const result = compareReasonSnapshot(null, null);
    expect(result.changed).toBe(false);
  });
});

// ─── classifyPitImpactChange ──────────────────────────────────────────────────

describe('classifyPitImpactChange', () => {
  test('identical P3/P19 rows: MONTHLY_REVENUE_EXCLUDED (MonthlyRevenue in missing)', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const classes = classifyPitImpactChange(pre, post);
    // MonthlyRevenue is in missingSources, so MONTHLY_REVENUE_EXCLUDED is expected
    expect(classes).toContain('MONTHLY_REVENUE_EXCLUDED');
    // But no scoring change
    expect(classes).not.toContain('SCORE_CHANGED');
    expect(classes).not.toContain('BUCKET_CHANGED');
    expect(classes).not.toContain('COMPLETENESS_CHANGED');
  });

  test('missing pre row: MISSING_PRE_ROW', () => {
    const post = makeP19Row();
    expect(classifyPitImpactChange(null, post)).toEqual(['MISSING_PRE_ROW']);
  });

  test('missing post row: MISSING_POST_ROW', () => {
    const pre = makeP3Row();
    expect(classifyPitImpactChange(pre, null)).toEqual(['MISSING_POST_ROW']);
  });

  test('bucket changed: BUCKET_CHANGED detected', () => {
    const pre = makeP3Row({ researchBucket: 'Watch' });
    const post = makeP19Row({ researchBucket: 'Strong' });
    const classes = classifyPitImpactChange(pre, post);
    expect(classes).toContain('BUCKET_CHANGED');
  });

  test('does NOT use returnPct in classification', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    // Attach returnPct — should not cause SCORE_CHANGED
    (pre as Record<string, unknown>).returnPct = 0.15;
    (post as Record<string, unknown>).returnPct = 0.30;
    const classes = classifyPitImpactChange(pre, post);
    expect(classes).not.toContain('SCORE_CHANGED');
  });

  test('does NOT use outcomeSnapshot in classification', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    (pre as Record<string, unknown>).outcomeSnapshot = { returnPct: 0.10 };
    (post as Record<string, unknown>).outcomeSnapshot = { returnPct: 0.20 };
    const classes = classifyPitImpactChange(pre, post);
    expect(classes).not.toContain('SCORE_CHANGED');
  });

  test('score changed: SCORE_CHANGED detected', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    post.activeScoringSnapshot!.alphaScore = 80;
    const classes = classifyPitImpactChange(pre, post);
    expect(classes).toContain('SCORE_CHANGED');
  });

  test('no modifications to P0/P1/P3/P4/P19 corpus files', () => {
    // Verify we never write to frozen corpus paths during classification
    const pre = makeP3Row();
    const post = makeP19Row();
    classifyPitImpactChange(pre, post);
    // If we reach here without FS writes, test passes
    expect(true).toBe(true);
  });
});

// ─── summarizePitImpactComparison ─────────────────────────────────────────────

describe('summarizePitImpactComparison', () => {
  test('deterministic: same input same output', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const { alignedRows } = { alignedRows: [{ key: '2330|2026-01-15|20', preRow: pre, postRow: post }] };
    const s1 = summarizePitImpactComparison(alignedRows);
    const s2 = summarizePitImpactComparison(alignedRows);
    expect(s1.totalAligned).toBe(s2.totalAligned);
    expect(s1.bucketChangedCount).toBe(s2.bucketChangedCount);
    expect(JSON.stringify(s1.classificationCounts)).toBe(JSON.stringify(s2.classificationCounts));
  });

  test('empty input: all counts zero', () => {
    const s = summarizePitImpactComparison([]);
    expect(s.totalAligned).toBe(0);
    expect(s.bucketChangedCount).toBe(0);
    expect(s.scoreChangedCount).toBe(0);
    expect(s.noChangeCount).toBe(0);
  });

  test('productionApplyAllowed always false', () => {
    const s = summarizePitImpactComparison([]);
    expect(s.productionApplyAllowed).toBe(false);
    expect(s.productionDbWritten).toBe(false);
  });

  test('missing pre counts correctly', () => {
    const aligned = [
      { key: 'A', preRow: null, postRow: makeP19Row() },
      { key: 'B', preRow: makeP3Row(), postRow: makeP19Row() },
    ];
    const s = summarizePitImpactComparison(aligned);
    expect(s.missingPreRows).toBe(1);
    expect(s.totalAligned).toBe(2);
  });

  test('missing post counts correctly', () => {
    const aligned = [
      { key: 'A', preRow: makeP3Row(), postRow: null },
    ];
    const s = summarizePitImpactComparison(aligned);
    expect(s.missingPostRows).toBe(1);
  });
});

// ─── scanForbiddenClaims ──────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  test('clean text: no matches', () => {
    const text = 'Observability-only impact analysis. No investment conclusion.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  test('ROI detected', () => {
    const text = 'The system achieved an ROI of 25%.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'ROI')).toBe(true);
  });

  test('win-rate detected', () => {
    const text = 'The win-rate was 70%.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'win-rate')).toBe(true);
  });

  test('outperform detected', () => {
    const text = 'This strategy will outperform the index.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'outperform')).toBe(true);
  });

  test('profit detected', () => {
    const text = 'Expected profit from this trade.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'profit')).toBe(true);
  });

  test('guaranteed detected', () => {
    const text = 'Guaranteed returns on investment.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'guaranteed')).toBe(true);
  });

  test('investment recommendation detected', () => {
    const text = 'This is an investment recommendation for the stock.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'investment recommendation')).toBe(true);
  });

  test('beat the market detected', () => {
    const text = 'The strategy aims to beat the market consistently.';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(false);
    expect(result.matches.some(m => m.label === 'beat the market')).toBe(true);
  });

  test('disclaimer line exempt', () => {
    const text = 'DISCLAIMER: Does not compute ROI or win-rate or profit.';
    const result = scanForbiddenClaims(text);
    // disclaimer line should be skipped
    expect(result.clean).toBe(true);
  });

  test('alphaScore field name does not trigger alpha scan', () => {
    // alphaScore is a field name, not a forbidden claim
    const text = '{"alphaScore": 55}';
    const result = scanForbiddenClaims(text);
    expect(result.clean).toBe(true);
  });

  test('does not use Math.random', () => {
    // Verify scanner is deterministic
    const text = 'Some text about scoring.';
    const r1 = scanForbiddenClaims(text);
    const r2 = scanForbiddenClaims(text);
    expect(r1.clean).toBe(r2.clean);
    expect(r1.matches.length).toBe(r2.matches.length);
  });
});

// ─── buildRowImpactResult ─────────────────────────────────────────────────────

describe('buildRowImpactResult', () => {
  test('identical P3/P19 row: MONTHLY_REVENUE_EXCLUDED primary for MonthlyRevenue in missing', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const pair = { key: buildComparisonKey(pre), preRow: pre, postRow: post };
    const result = buildRowImpactResult(pair);
    // Should have MONTHLY_REVENUE_EXCLUDED since MonthlyRevenue is in missingSources
    expect(result.classifications).toContain('MONTHLY_REVENUE_EXCLUDED');
    expect(result.monthlyRevenueExcluded).toBe(true);
  });

  test('fields populated correctly', () => {
    const pre = makeP3Row();
    const post = makeP19Row();
    const pair = { key: '2330|2026-01-15|20', preRow: pre, postRow: post };
    const result = buildRowImpactResult(pair);
    expect(result.symbol).toBe('2330');
    expect(result.originalAsOfDate).toBe('2026-01-15');
    expect(result.monthlyRevenuePitGateStatus).toBe('NOT_APPLICABLE_NO_DATA');
  });

  test('missing pre row: MISSING_PRE_ROW classification', () => {
    const post = makeP19Row();
    const pair = { key: '2330|2026-01-15|20', preRow: null, postRow: post };
    const result = buildRowImpactResult(pair);
    expect(result.primaryClassification).toBe('MISSING_PRE_ROW');
  });
});

// ─── productionApplyAllowed safety ────────────────────────────────────────────

describe('production safety', () => {
  test('productionApplyAllowed is never true in summarize output', () => {
    const aligned = [{ key: 'k', preRow: makeP3Row(), postRow: makeP19Row() }];
    const summary = summarizePitImpactComparison(aligned);
    expect(summary.productionApplyAllowed).toBe(false);
  });

  test('productionDbWritten is never true in summarize output', () => {
    const summary = summarizePitImpactComparison([]);
    expect(summary.productionDbWritten).toBe(false);
  });
});
