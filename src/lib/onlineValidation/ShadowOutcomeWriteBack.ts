/**
 * ShadowOutcomeWriteBack.ts — P0-COMBINED Part C Skeleton
 *
 * Outcome write-back v0 skeleton for shadow prediction log entries.
 * Defines the types and stubs for 5D / 20D outcome calculation.
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - research mode only
 * - outcome write-back NOT YET IMPLEMENTED (all functions throw NOT_YET_IMPLEMENTED)
 * - no DB write in this skeleton
 * - no actual outcome row written
 * - no external API call
 * - no LLM call
 * - no future date price lookup
 * - no performance claim
 * - no edge claim
 * - PIT (point-in-time) safe: all date lookups must use asOfDate gate
 *
 * Not investment advice. Not a trading system.
 */

import { ShadowPredictionLogEntry, ValidationStatusValue } from './ShadowPredictionLogContract';

// ─── Types ────────────────────────────────────────────────────────

export type OutcomeHorizonDays = 5 | 20;

/**
 * Specifies a target for outcome write-back.
 * horizonTradingDays uses TRADING days (not calendar days):
 *   5D  = 5 trading days ≈ 1 week
 *   20D = 20 trading days ≈ 1 month
 */
export interface OutcomeWriteBackTarget {
    symbol: string;
    asOfDate: string;          // YYYY-MM-DD — the prediction anchor date
    runId: string;
    horizonTradingDays: OutcomeHorizonDays;
    targetTradingDate: string; // YYYY-MM-DD — resolved trading date (NOT implemented yet)
    horizonLabel: '5D' | '20D';
    sourceDuplicateKey: string;
}

/**
 * Price lookup result for outcome calculation.
 * Must be PIT-safe: no future dates, asOfDate gate enforced.
 */
export interface OutcomePriceResult {
    symbol: string;
    targetDate: string;        // actual date price was found (trading day)
    asOfGateDate: string;      // asOfDate used for gate — must be >= targetDate
    closePrice: number | null;
    priceStatus: 'FOUND' | 'NOT_FOUND' | 'FUTURE_DATE_BLOCKED' | 'NOT_YET_IMPLEMENTED';
    missingDataFlags: string[];
}

/**
 * A single outcome write-back record (not yet written to DB).
 */
export interface OutcomeWriteBackRecord {
    symbol: string;
    runId: string;
    asOfDate: string;
    horizonLabel: '5D' | '20D';
    targetTradingDate: string;
    outcomeStatus: 'PENDING' | 'RESOLVED' | 'DATA_MISSING';
    // NOTE: No priceDiff / return fields in skeleton — forbidden until P1
    validationStatus: ValidationStatusValue;
    validationMessages: string[];
    writeBackAllowed: false;       // locked false in skeleton
}

export interface OutcomeWriteBackBatch {
    batchVersion: string;
    runId: string;
    asOfDate: string;
    generatedAt: string;
    records: OutcomeWriteBackRecord[];
    batchValidationStatus: ValidationStatusValue;
    batchValidationMessages: string[];
    writeBackAllowed: false;       // locked false in skeleton
}

export interface OutcomeWriteBackValidationResult {
    status: ValidationStatusValue;
    messages: string[];
}

// ─── NOT_YET_IMPLEMENTED stub helper ──────────────────────────────

function notYetImplemented(fnName: string): never {
    throw new Error(`NOT_YET_IMPLEMENTED: ${fnName} — P1 Outcome Write-back v0`);
}

// ─── Exported stubs ───────────────────────────────────────────────

/**
 * planOutcomeWriteBackTargets
 *
 * Plans the set of outcome write-back targets from shadow log entries.
 * For each entry, generates 5D and 20D targets.
 *
 * Trading day definition:
 * - 5D  = 5 consecutive Taiwan Stock Exchange trading days after asOfDate
 * - 20D = 20 consecutive Taiwan Stock Exchange trading days after asOfDate
 * - Calendar days are NOT used (weekends and holidays excluded)
 *
 * NOT YET IMPLEMENTED — throws NOT_YET_IMPLEMENTED.
 * P1 implementation must:
 * - Load TWSE trading calendar
 * - Validate target dates are not weekend/holiday
 * - Enforce asOfDate gate (no future prices)
 */
export function planOutcomeWriteBackTargets(
    entries: ShadowPredictionLogEntry[],
    horizonDays: OutcomeHorizonDays,
): OutcomeWriteBackTarget[] {
    notYetImplemented('planOutcomeWriteBackTargets');
}

/**
 * resolveOutcomePriceAsOf
 *
 * Looks up the closing price for a symbol on targetDate.
 * MUST enforce asOfDate gate: price lookup date must be <= asOfDate.
 * If targetDate > asOfDate → return FUTURE_DATE_BLOCKED.
 *
 * NOT YET IMPLEMENTED — throws NOT_YET_IMPLEMENTED.
 * P1 implementation must:
 * - Query StockQuote where date = targetDate AND date <= asOfDate
 * - Return null if no record found (data gap)
 * - Never return a price where the quote date > asOfDate (PIT violation)
 * - Never call external API (use only local DB)
 */
export async function resolveOutcomePriceAsOf(
    symbol: string,
    targetDate: string,  // YYYY-MM-DD — the trading day to look up
    asOfDate: string,    // YYYY-MM-DD — the gate date (must be >= targetDate)
): Promise<OutcomePriceResult> {
    notYetImplemented('resolveOutcomePriceAsOf');
}

/**
 * buildOutcomeWriteBackBatch
 *
 * Builds a batch of outcome write-back records from resolved targets.
 * All records start with outcomeStatus=PENDING, writeBackAllowed=false.
 *
 * NOT YET IMPLEMENTED — throws NOT_YET_IMPLEMENTED.
 * P1 implementation must:
 * - Not calculate any return / priceDiff (that is P2+)
 * - Only record the metadata: symbol, horizonLabel, targetTradingDate, outcomeStatus
 * - Enforce PIT-safe gate on all lookups
 */
export function buildOutcomeWriteBackBatch(
    entries: ShadowPredictionLogEntry[],
): OutcomeWriteBackBatch {
    notYetImplemented('buildOutcomeWriteBackBatch');
}

/**
 * validateOutcomeWriteBackBatch
 *
 * Validates a write-back batch before any write operation.
 * Returns PASS / WARN / FAIL.
 *
 * NOT YET IMPLEMENTED — throws NOT_YET_IMPLEMENTED.
 * P1 implementation must validate:
 * - All records have valid asOfDate format (YYYY-MM-DD)
 * - All targetTradingDates are > asOfDate (outcome date must be after prediction)
 * - All targetTradingDates are <= resolveAsOfDate() (no future lookup)
 * - writeBackAllowed is false (locked in skeleton)
 * - No forbidden performance fields in records
 */
export function validateOutcomeWriteBackBatch(
    batch: OutcomeWriteBackBatch,
): OutcomeWriteBackValidationResult {
    notYetImplemented('validateOutcomeWriteBackBatch');
}
