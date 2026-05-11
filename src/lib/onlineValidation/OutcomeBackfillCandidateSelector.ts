/**
 * OutcomeBackfillCandidateSelector.ts — P14 Online Validation
 *
 * Selects artifact-only outcome backfill rehearsal candidates from the
 * simulation snapshot corpus. This is observability-only and does not write
 * any corpus or production data.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusEntry } from './SimulationSnapshotCorpusAccumulator';

export const OUTCOME_BACKFILL_CANDIDATE_SELECTOR_VERSION = 'outcome-backfill-candidate-selector-v0';

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

export type BackfillEligibility =
    | 'ELIGIBLE_FOR_REHEARSAL'
    | 'NOT_DUE'
    | 'UNSUPPORTED_HORIZON'
    | 'ALREADY_READY'
    | 'BLOCKED_BY_DATA';

export interface OutcomeBackfillCandidate {
    candidateKey: string;
    corpusEntryKey: string;
    sourceSimulationRunId: string;
    originalAsOfDate: string;
    symbol: string;
    horizonLabel: string;
    targetTradingDate: string;
    reviewDate: string;
    currentSnapshotStatus: string;
    currentBlockedReason: string;
    backfillEligibility: BackfillEligibility;
    reason: string;
    productionWriteAllowed: false;
    optimizerWriteAllowed: false;
}

export interface OutcomeBackfillSkippedItem {
    corpusEntryKey: string;
    symbol: string;
    horizonLabel: string;
    currentSnapshotStatus: string;
    currentBlockedReason: string;
    skippedReason: BackfillEligibility;
    reason: string;
}

export interface OutcomeBackfillCandidateSelection {
    selectorVersion: string;
    selectorRunId: string;
    generatedAt: string;
    reviewDate: string;
    inputEntryCount: number;
    selectedCount: number;
    skippedCount: number;
    candidates: OutcomeBackfillCandidate[];
    skipped: OutcomeBackfillSkippedItem[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface SelectOutcomeBackfillCandidatesOptions {
    selectorRunId: string;
    generatedAt: string;
    reviewDate: string;
    allowedHorizons?: string[];
    maxCandidates?: number;
    include60D?: boolean;
}

export interface OutcomeBackfillCandidateSelectionSummary {
    selectedCount: number;
    skippedCount: number;
    byHorizon: Record<string, number>;
    byEligibility: Record<BackfillEligibility, number>;
    byBlockedReason: Record<string, number>;
    symbolsSelected: string[];
    earliestTargetTradingDate: string | null;
    latestTargetTradingDate: string | null;
}

export interface OutcomeBackfillCandidateSelectionValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

const HORIZON_ORDER: Record<string, number> = { '5D': 0, '20D': 1, '60D': 2 };

function sortHorizonLabels(horizons: string[]): string[] {
    return [...new Set(horizons)].sort((a, b) => (HORIZON_ORDER[a] ?? 99) - (HORIZON_ORDER[b] ?? 99) || a.localeCompare(b));
}

function createCandidateKey(selectorRunId: string, entry: CorpusEntry): string {
    return `P14_BACKFILL_CANDIDATE|${selectorRunId}|${entry.corpusEntryKey}`;
}

function eligibilityMessage(eligibility: BackfillEligibility, reason: string): string {
    return `${eligibility}: ${reason}`;
}

export function selectOutcomeBackfillCandidates(
    corpusEntries: CorpusEntry[],
    options: SelectOutcomeBackfillCandidatesOptions,
): OutcomeBackfillCandidateSelection {
    const requestedHorizons = options.allowedHorizons ?? ['5D', '20D'];
    const allowedHorizons = sortHorizonLabels([
        ...requestedHorizons.filter(horizon => horizon !== '60D' || options.include60D),
        ...(options.include60D ? ['60D'] : []),
    ]);
    const maxCandidates = options.maxCandidates ?? 20;
    const selectorRunId = options.selectorRunId;
    const generatedAt = options.generatedAt;
    const reviewDate = options.reviewDate;

    const selected: OutcomeBackfillCandidate[] = [];
    const skipped: OutcomeBackfillSkippedItem[] = [];
    const messages: string[] = [];

    const horizonFiltered = [...corpusEntries].sort((a, b) => {
        const dateDelta = a.originalAsOfDate.localeCompare(b.originalAsOfDate);
        if (dateDelta !== 0) return dateDelta;
        const horizonDelta = (HORIZON_ORDER[a.horizonLabel] ?? 99) - (HORIZON_ORDER[b.horizonLabel] ?? 99);
        if (horizonDelta !== 0) return horizonDelta;
        const symbolDelta = a.symbol.localeCompare(b.symbol);
        if (symbolDelta !== 0) return symbolDelta;
        return a.corpusEntryKey.localeCompare(b.corpusEntryKey);
    });

    for (const entry of horizonFiltered) {
        if (selected.length >= maxCandidates) {
            skipped.push({
                corpusEntryKey: entry.corpusEntryKey,
                symbol: entry.symbol,
                horizonLabel: entry.horizonLabel,
                currentSnapshotStatus: entry.snapshotStatus,
                currentBlockedReason: entry.snapshotBlockedReason,
                skippedReason: 'BLOCKED_BY_DATA',
                reason: 'maxCandidates reached',
            });
            continue;
        }

        if (!allowedHorizons.includes(entry.horizonLabel)) {
            skipped.push({
                corpusEntryKey: entry.corpusEntryKey,
                symbol: entry.symbol,
                horizonLabel: entry.horizonLabel,
                currentSnapshotStatus: entry.snapshotStatus,
                currentBlockedReason: entry.snapshotBlockedReason,
                skippedReason: 'UNSUPPORTED_HORIZON',
                reason: `horizonLabel=${entry.horizonLabel} not included for rehearsal`,
            });
            continue;
        }

        if (entry.snapshotStatus === 'SNAPSHOT_READY') {
            skipped.push({
                corpusEntryKey: entry.corpusEntryKey,
                symbol: entry.symbol,
                horizonLabel: entry.horizonLabel,
                currentSnapshotStatus: entry.snapshotStatus,
                currentBlockedReason: entry.snapshotBlockedReason,
                skippedReason: 'ALREADY_READY',
                reason: 'already ready snapshot',
            });
            continue;
        }

        if (entry.snapshotBlockedReason === 'WINDOW_NOT_DUE' || entry.snapshotBlockedReason === 'NOT_DUE') {
            skipped.push({
                corpusEntryKey: entry.corpusEntryKey,
                symbol: entry.symbol,
                horizonLabel: entry.horizonLabel,
                currentSnapshotStatus: entry.snapshotStatus,
                currentBlockedReason: entry.snapshotBlockedReason,
                skippedReason: 'NOT_DUE',
                reason: 'window not due',
            });
            continue;
        }

        if (
            entry.snapshotBlockedReason !== 'OUTCOME_MISSING' &&
            entry.snapshotBlockedReason !== 'MISSING_OUTCOME'
        ) {
            skipped.push({
                corpusEntryKey: entry.corpusEntryKey,
                symbol: entry.symbol,
                horizonLabel: entry.horizonLabel,
                currentSnapshotStatus: entry.snapshotStatus,
                currentBlockedReason: entry.snapshotBlockedReason,
                skippedReason: 'BLOCKED_BY_DATA',
                reason: `unsupported blocked reason ${entry.snapshotBlockedReason}`,
            });
            continue;
        }

        const candidate: OutcomeBackfillCandidate = {
            candidateKey: createCandidateKey(selectorRunId, entry),
            corpusEntryKey: entry.corpusEntryKey,
            sourceSimulationRunId: entry.sourceSimulationRunId,
            originalAsOfDate: entry.originalAsOfDate,
            symbol: entry.symbol,
            horizonLabel: entry.horizonLabel,
            targetTradingDate: entry.targetTradingDate,
            reviewDate,
            currentSnapshotStatus: entry.snapshotStatus,
            currentBlockedReason: entry.snapshotBlockedReason,
            backfillEligibility: 'ELIGIBLE_FOR_REHEARSAL',
            reason: eligibilityMessage('ELIGIBLE_FOR_REHEARSAL', 'outcome missing and due for rehearsal'),
            productionWriteAllowed: false,
            optimizerWriteAllowed: false,
        };
        selected.push(candidate);
    }

    if (selected.length === 0) {
        messages.push('WARN: no backfill candidates selected');
    } else {
        messages.push(`PASS: selected ${selected.length} backfill candidates`);
    }

    const selection: OutcomeBackfillCandidateSelection = {
        selectorVersion: OUTCOME_BACKFILL_CANDIDATE_SELECTOR_VERSION,
        selectorRunId,
        generatedAt,
        reviewDate,
        inputEntryCount: corpusEntries.length,
        selectedCount: selected.length,
        skippedCount: skipped.length,
        candidates: selected,
        skipped,
        validationStatus: 'PASS',
        validationMessages: messages,
    };

    const validation = validateOutcomeBackfillCandidateSelection(selection, {
        include60D: options.include60D ?? false,
    });
    selection.validationStatus = validation.validationStatus;
    selection.validationMessages = validation.validationMessages;

    return selection;
}

export function summarizeBackfillCandidateSelection(
    result: OutcomeBackfillCandidateSelection,
): OutcomeBackfillCandidateSelectionSummary {
    const byHorizon: Record<string, number> = {};
    const byEligibility: Record<BackfillEligibility, number> = {
        ELIGIBLE_FOR_REHEARSAL: 0,
        NOT_DUE: 0,
        UNSUPPORTED_HORIZON: 0,
        ALREADY_READY: 0,
        BLOCKED_BY_DATA: 0,
    };
    const byBlockedReason: Record<string, number> = {};
    const symbolsSelected = new Set<string>();
    let earliestTargetTradingDate: string | null = null;
    let latestTargetTradingDate: string | null = null;

    for (const candidate of result.candidates) {
        byHorizon[candidate.horizonLabel] = (byHorizon[candidate.horizonLabel] ?? 0) + 1;
        byEligibility[candidate.backfillEligibility] += 1;
        byBlockedReason[candidate.currentBlockedReason] = (byBlockedReason[candidate.currentBlockedReason] ?? 0) + 1;
        symbolsSelected.add(candidate.symbol);
        earliestTargetTradingDate = earliestTargetTradingDate
            ? (candidate.targetTradingDate < earliestTargetTradingDate ? candidate.targetTradingDate : earliestTargetTradingDate)
            : candidate.targetTradingDate;
        latestTargetTradingDate = latestTargetTradingDate
            ? (candidate.targetTradingDate > latestTargetTradingDate ? candidate.targetTradingDate : latestTargetTradingDate)
            : candidate.targetTradingDate;
    }

    return {
        selectedCount: result.selectedCount,
        skippedCount: result.skippedCount,
        byHorizon,
        byEligibility,
        byBlockedReason,
        symbolsSelected: [...symbolsSelected].sort(),
        earliestTargetTradingDate,
        latestTargetTradingDate,
    };
}

export function validateOutcomeBackfillCandidateSelection(
    result: OutcomeBackfillCandidateSelection,
    options: { include60D?: boolean } = {},
): OutcomeBackfillCandidateSelectionValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    for (const candidate of result.candidates) {
        if (candidate.currentSnapshotStatus === 'SNAPSHOT_READY') {
            messages.push(`FAIL: selected candidate must not be SNAPSHOT_READY: ${candidate.corpusEntryKey}`);
            status = 'FAIL';
        }
        if (!options.include60D && candidate.horizonLabel === '60D') {
            messages.push(`FAIL: 60D candidate selected while include60D=false: ${candidate.corpusEntryKey}`);
            status = 'FAIL';
        }
        if (candidate.currentBlockedReason === 'WINDOW_NOT_DUE' || candidate.currentBlockedReason === 'NOT_DUE') {
            messages.push(`FAIL: selected candidate cannot be WINDOW_NOT_DUE: ${candidate.corpusEntryKey}`);
            status = 'FAIL';
        }
        if (candidate.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${candidate.corpusEntryKey}`);
            status = 'FAIL';
        }
        if (candidate.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${candidate.corpusEntryKey}`);
            status = 'FAIL';
        }
    }

    if (hasForbiddenClaim(JSON.stringify(result))) {
        messages.push('FAIL: forbidden claim detected in backfill candidate selection');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: backfill candidate selection safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
