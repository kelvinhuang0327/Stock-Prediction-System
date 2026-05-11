/**
 * MultiDateDailyAppendExecutor.ts — P12 Online Validation
 *
 * Executes a controlled multi-date append-only dry-run for the real-market
 * snapshot corpus continuation flow.
 *
 * SAFETY CONTRACT:
 * - dryRun=true is always forced
 * - no production DB write — no external API — no LLM
 * - no optimizer write — no auto trading — no performance claim
 * - append-only JSONL corpus writes only when append=true
 */

import * as fs from 'fs';

import {
    buildDailyRealMarketSnapshotSeed,
    type DailyRealMarketSnapshotSeed,
} from './DailyRealMarketSnapshotSeed';
import {
    buildDailySnapshotAppendPreview,
    type DailySnapshotAppendPreview,
} from './DailySnapshotAppendPreviewBuilder';
import {
    executeDailyCorpusAppendDryRun,
    type DailyCorpusAppendDryRunResult,
} from './DailyCorpusAppendDryRunExecutor';
import {
    parseSnapshotCorpusJsonl,
    type CorpusEntry,
} from './SimulationSnapshotCorpusAccumulator';
import {
    validateMultiDateDailyAppendPlan,
    type MultiDateDailyAppendPlan,
    type MultiDateDailyAppendPlanGuardrails,
} from './MultiDateDailyAppendPlan';

export const MULTI_DATE_EXECUTOR_VERSION = 'multi-date-daily-append-executor-v0';

const FORBIDDEN_PATTERNS = [
    /\bbuy\b/i,
    /\bsell\b/i,
    /\bsignal\b/i,
    /\broi\b/i,
    /\bwin_rate\b/i,
    /\balpha\b/i,
    /\bedge\b/i,
    /\bprofit\b/i,
    /\brecommendation\b/i,
    /\boutperform\b/i,
    /\bguaranteed\b/i,
    /\bauto trading\b/i,
    /\bexpected_return\b/i,
    /\bpredicted_return\b/i,
    /\bexpected_profit\b/i,
    /\bpredicted_profit\b/i,
    /\bH00[1-9]\b/i,
    /\bH01[0-2]\b/i,
];

function hasForbiddenClaim(text: string): boolean {
    return FORBIDDEN_PATTERNS.some(pattern => pattern.test(text));
}

export type MultiDateAppendStatus =
    | 'APPENDED'
    | 'PREVIEW_ONLY'
    | 'BLOCKED_DUPLICATE'
    | 'BLOCKED_PREVIEW_FAIL'
    | 'FAILED';

export interface MultiDateDailyAppendDateResult {
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    previewStatus: 'PASS' | 'FAIL';
    appendStatus: MultiDateAppendStatus;
    incomingCount: number;
    appendedCount: number;
    duplicateKeyCount: number;
    validationMessages: string[];
}

export interface MultiDateDailyAppendDryRunResult {
    executorVersion: string;
    planRunId: string;
    corpusPath: string;
    dryRun: true;
    append: boolean;
    stopOnFirstFailure: boolean;
    requestedDateCount: number;
    expectedSnapshotCountPerDate: number;
    expectedTotalSnapshotCount: number;
    successfulDateCount: number;
    blockedDateCount: number;
    failedDateCount: number;
    totalIncomingSnapshots: number;
    totalAppendedSnapshots: number;
    beforeCorpusCount: number;
    afterCorpusCount: number;
    beforeUniqueAsOfDateCount: number;
    afterUniqueAsOfDateCount: number;
    dateResults: MultiDateDailyAppendDateResult[];
    guardrails: MultiDateDailyAppendPlanGuardrails;
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface ExecuteMultiDateDailyAppendDryRunOptions {
    corpusPath: string;
    append: boolean;
    dryRun: true;
    stopOnFirstFailure?: boolean;
    ingestionDate?: string;
}

export interface MultiDateDailyAppendDryRunValidationResult {
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

function readCorpusEntries(corpusPath: string): CorpusEntry[] {
    if (!fs.existsSync(corpusPath)) {
        return [];
    }
    const content = fs.readFileSync(corpusPath, 'utf8');
    return content.trim() ? parseSnapshotCorpusJsonl(content) : [];
}

function uniqueAsOfDateCount(entries: CorpusEntry[]): number {
    return new Set(entries.map(entry => entry.originalAsOfDate)).size;
}

function buildPreviewRunId(asOfDate: string): string {
    return `p12-preview-${asOfDate.replace(/-/g, '')}-001`;
}

function buildIngestionDate(ingestionDate?: string): string {
    return ingestionDate ?? new Date().toISOString().slice(0, 10);
}

function classifyAppendStatus(
    preview: DailySnapshotAppendPreview,
    appendResult: DailyCorpusAppendDryRunResult,
): MultiDateAppendStatus {
    if (preview.appendWouldPass) {
        return appendResult.appendStatus === 'APPENDED' ? 'APPENDED' : 'PREVIEW_ONLY';
    }

    if (preview.appendBlockReasons.includes('DUPLICATE_AS_OF_DATE') ||
        preview.appendBlockReasons.includes('DUPLICATE_KEY_BLOCKED')) {
        return 'BLOCKED_DUPLICATE';
    }

    if (preview.appendBlockReasons.includes('FORBIDDEN_CLAIM')) {
        return 'BLOCKED_PREVIEW_FAIL';
    }

    return 'BLOCKED_PREVIEW_FAIL';
}

export function executeMultiDateDailyAppendDryRun(
    plan: MultiDateDailyAppendPlan,
    options: ExecuteMultiDateDailyAppendDryRunOptions,
): MultiDateDailyAppendDryRunResult {
    const planValidation = validateMultiDateDailyAppendPlan(plan);
    const beforeEntries = readCorpusEntries(options.corpusPath);
    const beforeCorpusCount = beforeEntries.length;
    const beforeUniqueAsOfDateCount = uniqueAsOfDateCount(beforeEntries);
    const stopOnFirstFailure = options.stopOnFirstFailure ?? true;
    const ingestionDate = buildIngestionDate(options.ingestionDate);
    const expectedSnapshotCountPerDate = plan.symbols.length * plan.horizons.length;
    const expectedTotalSnapshotCount = plan.dates.length * expectedSnapshotCountPerDate;

    const baseResult: MultiDateDailyAppendDryRunResult = {
        executorVersion: MULTI_DATE_EXECUTOR_VERSION,
        planRunId: plan.planRunId,
        corpusPath: options.corpusPath,
        dryRun: true,
        append: options.append,
        stopOnFirstFailure,
        requestedDateCount: plan.dates.length,
        expectedSnapshotCountPerDate,
        expectedTotalSnapshotCount,
        successfulDateCount: 0,
        blockedDateCount: 0,
        failedDateCount: 0,
        totalIncomingSnapshots: 0,
        totalAppendedSnapshots: 0,
        beforeCorpusCount,
        afterCorpusCount: beforeCorpusCount,
        beforeUniqueAsOfDateCount,
        afterUniqueAsOfDateCount: beforeUniqueAsOfDateCount,
        dateResults: [],
        guardrails: plan.guardrails,
        validationStatus: 'PASS',
        validationMessages: [],
    };

    if (planValidation.validationStatus === 'FAIL') {
        return {
            ...baseResult,
            validationStatus: 'FAIL',
            validationMessages: [
                'FAIL: multi-date daily append plan validation failed',
                ...planValidation.validationMessages,
            ],
        };
    }

    let currentEntries = beforeEntries;
    const dateResults: MultiDateDailyAppendDateResult[] = [];
    let successfulDateCount = 0;
    let blockedDateCount = 0;
    let failedDateCount = 0;
    let totalIncomingSnapshots = 0;
    let totalAppendedSnapshots = 0;

    for (const dateItem of plan.dates) {
        const seed: DailyRealMarketSnapshotSeed = buildDailyRealMarketSnapshotSeed({
            asOfDate: dateItem.asOfDate,
            reviewDate: dateItem.reviewDate,
            simulationRunId: dateItem.simulationRunId,
            symbols: plan.symbols,
            horizons: plan.horizons,
            sourceMode: plan.sourceMode,
        });

        const preview = buildDailySnapshotAppendPreview(seed, currentEntries, {
            previewRunId: buildPreviewRunId(dateItem.asOfDate),
            generatedAt: new Date().toISOString(),
            includeBlocked: true,
        });

        const appendResult = executeDailyCorpusAppendDryRun(preview, {
            corpusPath: options.corpusPath,
            corpusRunId: plan.planRunId,
            ingestionDate,
            append: options.append,
            dryRun: true,
        });

        const appendStatus = classifyAppendStatus(preview, appendResult);
        const dateValidationMessages = [
            ...seed.validationMessages,
            ...preview.validationMessages,
            ...appendResult.validationMessages,
        ];

        if (appendStatus === 'APPENDED' || appendStatus === 'PREVIEW_ONLY') {
            successfulDateCount += 1;
        } else if (appendStatus === 'FAILED') {
            failedDateCount += 1;
        } else {
            blockedDateCount += 1;
        }

        totalIncomingSnapshots += appendResult.incomingCount;
        totalAppendedSnapshots += appendResult.appendedCount;

        dateResults.push({
            asOfDate: dateItem.asOfDate,
            reviewDate: dateItem.reviewDate,
            simulationRunId: dateItem.simulationRunId,
            previewStatus: preview.validationStatus,
            appendStatus,
            incomingCount: appendResult.incomingCount,
            appendedCount: appendResult.appendedCount,
            duplicateKeyCount: preview.duplicateKeyCount,
            validationMessages: dateValidationMessages,
        });

        if (appendStatus === 'APPENDED') {
            currentEntries = readCorpusEntries(options.corpusPath);
        }

        if (stopOnFirstFailure && (appendStatus === 'FAILED' || appendStatus === 'BLOCKED_DUPLICATE' || appendStatus === 'BLOCKED_PREVIEW_FAIL')) {
            break;
        }
    }

    const afterEntries = readCorpusEntries(options.corpusPath);
    const afterCorpusCount = afterEntries.length;
    const afterUniqueAsOfDateCount = uniqueAsOfDateCount(afterEntries);

    return {
        ...baseResult,
        successfulDateCount,
        blockedDateCount,
        failedDateCount,
        totalIncomingSnapshots,
        totalAppendedSnapshots,
        afterCorpusCount,
        afterUniqueAsOfDateCount,
        dateResults,
        validationMessages: [],
    };
}

export function validateMultiDateDailyAppendDryRunResult(
    result: MultiDateDailyAppendDryRunResult,
): MultiDateDailyAppendDryRunValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (result.dryRun !== true) {
        messages.push('FAIL: dryRun must be true');
        valid = false;
    }

    if (!Number.isInteger(result.requestedDateCount) || result.requestedDateCount < 1) {
        messages.push('FAIL: requestedDateCount must be >= 1');
        valid = false;
    }

    if (!Number.isInteger(result.expectedSnapshotCountPerDate) || result.expectedSnapshotCountPerDate < 1) {
        messages.push('FAIL: expectedSnapshotCountPerDate must be >= 1');
        valid = false;
    }

    if (result.expectedTotalSnapshotCount !== result.requestedDateCount * result.expectedSnapshotCountPerDate) {
        messages.push('FAIL: expectedTotalSnapshotCount mismatch');
        valid = false;
    }

    if (result.dateResults.length > result.requestedDateCount) {
        messages.push('FAIL: dateResults length cannot exceed requestedDateCount');
        valid = false;
    }

    const allowedStatuses: MultiDateAppendStatus[] = [
        'APPENDED',
        'PREVIEW_ONLY',
        'BLOCKED_DUPLICATE',
        'BLOCKED_PREVIEW_FAIL',
        'FAILED',
    ];
    for (const dateResult of result.dateResults) {
        if (!allowedStatuses.includes(dateResult.appendStatus)) {
            messages.push(`FAIL: unknown appendStatus "${dateResult.appendStatus}" for ${dateResult.asOfDate}`);
            valid = false;
        }
        if (dateResult.previewStatus !== 'PASS' && dateResult.previewStatus !== 'FAIL') {
            messages.push(`FAIL: unknown previewStatus "${dateResult.previewStatus}" for ${dateResult.asOfDate}`);
            valid = false;
        }
    }

    const countedDates = result.successfulDateCount + result.blockedDateCount + result.failedDateCount;
    if (countedDates !== result.dateResults.length) {
        messages.push('FAIL: date result counts do not add up');
        valid = false;
    }

    if (result.totalIncomingSnapshots > result.expectedTotalSnapshotCount) {
        messages.push('FAIL: totalIncomingSnapshots exceeds expected total');
        valid = false;
    }

    if (result.totalAppendedSnapshots > result.totalIncomingSnapshots) {
        messages.push('FAIL: totalAppendedSnapshots exceeds totalIncomingSnapshots');
        valid = false;
    }

    if (!result.guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noDbWrite) {
        messages.push('FAIL: noDbWrite guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noExternalApi) {
        messages.push('FAIL: noExternalApi guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noLlm) {
        messages.push('FAIL: noLlm guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noAutoTrading) {
        messages.push('FAIL: noAutoTrading guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        valid = false;
    }
    if (!result.guardrails.observabilityOnly) {
        messages.push('FAIL: observabilityOnly guardrail must be true');
        valid = false;
    }

    if (result.append) {
        if (result.totalAppendedSnapshots > 0 && result.afterCorpusCount <= result.beforeCorpusCount) {
            messages.push('FAIL: append=true with appended snapshots must increase corpus count');
            valid = false;
        }
        if (result.totalAppendedSnapshots === 0 && result.afterCorpusCount < result.beforeCorpusCount) {
            messages.push('FAIL: corpus count must not shrink');
            valid = false;
        }
    } else if (result.afterCorpusCount !== result.beforeCorpusCount) {
        messages.push('FAIL: append=false must not change corpus count');
        valid = false;
    }

    if (hasForbiddenClaim(JSON.stringify(result))) {
        messages.push('FAIL: forbidden claim detected in result');
        valid = false;
    }

    if (valid) {
        messages.push('PASS: multi-date daily append dry-run result validated');
    }

    return {
        validationStatus: valid ? 'PASS' : 'FAIL',
        validationMessages: messages,
    };
}

