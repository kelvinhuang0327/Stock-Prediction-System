/**
 * DailyCorpusAppendDryRunExecutor.ts — P11 Online Validation
 *
 * Executes a controlled dry-run append of daily snapshot entries
 * to the simulation snapshot corpus.
 *
 * SAFETY CONTRACT:
 * - dryRun=true is always forced
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - Only appends when preview.appendWouldPass=true AND append=true
 * - Never truncates or rewrites existing corpus content
 * - Duplicate key or asOfDate → FAIL, no write
 */

import { accumulateSnapshotCorpus } from './SimulationSnapshotCorpusAccumulator';
import type { DailySnapshotAppendPreview } from './DailySnapshotAppendPreviewBuilder';

export const EXECUTOR_VERSION = 'daily-corpus-append-dry-run-executor-v0';

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

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppendStatus =
    | 'APPENDED'
    | 'PREVIEW_ONLY'
    | 'BLOCKED_PREVIEW_FAIL'
    | 'BLOCKED_DUPLICATE'
    | 'BLOCKED_FORBIDDEN_CLAIM'
    | 'FAIL';

export interface DailyCorpusAppendDryRunResult {
    executorVersion: string;
    corpusPath: string;
    corpusRunId: string;
    ingestionDate: string;
    dryRun: true;
    append: boolean;
    appendStatus: AppendStatus;
    existingCount: number;
    incomingCount: number;
    appendedCount: number;
    totalAfterAppend: number;
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface ExecuteDailyCorpusAppendDryRunOptions {
    corpusPath: string;
    corpusRunId: string;
    ingestionDate: string;
    append: boolean;
    dryRun: true;
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export function executeDailyCorpusAppendDryRun(
    preview: DailySnapshotAppendPreview,
    options: ExecuteDailyCorpusAppendDryRunOptions,
): DailyCorpusAppendDryRunResult {
    const { corpusPath, corpusRunId, ingestionDate, append } = options;
    const messages: string[] = [];

    // Guard: preview must pass
    if (!preview.appendWouldPass) {
        const reasons = preview.appendBlockReasons.join(', ');
        messages.push(`FAIL: preview did not pass — blocked reasons: ${reasons}`);
        messages.push(...preview.validationMessages);

        let appendStatus: AppendStatus = 'BLOCKED_PREVIEW_FAIL';
        if (preview.appendBlockReasons.includes('DUPLICATE_KEY_BLOCKED') ||
            preview.appendBlockReasons.includes('DUPLICATE_AS_OF_DATE')) {
            appendStatus = 'BLOCKED_DUPLICATE';
        } else if (preview.appendBlockReasons.includes('FORBIDDEN_CLAIM')) {
            appendStatus = 'BLOCKED_FORBIDDEN_CLAIM';
        }

        return {
            executorVersion: EXECUTOR_VERSION,
            corpusPath,
            corpusRunId,
            ingestionDate,
            dryRun: true,
            append,
            appendStatus,
            existingCount: preview.existingCorpusCount,
            incomingCount: preview.proposedSnapshotCount,
            appendedCount: 0,
            totalAfterAppend: preview.existingCorpusCount,
            validationStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    // Guard: no proposed snapshots
    if (preview.proposedSnapshots.length === 0) {
        messages.push('FAIL: no proposed snapshots in preview');
        return {
            executorVersion: EXECUTOR_VERSION,
            corpusPath,
            corpusRunId,
            ingestionDate,
            dryRun: true,
            append,
            appendStatus: 'FAIL',
            existingCount: preview.existingCorpusCount,
            incomingCount: 0,
            appendedCount: 0,
            totalAfterAppend: preview.existingCorpusCount,
            validationStatus: 'FAIL',
            validationMessages: messages,
        };
    }

    // Convert proposed snapshots to the format accumulateSnapshotCorpus expects
    const snapshotBatch = {
        snapshots: preview.proposedSnapshots.map(s => ({
            simulationRunId: s.simulationRunId,
            simulationSnapshotKey: s.simulationSnapshotKey,
            replayKey: s.replayKey,
            originalRunId: s.originalRunId,
            originalAsOfDate: s.originalAsOfDate,
            symbol: s.symbol,
            stockName: s.stockName,
            universeTier: s.universeTier,
            horizonLabel: s.horizonLabel,
            horizonDays: s.horizonDays,
            targetTradingDate: s.targetTradingDate,
            reviewDate: s.reviewDate,
            researchBucket: s.researchBucket,
            scoreSnapshot: s.scoreSnapshot,
            confidenceSnapshot: s.confidenceSnapshot,
            factorSnapshot: s.factorSnapshot,
            riskSnapshot: s.riskSnapshot,
            limitationSnapshot: s.limitationSnapshot,
            dataCoverageSnapshot: s.dataCoverageSnapshot,
            sourceDateBasis: s.sourceDateBasis,
            outcomeSnapshot: s.outcomeSnapshot,
            snapshotStatus: s.snapshotStatus,
            snapshotBlockedReason: s.snapshotBlockedReason,
            pitSafeStatus: s.pitSafeStatus,
            productionWriteAllowed: false,
            simulationWriteAllowed: false,
            optimizerWriteAllowed: false,
            validationMessages: s.validationMessages,
        })),
    };

    // Delegate to accumulateSnapshotCorpus
    const result = accumulateSnapshotCorpus(snapshotBatch, {
        corpusPath,
        corpusRunId,
        ingestionDate,
        append,
        dryRun: true,
    });

    messages.push(...result.validationMessages);

    let appendStatus: AppendStatus;
    if (result.appendStatus === 'FAIL') {
        if (result.duplicateCount > 0) {
            appendStatus = 'BLOCKED_DUPLICATE';
        } else {
            appendStatus = 'FAIL';
        }
    } else if (append) {
        appendStatus = 'APPENDED';
    } else {
        appendStatus = 'PREVIEW_ONLY';
    }

    return {
        executorVersion: EXECUTOR_VERSION,
        corpusPath,
        corpusRunId,
        ingestionDate,
        dryRun: true,
        append,
        appendStatus,
        existingCount: result.existingCount,
        incomingCount: result.incomingCount,
        appendedCount: result.appendedCount,
        totalAfterAppend: result.totalAfterAppend,
        validationStatus: result.appendStatus === 'PASS' ? 'PASS' : 'FAIL',
        validationMessages: messages,
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface DryRunValidationResult {
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export function validateDailyCorpusAppendDryRunResult(
    result: DailyCorpusAppendDryRunResult,
): DryRunValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'FAIL' = 'PASS';

    // dryRun must always be true
    if (result.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        status = 'FAIL';
    }

    // appendStatus must be a known value
    const validStatuses: AppendStatus[] = [
        'APPENDED', 'PREVIEW_ONLY', 'BLOCKED_PREVIEW_FAIL',
        'BLOCKED_DUPLICATE', 'BLOCKED_FORBIDDEN_CLAIM', 'FAIL',
    ];
    if (!validStatuses.includes(result.appendStatus)) {
        messages.push(`FAIL: unknown appendStatus "${result.appendStatus}"`);
        status = 'FAIL';
    }

    // No production write (checked by dryRun + write locks)
    if (result.dryRun !== true) {
        messages.push('FAIL: production write guard — dryRun must be true');
        status = 'FAIL';
    }

    // No optimizer write
    if (hasForbiddenClaim(JSON.stringify(result))) {
        messages.push('FAIL: forbidden claim detected in result');
        status = 'FAIL';
    }

    // No PRODUCTION_READY
    if (/PRODUCTION_READY/i.test(JSON.stringify(result))) {
        messages.push('FAIL: PRODUCTION_READY found in result — forbidden');
        status = 'FAIL';
    }

    // totalAfterAppend >= existingCount
    if (result.totalAfterAppend < result.existingCount) {
        messages.push('FAIL: totalAfterAppend < existingCount — possible truncation');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: dry-run result validation passed');
    }

    return { validationStatus: status, validationMessages: messages };
}
