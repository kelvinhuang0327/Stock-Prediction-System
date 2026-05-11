/**
 * SecondDateSnapshotBatchFactory.ts — P7 Online Validation
 *
 * Builds a deterministic second-date simulation snapshot batch for corpus
 * append testing.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - dryRun: true
 * - productionWriteAllowed: false LOCKED
 * - simulationWriteAllowed: false LOCKED
 * - optimizerWriteAllowed: false LOCKED
 */

import {
    buildSimulationSnapshotKey,
    validateSimulationSnapshotBatch,
    type SimulationSnapshotBatch,
    type SimulationSnapshotRecord,
} from './ReplaySimulationSnapshotEngine';

// ─── Constants ─────────────────────────────────────────────────────

export const SECOND_DATE_DEFAULT_AS_OF_DATE = '2026-05-12';
export const SECOND_DATE_DEFAULT_REVIEW_DATE = '2026-07-01';
export const SECOND_DATE_DEFAULT_SIMULATION_RUN_ID = 'p7-second-date-simulation-20260512-001';
export const SECOND_DATE_DEFAULT_SOURCE_REPLAY_RUN_ID = 'p7-second-date-replay-fixture-20260512-001';
export const SECOND_DATE_SNAPSHOT_VERSION = 'sim-snapshot-v0';
export const SECOND_DATE_BATCH_VERSION = 'sim-batch-v0';

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

// ─── Types ────────────────────────────────────────────────────────

export interface SecondDateSnapshotSeed {
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    source: 'DETERMINISTIC_TEST_FIXTURE';
    sourceReplayRunId: string;
    symbols: string[];
    horizons: Array<'5D' | '20D' | '60D'>;
}

export interface BuildSecondDateSeedOptions {
    asOfDate?: string;
    reviewDate?: string;
    simulationRunId?: string;
}

export interface SecondDateBatchValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

// ─── Seed ─────────────────────────────────────────────────────────

export function buildSecondDateSnapshotSeed(
    options: BuildSecondDateSeedOptions = {},
): SecondDateSnapshotSeed {
    return {
        asOfDate: options.asOfDate ?? SECOND_DATE_DEFAULT_AS_OF_DATE,
        reviewDate: options.reviewDate ?? SECOND_DATE_DEFAULT_REVIEW_DATE,
        simulationRunId:
            options.simulationRunId ?? SECOND_DATE_DEFAULT_SIMULATION_RUN_ID,
        source: 'DETERMINISTIC_TEST_FIXTURE',
        sourceReplayRunId: SECOND_DATE_DEFAULT_SOURCE_REPLAY_RUN_ID,
        symbols: ['2330', '2454'],
        horizons: ['5D', '20D', '60D'],
    };
}

// ─── Snapshot builders ────────────────────────────────────────────

function buildSnapshotRecord(
    seed: SecondDateSnapshotSeed,
    symbol: string,
    horizonLabel: '5D' | '20D' | '60D',
): SimulationSnapshotRecord {
    const isReady =
        (symbol === '2330' && (horizonLabel === '5D' || horizonLabel === '20D')) ||
        (symbol === '2454' && horizonLabel === '5D');

    const snapshotBlockedReason = isReady
        ? 'NONE'
        : horizonLabel === '60D'
            ? 'WINDOW_NOT_DUE'
            : 'OUTCOME_MISSING';

    const outcomeAvailable = isReady;
    const sourceDateBasis = {
        sourceDate: '2026-05-10',
        sourceType: 'DETERMINISTIC_TEST_FIXTURE',
        missingDataFlags: isReady ? [] : ['OUTCOME_PENDING'],
    };

    const replayRunId = seed.sourceReplayRunId;
    const simulationSnapshotKey = buildSimulationSnapshotKey({
        replayRunId,
        originalAsOfDate: seed.asOfDate,
        symbol,
        universeTier: 'MVP_CORE',
        horizonLabel,
    });

    const scoreSnapshot =
        symbol === '2330'
            ? {
                  researchScore: isReady ? 73.5 : 41.2,
                  confidenceScore: isReady ? 67 : 34,
                  technicalScore: isReady ? 76 : 40,
                  chipScore: isReady ? 71 : 38,
                  fundamentalScore: isReady ? 80 : 39,
                  marketAdjustment: isReady ? 4 : -2,
              }
            : {
                  researchScore: isReady ? 69.2 : 39.8,
                  confidenceScore: isReady ? 63 : 31,
                  technicalScore: isReady ? 70 : 36,
                  chipScore: isReady ? 65 : 35,
                  fundamentalScore: isReady ? 72 : 37,
                  marketAdjustment: isReady ? 2 : -3,
              };

    return {
        simulationSnapshotVersion: SECOND_DATE_SNAPSHOT_VERSION,
        simulationRunId: seed.simulationRunId,
        simulationSnapshotKey,
        replayKey: `REPLAY_DATASET|${seed.asOfDate}|${symbol}|MVP_CORE|${seed.simulationRunId}|${horizonLabel}`,
        originalRunId: seed.simulationRunId,
        originalAsOfDate: seed.asOfDate,
        symbol,
        stockName: symbol === '2330' ? 'Taiwan Semiconductor Manufacturing' : 'MediaTek',
        universeTier: 'MVP_CORE',
        horizonLabel,
        horizonDays: horizonLabel === '5D' ? 5 : horizonLabel === '20D' ? 20 : 60,
        targetTradingDate:
            horizonLabel === '5D'
                ? '2026-05-19'
                : horizonLabel === '20D'
                    ? '2026-06-09'
                    : '2026-08-03',
        reviewDate: seed.reviewDate,
        researchBucket: isReady ? 'Strong' : 'Watch',
        scoreSnapshot,
        confidenceSnapshot: isReady ? 67 : 31,
        factorSnapshot: isReady
            ? ['deterministic fixture momentum confirmation', 'observability-only corpus entry']
            : ['deterministic fixture horizon check', 'observability-only corpus entry'],
        riskSnapshot: isReady ? ['sector concentration'] : ['forward visibility limited'],
        limitationSnapshot: ['deterministic second-date fixture'],
        dataCoverageSnapshot: {
            coverage: isReady ? 'full' : 'partial',
            usedSources: ['fixtureQuote', 'fixtureFundamental'],
            missingSources: isReady ? [] : ['outcome'],
        },
        sourceDateBasis,
        outcomeSnapshot: {
            closePriceAtPrediction: null,
            closePriceAtOutcome: isReady ? (symbol === '2330' ? 1020 : 980) : null,
            returnPct: isReady ? (symbol === '2330' ? 1.8 : 2.4) : null,
            priceSource: 'deterministic-fixture',
            outcomeAvailable,
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

export function buildSecondDateSimulationSnapshots(
    seed: SecondDateSnapshotSeed,
): SimulationSnapshotRecord[] {
    const snapshots: SimulationSnapshotRecord[] = [];
    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            snapshots.push(buildSnapshotRecord(seed, symbol, horizonLabel));
        }
    }
    return snapshots;
}

export function buildSecondDateSimulationSnapshotBatch(
    seed: SecondDateSnapshotSeed,
): SimulationSnapshotBatch {
    const snapshots = buildSecondDateSimulationSnapshots(seed);
    const snapshotReadyCount = snapshots.filter(
        snapshot => snapshot.snapshotStatus === 'SNAPSHOT_READY',
    ).length;
    const snapshotBlockedCount = snapshots.length - snapshotReadyCount;

    return {
        simulationBatchVersion: SECOND_DATE_BATCH_VERSION,
        simulationRunId: seed.simulationRunId,
        sourceReplayRunId: seed.sourceReplayRunId,
        reviewDate: seed.reviewDate,
        mode: 'SNAPSHOT_ONLY',
        dryRun: true,
        inputRecordCount: snapshots.length,
        snapshotReadyCount,
        snapshotBlockedCount,
        snapshots,
        validationStatus: 'PASS',
        validationMessages: [
            `Deterministic second-date fixture generated: ${snapshots.length} snapshots`,
        ],
    };
}

export function validateSecondDateSnapshotBatch(
    batch: SimulationSnapshotBatch,
): SecondDateBatchValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (batch.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        valid = false;
    }

    if (batch.simulationRunId === 'p5-replay-simulation-20260511-001') {
        messages.push('FAIL: simulationRunId must differ from P5');
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

    const asOfDates = new Set(batch.snapshots.map(snapshot => snapshot.originalAsOfDate));
    if (asOfDates.size !== 1 || !asOfDates.has(SECOND_DATE_DEFAULT_AS_OF_DATE)) {
        messages.push(`FAIL: originalAsOfDate must be ${SECOND_DATE_DEFAULT_AS_OF_DATE}`);
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

        const snapshotText = JSON.stringify(snapshot);
        if (hasForbiddenClaim(snapshotText)) {
            messages.push(`FAIL: forbidden claim in snapshot: ${snapshot.simulationSnapshotKey}`);
            valid = false;
        }
    }

    const batchText = JSON.stringify(batch);
    if (hasForbiddenClaim(batchText)) {
        messages.push('FAIL: forbidden claim in batch');
        valid = false;
    }

    if (valid) {
        messages.push('PASS: deterministic second-date batch safety contracts verified');
    }

    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}

export function validateSecondDateBatchWithP5Contracts(
    batch: SimulationSnapshotBatch,
): SecondDateBatchValidationResult {
    const base = validateSimulationSnapshotBatch(batch);
    const secondDate = validateSecondDateSnapshotBatch(batch);
    return {
        valid: base.valid && secondDate.valid,
        status: base.valid && secondDate.valid ? 'PASS' : 'FAIL',
        messages: [...base.messages, ...secondDate.messages],
    };
}
