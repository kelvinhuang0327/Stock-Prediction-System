/**
 * ShadowOutcomeBackfillScheduler.ts — P3 Online Validation
 *
 * Builds artifact-only backfill plans from outcome windows.
 * Does NOT execute production writes. dryRun=true LOCKED.
 * productionWriteAllowed=false LOCKED.
 *
 * SAFETY CONTRACT:
 * - research mode only — no DB write — no external API — no LLM
 * - no auto trading — no performance claim — no edge claim
 * - action must always be OUTCOME_WRITEBACK_ARTIFACT_ONLY
 * - dryRun always true
 * - productionWriteAllowed always false
 */

import type { OutcomeWindow } from './LedgerOutcomeWindowTracker';

// ─── Version ──────────────────────────────────────────────────────

export const SCHEDULER_VERSION = 'backfill-scheduler-v0';
export const ARTIFACT_ONLY_ACTION = 'OUTCOME_WRITEBACK_ARTIFACT_ONLY' as const;

// ─── Forbidden claims ─────────────────────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
    /\bprofit\b/gi,
    /\bguaranteed\b/gi,
    /\bedge\s+confirmed\b/gi,
    /\bproduction\s+approved\b/gi,
    /\bauto.?trading\b/gi,
    /\bbuy\b/gi,
    /\bsell\b/gi,
    /\broi\b/gi,
    /\bexpected_return\b/gi,
    /\bpredicted_return\b/gi,
];

function containsForbiddenClaim(text: string): boolean {
    return FORBIDDEN_CLAIM_PATTERNS.some(p => p.test(text));
}

// ─── Types ────────────────────────────────────────────────────────

export interface ScheduledItem {
    scheduleKey: string;
    windowKey: string;
    symbol: string;
    horizonLabel: string;
    targetTradingDate: string;
    reviewDate: string;
    action: typeof ARTIFACT_ONLY_ACTION;
    dryRun: true;
    productionWriteAllowed: false;
    reason: string;
}

export interface SkippedItem {
    windowKey: string;
    symbol: string;
    horizonLabel: string;
    windowStatus: string;
    reason: string;
}

export interface BlockedItem {
    windowKey: string;
    symbol: string;
    horizonLabel: string;
    windowStatus: string;
    reason: string;
}

export interface BackfillPlan {
    planVersion: string;
    reviewDate: string;
    candidateCount: number;
    scheduledCount: number;
    skippedCount: number;
    blockedCount: number;
    scheduledItems: ScheduledItem[];
    skippedItems: SkippedItem[];
    blockedItems: BlockedItem[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface BackfillPlanValidationReport {
    validationStatus: 'PASS' | 'FAIL';
    checks: string[];
    failures: string[];
}

// ─── 1. buildBackfillPlan ─────────────────────────────────────────

/**
 * Builds an artifact-only backfill plan from a set of outcome windows.
 * Only DUE_FOR_BACKFILL windows are scheduled.
 */
export function buildBackfillPlan(
    windows: OutcomeWindow[],
    options: {
        reviewDate: string;
        maxItems?: number;
        includeNotDue?: boolean;
    },
): BackfillPlan {
    const { reviewDate, maxItems, includeNotDue = false } = options;
    const validationMessages: string[] = [];

    const scheduledItems: ScheduledItem[] = [];
    const skippedItems: SkippedItem[] = [];
    const blockedItems: BlockedItem[] = [];

    for (const w of windows) {
        if (w.windowStatus === 'BLOCKED') {
            blockedItems.push({
                windowKey: w.windowKey,
                symbol: w.symbol,
                horizonLabel: w.horizonLabel,
                windowStatus: w.windowStatus,
                reason: `Window BLOCKED: ${w.validationMessages.join('; ') || 'validation failed'}`,
            });
            continue;
        }

        if (w.windowStatus === 'BACKFILLED') {
            skippedItems.push({
                windowKey: w.windowKey,
                symbol: w.symbol,
                horizonLabel: w.horizonLabel,
                windowStatus: w.windowStatus,
                reason: 'Already backfilled',
            });
            continue;
        }

        if (w.windowStatus === 'NOT_DUE') {
            if (includeNotDue) {
                skippedItems.push({
                    windowKey: w.windowKey,
                    symbol: w.symbol,
                    horizonLabel: w.horizonLabel,
                    windowStatus: w.windowStatus,
                    reason: `NOT_DUE: targetTradingDate=${w.targetTradingDate} is after reviewDate=${reviewDate}`,
                });
            } else {
                skippedItems.push({
                    windowKey: w.windowKey,
                    symbol: w.symbol,
                    horizonLabel: w.horizonLabel,
                    windowStatus: w.windowStatus,
                    reason: `NOT_DUE: targetTradingDate=${w.targetTradingDate} is after reviewDate=${reviewDate}`,
                });
            }
            continue;
        }

        // DUE_FOR_BACKFILL — schedule it (respecting maxItems)
        if (maxItems !== undefined && scheduledItems.length >= maxItems) {
            skippedItems.push({
                windowKey: w.windowKey,
                symbol: w.symbol,
                horizonLabel: w.horizonLabel,
                windowStatus: w.windowStatus,
                reason: `Skipped: maxItems=${maxItems} limit reached`,
            });
            continue;
        }

        const scheduleKey = `BACKFILL_SCHEDULE|${w.originalAsOfDate}|${w.symbol}|${w.universeTier}|${w.originalRunId}|${w.horizonLabel}`;

        scheduledItems.push({
            scheduleKey,
            windowKey: w.windowKey,
            symbol: w.symbol,
            horizonLabel: w.horizonLabel,
            targetTradingDate: w.targetTradingDate,
            reviewDate,
            action: ARTIFACT_ONLY_ACTION,
            dryRun: true,
            productionWriteAllowed: false,
            reason: `DUE_FOR_BACKFILL: targetTradingDate=${w.targetTradingDate} <= reviewDate=${reviewDate}`,
        });
    }

    const hasIssues = validationMessages.some(m => m.startsWith('FAIL'));

    return {
        planVersion: SCHEDULER_VERSION,
        reviewDate,
        candidateCount: windows.length,
        scheduledCount: scheduledItems.length,
        skippedCount: skippedItems.length,
        blockedCount: blockedItems.length,
        scheduledItems,
        skippedItems,
        blockedItems,
        validationStatus: hasIssues ? 'FAIL' : 'PASS',
        validationMessages,
    };
}

// ─── 2. validateBackfillPlan ──────────────────────────────────────

/**
 * Validates a BackfillPlan for contract compliance.
 * - All scheduled items must have dryRun=true, productionWriteAllowed=false
 * - action must be OUTCOME_WRITEBACK_ARTIFACT_ONLY
 * - BLOCKED/NOT_DUE must not be in scheduledItems
 * - No forbidden claims
 */
export function validateBackfillPlan(plan: BackfillPlan): BackfillPlanValidationReport {
    const checks: string[] = [];
    const failures: string[] = [];

    for (const item of plan.scheduledItems) {
        const prefix = `${item.symbol}/${item.horizonLabel}`;

        if (item.dryRun !== true) {
            failures.push(`${prefix}: dryRun must be true`);
        }
        if (item.productionWriteAllowed !== false) {
            failures.push(`${prefix}: productionWriteAllowed must be false`);
        }
        if (item.action !== ARTIFACT_ONLY_ACTION) {
            failures.push(`${prefix}: action must be ${ARTIFACT_ONLY_ACTION}, got "${item.action}"`);
        }

        // No forbidden claims in reason or scheduleKey
        if (containsForbiddenClaim(item.reason)) {
            failures.push(`${prefix}: forbidden claim in reason`);
        }
        if (containsForbiddenClaim(item.scheduleKey)) {
            failures.push(`${prefix}: forbidden claim in scheduleKey`);
        }
    }

    // Blocked items must not appear in scheduledItems
    const scheduledWindowKeys = new Set(plan.scheduledItems.map(i => i.windowKey));
    for (const b of plan.blockedItems) {
        if (scheduledWindowKeys.has(b.windowKey)) {
            failures.push(`BLOCKED window ${b.windowKey} must not appear in scheduledItems`);
        }
    }

    // Skipped items must not appear in scheduledItems
    for (const s of plan.skippedItems) {
        if (scheduledWindowKeys.has(s.windowKey)) {
            failures.push(`Skipped window ${s.windowKey} must not appear in scheduledItems`);
        }
    }

    if (failures.length === 0) {
        checks.push(`All ${plan.scheduledCount} scheduled items passed contract checks`);
        checks.push(`blockedCount=${plan.blockedCount} skippedCount=${plan.skippedCount}`);
    }

    return {
        validationStatus: failures.length > 0 ? 'FAIL' : 'PASS',
        checks,
        failures,
    };
}
