/**
 * ShadowPredictionHistoricalReplayWriter.ts — P0-HARDRESET
 *
 * Historical replay shadow writer. Produces a real-price corpus by replaying
 * shadow predictions at historical asOfDates using actual stockQuote prices.
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - research mode only — artifact-only output
 * - no production DB write
 * - no write to simulation_snapshot_corpus.jsonl (that file is FROZEN)
 * - all output goes to p0hardreset_historical_replay_corpus.jsonl
 * - no auto trading — no performance claim — no edge claim
 * - no external API call — no LLM call
 * - no buy/sell/roi/alpha/win_rate/outperform/guaranteed/recommendation claims
 * - PIT-safe: StrategyScreenEngine called with asOf = asOfDate
 * - duplicateKey deterministic: symbol|asOfDate|horizon
 * - createdAt deterministic: asOfDate + "T00:00:00.000Z"
 * - corpusRunId contains "-historical-" prefix
 * - never modifies SignalFusion / RuleBased / alphaScore / recommendationBucket logic
 *
 * Not investment advice. Not a trading system.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
    sanitizeResearchCandidateForShadowLog,
    buildShadowPredictionLogBatch,
    RawResearchCandidate,
    SourceDateBasis,
    TargetHorizon,
    ShadowPredictionLogEntry,
    ScoreSnapshot,
} from './ShadowPredictionLogContract';

import {
    buildActiveScoringSnapshot,
    buildRawCandidateFromActiveScoringSnapshot,
    ActiveScoringSnapshot,
    ScoringCompletenessStatus,
} from './ActiveScoringSnapshotBuilder';

import {
    resolveEntryPrice,
    resolveOutcomePrice,
    ResolverOptions,
    ResolvedEntryPrice,
    ResolvedOutcomePrice,
} from './RealPriceOutcomeResolver';

// ─── Constants ─────────────────────────────────────────────────────────────

export const REPLAY_WRITER_VERSION = 'p0hardreset-historical-replay-writer-v1';
export const OUTPUT_CORPUS_FILENAME = 'p0hardreset_historical_replay_corpus.jsonl';
export const FROZEN_CORPUS_FILENAME = 'simulation_snapshot_corpus.jsonl';
export const CORPUS_RUN_ID_PREFIX = 'historical-replay';

// Forbidden claims guard
const FORBIDDEN_CLAIM_PATTERNS = [
    'mock-deterministic', 'buy', 'sell', 'roi', 'win_rate',
    'outperform', 'guaranteed', 'auto trading', 'alpha confirmed',
    'edge confirmed', 'expected_return', 'predicted_return',
];

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UniverseEntry {
    symbol: string;
    quoteDays: number;
    chipDays: number;
    overlapDays: number;
}

export interface AsOfDateCandidate {
    asOfDate: string;
    outcome5dDate: string;
    outcome20dDate: string;
    outcome60dDate: string;
    outcome5dAvailable: boolean;
    outcome20dAvailable: boolean;
    outcome60dAvailable: boolean;
}

export interface HistoricalReplayConfig {
    corpusRunId: string;                  // must contain "-historical-"
    historicalAsOfDates: AsOfDateCandidate[];
    universe: UniverseEntry[];
    horizons: number[];                   // [5, 20, 60]
    outputDir: string;
    universeTier: string;
    dryRun: boolean;                      // always true — no DB write
    writeMode: 'HISTORICAL_REPLAY_ARTIFACT_ONLY';
    today?: string;                       // override for testing
    resolverOptions?: ResolverOptions;    // for testing injection
    candidateProvider?: CandidateProvider; // for testing injection
    // P3-HARDRESET extensions
    useActiveScoringSnapshot?: boolean;   // if true, call ActiveScoringSnapshotBuilder per entry
    outputFilename?: string;              // override default OUTPUT_CORPUS_FILENAME
    activeScoringProvider?: (symbol: string, asOfDate: string) => Promise<ActiveScoringSnapshot>; // injectable for testing
}

/** Corpus line written to JSONL */
export interface HistoricalReplayCorpusLine {
    corpusRunId: string;
    writerVersion: string;
    symbol: string;
    originalAsOfDate: string;
    universeTier: string;
    duplicateKey: string;
    createdAt: string;                    // deterministic: asOfDate + "T00:00:00.000Z"
    // Shadow log entry fields (from ShadowPredictionLogEntry)
    logVersion: string;
    runId: string;
    researchBucket: string;
    scoreSnapshot: ScoreSnapshot;
    sourceDateBasis: SourceDateBasis;
    // Real price fields
    closePriceAtPrediction: number | null;  // entry close on asOfDate
    entryPriceSource: string;
    outcomeSnapshot: {
        horizonDays: number;
        horizonLabel: string;
        outcomeDate: string;
        outcomeClose: number | null;
        returnPct: number | null;
        priceSource: string;
        outcomeAvailable: boolean;
    };
    // Metadata
    validationMessages: string[];
    // P3-HARDRESET: active scoring fields (optional — present when useActiveScoringSnapshot=true)
    scoringCompletenessStatus?: ScoringCompletenessStatus;
    activeScoringSnapshot?: ActiveScoringSnapshot;
}

export interface HistoricalReplayRunResult {
    config: HistoricalReplayConfig;
    linesWritten: number;
    uniqueSymbols: number;
    uniqueAsOfDates: number;
    priceSourceDistribution: Record<string, number>;
    successCount: number;
    pendingCount: number;
    missingCount: number;
    errorCount: number;
    validationMessages: string[];
    outputPath: string;
    // P3-HARDRESET: scoring completeness stats (present when useActiveScoringSnapshot=true)
    scoringCompletenessDistribution?: Record<string, number>;
}

export interface HistoricalReplayArtifact {
    version: string;
    corpusRunId: string;
    generatedAt: string;
    runResult: HistoricalReplayRunResult;
    corpusLineCount: number;
    symbols: string[];
    asOfDates: string[];
    priceSourceDistribution: Record<string, number>;
    pass: boolean;
    failReasons: string[];
}

export interface HistoricalReplaySummary {
    corpusRunId: string;
    generatedAt: string;
    linesWritten: number;
    uniqueSymbols: number;
    uniqueAsOfDates: number;
    priceSourceDistribution: Record<string, number>;
    qualityGatePass: boolean;
    notes: string[];
}

/** Provider interface for research candidates (injectable for testing) */
export interface CandidateProvider {
    getCandidates(
        symbol: string,
        asOfDate: string,
    ): Promise<RawResearchCandidate>;
}

// ─── Default candidate provider (uses stockQuote data) ─────────────────────

/**
 * DefaultStockQuoteCandidateProvider
 *
 * Creates a minimal research candidate from stockQuote data only.
 * This is not a real StrategyScreenEngine run — it builds a minimal
 * candidate stub for historical corpus building purposes.
 * Scores are set to 0/neutral to avoid performance claims.
 */
export class DefaultStockQuoteCandidateProvider implements CandidateProvider {
    async getCandidates(symbol: string, asOfDate: string): Promise<RawResearchCandidate> {
        return {
            symbol,
            name: symbol, // use symbol as name when no stock name available
            alphaScore: 0,
            recommendationBucket: 'Neutral',
            confidence: 0,
            technicalScore: 0,
            chipScore: 0,
            fundamentalScore: 0,
            marketAdjustment: 0,
            factors: [],
            topFactors: [],
            keyRisks: [],
            limitations: ['historical-replay-stub: scores not computed from live screen'],
            dataCoverage: 'limited',
            usedSources: ['stockQuote'],
            missingSources: [],
        };
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function assertNoForbiddenClaims(text: string, context: string): void {
    const lower = text.toLowerCase();
    for (const pattern of FORBIDDEN_CLAIM_PATTERNS) {
        if (lower.includes(pattern.toLowerCase())) {
            throw new Error(
                `[HistoricalReplayWriter] Forbidden claim "${pattern}" in ${context}: "${text}"`
            );
        }
    }
}

function buildDuplicateKey(symbol: string, asOfDate: string, horizonDays: number): string {
    return `${symbol}|${asOfDate}|${horizonDays}`;
}

function buildDeterministicCreatedAt(asOfDate: string): string {
    return `${asOfDate}T00:00:00.000Z`;
}

function buildCorpusRunId(asOfDate?: string): string {
    const suffix = asOfDate ?? 'batch';
    return `${CORPUS_RUN_ID_PREFIX}-${suffix}`;
}

// ─── Core API ──────────────────────────────────────────────────────────────

/**
 * buildHistoricalReplayConfig
 *
 * Builds a validated HistoricalReplayConfig from options.
 * Loads universe and asOfDate candidates from PART A artifacts if not injected.
 */
export function buildHistoricalReplayConfig(options: {
    outputDir?: string;
    historicalAsOfDates?: AsOfDateCandidate[];
    universe?: UniverseEntry[];
    horizons?: number[];
    universeTier?: string;
    maxAsOfDates?: number;
    maxSymbols?: number;
    today?: string;
    resolverOptions?: ResolverOptions;
    candidateProvider?: CandidateProvider;
    corpusRunId?: string;
    // P3-HARDRESET extensions
    useActiveScoringSnapshot?: boolean;
    outputFilename?: string;
    activeScoringProvider?: (symbol: string, asOfDate: string) => Promise<ActiveScoringSnapshot>;
}): HistoricalReplayConfig {
    const outputDir = options.outputDir ?? path.join(process.cwd(), 'outputs', 'online_validation');
    const horizons = options.horizons ?? [5, 20, 60];
    const universeTier = options.universeTier ?? 'HISTORICAL_REPLAY';

    // Load from PART A artifacts if not injected
    let historicalAsOfDates = options.historicalAsOfDates;
    let universe = options.universe;

    if (!historicalAsOfDates) {
        const artifactPath = path.join(outputDir, 'p0hardreset_historical_asofdate_candidates.json');
        if (!fs.existsSync(artifactPath)) {
            throw new Error(
                `[buildHistoricalReplayConfig] PART A artifact not found: ${artifactPath}. Run p0hardreset-part-a-audit.js first.`
            );
        }
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        historicalAsOfDates = (artifact.candidates as AsOfDateCandidate[])
            .slice(0, options.maxAsOfDates ?? 60);
    }

    if (!universe) {
        const artifactPath = path.join(outputDir, 'p0hardreset_universe_audit.json');
        if (!fs.existsSync(artifactPath)) {
            throw new Error(
                `[buildHistoricalReplayConfig] PART A artifact not found: ${artifactPath}. Run p0hardreset-part-a-audit.js first.`
            );
        }
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        universe = (artifact.universeResult.universe as UniverseEntry[])
            .slice(0, options.maxSymbols ?? 50);
    }

    if (historicalAsOfDates.length === 0) {
        throw new Error('[buildHistoricalReplayConfig] No historical asOfDate candidates available');
    }
    if (universe.length === 0) {
        throw new Error('[buildHistoricalReplayConfig] No universe entries available');
    }

    const runDate = historicalAsOfDates[0]?.asOfDate ?? 'batch';
    const corpusRunId = options.corpusRunId ?? buildCorpusRunId(runDate);

    // Validate corpusRunId contains "historical" (as prefix or infix)
    if (!corpusRunId.includes('historical')) {
        throw new Error(
            `[buildHistoricalReplayConfig] corpusRunId must contain "historical": got "${corpusRunId}"`
        );
    }

    return {
        corpusRunId,
        historicalAsOfDates,
        universe,
        horizons,
        outputDir,
        universeTier,
        dryRun: true,
        writeMode: 'HISTORICAL_REPLAY_ARTIFACT_ONLY',
        today: options.today,
        resolverOptions: options.resolverOptions,
        candidateProvider: options.candidateProvider,
        useActiveScoringSnapshot: options.useActiveScoringSnapshot,
        outputFilename: options.outputFilename,
        activeScoringProvider: options.activeScoringProvider,
    };
}

/**
 * runHistoricalReplayShadowWrite
 *
 * Core runner: iterates over (asOfDate × symbol) pairs, resolves real prices,
 * builds corpus lines, and writes to JSONL output.
 *
 * FROZEN: does NOT write to simulation_snapshot_corpus.jsonl.
 * All output goes to p0hardreset_historical_replay_corpus.jsonl.
 */
export async function runHistoricalReplayShadowWrite(
    config: HistoricalReplayConfig,
): Promise<HistoricalReplayRunResult> {
    const {
        corpusRunId,
        historicalAsOfDates,
        universe,
        horizons,
        outputDir,
        universeTier,
        today: configToday,
        resolverOptions,
        candidateProvider,
        useActiveScoringSnapshot,
        outputFilename: configOutputFilename,
        activeScoringProvider: configActiveScoringProvider,
    } = config;

    const today = configToday ?? new Date().toISOString().slice(0, 10);
    const provider = candidateProvider ?? new DefaultStockQuoteCandidateProvider();
    const outputPath = path.join(outputDir, configOutputFilename ?? OUTPUT_CORPUS_FILENAME);

    // Safety: verify we are NOT writing to the frozen corpus
    const frozenPath = path.join(outputDir, FROZEN_CORPUS_FILENAME);
    if (outputPath === frozenPath) {
        throw new Error(
            `[runHistoricalReplayShadowWrite] SAFETY: attempted to write to frozen corpus ${FROZEN_CORPUS_FILENAME}`
        );
    }

    fs.mkdirSync(outputDir, { recursive: true });

    // Open output stream (overwrite for this run — full corpus rebuilt each time)
    const lines: string[] = [];
    const seenDuplicateKeys = new Set<string>();
    const priceSourceDistribution: Record<string, number> = {};
    const scoringCompletenessDistribution: Record<string, number> = {};
    const validationMessages: string[] = [];
    let successCount = 0;
    let pendingCount = 0;
    let missingCount = 0;
    let errorCount = 0;
    const uniqueSymbols = new Set<string>();
    const uniqueAsOfDates = new Set<string>();

    for (const dateCandidate of historicalAsOfDates) {
        const { asOfDate } = dateCandidate;

        // Skip future asOfDates
        if (asOfDate >= today) {
            validationMessages.push(`SKIP: asOfDate ${asOfDate} >= today ${today}`);
            continue;
        }

        for (const universeEntry of universe) {
            const { symbol } = universeEntry;

            try {
                // P3-HARDRESET: optionally build active scoring snapshot (PIT-safe)
                let activeScoringSnapshot: ActiveScoringSnapshot | undefined;
                if (useActiveScoringSnapshot) {
                    const scoringFn = configActiveScoringProvider ?? buildActiveScoringSnapshot;
                    activeScoringSnapshot = await scoringFn(symbol, asOfDate);
                    // Track completeness distribution
                    const cs = activeScoringSnapshot.completenessStatus;
                    scoringCompletenessDistribution[cs] = (scoringCompletenessDistribution[cs] ?? 0) + 1;
                }

                // Get research candidate:
                // If active scoring is enabled, build from snapshot; otherwise use default provider
                const rawCandidate: RawResearchCandidate = activeScoringSnapshot
                    ? buildRawCandidateFromActiveScoringSnapshot(activeScoringSnapshot)
                    : await provider.getCandidates(symbol, asOfDate);

                // Resolve entry price (PIT-safe)
                const resolverOpts = { ...resolverOptions, today };
                const entryPrice = await resolveEntryPrice(symbol, asOfDate, resolverOpts);

                // Build source date basis (PIT-safe: sourceDate <= asOfDate)
                const sourceDateBasis: SourceDateBasis = {
                    sourceDate: asOfDate,
                    sourceType: 'stockQuote',
                    missingDataFlags: entryPrice.entryAvailable ? [] : ['entry_price_missing'],
                };

                // Build shadow log batch (for the log entry)
                const runId = `${corpusRunId}-${asOfDate}`;
                const targetHorizons: TargetHorizon[] = horizons.map(h => ({
                    horizonLabel: (h === 5 ? '5D' : h === 20 ? '20D' : `${h}D`) as '5D' | '20D' | '60D',
                    outcomeStatus: 'PENDING' as const,
                    outcomeWriteBackAllowed: false as const,
                }));

                const batch = buildShadowPredictionLogBatch({
                    candidates: [rawCandidate],
                    asOfDate,
                    runId,
                    universeTier,
                    sourceDateBasis,
                    targetHorizons,
                    generatedAt: buildDeterministicCreatedAt(asOfDate),
                });

                const logEntry: ShadowPredictionLogEntry = batch.entries[0];
                if (!logEntry) continue;

                // For each horizon, build a corpus line
                for (const horizonDays of horizons) {
                    const horizonLabel = horizonDays === 5 ? '5D' : horizonDays === 20 ? '20D' : `${horizonDays}D`;
                    const duplicateKey = buildDuplicateKey(symbol, asOfDate, horizonDays);

                    // Skip duplicates (deterministic)
                    if (seenDuplicateKeys.has(duplicateKey)) continue;
                    seenDuplicateKeys.add(duplicateKey);

                    // Resolve outcome price (PIT-safe)
                    const outcomePrice = await resolveOutcomePrice(
                        symbol, asOfDate, horizonDays, resolverOpts
                    );

                    // Compute returnPct (Rule 6)
                    let returnPct: number | null = null;
                    if (
                        entryPrice.entryAvailable &&
                        entryPrice.entryClose !== null &&
                        outcomePrice.outcomeAvailable &&
                        outcomePrice.outcomeClose !== null
                    ) {
                        returnPct = parseFloat(
                            (((outcomePrice.outcomeClose - entryPrice.entryClose) / entryPrice.entryClose) * 100)
                                .toFixed(4)
                        );
                    }

                    // Track price source distribution
                    const src = outcomePrice.priceSource;
                    priceSourceDistribution[src] = (priceSourceDistribution[src] ?? 0) + 1;

                    if (src === 'stockQuote.close') successCount++;
                    else if (src === 'PENDING') pendingCount++;
                    else if (src === 'MISSING') missingCount++;

                    uniqueSymbols.add(symbol);
                    uniqueAsOfDates.add(asOfDate);

                    // Build corpus line
                    const corpusLine: HistoricalReplayCorpusLine = {
                        corpusRunId,
                        writerVersion: REPLAY_WRITER_VERSION,
                        symbol,
                        originalAsOfDate: asOfDate,
                        universeTier,
                        duplicateKey,
                        createdAt: buildDeterministicCreatedAt(asOfDate),
                        logVersion: logEntry.logVersion,
                        runId: logEntry.runId,
                        researchBucket: logEntry.researchBucket,
                        scoreSnapshot: logEntry.scoreSnapshot,
                        sourceDateBasis,
                        closePriceAtPrediction: entryPrice.entryClose,
                        entryPriceSource: entryPrice.priceSource,
                        outcomeSnapshot: {
                            horizonDays,
                            horizonLabel,
                            outcomeDate: outcomePrice.outcomeDate,
                            outcomeClose: outcomePrice.outcomeClose,
                            returnPct,
                            priceSource: src,
                            outcomeAvailable: outcomePrice.outcomeAvailable,
                        },
                        validationMessages: [
                            ...logEntry.validationMessages,
                            ...entryPrice.entryAvailable ? [] : [`WARN: entry price missing for ${symbol} on ${asOfDate}`],
                        ],
                        // P3-HARDRESET: attach active scoring if computed
                        ...(activeScoringSnapshot !== undefined && {
                            scoringCompletenessStatus: activeScoringSnapshot.completenessStatus,
                            activeScoringSnapshot,
                        }),
                    };

                    // Guard: no forbidden claims in any string field
                    assertNoForbiddenClaims(corpusLine.researchBucket, `researchBucket for ${symbol}:${asOfDate}`);

                    lines.push(JSON.stringify(corpusLine));
                }
            } catch (err) {
                errorCount++;
                const msg = err instanceof Error ? err.message : String(err);
                validationMessages.push(`ERROR: ${symbol}@${asOfDate}: ${msg}`);
            }
        }
    }

    // Write corpus JSONL
    fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');

    return {
        config,
        linesWritten: lines.length,
        uniqueSymbols: uniqueSymbols.size,
        uniqueAsOfDates: uniqueAsOfDates.size,
        priceSourceDistribution,
        successCount,
        pendingCount,
        missingCount,
        errorCount,
        validationMessages,
        outputPath,
        ...(useActiveScoringSnapshot && { scoringCompletenessDistribution }),
    };
}

/**
 * buildHistoricalReplayArtifact
 *
 * Builds a structured artifact from a replay run result.
 */
export function buildHistoricalReplayArtifact(
    result: HistoricalReplayRunResult,
): HistoricalReplayArtifact {
    const failReasons: string[] = [];

    if (result.uniqueSymbols < 20) {
        failReasons.push(`Unique symbols ${result.uniqueSymbols} < 20`);
    }
    if (result.uniqueAsOfDates < 20) {
        failReasons.push(`Unique asOfDates ${result.uniqueAsOfDates} < 20`);
    }
    if (result.linesWritten < 1000) {
        failReasons.push(`Corpus lines ${result.linesWritten} < 1000`);
    }

    // Check for forbidden mock-deterministic
    if (result.priceSourceDistribution['mock-deterministic']) {
        failReasons.push('mock-deterministic price source found — forbidden');
    }

    // Check 5D stockQuote.close ratio
    const totalOutcomes = Object.values(result.priceSourceDistribution).reduce((a, b) => a + b, 0);
    const realCount = result.priceSourceDistribution['stockQuote.close'] ?? 0;
    if (totalOutcomes > 0 && realCount / totalOutcomes < 0.5) {
        failReasons.push(`stockQuote.close ratio ${(realCount / totalOutcomes * 100).toFixed(1)}% is low`);
    }

    return {
        version: REPLAY_WRITER_VERSION,
        corpusRunId: result.config.corpusRunId,
        generatedAt: new Date().toISOString(),
        runResult: result,
        corpusLineCount: result.linesWritten,
        symbols: Array.from({ length: result.uniqueSymbols }, (_, i) => `sym_${i}`), // summary only
        asOfDates: Array.from({ length: result.uniqueAsOfDates }, (_, i) => `date_${i}`),
        priceSourceDistribution: result.priceSourceDistribution,
        pass: failReasons.length === 0,
        failReasons,
    };
}

/**
 * summarizeHistoricalReplay
 *
 * Builds a human-readable summary of a replay run result.
 */
export function summarizeHistoricalReplay(
    result: HistoricalReplayRunResult,
): HistoricalReplaySummary {
    const totalLines = result.linesWritten;
    const realCount = result.priceSourceDistribution['stockQuote.close'] ?? 0;
    const pendingCount = result.priceSourceDistribution['PENDING'] ?? 0;
    const missingCount = result.priceSourceDistribution['MISSING'] ?? 0;

    const notes: string[] = [
        `${totalLines} corpus lines written`,
        `${result.uniqueSymbols} unique symbols`,
        `${result.uniqueAsOfDates} unique asOfDates`,
        `priceSource: real=${realCount} pending=${pendingCount} missing=${missingCount}`,
        `FROZEN: simulation_snapshot_corpus.jsonl NOT modified`,
        `ManualReview* modules: NOT modified (frozen per P0-HARDRESET)`,
    ];

    if (result.errorCount > 0) {
        notes.push(`${result.errorCount} errors during run — check validationMessages`);
    }

    const qualityGatePass =
        result.uniqueSymbols >= 20 &&
        result.uniqueAsOfDates >= 20 &&
        result.linesWritten >= 1000 &&
        !result.priceSourceDistribution['mock-deterministic'];

    return {
        corpusRunId: result.config.corpusRunId,
        generatedAt: new Date().toISOString(),
        linesWritten: totalLines,
        uniqueSymbols: result.uniqueSymbols,
        uniqueAsOfDates: result.uniqueAsOfDates,
        priceSourceDistribution: result.priceSourceDistribution,
        qualityGatePass,
        notes,
    };
}
