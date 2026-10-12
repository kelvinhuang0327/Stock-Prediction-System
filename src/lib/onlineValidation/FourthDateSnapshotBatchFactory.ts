/**
 * FourthDateSnapshotBatchFactory.ts — P9 Online Validation
 *
 * Deterministic fourth-date (2026-05-14) simulation snapshot batch factory.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - Three write locks always false
 */

export const FOURTH_DATE_AS_OF_DATE = '2026-05-14';
export const FOURTH_DATE_REVIEW_DATE = '2026-07-03';
export const FOURTH_DATE_SIMULATION_RUN_ID = 'p9-fourth-date-simulation-20260514-001';
export const FOURTH_DATE_SOURCE_REPLAY_RUN_ID = 'p9-fourth-date-replay-fixture-20260514-001';

const SNAPSHOT_VERSION = 'sim-snapshot-v0';
const BATCH_VERSION = 'sim-batch-v0';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';
const P8_RUN_ID = 'p8-third-date-simulation-20260513-001';

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
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

export interface FourthDateSnapshotSeed {
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    source: 'DETERMINISTIC_TEST_FIXTURE';
    sourceReplayRunId: string;
    symbols: string[];
    horizons: string[];
}

export interface FourthDateSnapshotBatch {
    simulationBatchVersion: string;
    simulationRunId: string;
    sourceReplayRunId: string;
    reviewDate: string;
    mode: 'SNAPSHOT_ONLY';
    dryRun: boolean;
    inputRecordCount: number;
    snapshotReadyCount: number;
    snapshotBlockedCount: number;
    snapshots: FourthDateSnapshot[];
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface FourthDateSnapshot {
    simulationSnapshotVersion: string;
    simulationRunId: string;
    simulationSnapshotKey: string;
    replayKey: string;
    originalRunId: string;
    originalAsOfDate: string;
    symbol: string;
    stockName: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    reviewDate: string;
    researchBucket: string;
    scoreSnapshot: Record<string, unknown>;
    confidenceSnapshot: number;
    factorSnapshot: string[];
    riskSnapshot: string[];
    limitationSnapshot: string[];
    dataCoverageSnapshot: Record<string, unknown>;
    sourceDateBasis: Record<string, unknown>;
    outcomeSnapshot: {
        closePriceAtPrediction: null;
        closePriceAtOutcome: number | null;
        returnPct: number | null;
        priceSource: string;
        outcomeAvailable: boolean;
    };
    snapshotStatus: 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED';
    snapshotBlockedReason: string;
    pitSafeStatus: string;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    optimizerWriteAllowed: false;
    validationMessages: string[];
}

export interface FourthDateBatchValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Seed builder ────────────────────────────────────────────────

export function buildFourthDateSnapshotSeed(
    options: Partial<{
        asOfDate: string;
        reviewDate: string;
        simulationRunId: string;
    }> = {},
): FourthDateSnapshotSeed {
    return {
        asOfDate: options.asOfDate ?? FOURTH_DATE_AS_OF_DATE,
        reviewDate: options.reviewDate ?? FOURTH_DATE_REVIEW_DATE,
        simulationRunId: options.simulationRunId ?? FOURTH_DATE_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: FOURTH_DATE_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

// ─── Snapshot builder ─────────────────────────────────────────────

function buildSnapshot(
    seed: FourthDateSnapshotSeed,
    symbol: string,
    horizonLabel: string,
): FourthDateSnapshot {
    // Fourth date: both symbols fully ready for 5D and 20D, 60D remains blocked
    const isReady = horizonLabel === '5D' || horizonLabel === '20D';
    const snapshotBlockedReason = isReady ? 'NONE' : 'WINDOW_NOT_DUE';
    const horizonDays = horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60;
    const targetTradingDate =
        horizonLabel === '5D'
            ? '2026-05-21'
            : horizonLabel === '20D'
                ? '2026-06-11'
                : '2026-08-05';

    const simulationSnapshotKey = `SIM_SNAPSHOT|${seed.sourceReplayRunId}|${seed.asOfDate}|${symbol}|MVP_CORE|${horizonLabel}`;

    return {
        simulationSnapshotVersion: SNAPSHOT_VERSION,
        simulationRunId: seed.simulationRunId,
        simulationSnapshotKey,
        replayKey: `REPLAY_DATASET|${seed.asOfDate}|${symbol}|MVP_CORE|${seed.simulationRunId}|${horizonLabel}`,
        originalRunId: seed.simulationRunId,
        originalAsOfDate: seed.asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays,
        targetTradingDate,
        reviewDate: seed.reviewDate,
        researchBucket: isReady ? 'Strong' : 'Watch',
        scoreSnapshot: {
            researchScore: isReady ? 78.0 : 45.0,
            confidenceScore: isReady ? 71 : 34,
            technicalScore: isReady ? 80 : 43,
            chipScore: isReady ? 74 : 41,
            fundamentalScore: isReady ? 83 : 42,
            marketAdjustment: isReady ? 6 : -1,
        },
        confidenceSnapshot: isReady ? 71 : 34,
        factorSnapshot: isReady
            ? ['deterministic fixture day4 momentum', 'observability-only corpus entry']
            : ['deterministic fixture day4 horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration watch'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic fourth-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-13',
            sourceType: 'DETERMINISTIC_TEST_FIXTURE',
            missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
        },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1030 : 990) : null,
            returnPct: isReady ? (symbol === '2330' ? 1.8 : 2.3) : null,
            priceSource: 'deterministic-fixture',
            outcomeAvailable: isReady,
        },
        snapshotStatus: isReady ? 'SNAPSHOT_READY' : 'SNAPSHOT_BLOCKED',
        snapshotBlockedReason,
        pitSafeStatus: 'PIT_SAFE',
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationMessages: isReady
            ? ['DETERMINISTIC_TEST_FIXTURE_READY']
            : [`DETERMINISTIC_TEST_FIXTURE_BLOCKED:${snapshotBlockedReason}`],
    };
}

// ─── Public exports ───────────────────────────────────────────────

export function buildFourthDateSimulationSnapshots(
    seed: FourthDateSnapshotSeed,
): FourthDateSnapshot[] {
    const snapshots: FourthDateSnapshot[] = [];
    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            snapshots.push(buildSnapshot(seed, symbol, horizonLabel));
        }
    }
    return snapshots;
}

export function buildFourthDateSimulationSnapshotBatch(
    seed: FourthDateSnapshotSeed,
): FourthDateSnapshotBatch {
    const snapshots = buildFourthDateSimulationSnapshots(seed);
    const snapshotReadyCount = snapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    return {
        simulationBatchVersion: BATCH_VERSION,
        simulationRunId: seed.simulationRunId,
        sourceReplayRunId: seed.sourceReplayRunId,
        reviewDate: seed.reviewDate,
        mode: 'SNAPSHOT_ONLY',
        dryRun: true,
        inputRecordCount: snapshots.length,
        snapshotReadyCount,
        snapshotBlockedCount: snapshots.length - snapshotReadyCount,
        snapshots,
        validationStatus: 'PASS',
        validationMessages: [
            `Deterministic fourth-date fixture generated: ${snapshots.length} snapshots`,
        ],
    };
}

export function validateFourthDateSnapshotBatch(
    batch: FourthDateSnapshotBatch,
): FourthDateBatchValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (batch.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        valid = false;
    }
    if (batch.simulationRunId === P5_RUN_ID) {
        messages.push('FAIL: simulationRunId must differ from P5');
        valid = false;
    }
    if (batch.simulationRunId === P7_RUN_ID) {
        messages.push('FAIL: simulationRunId must differ from P7');
        valid = false;
    }
    if (batch.simulationRunId === P8_RUN_ID) {
        messages.push('FAIL: simulationRunId must differ from P8');
        valid = false;
    }
    if (batch.snapshots.length < 6) {
        messages.push(`FAIL: expected at least 6 snapshots, got ${batch.snapshots.length}`);
        valid = false;
    }
    if (batch.snapshotReadyCount < 3) {
        messages.push(`FAIL: expected at least 3 SNAPSHOT_READY, got ${batch.snapshotReadyCount}`);
        valid = false;
    }
    const asOfDates = new Set(batch.snapshots.map(s => s.originalAsOfDate));
    if (asOfDates.size !== 1 || !asOfDates.has(FOURTH_DATE_AS_OF_DATE)) {
        messages.push(`FAIL: originalAsOfDate must be ${FOURTH_DATE_AS_OF_DATE}`);
        valid = false;
    }
    for (const snapshot of batch.snapshots) {
        if (snapshot.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
        if (snapshot.simulationWriteAllowed !== false) {
            messages.push(`FAIL: simulationWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
        if (snapshot.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
    }
    if (hasForbiddenClaim(JSON.stringify(batch))) {
        messages.push('FAIL: forbidden claim detected in batch');
        valid = false;
    }

    if (valid) messages.push('PASS: deterministic fourth-date batch safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
