/**
 * CorpusMetricsStore.ts — P7 Online Validation
 *
 * Converts the multi-date simulation snapshot corpus into an
 * observability-only metrics artifact.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusEntry } from './SimulationSnapshotCorpusAccumulator';

export const CORPUS_METRICS_VERSION = 'corpus-metrics-v0';
export const CORPUS_METRICS_READINESS_VERSION = 'corpus-metrics-readiness-v0';

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
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type CorpusMetricsReadinessStatus =
    | 'READY_FOR_OBSERVABILITY_ONLY_METRICS'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export interface CorpusMetricsGuardrails {
    noProductionWrite: true;
    noSimulationWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
}

export interface CorpusMetrics {
    metricsVersion: string;
    metricsRunId: string;
    generatedAt: string;
    corpusPath: string;
    totalEntries: number;
    readyCount: number;
    blockedCount: number;
    uniqueAsOfDateCount: number;
    uniqueSymbolCount: number;
    uniqueHorizonCount: number;
    coverageRatio: number;
    byAsOfDate: Record<string, number>;
    bySymbol: Record<string, number>;
    byHorizon: Record<string, number>;
    bySnapshotStatus: Record<string, number>;
    byBlockedReason: Record<string, number>;
    perSymbolObservationCount: Record<string, number>;
    perHorizonObservationCount: Record<string, number>;
    outcomeCoverageTrend: OutcomeCoverageTrendPoint[];
    readyTrendByAsOfDate: Array<{ asOfDate: string; readyCount: number }>;
    blockedTrendByAsOfDate: Array<{ asOfDate: string; blockedCount: number }>;
    dataQualityFlags: string[];
    guardrails: CorpusMetricsGuardrails;
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface OutcomeCoverageTrendPoint {
    asOfDate: string;
    totalCount: number;
    readyCount: number;
    blockedCount: number;
    coverageRatio: number;
    missingOutcomeCount: number;
    notDueCount: number;
}

export interface BuildCorpusMetricsOptions {
    metricsRunId: string;
    generatedAt: string;
    corpusPath: string;
}

export interface CorpusMetricsReadinessDecision {
    readinessVersion: string;
    metricsReady: boolean;
    readinessStatus: CorpusMetricsReadinessStatus;
    reasons: string[];
    guardrails: CorpusMetricsGuardrails;
}

export interface CorpusMetricsReadinessOptions {
    minUniqueAsOfDateCount?: number;
    minReadyCount?: number;
    minCoverageRatio?: number;
}

export interface CorpusMetricsValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────

function increment(map: Record<string, number>, key: string): void {
    map[key] = (map[key] ?? 0) + 1;
}

function asOfDateOf(entry: CorpusEntry): string {
    return entry.originalAsOfDate;
}

// ─── Trend builders ───────────────────────────────────────────────

export function buildOutcomeCoverageTrend(
    corpusEntries: CorpusEntry[],
): OutcomeCoverageTrendPoint[] {
    const buckets: Record<string, OutcomeCoverageTrendPoint> = {};

    for (const entry of corpusEntries) {
        const asOfDate = asOfDateOf(entry);
        if (!buckets[asOfDate]) {
            buckets[asOfDate] = {
                asOfDate,
                totalCount: 0,
                readyCount: 0,
                blockedCount: 0,
                coverageRatio: 0,
                missingOutcomeCount: 0,
                notDueCount: 0,
            };
        }

        const bucket = buckets[asOfDate];
        bucket.totalCount += 1;
        if (entry.snapshotStatus === 'SNAPSHOT_READY') {
            bucket.readyCount += 1;
        } else {
            bucket.blockedCount += 1;
        }

        const outcomeAvailable =
            (entry.outcomeSnapshot as Record<string, unknown> | null)?.['outcomeAvailable'] ===
            true;
        if (!outcomeAvailable) {
            bucket.missingOutcomeCount += 1;
        }
        if (entry.snapshotBlockedReason === 'WINDOW_NOT_DUE') {
            bucket.notDueCount += 1;
        }
    }

    return Object.values(buckets)
        .sort((a, b) => a.asOfDate.localeCompare(b.asOfDate))
        .map(bucket => ({
            ...bucket,
            coverageRatio: bucket.totalCount > 0 ? bucket.readyCount / bucket.totalCount : 0,
        }));
}

// ─── Metrics builder ───────────────────────────────────────────────

export function buildCorpusMetrics(
    corpusEntries: CorpusEntry[],
    options: BuildCorpusMetricsOptions,
): CorpusMetrics {
    const byAsOfDate: Record<string, number> = {};
    const bySymbol: Record<string, number> = {};
    const byHorizon: Record<string, number> = {};
    const bySnapshotStatus: Record<string, number> = {};
    const byBlockedReason: Record<string, number> = {};
    const perSymbolObservationCount: Record<string, number> = {};
    const perHorizonObservationCount: Record<string, number> = {};
    const symbolSet = new Set<string>();
    const horizonSet = new Set<string>();
    let readyCount = 0;
    let blockedCount = 0;

    for (const entry of corpusEntries) {
        increment(byAsOfDate, entry.originalAsOfDate);
        increment(bySymbol, entry.symbol);
        increment(byHorizon, entry.horizonLabel);
        increment(bySnapshotStatus, entry.snapshotStatus);
        increment(byBlockedReason, entry.snapshotBlockedReason);
        increment(perSymbolObservationCount, entry.symbol);
        increment(perHorizonObservationCount, entry.horizonLabel);
        symbolSet.add(entry.symbol);
        horizonSet.add(entry.horizonLabel);

        if (entry.snapshotStatus === 'SNAPSHOT_READY') {
            readyCount += 1;
        } else {
            blockedCount += 1;
        }
    }

    const totalEntries = corpusEntries.length;
    const coverageRatio = totalEntries > 0 ? readyCount / totalEntries : 0;
    const outcomeCoverageTrend = buildOutcomeCoverageTrend(corpusEntries);
    const readyTrendByAsOfDate = outcomeCoverageTrend.map(point => ({
        asOfDate: point.asOfDate,
        readyCount: point.readyCount,
    }));
    const blockedTrendByAsOfDate = outcomeCoverageTrend.map(point => ({
        asOfDate: point.asOfDate,
        blockedCount: point.blockedCount,
    }));

    const dataQualityFlags = [
        totalEntries === 0 ? 'EMPTY_CORPUS' : 'NON_EMPTY_CORPUS',
        outcomeCoverageTrend.length > 1 ? 'MULTI_DATE_CORPUS' : 'SINGLE_DATE_CORPUS',
        readyCount > 0 && blockedCount > 0 ? 'READY_AND_BLOCKED_PRESENT' : 'SINGLE_STATUS_ONLY',
        coverageRatio >= 0.5 ? 'COVERAGE_AT_OR_ABOVE_THRESHOLD' : 'COVERAGE_BELOW_THRESHOLD',
        'OBSERVABILITY_ONLY_METRICS',
    ];

    const metrics: CorpusMetrics = {
        metricsVersion: CORPUS_METRICS_VERSION,
        metricsRunId: options.metricsRunId,
        generatedAt: options.generatedAt,
        corpusPath: options.corpusPath,
        totalEntries,
        readyCount,
        blockedCount,
        uniqueAsOfDateCount: Object.keys(byAsOfDate).length,
        uniqueSymbolCount: symbolSet.size,
        uniqueHorizonCount: horizonSet.size,
        coverageRatio,
        byAsOfDate,
        bySymbol,
        byHorizon,
        bySnapshotStatus,
        byBlockedReason,
        perSymbolObservationCount,
        perHorizonObservationCount,
        outcomeCoverageTrend,
        readyTrendByAsOfDate,
        blockedTrendByAsOfDate,
        dataQualityFlags,
        guardrails: {
            noProductionWrite: true,
            noSimulationWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCorpusMetrics(metrics);
    metrics.validationStatus = validation.status;
    metrics.validationMessages = validation.messages;

    return metrics;
}

// ─── Readiness decision ────────────────────────────────────────────

export function buildCorpusMetricsReadinessDecision(
    metrics: CorpusMetrics,
    options: CorpusMetricsReadinessOptions = {},
): CorpusMetricsReadinessDecision {
    const minUniqueAsOfDateCount = options.minUniqueAsOfDateCount ?? 2;
    const minReadyCount = options.minReadyCount ?? 6;
    const minCoverageRatio = options.minCoverageRatio ?? 0.5;

    const guardrails = metrics.guardrails;
    const reasons: string[] = [];
    let readinessStatus: CorpusMetricsReadinessStatus;
    let metricsReady = false;

    const guardrailsOk =
        guardrails.noProductionWrite &&
        guardrails.noSimulationWrite &&
        guardrails.noOptimizerWrite &&
        guardrails.noPerformanceClaim &&
        guardrails.noTradingSignal;

    if (metrics.totalEntries === 0 || metrics.readyCount === 0) {
        readinessStatus = 'BLOCKED';
        reasons.push(`readyCount=${metrics.readyCount} or totalEntries=${metrics.totalEntries} => BLOCKED`);
    } else if (!guardrailsOk) {
        readinessStatus = 'BLOCKED';
        reasons.push('guardrails failed');
    } else if (
        metrics.uniqueAsOfDateCount >= minUniqueAsOfDateCount &&
        metrics.readyCount >= minReadyCount &&
        metrics.coverageRatio >= minCoverageRatio
    ) {
        readinessStatus = 'READY_FOR_OBSERVABILITY_ONLY_METRICS';
        metricsReady = true;
        reasons.push(
            `thresholds met: uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} readyCount=${metrics.readyCount} coverageRatio=${metrics.coverageRatio.toFixed(2)}`,
        );
        reasons.push('Observability-only metrics; no production, simulation, or optimizer writes permitted');
    } else {
        readinessStatus = 'DATA_LIMITED';
        if (metrics.uniqueAsOfDateCount < minUniqueAsOfDateCount) {
            reasons.push(`uniqueAsOfDateCount=${metrics.uniqueAsOfDateCount} < minUniqueAsOfDateCount=${minUniqueAsOfDateCount}`);
        }
        if (metrics.readyCount < minReadyCount) {
            reasons.push(`readyCount=${metrics.readyCount} < minReadyCount=${minReadyCount}`);
        }
        if (metrics.coverageRatio < minCoverageRatio) {
            reasons.push(`coverageRatio=${metrics.coverageRatio.toFixed(2)} < minCoverageRatio=${minCoverageRatio}`);
        }
    }

    return {
        readinessVersion: CORPUS_METRICS_READINESS_VERSION,
        metricsReady,
        readinessStatus,
        reasons,
        guardrails,
    };
}

// ─── Validation ───────────────────────────────────────────────────

export function validateCorpusMetrics(
    metrics: CorpusMetrics,
): CorpusMetricsValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (!metrics.guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        valid = false;
    }
    if (!metrics.guardrails.noSimulationWrite) {
        messages.push('FAIL: noSimulationWrite guardrail must be true');
        valid = false;
    }
    if (!metrics.guardrails.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        valid = false;
    }
    if (!metrics.guardrails.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        valid = false;
    }
    if (!metrics.guardrails.noTradingSignal) {
        messages.push('FAIL: noTradingSignal guardrail must be true');
        valid = false;
    }

    const text = JSON.stringify(metrics);
    if (hasForbiddenClaim(text)) {
        messages.push('FAIL: forbidden claim detected in metrics');
        valid = false;
    }
    if (/production write intent/i.test(text)) {
        messages.push('FAIL: production write intent is forbidden');
        valid = false;
    }
    if (/optimizer write intent/i.test(text)) {
        messages.push('FAIL: optimizer write intent is forbidden');
        valid = false;
    }

    if (valid) {
        messages.push('PASS: corpus metrics safety contracts verified');
    }

    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
