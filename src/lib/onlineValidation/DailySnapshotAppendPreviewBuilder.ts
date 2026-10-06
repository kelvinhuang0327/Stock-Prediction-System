/**
 * DailySnapshotAppendPreviewBuilder.ts — P11 Online Validation
 *
 * Builds a dry-run append preview for a daily real-market snapshot.
 * Does NOT write to corpus. Returns a preview artifact for review.
 *
 * SAFETY CONTRACT:
 * - No corpus write — no production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - Preview only — actual append is handled by DailyCorpusAppendDryRunExecutor
 */

import { addTwseTradingDays, CALENDAR_VERSION } from './TwseTradingCalendar';
import type { DailyRealMarketSnapshotSeed } from './DailyRealMarketSnapshotSeed';
import type { CorpusEntry } from './SimulationSnapshotCorpusAccumulator';
import { buildCorpusEntryKey } from './SimulationSnapshotCorpusAccumulator';

export const PREVIEW_VERSION = 'daily-snapshot-append-preview-v0';

// ─── Forbidden claims ────────────────────────────────────────────────────────

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
    /\bPRODUCTION_READY\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HORIZON_DAYS_MAP: Record<string, number> = { '5D': 5, '20D': 20, '60D': 60 };

const STOCK_NAME_MAP: Record<string, string> = {
    '2330': 'Taiwan Semiconductor Manufacturing',
    '2454': 'MediaTek',
    '2317': 'Hon Hai Precision Industry',
    '2882': 'Cathay Financial Holdings',
    '2886': 'Mega Financial Holding',
};

function getStockName(symbol: string): string {
    return STOCK_NAME_MAP[symbol] ?? `Stock ${symbol}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Raw snapshot record compatible with normalizeSnapshotForCorpus */
export interface ProposedSnapshotRecord {
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
    confidenceSnapshot: null;
    factorSnapshot: unknown[];
    riskSnapshot: unknown[];
    limitationSnapshot: unknown[];
    dataCoverageSnapshot: null;
    sourceDateBasis: null;
    outcomeSnapshot: null;
    snapshotStatus: 'SNAPSHOT_BLOCKED';
    snapshotBlockedReason: 'WINDOW_NOT_DUE';
    pitSafeStatus: 'PIT_SAFE';
    productionWriteAllowed: false;
    simulationWriteAllowed: false;
    optimizerWriteAllowed: false;
    validationMessages: string[];
    proposedCorpusEntryKey: string;
}

export type AppendBlockReason =
    | 'NONE'
    | 'DUPLICATE_AS_OF_DATE'
    | 'DUPLICATE_KEY_BLOCKED'
    | 'SEED_INVALID'
    | 'FORBIDDEN_CLAIM';

export interface DailySnapshotAppendPreview {
    previewVersion: string;
    previewRunId: string;
    generatedAt: string;
    seed: DailyRealMarketSnapshotSeed;
    existingCorpusCount: number;
    existingUniqueAsOfDateCount: number;
    proposedSnapshotCount: number;
    proposedReadyCount: number;
    proposedBlockedCount: number;
    duplicateKeyCount: number;
    appendWouldPass: boolean;
    appendBlockReasons: AppendBlockReason[];
    proposedSnapshots: ProposedSnapshotRecord[];
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface BuildDailySnapshotAppendPreviewOptions {
    previewRunId: string;
    generatedAt: string;
    includeBlocked?: boolean;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildDailySnapshotAppendPreview(
    seed: DailyRealMarketSnapshotSeed,
    existingCorpusEntries: CorpusEntry[],
    options: BuildDailySnapshotAppendPreviewOptions,
): DailySnapshotAppendPreview {
    const { previewRunId, generatedAt, includeBlocked = true } = options;
    const messages: string[] = [];
    const blockReasons: AppendBlockReason[] = [];
    let appendWouldPass = true;

    // Seed must be valid
    if (seed.validationStatus !== 'PASS') {
        messages.push(`FAIL: seed validation failed — ${seed.validationMessages.join('; ')}`);
        blockReasons.push('SEED_INVALID');
        appendWouldPass = false;
    }

    // Existing corpus analysis
    const existingAsOfDates = new Set(existingCorpusEntries.map(e => e.originalAsOfDate));
    const existingUniqueAsOfDateCount = existingAsOfDates.size;
    const existingCorpusCount = existingCorpusEntries.length;

    // Check for duplicate asOfDate
    if (existingAsOfDates.has(seed.asOfDate)) {
        messages.push(
            `FAIL: DUPLICATE_AS_OF_DATE — asOfDate "${seed.asOfDate}" already exists in corpus`,
        );
        blockReasons.push('DUPLICATE_AS_OF_DATE');
        appendWouldPass = false;
    }

    // Build existing key set for duplicate-key check
    const existingKeys = new Set(existingCorpusEntries.map(e => e.corpusEntryKey));

    // Build proposed snapshots
    const proposedSnapshots: ProposedSnapshotRecord[] = [];
    const duplicateKeys: string[] = [];

    for (const symbol of seed.symbols) {
        for (const horizonLabel of seed.horizons) {
            const horizonDays = HORIZON_DAYS_MAP[horizonLabel];
            if (horizonDays === undefined) {
                messages.push(`FAIL: unknown horizonLabel "${horizonLabel}"`);
                appendWouldPass = false;
                continue;
            }

            let targetTradingDate = '';
            try {
                targetTradingDate = addTwseTradingDays(seed.asOfDate, horizonDays);
            } catch (e) {
                messages.push(`FAIL: cannot compute targetTradingDate for ${horizonLabel}: ${String(e)}`);
                appendWouldPass = false;
                continue;
            }

            const simulationRunId = seed.simulationRunId;
            const universeTier = 'MVP_CORE';

            const proposedKey = `SIM_CORPUS|${simulationRunId}|${seed.asOfDate}|${symbol}|${universeTier}|${horizonLabel}`;
            const simulationSnapshotKey = `SIM_SNAPSHOT|${simulationRunId}|${seed.asOfDate}|${symbol}|${universeTier}|${horizonLabel}`;
            const replayKey = `REPLAY_DATASET|${seed.asOfDate}|${symbol}|${universeTier}|${simulationRunId}|${horizonLabel}`;

            // Check for duplicate key
            if (existingKeys.has(proposedKey)) {
                duplicateKeys.push(proposedKey);
                messages.push(`FAIL: DUPLICATE_KEY_BLOCKED — key already exists: ${proposedKey}`);
                if (!blockReasons.includes('DUPLICATE_KEY_BLOCKED')) {
                    blockReasons.push('DUPLICATE_KEY_BLOCKED');
                }
                appendWouldPass = false;
            }

            const snapshot: ProposedSnapshotRecord = {
                simulationRunId,
                simulationSnapshotKey,
                replayKey,
                originalRunId: simulationRunId,
                originalAsOfDate: seed.asOfDate,
                symbol,
                stockName: getStockName(symbol),
                universeTier,
                horizonLabel,
                horizonDays,
                targetTradingDate,
                reviewDate: seed.reviewDate,
                researchBucket: 'Observability',
                scoreSnapshot: {},
                confidenceSnapshot: null,
                factorSnapshot: [],
                riskSnapshot: [],
                limitationSnapshot: [],
                dataCoverageSnapshot: null,
                sourceDateBasis: null,
                outcomeSnapshot: null,
                snapshotStatus: 'SNAPSHOT_BLOCKED',
                snapshotBlockedReason: 'WINDOW_NOT_DUE',
                pitSafeStatus: 'PIT_SAFE',
                productionWriteAllowed: false,
                simulationWriteAllowed: false,
                optimizerWriteAllowed: false,
                validationMessages: ['PASS: proposed snapshot — observability only'],
                proposedCorpusEntryKey: proposedKey,
            };

            if (includeBlocked || snapshot.snapshotStatus === 'SNAPSHOT_READY') {
                proposedSnapshots.push(snapshot);
            }
        }
    }

    // Forbidden claims check
    const textToCheck = JSON.stringify(proposedSnapshots);
    if (hasForbiddenClaim(textToCheck)) {
        messages.push('FAIL: forbidden claim detected in proposed snapshots');
        if (!blockReasons.includes('FORBIDDEN_CLAIM')) blockReasons.push('FORBIDDEN_CLAIM');
        appendWouldPass = false;
    }

    const proposedReadyCount = proposedSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_READY').length;
    const proposedBlockedCount = proposedSnapshots.filter(s => s.snapshotStatus === 'SNAPSHOT_BLOCKED').length;

    if (appendWouldPass && blockReasons.length === 0) {
        blockReasons.push('NONE');
        messages.push('PASS: append preview passed — no duplicates, no forbidden claims');
    }

    return {
        previewVersion: PREVIEW_VERSION,
        previewRunId,
        generatedAt,
        seed,
        existingCorpusCount,
        existingUniqueAsOfDateCount,
        proposedSnapshotCount: proposedSnapshots.length,
        proposedReadyCount,
        proposedBlockedCount,
        duplicateKeyCount: duplicateKeys.length,
        appendWouldPass,
        appendBlockReasons: blockReasons,
        proposedSnapshots,
        validationStatus: appendWouldPass ? 'PASS' : 'FAIL',
        validationMessages: messages,
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface PreviewValidationResult {
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export function validateDailySnapshotAppendPreview(
    preview: DailySnapshotAppendPreview,
): PreviewValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'FAIL' = 'PASS';

    // appendWouldPass=true → duplicateKeyCount must be 0
    if (preview.appendWouldPass && preview.duplicateKeyCount !== 0) {
        messages.push('FAIL: appendWouldPass=true but duplicateKeyCount is non-zero');
        status = 'FAIL';
    }

    // Write locks on proposed snapshots
    for (const snap of preview.proposedSnapshots) {
        if (snap.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${snap.proposedCorpusEntryKey}`);
            status = 'FAIL';
        }
        if (snap.simulationWriteAllowed !== false) {
            messages.push(`FAIL: simulationWriteAllowed must be false: ${snap.proposedCorpusEntryKey}`);
            status = 'FAIL';
        }
        if (snap.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${snap.proposedCorpusEntryKey}`);
            status = 'FAIL';
        }
    }

    // No PRODUCTION_READY
    if (/PRODUCTION_READY/i.test(JSON.stringify(preview))) {
        messages.push('FAIL: PRODUCTION_READY found in preview — forbidden');
        status = 'FAIL';
    }

    // No forbidden claims
    if (hasForbiddenClaim(JSON.stringify(preview))) {
        messages.push('FAIL: forbidden claim detected in preview');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: preview validation passed');
    }

    return { validationStatus: status, validationMessages: messages };
}
