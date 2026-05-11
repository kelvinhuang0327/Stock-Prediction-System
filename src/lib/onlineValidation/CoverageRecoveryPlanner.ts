/**
 * CoverageRecoveryPlanner.ts — P13 Online Validation
 *
 * Builds an observability-only recovery plan from the horizon maturity tracker
 * and corpus quality gate. This is not optimizer input and not a trading plan.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 */

import type { CorpusMetrics } from './CorpusMetricsStore';
import type { CorpusQualityGateResult } from './CorpusQualityGate';
import type { HorizonMaturityTracker, HorizonMaturitySummary } from './HorizonMaturityTracker';

export const COVERAGE_RECOVERY_PLAN_VERSION = 'coverage-recovery-plan-v0';

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

export type CoverageRecoveryStatus =
    | 'RECOVERY_PLAN_READY'
    | 'DATA_LIMITED'
    | 'BLOCKED';

export type RecoveryNeed =
    | 'WAIT_FOR_MATURITY'
    | 'BACKFILL_MISSING_OUTCOME'
    | 'EXPAND_CORPUS'
    | 'NO_ACTION';

export interface CoverageRecoveryGuardrails {
    noProductionWrite: true;
    noOptimizerWrite: true;
    noPerformanceClaim: true;
    noTradingSignal: true;
    observabilityOnly: true;
}

export interface CoverageRecoveryItem {
    horizonLabel: string;
    currentCoverageRatio: number;
    targetCoverageRatio: number;
    blockedCount: number;
    topBlockedReason: string;
    recoveryNeed: RecoveryNeed;
    estimatedNextStep: string;
    productionWriteAllowed: false;
    optimizerWriteAllowed: false;
}

export interface CoverageRecoveryPlan {
    recoveryPlanVersion: string;
    recoveryRunId: string;
    generatedAt: string;
    currentCoverageRatio: number;
    targetCoverageRatio: number;
    currentHorizonCoverageGap: number;
    targetHorizonCoverageGap: number;
    currentUniqueAsOfDateCount: number;
    targetUniqueAsOfDateCount: number;
    recoveryStatus: CoverageRecoveryStatus;
    blockers: string[];
    recommendedActions: string[];
    horizonRecoveryItems: CoverageRecoveryItem[];
    guardrails: CoverageRecoveryGuardrails;
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BuildCoverageRecoveryPlanOptions {
    recoveryRunId: string;
    generatedAt: string;
    targetCoverageRatio?: number;
    targetHorizonCoverageGap?: number;
    targetUniqueAsOfDateCount?: number;
}

export interface CoverageRecoveryValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

function topBlockedReason(blockedReasonCounts: Record<string, number>): string {
    const entries = Object.entries(blockedReasonCounts);
    if (entries.length === 0) return 'NONE';
    entries.sort((a, b) => {
        const delta = b[1] - a[1];
        return delta !== 0 ? delta : a[0].localeCompare(b[0]);
    });
    return entries[0][0];
}

function recoveryNeedFor(summary: HorizonMaturitySummary, totalEntries: number, targetUniqueAsOfDateCount: number): RecoveryNeed {
    const reason = topBlockedReason(summary.blockedReasonCounts);
    const corpusTooSmall =
        totalEntries < 18 ||
        (targetUniqueAsOfDateCount > 0 && totalEntries < targetUniqueAsOfDateCount * 2);

    if (reason === 'OUTCOME_MISSING') {
        return 'BACKFILL_MISSING_OUTCOME';
    }
    if (corpusTooSmall) {
        return 'EXPAND_CORPUS';
    }
    if (reason === 'WINDOW_NOT_DUE' || reason === 'NOT_DUE') {
        return 'WAIT_FOR_MATURITY';
    }
    return 'NO_ACTION';
}

export function buildCoverageRecoveryPlan(
    input: {
        horizonMaturityTracker: HorizonMaturityTracker;
        corpusQualityGate: CorpusQualityGateResult;
        corpusMetrics: CorpusMetrics;
    },
    options: BuildCoverageRecoveryPlanOptions,
): CoverageRecoveryPlan {
    const targetCoverageRatio = options.targetCoverageRatio ?? 0.5;
    const targetHorizonCoverageGap = options.targetHorizonCoverageGap ?? 0.35;
    const targetUniqueAsOfDateCount = options.targetUniqueAsOfDateCount ?? 10;

    const currentCoverageRatio = input.corpusMetrics.coverageRatio;
    const currentHorizonCoverageGap = input.corpusQualityGate.horizonCoverageGap;
    const currentUniqueAsOfDateCount = input.corpusMetrics.uniqueAsOfDateCount;
    const effectiveTotalEntries = Math.min(
        input.corpusMetrics.totalEntries,
        input.horizonMaturityTracker.totalEntries,
    );

    const blockers: string[] = [];
    const recommendedActions: string[] = [];

    if (currentCoverageRatio < targetCoverageRatio) {
        blockers.push(
            `coverageRatio=${currentCoverageRatio.toFixed(4)} is below targetCoverageRatio=${targetCoverageRatio.toFixed(4)}`,
        );
    }
    if (currentHorizonCoverageGap > targetHorizonCoverageGap) {
        blockers.push(
            `horizonCoverageGap=${currentHorizonCoverageGap.toFixed(4)} is above targetHorizonCoverageGap=${targetHorizonCoverageGap.toFixed(4)}`,
        );
    }
    if (currentUniqueAsOfDateCount < targetUniqueAsOfDateCount) {
        blockers.push(
            `uniqueAsOfDateCount=${currentUniqueAsOfDateCount} is below targetUniqueAsOfDateCount=${targetUniqueAsOfDateCount}`,
        );
    }

    for (const summary of input.horizonMaturityTracker.horizonSummaries) {
        if (summary.maturityStatus === 'NOT_DUE_DOMINANT') {
            blockers.push(`${summary.horizonLabel} horizon is not due dominant`);
        }
        if (summary.maturityStatus === 'MISSING_OUTCOME_DOMINANT') {
            blockers.push(`${summary.horizonLabel} horizon is missing outcome dominant`);
        }
    }

    if (input.horizonMaturityTracker.maturityStatus === 'IMMATURE') {
        blockers.push('corpus horizon maturity is immature');
    }

    if (currentCoverageRatio < targetCoverageRatio) {
        recommendedActions.push('Wait for more outcomes to settle before reevaluating coverage.');
    }
    if (currentHorizonCoverageGap > targetHorizonCoverageGap) {
        recommendedActions.push('Keep tracking horizon readiness until the gap narrows.');
    }
    if (currentUniqueAsOfDateCount < targetUniqueAsOfDateCount) {
        recommendedActions.push('Extend the corpus with additional as-of dates to improve breadth.');
    }

    const horizonRecoveryItems: CoverageRecoveryItem[] = input.horizonMaturityTracker.horizonSummaries.map(summary => {
        const reason = topBlockedReason(summary.blockedReasonCounts);
        const recoveryNeed = recoveryNeedFor(summary, effectiveTotalEntries, targetUniqueAsOfDateCount);
        const estimatedNextStep =
            recoveryNeed === 'WAIT_FOR_MATURITY'
                ? `Hold ${summary.horizonLabel} until target dates mature`
                : recoveryNeed === 'BACKFILL_MISSING_OUTCOME'
                ? `Backfill missing outcomes for ${summary.horizonLabel}`
                : recoveryNeed === 'EXPAND_CORPUS'
                ? `Expand corpus breadth before relying on ${summary.horizonLabel}`
                : `No immediate action for ${summary.horizonLabel}`;

        return {
            horizonLabel: summary.horizonLabel,
            currentCoverageRatio: summary.coverageRatio,
            targetCoverageRatio,
            blockedCount: summary.blockedCount,
            topBlockedReason: reason,
            recoveryNeed,
            estimatedNextStep,
            productionWriteAllowed: false,
            optimizerWriteAllowed: false,
        };
    });

    let recoveryStatus: CoverageRecoveryStatus;
    const planLooksReady =
        currentCoverageRatio >= targetCoverageRatio &&
        currentHorizonCoverageGap <= targetHorizonCoverageGap &&
        input.horizonMaturityTracker.maturityStatus === 'MATURE_FOR_OBSERVABILITY';

    if (input.corpusMetrics.totalEntries === 0 || input.horizonMaturityTracker.validationStatus === 'FAIL') {
        recoveryStatus = 'BLOCKED';
    } else if (planLooksReady) {
        recoveryStatus = 'RECOVERY_PLAN_READY';
    } else {
        recoveryStatus = 'DATA_LIMITED';
    }

    const plan: CoverageRecoveryPlan = {
        recoveryPlanVersion: COVERAGE_RECOVERY_PLAN_VERSION,
        recoveryRunId: options.recoveryRunId,
        generatedAt: options.generatedAt,
        currentCoverageRatio,
        targetCoverageRatio,
        currentHorizonCoverageGap,
        targetHorizonCoverageGap,
        currentUniqueAsOfDateCount,
        targetUniqueAsOfDateCount,
        recoveryStatus,
        blockers,
        recommendedActions,
        horizonRecoveryItems,
        guardrails: {
            noProductionWrite: true,
            noOptimizerWrite: true,
            noPerformanceClaim: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: 'PASS',
        validationMessages: [],
    };

    const validation = validateCoverageRecoveryPlan(plan);
    plan.validationStatus = validation.validationStatus;
    plan.validationMessages = validation.validationMessages;

    return plan;
}

export function validateCoverageRecoveryPlan(
    plan: CoverageRecoveryPlan,
): CoverageRecoveryValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    const guardrails = plan.guardrails;
    if (!guardrails.noProductionWrite) {
        messages.push('FAIL: noProductionWrite guardrail must be true');
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
    if (!guardrails.observabilityOnly) {
        messages.push('FAIL: observabilityOnly guardrail must be true');
        status = 'FAIL';
    }

    for (const item of plan.horizonRecoveryItems) {
        if (item.productionWriteAllowed !== false) {
            messages.push(`FAIL: productionWriteAllowed must be false: ${item.horizonLabel}`);
            status = 'FAIL';
        }
        if (item.optimizerWriteAllowed !== false) {
            messages.push(`FAIL: optimizerWriteAllowed must be false: ${item.horizonLabel}`);
            status = 'FAIL';
        }
    }

    if ((plan.recoveryStatus as string) === 'PRODUCTION_READY') {
        messages.push('FAIL: recoveryStatus must not be PRODUCTION_READY');
        status = 'FAIL';
    }

    if (hasForbiddenClaim(JSON.stringify(plan))) {
        messages.push('FAIL: forbidden claim detected in coverage recovery plan');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: coverage recovery plan safety contracts verified');
    }

    return { validationStatus: status, validationMessages: messages };
}
