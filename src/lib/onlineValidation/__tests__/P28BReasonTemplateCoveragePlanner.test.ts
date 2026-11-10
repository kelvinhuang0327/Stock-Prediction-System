import {
  buildRendererRepairPlan,
  buildRendererRepairPlanBatch,
  detectMixedSignal,
  inferDirectionFromMATrend,
  isSingleTokenGenericReason,
  type P28BInputSnapshot,
} from '../P28BReasonTemplateCoveragePlanner';

describe('P28B reason template coverage planner', () => {
  it('infers MA direction and treats absent or unrecognized factors as neutral', () => {
    expect(inferDirectionFromMATrend([])).toBe('中性');
    expect(inferDirectionFromMATrend(['成交量放大'])).toBe('中性');
    expect(inferDirectionFromMATrend(['MA 趨勢：多頭排列'])).toBe('偏多');
    expect(inferDirectionFromMATrend(['MA 趨勢：空頭排列'])).toBe('偏空');
    expect(inferDirectionFromMATrend(['MA 趨勢：均線糾結'])).toBe('中性');
  });

  it('detects both mixed-signal directions and requires both MA and MACD evidence', () => {
    expect(detectMixedSignal([])).toBe(false);
    expect(detectMixedSignal(['MA 趨勢：空頭排列'])).toBe(false);
    expect(detectMixedSignal(['MACD：多方動能'])).toBe(false);
    expect(detectMixedSignal(['MA 趨勢：空頭排列', 'MACD：多方動能'])).toBe(true);
    expect(detectMixedSignal(['MA 趨勢：多頭排列', 'MACD：空方動能'])).toBe(true);
    expect(detectMixedSignal(['MA 趨勢：多頭排列', 'MACD：死叉'])).toBe(true);
    expect(detectMixedSignal(['MA 趨勢：多頭排列', 'MACD：多方動能'])).toBe(false);
  });

  it('recognizes trimmed generic reason tokens and rejects descriptive text', () => {
    expect(isSingleTokenGenericReason(' 技術偏多 ')).toBe(true);
    expect(isSingleTokenGenericReason('訊號不明')).toBe(true);
    expect(isSingleTokenGenericReason('技術偏多，法人買超')).toBe(false);
    expect(isSingleTokenGenericReason('')).toBe(false);
  });

  it('plans a zero-score technical label repair when directional factors exist', () => {
    const input: P28BInputSnapshot = {
      reasonSnapshot: '技術偏多',
      factorSnapshot: ['MA 趨勢：多頭排列'],
      scoreSnapshot: { technicalScore: 0, chipScore: 2, momentumScore: 3, revenueScore: 4 },
      symbol: '2330',
      alphaScore: 72,
      researchBucket: 'STRONG',
    };
    const plan = buildRendererRepairPlan(input, 'plan-zero');

    expect(plan).toMatchObject({
      planId: 'plan-zero',
      inputSymbol: '2330',
      inputAlphaScore: 72,
      inputBucket: 'STRONG',
      alphaScoreUnchanged: true,
      bucketUnchanged: true,
      inferredTechDirection: '偏多',
      isGenericSingleToken: true,
      factorSnapshotCount: 1,
    });
    expect(plan.entries.map((entry) => entry.repairFamily)).toContain('scoreSnapshot_zero_label');
    expect(plan.entries[0]).toMatchObject({
      repairFamily: 'scoreSnapshot_zero_label',
      templateRuleIds: ['TR-01', 'TR-02'],
      requiresScoringChange: false,
      safeToImplementNow: true,
    });
    expect(plan.disclaimer).toContain('No investment recommendations');
  });

  it('does not propose a zero-score repair when technical score passes through or direction is neutral', () => {
    const passthrough = buildRendererRepairPlan({
      reasonSnapshot: '技術偏空', factorSnapshot: ['MA 趨勢：空頭排列'],
      scoreSnapshot: { technicalScore: 1, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    });
    expect(passthrough.entries.map((entry) => entry.repairFamily)).not.toContain('scoreSnapshot_zero_label');

    const neutral = buildRendererRepairPlan({ reasonSnapshot: '技術偏多', factorSnapshot: ['MA 趨勢：盤整'], scoreSnapshot: { technicalScore: 0, chipScore: 0, momentumScore: 0, revenueScore: 0 } });
    expect(neutral.entries.map((entry) => entry.repairFamily)).not.toContain('scoreSnapshot_zero_label');

    const missingScore = buildRendererRepairPlan({ reasonSnapshot: '技術偏空', factorSnapshot: ['MA 趨勢：空頭排列'] });
    expect(missingScore.entries.map((entry) => entry.repairFamily)).toContain('scoreSnapshot_zero_label');
  });

  it('adds mixed-signal and generic-factor notes independently of the score repair', () => {
    const plan = buildRendererRepairPlan({
      reasonSnapshot: '中性觀望',
      factorSnapshot: ['MA 趨勢：多頭排列', 'MACD：死叉'],
      scoreSnapshot: { technicalScore: 5, chipScore: 0, momentumScore: 0, revenueScore: 0 },
    });

    expect(plan.hasMixedSignal).toBe(true);
    expect(plan.entries.map((entry) => entry.repairFamily)).toEqual([
      'mixed_signals_no_template',
      'no_triggered_factor_note',
    ]);
    expect(plan.entries.every((entry) => entry.requiresScoringChange === false)).toBe(true);
  });

  it('adds monthly revenue notes for English and Chinese source names and provides the date fallback', () => {
    const dated = buildRendererRepairPlan({
      reasonSnapshot: '普通敘述', factorSnapshot: [], missingSources: ['MonthlyRevenue'], asOfDate: '2026-11-09',
    });
    expect(dated.hasMonthlyRevenueMissing).toBe(true);
    expect(dated.entries[0]).toMatchObject({ repairFamily: 'monthly_revenue_missing_note', templateRuleIds: ['TR-05'] });
    expect(dated.entries[0].proposedAction).toContain('2026-11-09');

    const undated = buildRendererRepairPlan({ reasonSnapshot: '普通敘述', factorSnapshot: [], missingSources: ['月營收資料'] });
    expect(undated.entries[0].proposedAction).toContain('截至 未知');
    expect(buildRendererRepairPlan({ reasonSnapshot: '普通敘述', factorSnapshot: [], missingSources: ['Revenue'] }).hasMonthlyRevenueMissing).toBe(false);
  });

  it('distinguishes empty fallback from an already-covered non-empty snapshot', () => {
    const empty = buildRendererRepairPlan({ reasonSnapshot: '', factorSnapshot: [] }, 'empty');
    expect(empty.entries).toEqual([expect.objectContaining({ repairFamily: 'fallback_empty', gapIds: [], templateRuleIds: [], patchTargetFiles: [] })]);

    const covered = buildRendererRepairPlan({ reasonSnapshot: '多項因子顯示趨勢轉強', factorSnapshot: ['趨勢已確認'] }, 'covered');
    expect(covered.entries).toEqual([expect.objectContaining({ repairFamily: 'already_covered', safeToImplementNow: true })]);
    expect(covered.inputSymbol).toBeNull();
    expect(covered.inputAlphaScore).toBeNull();
    expect(covered.inputBucket).toBeNull();
  });

  it('combines applicable repairs without mutating read-only inputs and creates stable batch ids', () => {
    const snapshot: P28BInputSnapshot = {
      reasonSnapshot: '法人買超',
      factorSnapshot: ['MA 趨勢：空頭排列', 'MACD：多方動能'],
      missingSources: ['monthlyRevenue'],
      alphaScore: 48,
      researchBucket: 'WATCH',
    };
    const before = {
      ...snapshot,
      factorSnapshot: [...snapshot.factorSnapshot],
      missingSources: [...(snapshot.missingSources ?? [])],
    };
    const plan = buildRendererRepairPlan(snapshot, 'combined');
    expect(snapshot).toEqual(before);
    expect(plan.entries.map((entry) => entry.repairFamily)).toEqual([
      'scoreSnapshot_zero_label',
      'mixed_signals_no_template',
      'no_triggered_factor_note',
      'monthly_revenue_missing_note',
    ]);

    const batch = buildRendererRepairPlanBatch([snapshot, { reasonSnapshot: '', factorSnapshot: [] }]);
    expect(batch.map((item) => item.planId)).toEqual(['p28b-plan-1', 'p28b-plan-2']);
    expect(batch[0].inputAlphaScore).toBe(48);
    expect(batch[0].inputBucket).toBe('WATCH');
  });
});
