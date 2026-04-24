/**
 * Research State Machine — Phase H
 *
 * Formalizes the experiment lifecycle transitions with guard conditions.
 * Determines which transitions are legal and what preconditions must hold.
 *
 * State transitions:
 *   IDEA      → READY     (data prerequisites met)
 *   IDEA      → BLOCKED   (HIGH-priority gap found)
 *   READY     → RUNNING   (execution triggered)
 *   RUNNING   → PARTIAL   (some evidence gathered, insufficient for conclusion)
 *   RUNNING   → VALIDATED (success criteria met)
 *   RUNNING   → REJECTED  (hypothesis falsified)
 *   RUNNING   → BLOCKED   (data became unavailable mid-run)
 *   BLOCKED   → READY     (blockers resolved)
 *   BLOCKED   → IDEA      (blockers changed, needs redesign)
 *   PARTIAL   → RUNNING   (more data collected, re-run)
 *   PARTIAL   → VALIDATED (accumulated evidence sufficient)
 *   PARTIAL   → REJECTED  (accumulated evidence contradicts hypothesis)
 *   ANY       → DEFERRED  (manual deprioritisation)
 *
 * Layer: Research Governance (L4)
 */

import type { ExperimentStatus, EvidenceLevel } from './ExperimentRegistry';

// ─── Transition Definition ───────────────────────────────────────

export interface TransitionGuard {
  from: ExperimentStatus;
  to: ExperimentStatus;
  /** Human-readable condition that must hold for this transition. */
  condition: string;
}

/**
 * All legal transitions in the experiment lifecycle.
 * Transitions not listed here are illegal and will be rejected.
 */
const ALLOWED_TRANSITIONS: TransitionGuard[] = [
  { from: 'IDEA', to: 'READY', condition: 'All requiredData items met via ResearchCoverageEngine' },
  { from: 'IDEA', to: 'BLOCKED', condition: 'HIGH-priority gap found for a linkedGapKey' },
  { from: 'IDEA', to: 'DEFERRED', condition: 'Manual deprioritisation' },
  { from: 'READY', to: 'RUNNING', condition: 'Experiment runner begins execution' },
  { from: 'READY', to: 'BLOCKED', condition: 'Data became unavailable' },
  { from: 'READY', to: 'DEFERRED', condition: 'Manual deprioritisation' },
  { from: 'RUNNING', to: 'PARTIAL', condition: 'Some evidence gathered but insufficient for conclusion' },
  { from: 'RUNNING', to: 'VALIDATED', condition: 'All successCriteria met with sufficient evidence' },
  { from: 'RUNNING', to: 'REJECTED', condition: 'Evidence contradicts hypothesis' },
  { from: 'RUNNING', to: 'BLOCKED', condition: 'Data became unavailable mid-run' },
  { from: 'BLOCKED', to: 'READY', condition: 'All blockers resolved and data prerequisites met' },
  { from: 'BLOCKED', to: 'IDEA', condition: 'Blockers fundamentally changed, needs redesign' },
  { from: 'BLOCKED', to: 'DEFERRED', condition: 'Manual deprioritisation' },
  { from: 'PARTIAL', to: 'RUNNING', condition: 'More data available, re-execution triggered' },
  { from: 'PARTIAL', to: 'VALIDATED', condition: 'Accumulated evidence meets successCriteria' },
  { from: 'PARTIAL', to: 'REJECTED', condition: 'Accumulated evidence contradicts hypothesis' },
  { from: 'PARTIAL', to: 'DEFERRED', condition: 'Manual deprioritisation' },
];

// Build a lookup set for O(1) validation
const TRANSITION_SET = new Set(
  ALLOWED_TRANSITIONS.map((t) => `${t.from}→${t.to}`),
);

// ─── Public API ──────────────────────────────────────────────────

export interface TransitionResult {
  allowed: boolean;
  from: ExperimentStatus;
  to: ExperimentStatus;
  reason: string;
}

/**
 * Check whether a state transition is allowed.
 */
export function isTransitionAllowed(
  from: ExperimentStatus,
  to: ExperimentStatus,
): boolean {
  return TRANSITION_SET.has(`${from}→${to}`);
}

/**
 * Attempt a state transition. Returns the result with a reason.
 */
export function attemptTransition(
  from: ExperimentStatus,
  to: ExperimentStatus,
): TransitionResult {
  const key = `${from}→${to}`;
  const guard = ALLOWED_TRANSITIONS.find((t) => `${t.from}→${t.to}` === key);

  if (!guard) {
    return {
      allowed: false,
      from,
      to,
      reason: `Transition ${from} → ${to} is not allowed in the experiment lifecycle.`,
    };
  }

  return {
    allowed: true,
    from,
    to,
    reason: guard.condition,
  };
}

/**
 * Get all reachable states from a given status.
 */
export function getReachableStates(from: ExperimentStatus): ExperimentStatus[] {
  return ALLOWED_TRANSITIONS
    .filter((t) => t.from === from)
    .map((t) => t.to);
}

/**
 * Determine the appropriate evidence level from experimental metrics.
 */
export function deriveEvidenceLevelFromMetrics(
  sampleSize: number,
  hasSufficientData: boolean,
  consistencyLabel?: string,
): EvidenceLevel {
  if (sampleSize === 0 || !hasSufficientData) return 'NEEDS_DATA';
  if (sampleSize >= 30 && consistencyLabel === 'STABLE') return 'VERIFIED';
  if (sampleSize >= 10) return 'INFERRED';
  return 'NEEDS_DATA';
}

/**
 * Determine post-run experiment status from evaluation results.
 */
export function derivePostRunStatus(params: {
  sampleSize: number;
  hasSufficientData: boolean;
  meetsSuccessCriteria: boolean;
  evidenceContradicts: boolean;
  dataWentUnavailable: boolean;
}): ExperimentStatus {
  const { sampleSize, hasSufficientData, meetsSuccessCriteria, evidenceContradicts, dataWentUnavailable } = params;

  if (dataWentUnavailable) return 'BLOCKED';
  if (!hasSufficientData || sampleSize === 0) return 'PARTIAL';
  if (meetsSuccessCriteria) return 'VALIDATED';
  if (evidenceContradicts) return 'REJECTED';
  return 'PARTIAL';
}
