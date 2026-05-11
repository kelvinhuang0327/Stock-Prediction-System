/**
 * ActiveScoringSnapshotBuilder.ts — P3-HARDRESET PART B
 *
 * Builds an active scoring snapshot by calling RuleBasedStockAnalyzer.analyzeStock()
 * with a PIT-safe asOfDate parameter. This replaces the DefaultStockQuoteCandidateProvider
 * stub that returned all-zero scores in P0.
 *
 * SAFETY CONTRACT (strict — do not weaken):
 * - research mode only — no production DB write
 * - PIT-safe: analyzeStock is called with asOf = asOfDate (stockQuote data capped at asOfDate)
 * - no fabricated scores — all scores come from actual DB analysis
 * - no random score generation
 * - no returnPct back-fill into scoring
 * - no external API call — no LLM call
 * - no buy/sell/roi/alpha/win_rate/outperform/guaranteed/recommendation claims
 * - completenessStatus reflects actual data availability (COMPLETE/PARTIAL/EMPTY)
 * - EMPTY snapshots are still written to corpus (no silent skipping)
 * - never modifies SignalFusion / RuleBased scoring weights
 *
 * Not investment advice. Not a trading system.
 */

import { analyzeStock, StockAnalysisResult } from '@/lib/analysis/RuleBasedStockAnalyzer';

// ─── Constants ─────────────────────────────────────────────────────────────

export const ACTIVE_SCORING_BUILDER_VERSION = 'p3hardreset-active-scoring-builder-v1';
export const ACTIVE_SCORING_ENGINE_SOURCE = 'RuleBasedStockAnalyzer';
export const ACTIVE_SCORING_MODE = 'RULE_BASED_ANALYZER' as const;

// ─── Types ─────────────────────────────────────────────────────────────────

export type ScoringCompletenessStatus = 'COMPLETE' | 'PARTIAL' | 'EMPTY';

export interface ActiveScoreSnapshot {
    researchScore: number;     // mapped from overallScore (research ranking only, not performance claim)
    confidenceScore: number;   // 0 — RuleBasedStockAnalyzer does not compute confidence
    technicalScore: number;    // mapped from technicalScore
    chipScore: number;         // mapped from chipStrength
    fundamentalScore: number;  // 0 — not computed separately in RuleBasedStockAnalyzer
    marketAdjustment: number;  // 0 — not computed in RuleBasedStockAnalyzer
}

export interface ActiveScoringSnapshot {
    builderVersion: string;
    symbol: string;
    asOfDate: string;
    scoringMode: typeof ACTIVE_SCORING_MODE;
    scoringEngineSource: typeof ACTIVE_SCORING_ENGINE_SOURCE;
    // Research bucket (sanitized — English label only, no performance claims)
    researchBucket: string;
    alphaScore: number;    // mapped from overallScore — research ranking only
    // Sub-scores
    scoreSnapshot: ActiveScoreSnapshot;
    // Signals and explainability
    signalSnapshot: string[];   // factor names only
    factorSnapshot: string[];   // full factor descriptions (name: value (note))
    reasonSnapshot: string;     // reason/summary from analyzer
    limitations: string[];
    // Coverage metadata
    dataCoverage: 'full' | 'limited' | 'insufficient';
    dataPoints: number;
    usedSources: string[];
    missingSources: string[];
    // PIT gate
    pitGateDate: string;        // asOfDate used for DB query (must equal asOfDate)
    scoringAvailable: boolean;  // true if dataCoverage != 'insufficient'
    // Completeness classification
    completenessStatus: ScoringCompletenessStatus;
    scoringNote: string;
}

/** Injectable analyzer function type (for testing) */
export type AnalyzerFn = (symbol: string, asOf?: string) => Promise<StockAnalysisResult>;

export interface ActiveScoringOptions {
    analyzer?: AnalyzerFn;  // injectable for testing (default: analyzeStock)
}

// ─── Recommendation mapping ────────────────────────────────────────────────

/**
 * Map Chinese recommendation labels to English bucket values.
 * These English buckets are sanitized further by ShadowPredictionLogContract.sanitizeBucket().
 */
export function mapRecommendationToEnglishBucket(rec: string): string {
    const map: Record<string, string> = {
        '偏多': 'Strong Candidate',
        '觀察': 'Watch',
        '中性': 'Neutral',
        '偏空': 'Avoid',
        '資料不足': 'Insufficient Data',
    };
    return map[rec] ?? 'Neutral';
}

// ─── Completeness classification ───────────────────────────────────────────

/**
 * classifyScoringSnapshotCompleteness
 *
 * Classify the snapshot based on how much real scoring data was captured.
 *
 * COMPLETE: researchBucket is non-Neutral AND alphaScore > 0 AND at least one factor
 * PARTIAL: (researchBucket != Neutral OR alphaScore > 0) AND at least one factor
 * EMPTY: researchBucket = Neutral AND alphaScore = 0 AND no factors (same as P0 stub)
 */
export function classifyScoringSnapshotCompleteness(snapshot: ActiveScoringSnapshot): ScoringCompletenessStatus {
    const hasBucket = snapshot.researchBucket !== 'Neutral'
        && snapshot.researchBucket !== 'InsufficientData'
        && snapshot.researchBucket !== 'Insufficient Data';
    const hasScore = snapshot.alphaScore > 0;
    const hasFactors = snapshot.factorSnapshot.length > 0;

    if (hasBucket && hasScore && hasFactors) return 'COMPLETE';
    if ((hasBucket || hasScore) && hasFactors) return 'PARTIAL';
    // Also PARTIAL if bucket is non-Neutral even without factors (limited data)
    if (hasBucket && !hasFactors) return 'PARTIAL';
    return 'EMPTY';
}

// ─── Snapshot validation ───────────────────────────────────────────────────

export interface SnapshotValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const FORBIDDEN_CLAIM_PATTERNS = [
    'buy', 'sell', 'roi', 'win_rate', 'outperform', 'guaranteed',
    'auto trading', 'alpha confirmed', 'edge confirmed',
    'expected_return', 'predicted_return', 'expected_profit',
];

function hasForbiddenClaim(text: string): string | null {
    const lower = text.toLowerCase();
    for (const pat of FORBIDDEN_CLAIM_PATTERNS) {
        if (lower.includes(pat)) return pat;
    }
    return null;
}

/**
 * validateActiveScoringSnapshot
 *
 * Checks that the snapshot is well-formed and contains no forbidden claims.
 */
export function validateActiveScoringSnapshot(snapshot: ActiveScoringSnapshot): SnapshotValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!snapshot.symbol) errors.push('symbol is required');
    if (!snapshot.asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOfDate)) {
        errors.push(`asOfDate must be YYYY-MM-DD, got: ${snapshot.asOfDate}`);
    }
    if (!snapshot.builderVersion) errors.push('builderVersion is required');
    if (!snapshot.scoringMode) errors.push('scoringMode is required');
    if (!snapshot.scoringEngineSource) errors.push('scoringEngineSource is required');
    if (!snapshot.researchBucket) errors.push('researchBucket is required');

    // Numeric fields must be finite numbers
    if (typeof snapshot.alphaScore !== 'number' || !isFinite(snapshot.alphaScore)) {
        errors.push(`alphaScore must be finite number, got: ${snapshot.alphaScore}`);
    }
    if (snapshot.alphaScore < 0 || snapshot.alphaScore > 100) {
        errors.push(`alphaScore must be 0-100, got: ${snapshot.alphaScore}`);
    }
    const scoreFields = ['researchScore', 'confidenceScore', 'technicalScore', 'chipScore', 'fundamentalScore', 'marketAdjustment'] as const;
    for (const f of scoreFields) {
        const v = snapshot.scoreSnapshot[f];
        if (typeof v !== 'number' || !isFinite(v)) {
            errors.push(`scoreSnapshot.${f} must be finite number`);
        }
    }

    // PIT gate
    if (snapshot.pitGateDate !== snapshot.asOfDate) {
        errors.push(`pitGateDate ${snapshot.pitGateDate} must equal asOfDate ${snapshot.asOfDate}`);
    }

    // Forbidden claims check
    const textFields = [
        snapshot.researchBucket,
        snapshot.reasonSnapshot,
        ...snapshot.factorSnapshot,
        ...snapshot.limitations,
        snapshot.scoringNote,
    ];
    for (const text of textFields) {
        const claim = hasForbiddenClaim(text ?? '');
        if (claim) {
            errors.push(`Forbidden claim "${claim}" found in snapshot text: "${text?.slice(0, 50)}"`);
        }
    }

    // Completeness
    const validStatuses: ScoringCompletenessStatus[] = ['COMPLETE', 'PARTIAL', 'EMPTY'];
    if (!validStatuses.includes(snapshot.completenessStatus)) {
        errors.push(`completenessStatus must be COMPLETE|PARTIAL|EMPTY, got: ${snapshot.completenessStatus}`);
    }

    // Warnings (not errors)
    if (snapshot.completenessStatus === 'EMPTY') {
        warnings.push('Snapshot is EMPTY — no usable scoring data for this symbol/asOfDate');
    }
    if (snapshot.alphaScore === 0 && snapshot.researchBucket === 'Neutral') {
        warnings.push('alphaScore=0 and researchBucket=Neutral — same as P0 stub (EMPTY expected)');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ─── Build empty snapshot (fallback) ──────────────────────────────────────

function buildEmptySnapshot(
    symbol: string,
    asOfDate: string,
    errorNote: string,
): ActiveScoringSnapshot {
    return {
        builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
        symbol,
        asOfDate,
        scoringMode: ACTIVE_SCORING_MODE,
        scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
        researchBucket: 'Insufficient Data',
        alphaScore: 0,
        scoreSnapshot: {
            researchScore: 0,
            confidenceScore: 0,
            technicalScore: 0,
            chipScore: 0,
            fundamentalScore: 0,
            marketAdjustment: 0,
        },
        signalSnapshot: [],
        factorSnapshot: [],
        reasonSnapshot: '',
        limitations: [`active-scoring-error: ${errorNote.slice(0, 200)}`],
        dataCoverage: 'insufficient',
        dataPoints: 0,
        usedSources: [],
        missingSources: [],
        pitGateDate: asOfDate,
        scoringAvailable: false,
        completenessStatus: 'EMPTY',
        scoringNote: `error=${errorNote.slice(0, 100)}`,
    };
}

// ─── Build active scoring snapshot from RuleBasedStockAnalyzer ────────────

/**
 * buildActiveScoringSnapshot
 *
 * Calls RuleBasedStockAnalyzer.analyzeStock(symbol, asOfDate) with PIT-safe
 * asOfDate parameter, and converts the result into an ActiveScoringSnapshot.
 *
 * The analyzer caps all DB queries to date <= asOfDate (PIT-safe).
 * Scores reflect actual historical data available up to asOfDate.
 *
 * On error, returns an EMPTY snapshot (no silent failure — completenessStatus = 'EMPTY').
 */
export async function buildActiveScoringSnapshot(
    symbol: string,
    asOfDate: string,
    options?: ActiveScoringOptions,
): Promise<ActiveScoringSnapshot> {
    const analyzerFn = options?.analyzer ?? analyzeStock;

    let result: StockAnalysisResult;
    try {
        result = await analyzerFn(symbol, asOfDate);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return buildEmptySnapshot(symbol, asOfDate, `analyzeStock threw: ${errMsg}`);
    }

    // Map Chinese recommendation to English bucket
    const researchBucket = mapRecommendationToEnglishBucket(result.recommendation);

    // Build factor descriptions (name: value (note))
    const factorSnapshot = result.factors.map(f =>
        `${f.name}: ${String(f.value)} (${f.note})`
    );

    const snapshot: ActiveScoringSnapshot = {
        builderVersion: ACTIVE_SCORING_BUILDER_VERSION,
        symbol,
        asOfDate,
        scoringMode: ACTIVE_SCORING_MODE,
        scoringEngineSource: ACTIVE_SCORING_ENGINE_SOURCE,
        researchBucket,
        alphaScore: result.overallScore,
        scoreSnapshot: {
            researchScore: result.overallScore,
            confidenceScore: 0,           // RuleBasedStockAnalyzer does not output confidence
            technicalScore: result.technicalScore,
            chipScore: result.chipStrength,
            fundamentalScore: 0,          // not separately computed in RuleBasedStockAnalyzer
            marketAdjustment: 0,          // not computed in RuleBasedStockAnalyzer
        },
        signalSnapshot: result.factors.map(f => f.name),
        factorSnapshot,
        reasonSnapshot: result.reason ?? '',
        limitations: result.limitations,
        dataCoverage: result.dataCoverage,
        dataPoints: result.dataPoints,
        usedSources: result.usedSources,
        missingSources: result.missingSources,
        pitGateDate: asOfDate,
        scoringAvailable: result.dataCoverage !== 'insufficient',
        completenessStatus: 'EMPTY', // placeholder — computed below
        scoringNote: `dataCoverage=${result.dataCoverage} dataPoints=${result.dataPoints} recommendation=${result.recommendation}`,
    };

    snapshot.completenessStatus = classifyScoringSnapshotCompleteness(snapshot);

    return snapshot;
}

// ─── Build RawResearchCandidate from snapshot ─────────────────────────────

/**
 * buildRawCandidateFromActiveScoringSnapshot
 *
 * Converts an ActiveScoringSnapshot into a RawResearchCandidate
 * for use with ShadowPredictionLogContract.sanitizeResearchCandidateForShadowLog().
 *
 * This maps the active scoring result into the existing corpus line structure,
 * enabling real scores to flow through the historical replay pipeline.
 */
export function buildRawCandidateFromActiveScoringSnapshot(
    snapshot: ActiveScoringSnapshot,
): {
    symbol: string;
    name: string;
    alphaScore: number;
    recommendationBucket: string;
    confidence: number;
    technicalScore: number;
    chipScore: number;
    fundamentalScore: number;
    marketAdjustment: number;
    factors: string[];
    topFactors: string[];
    keyRisks: string[];
    limitations: string[];
    dataCoverage: string;
    usedSources: string[];
    missingSources: string[];
} {
    return {
        symbol: snapshot.symbol,
        name: snapshot.symbol,  // name not available from analyzeStock for raw candidate
        alphaScore: snapshot.alphaScore,
        recommendationBucket: snapshot.researchBucket,  // English bucket
        confidence: 0,
        technicalScore: snapshot.scoreSnapshot.technicalScore,
        chipScore: snapshot.scoreSnapshot.chipScore,
        fundamentalScore: snapshot.scoreSnapshot.fundamentalScore,
        marketAdjustment: snapshot.scoreSnapshot.marketAdjustment,
        factors: snapshot.factorSnapshot,
        topFactors: snapshot.signalSnapshot.slice(0, 3),
        keyRisks: [],
        limitations: snapshot.limitations,
        dataCoverage: snapshot.dataCoverage,
        usedSources: snapshot.usedSources,
        missingSources: snapshot.missingSources,
    };
}

// ─── Corpus-level stats helper ─────────────────────────────────────────────

/**
 * computeScoringCompletenessDistribution
 *
 * Aggregates completeness status distribution from a batch of snapshots.
 */
export function computeScoringCompletenessDistribution(
    snapshots: ActiveScoringSnapshot[],
): Record<ScoringCompletenessStatus, number> {
    const dist: Record<ScoringCompletenessStatus, number> = {
        COMPLETE: 0,
        PARTIAL: 0,
        EMPTY: 0,
    };
    for (const s of snapshots) {
        dist[s.completenessStatus] = (dist[s.completenessStatus] ?? 0) + 1;
    }
    return dist;
}
