/**
 * LedgerOutcomeWindowTracker.ts — P3 Online Validation
 *
 * Tracks 5D / 20D / 60D outcome windows for each shadow prediction
 * ledger entry. Determines which windows are DUE_FOR_BACKFILL,
 * NOT_DUE, BLOCKED, or BACKFILLED based on the reviewDate and TWSE calendar.
 *
 * SAFETY CONTRACT:
 * - research mode only — no DB write — no external API — no LLM
 * - no auto trading — no performance claim — no edge claim
 * - productionWriteAllowed: false LOCKED on all output
 * - backfillAllowed means artifact-only, NOT production write
 */

import { addTwseTradingDays, CALENDAR_VERSION } from './TwseTradingCalendar';

// ─── Version ──────────────────────────────────────────────────────

export const TRACKER_VERSION = 'outcome-window-tracker-v1';

// ─── Types ────────────────────────────────────────────────────────

export type WindowStatus = 'NOT_DUE' | 'DUE_FOR_BACKFILL' | 'BACKFILLED' | 'BLOCKED';
export type PitSafeStatus = 'PIT_SAFE' | 'PIT_VIOLATION' | 'PIT_UNKNOWN';
export type TrackerValidationStatus = 'PASS' | 'WARN' | 'FAIL';

export interface LedgerEntry {
    ledgerVersion?: string;
    entryType?: string;
    runId: string;
    asOfDate: string;
    universeTier: string;
    symbol: string;
    stockName?: string;
    researchBucket?: string;
    ledgerKey?: string;
    validationStatus?: string;
    guardrailStatus?: string;
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
    productionWriteAllowed?: boolean;
}

export interface OutcomeWindow {
    windowVersion: string;
    windowKey: string;
    sourceLedgerKey: string;
    originalRunId: string;
    originalAsOfDate: string;
    symbol: string;
    stockName: string;
    universeTier: string;
    horizonLabel: string;
    horizonDays: number;
    targetTradingDate: string;
    reviewDate: string;
    windowStatus: WindowStatus;
    daysUntilDue: number;
    isDue: boolean;
    isOverdue: boolean;
    backfillAllowed: boolean;
    productionWriteAllowed: false;
    pitSafeStatus: PitSafeStatus;
    validationMessages: string[];
}

export interface OutcomeWindowTrackerResult {
    trackerVersion: string;
    reviewDate: string;
    sourceEntryCount: number;
    windowCount: number;
    windows: OutcomeWindow[];
    validationStatus: TrackerValidationStatus;
    validationMessages: string[];
}

export interface OutcomeWindowSummary {
    totalWindows: number;
    byStatus: Record<string, number>;
    byHorizon: Record<string, number>;
    dueCount: number;
    notDueCount: number;
    blockedCount: number;
    overdueCount: number;
    symbolsDue: string[];
    earliestDueDate: string | null;
    latestDueDate: string | null;
}

// ─── Forbidden claims ─────────────────────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS: RegExp[] = [
    /\bprofit\b/gi,
    /\bguaranteed\b/gi,
    /\bedge\s+confirmed\b/gi,
    /\bproduction\s+approved\b/gi,
    /\bauto.?trading\b/gi,
    /\bbuy\b/gi,
    /\bsell\b/gi,
];

function containsForbiddenClaim(text: string): boolean {
    return FORBIDDEN_CLAIM_PATTERNS.some(p => p.test(text));
}

// ─── ISO date regex ───────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(s: string): boolean {
    return ISO_DATE_RE.test(s);
}

/** Calendar days between two ISO date strings (b - a) */
function calendarDaysDiff(a: string, b: string): number {
    const da = new Date(`${a}T12:00:00Z`).getTime();
    const db = new Date(`${b}T12:00:00Z`).getTime();
    return Math.round((db - da) / 86400000);
}

// ─── 1. buildOutcomeWindowKey ─────────────────────────────────────

/**
 * Builds a deterministic outcome window key.
 * Format: OUTCOME_WINDOW|asOfDate|symbol|universeTier|runId|5D
 */
export function buildOutcomeWindowKey(
    entry: Pick<LedgerEntry, 'asOfDate' | 'symbol' | 'universeTier' | 'runId'>,
    horizonDays: number,
): string {
    const label = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : horizonDays === 60 ? '60D' : `${horizonDays}D`;
    return `OUTCOME_WINDOW|${entry.asOfDate}|${entry.symbol}|${entry.universeTier}|${entry.runId}|${label}`;
}

// ─── 2. buildOutcomeWindowsForEntry ──────────────────────────────

/**
 * Builds outcome windows (one per horizon) for a single ledger entry.
 */
export function buildOutcomeWindowsForEntry(
    entry: LedgerEntry,
    options: {
        reviewDate: string;
        horizons?: number[];
    },
): OutcomeWindow[] {
    const horizons = options.horizons ?? [5, 20, 60];
    const reviewDate = options.reviewDate;
    const windows: OutcomeWindow[] = [];

    for (const horizonDays of horizons) {
        const label = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : horizonDays === 60 ? '60D' : `${horizonDays}D`;
        const windowKey = buildOutcomeWindowKey(entry, horizonDays);
        const messages: string[] = [];
        let windowStatus: WindowStatus = 'NOT_DUE';
        let pitSafeStatus: PitSafeStatus = 'PIT_SAFE';
        let targetTradingDate: string;

        try {
            targetTradingDate = addTwseTradingDays(entry.asOfDate, horizonDays);
        } catch (e) {
            targetTradingDate = entry.asOfDate; // fallback (will be BLOCKED)
            messages.push(`FAIL: Could not compute targetTradingDate: ${(e as Error).message}`);
            windowStatus = 'BLOCKED';
        }

        // PIT safety check: source date must not be after asOfDate
        const sourceDate = entry.sourceDateBasis?.sourceDate ?? '';
        if (sourceDate && isIsoDate(sourceDate) && sourceDate > entry.asOfDate) {
            pitSafeStatus = 'PIT_VIOLATION';
            messages.push(`FAIL: sourceDateBasis.sourceDate ${sourceDate} > asOfDate ${entry.asOfDate} — PIT violation`);
            windowStatus = 'BLOCKED';
        }

        // Validation/guardrail checks
        if (windowStatus !== 'BLOCKED') {
            if (entry.validationStatus && entry.validationStatus !== 'PASS') {
                messages.push(`FAIL: source entry validationStatus=${entry.validationStatus}, expected PASS`);
                windowStatus = 'BLOCKED';
            }
            if (entry.guardrailStatus && entry.guardrailStatus !== 'PASS') {
                messages.push(`FAIL: source entry guardrailStatus=${entry.guardrailStatus}, expected PASS`);
                windowStatus = 'BLOCKED';
            }
        }

        // Check if already backfilled (look at targetHorizons on the entry)
        const existingHorizon = entry.targetHorizons?.find(h => h.horizonLabel === label);
        if (existingHorizon?.outcomeStatus === 'BACKFILLED' || existingHorizon?.outcomeStatus === 'COMPLETE') {
            windowStatus = 'BACKFILLED';
        }

        // Date-based status (only set if not blocked or backfilled)
        const daysUntilDue = calendarDaysDiff(reviewDate, targetTradingDate);
        const isDue = reviewDate >= targetTradingDate;
        const isOverdue = reviewDate > targetTradingDate;

        if (windowStatus !== 'BLOCKED' && windowStatus !== 'BACKFILLED') {
            windowStatus = isDue ? 'DUE_FOR_BACKFILL' : 'NOT_DUE';
        }

        const backfillAllowed = windowStatus === 'DUE_FOR_BACKFILL';

        windows.push({
            windowVersion: TRACKER_VERSION,
            windowKey,
            sourceLedgerKey: entry.ledgerKey ?? '',
            originalRunId: entry.runId,
            originalAsOfDate: entry.asOfDate,
            symbol: entry.symbol,
            stockName: entry.stockName ?? '',
            universeTier: entry.universeTier,
            horizonLabel: label,
            horizonDays,
            targetTradingDate,
            reviewDate,
            windowStatus,
            daysUntilDue,
            isDue,
            isOverdue,
            backfillAllowed,
            productionWriteAllowed: false,
            pitSafeStatus,
            validationMessages: messages,
        });
    }

    return windows;
}

// ─── 3. buildOutcomeWindowsFromLedger ────────────────────────────

/**
 * Parses JSONL ledger content and builds outcome windows for all entries.
 * Malformed JSONL lines cause FAIL (not silent ignore).
 */
export function buildOutcomeWindowsFromLedger(
    ledgerContent: string,
    options: {
        reviewDate: string;
        horizons?: number[];
    },
): OutcomeWindowTrackerResult {
    if (!isIsoDate(options.reviewDate)) {
        return {
            trackerVersion: TRACKER_VERSION,
            reviewDate: options.reviewDate,
            sourceEntryCount: 0,
            windowCount: 0,
            windows: [],
            validationStatus: 'FAIL',
            validationMessages: [`FAIL: reviewDate "${options.reviewDate}" is not a valid YYYY-MM-DD`],
        };
    }

    const lines = ledgerContent.trim().split('\n').filter(l => l.trim().length > 0);
    const validationMessages: string[] = [];
    const entries: LedgerEntry[] = [];
    let malformedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        try {
            const obj = JSON.parse(lines[i]) as LedgerEntry;
            if (obj.entryType === 'SHADOW_PREDICTION') {
                entries.push(obj);
            }
        } catch {
            malformedCount++;
            validationMessages.push(`FAIL: Malformed JSONL at line ${i + 1}: ${lines[i].slice(0, 80)}`);
        }
    }

    if (malformedCount > 0) {
        return {
            trackerVersion: TRACKER_VERSION,
            reviewDate: options.reviewDate,
            sourceEntryCount: entries.length,
            windowCount: 0,
            windows: [],
            validationStatus: 'FAIL',
            validationMessages,
        };
    }

    const allWindows: OutcomeWindow[] = [];
    for (const entry of entries) {
        const ws = buildOutcomeWindowsForEntry(entry, options);
        allWindows.push(...ws);
    }

    const failCount = allWindows.filter(w => w.validationMessages.some(m => m.startsWith('FAIL'))).length;

    return {
        trackerVersion: TRACKER_VERSION,
        reviewDate: options.reviewDate,
        sourceEntryCount: entries.length,
        windowCount: allWindows.length,
        windows: allWindows,
        validationStatus: failCount > 0 ? 'WARN' : 'PASS',
        validationMessages,
    };
}

// ─── 4. summarizeOutcomeWindows ───────────────────────────────────

/**
 * Produces summary statistics for a set of outcome windows.
 */
export function summarizeOutcomeWindows(windows: OutcomeWindow[]): OutcomeWindowSummary {
    const byStatus: Record<string, number> = {};
    const byHorizon: Record<string, number> = {};
    const symbolsDueSet = new Set<string>();
    const dueDates: string[] = [];

    let dueCount = 0;
    let notDueCount = 0;
    let blockedCount = 0;
    let overdueCount = 0;

    for (const w of windows) {
        byStatus[w.windowStatus] = (byStatus[w.windowStatus] ?? 0) + 1;
        byHorizon[w.horizonLabel] = (byHorizon[w.horizonLabel] ?? 0) + 1;

        if (w.windowStatus === 'DUE_FOR_BACKFILL') {
            dueCount++;
            symbolsDueSet.add(w.symbol);
            dueDates.push(w.targetTradingDate);
        } else if (w.windowStatus === 'NOT_DUE') {
            notDueCount++;
        } else if (w.windowStatus === 'BLOCKED') {
            blockedCount++;
        }

        if (w.isOverdue) overdueCount++;
    }

    dueDates.sort();

    return {
        totalWindows: windows.length,
        byStatus,
        byHorizon,
        dueCount,
        notDueCount,
        blockedCount,
        overdueCount,
        symbolsDue: Array.from(symbolsDueSet).sort(),
        earliestDueDate: dueDates[0] ?? null,
        latestDueDate: dueDates[dueDates.length - 1] ?? null,
    };
}

// ─── 5. validateOutcomeWindowTrackerResult ────────────────────────

export interface TrackerValidationReport {
    validationStatus: TrackerValidationStatus;
    checks: string[];
    failures: string[];
}

/**
 * Validates an OutcomeWindowTrackerResult for contract compliance.
 */
export function validateOutcomeWindowTrackerResult(
    result: OutcomeWindowTrackerResult,
): TrackerValidationReport {
    const checks: string[] = [];
    const failures: string[] = [];

    // reviewDate must be YYYY-MM-DD
    if (!isIsoDate(result.reviewDate)) {
        failures.push(`reviewDate "${result.reviewDate}" is not YYYY-MM-DD`);
    } else {
        checks.push('reviewDate format PASS');
    }

    // Check calendar version (soft check)
    checks.push(`calendarVersion: ${CALENDAR_VERSION}`);

    for (const w of result.windows) {
        const prefix = `${w.symbol}/${w.horizonLabel}`;

        // productionWriteAllowed must always be false
        if (w.productionWriteAllowed !== false) {
            failures.push(`${prefix}: productionWriteAllowed must be false`);
        }

        // BLOCKED windows cannot have backfillAllowed=true
        if (w.windowStatus === 'BLOCKED' && w.backfillAllowed) {
            failures.push(`${prefix}: BLOCKED window cannot have backfillAllowed=true`);
        }

        // targetTradingDate must be > originalAsOfDate
        if (w.targetTradingDate <= w.originalAsOfDate) {
            failures.push(`${prefix}: targetTradingDate ${w.targetTradingDate} must be > asOfDate ${w.originalAsOfDate}`);
        }

        // No forbidden claims in any string field
        const textFields: Array<[string, string]> = [
            ['stockName', w.stockName],
            ['horizonLabel', w.horizonLabel],
            ['windowStatus', w.windowStatus],
            ['pitSafeStatus', w.pitSafeStatus],
        ];
        for (const [field, val] of textFields) {
            if (containsForbiddenClaim(val)) {
                failures.push(`${prefix}: forbidden claim in ${field}: "${val}"`);
            }
        }
    }

    if (failures.length > 0) {
        checks.push(`${failures.length} validation failure(s)`);
    }

    return {
        validationStatus: failures.length > 0 ? 'FAIL' : 'PASS',
        checks,
        failures,
    };
}
