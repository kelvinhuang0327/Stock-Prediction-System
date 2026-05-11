/**
 * SimulationSnapshotCorpusSummary.ts — P6 Online Validation
 *
 * Summarizes a corpus of simulation snapshots and produces a
 * corpus-level readiness decision.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No performance claims — no trading signals
 * - PRODUCTION_READY readinessStatus is forbidden
 * - All guardrails locked to true
 */

import type { CorpusEntry } from './SimulationSnapshotCorpusAccumulator';

export const CORPUS_READINESS_VERSION = 'corpus-readiness-v0';

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

export type CorpusReadinessStatus =
    | 'READY_FOR_OBSERVABILITY_ONLY_CORPUS'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface CorpusSummary {
    corpusVersion: string;
    totalEntries: number;
    readyCount: number;
    blockedCount: number;
    uniqueSimulationRunCount: number;
    uniqueAsOfDateCount: number;
    uniqueSymbolCount: number;
    byAsOfDate: Record<string, number>;
    bySymbol: Record<string, number>;
    byHorizon: Record<string, number>;
    byResearchBucket: Record<string, number>;
    bySnapshotStatus: Record<string, number>;
    byBlockedReason: Record<string, number>;
    outcomeAvailableCount: number;
    missingOutcomeCount: number;
    earliestAsOfDate: string | null;
    latestAsOfDate: string | null;
    earliestTargetTradingDate: string | null;
    latestTargetTradingDate: string | null;
    coverageRatio: number;
}

export interface CorpusReadinessGuardrails {
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
}

export interface CorpusReadinessDecision {
    readinessVersion: string;
    corpusReady: boolean;
    readinessStatus: CorpusReadinessStatus;
    reasons: string[];
    guardrails: CorpusReadinessGuardrails;
}

export interface CorpusReadinessOptions {
    minReadyCount?: number;
    minUniqueAsOfDateCount?: number;
    minUniqueSymbolCount?: number;
    minCoverageRatio?: number;
    requireNoMissingOutcome?: boolean;
}

export interface CorpusReadinessValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Exports ──────────────────────────────────────────────────────

/**
 * Produces a data quality summary of the corpus.
 * No performance claims — coverage and data quality only.
 */
export function summarizeSnapshotCorpus(corpusEntries: CorpusEntry[]): CorpusSummary {
    const byAsOfDate: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};
    const byHorizon: Record<string, number> = {};
    const byResearchBucket: Record<string, number> = {};
    const bySnapshotStatus: Record<string, number> = {};
    const byBlockedReason: Record<string, number> = {};
    const simulationRunIds = new Set<string>();
    const asOfDates: string[] = [];
    const targetDates: string[] = [];
    let readyCount = 0;
    let blockedCount = 0;
    let outcomeAvailableCount = 0;
    let missingOutcomeCount = 0;
    let corpusVersion = '';

    for (const e of corpusEntries) {
        if (!corpusVersion) corpusVersion = e.corpusVersion;
        simulationRunIds.add(e.sourceSimulationRunId);

        byAsOfDate[e.originalAsOfDate] = (byAsOfDate[e.originalAsOfDate] ?? 0) + 1;
        bySymbol[e.symbol] = (bySymbol[e.symbol] ?? 0) + 1;
        byHorizon[e.horizonLabel] = (byHorizon[e.horizonLabel] ?? 0) + 1;
        byResearchBucket[e.researchBucket] = (byResearchBucket[e.researchBucket] ?? 0) + 1;
        bySnapshotStatus[e.snapshotStatus] = (bySnapshotStatus[e.snapshotStatus] ?? 0) + 1;
        byBlockedReason[e.snapshotBlockedReason] = (byBlockedReason[e.snapshotBlockedReason] ?? 0) + 1;

        if (e.snapshotStatus === 'SNAPSHOT_READY') {
            readyCount++;
        } else {
            blockedCount++;
        }

        const os = e.outcomeSnapshot as Record<string, unknown> | null;
        if (os?.['outcomeAvailable'] === true) {
            outcomeAvailableCount++;
        } else {
            missingOutcomeCount++;
        }

        if (e.originalAsOfDate) asOfDates.push(e.originalAsOfDate);
        if (e.targetTradingDate) targetDates.push(e.targetTradingDate);
    }

    asOfDates.sort();
    targetDates.sort();

    const totalEntries = corpusEntries.length;
    const coverageRatio = totalEntries > 0 ? readyCount / totalEntries : 0;

    return {
        corpusVersion: corpusVersion || 'sim-corpus-v0',
        totalEntries,
        readyCount,
        blockedCount,
        uniqueSimulationRunCount: simulationRunIds.size,
        uniqueAsOfDateCount: Object.keys(byAsOfDate).length,
        uniqueSymbolCount: Object.keys(bySymbol).length,
        byAsOfDate,
        bySymbol,
        byHorizon,
        byResearchBucket,
        bySnapshotStatus,
        byBlockedReason,
        outcomeAvailableCount,
        missingOutcomeCount,
        earliestAsOfDate: asOfDates[0] ?? null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] ?? null,
        earliestTargetTradingDate: targetDates[0] ?? null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] ?? null,
        coverageRatio,
    };
}

/**
 * Builds a corpus readiness decision.
 * READY_FOR_OBSERVABILITY_ONLY_CORPUS is NOT production-ready.
 */
export function buildCorpusReadinessDecision(
    summary: CorpusSummary,
    options: CorpusReadinessOptions = {},
): CorpusReadinessDecision {
    const minReadyCount = options.minReadyCount ?? 3;
    const minUniqueAsOfDateCount = options.minUniqueAsOfDateCount ?? 1;
    const minUniqueSymbolCount = options.minUniqueSymbolCount ?? 2;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;
    const requireNoMissingOutcome = options.requireNoMissingOutcome ?? false;

    const guardrails: CorpusReadinessGuardrails = {
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    const reasons: string[] = [];
    let corpusReady = false;
    let readinessStatus: CorpusReadinessStatus;

    if (summary.totalEntries === 0 || summary.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        corpusReady = false;
        reasons.push(`readyCount=${summary.readyCount} or totalEntries=${summary.totalEntries} => BLOCKED`);
    } else if (requireNoMissingOutcome && summary.missingOutcomeCount > 0) {
        readinessStatus = 'DATA_LIMITED';
        corpusReady = false;
        reasons.push(`requireNoMissingOutcome=true but missingOutcomeCount=${summary.missingOutcomeCount}`);
    } else {
        // Check all thresholds
        const thresholdMessages: string[] = [];
        let thresholdsMet = true;

        if (summary.readyCount < minReadyCount) {
            thresholdsMet = false;
            thresholdMessages.push(`readyCount=${summary.readyCount} < minReadyCount=${minReadyCount}`);
        }
        if (summary.uniqueAsOfDateCount < minUniqueAsOfDateCount) {
            thresholdsMet = false;
            thresholdMessages.push(`uniqueAsOfDateCount=${summary.uniqueAsOfDateCount} < min=${minUniqueAsOfDateCount}`);
        }
        if (summary.uniqueSymbolCount < minUniqueSymbolCount) {
            thresholdsMet = false;
            thresholdMessages.push(`uniqueSymbolCount=${summary.uniqueSymbolCount} < min=${minUniqueSymbolCount}`);
        }
        if (summary.coverageRatio < minCoverageRatio) {
            thresholdsMet = false;
            thresholdMessages.push(`coverageRatio=${summary.coverageRatio.toFixed(2)} < min=${minCoverageRatio}`);
        }

        if (thresholdsMet) {
            readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_CORPUS';
            corpusReady = true;
            reasons.push(`All thresholds met: readyCount=${summary.readyCount} uniqueSymbols=${summary.uniqueSymbolCount} coverageRatio=${summary.coverageRatio.toFixed(2)}`);
            reasons.push('Observability-only corpus: no production, simulation, or optimizer writes permitted');
        } else {
            readinessStatus = 'DATA_LIMITED';
            corpusReady = false;
            reasons.push(...thresholdMessages);
        }
    }

    return {
        readinessVersion: CORPUS_READINESS_VERSION,
        corpusReady,
        readinessStatus,
        reasons,
        guardrails,
    };
}

/**
 * Validates a corpus readiness decision for safety compliance.
 */
export function validateCorpusReadinessDecision(
    decision: CorpusReadinessDecision,
): CorpusReadinessValidationResult {
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
    if (!decision.guardrails.noTradingSignal) {
        messages.push('FAIL: guardrails.noTradingSignal must be true');
        valid = false;
    }

    if ((decision.readinessStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: readinessStatus PRODUCTION_READY is forbidden');
        valid = false;
    }

    const allText = decision.reasons.join(' ');
    if (hasForbiddenClaim(allText)) {
        messages.push('FAIL: forbidden claim in readiness reasons');
        valid = false;
    }

    if (valid) messages.push('PASS: corpus readiness decision safety contracts verified');

    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
