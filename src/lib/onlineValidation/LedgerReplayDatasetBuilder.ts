/**
 * LedgerReplayDatasetBuilder.ts — P4 Online Validation
 *
 * Builds a PIT-safe replay-ready dataset by joining:
 *   - shadow_prediction_ledger.jsonl (source predictions)
 *   - p3 outcome windows (window status / targetTradingDate)
 *   - p1 outcome write-back records (price outcomes, if available)
 *   - p3 backfill plan (scheduled items)
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - productionWriteAllowed: false LOCKED on all output
 * - simulationWriteAllowed: false LOCKED on all output
 * - No in-sample performance conclusions
 */

import { TRACKER_VERSION } from './LedgerOutcomeWindowTracker';

// ─── Version ──────────────────────────────────────────────────────

export const REPLAY_DATASET_VERSION = 'replay-dataset-v0';

// ─── Forbidden claim patterns ──────────────────────────────────────

const FORBIDDEN_PATTERNS = [
    /\bprofit\b/i, /\bguaranteed\b/i, /\bedge confirmed\b/i,
    /\bproduction approved\b/i, /\bauto trading\b/i,
    /\bbuy\b/i, /\bsell\b/i, /\boutperform\b/i,
    /\bexpected_return\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Types ────────────────────────────────────────────────────────

export type ReplayEligibilityStatus = 'ELIGIBLE' | 'BLOCKED';
export type ReplayBlockedReason =
    | 'WINDOW_NOT_DUE'
    | 'OUTCOME_MISSING'
    | 'PIT_VIOLATION'
    | 'VALIDATION_FAIL'
    | 'TARGET_DATE_INVALID'
    | 'NONE';

export type ReplayOutcomeStatus =
    | 'PENDING'
    | 'READY_FOR_REVIEW'
    | 'MISSING_PRICE'
    | 'BLOCKED'
    | 'NOT_DUE';

export interface ReplaySourceLedgerEntry {
    ledgerVersion?: string;
    entryType?: string;
    runId: string;
    asOfDate: string;
    universeTier: string;
    symbol: string;
    stockName?: string;
    researchBucket?: string;
    scoreSnapshot?: Record<string, unknown>;
    confidenceSnapshot?: unknown;
    factorSnapshot?: unknown[];
    riskSnapshot?: unknown[];
    limitationSnapshot?: unknown[];
    dataCoverageSnapshot?: unknown;
    sourceDateBasis?: {
        sourceDate?: string;
        sourceType?: string;
        missingDataFlags?: string[];
    };
    targetHorizons?: Array<{
        horizonLabel: string;
        outcomeStatus?: string;
        outcomeWriteBackAllowed?: boolean;
    }>;
    ledgerKey?: string;
    validationStatus?: string;
    guardrailStatus?: string;
    productionWriteAllowed?: boolean;
}

export interface OutcomeWindowRecord {
    windowKey: string;
    sourceLedgerKey: string;
    originalRunId: string;
    originalAsOfDate: string;
    symbol: string;
    stockName?: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    reviewDate: string;
    windowStatus: string;
    pitSafeStatus: string;
    backfillAllowed: boolean;
    productionWriteAllowed: false;
    validationMessages: string[];
}

export interface P1OutcomeRecord {
    originalRunId?: string;
    originalAsOfDate?: string;
    symbol: string;
    universeTier?: string;
    horizonLabel: string;
    horizonDays?: number;
    targetTradingDate?: string;
    reviewDate?: string;
    outcomeStatus: string;
    baseResearchScore?: number | null;
    baseResearchBucket?: string | null;
    baseConfidenceScore?: number | null;
    closePriceAtPrediction?: number | null;
    closePriceAtOutcome?: number | null;
    returnPct?: number | null;
    priceSource?: string | null;
    pitSafeStatus?: string;
    productionWriteAllowed?: boolean;
    validationMessages?: string[];
}

export interface BackfillScheduleItem {
    scheduleKey: string;
    windowKey: string;
    symbol: string;
    horizonLabel: string;
    targetTradingDate: string;
    reviewDate: string;
    action: string;
    dryRun: boolean;
    productionWriteAllowed: boolean;
    reason: string;
}

export interface ParsedReplaySourceArtifacts {
    ledgerEntries: ReplaySourceLedgerEntry[];
    windows: OutcomeWindowRecord[];
    outcomeRecords: P1OutcomeRecord[];
    scheduledBackfillItems: BackfillScheduleItem[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface OutcomeSnapshot {
    closePriceAtPrediction: number | null;
    closePriceAtOutcome: number | null;
    returnPct: number | null;
    priceSource: string | null;
    outcomeAvailable: boolean;
}

export interface ReplayRecord {
    replayDatasetVersion: string;
    replayRunId: string;
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
    windowStatus: string;
    outcomeStatus: ReplayOutcomeStatus;
    researchBucket: string;
    scoreSnapshot: Record<string, unknown>;
    confidenceSnapshot: unknown;
    factorSnapshot: unknown[];
    riskSnapshot: unknown[];
    limitationSnapshot: unknown[];
    dataCoverageSnapshot: unknown;
    sourceDateBasis: unknown;
    outcomeSnapshot: OutcomeSnapshot;
    pitSafeStatus: string;
    replayEligible: boolean;
    replayBlockedReason: ReplayBlockedReason;
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    validationMessages: string[];
}

export interface ReplayDataset {
    replayDatasetVersion: string;
    replayRunId: string;
    reviewDate: string;
    records: ReplayRecord[];
    totalRecords: number;
    eligibleCount: number;
    blockedCount: number;
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface ReplayDatasetSummary {
    totalRecords: number;
    eligibleCount: number;
    blockedCount: number;
    byHorizon: Record<string, number>;
    byWindowStatus: Record<string, number>;
    byOutcomeStatus: Record<string, number>;
    byReplayBlockedReason: Record<string, number>;
    symbolCount: number;
    earliestAsOfDate: string | null;
    latestAsOfDate: string | null;
    earliestTargetTradingDate: string | null;
    latestTargetTradingDate: string | null;
}

export interface BuildReplayDatasetInput {
    ledgerEntries: ReplaySourceLedgerEntry[];
    windows: OutcomeWindowRecord[];
    outcomeRecords: P1OutcomeRecord[];
    scheduledBackfillItems?: BackfillScheduleItem[];
}

export interface BuildReplayDatasetOptions {
    replayRunId: string;
    reviewDate: string;
    horizons?: number[];
    requireOutcomeForDueWindows?: boolean;
}

export interface ValidateReplayDatasetResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
    forbiddenClaimFound: boolean;
}

// ─── Build Replay Dataset Key ──────────────────────────────────────

export function buildReplayDatasetKey(
    entry: Pick<ReplaySourceLedgerEntry, 'asOfDate' | 'symbol' | 'universeTier' | 'runId'>,
    horizonLabel: string
): string {
    return `REPLAY_DATASET|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}|${horizonLabel}`;
}

// ─── Parse Source Artifacts ────────────────────────────────────────

export function parseReplaySourceArtifacts(input: {
    ledgerContent: string;
    outcomeWindowResult: unknown;
    outcomeWriteBackJsonlContent?: string;
    backfillPlan?: unknown;
}): ParsedReplaySourceArtifacts {
    const messages: string[] = [];
    let validationStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    // Parse ledger JSONL
    const ledgerEntries: ReplaySourceLedgerEntry[] = [];
    const ledgerLines = input.ledgerContent.trim().split('\n').filter(Boolean);
    for (let i = 0; i < ledgerLines.length; i++) {
        try {
            const obj = JSON.parse(ledgerLines[i]);
            if (obj.entryType === 'SHADOW_PREDICTION') {
                ledgerEntries.push(obj as ReplaySourceLedgerEntry);
            }
        } catch {
            validationStatus = 'FAIL';
            messages.push(`FAIL: Malformed JSONL on ledger line ${i + 1}`);
        }
    }

    // Parse outcome window result
    let windows: OutcomeWindowRecord[] = [];
    if (input.outcomeWindowResult && typeof input.outcomeWindowResult === 'object') {
        const r = input.outcomeWindowResult as { windows?: unknown[] };
        if (Array.isArray(r.windows)) {
            windows = r.windows as OutcomeWindowRecord[];
        }
    }

    // Parse p1 outcome records (optional)
    const outcomeRecords: P1OutcomeRecord[] = [];
    if (input.outcomeWriteBackJsonlContent) {
        const oLines = input.outcomeWriteBackJsonlContent.trim().split('\n').filter(Boolean);
        for (let i = 0; i < oLines.length; i++) {
            try {
                const obj = JSON.parse(oLines[i]);
                outcomeRecords.push(obj as P1OutcomeRecord);
            } catch {
                validationStatus = validationStatus === 'FAIL' ? 'FAIL' : 'WARN';
                messages.push(`WARN: Malformed JSONL on outcome line ${i + 1}`);
            }
        }
    } else {
        validationStatus = validationStatus === 'FAIL' ? 'FAIL' : 'WARN';
        messages.push('WARN: outcomeWriteBackJsonlContent not provided — outcome matching will be skipped');
    }

    // Parse backfill plan
    const scheduledBackfillItems: BackfillScheduleItem[] = [];
    if (input.backfillPlan && typeof input.backfillPlan === 'object') {
        const bp = input.backfillPlan as { scheduledItems?: unknown[] };
        if (Array.isArray(bp.scheduledItems)) {
            scheduledBackfillItems.push(...bp.scheduledItems as BackfillScheduleItem[]);
        }
    }

    return { ledgerEntries, windows, outcomeRecords, scheduledBackfillItems, validationStatus, validationMessages: messages };
}

// ─── Build Replay Dataset ─────────────────────────────────────────

export function buildReplayDataset(
    input: BuildReplayDatasetInput,
    options: BuildReplayDatasetOptions
): ReplayDataset {
    const { replayRunId, reviewDate, horizons = [5, 20, 60], requireOutcomeForDueWindows = false } = options;
    const messages: string[] = [];
    let validationStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    const records: ReplayRecord[] = [];

    // Build outcome lookup: key=(symbol|horizonLabel|asOfDate)
    const outcomeMap = new Map<string, P1OutcomeRecord>();
    for (const rec of input.outcomeRecords) {
        const asOfDate = rec.originalAsOfDate ?? '';
        const key = `${rec.symbol}|${rec.horizonLabel}|${asOfDate}`;
        outcomeMap.set(key, rec);
    }

    // Build window lookup: key=(symbol|horizonLabel|asOfDate)
    const windowMap = new Map<string, OutcomeWindowRecord>();
    for (const w of input.windows) {
        const key = `${w.symbol}|${w.horizonLabel}|${w.originalAsOfDate}`;
        windowMap.set(key, w);
    }

    const HORIZON_LABELS: Record<number, string> = { 5: '5D', 20: '20D', 60: '60D' };

    for (const entry of input.ledgerEntries) {
        if (!entry.symbol || !entry.asOfDate || !entry.runId || !entry.universeTier) {
            messages.push(`WARN: Ledger entry missing required fields, skipping`);
            continue;
        }

        // PIT check
        const sourceDate = entry.sourceDateBasis?.sourceDate ?? '';
        const isPitViolation = sourceDate > entry.asOfDate;
        const pitSafeStatus = isPitViolation ? 'PIT_VIOLATION' : 'PIT_SAFE';

        for (const horizonDays of horizons) {
            const horizonLabel = HORIZON_LABELS[horizonDays] ?? `${horizonDays}D`;
            const replayKey = buildReplayDatasetKey(entry, horizonLabel);

            const recMessages: string[] = [];
            let replayEligible = false;
            let replayBlockedReason: ReplayBlockedReason = 'NONE';
            let outcomeStatus: ReplayOutcomeStatus = 'PENDING';

            // Look up window
            const windowKey = `${entry.symbol}|${horizonLabel}|${entry.asOfDate}`;
            const window = windowMap.get(windowKey);

            if (!window) {
                recMessages.push(`WARN: No matching window for ${windowKey}`);
            }

            const targetTradingDate = window?.targetTradingDate ?? '';
            const windowStatus = window?.windowStatus ?? 'BLOCKED';

            // PIT safety check
            if (isPitViolation) {
                replayBlockedReason = 'PIT_VIOLATION';
                recMessages.push(`FAIL: sourceDate=${sourceDate} > asOfDate=${entry.asOfDate}`);
                outcomeStatus = 'BLOCKED';
            } else if (!targetTradingDate || targetTradingDate <= entry.asOfDate) {
                replayBlockedReason = 'TARGET_DATE_INVALID';
                recMessages.push(`FAIL: targetTradingDate=${targetTradingDate} must be > asOfDate=${entry.asOfDate}`);
                outcomeStatus = 'BLOCKED';
            } else if (reviewDate < targetTradingDate) {
                replayBlockedReason = 'WINDOW_NOT_DUE';
                recMessages.push(`WARN: reviewDate=${reviewDate} < targetTradingDate=${targetTradingDate} — not due`);
                outcomeStatus = 'NOT_DUE';
            } else if (entry.validationStatus && entry.validationStatus !== 'PASS') {
                replayBlockedReason = 'VALIDATION_FAIL';
                recMessages.push(`FAIL: validationStatus=${entry.validationStatus}`);
                outcomeStatus = 'BLOCKED';
            } else {
                // Due window — look up outcome
                const outcomeKey = `${entry.symbol}|${horizonLabel}|${entry.asOfDate}`;
                const outcome = outcomeMap.get(outcomeKey);

                if (!outcome) {
                    recMessages.push(`WARN: No p1 outcome record found for ${outcomeKey}`);
                    outcomeStatus = 'MISSING_PRICE';
                    replayBlockedReason = 'OUTCOME_MISSING';
                    if (requireOutcomeForDueWindows) {
                        validationStatus = validationStatus === 'FAIL' ? 'FAIL' : 'WARN';
                        messages.push(`WARN: requireOutcomeForDueWindows=true but outcome missing for ${outcomeKey}`);
                    }
                } else if (outcome.outcomeStatus === 'READY_FOR_REVIEW' && outcome.closePriceAtOutcome != null) {
                    outcomeStatus = 'READY_FOR_REVIEW';
                    replayEligible = true;
                    replayBlockedReason = 'NONE';
                } else if (outcome.outcomeStatus === 'MISSING_PRICE') {
                    outcomeStatus = 'MISSING_PRICE';
                    replayBlockedReason = 'OUTCOME_MISSING';
                    recMessages.push(`WARN: outcomeStatus=MISSING_PRICE for ${outcomeKey}`);
                } else {
                    outcomeStatus = (outcome.outcomeStatus as ReplayOutcomeStatus) ?? 'PENDING';
                    replayBlockedReason = 'OUTCOME_MISSING';
                }
            }

            // Build outcomeSnapshot
            const outcomeKey = `${entry.symbol}|${horizonLabel}|${entry.asOfDate}`;
            const outcomeRecord = outcomeMap.get(outcomeKey);
            const outcomeSnapshot: OutcomeSnapshot = {
                closePriceAtPrediction: outcomeRecord?.closePriceAtPrediction ?? null,
                closePriceAtOutcome: outcomeRecord?.closePriceAtOutcome ?? null,
                returnPct: outcomeRecord?.returnPct ?? null,
                priceSource: outcomeRecord?.priceSource ?? null,
                outcomeAvailable: replayEligible,
            };

            const record: ReplayRecord = {
                replayDatasetVersion: REPLAY_DATASET_VERSION,
                replayRunId,
                replayKey,
                originalRunId: entry.runId,
                originalAsOfDate: entry.asOfDate,
                symbol: entry.symbol,
                stockName: entry.stockName ?? '',
                universeTier: entry.universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate,
                reviewDate,
                windowStatus,
                outcomeStatus,
                researchBucket: entry.researchBucket ?? '',
                scoreSnapshot: (entry.scoreSnapshot as Record<string, unknown>) ?? {},
                confidenceSnapshot: entry.confidenceSnapshot ?? null,
                factorSnapshot: entry.factorSnapshot ?? [],
                riskSnapshot: entry.riskSnapshot ?? [],
                limitationSnapshot: entry.limitationSnapshot ?? [],
                dataCoverageSnapshot: entry.dataCoverageSnapshot ?? null,
                sourceDateBasis: entry.sourceDateBasis ?? null,
                outcomeSnapshot,
                pitSafeStatus,
                replayEligible,
                replayBlockedReason,
                productionWriteAllowed: false,
                simulationWriteAllowed: false,
                validationMessages: recMessages,
            };

            records.push(record);
        }
    }

    const eligibleCount = records.filter(r => r.replayEligible).length;
    const blockedCount = records.filter(r => !r.replayEligible).length;

    return {
        replayDatasetVersion: REPLAY_DATASET_VERSION,
        replayRunId,
        reviewDate,
        records,
        totalRecords: records.length,
        eligibleCount,
        blockedCount,
        validationStatus,
        validationMessages: messages,
    };
}

// ─── Summarize Replay Dataset ─────────────────────────────────────

export function summarizeReplayDataset(dataset: ReplayDataset): ReplayDatasetSummary {
    const byHorizon: Record<string, number> = {};
    const byWindowStatus: Record<string, number> = {};
    const byOutcomeStatus: Record<string, number> = {};
    const byReplayBlockedReason: Record<string, number> = {};
    const symbolSet = new Set<string>();
    const asOfDates: string[] = [];
    const targetDates: string[] = [];

    for (const r of dataset.records) {
        byHorizon[r.horizonLabel] = (byHorizon[r.horizonLabel] || 0) + 1;
        byWindowStatus[r.windowStatus] = (byWindowStatus[r.windowStatus] || 0) + 1;
        byOutcomeStatus[r.outcomeStatus] = (byOutcomeStatus[r.outcomeStatus] || 0) + 1;
        byReplayBlockedReason[r.replayBlockedReason] = (byReplayBlockedReason[r.replayBlockedReason] || 0) + 1;
        symbolSet.add(r.symbol);
        if (r.originalAsOfDate) asOfDates.push(r.originalAsOfDate);
        if (r.targetTradingDate) targetDates.push(r.targetTradingDate);
    }

    asOfDates.sort();
    targetDates.sort();

    return {
        totalRecords: dataset.totalRecords,
        eligibleCount: dataset.eligibleCount,
        blockedCount: dataset.blockedCount,
        byHorizon,
        byWindowStatus,
        byOutcomeStatus,
        byReplayBlockedReason,
        symbolCount: symbolSet.size,
        earliestAsOfDate: asOfDates[0] ?? null,
        latestAsOfDate: asOfDates[asOfDates.length - 1] ?? null,
        earliestTargetTradingDate: targetDates[0] ?? null,
        latestTargetTradingDate: targetDates[targetDates.length - 1] ?? null,
    };
}

// ─── Validate Replay Dataset ─────────────────────────────────────

export function validateReplayDataset(dataset: ReplayDataset): ValidateReplayDatasetResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    let forbiddenClaimFound = false;

    // reviewDate format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataset.reviewDate)) {
        status = 'FAIL';
        messages.push(`FAIL: reviewDate=${dataset.reviewDate} is not YYYY-MM-DD`);
    }

    for (const r of dataset.records) {
        // productionWriteAllowed must be false
        if (r.productionWriteAllowed !== false) {
            status = 'FAIL';
            messages.push(`FAIL: productionWriteAllowed must be false for ${r.replayKey}`);
        }
        // simulationWriteAllowed must be false
        if (r.simulationWriteAllowed !== false) {
            status = 'FAIL';
            messages.push(`FAIL: simulationWriteAllowed must be false for ${r.replayKey}`);
        }
        // targetTradingDate > originalAsOfDate
        if (r.targetTradingDate && r.originalAsOfDate && r.targetTradingDate <= r.originalAsOfDate) {
            status = 'FAIL';
            messages.push(`FAIL: targetTradingDate=${r.targetTradingDate} must be > asOfDate=${r.originalAsOfDate} for ${r.replayKey}`);
        }
        // If replayEligible, must have outcomeAvailable
        if (r.replayEligible && !r.outcomeSnapshot.outcomeAvailable) {
            status = 'FAIL';
            messages.push(`FAIL: replayEligible=true but outcomeAvailable=false for ${r.replayKey}`);
        }
        // Check forbidden claims in messages
        const allText = [...r.validationMessages].join(' ');
        if (hasForbiddenClaim(allText)) {
            forbiddenClaimFound = true;
            status = 'FAIL';
            messages.push(`FAIL: forbidden claim found in validationMessages for ${r.replayKey}`);
        }
    }

    // Check forbidden claims in dataset messages
    const dsText = dataset.validationMessages.join(' ');
    if (hasForbiddenClaim(dsText)) {
        forbiddenClaimFound = true;
        status = 'FAIL';
        messages.push('FAIL: forbidden claim found in dataset validationMessages');
    }

    if (status === 'PASS') messages.push('PASS: All replay dataset validation checks passed');

    return { validationStatus: status, validationMessages: messages, forbiddenClaimFound };
}
