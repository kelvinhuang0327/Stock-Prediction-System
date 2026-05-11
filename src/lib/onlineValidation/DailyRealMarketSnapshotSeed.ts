/**
 * DailyRealMarketSnapshotSeed.ts — P11 Online Validation
 *
 * Seed contract for daily real-market snapshot corpus append dry-run.
 * Validates date, TWSE trading day, horizons, source mode, and guardrails.
 *
 * SAFETY CONTRACT:
 * - No production DB write — no external API — no LLM
 * - No trading signals — no performance claims
 * - guardrails locked true
 * - Dry-run only — not a production daily job
 */

import {
    isTwseTradingDay,
    CALENDAR_VERSION,
} from './TwseTradingCalendar';

export const SEED_VERSION = 'daily-real-market-seed-v0';

// ─── Forbidden claims ────────────────────────────────────────────────────────

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
    return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const VALID_HORIZONS = ['5D', '20D', '60D'] as const;
export type ValidHorizon = (typeof VALID_HORIZONS)[number];

export type SourceMode = 'MOCK_LOCAL' | 'EXISTING_LOCAL_DATA_ONLY';
export const VALID_SOURCE_MODES: SourceMode[] = ['MOCK_LOCAL', 'EXISTING_LOCAL_DATA_ONLY'];

export const DEFAULT_SYMBOLS = ['2330', '2454'];
export const DEFAULT_HORIZONS: ValidHorizon[] = ['5D', '20D', '60D'];
export const DEFAULT_SOURCE_MODE: SourceMode = 'EXISTING_LOCAL_DATA_ONLY';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DailyRealMarketSnapshotSeedGuardrails {
    noProductionWrite: true;
    noExternalApi: true;
    noOptimizerWrite: true;
    noTradingSignal: true;
    observabilityOnly: true;
}

export interface TradingDayStatus {
    isKnownTradingDay: boolean;
    calendarVersion: string;
    note: string;
}

export interface DailyRealMarketSnapshotSeed {
    seedVersion: string;
    asOfDate: string;
    reviewDate: string;
    simulationRunId: string;
    symbols: string[];
    horizons: string[];
    sourceMode: SourceMode;
    tradingDayStatus: TradingDayStatus;
    guardrails: DailyRealMarketSnapshotSeedGuardrails;
    validationStatus: 'PASS' | 'FAIL';
    validationMessages: string[];
}

export interface BuildDailyRealMarketSnapshotSeedOptions {
    asOfDate: string;
    reviewDate: string;
    simulationRunId?: string;
    symbols?: string[];
    horizons?: string[];
    sourceMode?: SourceMode;
}

// ─── Builders ─────────────────────────────────────────────────────────────────

export function buildDailyRealMarketSnapshotSeed(
    options: BuildDailyRealMarketSnapshotSeedOptions,
): DailyRealMarketSnapshotSeed {
    const {
        asOfDate,
        reviewDate,
        symbols = DEFAULT_SYMBOLS,
        horizons = [...DEFAULT_HORIZONS],
        sourceMode = DEFAULT_SOURCE_MODE,
    } = options;

    const simulationRunId =
        options.simulationRunId ?? `p11-daily-real-market-simulation-${asOfDate.replace(/-/g, '')}-001`;

    const messages: string[] = [];
    let status: 'PASS' | 'FAIL' = 'PASS';

    // Date format validation
    if (!ISO_DATE_RE.test(asOfDate)) {
        messages.push(`FAIL: asOfDate "${asOfDate}" is not YYYY-MM-DD`);
        status = 'FAIL';
    }
    if (!ISO_DATE_RE.test(reviewDate)) {
        messages.push(`FAIL: reviewDate "${reviewDate}" is not YYYY-MM-DD`);
        status = 'FAIL';
    }

    // TWSE trading day check
    let isKnownTradingDay = false;
    let tradingDayNote = '';
    if (ISO_DATE_RE.test(asOfDate)) {
        try {
            isKnownTradingDay = isTwseTradingDay(asOfDate);
            if (!isKnownTradingDay) {
                messages.push(`FAIL: asOfDate "${asOfDate}" is not a TWSE trading day`);
                status = 'FAIL';
                tradingDayNote = `${asOfDate} is a weekend or known TWSE holiday`;
            } else {
                tradingDayNote = `${asOfDate} is a known TWSE trading day`;
            }
        } catch (e) {
            messages.push(`FAIL: TWSE calendar error for "${asOfDate}": ${String(e)}`);
            status = 'FAIL';
            tradingDayNote = 'calendar check failed';
        }
    }

    // Symbols check
    if (symbols.length < 1) {
        messages.push('FAIL: symbols must have at least 1 entry');
        status = 'FAIL';
    }

    // Horizons check
    for (const h of horizons) {
        if (!VALID_HORIZONS.includes(h as ValidHorizon)) {
            messages.push(`FAIL: invalid horizon "${h}" — must be one of ${VALID_HORIZONS.join(', ')}`);
            status = 'FAIL';
        }
    }
    if (horizons.length < 1) {
        messages.push('FAIL: horizons must have at least 1 entry');
        status = 'FAIL';
    }

    // SourceMode check
    if (!VALID_SOURCE_MODES.includes(sourceMode)) {
        messages.push(`FAIL: invalid sourceMode "${sourceMode}"`);
        status = 'FAIL';
    }

    // Forbidden claims check
    const allText = JSON.stringify({ simulationRunId, symbols, horizons, sourceMode });
    if (hasForbiddenClaim(allText)) {
        messages.push('FAIL: forbidden claim detected in seed fields');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: daily real-market snapshot seed validated');
    }

    return {
        seedVersion: SEED_VERSION,
        asOfDate,
        reviewDate,
        simulationRunId,
        symbols,
        horizons,
        sourceMode,
        tradingDayStatus: {
            isKnownTradingDay,
            calendarVersion: CALENDAR_VERSION,
            note: tradingDayNote,
        },
        guardrails: {
            noProductionWrite: true,
            noExternalApi: true,
            noOptimizerWrite: true,
            noTradingSignal: true,
            observabilityOnly: true,
        },
        validationStatus: status,
        validationMessages: messages,
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface SeedValidationResult {
    validationStatus: 'PASS' | 'WARN' | 'FAIL';
    validationMessages: string[];
}

export function validateDailyRealMarketSnapshotSeed(
    seed: DailyRealMarketSnapshotSeed,
): SeedValidationResult {
    const messages: string[] = [];
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    // Date format
    if (!ISO_DATE_RE.test(seed.asOfDate)) {
        messages.push('FAIL: asOfDate is not YYYY-MM-DD');
        status = 'FAIL';
    }
    if (!ISO_DATE_RE.test(seed.reviewDate)) {
        messages.push('FAIL: reviewDate is not YYYY-MM-DD');
        status = 'FAIL';
    }

    // TWSE trading day
    if (ISO_DATE_RE.test(seed.asOfDate) && !seed.tradingDayStatus.isKnownTradingDay) {
        messages.push(`FAIL: asOfDate "${seed.asOfDate}" is not a TWSE trading day`);
        status = 'FAIL';
    }

    // SourceMode
    if (!VALID_SOURCE_MODES.includes(seed.sourceMode)) {
        messages.push(`FAIL: invalid sourceMode "${seed.sourceMode}"`);
        status = 'FAIL';
    }

    // Guardrails
    const g = seed.guardrails;
    if (!g.noProductionWrite || !g.noExternalApi || !g.noOptimizerWrite ||
        !g.noTradingSignal || !g.observabilityOnly) {
        messages.push('FAIL: one or more guardrails are not active');
        status = 'FAIL';
    }

    // Forbidden claims
    if (hasForbiddenClaim(JSON.stringify(seed))) {
        messages.push('FAIL: forbidden claim detected in seed');
        status = 'FAIL';
    }

    if (status === 'PASS') {
        messages.push('PASS: seed validation passed');
    }

    return { validationStatus: status, validationMessages: messages };
}
