/**
 * p4_ledger_replay_dataset_builder.test.ts
 *
 * Tests for LedgerReplayDatasetBuilder — P4 Online Validation
 */

import {
    buildReplayDatasetKey,
    parseReplaySourceArtifacts,
    buildReplayDataset,
    summarizeReplayDataset,
    validateReplayDataset,
    REPLAY_DATASET_VERSION,
    ReplaySourceLedgerEntry,
    OutcomeWindowRecord,
    P1OutcomeRecord,
    BuildReplayDatasetInput,
    BuildReplayDatasetOptions,
} from '../LedgerReplayDatasetBuilder';

// ─── Fixtures ─────────────────────────────────────────────────────

function makeLedgerEntry(overrides: Partial<ReplaySourceLedgerEntry> = {}): ReplaySourceLedgerEntry {
    return {
        ledgerVersion: 'shadow-ledger-v1',
        entryType: 'SHADOW_PREDICTION',
        runId: 'test-run-001',
        asOfDate: '2026-05-11',
        universeTier: 'MVP_CORE',
        symbol: '2330',
        stockName: 'TSMC',
        researchBucket: 'Strong',
        scoreSnapshot: { researchScore: 74.2 },
        confidenceSnapshot: 68,
        factorSnapshot: ['momentum'],
        riskSnapshot: ['concentration'],
        limitationSnapshot: ['limited forward visibility'],
        dataCoverageSnapshot: { coverage: 'full' },
        sourceDateBasis: { sourceDate: '2026-05-09', sourceType: 'stockQuote', missingDataFlags: [] },
        targetHorizons: [
            { horizonLabel: '5D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
            { horizonLabel: '20D', outcomeStatus: 'PENDING', outcomeWriteBackAllowed: false },
        ],
        ledgerKey: 'SHADOW_PREDICTION|2026-05-11|2330|MVP_CORE|test-run-001',
        validationStatus: 'PASS',
        guardrailStatus: 'PASS',
        productionWriteAllowed: false,
        ...overrides,
    };
}

function makeOutcomeWindow(overrides: Partial<OutcomeWindowRecord> = {}): OutcomeWindowRecord {
    return {
        windowKey: 'OUTCOME_WINDOW|2026-05-11|2330|MVP_CORE|test-run-001|5D',
        sourceLedgerKey: 'SHADOW_PREDICTION|2026-05-11|2330|MVP_CORE|test-run-001',
        originalRunId: 'test-run-001',
        originalAsOfDate: '2026-05-11',
        symbol: '2330',
        stockName: 'TSMC',
        universeTier: 'MVP_CORE',
        horizonLabel: '5D',
        horizonDays: 5,
        targetTradingDate: '2026-05-18',
        reviewDate: '2026-06-30',
        windowStatus: 'DUE_FOR_BACKFILL',
        pitSafeStatus: 'PIT_SAFE',
        backfillAllowed: true,
        productionWriteAllowed: false,
        validationMessages: [],
        ...overrides,
    };
}

function makeOutcomeRecord(overrides: Partial<P1OutcomeRecord> = {}): P1OutcomeRecord {
    return {
        originalRunId: 'test-run-001',
        originalAsOfDate: '2026-05-11',
        symbol: '2330',
        universeTier: 'MVP_CORE',
        horizonLabel: '5D',
        horizonDays: 5,
        targetTradingDate: '2026-05-18',
        reviewDate: '2026-06-30',
        outcomeStatus: 'READY_FOR_REVIEW',
        baseResearchScore: 74.2,
        baseResearchBucket: 'Strong',
        baseConfidenceScore: 68,
        closePriceAtPrediction: null,
        closePriceAtOutcome: 1000,
        returnPct: null,
        priceSource: 'mock-deterministic',
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false,
        validationMessages: [],
        ...overrides,
    };
}

function makeInput(
    entries: ReplaySourceLedgerEntry[] = [makeLedgerEntry()],
    windows: OutcomeWindowRecord[] = [makeOutcomeWindow()],
    outcomeRecords: P1OutcomeRecord[] = [makeOutcomeRecord()]
): BuildReplayDatasetInput {
    return { ledgerEntries: entries, windows, outcomeRecords };
}

function makeOptions(overrides: Partial<BuildReplayDatasetOptions> = {}): BuildReplayDatasetOptions {
    return {
        replayRunId: 'p4-replay-test-001',
        reviewDate: '2026-06-30',
        horizons: [5, 20, 60],
        requireOutcomeForDueWindows: false,
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────

describe('buildReplayDatasetKey', () => {
    it('produces deterministic key', () => {
        const entry: Pick<ReplaySourceLedgerEntry, 'asOfDate' | 'symbol' | 'universeTier' | 'runId'> = {
            asOfDate: '2026-05-11', symbol: '2330', universeTier: 'MVP_CORE', runId: 'run-001',
        };
        const key1 = buildReplayDatasetKey(entry, '5D');
        const key2 = buildReplayDatasetKey(entry, '5D');
        expect(key1).toBe(key2);
        expect(key1).toBe('REPLAY_DATASET|2026-05-11|2330|MVP_CORE|run-001|5D');
    });

    it('differs by horizonLabel', () => {
        const entry = { asOfDate: '2026-05-11', symbol: '2330', universeTier: 'MVP_CORE', runId: 'run-001' };
        expect(buildReplayDatasetKey(entry, '5D')).not.toBe(buildReplayDatasetKey(entry, '20D'));
    });

    it('differs by symbol', () => {
        const e1 = { asOfDate: '2026-05-11', symbol: '2330', universeTier: 'MVP_CORE', runId: 'run-001' };
        const e2 = { ...e1, symbol: '2454' };
        expect(buildReplayDatasetKey(e1, '5D')).not.toBe(buildReplayDatasetKey(e2, '5D'));
    });
});

describe('parseReplaySourceArtifacts', () => {
    it('parses valid ledger JSONL and window result', () => {
        const entry = makeLedgerEntry();
        const ledgerContent = JSON.stringify(entry);
        const windowResult = { windows: [makeOutcomeWindow()] };
        const result = parseReplaySourceArtifacts({ ledgerContent, outcomeWindowResult: windowResult });
        expect(result.ledgerEntries).toHaveLength(1);
        expect(result.windows).toHaveLength(1);
        expect(result.validationStatus).toBe('WARN'); // no outcome content = WARN
    });

    it('rejects malformed ledger JSONL', () => {
        const result = parseReplaySourceArtifacts({
            ledgerContent: 'not-json',
            outcomeWindowResult: { windows: [] },
        });
        expect(result.validationStatus).toBe('FAIL');
        expect(result.validationMessages.some(m => m.includes('Malformed JSONL'))).toBe(true);
    });

    it('WARNs on missing outcome content', () => {
        const ledgerContent = JSON.stringify(makeLedgerEntry());
        const result = parseReplaySourceArtifacts({ ledgerContent, outcomeWindowResult: { windows: [] } });
        expect(result.validationStatus).toBe('WARN');
        expect(result.validationMessages.some(m => m.includes('outcomeWriteBackJsonlContent not provided'))).toBe(true);
    });

    it('does not FAIL silently on missing optional outcome — produces WARN', () => {
        const ledgerContent = JSON.stringify(makeLedgerEntry());
        const result = parseReplaySourceArtifacts({
            ledgerContent,
            outcomeWindowResult: { windows: [] },
            // No outcomeWriteBackJsonlContent
        });
        expect(result.validationStatus).not.toBe('PASS');
        expect(result.outcomeRecords).toHaveLength(0);
    });
});

describe('buildReplayDataset', () => {
    it('produces expected record count', () => {
        const entries = [makeLedgerEntry()];
        const windows = [
            makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' }),
            makeOutcomeWindow({ horizonLabel: '20D', targetTradingDate: '2026-06-08', windowKey: 'w2', windowStatus: 'DUE_FOR_BACKFILL' }),
            makeOutcomeWindow({ horizonLabel: '60D', targetTradingDate: '2026-08-04', windowKey: 'w3', windowStatus: 'NOT_DUE' }),
        ];
        const outcome5D = makeOutcomeRecord({ horizonLabel: '5D' });
        const dataset = buildReplayDataset(makeInput(entries, windows, [outcome5D]), makeOptions());
        expect(dataset.totalRecords).toBe(3);
        expect(dataset.replayDatasetVersion).toBe(REPLAY_DATASET_VERSION);
    });

    it('sets productionWriteAllowed=false on all records', () => {
        const dataset = buildReplayDataset(makeInput(), makeOptions());
        for (const r of dataset.records) {
            expect(r.productionWriteAllowed).toBe(false);
        }
    });

    it('sets simulationWriteAllowed=false on all records', () => {
        const dataset = buildReplayDataset(makeInput(), makeOptions());
        for (const r of dataset.records) {
            expect(r.simulationWriteAllowed).toBe(false);
        }
    });

    it('reviewDate < targetTradingDate => NOT_DUE => replayEligible=false WINDOW_NOT_DUE', () => {
        const window60D = makeOutcomeWindow({ horizonLabel: '60D', targetTradingDate: '2026-08-04', windowStatus: 'NOT_DUE' });
        const entries = [makeLedgerEntry()];
        const dataset = buildReplayDataset(makeInput(entries, [window60D], []), makeOptions({ reviewDate: '2026-06-30', horizons: [60] }));
        const rec = dataset.records[0];
        expect(rec.replayEligible).toBe(false);
        expect(rec.replayBlockedReason).toBe('WINDOW_NOT_DUE');
    });

    it('DUE_FOR_BACKFILL without outcome => replayEligible=false OUTCOME_MISSING', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const dataset = buildReplayDataset(
            makeInput([makeLedgerEntry()], [window5D], []), // no outcome records
            makeOptions({ horizons: [5] })
        );
        const rec = dataset.records[0];
        expect(rec.replayEligible).toBe(false);
        expect(rec.replayBlockedReason).toBe('OUTCOME_MISSING');
    });

    it('READY_FOR_REVIEW with outcome => replayEligible=true', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        const rec = dataset.records[0];
        expect(rec.replayEligible).toBe(true);
        expect(rec.replayBlockedReason).toBe('NONE');
        expect(rec.outcomeSnapshot.outcomeAvailable).toBe(true);
    });

    it('sourceDate > asOfDate => blocked PIT_VIOLATION', () => {
        const entry = makeLedgerEntry({
            sourceDateBasis: { sourceDate: '2026-05-15', sourceType: 'stockQuote', missingDataFlags: [] },
        });
        const dataset = buildReplayDataset(makeInput([entry], [makeOutcomeWindow()], [makeOutcomeRecord()]), makeOptions({ horizons: [5] }));
        const rec = dataset.records[0];
        expect(rec.replayEligible).toBe(false);
        expect(rec.replayBlockedReason).toBe('PIT_VIOLATION');
        expect(rec.pitSafeStatus).toBe('PIT_VIOLATION');
    });

    it('validationStatus != PASS => VALIDATION_FAIL blocked', () => {
        const entry = makeLedgerEntry({ validationStatus: 'FAIL' });
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord();
        const dataset = buildReplayDataset(makeInput([entry], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        const rec = dataset.records[0];
        expect(rec.replayEligible).toBe(false);
        expect(rec.replayBlockedReason).toBe('VALIDATION_FAIL');
    });
});

describe('summarizeReplayDataset', () => {
    it('counts eligible and blocked correctly', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const window60D = makeOutcomeWindow({ horizonLabel: '60D', targetTradingDate: '2026-08-04', windowKey: 'w60', windowStatus: 'NOT_DUE' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D, window60D], [outcome]), makeOptions({ horizons: [5, 60] }));
        const summary = summarizeReplayDataset(dataset);
        expect(summary.totalRecords).toBe(2);
        expect(summary.eligibleCount).toBe(1); // 5D eligible
        expect(summary.blockedCount).toBe(1); // 60D not due
        expect(summary.byHorizon['5D']).toBe(1);
        expect(summary.byHorizon['60D']).toBe(1);
        expect(summary.symbolCount).toBeGreaterThan(0);
    });

    it('byReplayBlockedReason counts WINDOW_NOT_DUE and OUTCOME_MISSING', () => {
        const entries = [makeLedgerEntry()];
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const window60D = makeOutcomeWindow({ horizonLabel: '60D', targetTradingDate: '2026-08-04', windowKey: 'w60', windowStatus: 'NOT_DUE' });
        const dataset = buildReplayDataset(makeInput(entries, [window5D, window60D], []), makeOptions({ horizons: [5, 60] }));
        const summary = summarizeReplayDataset(dataset);
        expect(summary.byReplayBlockedReason['WINDOW_NOT_DUE']).toBe(1);
        expect(summary.byReplayBlockedReason['OUTCOME_MISSING']).toBe(1);
    });
});

describe('validateReplayDataset', () => {
    it('PASS on valid dataset', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        const result = validateReplayDataset(dataset);
        expect(result.validationStatus).toBe('PASS');
        expect(result.forbiddenClaimFound).toBe(false);
    });

    it('FAIL on forbidden claim in dataset messages', () => {
        const dataset = buildReplayDataset(makeInput(), makeOptions({ horizons: [] }));
        (dataset.validationMessages as string[]).push('buy signal confirmed');
        const result = validateReplayDataset(dataset);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.forbiddenClaimFound).toBe(true);
    });

    it('all productionWriteAllowed=false', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        for (const r of dataset.records) {
            expect(r.productionWriteAllowed).toBe(false);
        }
    });

    it('all simulationWriteAllowed=false', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        for (const r of dataset.records) {
            expect(r.simulationWriteAllowed).toBe(false);
        }
    });

    it('FAIL on invalid reviewDate format', () => {
        const dataset = buildReplayDataset(makeInput(), makeOptions({ horizons: [] }));
        (dataset as { reviewDate: string }).reviewDate = 'June 30 2026';
        const result = validateReplayDataset(dataset);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('replayEligible=true requires outcomeAvailable=true', () => {
        const window5D = makeOutcomeWindow({ horizonLabel: '5D', targetTradingDate: '2026-05-18', windowStatus: 'DUE_FOR_BACKFILL' });
        const outcome = makeOutcomeRecord({ outcomeStatus: 'READY_FOR_REVIEW', closePriceAtOutcome: 1000 });
        const dataset = buildReplayDataset(makeInput([makeLedgerEntry()], [window5D], [outcome]), makeOptions({ horizons: [5] }));
        // Tamper record
        const rec = dataset.records.find(r => r.replayEligible);
        if (rec) rec.outcomeSnapshot.outcomeAvailable = false;
        const result = validateReplayDataset(dataset);
        expect(result.validationStatus).toBe('FAIL');
    });
});
