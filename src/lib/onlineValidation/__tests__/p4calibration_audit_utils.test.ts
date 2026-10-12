/**
 * p4calibration_audit_utils.test.ts — P4-HARDRESET PART F
 *
 * Tests for P4CalibrationAuditUtils.ts
 * Not investment advice. Not a trading system.
 */

import {
    computeDescriptiveStats,
    classifyRealizedReturn,
    extractPrimaryScore,
    computeScoreDecileMap,
    buildBucketReturnStats,
    buildScoreDecileStats,
    buildCompletenessReturnStats,
    buildBucketConfusionMatrix,
    buildScoreDecileConfusionMatrix,
    comparePredictionToBaseline,
    scanForbiddenClaims,
    P3CorpusRow,
    P1BaselineRow,
} from '../P4CalibrationAuditUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Test data factories
// ─────────────────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
    symbol: string;
    originalAsOfDate: string;
    researchBucket: string;
    researchScore: number;
    alphaScore: number;
    horizonDays: number;
    returnPct: number | null;
    status: 'COMPLETE' | 'PARTIAL' | 'EMPTY';
}>): P3CorpusRow {
    const {
        symbol = '0001',
        originalAsOfDate = '2026-01-10',
        researchBucket = 'Strong',
        researchScore = 75,
        alphaScore = 75,
        horizonDays = 5,
        returnPct = 2.5,
        status = 'COMPLETE',
    } = overrides;
    return {
        symbol,
        originalAsOfDate,
        researchBucket,
        scoreSnapshot: { researchScore },
        outcomeSnapshot: {
            horizonDays,
            returnPct,
            priceSource: 'stockQuote.close',
            outcomeAvailable: returnPct !== null,
        },
        scoringCompletenessStatus: status,
        activeScoringSnapshot: {
            alphaScore,
            researchBucket,
            signalSnapshot: ['s1', 's2'],
            factorSnapshot: ['f1'],
            reasonSnapshot: 'test reason',
            pitGateDate: originalAsOfDate,
            completenessStatus: status === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL',
        },
        duplicateKey: `${symbol}|${originalAsOfDate}|${horizonDays}`,
    };
}

function makeBaseline(overrides: Partial<{
    baselineType: string;
    symbol: string;
    originalAsOfDate: string;
    horizonDays: number;
    returnPct: number | null;
}>): P1BaselineRow {
    const {
        baselineType = 'BUY_AND_HOLD_ALL',
        symbol = '0001',
        originalAsOfDate = '2026-01-10',
        horizonDays = 5,
        returnPct = 1.5,
    } = overrides;
    return { baselineType, symbol, originalAsOfDate, horizonDays, returnPct };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. computeDescriptiveStats
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDescriptiveStats', () => {
    it('handles empty array', () => {
        const s = computeDescriptiveStats([]);
        expect(s.count).toBe(0);
        expect(s.mean).toBeNull();
        expect(s.median).toBeNull();
        expect(s.missingRatio).toBe(1);
    });

    it('computes correct mean, median for [1,2,3,4,5]', () => {
        const s = computeDescriptiveStats([1, 2, 3, 4, 5]);
        expect(s.mean).toBe(3);
        expect(s.median).toBe(3);
        expect(s.count).toBe(5);
        expect(s.nonMissingCount).toBe(5);
        expect(s.missingRatio).toBe(0);
    });

    it('computes correct median for even-length array', () => {
        const s = computeDescriptiveStats([1, 2, 3, 4]);
        expect(s.median).toBe(2.5);
    });

    it('counts missing values correctly', () => {
        const s = computeDescriptiveStats([null, 2, null, 4]);
        expect(s.count).toBe(4);
        expect(s.nonMissingCount).toBe(2);
        expect(s.missingRatio).toBe(0.5);
        expect(s.mean).toBe(3);
    });

    it('reports all-missing correctly', () => {
        const s = computeDescriptiveStats([null, null]);
        expect(s.count).toBe(2);
        expect(s.nonMissingCount).toBe(0);
        expect(s.mean).toBeNull();
        expect(s.missingRatio).toBe(1);
    });

    it('classifies positive/flat/negative return ratios', () => {
        // positiveReturnRatio: >1.0, flatRatio: 0..1, negativeReturnRatio: <0
        const s = computeDescriptiveStats([-5, 0.5, 0, 3.0, 2.5]);
        // negative: -5 → 1/5, flat: 0.5, 0 → 2/5, positive: 3.0, 2.5 → 2/5
        expect(s.negativeReturnRatio).toBe(0.2);
        expect(s.flatReturnRatio).toBe(0.4);
        expect(s.positiveReturnRatio).toBe(0.4);
    });

    it('computes stdDev correctly for single value', () => {
        const s = computeDescriptiveStats([5]);
        expect(s.standardDeviation).toBe(0);
    });

    it('computes stdDev for [2,4,4,4,5,5,7,9] (variance=4)', () => {
        const s = computeDescriptiveStats([2, 4, 4, 4, 5, 5, 7, 9]);
        // sample stddev: mean=5, sum_sq=(9+1+1+1+0+0+4+16)=32, var=32/7≈4.571
        expect(s.standardDeviation).toBeCloseTo(2.138, 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. classifyRealizedReturn
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyRealizedReturn', () => {
    it('POSITIVE for returnPct > 1', () => {
        expect(classifyRealizedReturn(5.0)).toBe('POSITIVE');
        expect(classifyRealizedReturn(1.01)).toBe('POSITIVE');
    });

    it('FLAT for returnPct in [0, 1]', () => {
        expect(classifyRealizedReturn(0)).toBe('FLAT');
        expect(classifyRealizedReturn(0.5)).toBe('FLAT');
        expect(classifyRealizedReturn(1.0)).toBe('FLAT');
    });

    it('NEGATIVE for returnPct < 0', () => {
        expect(classifyRealizedReturn(-0.1)).toBe('NEGATIVE');
        expect(classifyRealizedReturn(-10)).toBe('NEGATIVE');
    });

    it('MISSING for null or undefined', () => {
        expect(classifyRealizedReturn(null)).toBe('MISSING');
        expect(classifyRealizedReturn(undefined)).toBe('MISSING');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. extractPrimaryScore
// ─────────────────────────────────────────────────────────────────────────────

describe('extractPrimaryScore', () => {
    it('prefers activeScoringSnapshot.alphaScore', () => {
        const row = makeRow({ researchScore: 50, alphaScore: 80 });
        expect(extractPrimaryScore(row)).toBe(80);
    });

    it('falls back to scoreSnapshot.researchScore when no activeScoringSnapshot', () => {
        const row = makeRow({ researchScore: 50 });
        delete (row as any).activeScoringSnapshot;
        expect(extractPrimaryScore(row)).toBe(50);
    });

    it('returns 0 when both are missing', () => {
        const row = makeRow({});
        delete (row as any).activeScoringSnapshot;
        delete (row as any).scoreSnapshot;
        expect(extractPrimaryScore(row)).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. computeScoreDecileMap
// ─────────────────────────────────────────────────────────────────────────────

describe('computeScoreDecileMap', () => {
    it('assigns same decile to tied scores (deterministic)', () => {
        const scores = [50, 50, 50, 80, 80, 90];
        const { decileMap } = computeScoreDecileMap(scores);
        // All 50s must share the same decile
        expect(decileMap.get(50)).toBe(decileMap.get(50));
        // 80s and 90s must get higher decile than 50
        expect(decileMap.get(80)!).toBeGreaterThan(decileMap.get(50)!);
        expect(decileMap.get(90)!).toBeGreaterThanOrEqual(decileMap.get(80)!);
    });

    it('reports tieCount correctly', () => {
        const scores = [50, 50, 80, 80, 90];
        const { tieCount } = computeScoreDecileMap(scores);
        // 2 pairs of ties → tieCount=4
        expect(tieCount).toBe(4);
    });

    it('reports uniqueScoreCount correctly', () => {
        const scores = [50, 50, 80, 90];
        const { uniqueScoreCount } = computeScoreDecileMap(scores);
        expect(uniqueScoreCount).toBe(3);
    });

    it('assigns decile 5 for single unique score', () => {
        const { decileMap } = computeScoreDecileMap([42, 42, 42]);
        expect(decileMap.get(42)).toBe(5);
    });

    it('produces deciles in [1,10] for varied scores', () => {
        const scores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        const { decileMap } = computeScoreDecileMap(scores);
        for (const [, d] of decileMap) {
            expect(d).toBeGreaterThanOrEqual(1);
            expect(d).toBeLessThanOrEqual(10);
        }
    });

    it('determinism: running twice gives same result', () => {
        const scores = [55, 70, 80, 55, 60, 70];
        const { decileMap: m1 } = computeScoreDecileMap([...scores]);
        const { decileMap: m2 } = computeScoreDecileMap([...scores]);
        expect([...m1]).toEqual([...m2]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. buildBucketReturnStats
// ─────────────────────────────────────────────────────────────────────────────

describe('buildBucketReturnStats', () => {
    it('groups by bucket × horizonDays', () => {
        const rows = [
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: 3.0 }),
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: 5.0 }),
            makeRow({ researchBucket: 'Watch', horizonDays: 5, returnPct: -1.0 }),
        ];
        const stats = buildBucketReturnStats(rows);
        const strong5 = stats.find(s => s.researchBucket === 'Strong' && s.horizonDays === 5);
        expect(strong5).toBeDefined();
        expect(strong5!.count).toBe(2);
        expect(strong5!.mean).toBeCloseTo(4.0, 4);
    });

    it('includes scoringCompletenessDistribution', () => {
        const rows = [
            makeRow({ researchBucket: 'Neutral', horizonDays: 5, status: 'COMPLETE' }),
            makeRow({ researchBucket: 'Neutral', horizonDays: 5, status: 'PARTIAL' }),
        ];
        const stats = buildBucketReturnStats(rows);
        const n5 = stats.find(s => s.researchBucket === 'Neutral' && s.horizonDays === 5)!;
        expect(n5.scoringCompletenessDistribution.COMPLETE).toBe(1);
        expect(n5.scoringCompletenessDistribution.PARTIAL).toBe(1);
    });

    it('handles null returnPct (missing)', () => {
        const rows = [
            makeRow({ researchBucket: 'LowPriority', horizonDays: 20, returnPct: null }),
        ];
        const stats = buildBucketReturnStats(rows);
        const lp20 = stats.find(s => s.researchBucket === 'LowPriority' && s.horizonDays === 20)!;
        expect(lp20.missingRatio).toBe(1);
        expect(lp20.mean).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. buildScoreDecileStats
// ─────────────────────────────────────────────────────────────────────────────

describe('buildScoreDecileStats', () => {
    it('produces decile stats with correct horizonDays', () => {
        const rows = [
            makeRow({ alphaScore: 30, horizonDays: 5, returnPct: 1.5 }),
            makeRow({ alphaScore: 70, horizonDays: 5, returnPct: 2.0 }),
            makeRow({ alphaScore: 90, horizonDays: 5, returnPct: 3.0 }),
        ];
        const { stats } = buildScoreDecileStats(rows);
        expect(stats.length).toBeGreaterThan(0);
        for (const s of stats) expect(s.horizonDays).toBe(5);
    });

    it('decile assignment is deterministic across calls', () => {
        const rows = [
            makeRow({ alphaScore: 40, horizonDays: 5, returnPct: 0.5 }),
            makeRow({ alphaScore: 60, horizonDays: 5, returnPct: 2.0 }),
            makeRow({ alphaScore: 80, horizonDays: 5, returnPct: 3.0 }),
        ];
        const { stats: s1 } = buildScoreDecileStats([...rows]);
        const { stats: s2 } = buildScoreDecileStats([...rows]);
        expect(s1.map(s => s.decile)).toEqual(s2.map(s => s.decile));
    });

    it('metadata includes tieCount and uniqueScoreCount', () => {
        const rows = [
            makeRow({ alphaScore: 50, horizonDays: 5 }),
            makeRow({ alphaScore: 50, horizonDays: 5 }),
        ];
        const { metadata } = buildScoreDecileStats(rows);
        const m = metadata.find(m => m.horizonDays === 5)!;
        expect(m.uniqueScoreCount).toBe(1);
        expect(m.tieCount).toBe(2);
    });

    it('includes bucketDistribution per decile', () => {
        const rows = [
            makeRow({ alphaScore: 40, researchBucket: 'Watch', horizonDays: 5 }),
            makeRow({ alphaScore: 80, researchBucket: 'Strong', horizonDays: 5 }),
        ];
        const { stats } = buildScoreDecileStats(rows);
        const hasWatch = stats.some(s => s.bucketDistribution['Watch'] > 0);
        const hasStrong = stats.some(s => s.bucketDistribution['Strong'] > 0);
        expect(hasWatch).toBe(true);
        expect(hasStrong).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. buildCompletenessReturnStats
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCompletenessReturnStats', () => {
    it('groups by completenessStatus × horizon', () => {
        const rows = [
            makeRow({ status: 'COMPLETE', horizonDays: 5, returnPct: 3.0 }),
            makeRow({ status: 'PARTIAL', horizonDays: 5, returnPct: 1.5 }),
        ];
        const stats = buildCompletenessReturnStats(rows);
        const c5 = stats.find(s => s.scoringCompletenessStatus === 'COMPLETE' && s.horizonDays === 5)!;
        const p5 = stats.find(s => s.scoringCompletenessStatus === 'PARTIAL' && s.horizonDays === 5)!;
        expect(c5).toBeDefined();
        expect(p5).toBeDefined();
    });

    it('handles EMPTY status', () => {
        const rows = [makeRow({ status: 'EMPTY', horizonDays: 20, returnPct: null })];
        const stats = buildCompletenessReturnStats(rows);
        const e20 = stats.find(s => s.scoringCompletenessStatus === 'EMPTY')!;
        expect(e20).toBeDefined();
        expect(e20.missingRatio).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. buildBucketConfusionMatrix
// ─────────────────────────────────────────────────────────────────────────────

describe('buildBucketConfusionMatrix', () => {
    it('counts POSITIVE/NEGATIVE/FLAT/MISSING correctly', () => {
        const rows = [
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: 5.0 }),  // POSITIVE
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: -2.0 }), // NEGATIVE
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: 0.5 }),  // FLAT
            makeRow({ researchBucket: 'Strong', horizonDays: 5, returnPct: null }),  // MISSING
        ];
        const matrix = buildBucketConfusionMatrix(rows);
        const strong5 = matrix.find(e => e.key === 'Strong' && e.horizonDays === 5)!;
        expect(strong5.POSITIVE).toBe(1);
        expect(strong5.NEGATIVE).toBe(1);
        expect(strong5.FLAT).toBe(1);
        expect(strong5.MISSING).toBe(1);
        expect(strong5.total).toBe(4);
    });

    it('dimension field is "bucket"', () => {
        const rows = [makeRow({ researchBucket: 'Watch', horizonDays: 5 })];
        const matrix = buildBucketConfusionMatrix(rows);
        expect(matrix[0].dimension).toBe('bucket');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. buildScoreDecileConfusionMatrix
// ─────────────────────────────────────────────────────────────────────────────

describe('buildScoreDecileConfusionMatrix', () => {
    it('dimension field is "scoreDecile"', () => {
        const rows = [makeRow({ alphaScore: 60, horizonDays: 5 })];
        const matrix = buildScoreDecileConfusionMatrix(rows);
        expect(matrix[0].dimension).toBe('scoreDecile');
    });

    it('keys are string decile numbers', () => {
        const rows = [
            makeRow({ alphaScore: 30, horizonDays: 5 }),
            makeRow({ alphaScore: 80, horizonDays: 5 }),
        ];
        const matrix = buildScoreDecileConfusionMatrix(rows);
        for (const e of matrix) {
            const d = parseInt(e.key, 10);
            expect(d).toBeGreaterThanOrEqual(1);
            expect(d).toBeLessThanOrEqual(10);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. comparePredictionToBaseline
// ─────────────────────────────────────────────────────────────────────────────

describe('comparePredictionToBaseline', () => {
    it('outputs disclaimer field', () => {
        const result = comparePredictionToBaseline(
            [makeRow({ horizonDays: 5 })],
            [makeBaseline({ horizonDays: 5 })],
        );
        expect(result.disclaimer).toContain('Descriptive');
    });

    it('does not output forbidden investment claims', () => {
        const result = comparePredictionToBaseline(
            [makeRow({ horizonDays: 5, returnPct: 3.0 })],
            [makeBaseline({ horizonDays: 5, returnPct: 1.5 })],
        );
        const text = JSON.stringify(result);
        const forbidden = scanForbiddenClaims(text);
        expect(forbidden).toEqual([]);
    });

    it('produces horizon entries for each horizon present', () => {
        const predRows = [
            makeRow({ horizonDays: 5 }),
            makeRow({ horizonDays: 20 }),
        ];
        const baseRows = [
            makeBaseline({ horizonDays: 5 }),
            makeBaseline({ horizonDays: 20 }),
        ];
        const result = comparePredictionToBaseline(predRows, baseRows);
        const horizons = result.horizons.map(h => h.horizonDays);
        expect(horizons).toContain(5);
        expect(horizons).toContain(20);
    });

    it('includes coverage ratios', () => {
        const pred = [makeRow({ returnPct: 2.0 }), makeRow({ returnPct: null })];
        const base = [makeBaseline({ returnPct: 1.0 }), makeBaseline({ returnPct: null })];
        const result = comparePredictionToBaseline(pred, base);
        expect(result.predictionCoverageRatio).toBe(0.5);
    });

    it('handles empty prediction rows', () => {
        const result = comparePredictionToBaseline([], [makeBaseline({})]);
        expect(result.predictionCoverageRatio).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. scanForbiddenClaims
// ─────────────────────────────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
    it('detects "roi"', () => {
        expect(scanForbiddenClaims('Expected ROI is 30%')).toContain('roi');
    });

    it('detects "win-rate"', () => {
        expect(scanForbiddenClaims('win-rate is 70%')).toContain('win-rate');
    });

    it('detects "outperform"', () => {
        expect(scanForbiddenClaims('This will outperform the index')).toContain('outperform');
    });

    it('detects "guaranteed"', () => {
        expect(scanForbiddenClaims('Returns are guaranteed')).toContain('guaranteed');
    });

    it('detects "profit"', () => {
        expect(scanForbiddenClaims('Large profit expected')).toContain('profit');
    });

    it('detects "buy signal"', () => {
        expect(scanForbiddenClaims('buy signal detected')).toContain('buy-signal');
    });

    it('detects "sell signal"', () => {
        expect(scanForbiddenClaims('sell signal triggered')).toContain('sell-signal');
    });

    it('detects "alpha edge"', () => {
        expect(scanForbiddenClaims('confirmed alpha edge')).toContain('alpha-edge');
    });

    it('returns empty for legitimate descriptive text', () => {
        const safeText = 'Descriptive distribution comparison only. Not investment advice. Not a trading system. return distribution statistics.';
        expect(scanForbiddenClaims(safeText)).toEqual([]);
    });

    it('returns empty for field-name context (alphaScore)', () => {
        const safeText = 'activeScoringSnapshot.alphaScore = 75. descriptive statistics only.';
        // "alpha" alone doesn't match "alpha edge" pattern
        expect(scanForbiddenClaims(safeText)).toEqual([]);
    });
});
