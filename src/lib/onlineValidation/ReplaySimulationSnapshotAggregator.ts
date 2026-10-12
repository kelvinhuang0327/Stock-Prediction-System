/**
 * ReplaySimulationSnapshotAggregator.ts — P5 Online Validation
 *
 * Aggregates simulation snapshot batches into data quality summaries
 * and readiness decisions.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No performance claims — no trading signals
 * - readinessStatus PRODUCTION_READY is forbidden
 * - All guardrails locked to true
 */

import type {
    SimulationSnapshotBatch,
} from './ReplaySimulationSnapshotEngine';

export const READINESS_VERSION = 'sim-readiness-v0';

// ─── Forbidden claim patterns ──────────────────────────────────────

const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i,
    /\bguaranteed\b/i,
    /\bedge confirmed\b/i,
    /\bproduction approved\b/i,
    /\bauto trading\b/i,
    /\bbuy\b/i,
    /\bsell\b/i,
    /\boutperform\b/i,
    /\bexpected_return\b/i,
    /\bstrategy performance\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Types ────────────────────────────────────────────────────────

export type ReadinessStatus =
    | 'READY_FOR_OBSERVABILITY_ONLY_SIMULATION'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface SimulationSnapshotSummary {
    totalSnapshots: number;
    readyCount: number;
    blockedCount: number;
    byHorizon: Record<string, number>;
    byResearchBucket: Record<string, number>;
    bySnapshotStatus: Record<string, number>;
    byBlockedReason: Record<string, number>;
    symbolCount: number;
    outcomeAvailableCount: number;
    missingOutcomeCount: number;
    earliestAsOfDate: string | null;
    latestAsOfDate: string | null;
    earliestTargetTradingDate: string | null;
    latestTargetTradingDate: string | null;
}

export interface SimulationReadinessGuardrails {
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
}

export interface SimulationReadinessDecision {
    readinessVersion: string;
    simulationReady: boolean;
    readinessStatus: ReadinessStatus;
    reasons: string[];
    guardrails: SimulationReadinessGuardrails;
}

export interface ReadinessDecisionOptions {
    minReadyCount?: number;
    requireAllOutcomesAvailable?: boolean;
}

// ─── Exports ──────────────────────────────────────────────────────

/**
 * Produces a data quality summary from a snapshot batch.
 * No performance claims — data coverage only.
 */
export function summarizeSimulationSnapshots(
    batch: SimulationSnapshotBatch,
): SimulationSnapshotSummary {
    const byHorizon: Record<string, number> = {};
    const byResearchBucket: Record<string, number> = {};
    const bySnapshotStatus: Record<string, number> = {};
    const byBlockedReason: Record<string, number> = {};
    const symbolSet = new Set<string>();
    const asOfDates: string[] = [];
    const targetDates: string[] = [];
    let outcomeAvailableCount = 0;
    let missingOutcomeCount = 0;

    for (const s of batch.snapshots) {
        byHorizon[s.horizonLabel] = (byHorizon[s.horizonLabel] ?? 0) + 1;
        byResearchBucket[s.researchBucket] = (byResearchBucket[s.researchBucket] ?? 0) + 1;
        bySnapshotStatus[s.snapshotStatus] = (bySnapshotStatus[s.snapshotStatus] ?? 0) + 1;
        byBlockedReason[s.snapshotBlockedReason] = (byBlockedReason[s.snapshotBlockedReason] ?? 0) + 1;
        symbolSet.add(s.symbol);
        if (s.originalAsOfDate) asOfDates.push(s.originalAsOfDate);
        if (s.targetTradingDate) targetDates.push(s.targetTradingDate);
        if (s.outcomeSnapshot.outcomeAvailable) {
            outcomeAvailableCount++;
        } else {
            missingOutcomeCount++;
        }
    }

    asOfDates.sort();
    targetDates.sort();

    return {
        totalSnapshots: batch.snapshots.length,
        readyCount: batch.snapshotReadyCount,
        blockedCount: batch.snapshotBlockedCount,
        byHorizon,
        byResearchBucket,
        bySnapshotStatus,
        byBlockedReason,
        symbolCount: symbolSet.size,
        outcomeAvailableCount,
        missingOutcomeCount,
        earliestAsOfDate: asOfDates[0] ?? null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] ?? null,
        earliestTargetTradingDate: targetDates[0] ?? null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] ?? null,
    };
}

/**
 * Builds a readiness decision from a summary.
 * READY_FOR_OBSERVABILITY_ONLY_SIMULATION is NOT production-ready.
 */
export function buildSimulationReadinessDecision(
    summary: SimulationSnapshotSummary,
    options: ReadinessDecisionOptions = {},
): SimulationReadinessDecision {
    const minReadyCount = options.minReadyCount ?? 1;
    const requireAllOutcomes = options.requireAllOutcomesAvailable ?? false;

    const guardrails: SimulationReadinessGuardrails = {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
    };

    const reasons: string[] = [];
    let readinessStatus: ReadinessStatus;
    let simulationReady: boolean;

    if (summary.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        simulationReady = false;
        reasons.push(`readyCount=0, minimum required=${minReadyCount}`);
    } else if (requireAllOutcomes && summary.missingOutcomeCount > 0) {
        readinessStatus = 'DATA_LIMITED';
        simulationReady = false;
        reasons.push(`requireAllOutcomesAvailable=true but missingOutcomeCount=${summary.missingOutcomeCount}`);
    } else if (summary.readyCount >= minReadyCount) {
        readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_SIMULATION';
        simulationReady = true;
        reasons.push(`readyCount=${summary.readyCount} >= minReadyCount=${minReadyCount}`);
        reasons.push('Observability-only: no production or simulation writes permitted');
    } else {
        readinessStatus = 'DATA_LIMITED';
        simulationReady = false;
        reasons.push(`readyCount=${summary.readyCount} < minReadyCount=${minReadyCount}`);
    }

    return {
        readinessVersion: READINESS_VERSION,
        simulationReady,
        readinessStatus,
        reasons,
        guardrails,
    };
}

// ─── Validation ───────────────────────────────────────────────────

export interface ReadinessDecisionValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

/**
 * Validates a readiness decision for safety contract compliance.
 */
export function validateSimulationReadinessDecision(
    decision: SimulationReadinessDecision,
): ReadinessDecisionValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (!decision.guardrails.noProductionWrite) {
        messages.push('FAIL: guardrails.noProductionWrite must be true');
        valid = false;
    }
    if (!decision.guardrails.noSimulationWrite) {
        messages.push('FAIL: guardrails.noSimulationWrite must be true');
        valid = false;
    }
    if (!decision.guardrails.noOptimizerWrite) {
        messages.push('FAIL: guardrails.noOptimizerWrite must be true');
        valid = false;
    }
    if (!decision.guardrails.noPerformanceClaim) {
        messages.push('FAIL: guardrails.noPerformanceClaim must be true');
        valid = false;
    }

    // PRODUCTION_READY is forbidden
    if ((decision.readinessStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: readinessStatus PRODUCTION_READY is forbidden');
        valid = false;
    }

    // Validate no forbidden claims in reasons
    const allText = decision.reasons.join(' ');
    if (hasForbiddenClaim(allText)) {
        messages.push('FAIL: forbidden claim in readiness reasons');
        valid = false;
    }

    if (valid) messages.push('PASS: readiness decision safety contracts verified');

    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
