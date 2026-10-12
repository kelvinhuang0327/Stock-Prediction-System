/**
 * MultiDateDailyAppendPlan.ts — P12 Online Validation
 *
 * Builds a deterministic multi-date daily append plan for the real-market
 * snapshot corpus continuation flow.
 *
 * SAFETY CONTRACT:
 * - research mode only — append-only dry-run plan
 * - no production DB write — no external API — no LLM
 * - no optimizer write — no auto trading — no performance claim
 */

import {
    CALENDAR_VERSION,
    isTwseTradingDay,
} from './TwseTradingCalendar';
import {
    DEFAULT_HORIZONS,
    DEFAULT_SOURCE_MODE,
    DEFAULT_SYMBOLS,
    type SourceMode,
    type TradingDayStatus,
} from './DailyRealMarketSnapshotSeed';

export const MULTI_DATE_PLAN_VERSION = 'multi-date-daily-append-plan-v0';

export const DEFAULT_MULTI_DATE_AS_OF_DATES = [
    '2026-05-18',
    '2026-05-19',
    '2026-05-20',
    '2026-05-21',
    '2026-05-22',
] as const;

export const DEFAULT_MULTI_DATE_REVIEW_DATE = '2026-07-13';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export interface MultiDateDailyAppendPlanGuardrails {
    noProductionWrite: true;
    noDbWrite: true;
    noExternalApi: true;
    noLlm: true;
    noOptimizerWrite: true;
    noAutoTrading: true;
    noPerformanceClaim: true;
    observabilityOnly: true;
}

export interface MultiDateDailyAppendPlanDateItem {
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    expectedSnapshotCount: number;
    tradingDayStatus: TradingDayStatus;
    appendAllowed: boolean;
    validationMessages: string[];
}

export interface MultiDateDailyAppendPlan {
    planVersion: string;
    planRunId: string;
    asOfDateCount: number;
    expectedSnapshotCount: number;
    dates: MultiDateDailyAppendPlanDateItem[];
    symbols: string[];
    horizons: string[];
    sourceMode: SourceMode;
    guardrails: MultiDateDailyAppendPlanGuardrails;
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface BuildMultiDateDailyAppendPlanOptions {
    asOfDates?: string[];
    reviewDateByAsOfDate?: Record<string, string>;
    defaultReviewDate?: string;
    symbols?: string[];
    horizons?: string[];
    sourceMode?: SourceMode;
    planRunId: string;
}

export interface MultiDateDailyAppendPlanValidationResult {
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

function buildSimulationRunId(asOfDate: string): string {
    return `p12-daily-real-market-simulation-${asOfDate.replace(/-/g, '')}-001`;
}

function buildTradingDayStatus(asOfDate: string): TradingDayStatus {
    const isKnownTradingDay = isTwseTradingDay(asOfDate);
    return {
        isKnownTradingDay,
        calendarVersion: CALENDAR_VERSION,
        note: isKnownTradingDay
            ? `${asOfDate} is a known TWSE trading day`
            : `${asOfDate} is a weekend or known TWSE holiday`,
    };
}

export function buildMultiDateDailyAppendPlan(
    options: BuildMultiDateDailyAppendPlanOptions,
): MultiDateDailyAppendPlan {
    const asOfDates = options.asOfDates ?? [...DEFAULT_MULTI_DATE_AS_OF_DATES];
    const symbols = options.symbols ?? [...DEFAULT_SYMBOLS];
    const horizons = options.horizons ?? [...DEFAULT_HORIZONS];
    const sourceMode = options.sourceMode ?? DEFAULT_SOURCE_MODE;
    const defaultReviewDate = options.defaultReviewDate ?? DEFAULT_MULTI_DATE_REVIEW_DATE;

    const dates: MultiDateDailyAppendPlanDateItem[] = asOfDates.map(asOfDate => {
        const reviewDate = options.reviewDateByAsOfDate?.[asOfDate] ?? defaultReviewDate;
        const tradingDayStatus = buildTradingDayStatus(asOfDate);
        const validationMessages: string[] = [];
        let appendAllowed = true;

        if (!ISO_DATE_RE.test(asOfDate)) {
            validationMessages.push(`FAIL: asOfDate "${asOfDate}" must be YYYY-MM-DD`);
            appendAllowed = false;
        }

        if (!ISO_DATE_RE.test(reviewDate)) {
            validationMessages.push(`FAIL: reviewDate "${reviewDate}" must be YYYY-MM-DD`);
            appendAllowed = false;
        }

        if (!tradingDayStatus.isKnownTradingDay) {
            validationMessages.push(`FAIL: asOfDate "${asOfDate}" is not a TWSE trading day`);
            appendAllowed = false;
        }

        const expectedSnapshotCount = symbols.length * horizons.length;
        if (expectedSnapshotCount <= 0) {
            validationMessages.push('FAIL: expectedSnapshotCount must be positive');
            appendAllowed = false;
        }

        if (appendAllowed) {
            validationMessages.push('PASS: daily append plan item validated');
        }

        return {
            asOfDate,
            reviewDate,
            simulationRunId: buildSimulationRunId(asOfDate),
            expectedSnapshotCount,
            tradingDayStatus,
            appendAllowed,
            validationMessages,
        };
    });

    const plan: MultiDateDailyAppendPlan = {
        planVersion: MULTI_DATE_PLAN_VERSION,
        planRunId: options.planRunId,
        asOfDateCount: dates.length,
        expectedSnapshotCount: dates.reduce((sum, item) => sum + item.expectedSnapshotCount, 0),
        dates,
        symbols,
        horizons,
        sourceMode,
        guardrails: {
            noProductionWrite: true,
            noDbWrite: true,
            noExternalApi: true,
            noLlm: true,
            noOptimizerWrite: true,
            noAutoTrading: true,
            noPerformanceClaim: true,
            observabilityOnly: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateMultiDateDailyAppendPlan(plan);
    plan.validationStatus = validation.validationStatus;
    plan.validationMessages = validation.validationMessages;
    return plan;
}

export function validateMultiDateDailyAppendPlan(
    plan: MultiDateDailyAppendPlan,
): MultiDateDailyAppendPlanValidationResult {
    const messages: string[] = [];
    let valid = true;

    if (!Number.isInteger(plan.asOfDateCount) || plan.asOfDateCount < 1) {
        messages.push('FAIL: asOfDateCount must be >= 1');
        valid = false;
    }

    if (plan.dates.length !== plan.asOfDateCount) {
        messages.push('FAIL: asOfDateCount must match dates.length');
        valid = false;
    }

    if (plan.expectedSnapshotCount !== plan.dates.reduce((sum, item) => sum + item.expectedSnapshotCount, 0)) {
        messages.push('FAIL: expectedSnapshotCount mismatch');
        valid = false;
    }

    const seenDates = new Set<string>();
    for (const item of plan.dates) {
        if (seenDates.has(item.asOfDate)) {
            messages.push(`FAIL: duplicate asOfDate "${item.asOfDate}"`);
            valid = false;
        }
        seenDates.add(item.asOfDate);

        if (!ISO_DATE_RE.test(item.asOfDate)) {
            messages.push(`FAIL: asOfDate "${item.asOfDate}" must be YYYY-MM-DD`);
            valid = false;
        }

        if (!ISO_DATE_RE.test(item.reviewDate)) {
            messages.push(`FAIL: reviewDate "${item.reviewDate}" must be YYYY-MM-DD`);
            valid = false;
        }

        if (!item.tradingDayStatus.isKnownTradingDay) {
            messages.push(`FAIL: asOfDate "${item.asOfDate}" is not a TWSE trading day`);
            valid = false;
        }

        if (!item.appendAllowed) {
            messages.push(`FAIL: appendAllowed must be true for ${item.asOfDate}`);
            valid = false;
        }

        const expectedPerDate = plan.symbols.length * plan.horizons.length;
        if (item.expectedSnapshotCount !== expectedPerDate) {
            messages.push(`FAIL: expectedSnapshotCount mismatch for ${item.asOfDate}`);
            valid = false;
        }

        const expectedRunId = buildSimulationRunId(item.asOfDate);
        if (item.simulationRunId !== expectedRunId) {
            messages.push(`FAIL: simulationRunId mismatch for ${item.asOfDate}`);
            valid = false;
        }
    }

    const guardrails = plan.guardrails;
    if (!guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noDbWrite) {
        messages.push('FAIL: noDbWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noExternalApi) {
        messages.push('FAIL: noExternalApi guardrail must be true');
        valid = false;
    }
    if (!guardrails.noLlm) {
        messages.push('FAIL: noLlm guardrail must be true');
        valid = false;
    }
    if (!guardrails.noOptimizerWrite) {
        messages.push('FAIL: noOptimizerWrite guardrail must be true');
        valid = false;
    }
    if (!guardrails.noAutoTrading) {
        messages.push('FAIL: noAutoTrading guardrail must be true');
        valid = false;
    }
    if (!guardrails.noPerformanceClaim) {
        messages.push('FAIL: noPerformanceClaim guardrail must be true');
        valid = false;
    }
    if (!guardrails.observabilityOnly) {
        messages.push('FAIL: observabilityOnly guardrail must be true');
        valid = false;
    }

    if (hasForbiddenClaim(JSON.stringify(plan))) {
        messages.push('FAIL: forbidden claim detected in plan');
        valid = false;
    }

    if (valid) {
        messages.push('PASS: multi-date daily append plan validated');
    }

    return {
        validationStatus: valid ? 'PASS' : 'FAIL',
        validationMessages: messages,
    };
}

