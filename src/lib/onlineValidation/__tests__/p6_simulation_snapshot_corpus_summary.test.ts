/**
 * p6_simulation_snapshot_corpus_summary.test.ts
 *
 * Tests for SimulationSnapshotCorpusSummary (P6)
 */

import {
    summarizeSnapshotCorpus,
    buildCorpusReadinessDecision,
    validateCorpusReadinessDecision,
    CorpusReadinessDecision,
} from '../SimulationSnapshotCorpusSummary';
import {
    normalizeSnapshotForCorpus,
    CorpusEntry,
} from '../SimulationSnapshotCorpusAccumulator';

// ─── Fixtures ─────────────────────────────────────────────────────

const baseSnapshot = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    simulationRunId: 'p5-replay-simulation-20260511-001',
    simulationSnapshotKey: 'SIM_SNAPSHOT|p4|2026-05-11|2330|MVP_CORE|5D',
    replayKey: 'REPLAY|2026-05-11|2330|MVP_CORE|5D',
    originalRunId: 'p2-run-001',
    originalAsOfDate: '2026-05-11',
    symbol: '2330',
    stockName: 'TSMC',
    universeTier: 'MVP_CORE',
    horizonLabel: '5D',
    horizonDays: 5,
    targetTradingDate: '2026-05-18',
    reviewDate: '2026-06-30',
    researchBucket: 'WATCH',
    scoreSnapshot: { researchScore: 0.7 },
    confidenceSnapshot: null,
    factorSnapshot: [],
    riskSnapshot: [],
    limitationSnapshot: [],
    dataCoverageSnapshot: null,
    sourceDateBasis: '2026-05-11',
    outcomeSnapshot: { outcomeAvailable: true },
    snapshotStatus: 'SNAPSHOT_READY',
    snapshotBlockedReason: 'NONE',
    pitSafeStatus: 'PIT_SAFE',
    productionWriteAllowed: false,
    simulationWriteAllowed: false,
    optimizerWriteAllowed: false,
    validationMessages: [],
    ...overrides,
});

const makeEntry = (overrides: Record<string, unknown> = {}): CorpusEntry =>
    normalizeSnapshotForCorpus(baseSnapshot(overrides), {
        corpusRunId: 'p6-corpus-001',
        ingestionDate: '2026-05-11',
    });

const readyEntry5D = makeEntry();
const readyEntry20D = makeEntry({ horizonLabel: '20D', horizonDays: 20 });
const ready2454 = makeEntry({ symbol: '2454', stockName: 'MediaTek', horizonLabel: '5D' });
const blocked60D = makeEntry({
    symbol: '2330',
    horizonLabel: '60D',
    horizonDays: 60,
    snapshotStatus: 'SNAPSHOT_BLOCKED',
    snapshotBlockedReason: 'WINDOW_NOT_DUE',
    outcomeSnapshot: { outcomeAvailable: false },
});
const blockedOutcomeMissing = makeEntry({
    symbol: '2454',
    horizonLabel: '20D',
    horizonDays: 20,
    snapshotStatus: 'SNAPSHOT_BLOCKED',
    snapshotBlockedReason: 'OUTCOME_MISSING',
    outcomeSnapshot: { outcomeAvailable: false },
});

// ─── summarizeSnapshotCorpus ──────────────────────────────────────

describe('summarizeSnapshotCorpus', () => {
    it('counts total, ready, blocked correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, blocked60D]);
        expect(s.totalEntries).toBe(3);
        expect(s.readyCount).toBe(2);
        expect(s.blockedCount).toBe(1);
    });

    it('coverageRatio = readyCount / totalEntries', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, blocked60D]);
        expect(s.coverageRatio).toBeCloseTo(2 / 3, 5);
    });

    it('coverageRatio is 0 when totalEntries=0', () => {
        const s = summarizeSnapshotCorpus([]);
        expect(s.coverageRatio).toBe(0);
        expect(s.totalEntries).toBe(0);
    });

    it('byHorizon groups correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, blocked60D]);
        expect(s.byHorizon['5D']).toBe(1);
        expect(s.byHorizon['20D']).toBe(1);
        expect(s.byHorizon['60D']).toBe(1);
    });

    it('bySymbol groups correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, ready2454]);
        expect(s.bySymbol['2330']).toBe(1);
        expect(s.bySymbol['2454']).toBe(1);
    });

    it('byAsOfDate groups correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D]);
        expect(s.byAsOfDate['2026-05-11']).toBe(2);
        expect(s.uniqueAsOfDateCount).toBe(1);
    });

    it('byResearchBucket groups correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D]);
        expect(s.byResearchBucket['WATCH']).toBe(1);
    });

    it('bySnapshotStatus groups correctly', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, blocked60D]);
        expect(s.bySnapshotStatus['SNAPSHOT_READY']).toBe(1);
        expect(s.bySnapshotStatus['SNAPSHOT_BLOCKED']).toBe(1);
    });

    it('byBlockedReason groups correctly', () => {
        const s = summarizeSnapshotCorpus([blocked60D, blockedOutcomeMissing]);
        expect(s.byBlockedReason['WINDOW_NOT_DUE']).toBe(1);
        expect(s.byBlockedReason['OUTCOME_MISSING']).toBe(1);
    });

    it('outcomeAvailableCount and missingOutcomeCount correct', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, blocked60D]);
        expect(s.outcomeAvailableCount).toBe(1);
        expect(s.missingOutcomeCount).toBe(1);
    });

    it('uniqueSymbolCount correct', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, ready2454]);
        expect(s.uniqueSymbolCount).toBe(2);
    });
});

// ─── buildCorpusReadinessDecision ────────────────────────────────

describe('buildCorpusReadinessDecision', () => {
    it('READY_FOR_OBSERVABILITY_ONLY_CORPUS when thresholds met', () => {
        const allSix = [readyEntry5D, readyEntry20D, ready2454, blocked60D, blockedOutcomeMissing,
            makeEntry({ symbol: '2454', horizonLabel: '60D' })];
        const s = summarizeSnapshotCorpus(allSix);
        const d = buildCorpusReadinessDecision(s, { minReadyCount: 3, minUniqueSymbolCount: 2, minCoverageRatio: 0.5 });
        expect(d.readinessStatus).toBe('READY_FOR_OBSERVABILITY_ONLY_CORPUS');
        expect(d.corpusReady).toBe(true);
    });

    it('BLOCKED when readyCount=0', () => {
        const s = summarizeSnapshotCorpus([blocked60D]);
        const d = buildCorpusReadinessDecision(s);
        expect(d.readinessStatus).toBe('BLOCKED');
        expect(d.corpusReady).toBe(false);
    });

    it('BLOCKED when totalEntries=0', () => {
        const s = summarizeSnapshotCorpus([]);
        const d = buildCorpusReadinessDecision(s);
        expect(d.readinessStatus).toBe('BLOCKED');
    });

    it('DATA_LIMITED when requireNoMissingOutcome=true and missingOutcomeCount>0', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, ready2454, blocked60D]);
        const d = buildCorpusReadinessDecision(s, { requireNoMissingOutcome: true });
        expect(d.readinessStatus).toBe('DATA_LIMITED');
        expect(d.corpusReady).toBe(false);
    });

    it('DATA_LIMITED when readyCount < minReadyCount threshold', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D]);
        const d = buildCorpusReadinessDecision(s, { minReadyCount: 3 });
        expect(d.readinessStatus).toBe('DATA_LIMITED');
    });

    it('guardrails are all true', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D]);
        const d = buildCorpusReadinessDecision(s);
        expect(d.guardrails.noProductionWrite).toBe(true);
        expect(d.guardrails.noSimulationWrite).toBe(true);
        expect(d.guardrails.noOptimizerWrite).toBe(true);
        expect(d.guardrails.noPerformanceClaim).toBe(true);
        expect(d.guardrails.noTradingSignal).toBe(true);
    });

    it('PRODUCTION_READY status is never returned', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, ready2454]);
        const d = buildCorpusReadinessDecision(s);
        expect(d.readinessStatus).not.toBe('PRODUCTION_READY');
    });

    it('corpusReady=true does not imply production ready', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D, readyEntry20D, ready2454]);
        const d = buildCorpusReadinessDecision(s, { minReadyCount: 3, minUniqueSymbolCount: 2 });
        if (d.corpusReady) {
            expect(d.readinessStatus).toBe('READY_FOR_OBSERVABILITY_ONLY_CORPUS');
            expect(d.readinessStatus).not.toBe('PRODUCTION_READY');
        }
    });
});

// ─── validateCorpusReadinessDecision ─────────────────────────────

describe('validateCorpusReadinessDecision', () => {
    it('validates a valid decision as PASS', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D]);
        const d = buildCorpusReadinessDecision(s);
        const result = validateCorpusReadinessDecision(d);
        expect(result.status).toBe('PASS');
        expect(result.valid).toBe(true);
    });

    it('rejects PRODUCTION_READY readinessStatus', () => {
        const d: CorpusReadinessDecision = {
            readinessVersion: 'v0',
            corpusReady: true,
            readinessStatus: 'PRODUCTION_READY' as unknown as never,
            reasons: [],
            guardrails: {
                noProductionWrite: true,
                noSimulationWrite: true,
                noOptimizerWrite: true,
                noPerformanceClaim: true,
                noTradingSignal: true,
            },
        };
        const result = validateCorpusReadinessDecision(d);
        expect(result.status).toBe('FAIL');
    });

    it('rejects false guardrails', () => {
        const d: CorpusReadinessDecision = {
            readinessVersion: 'v0',
            corpusReady: false,
            readinessStatus: 'BLOCKED',
            reasons: [],
            guardrails: {
                noProductionWrite: false as unknown as true,
                noSimulationWrite: true,
                noOptimizerWrite: true,
                noPerformanceClaim: true,
                noTradingSignal: true,
            },
        };
        const result = validateCorpusReadinessDecision(d);
        expect(result.status).toBe('FAIL');
    });

    it('rejects forbidden claims in reasons', () => {
        const s = summarizeSnapshotCorpus([readyEntry5D]);
        const d = buildCorpusReadinessDecision(s);
        const tampered: CorpusReadinessDecision = {
            ...d,
            reasons: ['profit guaranteed always'],
        };
        const result = validateCorpusReadinessDecision(tampered);
        expect(result.status).toBe('FAIL');
    });
});
