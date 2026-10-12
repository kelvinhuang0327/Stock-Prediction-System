/**
 * GateRecoveryEngine — recovery mechanism for the multi-tier gate system.
 *
 * Once a setupType is hard-gated by a Tier-3 critical insight, it may remain
 * blocked indefinitely even when market conditions improve. This module provides
 * six recovery mechanisms (all pure, testable, no DB access):
 *
 *   1. Gate TTL Override    — auto-remove gate when insight expires or decays below MIN_CONFIDENCE
 *   2. Probe Mode           — deterministic 8% of gate requests pass as 'shadow' probe trades
 *                             after MIN_PROBE_AGE_DAYS; elevated to 16% after MAX_GATE_DAYS_BEFORE_REEVAL
 *   3. Recovery Signals     — trade-outcome improvements downgrade Tier-3 gates to Tier-2 / Tier-1
 *   4. Max Gate Duration    — gates older than MAX_GATE_DAYS_BEFORE_REEVAL enter elevated-probe phase
 *   5. Gate Diversity Rule  — always exempts ≥1 setup type so the system never reaches 0 active strategies
 *   6. Structured Logging   — emits '[GateRecovery]' JSON for gates, probes, recovery, and diversity events
 *
 * Dependencies: InsightGuardrailLayer (GatingDecision, InsightInfluenceTier, GUARDRAIL_MIN_CONFIDENCE)
 * Callers:
 *   TriggerScoringEngine  — probe check before returning gated=true
 *   DecisionLayerEngine   — diversity rescue when eligible candidate list is empty
 *   StrategyLearningEngine — recovery-signal detection and gate-downgrade logging
 */

import {
  GUARDRAIL_MIN_CONFIDENCE,
  type GatingDecision,
  type InsightInfluenceTier,
} from './InsightGuardrailLayer';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Baseline fraction of gated-setup scoring attempts that pass as probe trades. */
export const PROBE_RATE = 0.08;

/** Elevated probe rate for gates older than MAX_GATE_DAYS_BEFORE_REEVAL. */
export const PROBE_RATE_MATURE = 0.16;

/** Minimum gate age in days before any probes are permitted. */
export const MIN_PROBE_AGE_DAYS = 3;

/**
 * After this many days a gate enters re-evaluation (expired=true, elevated probe rate).
 * The insight itself may still be valid — this forces a fresh probe window.
 */
export const MAX_GATE_DAYS_BEFORE_REEVAL = 7;

/** Position sizing multiplier for probe trades. 25% of normal size. */
export const PROBE_SIZING_MULTIPLIER = 0.25;

/**
 * Recovery score ≥ this → gate downgraded to 'soft' tier (effectively removed).
 * A soft-tier insight imposes a score penalty only; it does not block the setup.
 */
export const RECOVERY_SOFT_THRESHOLD = 0.7;

/**
 * Recovery score ≥ this → gate downgraded to 'strong' tier (penalty, no block).
 * A strong-tier insight doubles coefficient weights and halves sizing, but does not gate.
 */
export const RECOVERY_STRONG_THRESHOLD = 0.4;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecoverySignalType =
  | 'successful_probe'    // a probe trade closed with non-negative PnL
  | 'mfe_improvement'     // max-favorable-excursion improved versus prior baseline
  | 'reduced_time_exit'   // time-exit rate fell below 40% over recent N trades
  | 'regime_change';      // market regime shifted away from the gating regime

export interface RecoverySignal {
  type: RecoverySignalType;
  /** Which setup type this signal applies to; undefined = applies to all gated setups. */
  setupType?: string;
  /** Signal strength, 0.0–1.0. */
  value: number;
  /** Human-readable evidence for this signal. */
  evidence: string;
  /** ISO timestamp when this signal was recorded. */
  recordedAt: string;
}

export interface ProbeDecision {
  /** Gated setup type this probe decision applies to; undefined = global gate. */
  setupType: string | undefined;
  /** Whether this attempt may execute as a probe trade. */
  allowed: boolean;
  /** Probe trades always use shadow mode. */
  tradeMode: 'shadow';
  /** PROBE_SIZING_MULTIPLIER when allowed, 0 when denied. */
  sizingMultiplier: number;
  /**
   * Unique probe tag for audit trail.
   * Format: `probe:<setupType|global>:<symbol>:<YYYY-MM-DD>`
   */
  probeTag: string;
  /** Human-readable reason for this probe decision. */
  reason: string;
}

export interface GateExpiry {
  gate: GatingDecision;
  /** True when gate is expired or in re-evaluation phase. */
  expired: boolean;
  /** Why the gate expired / entered re-evaluation. */
  reason: string;
}

export interface RecoveryDowngrade {
  gate: GatingDecision;
  recoveryScore: number;
  /** New influence tier after downgrade (never 'critical'). */
  newTier: Exclude<InsightInfluenceTier, 'critical'>;
  reason: string;
}

export interface GateDiversityResult {
  /** True if ≥1 setup type remains ungated after all gate decisions. */
  sufficient: boolean;
  /** Setup type that was exempted from gating by diversity rescue (if any). */
  exemptedSetupType?: string;
  /** Human-readable reason for the diversity exemption. */
  exemptionReason?: string;
}

export interface GateRecoveryLog {
  timestamp: string;
  callerLabel?: string;
  totalGates: number;
  expiredCount: number;
  probeCount: number;
  downgradedCount: number;
  activeCount: number;
  diversityEnforced: boolean;
}

export interface GateRecoveryResult {
  originalGates: GatingDecision[];
  /** Gates removed due to TTL expiry, decay, or max gate duration. */
  expiredGates: GateExpiry[];
  /** Probe decisions for gates that survived TTL + recovery checks. */
  probeDecisions: ProbeDecision[];
  /** Gates downgraded to soft/strong by recovery signals. */
  downgradedGates: RecoveryDowngrade[];
  /** Gates still in force after all checks. */
  activeGates: GatingDecision[];
  diversity: GateDiversityResult;
  log: GateRecoveryLog;
}

// ─── 1. Deterministic Probe Hash ─────────────────────────────────────────────

/**
 * FNV-1a 32-bit hash normalized to [0, 1).
 *
 * Deterministic: same `key` always produces the same value.
 * Used to decide probe eligibility without runtime randomness, so probe decisions
 * are reproducible, auditable, and testable.
 *
 * Typical key: `<symbol>:<setupType|global>:<YYYY-MM-DD>`
 */
export function probeHash(key: string): number {
  let h = 2166136261; // FNV-1a 32-bit offset basis (unsigned)
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV prime, maintain unsigned 32-bit
  }
  // Divide by max uint32 to normalize to [0, 1)
  return h / 4294967295;
}

// ─── Gate TTL / Expiry Evaluation ─────────────────────────────────────────────

/**
 * Evaluate whether a gate has expired or entered re-evaluation, based on:
 *   (a) insight past its `expiresAt` timestamp — gate removed immediately
 *   (b) insight's `decayedConfidence` < GUARDRAIL_MIN_CONFIDENCE — gate no longer valid
 *   (c) gate age > MAX_GATE_DAYS_BEFORE_REEVAL — enters elevated-probe re-evaluation phase
 *
 * Reason (c) returns `expired: true` so the gate is excluded from the active set and
 * treated as requiring a fresh probe window rather than hard blocking.
 */
export function evaluateGateTTL(
  gate: GatingDecision,
  now: Date = new Date(),
): GateExpiry {
  const insight = gate.insight;
  const nowMs = now.getTime();

  // (a) Insight has passed its expiry timestamp
  if (new Date(insight.expiresAt).getTime() <= nowMs) {
    return { gate, expired: true, reason: 'insight_expired' };
  }

  // (b) Confidence decayed below the minimum threshold
  if (insight.decayedConfidence < GUARDRAIL_MIN_CONFIDENCE) {
    return {
      gate,
      expired: true,
      reason: `decayed_below_minimum(conf=${insight.decayedConfidence.toFixed(3)}<${GUARDRAIL_MIN_CONFIDENCE})`,
    };
  }

  // (c) Gate is older than MAX_GATE_DAYS_BEFORE_REEVAL — force re-evaluation
  if (insight.createdAt) {
    const ageDays = (nowMs - new Date(insight.createdAt).getTime()) / 86400000;
    if (ageDays > MAX_GATE_DAYS_BEFORE_REEVAL) {
      return {
        gate,
        expired: true,
        reason: `max_gate_duration_exceeded(${ageDays.toFixed(1)}d>${MAX_GATE_DAYS_BEFORE_REEVAL}d)`,
      };
    }
  }

  return { gate, expired: false, reason: 'gate_active' };
}

// ─── Probe Mode ───────────────────────────────────────────────────────────────

/**
 * Deterministically decide whether a scoring attempt should bypass the gate
 * as a 'shadow' probe trade.
 *
 * Probe rules:
 *   - Denied for gates younger than MIN_PROBE_AGE_DAYS (fresh gates are never probed)
 *   - Denied when insight has no `createdAt` (age cannot be determined)
 *   - PROBE_RATE (8%)  for active gates (MIN_PROBE_AGE_DAYS ≤ age ≤ MAX_GATE_DAYS_BEFORE_REEVAL)
 *   - PROBE_RATE_MATURE (16%) for older gates (age > MAX_GATE_DAYS_BEFORE_REEVAL)
 *   - Probe trades always execute as tradeMode='shadow' at PROBE_SIZING_MULTIPLIER position size
 *   - Hash key: `<symbol>:<setupType|global>:<YYYY-MM-DD>` — one probe decision per symbol per day
 */
export function shouldProbe(
  gate: GatingDecision,
  context: { symbol: string; dateStr: string },
  now: Date = new Date(),
): ProbeDecision {
  const setupType = gate.gatedSetupType;
  const label = setupType ?? 'global';

  const denied = (reason: string): ProbeDecision => ({
    setupType,
    allowed: false,
    tradeMode: 'shadow',
    sizingMultiplier: 0,
    probeTag: '',
    reason,
  });

  if (!gate.insight.createdAt) {
    return denied('no_createdAt_cannot_determine_age');
  }

  const ageDays = (now.getTime() - new Date(gate.insight.createdAt).getTime()) / 86400000;

  if (ageDays < MIN_PROBE_AGE_DAYS) {
    return denied(`gate_too_fresh(${ageDays.toFixed(1)}d<${MIN_PROBE_AGE_DAYS}d)`);
  }

  const rate = ageDays > MAX_GATE_DAYS_BEFORE_REEVAL ? PROBE_RATE_MATURE : PROBE_RATE;
  const hashKey = `${context.symbol}:${label}:${context.dateStr}`;
  const hash = probeHash(hashKey);

  if (hash < rate) {
    return {
      setupType,
      allowed: true,
      tradeMode: 'shadow',
      sizingMultiplier: PROBE_SIZING_MULTIPLIER,
      probeTag: `probe:${label}:${context.symbol}:${context.dateStr}`,
      reason: `probe_allowed(rate=${rate},hash=${hash.toFixed(4)})`,
    };
  }

  return denied(`probe_declined(rate=${rate},hash=${hash.toFixed(4)})`);
}

// ─── Recovery Signal Scoring ──────────────────────────────────────────────────

/**
 * Compute a recovery score (0.0–1.0) for a gated setupType from observed signals.
 *
 * Signal weights:
 *   regime_change:      0.40  — regime shift invalidates gate's market assumption
 *   successful_probe:   0.25  — each probe success is strong evidence (capped at 3 probes = 0.75)
 *   mfe_improvement:    0.20  — improving favorable excursion suggests setup validity returning
 *   reduced_time_exit:  0.15  — time exits falling signals better setup execution
 *
 * Thresholds (exported constants):
 *   score ≥ RECOVERY_SOFT_THRESHOLD  (0.7) → downgrade to 'soft' (gate removed)
 *   score ≥ RECOVERY_STRONG_THRESHOLD (0.4) → downgrade to 'strong' (penalty only)
 *   score <  RECOVERY_STRONG_THRESHOLD      → gate remains in force
 */
export function computeRecoveryScore(
  signals: RecoverySignal[],
  setupType?: string,
): number {
  const relevant = signals.filter(
    (s) => s.setupType === undefined || s.setupType === setupType,
  );

  const WEIGHTS: Record<RecoverySignalType, number> = {
    regime_change:     0.40,
    successful_probe:  0.25,
    mfe_improvement:   0.20,
    reduced_time_exit: 0.15,
  };

  let score = 0;

  // Successful probes: each adds 0.25, capped at 3 to prevent flooding recovery
  const successfulProbes = relevant.filter((s) => s.type === 'successful_probe');
  score += Math.min(successfulProbes.length, 3) * WEIGHTS.successful_probe;

  // All other signals: weighted by their value × weight
  for (const sig of relevant) {
    if (sig.type === 'successful_probe') continue;
    score += WEIGHTS[sig.type] * sig.value;
  }

  return Math.min(1.0, score);
}

// ─── Gate Diversity Rule ──────────────────────────────────────────────────────

/**
 * Ensure at least one setup type in `candidateSetupTypes` remains ungated (Diversity Rule).
 *
 * If all candidate setup types are gated (or a global gate is active), exempt the
 * most-frequently-occurring setup type from gating so that ≥1 trading opportunity survives.
 *
 * When `candidateSetupTypes` is empty, diversity is trivially satisfied (no trades possible
 * regardless of gate state).
 *
 * Callers should apply the exempted setup type by re-including those candidates
 * tagged with `diversityRescue: true` in the eligible candidate list.
 */
export function applyGateDiversityRule(
  activeGates: GatingDecision[],
  candidateSetupTypes: string[],
): GateDiversityResult {
  if (candidateSetupTypes.length === 0) {
    return { sufficient: true };
  }

  const gatedTypes = new Set(
    activeGates
      .filter((g) => g.gatedSetupType !== undefined)
      .map((g) => g.gatedSetupType!),
  );
  const hasGlobalGate = activeGates.some((g) => g.gatedSetupType === undefined);

  // If no global gate and at least one candidate type is ungated, diversity is fine
  const ungated = hasGlobalGate
    ? []
    : candidateSetupTypes.filter((t) => !gatedTypes.has(t));

  if (ungated.length > 0) {
    return { sufficient: true };
  }

  // Diversity violation — exempt the most-common setup type as rescue
  const freq = new Map<string, number>();
  for (const t of candidateSetupTypes) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const bestType = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    sufficient: false,
    exemptedSetupType: bestType,
    exemptionReason:
      `diversity_rescue: '${bestType ?? 'none'}' exempted from gating` +
      ` (most-common setup type; ≥1 active strategy required)`,
  };
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/** Emit the gate recovery event log to stdout as structured JSON. */
export function logGateRecoveryEvent(log: GateRecoveryLog): void {
  console.log('[GateRecovery]', JSON.stringify(log));
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Evaluate all recovery mechanisms for a set of active gating decisions.
 *
 * Pipeline (in order):
 *   1. TTL expiry check    — remove expired / decayed / over-duration gates
 *   3. Recovery signals    — downgrade gates that have accumulated sufficient recovery evidence
 *   2. Probe decisions     — compute probe eligibility for gates that survived steps 1 + 3
 *   5. Diversity rule      — ensure ≥1 candidate setup type remains ungated
 *   6. Log                 — emit structured log when any recovery action occurred
 *
 * @param gates               Active GatingDecision[] from runTieredGuardrail().gatingDecisions
 * @param recoverySignals     Signals derived from trade outcomes and regime monitoring
 * @param candidateSetupTypes Setup types present in the current candidate pool (for diversity)
 * @param context             Caller metadata for logging and probe hash key construction
 * @param now                 Timestamp override (inject in tests for deterministic results)
 */
export function evaluateGateRecovery(
  gates: GatingDecision[],
  recoverySignals: RecoverySignal[],
  candidateSetupTypes: string[],
  context: { symbol?: string; dateStr?: string; callerLabel?: string } = {},
  now: Date = new Date(),
): GateRecoveryResult {
  const dateStr = context.dateStr ?? now.toISOString().slice(0, 10);
  const symbol = context.symbol ?? '';

  // ── Step 1: TTL / expiry ────────────────────────────────────────────────────
  const expiryResults = gates.map((g) => evaluateGateTTL(g, now));
  const expiredGates = expiryResults.filter((e) => e.expired);
  const gatesAfterTTL = expiryResults.filter((e) => !e.expired).map((e) => e.gate);

  // ── Step 3: Recovery signal evaluation ─────────────────────────────────────
  const downgradedGates: RecoveryDowngrade[] = [];
  const gatesAfterRecovery: GatingDecision[] = [];

  for (const gate of gatesAfterTTL) {
    const score = computeRecoveryScore(recoverySignals, gate.gatedSetupType);

    if (score >= RECOVERY_SOFT_THRESHOLD) {
      downgradedGates.push({
        gate,
        recoveryScore: score,
        newTier: 'soft',
        reason:
          `recovery_score=${score.toFixed(3)} ≥ ${RECOVERY_SOFT_THRESHOLD}` +
          ` → downgraded to soft tier (gate lifted)`,
      });
    } else if (score >= RECOVERY_STRONG_THRESHOLD) {
      downgradedGates.push({
        gate,
        recoveryScore: score,
        newTier: 'strong',
        reason:
          `recovery_score=${score.toFixed(3)} ≥ ${RECOVERY_STRONG_THRESHOLD}` +
          ` → downgraded to strong tier (penalty only)`,
      });
    } else {
      gatesAfterRecovery.push(gate);
    }
  }

  // ── Step 2: Probe decisions ─────────────────────────────────────────────────
  const probeDecisions = gatesAfterRecovery
    .map((gate) => shouldProbe(gate, { symbol, dateStr }, now))
    .filter((pd) => pd.allowed);

  // ── Step 5: Diversity rule ──────────────────────────────────────────────────
  const diversity = applyGateDiversityRule(gatesAfterRecovery, candidateSetupTypes);

  // ── Step 6: Logging ─────────────────────────────────────────────────────────
  const log: GateRecoveryLog = {
    timestamp: now.toISOString(),
    callerLabel: context.callerLabel,
    totalGates: gates.length,
    expiredCount: expiredGates.length,
    probeCount: probeDecisions.length,
    downgradedCount: downgradedGates.length,
    activeCount: gatesAfterRecovery.length,
    diversityEnforced: !diversity.sufficient,
  };

  if (
    log.expiredCount > 0 ||
    log.probeCount > 0 ||
    log.downgradedCount > 0 ||
    !diversity.sufficient
  ) {
    logGateRecoveryEvent(log);
  }

  return {
    originalGates: gates,
    expiredGates,
    probeDecisions,
    downgradedGates,
    activeGates: gatesAfterRecovery,
    diversity,
    log,
  };
}
