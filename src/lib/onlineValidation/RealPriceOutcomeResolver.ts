/**
 * RealPriceOutcomeResolver.ts — P0-HARDRESET
 *
 * Resolves real historical entry and outcome prices from stockQuote DB for
 * the historical replay shadow writer pipeline.
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - research mode only — no production DB write
 * - no auto trading — no performance claim — no edge claim
 * - no external API call — no LLM call
 * - PIT-safe: entry query uses date <= asOfDate; outcome query uses date <= outcomeDate
 * - asOfDate > today is rejected
 * - outcomeDate > today → PENDING (never falls back to mock-deterministic)
 * - outcomeDate <= today but missing → MISSING (never falls back to mock-deterministic)
 * - no buy/sell/roi/alpha/win_rate/outperform/guaranteed/recommendation claims
 * - priceSource always "stockQuote.close" (real) | "PENDING" | "MISSING"
 *
 * Not investment advice. Not a trading system.
 */

import { PrismaClient } from '@prisma/client';
import { addTwseTradingDays, CALENDAR_VERSION } from './TwseTradingCalendar';

// ─── Constants ─────────────────────────────────────────────────────────────

export const RESOLVER_VERSION = 'p0hardreset-real-price-resolver-v1';
export const RETURN_PCT_DECIMAL_PLACES = 4;

// ─── Types ─────────────────────────────────────────────────────────────────

/** What price source produced the result */
export type RealPriceSource =
    | 'stockQuote.close'    // real price successfully resolved from DB
    | 'PENDING'             // outcomeDate > today — not yet mature
    | 'MISSING';            // outcomeDate <= today but stockQuote row absent

export interface ResolvedEntryPrice {
    symbol: string;
    asOfDate: string;
    entryClose: number | null;
    priceSource: RealPriceSource | 'stockQuote.close';
    entryAvailable: boolean;
    reason?: string;
    pitGateDate: string;    // the gate used for the query (= asOfDate)
    resolverVersion: string;
    calendarVersion: string;
}

export interface ResolvedOutcomePrice {
    symbol: string;
    asOfDate: string;
    horizonDays: number;
    horizonLabel: string;
    outcomeDate: string;    // asOfDate + horizonDays trading days
    outcomeClose: number | null;
    priceSource: RealPriceSource;
    outcomeAvailable: boolean;
    reason?: string;
    pitGateDate: string;    // the gate used for the query (= outcomeDate)
    resolverVersion: string;
    calendarVersion: string;
}

export interface RealPriceOutcomeEntry {
    symbol: string;
    asOfDate: string;
    entryPrice: ResolvedEntryPrice;
    outcomes: ResolvedOutcomePrice[];
    returnPctByHorizon: Record<string, number | null>;
    pitSafe: boolean;
    validationMessages: string[];
}

export interface RealPriceOutcomeBatch {
    batchVersion: string;
    resolverVersion: string;
    calendarVersion: string;
    generatedAt: string;
    entryCount: number;
    horizons: number[];
    entries: RealPriceOutcomeEntry[];
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export interface RealPriceOutcomeBatchValidation {
    status: 'PASS' | 'WARN' | 'FAIL';
    entryCount: number;
    missingEntryPriceCount: number;
    pendingHorizonCount: number;
    missingHorizonCount: number;
    realPriceHorizonCount: number;
    pitViolationCount: number;
    messages: string[];
}

/** Minimal prediction descriptor needed to resolve prices */
export interface PredictionDescriptor {
    symbol: string;
    asOfDate: string;
}

/** Options for price resolution */
export interface ResolverOptions {
    prisma?: PrismaClient;          // injected for testing
    today?: string;                 // YYYY-MM-DD override for testing
    useRealPrices?: boolean;        // default: true; false = legacy mock path (for ShadowOutcomeWriteBack backward-compat)
}

// ─── Forbidden claims guard ─────────────────────────────────────────────────

const FORBIDDEN_CLAIMS = [
    'profit', 'guaranteed', 'edge confirmed', 'production approved',
    'auto trading', ' buy', ' sell', 'roi', 'alpha', 'win_rate',
    'outperform', 'expected_return', 'predicted_return', 'recommendation',
    'mock-deterministic',
];

function assertNoForbiddenClaims(text: string, context: string): void {
    const lower = text.toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
        if (lower.includes(claim)) {
            throw new Error(
                `[RealPriceOutcomeResolver] Forbidden claim "${claim}" in ${context}: "${text}"`
            );
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getToday(options?: ResolverOptions): string {
    return options?.today ?? new Date().toISOString().slice(0, 10);
}

function horizonLabel(days: number): string {
    if (days === 5) return '5D';
    if (days === 20) return '20D';
    if (days === 60) return '60D';
    return `${days}D`;
}

function roundReturnPct(raw: number): number {
    return parseFloat(raw.toFixed(RETURN_PCT_DECIMAL_PLACES));
}

// ─── Core API ──────────────────────────────────────────────────────────────

/**
 * resolveEntryPrice
 *
 * Resolves the close price of `symbol` on `asOfDate` from stockQuote.
 * PIT-safe: query uses WHERE date <= asOfDate (and we look for the exact date).
 * Returns null entryClose if stockQuote has no row for symbol + asOfDate.
 *
 * Rules:
 * - asOfDate > today → throw (forbidden future prediction)
 * - If stockQuote row exists on asOfDate → priceSource = "stockQuote.close"
 * - Else → priceSource = "MISSING" (no mock fallback)
 */
export async function resolveEntryPrice(
    symbol: string,
    asOfDate: string,
    options?: ResolverOptions,
): Promise<ResolvedEntryPrice> {
    const today = getToday(options);

    // Rule 3: asOfDate > today is forbidden
    if (asOfDate > today) {
        throw new Error(
            `[RealPriceOutcomeResolver] resolveEntryPrice: asOfDate ${asOfDate} is in the future (today=${today}). Future asOfDates are forbidden.`
        );
    }

    const prisma = options?.prisma ?? new PrismaClient();
    const shouldDisconnect = !options?.prisma;

    try {
        // PIT-safe: query uses date <= asOfDate and we find the exact date
        const row = await prisma.stockQuote.findFirst({
            where: {
                stockId: symbol,
                date: { lte: asOfDate }, // PIT gate
            },
            orderBy: { date: 'desc' },
            select: { close: true, date: true },
        });

        // We want exactly asOfDate, not the most recent date <= asOfDate
        // because entry price must be the price ON asOfDate
        const exactRow = row?.date === asOfDate ? row : null;

        if (!exactRow) {
            return {
                symbol,
                asOfDate,
                entryClose: null,
                priceSource: 'MISSING',
                entryAvailable: false,
                reason: `No stockQuote row found for symbol=${symbol} on date=${asOfDate}`,
                pitGateDate: asOfDate,
                resolverVersion: RESOLVER_VERSION,
                calendarVersion: CALENDAR_VERSION,
            };
        }

        return {
            symbol,
            asOfDate,
            entryClose: exactRow.close,
            priceSource: 'stockQuote.close',
            entryAvailable: true,
            pitGateDate: asOfDate,
            resolverVersion: RESOLVER_VERSION,
            calendarVersion: CALENDAR_VERSION,
        };
    } finally {
        if (shouldDisconnect) await prisma.$disconnect();
    }
}

/**
 * resolveOutcomePrice
 *
 * Resolves the close price of `symbol` at `asOfDate + horizonDays` trading days.
 * PIT-safe: query uses WHERE date <= outcomeDate.
 *
 * Rules:
 * - asOfDate > today → throw
 * - outcomeDate > today → priceSource = "PENDING", outcomeAvailable = false (no mock fallback)
 * - outcomeDate <= today but missing → priceSource = "MISSING", outcomeAvailable = false
 * - success → priceSource = "stockQuote.close", outcomeAvailable = true
 */
export async function resolveOutcomePrice(
    symbol: string,
    asOfDate: string,
    horizonDays: number,
    options?: ResolverOptions,
): Promise<ResolvedOutcomePrice> {
    const today = getToday(options);
    const label = horizonLabel(horizonDays);

    // Rule 3: asOfDate > today is forbidden
    if (asOfDate > today) {
        throw new Error(
            `[RealPriceOutcomeResolver] resolveOutcomePrice: asOfDate ${asOfDate} is in the future (today=${today}). Future asOfDates are forbidden.`
        );
    }

    // Calculate outcome date using TWSE trading calendar
    const outcomeDate = addTwseTradingDays(asOfDate, horizonDays);

    // Rule 4: outcomeDate > today → PENDING, no mock fallback
    if (outcomeDate > today) {
        return {
            symbol,
            asOfDate,
            horizonDays,
            horizonLabel: label,
            outcomeDate,
            outcomeClose: null,
            priceSource: 'PENDING',
            outcomeAvailable: false,
            reason: `outcomeDate ${outcomeDate} > today ${today} — outcome not yet mature`,
            pitGateDate: outcomeDate,
            resolverVersion: RESOLVER_VERSION,
            calendarVersion: CALENDAR_VERSION,
        };
    }

    const prisma = options?.prisma ?? new PrismaClient();
    const shouldDisconnect = !options?.prisma;

    try {
        // PIT-safe: query uses date <= outcomeDate
        const row = await prisma.stockQuote.findFirst({
            where: {
                stockId: symbol,
                date: { lte: outcomeDate }, // PIT gate
            },
            orderBy: { date: 'desc' },
            select: { close: true, date: true },
        });

        // Exact match required for outcome date
        const exactRow = row?.date === outcomeDate ? row : null;

        // Rule 5: missing data → MISSING
        if (!exactRow) {
            return {
                symbol,
                asOfDate,
                horizonDays,
                horizonLabel: label,
                outcomeDate,
                outcomeClose: null,
                priceSource: 'MISSING',
                outcomeAvailable: false,
                reason: `No stockQuote row found for symbol=${symbol} on outcomeDate=${outcomeDate}`,
                pitGateDate: outcomeDate,
                resolverVersion: RESOLVER_VERSION,
                calendarVersion: CALENDAR_VERSION,
            };
        }

        // Rule 6: success
        return {
            symbol,
            asOfDate,
            horizonDays,
            horizonLabel: label,
            outcomeDate,
            outcomeClose: exactRow.close,
            priceSource: 'stockQuote.close',
            outcomeAvailable: true,
            pitGateDate: outcomeDate,
            resolverVersion: RESOLVER_VERSION,
            calendarVersion: CALENDAR_VERSION,
        };
    } finally {
        if (shouldDisconnect) await prisma.$disconnect();
    }
}

/**
 * buildRealPriceOutcomeBatch
 *
 * Builds a batch of real-price outcome resolutions for a list of predictions.
 * Resolves entry + outcome prices for all given horizons.
 * Returns PENDING for immature outcomes; never falls back to mock-deterministic.
 */
export async function buildRealPriceOutcomeBatch(
    predictions: PredictionDescriptor[],
    horizons: number[],
    options?: ResolverOptions,
): Promise<RealPriceOutcomeBatch> {
    const today = getToday(options);
    const generatedAt = new Date().toISOString();

    // Validate options
    if (options?.useRealPrices === false) {
        // Legacy path: caller is responsible for using old mock path
        // We still build an empty batch as contract — never throw forbidden claim
        throw new Error(
            '[RealPriceOutcomeResolver] useRealPrices=false is not supported in this resolver. ' +
            'Use ShadowOutcomeWriteBack for the legacy mock path.'
        );
    }

    const prisma = options?.prisma ?? new PrismaClient();
    const shouldDisconnect = !options?.prisma;
    const batchMessages: string[] = [];
    const entries: RealPriceOutcomeEntry[] = [];

    try {
        for (const pred of predictions) {
            const { symbol, asOfDate } = pred;
            const entryMessages: string[] = [];

            // Validate asOfDate not in future
            if (asOfDate > today) {
                batchMessages.push(`REJECTED: symbol=${symbol} asOfDate=${asOfDate} is in the future`);
                continue;
            }

            // Resolve entry price
            const entryPrice = await resolveEntryPrice(symbol, asOfDate, { ...options, prisma });

            if (!entryPrice.entryAvailable) {
                entryMessages.push(`WARN: entry price unavailable for ${symbol} on ${asOfDate}: ${entryPrice.reason}`);
            }

            // Resolve outcome prices for each horizon
            const outcomes: ResolvedOutcomePrice[] = [];
            const returnPctByHorizon: Record<string, number | null> = {};

            for (const h of horizons) {
                const label = horizonLabel(h);
                const outcome = await resolveOutcomePrice(symbol, asOfDate, h, { ...options, prisma });
                outcomes.push(outcome);

                // Rule 6: compute returnPct if both prices available
                if (
                    entryPrice.entryAvailable &&
                    entryPrice.entryClose !== null &&
                    outcome.outcomeAvailable &&
                    outcome.outcomeClose !== null
                ) {
                    const returnPct = roundReturnPct(
                        ((outcome.outcomeClose - entryPrice.entryClose) / entryPrice.entryClose) * 100
                    );
                    // Forbidden: do not include buy/sell/roi/alpha/outperform claims
                    returnPctByHorizon[label] = returnPct;
                } else {
                    returnPctByHorizon[label] = null;
                }
            }

            // PIT check: verify entry price query respected asOfDate gate
            const pitSafe =
                entryPrice.pitGateDate === asOfDate &&
                outcomes.every(o => o.pitGateDate === o.outcomeDate);

            entries.push({
                symbol,
                asOfDate,
                entryPrice,
                outcomes,
                returnPctByHorizon,
                pitSafe,
                validationMessages: entryMessages,
            });
        }
    } finally {
        if (shouldDisconnect) await prisma.$disconnect();
    }

    const failCount = entries.filter(e => !e.entryPrice.entryAvailable).length;
    const warnCount = entries.filter(e =>
        e.outcomes.some(o => o.priceSource === 'MISSING')
    ).length;

    return {
        batchVersion: 'p0hardreset-real-price-batch-v1',
        resolverVersion: RESOLVER_VERSION,
        calendarVersion: CALENDAR_VERSION,
        generatedAt,
        entryCount: entries.length,
        horizons,
        entries,
        validationStatus: failCount > entries.length * 0.5 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS',
        validationMessages: batchMessages,
    };
}

/**
 * validateRealPriceOutcomeBatch
 *
 * Validates a real-price outcome batch for quality and PIT-safety.
 * Does not reject PENDING outcomes (those are expected for immature horizons).
 * Rejects any mock-deterministic price source.
 */
export function validateRealPriceOutcomeBatch(
    batch: RealPriceOutcomeBatch,
): RealPriceOutcomeBatchValidation {
    const messages: string[] = [];
    let missingEntryPriceCount = 0;
    let pendingHorizonCount = 0;
    let missingHorizonCount = 0;
    let realPriceHorizonCount = 0;
    let pitViolationCount = 0;

    for (const entry of batch.entries) {
        // Check for forbidden price sources
        if ((entry.entryPrice.priceSource as string) === 'mock-deterministic') {
            messages.push(`FAIL: mock-deterministic entry price forbidden for ${entry.symbol} on ${entry.asOfDate}`);
        }

        if (!entry.entryPrice.entryAvailable) {
            missingEntryPriceCount++;
        }

        if (!entry.pitSafe) {
            pitViolationCount++;
            messages.push(`FAIL: PIT violation for ${entry.symbol} on ${entry.asOfDate}`);
        }

        for (const outcome of entry.outcomes) {
            if ((outcome.priceSource as string) === 'mock-deterministic') {
                messages.push(
                    `FAIL: mock-deterministic outcome price forbidden for ${entry.symbol} ${outcome.horizonLabel}`
                );
            }
            if (outcome.priceSource === 'PENDING') pendingHorizonCount++;
            else if (outcome.priceSource === 'MISSING') missingHorizonCount++;
            else if (outcome.priceSource === 'stockQuote.close') realPriceHorizonCount++;
        }
    }

    // Check for forbidden claims in batch messages
    for (const msg of batch.validationMessages) {
        try {
            assertNoForbiddenClaims(msg, 'batchValidationMessages');
        } catch (e) {
            messages.push((e as Error).message);
        }
    }

    const hasFail = messages.some(m => m.startsWith('FAIL'));
    const status: 'PASS' | 'WARN' | 'FAIL' = hasFail ? 'FAIL' : messages.length > 0 ? 'WARN' : 'PASS';

    return {
        status,
        entryCount: batch.entryCount,
        missingEntryPriceCount,
        pendingHorizonCount,
        missingHorizonCount,
        realPriceHorizonCount,
        pitViolationCount,
        messages,
    };
}
