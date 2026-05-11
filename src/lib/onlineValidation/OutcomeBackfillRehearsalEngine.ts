/**
 * OutcomeBackfillRehearsalEngine.ts — P14 Online Validation
 *
 * Rehearses blocked-to-ready transitions for outcome backfill candidates.
 * This is artifact-only and does not write to the corpus or production data.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no corpus write — no external API — no LLM
 * - No trading signals — no performance claims
 */

import type { OutcomeBackfillCandidateSelection } from './OutcomeBackfillCandidateSelector';

export const OUTCOME_BACKFILL_REHEARSAL_VERSION = 'outcome-backfill-rehearsal-v0';

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
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export interface RehearsalOutcomeSnapshot {
    closePriceAtPrediction: number | null;
    closePriceAtOutcome: number | null;
    returnPct: number | null;
    priceSource: string;
    outcomeAvailable: boolean;
}

export type RehearsalTransitionType =
    | 'BLOCKED_TO_READY'
    | 'REMAINS_BLOCKED'
    | 'NO_CHANGE';

export interface OutcomeBackfillRehearsalItem {
    rehearsalItemKey: string;
    candidateKey: string;
    corpusEntryKey: string;
    symbol: string;
    horizonLabel: string;
    originalAsOfDate: string;
    targetTradingDate: string;
    previousSnapshotStatus: string;
    previousBlockedReason: string;
    proposedSnapshotStatus: 'SNAPSHOT_READY' | 'SNAPSHOT_BLOCKED';
    proposedBlockedReason: string;
    proposedOutcomeSnapshot: RehearsalOutcomeSnapshot | null;
    transitionType: RehearsalTransitionType;
    productionWriteAllowed: false;
    corpusWriteAllowed: false;
    optimizerWriteAllowed: false;
}

export interface OutcomeBackfillRehearsal {
    rehearsalVersion: string;
    rehearsalRunId: string;
    generatedAt: string;
    dryRun: true;
    inputCandidateCount: number;
    rehearsedCount: number;
    stillBlockedCount: number;
    rehearsalItems: OutcomeBackfillRehearsalItem[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildOutcomeBackfillRehearsalOptions {
    rehearsalRunId: string;
    generatedAt: string;
    mockOutcomeProvider: (
        symbol: string,
        horizonLabel: string,
        targetTradingDate: string,
    ) => RehearsalOutcomeSnapshot | null;
    dryRun: true;
}

export interface OutcomeBackfillRehearsalSummary {
    inputCandidateCount: number;
    rehearsedCount: number;
    stillBlockedCount: number;
    transitionCounts: Record<RehearsalTransitionType, number>;
    byHorizon: Record<string, { ready: number; blocked: number }>;
    bySymbol: Record<string, { ready: number; blocked: number }>;
    readyAfterRehearsalCount: number;
    blockedAfterRehearsalCount: number;
}

export interface OutcomeBackfillRehearsalValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function buildRehearsalItemKey(
    rehearsalRunId: string,
    candidateKey: string,
): string {
    return `P14_OUTCOME_BACKFILL_REHEARSAL|${rehearsalRunId}|${candidateKey}`;
}

export function buildOutcomeBackfillRehearsal(
    candidateSelection: OutcomeBackfillCandidateSelection,
    options: BuildOutcomeBackfillRehearsalOptions,
): OutcomeBackfillRehearsal {
    const rehearsalItems: OutcomeBackfillRehearsalItem[] = [];
    let rehearsedCount = 0;
    let stillBlockedCount = 0;

    for (const candidate of candidateSelection.candidates) {
        const proposedOutcome = options.mockOutcomeProvider(
            candidate.symbol,
            candidate.horizonLabel,
            candidate.targetTradingDate,
        );

        const isReady = proposedOutcome !== null;
        const proposedSnapshotStatus = isReady ? 'SNAPSHOT_READY' : 'SNAPSHOT_BLOCKED';
        const proposedBlockedReason = isReady ? 'NONE' : candidate.currentBlockedReason || 'OUTCOME_MISSING';
        const transitionType: RehearsalTransitionType = isReady
            ? 'BLOCKED_TO_READY'
            : 'REMAINS_BLOCKED';

        if (isReady) {
            rehearsedCount += 1;
        } else {
            stillBlockedCount += 1;
        }

        rehearsalItems.push({
            rehearsalItemKey: buildRehearsalItemKey(options.rehearsalRunId, candidate.candidateKey),
            candidateKey: candidate.candidateKey,
            corpusEntryKey: candidate.corpusEntryKey,
            symbol: candidate.symbol,
            horizonLabel: candidate.horizonLabel,
            originalAsOfDate: candidate.originalAsOfDate,
            targetTradingDate: candidate.targetTradingDate,
            previousSnapshotStatus: candidate.currentSnapshotStatus,
            previousBlockedReason: candidate.currentBlockedReason,
            proposedSnapshotStatus,
            proposedBlockedReason,
            proposedOutcomeSnapshot: proposedOutcome,
            transitionType,
            productionWriteAllowed: false,
            corpusWriteAllowed: false,
            optimizerWriteAllowed: false,
        });
    }

    const rehearsal: OutcomeBackfillRehearsal = {
        rehearsalVersion: OUTCOME_BACKFILL_REHEARSAL_VERSION,
        rehearsalRunId: options.rehearsalRunId,
        generatedAt: options.generatedAt,
        dryRun: true,
        inputCandidateCount: candidateSelection.selectedCount,
        rehearsedCount,
        stillBlockedCount,
        rehearsalItems,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateOutcomeBackfillRehearsal(rehearsal);
    rehearsal.validationStatus = validation.validationStatus;
    rehearsal.validationMessages = validation.validationMessages;

    return rehearsal;
}

export function summarizeOutcomeBackfillRehearsal(
    rehearsal: OutcomeBackfillRehearsal,
): OutcomeBackfillRehearsalSummary {
    const transitionCounts: Record<RehearsalTransitionType, number> = {
        BLOCKED_TO_READY: 0,
        REMAINS_BLOCKED: 0,
        NO_CHANGE: 0,
    };
    const byHorizon: Record<string, { ready: number; blocked: number }> = {};
    const bySymbol: Record<string, { ready: number; blocked: number }> = {};
    let readyAfterRehearsalCount = 0;
    let blockedAfterRehearsalCount = 0;

    for (const item of rehearsal.rehearsalItems) {
        transitionCounts[item.transitionType] += 1;
        if (!byHorizon[item.horizonLabel]) {
            byHorizon[item.horizonLabel] = { ready: 0, blocked: 0 };
        }
        if (!bySymbol[item.symbol]) {
            bySymbol[item.symbol] = { ready: 0, blocked: 0 };
        }

        if (item.proposedSnapshotStatus === 'SNAPSHOT_READY') {
            byHorizon[item.horizonLabel].ready += 1;
            bySymbol[item.symbol].ready += 1;
            readyAfterRehearsalCount += 1;
        } else {
            byHorizon[item.horizonLabel].blocked += 1;
            bySymbol[item.symbol].blocked += 1;
            blockedAfterRehearsalCount += 1;
        }
    }

    return {
        inputCandidateCount: rehearsal.inputCandidateCount,
        rehearsedCount: rehearsal.rehearsedCount,
        stillBlockedCount: rehearsal.stillBlockedCount,
        transitionCounts,
        byHorizon,
        bySymbol,
        readyAfterRehearsalCount,
        blockedAfterRehearsalCount,
    };
}

export function validateOutcomeBackfillRehearsal(
    rehearsal: OutcomeBackfillRehearsal,
): OutcomeBackfillRehearsalValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (rehearsal.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        status = 'FAIL';
    }

    for (const item of rehearsal.rehearsalItems) {
        if (item.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${item.rehearsalItemKey}`);
            status = 'FAIL';
        }
        if (item.corpusWriteAllowed !== false) {
            messages.push(`FAIL: corpusWriteAllowed must be false: ${item.rehearsalItemKey}`);
            status = 'FAIL';
        }
        if (item.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${item.rehearsalItemKey}`);
            status = 'FAIL';
        }
        if (item.proposedSnapshotStatus === 'SNAPSHOT_READY' && !item.proposedOutcomeSnapshot) {
            messages.push(`FAIL: SNAPSHOT_READY requires proposedOutcomeSnapshot: ${item.rehearsalItemKey}`);
            status = 'FAIL';
        }
    }

    if (hasForbiddenClaim(JSON.stringify(rehearsal))) {
        messages.push('FAIL: forbidden claim detected in outcome backfill rehearsal');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: outcome backfill rehearsal safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
