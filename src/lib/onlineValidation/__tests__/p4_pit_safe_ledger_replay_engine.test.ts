/**
 * p4_pit_safe_ledger_replay_engine.test.ts
 *
 * Tests for PitSafeLedgerReplayEngine — P4 Online Validation
 */

import {
    buildReplayRun,
    buildReplayEligibilityAudit,
    validateReplayRun,
    REPLAY_ENGINE_VERSION,
    ReplayMode,
} from '../PitSafeLedgerReplayEngine';

import {
    buildReplayDataset,
    ReplayDataset,
    ReplayRecord,
    BuildReplayDatasetInput,
} from '../LedgerReplayDatasetBuilder';

// ─── Fixtures ─────────────────────────────────────────────────────

function makeLedgerEntry(symbol = '2330', sourceDate = '2026-05-09') {
    return {
        ledgerVersion: 'shadow-ledger-v1',
        entryType: 'SHADOW_PREDICTION',
        runId: 'test-run-001',
        asOfDate: '2026-05-11',
        universeTier: 'MVP_CORE',
        symbol,
        stockName: symbol === '2330' ? 'TSMC' : 'MediaTek',
        researchBucket: 'Strong',
        scoreSnapshot: { researchScore: 74.2 },
        confidenceSnapshot: 68,
        factorSnapshot: ['momentum'],
        riskSnapshot: ['concentration'],
        limitationSnapshot: [],
        dataCoverageSnapshot: { coverage: 'full' },
        sourceDateBasis: { sourceDate, sourceType: 'stockQuote', missingDataFlags: [] },
        targetHorizons: [],
        validationStatus: 'PASS',
        guardrailStatus: 'PASS',
        productionWriteAllowed: false as const,
    };
}

function makeWindow(symbol = '2330', horizonLabel = '5D', windowStatus = 'DUE_FOR_BACKFILL', targetTradingDate = '2026-05-18') {
    return {
        windowKey: `W|${symbol}|${horizonLabel}`,
        sourceLedgerKey: `SHADOW_PREDICTION|2026-05-11|${symbol}|MVP_CORE|test-run-001`,
        originalRunId: 'test-run-001',
        originalAsOfDate: '2026-05-11',
        symbol,
        stockName: symbol === '2330' ? 'TSMC' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays: horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60,
        targetTradingDate,
        reviewDate: '2026-06-30',
        windowStatus,
        pitSafeStatus: 'PIT_SAFE',
        backfillAllowed: windowStatus === 'DUE_FOR_BACKFILL',
        productionWriteAllowed: false as const,
        validationMessages: [],
    };
}

function makeOutcome(symbol = '2330', horizonLabel = '5D', outcomeStatus = 'READY_FOR_REVIEW') {
    return {
        originalRunId: 'test-run-001',
        originalAsOfDate: '2026-05-11',
        symbol,
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays: horizonLabel === '5D' ? 5 : 20,
        targetTradingDate: '2026-05-18',
        reviewDate: '2026-06-30',
        outcomeStatus,
        baseResearchScore: 74.2,
        baseResearchBucket: 'Strong',
        baseConfidenceScore: 68,
        closePriceAtPrediction: null,
        closePriceAtOutcome: outcomeStatus === 'READY_FOR_REVIEW' ? 1000 : null,
        returnPct: null,
        priceSource: outcomeStatus === 'READY_FOR_REVIEW' ? 'mock-deterministic' : null,
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false as const,
        validationMessages: [] as string[],
    };
}

function buildTestDataset(options: {
    symbols?: string[];
    horizons?: number[];
    windowStatus?: string;
    outcomeStatus?: string;
    reviewDate?: string;
    includeOutcome?: boolean;
} = {}): ReplayDataset {
    const {
        symbols = ['2330'],
        horizons = [5, 20, 60],
        windowStatus = 'DUE_FOR_BACKFILL',
        outcomeStatus = 'READY_FOR_REVIEW',
        reviewDate = '2026-06-30',
        includeOutcome = true,
    } = options;

    const HORIZON_DATES: Record<number, string> = { 5: '2026-05-18', 20: '2026-06-08', 60: '2026-08-04' };
    const HORIZON_LABELS: Record<number, string> = { 5: '5D', 20: '20D', 60: '60D' };

    const ledgerEntries = symbols.map(s => makeLedgerEntry(s));
    const windows = symbols.flatMap(s =>
        horizons.map(h => makeWindow(s, HORIZON_LABELS[h], h === 60 ? 'NOT_DUE' : windowStatus, HORIZON_DATES[h]))
    );
    const outcomeRecords = includeOutcome
        ? symbols.flatMap(s =>
            horizons.filter(h => h !== 60).map(h => makeOutcome(s, HORIZON_LABELS[h], outcomeStatus))
        )
        : [];

    const input: BuildReplayDatasetInput = { ledgerEntries, windows, outcomeRecords };
    return buildReplayDataset(input, { replayRunId: 'p4-test-001', reviewDate, horizons });
}

// ─── Tests ────────────────────────────────────────────────────────

describe('buildReplayRun — DATASET_ONLY mode', () => {
    it('builds run in DATASET_ONLY mode', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        expect(run.replayEngineVersion).toBe(REPLAY_ENGINE_VERSION);
        expect(run.mode).toBe('DATASET_ONLY');
        expect(run.dryRun).toBe(true);
        expect(run.inputRecordCount).toBe(dataset.records.length);
    });

    it('dryRun is always true', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        expect(run.dryRun).toBe(true);
    });

    it('productionWriteAllowed always false on run', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        expect(run.productionWriteAllowed).toBe(false);
    });

    it('simulationWriteAllowed always false on run', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        expect(run.simulationWriteAllowed).toBe(false);
    });

    it('productionWriteAllowed always false on records', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        for (const r of run.replayRecords) {
            expect(r.productionWriteAllowed).toBe(false);
        }
    });

    it('simulationWriteAllowed always false on records', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'DATASET_ONLY', dryRun: true });
        for (const r of run.replayRecords) {
            expect(r.simulationWriteAllowed).toBe(false);
        }
    });
});

describe('buildReplayRun — ELIGIBILITY_AUDIT mode', () => {
    it('builds run in ELIGIBILITY_AUDIT mode', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        expect(run.mode).toBe('ELIGIBILITY_AUDIT');
    });

    it('missing outcome count correct in audit summary', () => {
        const dataset = buildTestDataset({ includeOutcome: false, horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        expect(run.auditSummary.missingOutcomeCount).toBe(1);
    });

    it('not due count correct in audit summary', () => {
        const dataset = buildTestDataset({ horizons: [60] }); // 60D=NOT_DUE
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        expect(run.auditSummary.notDueCount).toBe(1);
    });

    it('blocked reason counts correct', () => {
        const dataset = buildTestDataset({ horizons: [5, 60], includeOutcome: false });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        const reasons = run.auditSummary.byBlockedReason;
        expect(reasons['OUTCOME_MISSING']).toBeGreaterThanOrEqual(1);
        expect(reasons['WINDOW_NOT_DUE']).toBeGreaterThanOrEqual(1);
    });

    it('rejects invalid mode', () => {
        const dataset = buildTestDataset();
        const run = buildReplayRun(dataset, {
            replayRunId: 'run-001', reviewDate: '2026-06-30',
            mode: 'INVALID_MODE' as ReplayMode, dryRun: true
        });
        expect(run.validationStatus).toBe('FAIL');
        expect(run.validationMessages.some(m => m.includes('Invalid mode'))).toBe(true);
    });
});

describe('buildReplayEligibilityAudit', () => {
    it('separates eligible and blocked records', () => {
        const dataset = buildTestDataset({ horizons: [5, 60] }); // 5D eligible, 60D not due
        const audit = buildReplayEligibilityAudit(dataset);
        expect(audit.eligibleRecords.length).toBe(dataset.eligibleCount);
        expect(audit.blockedRecords.length).toBe(dataset.blockedCount);
    });

    it('productionWriteAllowed=false on audit', () => {
        const dataset = buildTestDataset();
        const audit = buildReplayEligibilityAudit(dataset);
        expect(audit.productionWriteAllowed).toBe(false);
    });

    it('simulationWriteAllowed=false on audit', () => {
        const dataset = buildTestDataset();
        const audit = buildReplayEligibilityAudit(dataset);
        expect(audit.simulationWriteAllowed).toBe(false);
    });

    it('counts PIT violations correctly', () => {
        // Use a dataset with a PIT violation entry
        const pitEntry = makeLedgerEntry('2330', '2026-05-15'); // sourceDate > asOfDate
        const input: BuildReplayDatasetInput = {
            ledgerEntries: [pitEntry],
            windows: [makeWindow('2330', '5D', 'DUE_FOR_BACKFILL', '2026-05-18')],
            outcomeRecords: [makeOutcome('2330', '5D')],
        };
        const dataset = buildReplayDataset(input, { replayRunId: 'pit-test', reviewDate: '2026-06-30', horizons: [5] });
        const audit = buildReplayEligibilityAudit(dataset);
        expect(audit.pitViolationCount).toBe(1);
    });
});

describe('validateReplayRun', () => {
    it('PASS on valid run', () => {
        const dataset = buildTestDataset({ horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        const result = validateReplayRun(run);
        expect(result.validationStatus).toBe('PASS');
        expect(result.forbiddenClaimFound).toBe(false);
    });

    it('FAIL on forbidden claim in messages', () => {
        const dataset = buildTestDataset({ horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        run.validationMessages.push('guaranteed profit on buy signal');
        const result = validateReplayRun(run);
        expect(result.validationStatus).toBe('FAIL');
        expect(result.forbiddenClaimFound).toBe(true);
    });

    it('FAIL if productionWriteAllowed tampered on run', () => {
        const dataset = buildTestDataset({ horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        (run as { productionWriteAllowed: boolean }).productionWriteAllowed = true;
        const result = validateReplayRun(run);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('FAIL if simulationWriteAllowed tampered on run', () => {
        const dataset = buildTestDataset({ horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        (run as { simulationWriteAllowed: boolean }).simulationWriteAllowed = true;
        const result = validateReplayRun(run);
        expect(result.validationStatus).toBe('FAIL');
    });

    it('no forbidden claims in any output field', () => {
        const dataset = buildTestDataset({ horizons: [5, 20, 60] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'ELIGIBILITY_AUDIT', dryRun: true });
        const allText = [
            ...run.validationMessages,
            ...run.replayRecords.flatMap(r => r.validationMessages),
        ].join(' ');
        const forbidden = ['profit', 'guaranteed', 'buy', 'sell', 'auto trading', 'edge confirmed'];
        for (const word of forbidden) {
            expect(allText.toLowerCase()).not.toContain(word.toLowerCase());
        }
    });

    it('FAIL on invalid mode', () => {
        const dataset = buildTestDataset({ horizons: [5] });
        const run = buildReplayRun(dataset, { replayRunId: 'run-001', reviewDate: '2026-06-30', mode: 'INVALID_MODE' as ReplayMode, dryRun: true });
        const result = validateReplayRun(run);
        expect(result.validationStatus).toBe('FAIL');
    });
});
