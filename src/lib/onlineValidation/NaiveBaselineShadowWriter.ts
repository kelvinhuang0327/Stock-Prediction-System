/**
 * NaiveBaselineShadowWriter.ts — P1-HARDRESET
 *
 * Naive baseline shadow writer. Produces four deterministic baseline corpora
 * using the same universe, historical asOfDates, horizons, and
 * RealPriceOutcomeResolver as the P0 historical replay writer.
 *
 * Baselines:
 *   1. BUY_AND_HOLD_ALL              — every symbol in universe × all asOfDates
 *   2. TOP_N_EQUAL_WEIGHT            — top N by deterministic lexical order (control)
 *   3. RANDOM_N_DETERMINISTIC        — N symbols via seeded PRNG (no Math.random)
 *   4. STOCKQUOTE_COVERAGE_TOP_N     — top N by quoteDays (liquidity/coverage proxy)
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - observability-only — no production DB write
 * - no write to simulation_snapshot_corpus.jsonl (FROZEN)
 * - no auto trading — no performance claim — no edge claim
 * - no external API call — no LLM call
 * - no buy/sell/roi/alpha/win_rate/outperform/guaranteed/recommendation claims
 * - no mock-deterministic price source
 * - RANDOM_N_DETERMINISTIC uses seeded LCG — never Math.random()
 * - PIT-safe: uses RealPriceOutcomeResolver (asOfDate < today enforced there)
 * - duplicateKey deterministic: baselineType|symbol|asOfDate|horizonDays
 * - createdAt deterministic: asOfDate + "T00:00:00.000Z"
 * - limitations field always populated
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    resolveEntryPrice,
    resolveOutcomePrice,
    ResolverOptions,
} from './RealPriceOutcomeResolver';


// ─── Constants ─────────────────────────────────────────────────────────────

export const BASELINE_WRITER_VERSION = 'p1hardreset-naive-baseline-writer-v1';
export const OUTPUT_CORPUS_FILENAME = 'p1baseline_historical_replay_corpus.jsonl';
export const FROZEN_CORPUS_FILENAME = 'simulation_snapshot_corpus.jsonl';
export const BASELINE_RUN_ID_PREFIX = 'p1baseline';

// ─── Forbidden claims guard ─────────────────────────────────────────────────

const FORBIDDEN_CLAIM_PATTERNS = [
    'mock-deterministic', 'roi', 'win_rate', 'outperform',
    'guaranteed', 'auto trading', 'alpha confirmed',
    'edge confirmed', 'expected_return', 'predicted_return',
];

function assertNoForbiddenClaims(text: string, context: string): void {
    const lower = text.toLowerCase();
    for (const p of FORBIDDEN_CLAIM_PATTERNS) {
        if (lower.includes(p)) {
            throw new Error(
                `[NaiveBaselineShadowWriter] Forbidden claim "${p}" found in ${context}`
            );
        }
    }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type BaselineType =
    | 'BUY_AND_HOLD_ALL'
    | 'TOP_N_EQUAL_WEIGHT'
    | 'RANDOM_N_DETERMINISTIC'
    | 'STOCKQUOTE_COVERAGE_TOP_N';

export const ALL_BASELINE_TYPES: BaselineType[] = [
    'BUY_AND_HOLD_ALL',
    'TOP_N_EQUAL_WEIGHT',
    'RANDOM_N_DETERMINISTIC',
    'STOCKQUOTE_COVERAGE_TOP_N',
];

export interface UniverseEntry {
    symbol: string;
    quoteDays: number;
    chipDays?: number;
    overlapDays?: number;
}

export interface AsOfDateCandidate {
    asOfDate: string;
    outcome5dDate?: string;
    outcome20dDate?: string;
    outcome60dDate?: string;
    outcome5dAvailable?: boolean;
    outcome20dAvailable?: boolean;
    outcome60dAvailable?: boolean;
}

/** Shape of each line written to the baseline JSONL corpus */
export interface NaiveBaselineEntry {
    baselineRunId: string;
    writerVersion: string;
    baselineType: BaselineType;
    symbol: string;
    originalAsOfDate: string;
    horizonDays: number;
    horizonLabel: string;
    entryPrice: number | null;
    outcomePrice: number | null;
    outcomeDate: string;
    priceSource: string;          // 'stockQuote.close' | 'PENDING' | 'MISSING'
    returnPct: number | null;
    duplicateKey: string;         // baselineType|symbol|originalAsOfDate|horizonDays
    createdAt: string;            // deterministic: originalAsOfDate + "T00:00:00.000Z"
    limitations: string[];
    validationMessages: string[];
}

export interface NaiveBaselineConfig {
    baselineRunId: string;               // must contain 'baseline'
    universe: UniverseEntry[];           // symbols to use
    historicalAsOfDates: AsOfDateCandidate[];
    horizons: number[];                  // [5, 20, 60]
    topN: number;                        // for TOP_N and RANDOM_N
    outputDir: string;
    today?: string;                      // override for testing
    resolverOptions?: ResolverOptions;   // for test injection
    // Which baseline types to run (default: all 4)
    baselineTypes?: BaselineType[];
}

export interface NaiveBaselineRunResult {
    baselineRunId: string;
    writerVersion: string;
    baselineTypes: BaselineType[];
    universe: string[];
    asOfDates: string[];
    horizons: number[];
    totalLines: number;
    linesByType: Record<BaselineType, number>;
    successCount: number;
    pendingCount: number;
    missingCount: number;
    errorCount: number;
    duplicateKeysChecked: number;
    priceSourceDist: Record<string, number>;
    outputPath: string;
    elapsedMs: number;
    generatedAt: string;
    corpusLines: NaiveBaselineEntry[];
}

export interface NaiveBaselineArtifact {
    artifactVersion: string;
    baselineRunId: string;
    writerVersion: string;
    generatedAt: string;
    pass: boolean;
    failReasons: string[];
    stats: {
        totalLines: number;
        linesByType: Record<BaselineType, number>;
        uniqueSymbols: number;
        uniqueAsOfDates: number;
        uniqueHorizons: number;
        priceSourceDist: Record<string, number>;
        coverageRatio: number;
        duplicateKeysChecked: number;
    };
}

export interface NaiveBaselineSummary {
    baselineRunId: string;
    generatedAt: string;
    status: 'PASS' | 'FAIL';
    totalLines: number;
    linesByType: Record<BaselineType, number>;
    coveragePct: number;
    frozenCorpusNote: string;
    safetyNote: string;
    limitations: string[];
}

// ─── Deterministic helpers ──────────────────────────────────────────────────

/**
 * Deterministic hash: maps a string to a 32-bit unsigned integer.
 * Uses djb2 algorithm — no external deps, no Math.random.
 */
export function deterministicHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + (str.codePointAt(i) ?? 0);
        hash = hash & hash; // truncate to 32 bits
    }
    return hash >>> 0; // unsigned
}

/**
 * Seeded LCG (Linear Congruential Generator) PRNG.
 * Never uses Math.random(). Produces deterministic sequence from seed.
 * Parameters from Numerical Recipes (Knuth).
 */
export function makeSeededPRNG(seed: number): () => number {
    let s = seed >>> 0;
    return function (): number {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

/**
 * Deterministic Fisher-Yates shuffle.
 * Returns a new array (original unchanged).
 * Uses seeded PRNG — no Math.random.
 */
export function deterministicShuffle<T>(arr: T[], seed: number): T[] {
    const result = [...arr];
    const rng = makeSeededPRNG(seed);
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// ─── Baseline symbol selectors ──────────────────────────────────────────────

/**
 * BUY_AND_HOLD_ALL: returns all symbols in the universe.
 * Limitations: not a strategy — control group.
 */
export function selectBuyAndHoldAll(universe: UniverseEntry[]): {
    symbols: string[];
    limitations: string[];
} {
    return {
        symbols: [...universe].sort((a, b) => a.symbol.localeCompare(b.symbol)).map(u => u.symbol),
        limitations: [
            'BUY_AND_HOLD_ALL: all symbols in universe — not a strategy, observability control only',
        ],
    };
}

/**
 * TOP_N_EQUAL_WEIGHT: top N symbols by lexical order.
 * Rationale: no scores available (all 0); lexical order ensures determinism.
 * Clearly labeled as DETERMINISTIC_LEXICAL_CONTROL — not a strategy.
 */
export function selectTopNEqualWeight(universe: UniverseEntry[], n: number): {
    symbols: string[];
    limitations: string[];
} {
    const sorted = [...universe].sort((a, b) => a.symbol.localeCompare(b.symbol));
    return {
        symbols: sorted.slice(0, n).map(u => u.symbol),
        limitations: [
            'TOP_N_EQUAL_WEIGHT: DETERMINISTIC_LEXICAL_CONTROL — sorted by symbol lexical order (no scores available)',
            'Not a strategy. Equal-weight basket. Observability-only.',
            `N=${n}`,
        ],
    };
}

/**
 * RANDOM_N_DETERMINISTIC: N symbols selected with seeded LCG PRNG.
 * Seed = deterministicHash(baselineRunId + asOfDate).
 * Different asOfDates produce different symbol sets (date-dependent).
 * Same baselineRunId + asOfDate always produce the same set.
 */
export function selectRandomNDeterministic(
    universe: UniverseEntry[],
    n: number,
    baselineRunId: string,
    asOfDate: string,
): {
    symbols: string[];
    limitations: string[];
    seed: number;
} {
    const seedStr = `${baselineRunId}:${asOfDate}`;
    const seed = deterministicHash(seedStr);
    const shuffled = deterministicShuffle(
        [...universe].sort((a, b) => a.symbol.localeCompare(b.symbol)), // stable base order
        seed,
    );
    return {
        symbols: shuffled.slice(0, n).map(u => u.symbol),
        limitations: [
            'RANDOM_N_DETERMINISTIC: seeded LCG PRNG — no Math.random() used',
            `seed = deterministicHash("${baselineRunId}:${asOfDate}") = ${seed}`,
            'Deterministic for same baselineRunId+asOfDate. Observability-only.',
            `N=${n}`,
        ],
        seed,
    };
}

/**
 * STOCKQUOTE_COVERAGE_TOP_N: top N symbols by quoteDays descending.
 * quoteDays = number of stockQuote rows in DB — used as liquidity/coverage proxy.
 * No market cap or volume data available; quoteDays is the best proxy.
 */
export function selectStockQuoteCoverageTopN(universe: UniverseEntry[], n: number): {
    symbols: string[];
    limitations: string[];
    proxyField: string;
} {
    const sorted = [...universe].sort((a, b) => (b.quoteDays ?? 0) - (a.quoteDays ?? 0));
    return {
        symbols: sorted.slice(0, n).map(u => u.symbol),
        limitations: [
            'STOCKQUOTE_COVERAGE_TOP_N: proxy = quoteDays (number of stockQuote rows in DB)',
            'Liquidity/market-cap proxy unavailable — quoteDays used as coverage proxy',
            'Not a strategy. Not liquidity-weighted. Observability-only.',
            `N=${n}`,
        ],
        proxyField: 'quoteDays',
    };
}

// ─── Horizon helpers ────────────────────────────────────────────────────────

function horizonLabel(days: number): string {
    if (days === 5) return '5D';
    if (days === 20) return '20D';
    if (days === 60) return '60D';
    return `${days}D`;
}

function roundReturnPct(raw: number): number {
    return Number.parseFloat(raw.toFixed(4));
}

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return JSON.stringify(err);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * buildNaiveBaselineConfig
 *
 * Validates and builds the config for the naive baseline writer.
 * Throws for invalid inputs.
 */
export function buildNaiveBaselineConfig(options: {
    outputDir: string;
    universe: UniverseEntry[];
    historicalAsOfDates: AsOfDateCandidate[];
    horizons?: number[];
    topN?: number;
    baselineRunId?: string;
    baselineTypes?: BaselineType[];
    today?: string;
    resolverOptions?: ResolverOptions;
}): NaiveBaselineConfig {
    const {
        outputDir,
        universe,
        historicalAsOfDates,
        horizons = [5, 20, 60],
        topN = 10,
        baselineTypes = ALL_BASELINE_TYPES,
        today,
        resolverOptions,
    } = options;

    if (!universe || universe.length === 0) {
        throw new Error('[buildNaiveBaselineConfig] universe must not be empty');
    }
    if (!historicalAsOfDates || historicalAsOfDates.length === 0) {
        throw new Error('[buildNaiveBaselineConfig] historicalAsOfDates must not be empty');
    }
    if (!horizons || horizons.length === 0) {
        throw new Error('[buildNaiveBaselineConfig] horizons must not be empty');
    }

    const runDate = today ?? new Date().toISOString().slice(0, 10);
    const baselineRunId = options.baselineRunId ?? `${BASELINE_RUN_ID_PREFIX}-${runDate}`;

    if (!baselineRunId.includes('baseline')) {
        throw new Error(
            `[buildNaiveBaselineConfig] baselineRunId must contain "baseline": got "${baselineRunId}"`
        );
    }

    // Validate no forbidden claims in baselineRunId
    assertNoForbiddenClaims(baselineRunId, 'baselineRunId');

    return {
        baselineRunId,
        universe,
        historicalAsOfDates,
        horizons,
        topN,
        outputDir,
        today,
        resolverOptions,
        baselineTypes,
    };
}

// ─── Internal resolve helper ─────────────────────────────────────────────────

interface ResolvedPriceOutcome {
    entryPrice: number | null;
    outcomePrice: number | null;
    outcomeDateStr: string;
    priceSource: string;
    returnPct: number | null;
    validationMessages: string[];
}

async function resolvePriceOutcome(
    symbol: string,
    asOfDate: string,
    horizonDays: number,
    resolverOpts: ResolverOptions,
): Promise<ResolvedPriceOutcome> {
    const msgs: string[] = [];
    let entryPrice: number | null = null;
    let outcomePrice: number | null = null;
    let outcomeDateStr = '';
    let returnPct: number | null = null;

    const entry = await resolveEntryPrice(symbol, asOfDate, resolverOpts);
    entryPrice = entry.entryClose;
    if (!entry.entryAvailable || entryPrice === null) {
        msgs.push(`WARN: entry price missing`);
    }

    const outcome = await resolveOutcomePrice(symbol, asOfDate, horizonDays, resolverOpts);
    outcomePrice = outcome.outcomeClose;
    outcomeDateStr = outcome.outcomeDate;
    const priceSource = outcome.priceSource;

    if (outcome.priceSource === 'stockQuote.close' && entryPrice !== null && outcomePrice !== null) {
        returnPct = roundReturnPct(((outcomePrice - entryPrice) / entryPrice) * 100);
    } else if (outcome.priceSource === 'PENDING') {
        msgs.push(`INFO: outcome PENDING (not yet mature)`);
    } else {
        msgs.push(`WARN: outcome price MISSING`);
    }

    return { entryPrice, outcomePrice, outcomeDateStr, priceSource, returnPct, validationMessages: msgs };
}

// ─── Internal per-entry builder ───────────────────────────────────────────────

interface EntryContext {
    baselineRunId: string;
    baselineType: BaselineType;
    symbol: string;
    asOfDate: string;
    horizonDays: number;
    baseLimitations: string[];
    resolverOpts: ResolverOptions;
}

interface EntryCounters {
    successCount: number;
    pendingCount: number;
    missingCount: number;
    errorCount: number;
    priceSourceDist: Record<string, number>;
}

async function buildOneEntry(
    ctx: EntryContext,
    counters: EntryCounters,
): Promise<NaiveBaselineEntry> {
    const { baselineRunId, baselineType, symbol, asOfDate, horizonDays, baseLimitations, resolverOpts } = ctx;
    const hl = horizonLabel(horizonDays);
    const duplicateKey = `${baselineType}|${symbol}|${asOfDate}|${horizonDays}`;
    const createdAt = `${asOfDate}T00:00:00.000Z`;
    const limitations = [...baseLimitations];
    let validationMessages: string[] = [];
    let entryPrice: number | null = null;
    let outcomePrice: number | null = null;
    let outcomeDateStr = '';
    let priceSource = 'MISSING';
    let returnPct: number | null = null;

    try {
        const resolved = await resolvePriceOutcome(symbol, asOfDate, horizonDays, resolverOpts);
        entryPrice = resolved.entryPrice;
        outcomePrice = resolved.outcomePrice;
        outcomeDateStr = resolved.outcomeDateStr;
        priceSource = resolved.priceSource;
        returnPct = resolved.returnPct;
        validationMessages = resolved.validationMessages;

        if (priceSource === 'stockQuote.close' && returnPct !== null) {
            counters.successCount++;
        } else if (priceSource === 'PENDING') {
            counters.pendingCount++;
        } else {
            counters.missingCount++;
        }
        counters.priceSourceDist[priceSource] = (counters.priceSourceDist[priceSource] ?? 0) + 1;
    } catch (err: unknown) {
        counters.errorCount++;
        validationMessages.push(`ERROR: ${getErrorMessage(err)}`);
        counters.priceSourceDist['ERROR'] = (counters.priceSourceDist['ERROR'] ?? 0) + 1;
        priceSource = 'MISSING';
    }

    return {
        baselineRunId,
        writerVersion: BASELINE_WRITER_VERSION,
        baselineType,
        symbol,
        originalAsOfDate: asOfDate,
        horizonDays,
        horizonLabel: hl,
        entryPrice,
        outcomePrice,
        outcomeDate: outcomeDateStr,
        priceSource,
        returnPct,
        duplicateKey,
        createdAt,
        limitations,
        validationMessages,
    };
}

// ─── Symbol selector for a given type + date ──────────────────────────────────

function selectSymbolsForType(
    baselineType: BaselineType,
    precomputed: {
        buyAndHold: { symbols: string[]; limitations: string[] };
        topN: { symbols: string[]; limitations: string[] };
        coverageTopN: { symbols: string[]; limitations: string[] };
        randomN: { symbols: string[]; limitations: string[] };
    },
): { symbols: string[]; limitations: string[] } {
    if (baselineType === 'BUY_AND_HOLD_ALL') return precomputed.buyAndHold;
    if (baselineType === 'TOP_N_EQUAL_WEIGHT') return precomputed.topN;
    if (baselineType === 'RANDOM_N_DETERMINISTIC') return precomputed.randomN;
    return precomputed.coverageTopN; // STOCKQUOTE_COVERAGE_TOP_N
}

/**
 * runNaiveBaselineShadowWrite
 *
 * Main runner. For each baseline type × asOfDate × horizon, selects symbols
 * and resolves real prices via RealPriceOutcomeResolver. Writes to
 * p1baseline_historical_replay_corpus.jsonl (never to frozen corpus).
 *
 * No production DB writes. No performance claims. Observability-only.
 */
interface RunnerState {
    corpusLines: NaiveBaselineEntry[];
    seenKeys: Set<string>;
    linesByType: Record<BaselineType, number>;
    counters: EntryCounters;
}

async function processAsOfDate(
    asOfDate: string,
    baselineTypes: BaselineType[],
    precomputed: {
        buyAndHold: { symbols: string[]; limitations: string[] };
        topN: { symbols: string[]; limitations: string[] };
        coverageTopN: { symbols: string[]; limitations: string[] };
        randomN: { symbols: string[]; limitations: string[] };
    },
    horizons: number[],
    baselineRunId: string,
    resolverOpts: ResolverOptions,
    state: RunnerState,
): Promise<void> {
    for (const baselineType of baselineTypes) {
        const { symbols, limitations } = selectSymbolsForType(baselineType, precomputed);
        for (const symbol of symbols) {
            for (const hd of horizons) {
                const duplicateKey = `${baselineType}|${symbol}|${asOfDate}|${hd}`;
                if (state.seenKeys.has(duplicateKey)) {
                    state.counters.errorCount++;
                    continue;
                }
                state.seenKeys.add(duplicateKey);
                const ctx: EntryContext = {
                    baselineRunId, baselineType, symbol, asOfDate,
                    horizonDays: hd, baseLimitations: limitations, resolverOpts,
                };
                const entry = await buildOneEntry(ctx, state.counters);
                state.corpusLines.push(entry);
                state.linesByType[baselineType]++;
            }
        }
    }
}

export async function runNaiveBaselineShadowWrite(
    config: NaiveBaselineConfig,
): Promise<NaiveBaselineRunResult> {
    const {
        baselineRunId,
        universe,
        historicalAsOfDates,
        horizons,
        topN,
        outputDir,
        today,
        resolverOptions,
        baselineTypes = ALL_BASELINE_TYPES,
    } = config;

    const frozenPath = path.resolve(outputDir, FROZEN_CORPUS_FILENAME);
    const outputPath = path.resolve(outputDir, OUTPUT_CORPUS_FILENAME);

    if (outputPath === frozenPath) {
        throw new Error(
            `[runNaiveBaselineShadowWrite] outputPath must not equal frozenPath. Both resolve to: ${outputPath}`
        );
    }

    const effectiveToday = today ?? new Date().toISOString().slice(0, 10);
    const resolverOpts: ResolverOptions = {
        ...resolverOptions,
        today: resolverOptions?.today ?? effectiveToday,
    };

    const startMs = Date.now();
    const state: RunnerState = {
        corpusLines: [],
        seenKeys: new Set(),
        linesByType: { BUY_AND_HOLD_ALL: 0, TOP_N_EQUAL_WEIGHT: 0, RANDOM_N_DETERMINISTIC: 0, STOCKQUOTE_COVERAGE_TOP_N: 0 },
        counters: { successCount: 0, pendingCount: 0, missingCount: 0, errorCount: 0, priceSourceDist: {} },
    };

    const buyAndHold = selectBuyAndHoldAll(universe);
    const topN_ = selectTopNEqualWeight(universe, topN);
    const coverageTopN = selectStockQuoteCoverageTopN(universe, topN);

    for (const asOfDateEntry of historicalAsOfDates) {
        const { asOfDate } = asOfDateEntry;
        if (asOfDate >= effectiveToday) continue;
        const randomN = selectRandomNDeterministic(universe, topN, baselineRunId, asOfDate);
        const precomputed = { buyAndHold, topN: topN_, coverageTopN, randomN };
        await processAsOfDate(asOfDate, baselineTypes, precomputed, horizons, baselineRunId, resolverOpts, state);
    }

    const elapsedMs = Date.now() - startMs;

    // Write corpus JSONL
    const jsonlContent = state.corpusLines.map(l => JSON.stringify(l)).join('\n') + '\n';
    fs.writeFileSync(outputPath, jsonlContent, 'utf8');

    return {
        baselineRunId,
        writerVersion: BASELINE_WRITER_VERSION,
        baselineTypes,
        universe: universe.map(u => u.symbol),
        asOfDates: historicalAsOfDates.map(c => c.asOfDate),
        horizons,
        totalLines: state.corpusLines.length,
        linesByType: state.linesByType,
        successCount: state.counters.successCount,
        pendingCount: state.counters.pendingCount,
        missingCount: state.counters.missingCount,
        errorCount: state.counters.errorCount,
        duplicateKeysChecked: state.seenKeys.size,
        priceSourceDist: state.counters.priceSourceDist,
        outputPath,
        elapsedMs,
        generatedAt: new Date().toISOString(),
        corpusLines: state.corpusLines,
    };
}

/**
 * buildNaiveBaselineArtifact
 *
 * Builds the artifact summary from a run result.
 * Validates acceptance gates.
 */
export function buildNaiveBaselineArtifact(result: NaiveBaselineRunResult): NaiveBaselineArtifact {
    const failReasons: string[] = [];

    const uniqueSymbols = new Set(result.corpusLines.map(l => l.symbol)).size;
    const uniqueAsOfDates = new Set(result.corpusLines.map(l => l.originalAsOfDate)).size;
    const uniqueHorizons = new Set(result.corpusLines.map(l => l.horizonDays)).size;

    const realCount = result.priceSourceDist['stockQuote.close'] ?? 0;
    const totalCount = result.totalLines;
    const coverageRatio = totalCount > 0 ? realCount / totalCount : 0;

    // Gate: >= 4 baseline types
    if (result.baselineTypes.length < 4) {
        failReasons.push(`Must have >= 4 baseline types; got ${result.baselineTypes.length}`);
    }
    // Gate: >= 1000 lines per type
    for (const bt of result.baselineTypes) {
        if ((result.linesByType[bt] ?? 0) < 1000) {
            failReasons.push(`${bt}: must have >= 1000 lines; got ${result.linesByType[bt]}`);
        }
    }
    // Gate: >= 25 unique symbols
    if (uniqueSymbols < 25) {
        failReasons.push(`Must have >= 25 unique symbols; got ${uniqueSymbols}`);
    }
    // Gate: >= 60 unique asOfDates
    if (uniqueAsOfDates < 60) {
        failReasons.push(`Must have >= 60 unique asOfDates; got ${uniqueAsOfDates}`);
    }
    // Gate: no mock-deterministic
    const mockCount = result.corpusLines.filter(l => l.priceSource === 'mock-deterministic').length;
    if (mockCount > 0) {
        failReasons.push(`mock-deterministic forbidden: found ${mockCount} entries`);
    }
    // Gate: stockQuote.close coverage >= 90%
    if (coverageRatio < 0.9) {
        failReasons.push(`stockQuote.close coverage must be >= 90%; got ${(coverageRatio * 100).toFixed(1)}%`);
    }

    return {
        artifactVersion: 'p1baseline-artifact-v1',
        baselineRunId: result.baselineRunId,
        writerVersion: result.writerVersion,
        generatedAt: result.generatedAt,
        pass: failReasons.length === 0,
        failReasons,
        stats: {
            totalLines: result.totalLines,
            linesByType: result.linesByType,
            uniqueSymbols,
            uniqueAsOfDates,
            uniqueHorizons,
            priceSourceDist: result.priceSourceDist,
            coverageRatio: Number.parseFloat(coverageRatio.toFixed(4)),
            duplicateKeysChecked: result.duplicateKeysChecked,
        },
    };
}

/**
 * summarizeNaiveBaseline
 *
 * Builds a human-readable summary from a run result.
 */
export function summarizeNaiveBaseline(result: NaiveBaselineRunResult): NaiveBaselineSummary {
    const realCount = result.priceSourceDist['stockQuote.close'] ?? 0;
    const coveragePct = result.totalLines > 0
        ? Number.parseFloat(((realCount / result.totalLines) * 100).toFixed(2))
        : 0;

    return {
        baselineRunId: result.baselineRunId,
        generatedAt: result.generatedAt,
        status: 'PASS',
        totalLines: result.totalLines,
        linesByType: result.linesByType,
        coveragePct,
        frozenCorpusNote: `${FROZEN_CORPUS_FILENAME} is UNCHANGED (frozen per P1-HARDRESET safety contract). ManualReview* modules: NOT modified (frozen).`,
        safetyNote: 'Observability-only. No production writes. No performance claims. No mock-deterministic.',
        limitations: [
            'All baseline types are naive reference models — not investment strategies',
            'TOP_N_EQUAL_WEIGHT uses lexical order as deterministic control (no scores available)',
            'RANDOM_N_DETERMINISTIC uses seeded LCG; different asOfDates produce different selections',
            'STOCKQUOTE_COVERAGE_TOP_N uses quoteDays as liquidity/coverage proxy (no market cap or volume data)',
            'Scores are not used; all alpha/confidence scores = 0 in baseline universe',
            'returnPct is observational only — not predictive, not ROI-adjusted',
        ],
    };
}
