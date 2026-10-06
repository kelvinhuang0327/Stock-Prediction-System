/**
 * P4CalibrationAuditUtils.ts — P4-HARDRESET PART B
 *
 * Pure-function utilities for calibration observability.
 * - No model changes, no scoring changes, descriptive statistics only.
 * - No DB writes, no external API calls.
 * - No output of buy/sell/ROI/win-rate/alpha-edge/profit/outperform/guaranteed.
 *
 * Not investment advice. Not a trading system.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RealizedReturnClass = 'NEGATIVE' | 'FLAT' | 'POSITIVE' | 'MISSING';

export interface DescriptiveStats {
    count: number;
    nonMissingCount: number;
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    standardDeviation: number | null;
    positiveReturnRatio: number;
    negativeReturnRatio: number;
    flatReturnRatio: number;
    missingRatio: number;
}

export interface P3CorpusRow {
    symbol: string;
    originalAsOfDate: string;
    researchBucket: string;
    scoreSnapshot: {
        researchScore: number;
        confidenceScore?: number;
        technicalScore?: number;
        chipScore?: number;
        fundamentalScore?: number;
        marketAdjustment?: number;
    };
    outcomeSnapshot: {
        horizonDays: number;
        returnPct: number | null;
        priceSource: string;
        outcomeAvailable: boolean;
        outcomeClose?: number;
    };
    scoringCompletenessStatus: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
    activeScoringSnapshot?: {
        alphaScore: number;
        researchBucket?: string;
        signalSnapshot?: string[];
        factorSnapshot?: string[];
        reasonSnapshot?: string;
        pitGateDate?: string;
        completenessStatus?: string;
        limitations?: string[];
        dataCoverage?: string;
        dataPoints?: number;
        scoringNote?: string;
    };
    closePriceAtPrediction?: number;
    entryPriceSource?: string;
    duplicateKey?: string;
}

export interface P1BaselineRow {
    baselineRunId?: string;
    baselineType: string;
    symbol: string;
    originalAsOfDate: string;
    horizonDays: number;
    returnPct: number | null;
    priceSource?: string;
    entryPrice?: number;
    outcomePrice?: number;
}

export interface BucketReturnStat extends DescriptiveStats {
    researchBucket: string;
    horizonDays: number;
    scoringCompletenessDistribution: { COMPLETE: number; PARTIAL: number; EMPTY: number };
}

export interface ScoreDecileStats extends DescriptiveStats {
    decile: number;
    horizonDays: number;
    scoreMin: number | null;
    scoreMax: number | null;
    bucketDistribution: Record<string, number>;
    tieCount: number;
    uniqueScoreCount: number;
}

export interface ScoreDecileMetadata {
    horizonDays: number;
    tieCount: number;
    uniqueScoreCount: number;
    totalRows: number;
    decileBoundaries: Array<{ decile: number; scoreMin: number; scoreMax: number; count: number }>;
}

export interface CompletenessReturnStat extends DescriptiveStats {
    scoringCompletenessStatus: string;
    horizonDays: number;
}

export interface ConfusionMatrixEntry {
    dimension: string;
    key: string;
    horizonDays: number;
    NEGATIVE: number;
    FLAT: number;
    POSITIVE: number;
    MISSING: number;
    total: number;
}

export interface BaselineDescriptiveStats {
    baselineType: string;
    horizonDays: number;
    count: number;
    mean: number | null;
    median: number | null;
    standardDeviation: number | null;
    positiveRatio: number;
    negativeRatio: number;
    flatRatio: number;
    missingRatio: number;
}

export interface HorizonComparisonEntry {
    horizonDays: number;
    prediction: DescriptiveStats;
    baselines: BaselineDescriptiveStats[];
    note: string;
}

export interface ComparisonResult {
    disclaimer: string;
    horizons: HorizonComparisonEntry[];
    coverageNote: string;
    predictionCoverageRatio: number;
    baselineCoverageRatios: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute descriptive statistics for a list of possibly-null return values.
 * The FLAT window is (-1, 1] — values whose absolute value ≤ 1.0.
 */
export function computeDescriptiveStats(values: (number | null | undefined)[]): DescriptiveStats {
    const count = values.length;
    if (count === 0) {
        return {
            count: 0,
            nonMissingCount: 0,
            mean: null,
            median: null,
            min: null,
            max: null,
            standardDeviation: null,
            positiveReturnRatio: 0,
            negativeReturnRatio: 0,
            flatReturnRatio: 0,
            missingRatio: 1,
        };
    }

    const present: number[] = values.filter((v): v is number => v !== null && v !== undefined);
    const nonMissingCount = present.length;
    const missingRatio = (count - nonMissingCount) / count;

    if (nonMissingCount === 0) {
        return {
            count,
            nonMissingCount: 0,
            mean: null,
            median: null,
            min: null,
            max: null,
            standardDeviation: null,
            positiveReturnRatio: 0,
            negativeReturnRatio: 0,
            flatReturnRatio: 0,
            missingRatio: 1,
        };
    }

    const sorted = [...present].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / nonMissingCount;

    const mid = Math.floor(nonMissingCount / 2);
    const median =
        nonMissingCount % 2 === 1
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;

    const min = sorted[0];
    const max = sorted[nonMissingCount - 1];

    const variance =
        nonMissingCount > 1
            ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (nonMissingCount - 1)
            : 0;
    const standardDeviation = Math.sqrt(variance);

    const positive = present.filter(v => v > 1.0).length;
    const negative = present.filter(v => v < 0).length;
    const flat = present.filter(v => v >= 0 && v <= 1.0).length;

    return {
        count,
        nonMissingCount,
        mean: round4(mean),
        median: round4(median),
        min: round4(min),
        max: round4(max),
        standardDeviation: round4(standardDeviation),
        positiveReturnRatio: round4(positive / count),
        negativeReturnRatio: round4(negative / count),
        flatReturnRatio: round4(flat / count),
        missingRatio: round4(missingRatio),
    };
}

/** Classify realized return into NEGATIVE | FLAT | POSITIVE | MISSING. */
export function classifyRealizedReturn(returnPct: number | null | undefined): RealizedReturnClass {
    if (returnPct === null || returnPct === undefined) return 'MISSING';
    if (returnPct < 0) return 'NEGATIVE';
    if (returnPct <= 1.0) return 'FLAT';
    return 'POSITIVE';
}

/**
 * Extract the primary score for a P3 row.
 * Priority: activeScoringSnapshot.alphaScore → scoreSnapshot.researchScore → 0
 */
export function extractPrimaryScore(row: P3CorpusRow): number {
    if (row.activeScoringSnapshot?.alphaScore !== undefined) {
        return row.activeScoringSnapshot.alphaScore;
    }
    if (row.scoreSnapshot?.researchScore !== undefined) {
        return row.scoreSnapshot.researchScore;
    }
    return 0;
}

/**
 * Compute a deterministic score-to-decile mapping for a list of scores.
 * Scores with the same value always receive the same decile.
 * Returns the map and tie metadata.
 */
export function computeScoreDecileMap(
    scores: number[],
): { decileMap: Map<number, number>; tieCount: number; uniqueScoreCount: number } {
    const uniqueScores = [...new Set(scores)].sort((a, b) => a - b);
    const uniqueScoreCount = uniqueScores.length;

    // Count ties across ALL scores (not just unique)
    const freq = new Map<number, number>();
    for (const s of scores) freq.set(s, (freq.get(s) ?? 0) + 1);
    const tieCount = [...freq.values()].filter(v => v > 1).reduce((acc, v) => acc + v, 0);

    const decileMap = new Map<number, number>();
    uniqueScores.forEach((score, i) => {
        // Evenly distribute unique score values across 10 deciles (1-indexed)
        const decile = uniqueScoreCount <= 1
            ? 5
            : Math.min(10, Math.floor((i / (uniqueScoreCount - 1)) * 9) + 1);
        decileMap.set(score, decile);
    });

    return { decileMap, tieCount, uniqueScoreCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public analytics functions
// ─────────────────────────────────────────────────────────────────────────────

/** Bucket × horizon descriptive return stats. */
export function buildBucketReturnStats(rows: P3CorpusRow[]): BucketReturnStat[] {
    const groups = new Map<string, P3CorpusRow[]>();
    for (const row of rows) {
        const k = `${row.researchBucket}|${row.outcomeSnapshot.horizonDays}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(row);
    }

    const result: BucketReturnStat[] = [];
    for (const [k, g] of groups) {
        const [bucket, hStr] = k.split('|');
        const stats = computeDescriptiveStats(g.map(r => r.outcomeSnapshot.returnPct));
        const dist = { COMPLETE: 0, PARTIAL: 0, EMPTY: 0 };
        for (const r of g) dist[r.scoringCompletenessStatus]++;
        result.push({
            researchBucket: bucket,
            horizonDays: parseInt(hStr, 10),
            ...stats,
            scoringCompletenessDistribution: dist,
        });
    }
    return result.sort((a, b) =>
        a.researchBucket.localeCompare(b.researchBucket) || a.horizonDays - b.horizonDays,
    );
}

/** Score decile × horizon descriptive return stats. Decile assignment is deterministic. */
export function buildScoreDecileStats(
    rows: P3CorpusRow[],
): { stats: ScoreDecileStats[]; metadata: ScoreDecileMetadata[] } {
    const horizons = [...new Set(rows.map(r => r.outcomeSnapshot.horizonDays))].sort((a, b) => a - b);
    const allStats: ScoreDecileStats[] = [];
    const allMeta: ScoreDecileMetadata[] = [];

    for (const hz of horizons) {
        const hzRows = rows.filter(r => r.outcomeSnapshot.horizonDays === hz);
        const scores = hzRows.map(r => extractPrimaryScore(r));
        const { decileMap, tieCount, uniqueScoreCount } = computeScoreDecileMap(scores);

        // Group by decile
        const decileGroups = new Map<number, P3CorpusRow[]>();
        for (const row of hzRows) {
            const d = decileMap.get(extractPrimaryScore(row)) ?? 5;
            if (!decileGroups.has(d)) decileGroups.set(d, []);
            decileGroups.get(d)!.push(row);
        }

        // Build metadata boundaries
        const boundaries: ScoreDecileMetadata['decileBoundaries'] = [];
        for (const [decile, dRows] of [...decileGroups].sort(([a], [b]) => a - b)) {
            const dScores = dRows.map(r => extractPrimaryScore(r));
            boundaries.push({
                decile,
                scoreMin: Math.min(...dScores),
                scoreMax: Math.max(...dScores),
                count: dRows.length,
            });
        }
        allMeta.push({ horizonDays: hz, tieCount, uniqueScoreCount, totalRows: hzRows.length, decileBoundaries: boundaries });

        // Build stats per decile
        for (const [decile, dRows] of decileGroups) {
            const dScores = dRows.map(r => extractPrimaryScore(r));
            const dStats = computeDescriptiveStats(dRows.map(r => r.outcomeSnapshot.returnPct));
            const bucketDist: Record<string, number> = {};
            for (const r of dRows) {
                bucketDist[r.researchBucket] = (bucketDist[r.researchBucket] ?? 0) + 1;
            }
            allStats.push({
                decile,
                horizonDays: hz,
                ...dStats,
                scoreMin: dScores.length ? round4(Math.min(...dScores)) : null,
                scoreMax: dScores.length ? round4(Math.max(...dScores)) : null,
                bucketDistribution: bucketDist,
                tieCount,
                uniqueScoreCount,
            });
        }
    }

    return {
        stats: allStats.sort((a, b) => a.horizonDays - b.horizonDays || a.decile - b.decile),
        metadata: allMeta,
    };
}

/** Completeness status × horizon descriptive return stats. */
export function buildCompletenessReturnStats(rows: P3CorpusRow[]): CompletenessReturnStat[] {
    const groups = new Map<string, P3CorpusRow[]>();
    for (const row of rows) {
        const k = `${row.scoringCompletenessStatus}|${row.outcomeSnapshot.horizonDays}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(row);
    }
    const result: CompletenessReturnStat[] = [];
    for (const [k, g] of groups) {
        const [status, hStr] = k.split('|');
        result.push({
            scoringCompletenessStatus: status,
            horizonDays: parseInt(hStr, 10),
            ...computeDescriptiveStats(g.map(r => r.outcomeSnapshot.returnPct)),
        });
    }
    return result.sort((a, b) =>
        a.scoringCompletenessStatus.localeCompare(b.scoringCompletenessStatus) || a.horizonDays - b.horizonDays,
    );
}

/** Bucket × return-class × horizon confusion matrix. */
export function buildBucketConfusionMatrix(rows: P3CorpusRow[]): ConfusionMatrixEntry[] {
    return buildConfusionMatrix(rows, 'bucket', r => r.researchBucket);
}

/** Score decile × return-class × horizon confusion matrix. */
export function buildScoreDecileConfusionMatrix(
    rows: P3CorpusRow[],
): ConfusionMatrixEntry[] {
    const horizons = [...new Set(rows.map(r => r.outcomeSnapshot.horizonDays))];
    const result: ConfusionMatrixEntry[] = [];

    for (const hz of horizons) {
        const hzRows = rows.filter(r => r.outcomeSnapshot.horizonDays === hz);
        const scores = hzRows.map(r => extractPrimaryScore(r));
        const { decileMap } = computeScoreDecileMap(scores);

        const matrix = new Map<number, ConfusionMatrixEntry>();
        for (const row of hzRows) {
            const decile = decileMap.get(extractPrimaryScore(row)) ?? 5;
            if (!matrix.has(decile)) {
                matrix.set(decile, { dimension: 'scoreDecile', key: String(decile), horizonDays: hz, NEGATIVE: 0, FLAT: 0, POSITIVE: 0, MISSING: 0, total: 0 });
            }
            const entry = matrix.get(decile)!;
            const cls = classifyRealizedReturn(row.outcomeSnapshot.returnPct);
            entry[cls]++;
            entry.total++;
        }
        result.push(...matrix.values());
    }

    return result.sort((a, b) => a.horizonDays - b.horizonDays || parseInt(a.key) - parseInt(b.key));
}

/**
 * Descriptive comparison of P3 prediction rows vs P1 baseline rows.
 * Produces distribution comparisons only — no performance claims.
 */
export function comparePredictionToBaseline(
    predictionRows: P3CorpusRow[],
    baselineRows: P1BaselineRow[],
): ComparisonResult {
    const DISCLAIMER = 'Descriptive distribution comparison only. No performance claims implied. Not investment advice.';

    const predHorizons = [...new Set(predictionRows.map(r => r.outcomeSnapshot.horizonDays))].sort((a, b) => a - b);
    const baseHorizons = [...new Set(baselineRows.map(r => r.horizonDays))].sort((a, b) => a - b);
    const allHorizons = [...new Set([...predHorizons, ...baseHorizons])].sort((a, b) => a - b);

    const baselineTypes = [...new Set(baselineRows.map(r => r.baselineType))];

    // Coverage ratios (fraction of rows with non-null returnPct)
    const predCovRatio = predictionRows.length > 0
        ? round4(predictionRows.filter(r => r.outcomeSnapshot.returnPct !== null).length / predictionRows.length)
        : 0;

    const baseCovRatios: Record<string, number> = {};
    for (const bt of baselineTypes) {
        const btRows = baselineRows.filter(r => r.baselineType === bt);
        baseCovRatios[bt] = btRows.length > 0
            ? round4(btRows.filter(r => r.returnPct !== null).length / btRows.length)
            : 0;
    }

    const horizons: HorizonComparisonEntry[] = allHorizons.map(hz => {
        const predHzRows = predictionRows.filter(r => r.outcomeSnapshot.horizonDays === hz);
        const predStats = computeDescriptiveStats(predHzRows.map(r => r.outcomeSnapshot.returnPct));

        const baselines: BaselineDescriptiveStats[] = baselineTypes.map(bt => {
            const btRows = baselineRows.filter(r => r.horizonDays === hz && r.baselineType === bt);
            const btStats = computeDescriptiveStats(btRows.map(r => r.returnPct));
            return {
                baselineType: bt,
                horizonDays: hz,
                count: btStats.count,
                mean: btStats.mean,
                median: btStats.median,
                standardDeviation: btStats.standardDeviation,
                positiveRatio: btStats.positiveReturnRatio,
                negativeRatio: btStats.negativeReturnRatio,
                flatRatio: btStats.flatReturnRatio,
                missingRatio: btStats.missingRatio,
            };
        });

        return {
            horizonDays: hz,
            prediction: predStats,
            baselines,
            note: `Descriptive distribution for horizon ${hz}d. ${DISCLAIMER}`,
        };
    });

    return {
        disclaimer: DISCLAIMER,
        horizons,
        coverageNote: `predictionRows=${predictionRows.length} baselineRows=${baselineRows.length}`,
        predictionCoverageRatio: predCovRatio,
        baselineCoverageRatios: baseCovRatios,
    };
}

/** Scan text for forbidden investment-claim language. Returns array of detected patterns. */
export function scanForbiddenClaims(text: string): string[] {
    const patterns: Array<{ label: string; re: RegExp }> = [
        { label: 'roi',                    re: /\broi\b/i },
        { label: 'win-rate',               re: /win[-\s]rate/i },
        { label: 'outperform',             re: /\boutperform/i },
        { label: 'guaranteed',             re: /\bguaranteed\b/i },
        { label: 'profit',                 re: /\bprofit\b/i },
        { label: 'trading-edge',           re: /\btrading\s+edge\b/i },
        { label: 'alpha-edge',             re: /\balpha\s+edge\b/i },
        { label: 'beat-market',            re: /beat\s+(?:the\s+)?market/i },
        { label: 'buy-signal',             re: /buy\s+signal/i },
        { label: 'sell-signal',            re: /sell\s+signal/i },
        { label: 'investment-recommendation', re: /investment\s+recommendation/i },
        { label: 'expected-return-claim',  re: /expected\s+return(?!s?\s+(?:ratio|class|category|distribution|descriptive))/i },
        { label: 'predicted-return-claim', re: /predicted\s+return(?!s?\s+(?:ratio|class|category|distribution|descriptive))/i },
    ];

    const found: string[] = [];
    for (const { label, re } of patterns) {
        if (re.test(text)) found.push(label);
    }
    return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildConfusionMatrix(
    rows: P3CorpusRow[],
    dimension: string,
    keyFn: (row: P3CorpusRow) => string,
): ConfusionMatrixEntry[] {
    const groups = new Map<string, P3CorpusRow[]>();
    for (const row of rows) {
        const k = `${keyFn(row)}|${row.outcomeSnapshot.horizonDays}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(row);
    }

    const result: ConfusionMatrixEntry[] = [];
    for (const [k, g] of groups) {
        const lastSep = k.lastIndexOf('|');
        const key = k.slice(0, lastSep);
        const hz = parseInt(k.slice(lastSep + 1), 10);
        const entry: ConfusionMatrixEntry = { dimension, key, horizonDays: hz, NEGATIVE: 0, FLAT: 0, POSITIVE: 0, MISSING: 0, total: g.length };
        for (const r of g) {
            const cls = classifyRealizedReturn(r.outcomeSnapshot.returnPct);
            entry[cls]++;
        }
        result.push(entry);
    }
    return result.sort((a, b) => a.key.localeCompare(b.key) || a.horizonDays - b.horizonDays);
}

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}
