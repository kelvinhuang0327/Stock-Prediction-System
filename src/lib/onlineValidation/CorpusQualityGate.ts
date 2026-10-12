/**
 * CorpusQualityGate.ts — P9 Online Validation
 *
 * Observability-only corpus quality gate.
 * Checks per-symbol/per-horizon coverage convergence, min counts.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusMetrics } from './CorpusMetricsStore';

export const QUALITY_GATE_VERSION = 'corpus-quality-gate-v0';

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
    /\bPRODUCTION_READY\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

export type QualityGateStatus =
    | 'PASS_FOR_OBSERVABILITY_ONLY'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface SymbolCoverageSummary {
    symbol: string;
    totalCount: number;
    readyCount: number;
    blockedCount: number;
    coverageRatio: number;
}

export interface HorizonCoverageSummary {
    horizonLabel: string;
    totalCount: number;
    readyCount: number;
    blockedCount: number;
    coverageRatio: number;
}

export interface CorpusEntry {
    symbol: string;
    horizonLabel: string;
    snapshotStatus: string;
    originalAsOfDate: string;
    productionWriteAllowed: boolean;
    simulationWriteAllowed: boolean;
    optimizerWriteAllowed: boolean;
    [key: string]: unknown;
}

export interface QualityGateChecks {
    hasEnoughDates: boolean;
    hasEnoughSymbols: boolean;
    hasEnoughHorizons: boolean;
    coverageMeetsThreshold: boolean;
    symbolCoverageGapWithinLimit: boolean;
    horizonCoverageGapWithinLimit: boolean;
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
}

export interface CorpusQualityGateResult {
    qualityGateVersion: string;
    qualityRunId: string;
    generatedAt: string;
    inputTotalEntries: number;
    inputAsOfDateCount: number;
    inputSymbolCount: number;
    inputHorizonCount: number;
    coverageRatio: number;
    perSymbolCoverage: SymbolCoverageSummary[];
    perHorizonCoverage: HorizonCoverageSummary[];
    symbolCoverageGap: number;
    horizonCoverageGap: number;
    qualityChecks: QualityGateChecks;
    qualityStatus: QualityGateStatus;
    reasons: string[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildCorpusQualityGateOptions {
    qualityRunId: string;
    generatedAt: string;
    minAsOfDateCount?: number;
    minSymbolCount?: number;
    minHorizonCount?: number;
    minCoverageRatio?: number;
    maxSymbolCoverageGap?: number;
    maxHorizonCoverageGap?: number;
}

export interface QualityGateValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Per-symbol coverage ──────────────────────────────────────────

export function summarizePerSymbolCoverage(
    corpusEntries: CorpusEntry[],
): SymbolCoverageSummary[] {
    const bySymbol: Record<string, { total: number; ready: number }> = {};
    for (const entry of corpusEntries) {
        if (!bySymbol[entry.symbol]) bySymbol[entry.symbol] = { total: 0, ready: 0 };
        bySymbol[entry.symbol].total++;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') bySymbol[entry.symbol].ready++;
    }
    return Object.entries(bySymbol)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([symbol, { total, ready }]) => ({
            symbol,
            totalCount: total,
            readyCount: ready,
            blockedCount: total - ready,
            coverageRatio: total > 0 ? parseFloat((ready / total).toFixed(4)) : 0,
        }));
}

// ─── Per-horizon coverage ─────────────────────────────────────────

export function summarizePerHorizonCoverage(
    corpusEntries: CorpusEntry[],
): HorizonCoverageSummary[] {
    const byHorizon: Record<string, { total: number; ready: number }> = {};
    for (const entry of corpusEntries) {
        if (!byHorizon[entry.horizonLabel]) byHorizon[entry.horizonLabel] = { total: 0, ready: 0 };
        byHorizon[entry.horizonLabel].total++;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') byHorizon[entry.horizonLabel].ready++;
    }
    // Sort by horizonDays implied from label
    const horizonOrder: Record<string, number> = { '5D': 0, '20D': 1, '60D': 2 };
    return Object.entries(byHorizon)
        .sort(([a], [b]) => (horizonOrder[a] ?? 99) - (horizonOrder[b] ?? 99))
        .map(([horizonLabel, { total, ready }]) => ({
            horizonLabel,
            totalCount: total,
            readyCount: ready,
            blockedCount: total - ready,
            coverageRatio: total > 0 ? parseFloat((ready / total).toFixed(4)) : 0,
        }));
}

// ─── Quality gate builder ─────────────────────────────────────────

export function buildCorpusQualityGate(
    metrics: CorpusMetrics,
    corpusEntries: CorpusEntry[],
    options: BuildCorpusQualityGateOptions,
): CorpusQualityGateResult {
    const minAsOfDateCount = options.minAsOfDateCount ?? 4;
    const minSymbolCount = options.minSymbolCount ?? 2;
    const minHorizonCount = options.minHorizonCount ?? 3;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;
    const maxSymbolCoverageGap = options.maxSymbolCoverageGap ?? 0.35;
    const maxHorizonCoverageGap = options.maxHorizonCoverageGap ?? 0.35;

    const perSymbolCoverage = summarizePerSymbolCoverage(corpusEntries);
    const perHorizonCoverage = summarizePerHorizonCoverage(corpusEntries);

    const symbolRatios = perSymbolCoverage.map(s => s.coverageRatio);
    const horizonRatios = perHorizonCoverage.map(h => h.coverageRatio);

    const symbolCoverageGap =
        symbolRatios.length >= 2
            ? parseFloat((Math.max(...symbolRatios) - Math.min(...symbolRatios)).toFixed(4))
            : 0;
    const horizonCoverageGap =
        horizonRatios.length >= 2
            ? parseFloat((Math.max(...horizonRatios) - Math.min(...horizonRatios)).toFixed(4))
            : 0;

    const hasEnoughDates = metrics.uniqueAsOfDateCount >= minAsOfDateCount;
    const hasEnoughSymbols = metrics.uniqueSymbolCount >= minSymbolCount;
    const hasEnoughHorizons = metrics.uniqueHorizonCount >= minHorizonCount;
    const coverageMeetsThreshold = metrics.coverageRatio >= minCoverageRatio;
    const symbolCoverageGapWithinLimit = symbolCoverageGap <= maxSymbolCoverageGap;
    const horizonCoverageGapWithinLimit = horizonCoverageGap <= maxHorizonCoverageGap;

    const qualityChecks: QualityGateChecks = {
        hasEnoughDates,
        hasEnoughSymbols,
        hasEnoughHorizons,
        coverageMeetsThreshold,
        symbolCoverageGapWithinLimit,
        horizonCoverageGapWithinLimit,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    const reasons: string[] = [];
    let qualityStatus: QualityGateStatus;

    if (metrics.totalEntries === 0 || metrics.readyCount === 0 || !coverageMeetsThreshold) {
        qualityStatus = 'BLOCKED';
        if (metrics.totalEntries === 0) reasons.push('corpus is empty => BLOCKED');
        if (metrics.readyCount === 0) reasons.push('readyCount=0 => BLOCKED');
        if (!coverageMeetsThreshold) {
            reasons.push(
                `coverageRatio=${metrics.coverageRatio} < minCoverageRatio=${minCoverageRatio} => BLOCKED`,
            );
        }
    } else if (
        !hasEnoughDates ||
        !hasEnoughSymbols ||
        !hasEnoughHorizons ||
        !symbolCoverageGapWithinLimit ||
        !horizonCoverageGapWithinLimit
    ) {
        qualityStatus = 'DATA_LIMITED';
        if (!hasEnoughDates) {
            reasons.push(
                `uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < minAsOfDateCount=${minAsOfDateCount} => DATA_LIMITED`,
            );
        }
        if (!hasEnoughSymbols) {
            reasons.push(
                `uniqueSymbolCount=${metrics.uniqueSymbolCount} < minSymbolCount=${minSymbolCount} => DATA_LIMITED`,
            );
        }
        if (!hasEnoughHorizons) {
            reasons.push(
                `uniqueHorizonCount=${metrics.uniqueHorizonCount} < minHorizonCount=${minHorizonCount} => DATA_LIMITED`,
            );
        }
        if (!symbolCoverageGapWithinLimit) {
            reasons.push(
                `symbolCoverageGap=${symbolCoverageGap} > maxSymbolCoverageGap=${maxSymbolCoverageGap} => DATA_LIMITED`,
            );
        }
        if (!horizonCoverageGapWithinLimit) {
            reasons.push(
                `horizonCoverageGap=${horizonCoverageGap} > maxHorizonCoverageGap=${maxHorizonCoverageGap} => DATA_LIMITED`,
            );
        }
    } else {
        qualityStatus = 'PASS_FOR_OBSERVABILITY_ONLY';
        reasons.push(
            `All quality gates pass: dates=${metrics.uniqueAsOfDateCount} symbols=${metrics.uniqueSymbolCount} horizons=${metrics.uniqueHorizonCount} coverage=${metrics.coverageRatio}`,
        );
        reasons.push('Observability-only quality gate; no production, simulation, or optimizer writes permitted');
    }

    const result: CorpusQualityGateResult = {
        qualityGateVersion: QUALITY_GATE_VERSION,
        qualityRunId: options.qualityRunId,
        generatedAt: options.generatedAt,
        inputTotalEntries: metrics.totalEntries,
        inputAsOfDateCount: metrics.uniqueAsOfDateCount,
        inputSymbolCount: metrics.uniqueSymbolCount,
        inputHorizonCount: metrics.uniqueHorizonCount,
        coverageRatio: metrics.coverageRatio,
        perSymbolCoverage,
        perHorizonCoverage,
        symbolCoverageGap,
        horizonCoverageGap,
        qualityChecks,
        qualityStatus,
        reasons,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCorpusQualityGate(result);
    result.validationStatus = validation.status;
    result.validationMessages = validation.messages;

    return result;
}

// ─── Validation ───────────────────────────────────────────────────

export function validateCorpusQualityGate(
    result: CorpusQualityGateResult,
): QualityGateValidationResult {
    const messages: string[] = [];
    let valid = true;

    const checks = result.qualityChecks;
    if (!checks.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        valid = false;
    }
    if (!checks.noSimulationWrite) {
        messages.push('FAIL: noSimulationWrite guardrail must be true');
        valid = false;
    }
    if (!checks.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        valid = false;
    }
    if (!checks.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        valid = false;
    }
    if (!checks.noTradingSignal) {
        messages.push('FAIL: noTradingSignal guardrail must be true');
        valid = false;
    }

    if ((result.qualityStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: qualityStatus must not be PRODUCTION_READY');
        valid = false;
    }

    if (hasForbiddenClaim(JSON.stringify(result))) {
        messages.push('FAIL: forbidden claim detected in quality gate result');
        valid = false;
    }

    if (valid) messages.push('PASS: corpus quality gate safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
