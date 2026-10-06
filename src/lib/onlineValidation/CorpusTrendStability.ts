/**
 * CorpusTrendStability.ts — P8 Online Validation
 *
 * Observability-only corpus trend stability check.
 * Analyses coverage trend across multiple asOfDate snapshots.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusMetrics, OutcomeCoverageTrendPoint } from './CorpusMetricsStore';

export const TREND_STABILITY_VERSION = 'corpus-trend-stability-v0';

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

export type TrendStabilityStatus =
    | 'STABLE_FOR_OBSERVABILITY_ONLY'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface TrendStabilityChecks {
    hasEnoughDates: boolean;
    coverageDropWithinLimit: boolean;
    averageCoverageMeetsThreshold: boolean;
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
}

export interface CorpusTrendStabilityResult {
    trendStabilityVersion: string;
    trendRunId: string;
    generatedAt: string;
    inputAsOfDateCount: number;
    inputTotalEntries: number;
    coverageTrend: OutcomeCoverageTrendPoint[];
    readyTrendByAsOfDate: Array<{ asOfDate: string; readyCount: number }>;
    blockedTrendByAsOfDate: Array<{ asOfDate: string; blockedCount: number }>;
    stabilityChecks: TrendStabilityChecks;
    stabilityStatus: TrendStabilityStatus;
    reasons: string[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface CoverageTrendSummary {
    dateCount: number;
    minCoverageRatio: number;
    maxCoverageRatio: number;
    averageCoverageRatio: number;
    largestCoverageDrop: number;
    largestCoverageRise: number;
    stableDateCount: number;
    unstableDateCount: number;
}

export interface BuildCorpusTrendStabilityOptions {
    trendRunId: string;
    generatedAt: string;
    minAsOfDateCount?: number;
    maxCoverageDrop?: number;
    minAverageCoverageRatio?: number;
}

export interface TrendStabilityValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Trend summary ────────────────────────────────────────────────

export function summarizeCoverageTrend(metrics: CorpusMetrics): CoverageTrendSummary {
    const trend = metrics.outcomeCoverageTrend;
    const ratios = trend.map(t => t.coverageRatio);
    const dateCount = trend.length;

    if (dateCount === 0) {
        return {
            dateCount: 0,
            minCoverageRatio: 0,
            maxCoverageRatio: 0,
            averageCoverageRatio: 0,
            largestCoverageDrop: 0,
            largestCoverageRise: 0,
            stableDateCount: 0,
            unstableDateCount: 0,
        };
    }

    const minCoverageRatio = Math.min(...ratios);
    const maxCoverageRatio = Math.max(...ratios);
    const averageCoverageRatio =
        ratios.reduce((sum, r) => sum + r, 0) / dateCount;

    let largestCoverageDrop = 0;
    let largestCoverageRise = 0;
    let stableDateCount = dateCount > 0 ? 1 : 0; // first date always stable (no prior)
    let unstableDateCount = 0;

    for (let i = 1; i < trend.length; i++) {
        const delta = trend[i].coverageRatio - trend[i - 1].coverageRatio;
        if (delta < 0) {
            largestCoverageDrop = Math.max(largestCoverageDrop, -delta);
            unstableDateCount += 1;
        } else {
            largestCoverageRise = Math.max(largestCoverageRise, delta);
            stableDateCount += 1;
        }
    }

    return {
        dateCount,
        minCoverageRatio,
        maxCoverageRatio,
        averageCoverageRatio,
        largestCoverageDrop,
        largestCoverageRise,
        stableDateCount,
        unstableDateCount,
    };
}

// ─── Trend stability builder ───────────────────────────────────────

export function buildCorpusTrendStability(
    metrics: CorpusMetrics,
    options: BuildCorpusTrendStabilityOptions,
): CorpusTrendStabilityResult {
    const minAsOfDateCount = options.minAsOfDateCount ?? 3;
    const maxCoverageDrop = options.maxCoverageDrop ?? 0.25;
    const minAverageCoverageRatio = options.minAverageCoverageRatio ?? 0.5;

    const trend = metrics.outcomeCoverageTrend;
    const summary = summarizeCoverageTrend(metrics);

    const hasEnoughDates = metrics.uniqueAsOfDateCount >= minAsOfDateCount;
    const coverageDropWithinLimit = summary.largestCoverageDrop <= maxCoverageDrop;
    const averageCoverageMeetsThreshold =
        summary.averageCoverageRatio >= minAverageCoverageRatio;

    const checks: TrendStabilityChecks = {
        hasEnoughDates,
        coverageDropWithinLimit,
        averageCoverageMeetsThreshold,
        noProductionWrite: true,
        noSimulationWrite: true,
        noOptimizerWrite: true,
        noPerformanceClaim: true,
        noTradingSignal: true,
    };

    const reasons: string[] = [];
    let stabilityStatus: TrendStabilityStatus;

    if (metrics.totalEntries === 0 || metrics.readyCount === 0 || !averageCoverageMeetsThreshold) {
        stabilityStatus = 'BLOCKED';
        if (metrics.totalEntries === 0) reasons.push('corpus is empty => BLOCKED');
        if (metrics.readyCount === 0) reasons.push('readyCount=0 => BLOCKED');
        if (!averageCoverageMeetsThreshold) {
            reasons.push(
                `averageCoverageRatio=${summary.averageCoverageRatio.toFixed(3)} < minAverageCoverageRatio=${minAverageCoverageRatio} => BLOCKED`,
            );
        }
    } else if (!hasEnoughDates || !coverageDropWithinLimit) {
        stabilityStatus = 'DATA_LIMITED';
        if (!hasEnoughDates) {
            reasons.push(
                `uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < minAsOfDateCount=${minAsOfDateCount} => DATA_LIMITED`,
            );
        }
        if (!coverageDropWithinLimit) {
            reasons.push(
                `largestCoverageDrop=${summary.largestCoverageDrop.toFixed(3)} > maxCoverageDrop=${maxCoverageDrop} => DATA_LIMITED`,
            );
        }
    } else {
        stabilityStatus = 'STABLE_FOR_OBSERVABILITY_ONLY';
        reasons.push(
            `hasEnoughDates=${hasEnoughDates} coverageDropWithinLimit=${coverageDropWithinLimit} averageCoverage=${summary.averageCoverageRatio.toFixed(3)}`,
        );
        reasons.push('Observability-only stability check; no production, simulation, or optimizer writes permitted');
    }

    const result: CorpusTrendStabilityResult = {
        trendStabilityVersion: TREND_STABILITY_VERSION,
        trendRunId: options.trendRunId,
        generatedAt: options.generatedAt,
        inputAsOfDateCount: metrics.uniqueAsOfDateCount,
        inputTotalEntries: metrics.totalEntries,
        coverageTrend: trend,
        readyTrendByAsOfDate: metrics.readyTrendByAsOfDate,
        blockedTrendByAsOfDate: metrics.blockedTrendByAsOfDate,
        stabilityChecks: checks,
        stabilityStatus,
        reasons,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCorpusTrendStability(result);
    result.validationStatus = validation.status;
    result.validationMessages = validation.messages;

    return result;
}

// ─── Validation ───────────────────────────────────────────────────

export function validateCorpusTrendStability(
    result: CorpusTrendStabilityResult,
): TrendStabilityValidationResult {
    const messages: string[] = [];
    let valid = true;

    const checks = result.stabilityChecks;
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

    if ((result.stabilityStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: stabilityStatus must not be PRODUCTION_READY');
        valid = false;
    }

    const text = JSON.stringify(result);
    if (hasForbiddenClaim(text)) {
        messages.push('FAIL: forbidden claim detected in trend stability result');
        valid = false;
    }

    if (valid) messages.push('PASS: corpus trend stability safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
