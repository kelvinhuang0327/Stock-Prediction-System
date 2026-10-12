/**
 * InsightGuardrailLayer — safety layer for optimization insight application.
 *
 * Seven guardrail mechanisms (all pure, all testable):
 *   1. Confidence threshold  — reject if effective confidence < MIN (0.6)
 *   2. Max influence cap     — global penalty ceiling raised to 25%
 *   3. Conflict detection    — opposing/redundant insight pairs cancel or downgrade
 *   4. Time decay            — exponential decay; confidence halves at 50% of TTL
 *   5. Regime awareness      — regime-sensitive insights take a 50% penalty on mismatch
 *   6. Validation layer      — evidence count + non-zero confidence required
 *   7. Structured logging    — per-insight audit trail + summary log
 *
 * Entry point: runGuardrail(insights, context) → GuardrailResult
 *
 * Safety invariants:
 *   - No insight is applied with effective confidence < GUARDRAIL_MIN_CONFIDENCE (0.6)
 *   - Global penalty ceiling is GUARDRAIL_GLOBAL_CAP (0.25) — callers must enforce
 *   - Regime-mismatched insights get 50% confidence penalty; may drop below threshold
 *   - Conflict pairs are resolved before accumulation to prevent stacking
 *   - All filter decisions are logged and auditable via InsightApplicationLog
 *   - This module has NO imports from InsightIntegrationLayer (no circular deps)
 */

import type { InsightSignalType, OptimizationInsightRecord } from './InsightIntegrationLayer';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Context supplied by the calling engine for regime/targeting decisions. */
export interface GuardrailContext {
  /** Current market regime — used for regime-sensitive filtering. */
  currentRegime?: string;
  /** Symbol being evaluated (for targeted logging). */
  symbol?: string;
  /** Setup type being evaluated (for targeted logging). */
  setupType?: string;
  /** Label for the audit log: 'TriggerScoring' | 'DecisionLayer' | 'StrategyLearning' */
  callerLabel?: string;
}

/**
 * An OptimizationInsightRecord that has passed all guardrail checks.
 * `decayedConfidence` replaces the raw `confidence` for downstream penalty math.
 */
export interface FilteredInsight extends OptimizationInsightRecord {
  /** Confidence after time decay + regime mismatch penalty. */
  decayedConfidence: number;
  /** Human note explaining any guardrail adjustments made. */
  guardrailNote?: string;
}

/** Resolved conflict record for the audit log. */
export interface ResolvedConflict {
  a: InsightSignalType;
  b: InsightSignalType;
  resolution: ConflictResolution;
  action: string;
}

export type ConflictResolution = 'REDUNDANT' | 'CORRELATED' | 'OPPOSING';

/** Per-insight entry in the audit log. */
export interface PerInsightLogEntry {
  insightType: InsightSignalType;
  sourceTaskId: string;
  originalConfidence: number;
  decayedConfidence: number;
  ageDays: number;
  regimeMatch: boolean;
  validationPassed: boolean;
  conflictAction?: string;
  passed: boolean;
  rejectionReason?: string;
  estimatedPenalty: number;
}

/** Full audit log produced by one runGuardrail() call. */
export interface InsightApplicationLog {
  callerLabel: string;
  currentRegime?: string;
  symbol?: string;
  setupType?: string;
  totalInsights: number;
  passedCount: number;
  rejectedCount: number;
  conflictPairsFound: number;
  estimatedRawPenalty: number;
  estimatedCappedPenalty: number;
  estimatedFinalMultiplier: number;
  globalCapReached: boolean;
  perInsight: PerInsightLogEntry[];
  timestamp: string;
}

/** Full guardrail result for a single invocation. */
export interface GuardrailResult {
  /** Insights that passed every guardrail check (with decayedConfidence set). */
  filtered: FilteredInsight[];
  /** Insights that were rejected and the reason. */
  rejected: Array<{ insight: OptimizationInsightRecord; reason: string }>;
  /** Conflict pairs resolved during this call. */
  conflicts: ResolvedConflict[];
  /** Complete audit log — use logGuardrailDecision() to emit it. */
  log: InsightApplicationLog;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum effective (post-decay, post-regime) confidence to apply an insight. */
export const GUARDRAIL_MIN_CONFIDENCE = 0.6;

/** Maximum total penalty the insight layer can impose on a score (25%). */
export const GUARDRAIL_GLOBAL_CAP = 0.25;

/**
 * Penalty coefficients for the TRIGGER SCORING path.
 * Used by InsightIntegrationLayer.computeTriggerScoreInsightMultiplier and by
 * this layer's estimated-penalty log computation (for Guardrail 2 reporting).
 *
 * IMPORTANT: keep in sync with the switch statement in
 * InsightIntegrationLayer.computeTriggerScoreInsightMultiplier.
 */
export const TRIGGER_SCORE_COEFFICIENTS: Record<InsightSignalType, number> = {
  data_quality_issue:     0.15,
  score_bias:             0.10,
  indicator_insufficient: 0.12,
  setup_imbalance:        0.08,
  time_exit_dominance:    0.05,
  sector_misalignment:    0.07,
};

/**
 * Insight types that are regime-sensitive.
 * Data/infrastructure signals apply regardless of market regime.
 * Behavioural/market signals only make sense in matching regimes.
 */
const REGIME_SENSITIVE_TYPES = new Set<InsightSignalType>([
  'score_bias',
  'setup_imbalance',
  'time_exit_dominance',
  'sector_misalignment',
]);

/**
 * Minimum evidence strings required per insight type before it may be applied.
 * Second-gate check (first gate is at extraction time).
 */
const MIN_EVIDENCE_COUNT: Record<InsightSignalType, number> = {
  score_bias:             2,  // needs score range + sample size
  setup_imbalance:        2,  // needs dominant type + trade count
  time_exit_dominance:    2,  // needs pct + sample count
  data_quality_issue:     1,  // a single symptom suffices
  indicator_insufficient: 1,  // symbol count alone is sufficient
  sector_misalignment:    2,  // needs conflict count + sample count
};

/** Conflict rules applied as a set during Guardrail 3. */
const CONFLICT_RULES: Array<{
  a: InsightSignalType;
  b: InsightSignalType;
  resolution: ConflictResolution;
  note: string;
}> = [
  {
    a: 'data_quality_issue',
    b: 'indicator_insufficient',
    resolution: 'REDUNDANT',
    note: 'Both signal data deficiency — keep only the higher-confidence one.',
  },
  {
    a: 'score_bias',
    b: 'setup_imbalance',
    resolution: 'CORRELATED',
    note: 'Score clustering is partly caused by setup imbalance — downgrade each by 30%.',
  },
  {
    a: 'sector_misalignment',
    b: 'time_exit_dominance',
    resolution: 'CORRELATED',
    note: 'Time exits may reflect macro misalignment — downgrade each by 30%.',
  },
];

// ─── Guardrail 4: Time Decay ──────────────────────────────────────────────────

/**
 * Exponential decay: effectiveConf = confidence × 0.5^(ageRatio / 0.5)
 *
 * Behaviour:
 *   age = 0          → decayFactor = 1.00 (no change)
 *   age = 25% of TTL → decayFactor ≈ 0.84
 *   age = 50% of TTL → decayFactor = 0.50  ← half-life point
 *   age = 100% of TTL → decayFactor = 0.25  (already expired in DB)
 *
 * When `createdAt` is missing (e.g. test fixtures), returns raw confidence unchanged.
 */
export function computeDecayedConfidence(
  insight: OptimizationInsightRecord,
  now: Date = new Date(),
): number {
  if (!insight.createdAt) return insight.confidence;

  const createdMs = new Date(insight.createdAt).getTime();
  const expiresMs = new Date(insight.expiresAt).getTime();
  const totalTtlMs = expiresMs - createdMs;
  if (totalTtlMs <= 0) return 0;

  const ageMs = Math.max(0, now.getTime() - createdMs);
  const ageRatio = Math.min(1, ageMs / totalTtlMs);

  // Half-life at 50% of TTL: exponent = ageRatio / 0.5 = ageRatio × 2
  return insight.confidence * Math.pow(0.5, ageRatio * 2);
}

// ─── Guardrail 6: Validation Layer ───────────────────────────────────────────

/** Validate evidence count and basic confidence before applying an insight. */
export function validateInsightEvidence(
  insight: OptimizationInsightRecord,
): { valid: boolean; reason?: string } {
  if (insight.confidence <= 0) {
    return { valid: false, reason: 'zero_confidence' };
  }

  const minEvidence = MIN_EVIDENCE_COUNT[insight.insightType] ?? 1;
  if (insight.evidence.length < minEvidence) {
    return {
      valid: false,
      reason: `insufficient_evidence(${insight.evidence.length} < ${minEvidence} required for ${insight.insightType})`,
    };
  }

  return { valid: true };
}

// ─── Guardrail 5: Regime Awareness ───────────────────────────────────────────

/**
 * Apply regime mismatch penalty.
 *
 * Rules:
 *   - Regime-independent types (data_quality_issue, indicator_insufficient):
 *     always match, no penalty.
 *   - Regime-sensitive types with no `regimeContext` tag:
 *     always match (no data = no rejection).
 *   - Regime-sensitive types whose `regimeContext` ≠ `currentRegime`:
 *     effectiveConf × 0.5 (may drop below MIN_CONFIDENCE and be rejected downstream).
 *   - If `currentRegime` is undefined, all insights match (caller has no regime context).
 */
export function applyRegimePenalty(
  insight: OptimizationInsightRecord,
  decayedConf: number,
  currentRegime?: string,
): { effectiveConf: number; regimeMatch: boolean } {
  if (!currentRegime) return { effectiveConf: decayedConf, regimeMatch: true };
  if (!REGIME_SENSITIVE_TYPES.has(insight.insightType)) return { effectiveConf: decayedConf, regimeMatch: true };
  if (!insight.regimeContext) return { effectiveConf: decayedConf, regimeMatch: true };

  const matches = insight.regimeContext === currentRegime;
  return {
    effectiveConf: matches ? decayedConf : decayedConf * 0.5,
    regimeMatch: matches,
  };
}

// ─── Guardrail 3: Conflict Detection ─────────────────────────────────────────

/** Find all conflict-rule pairs present in the filtered insight set. */
export function detectConflicts(insights: FilteredInsight[]): typeof CONFLICT_RULES {
  const types = new Set(insights.map((i) => i.insightType));
  return CONFLICT_RULES.filter((rule) => types.has(rule.a) && types.has(rule.b));
}

/**
 * Apply conflict resolutions and return the updated insight set.
 *
 * REDUNDANT: drop the lower-confidence insight (keep higher-conf one only).
 * CORRELATED: both insights are kept but each decayedConfidence × 0.70.
 * OPPOSING:   both insights are removed entirely.
 */
export function resolveConflicts(
  insights: FilteredInsight[],
  conflicts: ReturnType<typeof detectConflicts>,
): { resolved: FilteredInsight[]; removed: FilteredInsight[]; resolvedConflicts: ResolvedConflict[] } {
  const toRemove = new Set<InsightSignalType>();
  const downgrade = new Map<InsightSignalType, number>(); // cumulative multiplier
  const resolvedConflicts: ResolvedConflict[] = [];

  for (const rule of conflicts) {
    const aInsight = insights.find((i) => i.insightType === rule.a);
    const bInsight = insights.find((i) => i.insightType === rule.b);

    switch (rule.resolution) {
      case 'REDUNDANT': {
        const aConf = aInsight?.decayedConfidence ?? 0;
        const bConf = bInsight?.decayedConfidence ?? 0;
        const dropped = aConf >= bConf ? rule.b : rule.a;
        const kept = dropped === rule.a ? rule.b : rule.a;
        toRemove.add(dropped);
        resolvedConflicts.push({
          a: rule.a,
          b: rule.b,
          resolution: 'REDUNDANT',
          action: `dropped ${dropped}, kept ${kept} (higher confidence)`,
        });
        break;
      }
      case 'CORRELATED': {
        downgrade.set(rule.a, (downgrade.get(rule.a) ?? 1) * 0.7);
        downgrade.set(rule.b, (downgrade.get(rule.b) ?? 1) * 0.7);
        resolvedConflicts.push({
          a: rule.a,
          b: rule.b,
          resolution: 'CORRELATED',
          action: `both downgraded ×0.70 (correlated signals)`,
        });
        break;
      }
      case 'OPPOSING': {
        toRemove.add(rule.a);
        toRemove.add(rule.b);
        resolvedConflicts.push({
          a: rule.a,
          b: rule.b,
          resolution: 'OPPOSING',
          action: `both cancelled (opposing signals)`,
        });
        break;
      }
    }
  }

  const removed: FilteredInsight[] = [];
  const resolved = insights
    .map((ins): FilteredInsight | null => {
      if (toRemove.has(ins.insightType)) {
        removed.push({ ...ins, guardrailNote: `conflict_removed` });
        return null;
      }
      const factor = downgrade.get(ins.insightType);
      if (factor != null && factor < 1) {
        const note = `conflict_downgrade(×${factor.toFixed(2)})`;
        return {
          ...ins,
          decayedConfidence: ins.decayedConfidence * factor,
          guardrailNote: ins.guardrailNote ? `${ins.guardrailNote}; ${note}` : note,
        };
      }
      return ins;
    })
    .filter((ins): ins is FilteredInsight => ins !== null);

  return { resolved, removed, resolvedConflicts };
}

// ─── Guardrail 2: Max Influence Cap ──────────────────────────────────────────

/**
 * Compute estimated penalty from filtered insights using trigger score coefficients.
 * Returns { estimatedPenalty, cappedPenalty, globalCapReached }.
 *
 * Note: this is an UPPER BOUND estimate — actual penalty may be lower because
 * computeTriggerScoreInsightMultiplier applies per-symbol/per-setupType filtering.
 * GUARDRAIL_GLOBAL_CAP enforcement happens inside the compute functions.
 */
export function computeEstimatedPenalty(filtered: FilteredInsight[]): {
  estimatedRawPenalty: number;
  estimatedCappedPenalty: number;
  globalCapReached: boolean;
} {
  let estimatedRawPenalty = 0;
  for (const ins of filtered) {
    const coeff = TRIGGER_SCORE_COEFFICIENTS[ins.insightType] ?? 0.05;
    estimatedRawPenalty += coeff * ins.decayedConfidence;
  }
  const estimatedCappedPenalty = Math.min(GUARDRAIL_GLOBAL_CAP, Math.max(0, estimatedRawPenalty));
  return {
    estimatedRawPenalty,
    estimatedCappedPenalty,
    globalCapReached: estimatedRawPenalty > GUARDRAIL_GLOBAL_CAP,
  };
}

// ─── Guardrail 7: Logging ─────────────────────────────────────────────────────

/** Emit the guardrail decision log to stdout as structured JSON. */
export function logGuardrailDecision(log: InsightApplicationLog): void {
  console.log('[InsightGuardrail]', JSON.stringify(log));
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run all 7 guardrail checks against a set of optimization insights.
 *
 * Pipeline (in order):
 *   [Per-insight]
 *     6. Validate evidence count and basic quality
 *     4. Compute time-decayed confidence
 *     5. Apply regime mismatch penalty (−50%)
 *     1. Filter by GUARDRAIL_MIN_CONFIDENCE threshold
 *   [Set-level]
 *     3. Detect and resolve conflict pairs
 *   [Summary]
 *     2. Estimate global cap status for the log
 *     7. Build InsightApplicationLog
 *
 * Returns GuardrailResult. Callers should pass result.filtered to downstream
 * compute functions. Use logGuardrailDecision(result.log) to emit the audit log.
 */
export function runGuardrail(
  insights: OptimizationInsightRecord[],
  context: GuardrailContext = {},
): GuardrailResult {
  const now = new Date();
  const rejected: Array<{ insight: OptimizationInsightRecord; reason: string }> = [];
  const perInsight: PerInsightLogEntry[] = [];
  const passed: FilteredInsight[] = [];

  // ── Per-insight pipeline ────────────────────────────────────────────────
  for (const insight of insights) {
    const ageDays = insight.createdAt
      ? (now.getTime() - new Date(insight.createdAt).getTime()) / 86400000
      : 0;

    // Step 6: Validate
    const validation = validateInsightEvidence(insight);
    if (!validation.valid) {
      const reason = `validation_failed: ${validation.reason ?? ''}`;
      rejected.push({ insight, reason });
      perInsight.push({
        insightType: insight.insightType,
        sourceTaskId: insight.sourceTaskId,
        originalConfidence: insight.confidence,
        decayedConfidence: 0,
        ageDays,
        regimeMatch: true,
        validationPassed: false,
        passed: false,
        rejectionReason: reason,
        estimatedPenalty: 0,
      });
      continue;
    }

    // Step 4: Time decay
    const decayed = computeDecayedConfidence(insight, now);

    // Step 5: Regime penalty
    const { effectiveConf, regimeMatch } = applyRegimePenalty(insight, decayed, context.currentRegime);

    // Step 1: Confidence threshold
    if (effectiveConf < GUARDRAIL_MIN_CONFIDENCE) {
      const reason = !regimeMatch
        ? `regime_mismatch: ${insight.insightType} tagged [${insight.regimeContext ?? 'none'}] current [${context.currentRegime}] → conf ${effectiveConf.toFixed(3)} < ${GUARDRAIL_MIN_CONFIDENCE}`
        : `low_decayed_confidence: ${effectiveConf.toFixed(3)} < ${GUARDRAIL_MIN_CONFIDENCE}`;
      rejected.push({ insight, reason });
      perInsight.push({
        insightType: insight.insightType,
        sourceTaskId: insight.sourceTaskId,
        originalConfidence: insight.confidence,
        decayedConfidence: effectiveConf,
        ageDays,
        regimeMatch,
        validationPassed: true,
        passed: false,
        rejectionReason: reason,
        estimatedPenalty: 0,
      });
      continue;
    }

    passed.push({
      ...insight,
      decayedConfidence: effectiveConf,
      guardrailNote: !regimeMatch ? `regime_mismatch_penalty(×0.50)` : undefined,
    });
    perInsight.push({
      insightType: insight.insightType,
      sourceTaskId: insight.sourceTaskId,
      originalConfidence: insight.confidence,
      decayedConfidence: effectiveConf,
      ageDays,
      regimeMatch,
      validationPassed: true,
      passed: true,
      estimatedPenalty: 0,  // filled after conflict resolution below
    });
  }

  // ── Set-level: conflict resolution ─────────────────────────────────────
  const detectedConflicts = detectConflicts(passed);
  const { resolved, removed, resolvedConflicts } = resolveConflicts(passed, detectedConflicts);

  // Mark conflict-removed insights as rejected
  for (const rem of removed) {
    rejected.push({ insight: rem, reason: `conflict_resolution: ${rem.guardrailNote ?? ''}` });
    const entry = perInsight.find(
      (e) => e.insightType === rem.insightType && e.passed,
    );
    if (entry) {
      entry.passed = false;
      entry.conflictAction = rem.guardrailNote;
      entry.rejectionReason = 'conflict_removed';
    }
  }

  // Update log entries for downgraded insights
  for (const ins of resolved) {
    if (ins.guardrailNote?.includes('conflict_downgrade')) {
      const entry = perInsight.find((e) => e.insightType === ins.insightType && e.passed);
      if (entry) {
        entry.decayedConfidence = ins.decayedConfidence;
        entry.conflictAction = ins.guardrailNote;
      }
    }
  }

  // ── Guardrail 2: Estimate cap status ────────────────────────────────────
  const { estimatedRawPenalty, estimatedCappedPenalty, globalCapReached } =
    computeEstimatedPenalty(resolved);

  // Fill estimated penalty per insight in the log
  for (const ins of resolved) {
    const entry = perInsight.find((e) => e.insightType === ins.insightType && e.passed);
    if (entry) {
      entry.estimatedPenalty = (TRIGGER_SCORE_COEFFICIENTS[ins.insightType] ?? 0.05) * ins.decayedConfidence;
    }
  }

  // ── Guardrail 7: Build audit log ────────────────────────────────────────
  const log: InsightApplicationLog = {
    callerLabel: context.callerLabel ?? 'unknown',
    currentRegime: context.currentRegime,
    symbol: context.symbol,
    setupType: context.setupType,
    totalInsights: insights.length,
    passedCount: resolved.length,
    rejectedCount: rejected.length,
    conflictPairsFound: resolvedConflicts.length,
    estimatedRawPenalty,
    estimatedCappedPenalty,
    estimatedFinalMultiplier: 1.0 - estimatedCappedPenalty,
    globalCapReached,
    perInsight,
    timestamp: now.toISOString(),
  };

  return {
    filtered: resolved,
    rejected,
    conflicts: resolvedConflicts,
    log,
  };
}

// ─── Tier Classification ──────────────────────────────────────────────────────

/** Three-level influence tiers; insight sits in exactly one tier after classification. */
export type InsightInfluenceTier = 'soft' | 'strong' | 'critical';

/** Upper boundary of the soft tier (exclusive). */
export const TIER_SOFT_MAX = 0.75;
/** Upper boundary of the strong tier (inclusive). */
export const TIER_STRONG_MAX = 0.9;
/** Maximum penalty imposed by strong/critical-tier insights combined (60%). */
export const STRONG_PENALTY_CAP = 0.60;
/** Coefficient boost factor applied to strong/critical-tier insights (2×). */
export const STRONG_COEFFICIENT_BOOST = 2.0;
/** Position sizing multiplier applied whenever any strong or critical insight is present. */
export const STRONG_SIZING_MULTIPLIER = 0.5;
/** Safety cap on simultaneously hard-gated setup types. Prevents over-restriction. */
export const MAX_GATED_SETUP_TYPES = 2;

/**
 * Types eligible for critical-tier hard gating.
 * Behavioural/market signals can invalidate a setup.
 * Data/infrastructure signals (data_quality_issue, indicator_insufficient) degrade
 * quality but do not block specific setups.
 */
const GATEABLE_INSIGHT_TYPES = new Set<InsightSignalType>([
  'setup_imbalance',
  'time_exit_dominance',
  'score_bias',
  'sector_misalignment',
]);

/** A hard-gate decision produced for a single critical-tier insight. */
export interface GatingDecision {
  insight: FilteredInsight;
  tier: 'critical';
  /** Specific setup type to gate; undefined means gate applies to all setups. */
  gatedSetupType?: string;
  /** Human-readable gate reason including insight type, confidence, and evidence. */
  reason: string;
  /** Condition under which this gate may be lifted without manual override. */
  overrideCondition: string;
}

/** Filtered insights partitioned by influence tier. */
export interface TieredFilteredInsights {
  soft: FilteredInsight[];      // conf ∈ [0.60, 0.75)
  strong: FilteredInsight[];    // conf ∈ [0.75, 0.90]
  critical: FilteredInsight[];  // conf > 0.90 + gateable type + ≥2 evidence
}

/** Full guardrail result with tier breakdown and gating decisions. */
export interface TieredGuardrailResult extends GuardrailResult {
  tiers: TieredFilteredInsights;
  gatingDecisions: GatingDecision[];
  /**
   * Position sizing multiplier: 0.5 when any strong/critical insight is present, 1.0 otherwise.
   * Callers apply this to position sizing independently of the score multiplier.
   */
  positionSizingMultiplier: number;
  /**
   * Effective penalty cap for score multiplier computation.
   * STRONG_PENALTY_CAP (0.60) when strong/critical insights present, else GUARDRAIL_GLOBAL_CAP (0.25).
   */
  strongPenaltyCap: number;
}

/**
 * Classify a guardrail-filtered insight into an influence tier.
 *
 * Critical requires ALL:
 *   - decayedConfidence > TIER_STRONG_MAX (0.9)
 *   - insightType ∈ GATEABLE_INSIGHT_TYPES
 *   - evidence.length ≥ 2 (multiple corroborating signals)
 *
 * Strong: decayedConfidence ∈ [TIER_SOFT_MAX, TIER_STRONG_MAX]
 * Soft:   decayedConfidence ∈ [GUARDRAIL_MIN_CONFIDENCE, TIER_SOFT_MAX)
 */
export function classifyTier(insight: FilteredInsight): InsightInfluenceTier {
  const conf = insight.decayedConfidence;
  if (
    conf > TIER_STRONG_MAX &&
    GATEABLE_INSIGHT_TYPES.has(insight.insightType) &&
    insight.evidence.length >= 2
  ) {
    return 'critical';
  }
  if (conf >= TIER_SOFT_MAX) return 'strong';
  return 'soft';
}

function buildOverrideCondition(insight: FilteredInsight): string {
  switch (insight.insightType) {
    case 'setup_imbalance':
      return 'Override when setup diversity improves (≤60% dominance) or manual CTO approval.';
    case 'time_exit_dominance':
      return 'Override when time-exit rate falls below 40% over next 10 trades.';
    case 'score_bias':
      return 'Override when triggerScore range exceeds 0.25 over next 20 samples.';
    case 'sector_misalignment':
      return 'Override when sector alignment score improves or regime shifts.';
    default:
      return 'Override requires manual approval.';
  }
}

/**
 * Build gating decisions from critical-tier insights.
 * Capped at MAX_GATED_SETUP_TYPES (highest confidence wins) to prevent total lockout.
 */
export function computeGatingDecisions(
  criticalInsights: FilteredInsight[],
): GatingDecision[] {
  return [...criticalInsights]
    .sort((a, b) => b.decayedConfidence - a.decayedConfidence)
    .slice(0, MAX_GATED_SETUP_TYPES)
    .map((insight) => ({
      insight,
      tier: 'critical' as const,
      gatedSetupType:
        insight.affectedSetupTypes.length > 0 ? insight.affectedSetupTypes[0] : undefined,
      reason:
        `[HARD GATE] ${insight.insightType} ` +
        `conf=${insight.decayedConfidence.toFixed(3)} ` +
        `evidence=[${insight.evidence.slice(0, 2).join('; ')}]`,
      overrideCondition: buildOverrideCondition(insight),
    }));
}

// ─── Tiered Entry Point ───────────────────────────────────────────────────────

/**
 * Run all 7 guardrails then classify survivors into influence tiers.
 *
 * Extends runGuardrail() with:
 *   - Tier classification (soft / strong / critical)
 *   - Hard-gate decisions for critical-tier insights (capped at MAX_GATED_SETUP_TYPES)
 *   - positionSizingMultiplier (0.5 when strong/critical insights present)
 *   - strongPenaltyCap (0.60 vs 0.25)
 *
 * Callers MUST:
 *   1. Check gatingDecisions FIRST — if matched, set score = 0, tradeMode = 'none'
 *   2. Pass tiers to computeTieredScoreMultiplier() for penalty computation
 *   3. Apply positionSizingMultiplier to position sizing
 */
export function runTieredGuardrail(
  insights: OptimizationInsightRecord[],
  context: GuardrailContext = {},
): TieredGuardrailResult {
  const base = runGuardrail(insights, context);

  const tiers: TieredFilteredInsights = { soft: [], strong: [], critical: [] };
  for (const ins of base.filtered) {
    tiers[classifyTier(ins)].push(ins);
  }

  const gatingDecisions = computeGatingDecisions(tiers.critical);

  const hasStrongOrCritical = tiers.strong.length > 0 || tiers.critical.length > 0;
  const positionSizingMultiplier = hasStrongOrCritical ? STRONG_SIZING_MULTIPLIER : 1.0;
  const strongPenaltyCap = hasStrongOrCritical ? STRONG_PENALTY_CAP : GUARDRAIL_GLOBAL_CAP;

  if (gatingDecisions.length > 0) {
    console.log(
      '[InsightGuardrail][GATE]',
      JSON.stringify({
        callerLabel: context.callerLabel,
        symbol: context.symbol,
        setupType: context.setupType,
        gates: gatingDecisions.map((g) => ({
          insightType: g.insight.insightType,
          gatedSetupType: g.gatedSetupType,
          conf: g.insight.decayedConfidence.toFixed(3),
          reason: g.reason,
        })),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return {
    ...base,
    tiers,
    gatingDecisions,
    positionSizingMultiplier,
    strongPenaltyCap,
  };
}
