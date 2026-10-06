/**
 * P2SpotCheckUtils.ts — P2-HARDRESET Utility Functions
 *
 * Pure utility functions for P2 spot-check calibration audit.
 * All functions are deterministic and side-effect-free.
 * Observability-only — no investment recommendations.
 */

export const P2_UTILS_VERSION = 'p2hardreset-spotcheck-utils-v1';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ReturnClass = 'NEGATIVE' | 'FLAT' | 'POSITIVE' | 'MISSING';

export interface DescStats {
    count: number;
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    stddev: number | null;
}

export interface CorpusFieldReport {
    hasBucketField: boolean;
    hasScoreField: boolean;
    bucketDiscriminative: boolean;
    scoreDiscriminative: boolean;
    auditMode: 'FULL_BUCKET_SCORE_AUDIT' | 'LIMITED_NON_DISCRIMINATIVE_FIELDS' | 'RETURN_DISTRIBUTION_ONLY';
    classification: 'P2_SPOTCHECK_FULL_AUDIT' | 'P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS';
}

export interface BucketGroup {
    bucket: string;
    returns: number[];
    missing: number;
    total: number;
}

export interface ScoreDecileGroup {
    decile: number;   // 1–10
    scoreMin: number;
    scoreMax: number;
    returns: number[];
    total: number;
}

export interface ConfusionMatrixRow {
    label: string;
    NEGATIVE: number;
    FLAT: number;
    POSITIVE: number;
    MISSING: number;
    total: number;
    negativeRatio: number | null;
    flatRatio: number | null;
    positiveRatio: number | null;
    missingRatio: number | null;
}

// ─── Descriptive statistics ─────────────────────────────────────────────────────

export function computeMean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeMedian(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

export function computeStddev(values: number[]): number | null {
    if (values.length < 2) return null;
    const mVal = computeMean(values);
    if (mVal === null) return null;
    const variance = values.reduce((acc, v) => acc + (v - mVal) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

export function computeDescStats(values: number[]): DescStats {
    if (values.length === 0) {
        return { count: 0, mean: null, median: null, min: null, max: null, stddev: null };
    }
    return {
        count: values.length,
        mean: computeMean(values),
        median: computeMedian(values),
        min: Math.min(...values),
        max: Math.max(...values),
        stddev: computeStddev(values),
    };
}

export function round4(v: number | null): number | null {
    if (v === null || v === undefined) return null;
    return Math.round(v * 10000) / 10000;
}

// ─── Return class classification ────────────────────────────────────────────────

export function classifyReturn(returnPct: number | null | undefined): ReturnClass {
    if (returnPct === null || returnPct === undefined) return 'MISSING';
    if (returnPct < 0) return 'NEGATIVE';
    if (returnPct <= 1) return 'FLAT';
    return 'POSITIVE';
}

// ─── Field discriminability assessment ─────────────────────────────────────────

/**
 * Assess whether bucket / score fields are discriminative.
 * bucketValues: all values of the bucket field across rows
 * scoreValues: all values of the primary score field across rows
 */
export function assessFieldDiscriminability(
    bucketValues: (string | null | undefined)[],
    scoreValues: (number | null | undefined)[],
): CorpusFieldReport {
    const hasBucketField = bucketValues.length > 0;
    const hasScoreField = scoreValues.length > 0;

    const uniqueBuckets = new Set(bucketValues.filter(v => v != null));
    const uniqueScores = new Set(scoreValues.filter(v => v != null && v !== 0));

    const bucketDiscriminative = uniqueBuckets.size > 1;
    const scoreDiscriminative = uniqueScores.size > 0; // any non-zero value

    let auditMode: CorpusFieldReport['auditMode'];
    if (bucketDiscriminative || scoreDiscriminative) {
        auditMode = 'FULL_BUCKET_SCORE_AUDIT';
    } else if (hasBucketField || hasScoreField) {
        auditMode = 'LIMITED_NON_DISCRIMINATIVE_FIELDS';
    } else {
        auditMode = 'RETURN_DISTRIBUTION_ONLY';
    }

    const classification: CorpusFieldReport['classification'] =
        auditMode === 'FULL_BUCKET_SCORE_AUDIT'
            ? 'P2_SPOTCHECK_FULL_AUDIT'
            : 'P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS';

    return { hasBucketField, hasScoreField, bucketDiscriminative, scoreDiscriminative, auditMode, classification };
}

// ─── Bucket audit ───────────────────────────────────────────────────────────────

/**
 * Group returns by bucket label.
 * Deterministic: output order sorted by bucket name.
 */
export function groupReturnsByBucket(
    rows: Array<{ bucket: string | null; returnPct: number | null; priceSource?: string }>,
): BucketGroup[] {
    const groups = new Map<string, BucketGroup>();
    for (const row of rows) {
        const bucket = row.bucket ?? 'MISSING';
        let g = groups.get(bucket);
        if (!g) { g = { bucket, returns: [], missing: 0, total: 0 }; groups.set(bucket, g); }
        g.total += 1;
        const ps = row.priceSource ?? 'MISSING';
        if (ps === 'MISSING' || row.returnPct === null || row.returnPct === undefined) {
            g.missing += 1;
        } else if (ps !== 'PENDING') {
            g.returns.push(row.returnPct);
        }
    }
    return [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, g]) => g);
}

// ─── Score decile ────────────────────────────────────────────────────────────────

/**
 * Build 10 score deciles from rows with numeric scores.
 * Deterministic: rows are sorted by score ascending, then split evenly.
 */
export function buildScoreDeciles(
    rows: Array<{ score: number; returnPct: number | null; priceSource?: string }>,
): ScoreDecileGroup[] {
    if (rows.length === 0) return [];
    const sorted = [...rows].sort((a, b) => a.score - b.score);
    const n = sorted.length;
    const groups: ScoreDecileGroup[] = [];
    for (let d = 1; d <= 10; d++) {
        const startIdx = Math.floor((d - 1) * n / 10);
        const endIdx = Math.floor(d * n / 10);
        const slice = sorted.slice(startIdx, endIdx);
        const scores = slice.map(r => r.score);
        const returns: number[] = [];
        let total = 0;
        for (const r of slice) {
            total += 1;
            const ps = r.priceSource ?? 'UNKNOWN';
            if (ps !== 'MISSING' && ps !== 'PENDING' && r.returnPct !== null && r.returnPct !== undefined) {
                returns.push(r.returnPct);
            }
        }
        groups.push({
            decile: d,
            scoreMin: scores.length > 0 ? Math.min(...scores) : 0,
            scoreMax: scores.length > 0 ? Math.max(...scores) : 0,
            returns,
            total,
        });
    }
    return groups;
}

// ─── Confusion matrix ────────────────────────────────────────────────────────────

/**
 * Build confusion matrix rows by label (horizon, bucket, or any grouping key).
 * returnClasses: NEGATIVE, FLAT, POSITIVE, MISSING
 */
export function buildConfusionMatrix(
    rows: Array<{ label: string; returnPct: number | null }>,
): ConfusionMatrixRow[] {
    const groups = new Map<string, ConfusionMatrixRow>();
    for (const row of rows) {
        let g = groups.get(row.label);
        if (!g) { g = { label: row.label, NEGATIVE: 0, FLAT: 0, POSITIVE: 0, MISSING: 0, total: 0, negativeRatio: null, flatRatio: null, positiveRatio: null, missingRatio: null }; groups.set(row.label, g); }
        const cls = classifyReturn(row.returnPct);
        g[cls] += 1;
        g.total += 1;
    }
    for (const g of groups.values()) {
        if (g.total > 0) {
            g.negativeRatio = round4(g.NEGATIVE / g.total);
            g.flatRatio = round4(g.FLAT / g.total);
            g.positiveRatio = round4(g.POSITIVE / g.total);
            g.missingRatio = round4(g.MISSING / g.total);
        }
    }
    return [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, g]) => g);
}

// ─── Forbidden claims scan ───────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: RegExp[] = [
    /\bROI\b/i,
    /win[-\s]?rate/i,
    /\balpha\b/i,
    /\bedge\b/i,
    /\bprofit\b/i,
    /\boutperform/i,
    /\bbeat\b/i,
    /\bguaranteed\b/i,
    /\bexpected_return\b/i,
    /\bpredicted_return\b/i,
    /investment recommendation/i,
];

/** Check if a text string contains any forbidden investment claim words */
export function containsForbiddenClaims(text: string): string[] {
    const found: string[] = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
            found.push(pattern.source);
        }
    }
    return found;
}

// ─── Deterministic hash ──────────────────────────────────────────────────────────

/** djb2 hash — same algorithm as NaiveBaselineShadowWriter */
export function deterministicHash(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        const c = str.codePointAt(i) ?? 0;
        h = ((h << 5) + h + c) >>> 0;
    }
    return h;
}
