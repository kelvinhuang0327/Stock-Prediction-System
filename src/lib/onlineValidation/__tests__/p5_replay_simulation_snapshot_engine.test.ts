/**
 * p5_replay_simulation_snapshot_engine.test.ts
 * P5 — ReplaySimulationSnapshotEngine tests
 */

import {
    buildSimulationSnapshotKey,
    buildSimulationSnapshotRecord,
    buildSimulationSnapshotBatch,
    validateSimulationSnapshotBatch,
    SIMULATION_SNAPSHOT_VERSION,
    SIMULATION_BATCH_VERSION,
} from '../ReplaySimulationSnapshotEngine';

// ── Fixtures ──────────────────────────────────────────────────────

function makeEligibleRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        replayRunId: 'p4-replay-run-001',
        originalRunId: 'p2-ledger-001',
        originalAsOfDate: '2026-05-11',
        symbol: '2330',
        stockName: 'TSMC',
        universeTier: 'TIER_1',
        horizonLabel: '5D',
        horizonDays: 5,
        targetTradingDate: '2026-05-18',
        researchBucket: 'RESEARCH_WATCH',
        replayEligible: true,
        replayBlockedReason: 'NONE',
        pitSafeStatus: 'PIT_SAFE',
        replayKey: 'REPLAY_DATASET|2026-05-11|2330|TIER_1|p2-ledger-001|5D',
        outcomeSnapshot: {
            closePriceAtPrediction: 950,
            closePriceAtOutcome: 1000,
            returnPct: 5.26,
            priceSource: 'TWSE_CLOSE',
            outcomeAvailable: true,
        },
        scoreSnapshot: { researchScore: 72 },
        confidenceSnapshot: null,
        factorSnapshot: [],
        riskSnapshot: [],
        limitationSnapshot: [],
        dataCoverageSnapshot: null,
        sourceDateBasis: { sourceDate: '2026-05-09' },
        validationMessages: [],
        ...overrides,
    };
}

function makeBlockedRecord(reason = 'WINDOW_NOT_DUE'): Record<string, unknown> {
    return makeEligibleRecord({
        replayEligible: false,
        replayBlockedReason: reason,
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: null,
            returnPct: null,
            priceSource: null,
            outcomeAvailable: false,
        },
    });
}

function makeReplayRun(records: Record<string, unknown>[]): Record<string, unknown> {
    return {
        replayRunId: 'p4-replay-run-001',
        replayRecords: records,
    };
}

const defaultOptions = {
    simulationRunId: 'p5-sim-001',
    reviewDate: '2026-06-30',
    mode: 'SNAPSHOT_ONLY' as const,
    dryRun: true as const,
};

// ── Tests ─────────────────────────────────────────────────────────

describe('buildSimulationSnapshotKey', () => {
    it('produces deterministic key', () => {
        const input = {
            replayRunId: 'r1',
            originalAsOfDate: '2026-05-11',
            symbol: '2330',
            universeTier: 'TIER_1',
            horizonLabel: '5D',
        };
        const key1 = buildSimulationSnapshotKey(input);
        const key2 = buildSimulationSnapshotKey(input);
        expect(key1).toBe(key2);
    });

    it('key contains expected segments', () => {
        const key = buildSimulationSnapshotKey({
            replayRunId: 'r1',
            originalAsOfDate: '2026-05-11',
            symbol: '2330',
            universeTier: 'TIER_1',
            horizonLabel: '5D',
        });
        expect(key).toBe('SIM_SNAPSHOT|r1|2026-05-11|2330|TIER_1|5D');
    });

    it('different symbols produce different keys', () => {
        const base = { replayRunId: 'r1', originalAsOfDate: '2026-05-11', universeTier: 'TIER_1', horizonLabel: '5D' };
        const k1 = buildSimulationSnapshotKey({ ...base, symbol: '2330' });
        const k2 = buildSimulationSnapshotKey({ ...base, symbol: '2454' });
        expect(k1).not.toBe(k2);
    });
});

describe('buildSimulationSnapshotRecord', () => {
    it('replayEligible=true + outcomeAvailable=true => SNAPSHOT_READY', () => {
        const rec = makeEligibleRecord();
        const snap = buildSimulationSnapshotRecord(rec, defaultOptions);
        expect(snap.snapshotStatus).toBe('SNAPSHOT_READY');
        expect(snap.snapshotBlockedReason).toBe('NONE');
    });

    it('replayEligible=false => SNAPSHOT_BLOCKED', () => {
        const rec = makeBlockedRecord('WINDOW_NOT_DUE');
        const snap = buildSimulationSnapshotRecord(rec, defaultOptions);
        expect(snap.snapshotStatus).toBe('SNAPSHOT_BLOCKED');
    });

    it('outcomeAvailable=false => SNAPSHOT_BLOCKED even if replayEligible=true', () => {
        const rec = makeEligibleRecord({
            outcomeSnapshot: {
                closePriceAtPrediction: null,
                closePriceAtOutcome: null,
                returnPct: null,
                priceSource: null,
                outcomeAvailable: false,
            },
        });
        const snap = buildSimulationSnapshotRecord(rec, defaultOptions);
        expect(snap.snapshotStatus).toBe('SNAPSHOT_BLOCKED');
        expect(snap.snapshotBlockedReason).toBe('OUTCOME_NOT_AVAILABLE');
    });

    it('productionWriteAllowed is always false', () => {
        const snap = buildSimulationSnapshotRecord(makeEligibleRecord(), defaultOptions);
        expect(snap.productionWriteAllowed).toBe(false);
    });

    it('simulationWriteAllowed is always false', () => {
        const snap = buildSimulationSnapshotRecord(makeEligibleRecord(), defaultOptions);
        expect(snap.simulationWriteAllowed).toBe(false);
    });

    it('optimizerWriteAllowed is always false', () => {
        const snap = buildSimulationSnapshotRecord(makeEligibleRecord(), defaultOptions);
        expect(snap.optimizerWriteAllowed).toBe(false);
    });

    it('productionWriteAllowed is false for blocked record', () => {
        const snap = buildSimulationSnapshotRecord(makeBlockedRecord(), defaultOptions);
        expect(snap.productionWriteAllowed).toBe(false);
    });

    it('simulationSnapshotVersion is correct', () => {
        const snap = buildSimulationSnapshotRecord(makeEligibleRecord(), defaultOptions);
        expect(snap.simulationSnapshotVersion).toBe(SIMULATION_SNAPSHOT_VERSION);
    });

    it('carries through outcome snapshot data for eligible records', () => {
        const snap = buildSimulationSnapshotRecord(makeEligibleRecord(), defaultOptions);
        expect(snap.outcomeSnapshot.closePriceAtOutcome).toBe(1000);
        expect(snap.outcomeSnapshot.outcomeAvailable).toBe(true);
    });
});

describe('buildSimulationSnapshotBatch', () => {
    it('counts ready/blocked correctly', () => {
        const records = [
            makeEligibleRecord({ symbol: '2330' }),
            makeEligibleRecord({ symbol: '2454', horizonLabel: '20D' }),
            makeBlockedRecord('WINDOW_NOT_DUE'),
        ];
        const batch = buildSimulationSnapshotBatch(makeReplayRun(records), defaultOptions);
        expect(batch.snapshotReadyCount).toBe(2);
        expect(batch.snapshotBlockedCount).toBe(1);
        expect(batch.inputRecordCount).toBe(3);
    });

    it('dryRun is always true', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([makeEligibleRecord()]), defaultOptions);
        expect(batch.dryRun).toBe(true);
    });

    it('simulationBatchVersion is correct', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([]), defaultOptions);
        expect(batch.simulationBatchVersion).toBe(SIMULATION_BATCH_VERSION);
    });

    it('includeBlocked=false excludes blocked snapshots from output', () => {
        const records = [makeEligibleRecord(), makeBlockedRecord()];
        const batch = buildSimulationSnapshotBatch(makeReplayRun(records), {
            ...defaultOptions,
            includeBlocked: false,
        });
        expect(batch.snapshots.length).toBe(1);
        expect(batch.snapshots[0].snapshotStatus).toBe('SNAPSHOT_READY');
        // Counts still reflect the full input
        expect(batch.snapshotReadyCount).toBe(1);
        expect(batch.snapshotBlockedCount).toBe(1);
    });

    it('includeBlocked=true (default) includes all snapshots', () => {
        const records = [makeEligibleRecord(), makeBlockedRecord()];
        const batch = buildSimulationSnapshotBatch(makeReplayRun(records), {
            ...defaultOptions,
            includeBlocked: true,
        });
        expect(batch.snapshots.length).toBe(2);
    });

    it('sourceReplayRunId matches input replay run', () => {
        const run = makeReplayRun([makeEligibleRecord()]);
        run['replayRunId'] = 'p4-specific-run';
        const batch = buildSimulationSnapshotBatch(run, defaultOptions);
        expect(batch.sourceReplayRunId).toBe('p4-specific-run');
    });
});

describe('validateSimulationSnapshotBatch', () => {
    it('PASS for valid batch', () => {
        const batch = buildSimulationSnapshotBatch(
            makeReplayRun([makeEligibleRecord(), makeBlockedRecord()]),
            defaultOptions,
        );
        const result = validateSimulationSnapshotBatch(batch);
        expect(result.valid).toBe(true);
        expect(result.status).toBe('PASS');
    });

    it('rejects SNAPSHOT_READY without outcomeAvailable', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([makeEligibleRecord()]), defaultOptions);
        // Manually corrupt
        batch.snapshots[0].outcomeSnapshot.outcomeAvailable = false;
        const result = validateSimulationSnapshotBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.status).toBe('FAIL');
        expect(result.messages.some(m => m.includes('without outcomeAvailable'))).toBe(true);
    });

    it('rejects dryRun=false', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([]), defaultOptions);
        // @ts-expect-error testing runtime enforcement
        batch.dryRun = false;
        const result = validateSimulationSnapshotBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.messages.some(m => m.includes('dryRun'))).toBe(true);
    });

    it('rejects forbidden claim in validation messages', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([makeEligibleRecord()]), defaultOptions);
        batch.snapshots[0].validationMessages.push('guaranteed profit');
        const result = validateSimulationSnapshotBatch(batch);
        expect(result.valid).toBe(false);
        expect(result.messages.some(m => m.includes('forbidden claim'))).toBe(true);
    });

    it('rejects forbidden claim in batch messages', () => {
        const batch = buildSimulationSnapshotBatch(makeReplayRun([]), defaultOptions);
        batch.validationMessages.push('this will outperform everything');
        const result = validateSimulationSnapshotBatch(batch);
        expect(result.valid).toBe(false);
    });
});
