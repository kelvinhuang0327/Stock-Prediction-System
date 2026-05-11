/**
 * p8_corpus_trend_stability.test.ts
 * P8 — CorpusTrendStability tests
 */

import {
    buildCorpusTrendStability,
    summarizeCoverageTrend,
    validateCorpusTrendStability,
    TREND_STABILITY_VERSION,
} from '../CorpusTrendStability';
import type { CorpusMetrics } from '../CorpusMetricsStore';

function makeMetrics(overrides: Partial<CorpusMetrics> = {}): CorpusMetrics {
    return {
        metricsVersion: 'corpus-metrics-v0',
        metricsRunId: 'test-run',
        generatedAt: '2026-05-11T00:00:00.000Z',
        corpusPath: 'outputs/online_validation/simulation_snapshot_corpus.jsonl',
        totalEntries: 18,
        readyCount: 9,
        blockedCount: 9,
        uniqueAsOfDateCount: 3,
        uniqueSymbolCount: 2,
        uniqueHorizonCount: 3,
        coverageRatio: 0.5,
        byAsOfDate: { '2026-05-11': 6, '2026-05-12': 6, '2026-05-13': 6 },
        bySymbol: { '2330': 9, '2454': 9 },
        byHorizon: { '5D': 6, '20D': 6, '60D': 6 },
        bySnapshotStatus: { SNAPSHOT_READY: 9, SNAPSHOT_BLOCKED: 9 },
        byBlockedReason: { WINDOW_NOT_DUE: 6, OUTCOME_MISSING: 3 },
        perSymbolObservationCount: { '2330': 9, '2454': 9 },
        perHorizonObservationCount: { '5D': 6, '20D': 6, '60D': 6 },
        outcomeCoverageTrend: [
            { asOfDate: '2026-05-11', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 1, notDueCount: 2 },
            { asOfDate: '2026-05-12', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 1, notDueCount: 2 },
            { asOfDate: '2026-05-13', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.5, missingOutcomeCount: 1, notDueCount: 2 },
        ],
        readyTrendByAsOfDate: [
            { asOfDate: '2026-05-11', readyCount: 3 },
            { asOfDate: '2026-05-12', readyCount: 3 },
            { asOfDate: '2026-05-13', readyCount: 3 },
        ],
        blockedTrendByAsOfDate: [
            { asOfDate: '2026-05-11', blockedCount: 3 },
            { asOfDate: '2026-05-12', blockedCount: 3 },
            { asOfDate: '2026-05-13', blockedCount: 3 },
        ],
        dataQualityFlags: [],
        guardrails: {
            noProductionWrite: true,
            noSimulationWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
        ...overrides,
    };
}

const BASE_OPTIONS = {
    trendRunId: 'test-trend-run-001',
    generatedAt: '2026-05-11T00:00:00.000Z',
    minAsOfDateCount: 3,
    maxCoverageDrop: 0.25,
    minAverageCoverageRatio: 0.5,
};

describe('CorpusTrendStability — P8', () => {
    describe('summarizeCoverageTrend', () => {
        it('should count dateCount correctly', () => {
            const metrics = makeMetrics();
            const summary = summarizeCoverageTrend(metrics);
            expect(summary.dateCount).toBe(3);
        });

        it('should compute min/max/average coverageRatio correctly', () => {
            const metrics = makeMetrics({
                outcomeCoverageTrend: [
                    { asOfDate: '2026-05-11', totalCount: 6, readyCount: 3, blockedCount: 3, coverageRatio: 0.4, missingOutcomeCount: 1, notDueCount: 2 },
                    { asOfDate: '2026-05-12', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6, missingOutcomeCount: 0, notDueCount: 2 },
                    { asOfDate: '2026-05-13', totalCount: 6, readyCount: 5, blockedCount: 1, coverageRatio: 0.8, missingOutcomeCount: 0, notDueCount: 1 },
                ],
            });
            const summary = summarizeCoverageTrend(metrics);
            expect(summary.minCoverageRatio).toBeCloseTo(0.4);
            expect(summary.maxCoverageRatio).toBeCloseTo(0.8);
            expect(summary.averageCoverageRatio).toBeCloseTo(0.6);
        });

        it('should compute largestCoverageDrop', () => {
            const metrics = makeMetrics({
                outcomeCoverageTrend: [
                    { asOfDate: '2026-05-11', totalCount: 6, readyCount: 5, blockedCount: 1, coverageRatio: 0.8, missingOutcomeCount: 0, notDueCount: 1 },
                    { asOfDate: '2026-05-12', totalCount: 6, readyCount: 2, blockedCount: 4, coverageRatio: 0.4, missingOutcomeCount: 2, notDueCount: 2 },
                ],
                uniqueAsOfDateCount: 2,
            });
            const summary = summarizeCoverageTrend(metrics);
            expect(summary.largestCoverageDrop).toBeCloseTo(0.4);
        });

        it('should return zero summary for empty trend', () => {
            const metrics = makeMetrics({ outcomeCoverageTrend: [], uniqueAsOfDateCount: 0 });
            const summary = summarizeCoverageTrend(metrics);
            expect(summary.dateCount).toBe(0);
            expect(summary.averageCoverageRatio).toBe(0);
        });
    });

    describe('buildCorpusTrendStability', () => {
        it('should return STABLE_FOR_OBSERVABILITY_ONLY when all gates pass', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            expect(result.stabilityStatus).toBe('STABLE_FOR_OBSERVABILITY_ONLY');
        });

        it('should return DATA_LIMITED when uniqueAsOfDateCount < minAsOfDateCount', () => {
            const metrics = makeMetrics({ uniqueAsOfDateCount: 2 });
            const result = buildCorpusTrendStability(metrics, { ...BASE_OPTIONS, minAsOfDateCount: 3 });
            expect(result.stabilityStatus).toBe('DATA_LIMITED');
        });

        it('should return BLOCKED when average coverage below threshold', () => {
            const metrics = makeMetrics({
                outcomeCoverageTrend: [
                    { asOfDate: '2026-05-11', totalCount: 6, readyCount: 1, blockedCount: 5, coverageRatio: 0.1, missingOutcomeCount: 3, notDueCount: 2 },
                    { asOfDate: '2026-05-12', totalCount: 6, readyCount: 1, blockedCount: 5, coverageRatio: 0.1, missingOutcomeCount: 3, notDueCount: 2 },
                    { asOfDate: '2026-05-13', totalCount: 6, readyCount: 1, blockedCount: 5, coverageRatio: 0.1, missingOutcomeCount: 3, notDueCount: 2 },
                ],
                readyCount: 3,
                coverageRatio: 0.1,
            });
            const result = buildCorpusTrendStability(metrics, { ...BASE_OPTIONS, minAverageCoverageRatio: 0.5 });
            expect(result.stabilityStatus).toBe('BLOCKED');
        });

        it('should have all guardrails true', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            expect(result.stabilityChecks.noProductionWrite).toBe(true);
            expect(result.stabilityChecks.noSimulationWrite).toBe(true);
            expect(result.stabilityChecks.noOptimizerWrite).toBe(true);
            expect(result.stabilityChecks.noPerformanceClaim).toBe(true);
            expect(result.stabilityChecks.noTradingSignal).toBe(true);
        });

        it('should not contain PRODUCTION_READY status', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            expect(result.stabilityStatus).not.toBe('PRODUCTION_READY');
        });

        it('should not contain forbidden claims', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            const text = JSON.stringify(result);
            expect(text).not.toMatch(/\bprofit\b/i);
            expect(text).not.toMatch(/\bbuy\b/i);
            expect(text).not.toMatch(/\bsell\b/i);
            expect(text).not.toMatch(/\bguaranteed\b/i);
            expect(text).not.toMatch(/\bPRODUCTION_READY\b/);
        });

        it('should set trendStabilityVersion', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            expect(result.trendStabilityVersion).toBe(TREND_STABILITY_VERSION);
        });

        it('should pass validation when stable', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            expect(result.validationStatus).toBe('PASS');
        });
    });

    describe('validateCorpusTrendStability', () => {
        it('should reject result with PRODUCTION_READY status', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            const mutated = { ...result, stabilityStatus: 'PRODUCTION_READY' as any };
            const validation = validateCorpusTrendStability(mutated);
            expect(validation.status).toBe('FAIL');
        });

        it('should pass valid stable result', () => {
            const metrics = makeMetrics();
            const result = buildCorpusTrendStability(metrics, BASE_OPTIONS);
            const validation = validateCorpusTrendStability(result);
            expect(validation.status).toBe('PASS');
        });
    });
});
