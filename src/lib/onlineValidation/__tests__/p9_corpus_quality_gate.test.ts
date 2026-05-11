/**
 * p9_corpus_quality_gate.test.ts
 * P9 — CorpusQualityGate tests
 */

import {
    buildCorpusQualityGate,
    summarizePerSymbolCoverage,
    summarizePerHorizonCoverage,
    validateCorpusQualityGate,
    QUALITY_GATE_VERSION,
    type CorpusEntry,
} from '../CorpusQualityGate';
import type { CorpusMetrics } from '../CorpusMetricsStore';

function makeEntry(
    symbol: string,
    horizonLabel: string,
    asOfDate: string,
    status: 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED',
): CorpusEntry {
    return {
        symbol,
        horizonLabel,
        originalAsOfDate: asOfDate,
        snapshotStatus: status,
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
    };
}

function makeEntries(): CorpusEntry[] {
    const dates = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];
    const symbols = ['2330', '2454'];
    // Balanced: all horizons have same coverage ratio (all READY) => gap=0
    const horizons: Array<[string, 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED']> = [
        ['5D', 'SNAPSHOT_READY'],
        ['20D', 'SNAPSHOT_READY'],
        ['60D', 'SNAPSHOT_READY'],
    ];
    const entries: CorpusEntry[] = [];
    for (const d of dates) {
        for (const s of symbols) {
            for (const [h, status] of horizons) {
                entries.push(makeEntry(s, h, d, status));
            }
        }
    }
    return entries;
}

/** Realistic fixture: 5D/20D ready, 60D blocked — used for horizon-gap tests */
function makeRealisticEntries(): CorpusEntry[] {
    const dates = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];
    const symbols = ['2330', '2454'];
    const horizons: Array<[string, 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED']> = [
        ['5D', 'SNAPSHOT_READY'],
        ['20D', 'SNAPSHOT_READY'],
        ['60D', 'SNAPSHOT_BLOCKED'],
    ];
    const entries: CorpusEntry[] = [];
    for (const d of dates) {
        for (const s of symbols) {
            for (const [h, status] of horizons) {
                entries.push(makeEntry(s, h, d, status));
            }
        }
    }
    return entries;
}

function makeMetrics(overrides: Partial<CorpusMetrics> = {}): CorpusMetrics {
    return {
        metricsVersion: 'corpus-metrics-v0',
        metricsRunId: 'test-run',
        generatedAt: '2026-05-11T00:00:00.000Z',
        corpusPath: 'outputs/online_validation/simulation_snapshot_corpus.jsonl',
        totalEntries: 24,
        readyCount: 16,
        blockedCount: 8,
        uniqueAsOfDateCount: 4,
        uniqueSymbolCount: 2,
        uniqueHorizonCount: 3,
        coverageRatio: 0.6667,
        byAsOfDate: { '2026-05-11': 6, '2026-05-12': 6, '2026-05-13': 6, '2026-05-14': 6 },
        bySymbol: { '2330': 12, '2454': 12 },
        byHorizon: { '5D': 8, '20D': 8, '60D': 8 },
        bySnapshotStatus: { SNAPSHOT_READY: 16, SNAPSHOT_BLOCKED: 8 },
        byBlockedReason: { WINDOW_NOT_DUE: 8 },
        perSymbolObservationCount: { '2330': 12, '2454': 12 },
        perHorizonObservationCount: { '5D': 8, '20D': 8, '60D': 8 },
        outcomeCoverageTrend: [
            { asOfDate: '2026-05-11', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 0, notDueCount: 2 },
            { asOfDate: '2026-05-12', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 0, notDueCount: 2 },
            { asOfDate: '2026-05-13', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 0, notDueCount: 2 },
            { asOfDate: '2026-05-14', totalCount: 6, readyCount: 4, blockedCount: 2, coverageRatio: 0.6667, missingOutcomeCount: 0, notDueCount: 2 },
        ],
        readyTrendByAsOfDate: [
            { asOfDate: '2026-05-11', readyCount: 4 },
            { asOfDate: '2026-05-12', readyCount: 4 },
            { asOfDate: '2026-05-13', readyCount: 4 },
            { asOfDate: '2026-05-14', readyCount: 4 },
        ],
        blockedTrendByAsOfDate: [
            { asOfDate: '2026-05-11', blockedCount: 2 },
            { asOfDate: '2026-05-12', blockedCount: 2 },
            { asOfDate: '2026-05-13', blockedCount: 2 },
            { asOfDate: '2026-05-14', blockedCount: 2 },
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
    qualityRunId: 'test-quality-run-001',
    generatedAt: '2026-05-11T00:00:00.000Z',
    minAsOfDateCount: 4,
    minSymbolCount: 2,
    minHorizonCount: 3,
    minCoverageRatio: 0.5,
    maxSymbolCoverageGap: 0.35,
    maxHorizonCoverageGap: 0.35,
};

describe('CorpusQualityGate — P9', () => {
    describe('summarizePerSymbolCoverage', () => {
        it('should return correct totals per symbol', () => {
            const entries = makeRealisticEntries();
            const result = summarizePerSymbolCoverage(entries);
            expect(result.length).toBe(2);
            const s2330 = result.find(r => r.symbol === '2330')!;
            expect(s2330.totalCount).toBe(12);
            expect(s2330.readyCount).toBe(8);
            expect(s2330.blockedCount).toBe(4);
        });

        it('should compute coverageRatio per symbol', () => {
            const entries = makeRealisticEntries();
            const result = summarizePerSymbolCoverage(entries);
            for (const s of result) {
                expect(s.coverageRatio).toBeCloseTo(s.readyCount / s.totalCount, 3);
            }
        });

        it('should return empty for empty entries', () => {
            expect(summarizePerSymbolCoverage([])).toHaveLength(0);
        });
    });

    describe('summarizePerHorizonCoverage', () => {
        it('should return correct totals per horizon', () => {
            const entries = makeRealisticEntries();
            const result = summarizePerHorizonCoverage(entries);
            expect(result.length).toBe(3);
            const h5d = result.find(r => r.horizonLabel === '5D')!;
            expect(h5d.totalCount).toBe(8);
            expect(h5d.readyCount).toBe(8);
            expect(h5d.blockedCount).toBe(0);
            const h60d = result.find(r => r.horizonLabel === '60D')!;
            expect(h60d.readyCount).toBe(0);
            expect(h60d.blockedCount).toBe(8);
        });

        it('should compute coverageRatio per horizon', () => {
            const entries = makeEntries();
            const result = summarizePerHorizonCoverage(entries);
            for (const h of result) {
                expect(h.coverageRatio).toBeCloseTo(h.readyCount / h.totalCount, 3);
            }
        });
    });

    describe('buildCorpusQualityGate', () => {
        it('should return PASS_FOR_OBSERVABILITY_ONLY when all gates pass', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityStatus).toBe('PASS_FOR_OBSERVABILITY_ONLY');
        });

        it('should return DATA_LIMITED when uniqueAsOfDateCount < minAsOfDateCount', () => {
            const metrics = makeMetrics({ uniqueAsOfDateCount: 3 });
            const entries = makeEntries().slice(0, 18);
            const result = buildCorpusQualityGate(metrics, entries, { ...BASE_OPTIONS, minAsOfDateCount: 4 });
            expect(result.qualityStatus).toBe('DATA_LIMITED');
            expect(result.qualityChecks.hasEnoughDates).toBe(false);
        });

        it('should return DATA_LIMITED when uniqueSymbolCount < minSymbolCount', () => {
            const metrics = makeMetrics({ uniqueSymbolCount: 1, coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, { ...BASE_OPTIONS, minSymbolCount: 2 });
            expect(result.qualityStatus).toBe('DATA_LIMITED');
            expect(result.qualityChecks.hasEnoughSymbols).toBe(false);
        });

        it('should return DATA_LIMITED when uniqueHorizonCount < minHorizonCount', () => {
            const metrics = makeMetrics({ uniqueHorizonCount: 2, coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, { ...BASE_OPTIONS, minHorizonCount: 3 });
            expect(result.qualityStatus).toBe('DATA_LIMITED');
            expect(result.qualityChecks.hasEnoughHorizons).toBe(false);
        });

        it('should return DATA_LIMITED when symbolCoverageGap too high', () => {
            // Make 2454 all blocked => symbolCoverageGap = 1.0 - 0.0 = 1.0 > 0.1
            const entries = makeEntries().map(e =>
                e.symbol === '2454'
                    ? { ...e, snapshotStatus: 'SNAPSHOT_BLOCKED' as const }
                    : e,
            );
            const metrics = makeMetrics({ uniqueAsOfDateCount: 4, coverageRatio: 0.5, readyCount: 12 });
            const result = buildCorpusQualityGate(metrics, entries, { ...BASE_OPTIONS, maxSymbolCoverageGap: 0.1 });
            expect(result.qualityStatus).toBe('DATA_LIMITED');
        });

        it('should return DATA_LIMITED when horizonCoverageGap too high', () => {
            // Realistic entries: 60D all blocked → gap=1.0 > 0.35
            const metrics = makeMetrics({ coverageRatio: 0.6667, readyCount: 16 });
            const entries = makeRealisticEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityStatus).toBe('DATA_LIMITED');
        });

        it('should return BLOCKED when readyCount=0', () => {
            const metrics = makeMetrics({ readyCount: 0, coverageRatio: 0 });
            const entries: CorpusEntry[] = [];
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityStatus).toBe('BLOCKED');
        });

        it('should return BLOCKED when totalEntries=0', () => {
            const metrics = makeMetrics({ totalEntries: 0, readyCount: 0, coverageRatio: 0 });
            const result = buildCorpusQualityGate(metrics, [], BASE_OPTIONS);
            expect(result.qualityStatus).toBe('BLOCKED');
        });

        it('should have all guardrails true', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityChecks.noProductionWrite).toBe(true);
            expect(result.qualityChecks.noSimulationWrite).toBe(true);
            expect(result.qualityChecks.noOptimizerWrite).toBe(true);
            expect(result.qualityChecks.noPerformanceClaim).toBe(true);
            expect(result.qualityChecks.noTradingSignal).toBe(true);
        });

        it('should not contain PRODUCTION_READY status', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityStatus).not.toBe('PRODUCTION_READY');
        });

        it('should not contain forbidden claims', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            const text = JSON.stringify(result);
            expect(text).not.toMatch(/\bprofit\b/i);
            expect(text).not.toMatch(/\bbuy\b/i);
            expect(text).not.toMatch(/\bsell\b/i);
            expect(text).not.toMatch(/\bguaranteed\b/i);
            expect(text).not.toMatch(/\bPRODUCTION_READY\b/);
        });

        it('should set qualityGateVersion', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.qualityGateVersion).toBe(QUALITY_GATE_VERSION);
        });

        it('should pass validation when PASS_FOR_OBSERVABILITY_ONLY', () => {
            const metrics = makeMetrics({ coverageRatio: 1.0, readyCount: 24, blockedCount: 0 });
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            expect(result.validationStatus).toBe('PASS');
        });
    });

    describe('validateCorpusQualityGate', () => {
        it('should reject PRODUCTION_READY status', () => {
            const metrics = makeMetrics();
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            const mutated = { ...result, qualityStatus: 'PRODUCTION_READY' as any };
            const validation = validateCorpusQualityGate(mutated);
            expect(validation.status).toBe('FAIL');
        });

        it('should pass valid PASS_FOR_OBSERVABILITY_ONLY result', () => {
            const metrics = makeMetrics();
            const entries = makeEntries();
            const result = buildCorpusQualityGate(metrics, entries, BASE_OPTIONS);
            const validation = validateCorpusQualityGate(result);
            expect(validation.status).toBe('PASS');
        });
    });
});
