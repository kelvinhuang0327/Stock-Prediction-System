/**
 * InsightGuardrailLayer — unit tests
 *
 * Tests cover:
 *   1.  computeDecayedConfidence — fresh insight (age≈0) → unchanged
 *   2.  computeDecayedConfidence — at 50% of TTL → confidence × 0.5
 *   3.  computeDecayedConfidence — no createdAt → raw confidence returned
 *   4.  validateInsightEvidence — zero confidence → invalid
 *   5.  validateInsightEvidence — insufficient evidence count → invalid
 *   6.  validateInsightEvidence — valid insight → passes
 *   7.  applyRegimePenalty — regime-independent type → no penalty
 *   8.  applyRegimePenalty — matching regime → no penalty
 *   9.  applyRegimePenalty — mismatching regime → confidence × 0.5
 *   10. applyRegimePenalty — no currentRegime context → always matches
 *   11. detectConflicts — data_quality_issue + indicator_insufficient → REDUNDANT
 *   12. detectConflicts — score_bias + setup_imbalance → CORRELATED
 *   13. detectConflicts — no conflict pairs → []
 *   14. resolveConflicts — REDUNDANT: drops lower-confidence insight
 *   15. resolveConflicts — CORRELATED: downgrades both by 30%
 *   16. computeEstimatedPenalty — sum capped at GUARDRAIL_GLOBAL_CAP
 *   17. runGuardrail — 5 insights, estimated penalty exceeds cap → globalCapReached
 *   18. runGuardrail — low confidence after decay → rejected
 *   19. runGuardrail — regime mismatch → regime penalty may reject insight
 *   20. runGuardrail — conflict resolution inside pipeline → redundant pair resolved
 *   21. runGuardrail — empty input → empty result
 *   22. runGuardrail — validation failure → rejected with reason
 */

import {
  computeDecayedConfidence,
  validateInsightEvidence,
  applyRegimePenalty,
  detectConflicts,
  resolveConflicts,
  computeEstimatedPenalty,
  runGuardrail,
  classifyTier,
  computeGatingDecisions,
  runTieredGuardrail,
  GUARDRAIL_MIN_CONFIDENCE,
  GUARDRAIL_GLOBAL_CAP,
  TIER_SOFT_MAX,
  TIER_STRONG_MAX,
  STRONG_PENALTY_CAP,
  STRONG_SIZING_MULTIPLIER,
  MAX_GATED_SETUP_TYPES,
  type FilteredInsight,
  type GuardrailContext,
} from '../InsightGuardrailLayer';
import type { OptimizationInsightRecord } from '../InsightIntegrationLayer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FUTURE_ISO = new Date(Date.now() + 86400000 * 14).toISOString(); // +14 days

function makeInsight(overrides: Partial<OptimizationInsightRecord> = {}): OptimizationInsightRecord {
  return {
    insightType: 'score_bias',
    sourceTaskId: 'task1',
    evidence: ['Score range: 0.05', 'Sample size: 30'],
    confidence: 0.9,
    severity: 'high',
    affectedSetupTypes: [],
    affectedSymbols: [],
    expiresAt: FUTURE_ISO,
    ...overrides,
  };
}

function makeFilteredInsight(
  overrides: Partial<OptimizationInsightRecord> & { decayedConfidence?: number } = {},
): FilteredInsight {
  const { decayedConfidence = 0.9, ...rest } = overrides;
  return { ...makeInsight(rest), decayedConfidence };
}

// ─── 1–3: computeDecayedConfidence ───────────────────────────────────────────

describe('computeDecayedConfidence', () => {
  it('returns confidence unchanged for a fresh insight (age ≈ 0)', () => {
    const insight = makeInsight({
      confidence: 0.8,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 14).toISOString(),
    });
    const result = computeDecayedConfidence(insight);
    // Age fraction ≈ 0 → decayFactor ≈ 1.0
    expect(result).toBeCloseTo(0.8, 1);
    expect(result).toBeGreaterThan(0.78);
  });

  it('returns confidence × 0.5 when insight is at 50% of its TTL', () => {
    const ttlMs = 14 * 86400000;
    // Created ttlMs/2 ago, expires ttlMs/2 from now → ageRatio = 0.5
    const created = new Date(Date.now() - ttlMs / 2).toISOString();
    const expires = new Date(Date.now() + ttlMs / 2).toISOString();
    const insight = makeInsight({
      confidence: 1.0,
      createdAt: created,
      expiresAt: expires,
    });
    // ageRatio = 0.5 → decayFactor = 0.5^(0.5 × 2) = 0.5^1 = 0.5
    const result = computeDecayedConfidence(insight);
    expect(result).toBeCloseTo(0.5, 2);
  });

  it('returns raw confidence when createdAt is undefined (test fixture)', () => {
    const insight = makeInsight({ confidence: 0.75 });  // no createdAt
    expect(computeDecayedConfidence(insight)).toBe(0.75);
  });
});

// ─── 4–6: validateInsightEvidence ─────────────────────────────────────────────

describe('validateInsightEvidence', () => {
  it('rejects an insight with zero confidence', () => {
    const result = validateInsightEvidence(makeInsight({ confidence: 0 }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('zero_confidence');
  });

  it('rejects a score_bias insight with only 1 evidence string (min=2)', () => {
    const result = validateInsightEvidence(makeInsight({
      insightType: 'score_bias',
      evidence: ['Score range: 0.05'],  // only 1, min=2 for score_bias
    }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('insufficient_evidence');
  });

  it('accepts a data_quality_issue with 1 evidence string (min=1)', () => {
    const result = validateInsightEvidence(makeInsight({
      insightType: 'data_quality_issue',
      evidence: ['Stale quote age: 72h'],
      confidence: 0.8,
    }));
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('accepts a valid score_bias with 2 evidence strings', () => {
    const result = validateInsightEvidence(makeInsight({
      insightType: 'score_bias',
      evidence: ['Score range: 0.05', 'Sample size: 30'],
      confidence: 0.7,
    }));
    expect(result.valid).toBe(true);
  });
});

// ─── 7–10: applyRegimePenalty ─────────────────────────────────────────────────

describe('applyRegimePenalty', () => {
  it('does NOT penalize regime-independent types (data_quality_issue)', () => {
    const insight = makeInsight({ insightType: 'data_quality_issue', regimeContext: 'trending' });
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, 0.9, 'defensive');
    expect(effectiveConf).toBe(0.9);
    expect(regimeMatch).toBe(true);
  });

  it('does NOT penalize when regime matches', () => {
    const insight = makeInsight({ insightType: 'score_bias', regimeContext: 'trending' });
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, 0.8, 'trending');
    expect(effectiveConf).toBe(0.8);
    expect(regimeMatch).toBe(true);
  });

  it('applies 50% penalty when regime-sensitive type mismatches', () => {
    const insight = makeInsight({ insightType: 'sector_misalignment', regimeContext: 'trending' });
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, 0.8, 'defensive');
    expect(effectiveConf).toBeCloseTo(0.4, 5);
    expect(regimeMatch).toBe(false);
  });

  it('always matches when no currentRegime is provided', () => {
    const insight = makeInsight({ insightType: 'score_bias', regimeContext: 'trending' });
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, 0.8, undefined);
    expect(effectiveConf).toBe(0.8);
    expect(regimeMatch).toBe(true);
  });

  it('always matches when insight has no regimeContext tag', () => {
    const insight = makeInsight({ insightType: 'score_bias', regimeContext: undefined });
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, 0.8, 'defensive');
    expect(effectiveConf).toBe(0.8);
    expect(regimeMatch).toBe(true);
  });
});

// ─── 11–13: detectConflicts ───────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('detects REDUNDANT conflict: data_quality_issue + indicator_insufficient', () => {
    const insights: FilteredInsight[] = [
      makeFilteredInsight({ insightType: 'data_quality_issue' }),
      makeFilteredInsight({ insightType: 'indicator_insufficient', evidence: ['3 symbols below threshold'] }),
    ];
    const conflicts = detectConflicts(insights);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe('REDUNDANT');
    expect(conflicts[0].a).toBe('data_quality_issue');
    expect(conflicts[0].b).toBe('indicator_insufficient');
  });

  it('detects CORRELATED conflict: score_bias + setup_imbalance', () => {
    const insights: FilteredInsight[] = [
      makeFilteredInsight({ insightType: 'score_bias' }),
      makeFilteredInsight({ insightType: 'setup_imbalance', evidence: ['trend 95%', '20 trades'] }),
    ];
    const conflicts = detectConflicts(insights);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe('CORRELATED');
  });

  it('returns [] when no conflict pairs exist', () => {
    const insights: FilteredInsight[] = [
      makeFilteredInsight({ insightType: 'score_bias' }),
      makeFilteredInsight({ insightType: 'data_quality_issue', evidence: ['Stale quote age: 72h'] }),
    ];
    // score_bias + data_quality_issue is not a conflict pair
    const conflicts = detectConflicts(insights);
    expect(conflicts).toHaveLength(0);
  });
});

// ─── 14–15: resolveConflicts ──────────────────────────────────────────────────

describe('resolveConflicts', () => {
  it('REDUNDANT: drops the lower-confidence insight', () => {
    const highConf = makeFilteredInsight({ insightType: 'data_quality_issue', decayedConfidence: 0.9, evidence: ['e1'] });
    const lowConf = makeFilteredInsight({ insightType: 'indicator_insufficient', decayedConfidence: 0.65, evidence: ['e2'] });

    const conflicts = detectConflicts([highConf, lowConf]);
    const { resolved, removed } = resolveConflicts([highConf, lowConf], conflicts);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].insightType).toBe('data_quality_issue');  // higher confidence kept
    expect(removed).toHaveLength(1);
    expect(removed[0].insightType).toBe('indicator_insufficient');
  });

  it('CORRELATED: downgrades both by 30% (each × 0.70)', () => {
    const scoreBias = makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 0.9 });
    const setupImb = makeFilteredInsight({ insightType: 'setup_imbalance', decayedConfidence: 0.8, evidence: ['trend 95%', '20 trades'] });

    const conflicts = detectConflicts([scoreBias, setupImb]);
    const { resolved, removed } = resolveConflicts([scoreBias, setupImb], conflicts);

    expect(resolved).toHaveLength(2);
    expect(removed).toHaveLength(0);

    const sb = resolved.find((i) => i.insightType === 'score_bias')!;
    const si = resolved.find((i) => i.insightType === 'setup_imbalance')!;
    expect(sb.decayedConfidence).toBeCloseTo(0.9 * 0.7, 5);
    expect(si.decayedConfidence).toBeCloseTo(0.8 * 0.7, 5);
    expect(sb.guardrailNote).toContain('conflict_downgrade');
  });
});

// ─── 16: computeEstimatedPenalty ─────────────────────────────────────────────

describe('computeEstimatedPenalty', () => {
  it('caps estimated penalty at GUARDRAIL_GLOBAL_CAP (0.25)', () => {
    const insights: FilteredInsight[] = [
      makeFilteredInsight({ insightType: 'data_quality_issue', decayedConfidence: 1.0, evidence: ['e'] }),
      makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 1.0 }),
      makeFilteredInsight({ insightType: 'time_exit_dominance', decayedConfidence: 1.0, evidence: ['60% time exits', '30 trades'] }),
      makeFilteredInsight({ insightType: 'sector_misalignment', decayedConfidence: 1.0, evidence: ['8/10 conflict', 'Conflict rate: 80%'] }),
    ];
    // raw: 0.15 + 0.10 + 0.05 + 0.07 = 0.37 → capped to 0.25
    const { estimatedRawPenalty, estimatedCappedPenalty, globalCapReached } =
      computeEstimatedPenalty(insights);

    expect(estimatedRawPenalty).toBeCloseTo(0.37, 2);
    expect(estimatedCappedPenalty).toBeCloseTo(GUARDRAIL_GLOBAL_CAP, 5);
    expect(globalCapReached).toBe(true);
  });

  it('returns cap-not-reached when total penalty is below cap', () => {
    const insights: FilteredInsight[] = [
      makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 0.7 }),
    ];
    // raw: 0.10 × 0.7 = 0.07 → not capped
    const { estimatedCappedPenalty, globalCapReached } = computeEstimatedPenalty(insights);
    expect(estimatedCappedPenalty).toBeCloseTo(0.07, 5);
    expect(globalCapReached).toBe(false);
  });
});

// ─── 17–22: runGuardrail integration ─────────────────────────────────────────

describe('runGuardrail', () => {
  it('returns empty filtered set when input is empty', () => {
    const result = runGuardrail([]);
    expect(result.filtered).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.log.totalInsights).toBe(0);
    expect(result.log.passedCount).toBe(0);
  });

  it('rejects an insight that fails evidence validation', () => {
    const insight = makeInsight({
      insightType: 'score_bias',
      evidence: [],  // empty — fails min=2 for score_bias
      confidence: 0.9,
    });
    const result = runGuardrail([insight]);
    expect(result.filtered).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('validation_failed');
  });

  it('rejects an insight whose decayed confidence drops below MIN_CONFIDENCE', () => {
    // Artificially create a very old insight (90% of TTL elapsed)
    const ttlMs = 14 * 86400000;
    const ageMs = ttlMs * 0.9;
    const created = new Date(Date.now() - ageMs).toISOString();
    const expires = new Date(Date.now() + ttlMs * 0.1).toISOString();
    const insight = makeInsight({
      confidence: 0.65,   // borderline — after decay at 90% TTL, well below 0.6
      createdAt: created,
      expiresAt: expires,
    });
    // decayFactor = 0.5^(0.9 × 2) = 0.5^1.8 ≈ 0.287 → effectiveConf = 0.65 × 0.287 ≈ 0.187 < 0.6
    const result = runGuardrail([insight]);
    expect(result.filtered).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('low_decayed_confidence');
  });

  it('rejects a regime-sensitive insight when regime mismatches and result < MIN_CONFIDENCE', () => {
    // sector_misalignment is regime-sensitive; mismatch → ×0.5 penalty
    const insight = makeInsight({
      insightType: 'sector_misalignment',
      evidence: ['8/10 conflict', 'Rate: 80%'],
      confidence: 0.7,
      regimeContext: 'trending',
    });
    const context: GuardrailContext = { currentRegime: 'defensive', callerLabel: 'Test' };
    // effectiveConf = 0.7 × 0.5 = 0.35 < 0.6 → rejected
    const result = runGuardrail([insight], context);
    expect(result.filtered).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain('regime_mismatch');
    expect(result.log.perInsight[0].regimeMatch).toBe(false);
  });

  it('passes a regime-sensitive insight when regime matches', () => {
    const insight = makeInsight({
      insightType: 'score_bias',
      evidence: ['Score range: 0.05', 'Sample size: 30'],
      confidence: 0.8,
      regimeContext: 'trending',
    });
    const result = runGuardrail([insight], { currentRegime: 'trending' });
    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].decayedConfidence).toBe(0.8);  // no createdAt → no decay
  });

  it('resolves REDUNDANT conflict pair in the pipeline (data_quality + indicator_insufficient)', () => {
    const dqInsight = makeInsight({
      insightType: 'data_quality_issue',
      evidence: ['Stale quote age: 72h'],
      confidence: 0.9,
    });
    const iiInsight = makeInsight({
      insightType: 'indicator_insufficient',
      evidence: ['3 symbols below threshold'],
      confidence: 0.7,
    });
    const result = runGuardrail([dqInsight, iiInsight]);

    // Both pass individual checks (no decay, no regime issue)
    // Conflict: REDUNDANT → drop indicator_insufficient (lower confidence)
    expect(result.filtered).toHaveLength(1);
    expect(result.filtered[0].insightType).toBe('data_quality_issue');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].resolution).toBe('REDUNDANT');
    expect(result.log.conflictPairsFound).toBe(1);
    expect(result.log.rejectedCount).toBe(1);  // conflict-removed counts as rejected
  });

  it('sets globalCapReached=true when too many high-confidence insights exceed 25% cap', () => {
    const insights = [
      makeInsight({ insightType: 'data_quality_issue', confidence: 1.0, evidence: ['e1'] }),
      makeInsight({ insightType: 'score_bias', confidence: 1.0 }),
      makeInsight({ insightType: 'time_exit_dominance', confidence: 1.0, evidence: ['60% exits', '20 trades'] }),
      makeInsight({ insightType: 'sector_misalignment', confidence: 1.0, evidence: ['8/10', 'Rate: 80%'] }),
    ];
    const result = runGuardrail(insights);
    // No conflict between these 4 types (only score_bias+setup_imbalance and sector+time are pairs)
    // sector_misalignment + time_exit_dominance → CORRELATED → both ×0.7
    // raw: 0.15 + 0.10 + 0.05×0.7 + 0.07×0.7 = 0.15 + 0.10 + 0.035 + 0.049 = 0.334 > 0.25
    expect(result.log.globalCapReached).toBe(true);
    expect(result.log.estimatedCappedPenalty).toBeCloseTo(GUARDRAIL_GLOBAL_CAP, 5);
    expect(result.log.estimatedFinalMultiplier).toBeCloseTo(0.75, 5);
  });

  it('includes full audit log with timestamp, perInsight entries, and callerLabel', () => {
    const insight = makeInsight({ confidence: 0.85 });
    const result = runGuardrail([insight], { callerLabel: 'TestCaller', symbol: 'AAPL' });

    expect(result.log.callerLabel).toBe('TestCaller');
    expect(result.log.symbol).toBe('AAPL');
    expect(result.log.timestamp).toBeTruthy();
    expect(new Date(result.log.timestamp).getFullYear()).toBeGreaterThan(2020);
    expect(result.log.perInsight).toHaveLength(1);
    expect(result.log.perInsight[0].insightType).toBe('score_bias');
    expect(result.log.perInsight[0].originalConfidence).toBe(0.85);
    expect(result.log.perInsight[0].passed).toBe(true);
  });
});

// ─── classifyTier ─────────────────────────────────────────────────────────────

describe('classifyTier', () => {
  it('classifies soft: decayedConfidence in [0.6, 0.75)', () => {
    const ins = makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 0.70 });
    expect(classifyTier(ins)).toBe('soft');
  });

  it('classifies strong: decayedConfidence === TIER_SOFT_MAX (0.75)', () => {
    const ins = makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: TIER_SOFT_MAX });
    expect(classifyTier(ins)).toBe('strong');
  });

  it('classifies strong: decayedConfidence in (0.75, 0.90]', () => {
    const ins = makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 0.85 });
    expect(classifyTier(ins)).toBe('strong');
  });

  it('classifies critical: gateable type + conf > 0.9 + ≥2 evidence', () => {
    const ins = makeFilteredInsight({
      insightType: 'setup_imbalance',
      decayedConfidence: 0.95,
      evidence: ['trend 95%', '20 trades'],
      affectedSetupTypes: ['trend'],
    });
    expect(classifyTier(ins)).toBe('critical');
  });

  it('classifies strong (NOT critical) for non-gateable type even with conf > 0.9', () => {
    // data_quality_issue is not gateable — max tier is strong
    const ins = makeFilteredInsight({
      insightType: 'data_quality_issue',
      decayedConfidence: 0.95,
      evidence: ['Stale 72h'],
    });
    expect(classifyTier(ins)).toBe('strong');
  });

  it('classifies strong (NOT critical) for gateable type with only 1 evidence string', () => {
    // insufficient evidence → cannot reach critical
    const ins = makeFilteredInsight({
      insightType: 'setup_imbalance',
      decayedConfidence: 0.95,
      evidence: ['trend 95%'],
    });
    expect(classifyTier(ins)).toBe('strong');
  });

  it('classifies strong (NOT critical) when conf is exactly TIER_STRONG_MAX (0.9)', () => {
    const ins = makeFilteredInsight({
      insightType: 'sector_misalignment',
      decayedConfidence: TIER_STRONG_MAX,
      evidence: ['8/10 conflict', 'Rate: 80%'],
    });
    expect(classifyTier(ins)).toBe('strong');  // conf must be STRICTLY > 0.9 for critical
  });
});

// ─── computeGatingDecisions ───────────────────────────────────────────────────

describe('computeGatingDecisions', () => {
  it('returns empty array for empty critical list', () => {
    expect(computeGatingDecisions([])).toHaveLength(0);
  });

  it('caps gating at MAX_GATED_SETUP_TYPES when more critical insights exist', () => {
    const criticals = [
      makeFilteredInsight({ insightType: 'setup_imbalance', decayedConfidence: 0.95, evidence: ['e1', 'e2'], affectedSetupTypes: ['trend'] }),
      makeFilteredInsight({ insightType: 'time_exit_dominance', decayedConfidence: 0.92, evidence: ['60% exits', '30 trades'] }),
      makeFilteredInsight({ insightType: 'score_bias', decayedConfidence: 0.91, evidence: ['range: 0.05', 'n=50'] }),
    ];
    const decisions = computeGatingDecisions(criticals);
    expect(decisions.length).toBeLessThanOrEqual(MAX_GATED_SETUP_TYPES);
    // top 2 by confidence: setup_imbalance (0.95) + time_exit_dominance (0.92)
    expect(decisions[0].insight.insightType).toBe('setup_imbalance');
    expect(decisions[1].insight.insightType).toBe('time_exit_dominance');
  });

  it('extracts gatedSetupType from affectedSetupTypes[0]', () => {
    const ins = makeFilteredInsight({
      insightType: 'setup_imbalance',
      decayedConfidence: 0.95,
      evidence: ['e1', 'e2'],
      affectedSetupTypes: ['trend'],
    });
    const [decision] = computeGatingDecisions([ins]);
    expect(decision.gatedSetupType).toBe('trend');
  });

  it('sets gatedSetupType to undefined when affectedSetupTypes is empty (gates all)', () => {
    const ins = makeFilteredInsight({
      insightType: 'sector_misalignment',
      decayedConfidence: 0.95,
      evidence: ['8/10 conflict', 'Rate: 80%'],
    });
    const [decision] = computeGatingDecisions([ins]);
    expect(decision.gatedSetupType).toBeUndefined();
  });

  it('includes non-empty overrideCondition for each decision', () => {
    const ins = makeFilteredInsight({
      insightType: 'time_exit_dominance',
      decayedConfidence: 0.95,
      evidence: ['60% exits', '30 trades'],
    });
    const [decision] = computeGatingDecisions([ins]);
    expect(typeof decision.overrideCondition).toBe('string');
    expect(decision.overrideCondition.length).toBeGreaterThan(10);
  });

  it('includes HARD GATE prefix in reason string', () => {
    const ins = makeFilteredInsight({
      insightType: 'score_bias',
      decayedConfidence: 0.95,
      evidence: ['range: 0.05', 'n=50'],
    });
    const [decision] = computeGatingDecisions([ins]);
    expect(decision.reason).toContain('[HARD GATE]');
    expect(decision.tier).toBe('critical');
  });
});

// ─── runTieredGuardrail ───────────────────────────────────────────────────────

describe('runTieredGuardrail', () => {
  it('classifies soft tier for insight with conf in [0.6, 0.75)', () => {
    const ins = makeInsight({ insightType: 'score_bias', confidence: 0.70 });
    const result = runTieredGuardrail([ins]);
    expect(result.tiers.soft).toHaveLength(1);
    expect(result.tiers.strong).toHaveLength(0);
    expect(result.tiers.critical).toHaveLength(0);
    expect(result.positionSizingMultiplier).toBe(1.0);
    expect(result.strongPenaltyCap).toBe(GUARDRAIL_GLOBAL_CAP);
  });

  it('classifies strong tier + sets positionSizingMultiplier to 0.5', () => {
    const ins = makeInsight({ insightType: 'score_bias', confidence: 0.80 });
    const result = runTieredGuardrail([ins]);
    expect(result.tiers.strong).toHaveLength(1);
    expect(result.tiers.soft).toHaveLength(0);
    expect(result.positionSizingMultiplier).toBe(STRONG_SIZING_MULTIPLIER);
    expect(result.strongPenaltyCap).toBe(STRONG_PENALTY_CAP);
  });

  it('classifies critical tier + generates gatingDecisions for gateable type', () => {
    const ins = makeInsight({
      insightType: 'setup_imbalance',
      confidence: 0.95,
      evidence: ['trend 95%', '20 trades'],
      affectedSetupTypes: ['trend'],
    });
    const result = runTieredGuardrail([ins]);
    expect(result.tiers.critical).toHaveLength(1);
    expect(result.gatingDecisions).toHaveLength(1);
    expect(result.gatingDecisions[0].gatedSetupType).toBe('trend');
    expect(result.gatingDecisions[0].tier).toBe('critical');
  });

  it('does NOT gate non-gateable type (data_quality_issue) even at conf > 0.9', () => {
    const ins = makeInsight({
      insightType: 'data_quality_issue',
      confidence: 0.95,
      evidence: ['Stale: 72h'],
    });
    const result = runTieredGuardrail([ins]);
    expect(result.tiers.critical).toHaveLength(0);
    expect(result.gatingDecisions).toHaveLength(0);
    expect(result.tiers.strong).toHaveLength(1);  // goes to strong, not critical
  });

  it('positionSizingMultiplier is 1.0 when only soft insights exist', () => {
    const ins = makeInsight({ insightType: 'score_bias', confidence: 0.65 });
    const result = runTieredGuardrail([ins]);
    expect(result.positionSizingMultiplier).toBe(1.0);
  });

  it('positionSizingMultiplier is 0.5 when critical insight present', () => {
    const ins = makeInsight({
      insightType: 'setup_imbalance',
      confidence: 0.95,
      evidence: ['trend 95%', '20 trades'],
    });
    const result = runTieredGuardrail([ins]);
    expect(result.positionSizingMultiplier).toBe(STRONG_SIZING_MULTIPLIER);
  });

  it('decay reduces effective confidence, potentially preventing critical classification', () => {
    // Start at conf=0.95 (would be critical), but with 90% decay → effectiveConf ≈ 0.19 → rejected entirely
    const ttlMs = 14 * 86400000;
    const ageMs = ttlMs * 0.9;
    const ins = makeInsight({
      insightType: 'setup_imbalance',
      confidence: 0.95,
      evidence: ['trend 95%', '20 trades'],
      createdAt: new Date(Date.now() - ageMs).toISOString(),
      expiresAt: new Date(Date.now() + ttlMs * 0.1).toISOString(),
    });
    const result = runTieredGuardrail([ins]);
    // decayFactor = 0.5^(0.9×2) ≈ 0.287 → 0.95×0.287 ≈ 0.27 < 0.6 → rejected
    expect(result.tiers.critical).toHaveLength(0);
    expect(result.gatingDecisions).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  it('decay can downgrade critical-tier to strong-tier (conf crosses TIER_STRONG_MAX)', () => {
    // conf = 0.97, at 10% of TTL → decayFactor ≈ 0.5^0.2 ≈ 0.87 → effectiveConf ≈ 0.84 (strong)
    const ttlMs = 14 * 86400000;
    const ageMs = ttlMs * 0.1;
    const ins = makeInsight({
      insightType: 'setup_imbalance',
      confidence: 0.97,
      evidence: ['trend 95%', '20 trades'],
      createdAt: new Date(Date.now() - ageMs).toISOString(),
      expiresAt: new Date(Date.now() + ttlMs * 0.9).toISOString(),
    });
    const result = runTieredGuardrail([ins]);
    // effectiveConf < 0.9 → strong, not critical
    expect(result.tiers.critical).toHaveLength(0);
    expect(result.gatingDecisions).toHaveLength(0);
    expect(result.tiers.strong).toHaveLength(1);
    expect(result.positionSizingMultiplier).toBe(STRONG_SIZING_MULTIPLIER);
  });

  it('preserves existing guardrail base fields (filtered, rejected, conflicts, log)', () => {
    const ins = makeInsight({ insightType: 'score_bias', confidence: 0.70 });
    const result = runTieredGuardrail([ins], { callerLabel: 'TierTest' });
    expect(result.filtered).toBeDefined();
    expect(result.rejected).toBeDefined();
    expect(result.conflicts).toBeDefined();
    expect(result.log.callerLabel).toBe('TierTest');
  });

  it('empty input → all tiers empty, no gating, multiplier 1.0', () => {
    const result = runTieredGuardrail([]);
    expect(result.tiers.soft).toHaveLength(0);
    expect(result.tiers.strong).toHaveLength(0);
    expect(result.tiers.critical).toHaveLength(0);
    expect(result.gatingDecisions).toHaveLength(0);
    expect(result.positionSizingMultiplier).toBe(1.0);
    expect(result.strongPenaltyCap).toBe(GUARDRAIL_GLOBAL_CAP);
  });
});

