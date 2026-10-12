/**
 * HorizonMaturityTracker.ts — P13 Online Validation
 *
 * Builds a per-horizon maturity tracker from the simulation snapshot corpus.
 * This is observability-only: it explains whether 5D / 20D / 60D horizons
 * are due, not due, or still blocked by missing outcomes.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusEntry } from './SimulationSnapshotCorpusAccumulator';

export const HORIZON_MATURITY_TRACKER_VERSION = 'horizon-maturity-tracker-v0';

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

export type HorizonMaturityStatus =
    | 'READY_DOMINANT'
    | 'PARTIAL'
    | 'NOT_DUE_DOMINANT'
    | 'MISSING_OUTCOME_DOMINANT'
    | 'BLOCKED_ONLY';

export type HorizonMaturityOverallStatus =
    | 'MATURE_FOR_OBSERVABILITY'
    | 'PARTIALLY_MATURE'
    | 'IMMATURE'
    | 'BLOCKED';

export interface HorizonBlockedReasonSummary {
    horizonLabel: string;
    blockedReasonCounts: Record<string, number>;
    topBlockedReason: string;
    blockedCount: number;
    totalCount: number;
}

export interface HorizonMaturitySummary {
    horizonLabel: string;
    totalCount: number;
    readyCount: number;
    blockedCount: number;
    coverageRatio: number;
    blockedReasonCounts: Record<string, number>;
    earliestAsOfDate: string;
    latestAsOfDate: string;
    earliestTargetTradingDate: string;
    latestTargetTradingDate: string;
    dueCount: number;
    notDueCount: number;
    missingOutcomeCount: number;
    maturityRatio: number;
    maturityStatus: HorizonMaturityStatus;
}

export interface HorizonMaturityTracker {
    trackerVersion: string;
    trackerRunId: string;
    generatedAt: string;
    reviewDate: string;
    inputCorpusEntryCount: number;
    totalEntries: number;
    horizonSummaries: HorizonMaturitySummary[];
    maturityStatus: HorizonMaturityOverallStatus;
    guardrails: {
        noProductionWrite: true;
        noSimulationWrite: true;
        noOptimizerWrite: true;
        noPerformanceClaim: true;
        noTradingSignal: true;
        observabilityOnly: true;
    };
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildHorizonMaturityTrackerOptions {
    trackerRunId: string;
    generatedAt: string;
    reviewDate: string;
    horizons?: string[];
}

export interface HorizonMaturityValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

const DEFAULT_HORIZONS = ['5D', '20D', '60D'];
const HORIZON_ORDER: Record<string, number> = { '5D': 0, '20D': 1, '60D': 2 };

function sortHorizonLabels(horizons: string[]): string[] {
    return [...new Set(horizons)].sort((a, b) => (HORIZON_ORDER[a] ?? 99) - (HORIZON_ORDER[b] ?? 99) || a.localeCompare(b));
}

function topBlockedReason(blockedReasonCounts: Record<string, number>): string {
    const entries = Object.entries(blockedReasonCounts);
    if (entries.length === 0) return 'NONE';
    entries.sort((a, b) => {
        const countDelta = b[1] - a[1];
        return countDelta !== 0 ? countDelta : a[0].localeCompare(b[0]);
    });
    return entries[0][0];
}

function resolveOverallStatus(horizonSummaries: HorizonMaturitySummary[]): HorizonMaturityOverallStatus {
    if (horizonSummaries.length === 0) return 'BLOCKED';
    if (horizonSummaries.some(summary => summary.totalCount === 0)) return 'BLOCKED';

    const allReadyDominant = horizonSummaries.every(summary => summary.maturityStatus === 'READY_DOMINANT');
    if (allReadyDominant) return 'MATURE_FOR_OBSERVABILITY';

    const allNotDueOrBlockedOnly = horizonSummaries.every(summary =>
        summary.maturityStatus === 'NOT_DUE_DOMINANT' || summary.maturityStatus === 'BLOCKED_ONLY',
    );
    if (allNotDueOrBlockedOnly) return 'IMMATURE';

    return 'PARTIALLY_MATURE';
}

function isDue(targetTradingDate: string, reviewDate: string): boolean {
    return targetTradingDate <= reviewDate;
}

export function summarizeBlockedReasonsByHorizon(
    corpusEntries: CorpusEntry[],
): HorizonBlockedReasonSummary[] {
    const byHorizon: Record<string, HorizonBlockedReasonSummary> = {};

    for (const entry of corpusEntries) {
        const horizonLabel = entry.horizonLabel;
        if (!byHorizon[horizonLabel]) {
            byHorizon[horizonLabel] = {
                horizonLabel,
                blockedReasonCounts: {},
                topBlockedReason: 'NONE',
                blockedCount: 0,
                totalCount: 0,
            };
        }

        const summary = byHorizon[horizonLabel];
        summary.totalCount += 1;

        if (entry.snapshotStatus === 'SNAPSHOT_BLOCKED') {
            summary.blockedCount += 1;
            const reason = entry.snapshotBlockedReason || 'UNKNOWN';
            summary.blockedReasonCounts[reason] = (summary.blockedReasonCounts[reason] ?? 0) + 1;
        }
    }

    return sortHorizonLabels(Object.keys(byHorizon)).map(horizonLabel => {
        const summary = byHorizon[horizonLabel];
        return {
            ...summary,
            topBlockedReason: topBlockedReason(summary.blockedReasonCounts),
        };
    });
}

export function buildHorizonMaturityTracker(
    corpusEntries: CorpusEntry[],
    options: BuildHorizonMaturityTrackerOptions,
): HorizonMaturityTracker {
    const reviewDate = options.reviewDate;
    const horizonLabels = sortHorizonLabels(options.horizons ?? DEFAULT_HORIZONS);
    const summaries: HorizonMaturitySummary[] = [];

    for (const horizonLabel of horizonLabels) {
        const horizonEntries = corpusEntries.filter(entry => entry.horizonLabel === horizonLabel);
        const totalCount = horizonEntries.length;
        const readyCount = horizonEntries.filter(entry => entry.snapshotStatus === 'SNAPSHOT_READY').length;
        const blockedCount = totalCount - readyCount;

        const blockedReasonCounts: Record<string, number> = {};
        let earliestAsOfDate = '';
        let latestAsOfDate = '';
        let earliestTargetTradingDate = '';
        let latestTargetTradingDate = '';
        let dueCount = 0;
        let notDueCount = 0;
        let missingOutcomeCount = 0;

        for (const entry of horizonEntries) {
            const asOfDate = entry.originalAsOfDate;
            const targetTradingDate = entry.targetTradingDate;
            earliestAsOfDate = earliestAsOfDate ? (asOfDate < earliestAsOfDate ? asOfDate : earliestAsOfDate) : asOfDate;
            latestAsOfDate = latestAsOfDate ? (asOfDate > latestAsOfDate ? asOfDate : latestAsOfDate) : asOfDate;
            earliestTargetTradingDate = earliestTargetTradingDate
                ? (targetTradingDate < earliestTargetTradingDate ? targetTradingDate : earliestTargetTradingDate)
                : targetTradingDate;
            latestTargetTradingDate = latestTargetTradingDate
                ? (targetTradingDate > latestTargetTradingDate ? targetTradingDate : latestTargetTradingDate)
                : targetTradingDate;

            if (isDue(targetTradingDate, reviewDate)) {
                dueCount += 1;
            } else {
                notDueCount += 1;
            }

            if (entry.snapshotStatus === 'SNAPSHOT_BLOCKED') {
                const reason = entry.snapshotBlockedReason || 'UNKNOWN';
                blockedReasonCounts[reason] = (blockedReasonCounts[reason] ?? 0) + 1;
                if (reason === 'OUTCOME_MISSING') {
                    missingOutcomeCount += 1;
                }
            }
        }

        const maturityRatio = totalCount > 0 ? dueCount / totalCount : 0;
        const coverageRatio = totalCount > 0 ? readyCount / totalCount : 0;

        let maturityStatus: HorizonMaturityStatus;
        if (totalCount === 0) {
            maturityStatus = 'BLOCKED_ONLY';
        } else if (readyCount === 0 && blockedCount > 0) {
            maturityStatus = 'BLOCKED_ONLY';
        } else if (notDueCount > dueCount) {
            maturityStatus = 'NOT_DUE_DOMINANT';
        } else if (missingOutcomeCount > 0 && missingOutcomeCount >= blockedCount / 2) {
            maturityStatus = 'MISSING_OUTCOME_DOMINANT';
        } else if (readyCount > blockedCount) {
            maturityStatus = 'READY_DOMINANT';
        } else {
            maturityStatus = 'PARTIAL';
        }

        summaries.push({
            horizonLabel,
            totalCount,
            readyCount,
            blockedCount,
            coverageRatio,
            blockedReasonCounts,
            earliestAsOfDate,
            latestAsOfDate,
            earliestTargetTradingDate,
            latestTargetTradingDate,
            dueCount,
            notDueCount,
            missingOutcomeCount,
            maturityRatio,
            maturityStatus,
        });
    }

    const tracker: HorizonMaturityTracker = {
        trackerVersion: HORIZON_MATURITY_TRACKER_VERSION,
        trackerRunId: options.trackerRunId,
        generatedAt: options.generatedAt,
        reviewDate,
        inputCorpusEntryCount: corpusEntries.length,
        totalEntries: corpusEntries.length,
        horizonSummaries: summaries,
        maturityStatus: resolveOverallStatus(summaries),
        guardrails: {
            noProductionWrite: true,
            noSimulationWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateHorizonMaturityTracker(tracker);
    tracker.validationStatus = validation.validationStatus;
    tracker.validationMessages = validation.validationMessages;

    return tracker;
}

export function validateHorizonMaturityTracker(
    result: HorizonMaturityTracker,
): HorizonMaturityValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (result.horizonSummaries.length === 0) {
        messages.push('FAIL: horizonSummaries must not be empty');
        status = 'FAIL';
    }

    if (result.totalEntries !== result.inputCorpusEntryCount) {
        messages.push(
            `FAIL: totalEntries=${result.totalEntries} must match inputCorpusEntryCount=${result.inputCorpusEntryCount}`,
        );
        status = 'FAIL';
    }

    const guardrails = result.guardrails;
    if (!guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!guardrails.noSimulationWrite) {
        messages.push('FAIL: noSimulationWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!guardrails.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        status = 'FAIL';
    }
    if (!guardrails.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        status = 'FAIL';
    }
    if (!guardrails.noTradingSignal) {
        messages.push('FAIL: noTradingSignal guardrail must be true');
        status = 'FAIL';
    }

    if ((result.maturityStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: maturityStatus must not be PRODUCTION_READY');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify(result))) {
        messages.push('FAIL: forbidden claim detected in horizon maturity tracker');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: horizon maturity tracker safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}

