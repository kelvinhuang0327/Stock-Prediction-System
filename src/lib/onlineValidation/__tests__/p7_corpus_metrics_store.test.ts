import {
    buildCorpusMetrics,
    buildOutcomeCoverageTrend,
    buildCorpusMetricsReadinessDecision,
    validateCorpusMetrics,
} from '../CorpusMetricsStore';
import {
    normalizeSnapshotForCorpus,
    type CorpusEntry,
} from '../SimulationSnapshotCorpusAccumulator';
import {
    buildSecondDateSnapshotSeed,
    buildSecondDateSimulationSnapshots,
} from '../SecondDateSnapshotBatchFactory';

function buildLegacySnapshot(
    symbol: '2330' | '2454',
    horizonLabel: '5D' | '20D' | '60D',
    snapshotStatus: 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED',
    snapshotBlockedReason: string,
    outcomeAvailable: boolean,
    asOfDate = '2026-05-11',
): Record<string, unknown> {
    return {
        simulationRunId: 'p5-replay-simulation-20260511-001',
        simulationSnapshotKey: `SIM_SNAPSHOT|p4|${asOfDate}|${symbol}|MVP_CORE|${horizonLabel}`,
        replayKey: `REPLAY_DATASET|${asOfDate}|${symbol}|MVP_CORE|p2-run|${horizonLabel}`,
        originalRunId: 'p2-run',
        originalAsOfDate: asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays: horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60,
        targetTradingDate:
            horizonLabel === '5D'
                ? '2026-05-18'
                : horizonLabel === '20D'
                    ? '2026-06-08'
                    : '2026-08-03',
        reviewDate: '2026-06-30',
        researchBucket: snapshotStatus === 'SNAPSHOT_READY' ? 'Strong' : 'Watch',
        scoreSnapshot: { researchScore: snapshotStatus === 'SNAPSHOT_READY' ? 73 : 41 },
        confidenceSnapshot: snapshotStatus === 'SNAPSHOT_READY' ? 67 : 31,
        factorSnapshot: [],
        riskSnapshot: [],
        limitationSnapshot: [],
        dataCoverageSnapshot: { coverage: 'fixture' },
        sourceDateBasis: { sourceDate: '2026-05-10', sourceType: 'fixture', missingDataFlags: [] },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: outcomeAvailable ? 1000 : null,
            returnPct: outcomeAvailable ? 1.2 : null,
            priceSource: 'fixture',
            outcomeAvailable,
        },
        snapshotStatus,
        snapshotBlockedReason,
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationMessages: [],
    };
}

function toCorpusEntries(): CorpusEntry[] {
    const p5LikeSnapshots = [
        buildLegacySnapshot('2330', '5D', 'SNAPSHOT_READY', 'NONE', true),
        buildLegacySnapshot('2330', '20D', 'SNAPSHOT_READY', 'NONE', true),
        buildLegacySnapshot('2330', '60D', 'SNAPSHOT_BLOCKED', 'WINDOW_NOT_DUE', false),
        buildLegacySnapshot('2454', '5D', 'SNAPSHOT_READY', 'NONE', true),
        buildLegacySnapshot('2454', '20D', 'SNAPSHOT_BLOCKED', 'OUTCOME_MISSING', false),
        buildLegacySnapshot('2454', '60D', 'SNAPSHOT_BLOCKED', 'WINDOW_NOT_DUE', false),
    ];

    const p7Snapshots = buildSecondDateSimulationSnapshots(buildSecondDateSnapshotSeed());
    return [
        ...p5LikeSnapshots.map(snapshot =>
            normalizeSnapshotForCorpus(snapshot, {
                corpusRunId: 'p6-corpus-20260511-001',
                ingestionDate: '2026-05-11',
            }),
        ),
        ...p7Snapshots.map(snapshot =>
            normalizeSnapshotForCorpus(snapshot, {
                corpusRunId: 'p7-corpus-20260512-001',
                ingestionDate: '2026-05-12',
            }),
        ),
    ];
}

describe('CorpusMetricsStore', () => {
    const corpusEntries = toCorpusEntries();

    it('counts total/ready/blocked correctly', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        expect(metrics.totalEntries).toBe(12);
        expect(metrics.readyCount).toBe(6);
        expect(metrics.blockedCount).toBe(6);
    });

    it('uniqueAsOfDateCount is correct', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        expect(metrics.uniqueAsOfDateCount).toBe(2);
    });

    it('perSymbolObservationCount is correct', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        expect(metrics.perSymbolObservationCount['2330']).toBe(6);
        expect(metrics.perSymbolObservationCount['2454']).toBe(6);
    });

    it('perHorizonObservationCount is correct', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        expect(metrics.perHorizonObservationCount['5D']).toBe(4);
        expect(metrics.perHorizonObservationCount['20D']).toBe(4);
        expect(metrics.perHorizonObservationCount['60D']).toBe(4);
    });

    it('outcomeCoverageTrend includes both asOfDate values', () => {
        const trend = buildOutcomeCoverageTrend(corpusEntries);
        expect(trend.map(point => point.asOfDate)).toEqual(['2026-05-11', '2026-05-12']);
    });

    it('readiness READY when thresholds met', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        const decision = buildCorpusMetricsReadinessDecision(metrics);
        expect(decision.readinessStatus).toBe('READY_FOR_OBSERVABILITY_ONLY_METRICS');
        expect(decision.metricsReady).toBe(true);
    });

    it('readiness DATA_LIMITED when coverage below threshold', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        const decision = buildCorpusMetricsReadinessDecision(metrics, { minCoverageRatio: 0.75 });
        expect(decision.readinessStatus).toBe('DATA_LIMITED');
        expect(decision.metricsReady).toBe(false);
    });

    it('readiness BLOCKED when readyCount=0', () => {
        const blockedEntries = [
            normalizeSnapshotForCorpus(
                buildLegacySnapshot('2330', '60D', 'SNAPSHOT_BLOCKED', 'WINDOW_NOT_DUE', false),
                { corpusRunId: 'blocked', ingestionDate: '2026-05-11' },
            ),
            normalizeSnapshotForCorpus(
                buildLegacySnapshot('2454', '20D', 'SNAPSHOT_BLOCKED', 'OUTCOME_MISSING', false),
                { corpusRunId: 'blocked', ingestionDate: '2026-05-11' },
            ),
        ];
        const metrics = buildCorpusMetrics(blockedEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        const decision = buildCorpusMetricsReadinessDecision(metrics);
        expect(decision.readinessStatus).toBe('BLOCKED');
        expect(decision.metricsReady).toBe(false);
    });

    it('guardrails are all true', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        expect(metrics.guardrails.noProductionWrite).toBe(true);
        expect(metrics.guardrails.noSimulationWrite).toBe(true);
        expect(metrics.guardrails.noOptimizerWrite).toBe(true);
        expect(metrics.guardrails.noPerformanceClaim).toBe(true);
        expect(metrics.guardrails.noTradingSignal).toBe(true);
    });

    it('PRODUCTION_READY is rejected', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        const tampered = {
            ...metrics,
            dataQualityFlags: [...metrics.dataQualityFlags, 'PRODUCTION_READY'],
        };
        const result = validateCorpusMetrics(tampered);
        expect(result.status).toBe('FAIL');
        expect(result.valid).toBe(false);
    });

    it('forbidden claims are rejected', () => {
        const metrics = buildCorpusMetrics(corpusEntries, {
            metricsRunId: 'p7-corpus-metrics-20260511-001',
            generatedAt: '2026-05-11T13:03:24.267+08:00',
            corpusPath: '/tmp/corpus.jsonl',
        });
        const tampered = {
            ...metrics,
            dataQualityFlags: [...metrics.dataQualityFlags, 'profit guaranteed'],
        };
        const result = validateCorpusMetrics(tampered);
        expect(result.status).toBe('FAIL');
        expect(result.valid).toBe(false);
    });
});
