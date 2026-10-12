/**
 * ReplaySimulationSnapshotEngine.ts — P5 Online Validation
 *
 * Converts P4 replay dataset records into simulation snapshot records.
 * Only processes replayEligible=true records as SNAPSHOT_READY.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - productionWriteAllowed: false LOCKED
 * - simulationWriteAllowed: false LOCKED
 * - optimizerWriteAllowed: false LOCKED
 * - returnPct stored as outcome observation only, NOT strategy performance
 */

export const SIMULATION_SNAPSHOT_VERSION = 'sim-snapshot-v0';
export const SIMULATION_BATCH_VERSION = 'sim-batch-v0';

// ─── Forbidden claim patterns ──────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────

export type SnapshotMode = 'SNAPSHOT_ONLY' | 'ELIGIBILITY_ONLY';
export type SnapshotStatus = 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED';

export interface OutcomeSnapshotRecord {
    closePriceAtPrediction: number | null;
    closePriceAtOutcome: number | null;
    returnPct: number | null;
    priceSource: string | null;
    outcomeAvailable: boolean;
}

export interface SimulationSnapshotRecord {
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
    confidenceSnapshot: unknown;
    factorSnapshot: unknown[];
    riskSnapshot: unknown[];
    limitationSnapshot: unknown[];
    dataCoverageSnapshot: unknown;
    sourceDateBasis: unknown;
    outcomeSnapshot: OutcomeSnapshotRecord;
    snapshotStatus: SnapshotStatus;
    snapshotBlockedReason: string;
    pitSafeStatus: string;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    optimizerWriteAllowed: false;
    validationMessages: string[];
}

export interface SimulationSnapshotBatch {
    simulationBatchVersion: string;
    simulationRunId: string;
    sourceReplayRunId: string;
    reviewDate: string;
    mode: SnapshotMode;
    dryRun: true;
    inputRecordCount: number;
    snapshotReadyCount: number;
    snapshotBlockedCount: number;
    snapshots: SimulationSnapshotRecord[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface SnapshotBuildOptions {
    simulationRunId: string;
    reviewDate: string;
    mode: SnapshotMode;
    dryRun: true;
    includeBlocked?: boolean;
}

// ─── Exports ──────────────────────────────────────────────────────

/**
 * Builds a deterministic simulation snapshot key.
 * Format: SIM_SNAPSHOT|replayRunId|originalAsOfDate|symbol|universeTier|horizonLabel
 */
export function buildSimulationSnapshotKey(record: {
    replayRunId?: string;
    originalAsOfDate: string;
    symbol: string;
    universeTier: string;
    horizonLabel: string;
}): string {
    const runId = record.replayRunId ?? '';
    return `SIM_SNAPSHOT|${runId}|${record.originalAsOfDate}|${record.symbol}|${record.universeTier}|${record.horizonLabel}`;
}

/**
 * Converts a single replay record into a simulation snapshot record.
 * Only replayEligible=true + outcomeAvailable=true produce SNAPSHOT_READY.
 */
export function buildSimulationSnapshotRecord(
    record: Record<string, unknown>,
    options: SnapshotBuildOptions,
): SimulationSnapshotRecord {
    const replayEligible = record['replayEligible'] === true;
    const outcomeSnapshotRaw = (record['outcomeSnapshot'] as Record<string, unknown>) ?? {};
    const outcomeAvailable = outcomeSnapshotRaw['outcomeAvailable'] === true;

    const isReady = replayEligible && outcomeAvailable;
    const snapshotStatus: SnapshotStatus = isReady ? 'SNAPSHOT_READY' : 'SNAPSHOT_BLOCKED';

    let snapshotBlockedReason = 'NONE';
    const messages: string[] = [];

    if (!replayEligible) {
        snapshotBlockedReason = String(record['replayBlockedReason'] ?? 'REPLAY_NOT_ELIGIBLE');
        messages.push(`BLOCKED: replayEligible=false reason=${snapshotBlockedReason}`);
    } else if (!outcomeAvailable) {
        snapshotBlockedReason = 'OUTCOME_NOT_AVAILABLE';
        messages.push(`BLOCKED: outcomeAvailable=false`);
    }

    const outcomeSnapshot: OutcomeSnapshotRecord = {
        closePriceAtPrediction: (outcomeSnapshotRaw['closePriceAtPrediction'] as number | null) ?? null,
        closePriceAtOutcome: (outcomeSnapshotRaw['closePriceAtOutcome'] as number | null) ?? null,
        returnPct: (outcomeSnapshotRaw['returnPct'] as number | null) ?? null,
        priceSource: (outcomeSnapshotRaw['priceSource'] as string | null) ?? null,
        outcomeAvailable,
    };

    const snapshotKey = buildSimulationSnapshotKey({
        replayRunId: String(record['replayRunId'] ?? ''),
        originalAsOfDate: String(record['originalAsOfDate'] ?? ''),
        symbol: String(record['symbol'] ?? ''),
        universeTier: String(record['universeTier'] ?? ''),
        horizonLabel: String(record['horizonLabel'] ?? ''),
    });

    return {
        simulationSnapshotVersion: SIMULATION_SNAPSHOT_VERSION,
        simulationRunId: options.simulationRunId,
        simulationSnapshotKey: snapshotKey,
        replayKey: String(record['replayKey'] ?? ''),
        originalRunId: String(record['originalRunId'] ?? ''),
        originalAsOfDate: String(record['originalAsOfDate'] ?? ''),
        symbol: String(record['symbol'] ?? ''),
        stockName: String(record['stockName'] ?? ''),
        universeTier: String(record['universeTier'] ?? ''),
        horizonLabel: String(record['horizonLabel'] ?? ''),
        horizonDays: Number(record['horizonDays'] ?? 0),
        targetTradingDate: String(record['targetTradingDate'] ?? ''),
        reviewDate: options.reviewDate,
        researchBucket: String(record['researchBucket'] ?? ''),
        scoreSnapshot: (record['scoreSnapshot'] as Record<string, unknown>) ?? {},
        confidenceSnapshot: record['confidenceSnapshot'] ?? null,
        factorSnapshot: (record['factorSnapshot'] as unknown[]) ?? [],
        riskSnapshot: (record['riskSnapshot'] as unknown[]) ?? [],
        limitationSnapshot: (record['limitationSnapshot'] as unknown[]) ?? [],
        dataCoverageSnapshot: record['dataCoverageSnapshot'] ?? null,
        sourceDateBasis: record['sourceDateBasis'] ?? null,
        outcomeSnapshot,
        snapshotStatus,
        snapshotBlockedReason,
        pitSafeStatus: String(record['pitSafeStatus'] ?? 'UNKNOWN'),
        productionWriteAllowed: false,
        simulationWriteAllowed: false,
        optimizerWriteAllowed: false,
        validationMessages: messages,
    };
}

/**
 * Builds a full simulation snapshot batch from a replay run artifact.
 */
export function buildSimulationSnapshotBatch(
    replayRun: Record<string, unknown>,
    options: SnapshotBuildOptions,
): SimulationSnapshotBatch {
    const records = (replayRun['replayRecords'] as Record<string, unknown>[]) ?? [];
    const includeBlocked = options.includeBlocked !== false;

    const allSnapshots = records.map(r => buildSimulationSnapshotRecord(r, options));
    const snapshots = includeBlocked
        ? allSnapshots
        : allSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY');

    const snapshotReadyCount = allSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    const snapshotBlockedCount = allSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;

    const validationMessages = [
        `Processed ${records.length} replay records: ${snapshotReadyCount} READY, ${snapshotBlockedCount} BLOCKED`,
    ];

    return {
        simulationBatchVersion: SIMULATION_BATCH_VERSION,
        simulationRunId: options.simulationRunId,
        sourceReplayRunId: String(replayRun['replayRunId'] ?? ''),
        reviewDate: options.reviewDate,
        mode: options.mode,
        dryRun: true,
        inputRecordCount: records.length,
        snapshotReadyCount,
        snapshotBlockedCount,
        snapshots,
        validationStatus: 'PASS',
        validationMessages,
    };
}

// ─── Validation ───────────────────────────────────────────────────

export interface SnapshotBatchValidationResult {
    valid: boolean;
    status: 'PASS' | 'FAIL';
    messages: string[];
}

/**
 * Validates a simulation snapshot batch for safety contract compliance.
 */
export function validateSimulationSnapshotBatch(
    batch: SimulationSnapshotBatch,
): SnapshotBatchValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (batch.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        valid = false;
    }

    for (const s of batch.snapshots) {
        if (s.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${s.simulationSnapshotKey}`);
            valid = false;
        }
        if (s.simulationWriteAllowed !== false) {
            messages.push(`FAIL: simulationWriteAllowed must be false: ${s.simulationSnapshotKey}`);
            valid = false;
        }
        if (s.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${s.simulationSnapshotKey}`);
            valid = false;
        }
        if (s.snapshotStatus === 'SNAPSHOT_READY' && !s.outcomeSnapshot.outcomeAvailable) {
            messages.push(`FAIL: SNAPSHOT_READY without outcomeAvailable: ${s.simulationSnapshotKey}`);
            valid = false;
        }

        const allText = [...s.validationMessages].join(' ');
        if (hasForbiddenClaim(allText)) {
            messages.push(`FAIL: forbidden claim in snapshot messages: ${s.simulationSnapshotKey}`);
            valid = false;
        }
    }

    const batchText = [...batch.validationMessages].join(' ');
    if (hasForbiddenClaim(batchText)) {
        messages.push('FAIL: forbidden claim in batch messages');
        valid = false;
    }

    if (valid) messages.push('PASS: all safety contracts verified');

    return { valid, status: valid ? 'PASS' : 'FAIL', messages };
}
