/**
 * ThirdDateSnapshotBatchFactory.ts — P8 Online Validation
 *
 * Deterministic third-date (2026-05-13) simulation snapshot batch factory.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - Three write locks always false
 */

export const THIRD_DATE_AS_OF_DATE = '2026-05-13';
export const THIRD_DATE_REVIEW_DATE = '2026-07-02';
export const THIRD_DATE_SIMULATION_RUN_ID = 'p8-third-date-simulation-20260513-001';
export const THIRD_DATE_SOURCE_REPLAY_RUN_ID = 'p8-third-date-replay-fixture-20260513-001';

const SNAPSHOT_VERSION = 'sim-snapshot-v0';
const BATCH_VERSION = 'sim-batch-v0';

const P5_RUN_ID = 'p5-replay-simulation-20260511-001';
const P7_RUN_ID = 'p7-second-date-simulation-20260512-001';

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
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export interface ThirdDateSnapshotSeed {
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    source: 'DETERMINISTIC_TEST_FIXTURE';
    sourceReplayRunId: string;
    symbols: string[];
    horizons: string[];
}

export interface ThirdDateSnapshotBatch {
    simulationBatchVersion: string;
    simulationRunId: string;
    sourceReplayRunId: string;
    reviewDate: string;
    mode: 'SNAPSHOT_ONLY';
    dryRun: boolean;
    inputRecordCount: number;
    snapshotReadyCount: number;
    snapshotBlockedCount: number;
    snapshots: ThirdDateSnapshot[];
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface ThirdDateSnapshot {
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

export interface ThirdDateBatchValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Seed builder ────────────────────────────────────────────────

export function buildThirdDateSnapshotSeed(
    options: Partial<{
        asOfDate: string;
        reviewDate: string;
        simulationRunId: string;
    }> = {},
): ThirdDateSnapshotSeed {
    return {
        asOfDate: options.asOfDate ?? THIRD_DATE_AS_OF_DATE,
        reviewDate: options.reviewDate ?? THIRD_DATE_REVIEW_DATE,
        simulationRunId: options.simulationRunId ?? THIRD_DATE_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: THIRD_DATE_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

// ─── Snapshot builder ─────────────────────────────────────────────

function buildSnapshot(
    seed: ThirdDateSnapshotSeed,
    symbol: string,
    horizonLabel: string,
): ThirdDateSnapshot {
    // For the third date, bump up ready count: 2330 all 3 ready, 2454 5D ready only
    const isReady =
        symbol === '2330' ||
        (symbol === '2454' && horizonLabel === '5D');

    const snapshotBlockedReason = isReady
        ? 'NONE'
        : horizonLabel === '60D'
            ? 'WINDOW_NOT_DUE'
            : 'OUTCOME_MISSING';

    const horizonDays = horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60;
    const targetTradingDate =
        horizonLabel === '5D'
            ? '2026-05-20'
            : horizonLabel === '20D'
                ? '2026-06-10'
                : '2026-08-04';

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
            researchScore: isReady ? 75.0 : 42.5,
            confidenceScore: isReady ? 68 : 32,
            technicalScore: isReady ? 77 : 41,
            chipScore: isReady ? 72 : 39,
            fundamentalScore: isReady ? 81 : 40,
            marketAdjustment: isReady ? 5 : -1,
        },
        confidenceSnapshot: isReady ? 68 : 32,
        factorSnapshot: isReady
            ? ['deterministic fixture day3 momentum', 'observability-only corpus entry']
            : ['deterministic fixture day3 horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration watch'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic third-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis: {
            sourceDate: '2026-05-12',
            sourceType: 'DETERMINISTIC_TEST_FIXTURE',
            missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
        },
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1025 : 985) : null,
            returnPct: isReady ? (symbol === '2330' ? 2.1 : 2.7) : null,
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

export function buildThirdDateSimulationSnapshots(
    seed: ThirdDateSnapshotSeed,
): ThirdDateSnapshot[] {
    const snapshots: ThirdDateSnapshot[] = [];
    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            snapshots.push(buildSnapshot(seed, symbol, horizonLabel));
        }
    }
    return snapshots;
}

export function buildThirdDateSimulationSnapshotBatch(
    seed: ThirdDateSnapshotSeed,
): ThirdDateSnapshotBatch {
    const snapshots = buildThirdDateSimulationSnapshots(seed);
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
            `Deterministic third-date fixture generated: ${snapshots.length} snapshots`,
        ],
    };
}

export function validateThirdDateSnapshotBatch(
    batch: ThirdDateSnapshotBatch,
): ThirdDateBatchValidationResult {
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
    if (batch.snapshots.length < 6) {
        messages.push(`FAIL: expected at least 6 snapshots, got ${batch.snapshots.length}`);
        valid = false;
    }
    if (batch.snapshotReadyCount < 3) {
        messages.push(`FAIL: expected at least 3 SNAPSHOT_READY, got ${batch.snapshotReadyCount}`);
        valid = false;
    }
    const asOfDates = new Set(batch.snapshots.map(s => s.originalAsOfDate));
    if (asOfDates.size !== 1 || !asOfDates.has(THIRD_DATE_AS_OF_DATE)) {
        messages.push(`FAIL: originalAsOfDate must be ${THIRD_DATE_AS_OF_DATE}`);
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

    if (valid) messages.push('PASS: deterministic third-date batch safety contracts verified');
    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
