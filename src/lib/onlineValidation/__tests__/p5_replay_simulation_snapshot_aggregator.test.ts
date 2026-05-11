/**
 * p5_replay_simulation_snapshot_aggregator.test.ts
 * P5 — ReplaySimulationSnapshotAggregator tests
 */

import {
    summarizeSimulationSnapshots,
    buildSimulationReadinessDecision,
    validateSimulationReadinessDecision,
    READINESS_VERSION,
} from '../ReplaySimulationSnapshotAggregator';
import {
    buildSimulationSnapshotBatch,
    SimulationSnapshotBatch,
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
        scoreSnapshot: {},
        confidenceSnapshot: null,
        factorSnapshot: [],
        riskSnapshot: [],
        limitationSnapshot: [],
        dataCoverageSnapshot: null,
        sourceDateBasis: null,
        validationMessages: [],
        ...overrides,
    };
}

function makeBlockedRecord(reason = 'WINDOW_NOT_DUE', horizonLabel = '60D'): Record<string, unknown> {
    return makeEligibleRecord({
        horizonLabel,
        replayEligible: false,
        replayBlockedReason: reason,
        researchBucket: 'RESEARCH_MONITOR',
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: null,
            returnPct: null,
            priceSource: null,
            outcomeAvailable: false,
        },
    });
}

function makeBatch(records: Record<string, unknown>[]): SimulationSnapshotBatch {
    return buildSimulationSnapshotBatch(
        { replayRunId: 'p4-run-001', replayRecords: records },
        { simulationRunId: 'p5-sim-001', reviewDate: '2026-06-30', mode: 'SNAPSHOT_ONLY', dryRun: true, includeBlocked: true },
    );
}

// ── Tests ─────────────────────────────────────────────────────────

describe('summarizeSimulationSnapshots', () => {
    it('readyCount correct', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.readyCount).toBe(1);
    });

    it('blockedCount correct', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord(), makeBlockedRecord('OUTCOME_MISSING', '20D')]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.blockedCount).toBe(2);
    });

    it('totalSnapshots correct', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.totalSnapshots).toBe(2);
    });

    it('counts by horizon', () => {
        const batch = makeBatch([
            makeEligibleRecord({ horizonLabel: '5D' }),
            makeBlockedRecord('WINDOW_NOT_DUE', '60D'),
        ]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.byHorizon['5D']).toBe(1);
        expect(summary.byHorizon['60D']).toBe(1);
    });

    it('counts by researchBucket', () => {
        const batch = makeBatch([
            makeEligibleRecord({ researchBucket: 'RESEARCH_WATCH' }),
            makeBlockedRecord('WINDOW_NOT_DUE', '60D'),
        ]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.byResearchBucket['RESEARCH_WATCH']).toBe(1);
        expect(summary.byResearchBucket['RESEARCH_MONITOR']).toBe(1);
    });

    it('counts by snapshotStatus', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.bySnapshotStatus['SNAPSHOT_READY']).toBe(1);
        expect(summary.bySnapshotStatus['SNAPSHOT_BLOCKED']).toBe(1);
    });

    it('counts by blockedReason', () => {
        const batch = makeBatch([
            makeEligibleRecord(),
            makeBlockedRecord('WINDOW_NOT_DUE', '60D'),
            makeBlockedRecord('OUTCOME_MISSING', '20D'),
        ]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.byBlockedReason['WINDOW_NOT_DUE']).toBe(1);
        expect(summary.byBlockedReason['OUTCOME_MISSING']).toBe(1);
    });

    it('outcomeAvailableCount correct', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.outcomeAvailableCount).toBe(1);
    });

    it('missingOutcomeCount correct', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.missingOutcomeCount).toBe(2);
    });

    it('symbolCount correct', () => {
        const batch = makeBatch([
            makeEligibleRecord({ symbol: '2330' }),
            makeEligibleRecord({ symbol: '2454', horizonLabel: '20D' }),
            makeBlockedRecord(),
        ]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.symbolCount).toBe(2);
    });

    it('date range fields populated', () => {
        const batch = makeBatch([makeEligibleRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        expect(summary.earliestAsOfDate).toBe('2026-05-11');
        expect(summary.latestAsOfDate).toBe('2026-05-11');
        expect(summary.earliestTargetTradingDate).not.toBeNull();
    });
});

describe('buildSimulationReadinessDecision', () => {
    it('READY when readyCount >= minReadyCount (default 1)', () => {
        const batch = makeBatch([makeEligibleRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        const decision = buildSimulationReadinessDecision(summary);
        expect(decision.simulationReady).toBe(true);
        expect(decision.readinessStatus).toBe('READY_FOR_OBSERVABILITY_ONLY_SIMULATION');
    });

    it('BLOCKED when readyCount=0', () => {
        const batch = makeBatch([makeBlockedRecord(), makeBlockedRecord('OUTCOME_MISSING', '20D')]);
        const summary = summarizeSimulationSnapshots(batch);
        const decision = buildSimulationReadinessDecision(summary);
        expect(decision.simulationReady).toBe(false);
        expect(decision.readinessStatus).toBe('BLOCKED');
    });

    it('DATA_LIMITED when requireAllOutcomesAvailable=true and missingOutcomeCount>0', () => {
        const batch = makeBatch([makeEligibleRecord(), makeBlockedRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        const decision = buildSimulationReadinessDecision(summary, { requireAllOutcomesAvailable: true });
        expect(decision.simulationReady).toBe(false);
        expect(decision.readinessStatus).toBe('DATA_LIMITED');
    });

    it('guardrails all true', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeEligibleRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        expect(decision.guardrails.noProductionWrite).toBe(true);
        expect(decision.guardrails.noSimulationWrite).toBe(true);
        expect(decision.guardrails.noOptimizerWrite).toBe(true);
        expect(decision.guardrails.noPerformanceClaim).toBe(true);
    });

    it('readinessVersion is set', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([]));
        const decision = buildSimulationReadinessDecision(summary);
        expect(decision.readinessVersion).toBe(READINESS_VERSION);
    });

    it('READY when readyCount >= custom minReadyCount', () => {
        const batch = makeBatch([
            makeEligibleRecord({ symbol: '2330' }),
            makeEligibleRecord({ symbol: '2454', horizonLabel: '20D' }),
        ]);
        const summary = summarizeSimulationSnapshots(batch);
        const decision = buildSimulationReadinessDecision(summary, { minReadyCount: 2 });
        expect(decision.simulationReady).toBe(true);
    });

    it('DATA_LIMITED when readyCount < minReadyCount (but > 0)', () => {
        const batch = makeBatch([makeEligibleRecord()]);
        const summary = summarizeSimulationSnapshots(batch);
        const decision = buildSimulationReadinessDecision(summary, { minReadyCount: 5 });
        expect(decision.simulationReady).toBe(false);
        expect(decision.readinessStatus).toBe('DATA_LIMITED');
    });
});

describe('validateSimulationReadinessDecision', () => {
    it('PASS for valid decision', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeEligibleRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        const result = validateSimulationReadinessDecision(decision);
        expect(result.valid).toBe(true);
        expect(result.status).toBe('PASS');
    });

    it('PRODUCTION_READY status rejected', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeEligibleRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        // @ts-expect-error testing runtime enforcement
        decision.readinessStatus = 'PRODUCTION_READY';
        const result = validateSimulationReadinessDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.messages.some(m => m.includes('PRODUCTION_READY'))).toBe(true);
    });

    it('rejects when guardrails noProductionWrite=false', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeEligibleRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        // @ts-expect-error testing runtime enforcement
        decision.guardrails.noProductionWrite = false;
        const result = validateSimulationReadinessDecision(decision);
        expect(result.valid).toBe(false);
    });

    it('rejects forbidden claim in reasons', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeEligibleRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        decision.reasons.push('guaranteed profit awaits');
        const result = validateSimulationReadinessDecision(decision);
        expect(result.valid).toBe(false);
        expect(result.messages.some(m => m.includes('forbidden claim'))).toBe(true);
    });

    it('PASS for BLOCKED decision', () => {
        const summary = summarizeSimulationSnapshots(makeBatch([makeBlockedRecord()]));
        const decision = buildSimulationReadinessDecision(summary);
        const result = validateSimulationReadinessDecision(decision);
        expect(result.valid).toBe(true);
    });
});
