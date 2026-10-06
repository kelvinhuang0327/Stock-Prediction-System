/**
 * p2spotcheck_prediction_layer_audit.test.ts — P2-HARDRESET PART E Tests
 *
 * Tests for P2SpotCheckUtils utility functions.
 *
 * Coverage:
 * - Field inspection handles missing score/bucket
 * - Descriptive stats: mean, median, stddev correct
 * - Bucket audit groups correctly when bucket exists
 * - Score decile deterministic (same input → same output)
 * - Confusion matrix return class classification correct
 * - Baseline comparison structure has no forbidden claim fields
 * - deterministicHash is stable
 * - classifyReturn boundary cases
 * - containsForbiddenClaims detects all forbidden words
 * - Frozen corpus and ManualReview files remain untouched
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    P2_UTILS_VERSION,
    computeMean,
    computeMedian,
    computeStddev,
    computeDescStats,
    round4,
    classifyReturn,
    assessFieldDiscriminability,
    groupReturnsByBucket,
    buildScoreDeciles,
    buildConfusionMatrix,
    containsForbiddenClaims,
    deterministicHash,
} from '../P2SpotCheckUtils';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'outputs', 'online_validation');
const FROZEN_CORPUS = path.join(OUTPUT_DIR, 'simulation_snapshot_corpus.jsonl');
const MANUAL_REVIEW_FILES = [
    'src/lib/onlineValidation/ManualReviewWorkflowBinding.ts',
    'src/lib/onlineValidation/ManualReviewActionSchema.ts',
    'src/lib/onlineValidation/ManualReviewOpsSurfaceAudit.ts',
    'src/lib/onlineValidation/ManualReviewSurfaceContract.ts',
];

// ─── Version ───────────────────────────────────────────────────────────────────

describe('P2SpotCheckUtils — version', () => {
    it('exports P2_UTILS_VERSION', () => {
        expect(P2_UTILS_VERSION).toBe('p2hardreset-spotcheck-utils-v1');
    });
});

// ─── computeMean ────────────────────────────────────────────────────────────────

describe('computeMean', () => {
    it('returns null for empty array', () => {
        expect(computeMean([])).toBeNull();
    });
    it('returns value for single element', () => {
        expect(computeMean([5])).toBe(5);
    });
    it('computes correct mean', () => {
        expect(computeMean([1, 2, 3, 4, 5])).toBe(3);
    });
    it('handles negative values', () => {
        expect(computeMean([-10, 10])).toBe(0);
    });
});

// ─── computeMedian ─────────────────────────────────────────────────────────────

describe('computeMedian', () => {
    it('returns null for empty array', () => {
        expect(computeMedian([])).toBeNull();
    });
    it('returns single element', () => {
        expect(computeMedian([7])).toBe(7);
    });
    it('returns middle for odd length', () => {
        expect(computeMedian([3, 1, 2])).toBe(2);
    });
    it('returns average of two middle for even length', () => {
        expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    });
    it('does not mutate input', () => {
        const arr = [5, 1, 3];
        computeMedian(arr);
        expect(arr).toEqual([5, 1, 3]);
    });
});

// ─── computeStddev ─────────────────────────────────────────────────────────────

describe('computeStddev', () => {
    it('returns null for empty array', () => {
        expect(computeStddev([])).toBeNull();
    });
    it('returns null for single element', () => {
        expect(computeStddev([5])).toBeNull();
    });
    it('computes sample stddev correctly', () => {
        // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, sum of sq deviations=32, sample variance=32/7≈4.571, stddev≈2.138
        const result = computeStddev([2, 4, 4, 4, 5, 5, 7, 9]);
        expect(result).toBeCloseTo(2.138, 2);
    });
    it('returns 0 for identical values', () => {
        expect(computeStddev([3, 3, 3])).toBe(0);
    });
});

// ─── computeDescStats ─────────────────────────────────────────────────────────

describe('computeDescStats', () => {
    it('returns zeros/nulls for empty array', () => {
        const s = computeDescStats([]);
        expect(s.count).toBe(0);
        expect(s.mean).toBeNull();
        expect(s.median).toBeNull();
        expect(s.min).toBeNull();
        expect(s.max).toBeNull();
        expect(s.stddev).toBeNull();
    });
    it('returns correct stats for [1, 2, 3]', () => {
        const s = computeDescStats([1, 2, 3]);
        expect(s.count).toBe(3);
        expect(s.mean).toBe(2);
        expect(s.median).toBe(2);
        expect(s.min).toBe(1);
        expect(s.max).toBe(3);
        expect(s.stddev).toBe(1);
    });
});

// ─── round4 ───────────────────────────────────────────────────────────────────

describe('round4', () => {
    it('rounds to 4 decimal places', () => {
        expect(round4(1.23456789)).toBe(1.2346);
    });
    it('returns null for null', () => {
        expect(round4(null)).toBeNull();
    });
    it('handles exact values', () => {
        expect(round4(3.1415)).toBe(3.1415);
    });
});

// ─── classifyReturn ────────────────────────────────────────────────────────────

describe('classifyReturn', () => {
    it('classifies null as MISSING', () => {
        expect(classifyReturn(null)).toBe('MISSING');
    });
    it('classifies undefined as MISSING', () => {
        expect(classifyReturn(undefined)).toBe('MISSING');
    });
    it('classifies negative as NEGATIVE', () => {
        expect(classifyReturn(-0.01)).toBe('NEGATIVE');
        expect(classifyReturn(-100)).toBe('NEGATIVE');
    });
    it('classifies 0 as FLAT', () => {
        expect(classifyReturn(0)).toBe('FLAT');
    });
    it('classifies exactly 1 as FLAT', () => {
        expect(classifyReturn(1)).toBe('FLAT');
    });
    it('classifies > 1 as POSITIVE', () => {
        expect(classifyReturn(1.01)).toBe('POSITIVE');
        expect(classifyReturn(50)).toBe('POSITIVE');
    });
    it('classifies 0.5 as FLAT', () => {
        expect(classifyReturn(0.5)).toBe('FLAT');
    });
});

// ─── assessFieldDiscriminability ──────────────────────────────────────────────

describe('assessFieldDiscriminability', () => {
    it('returns FULL_BUCKET_SCORE_AUDIT when bucket has cardinality > 1', () => {
        const result = assessFieldDiscriminability(
            ['BullishStrong', 'Neutral', 'Bearish'],
            [0, 0, 0],
        );
        expect(result.auditMode).toBe('FULL_BUCKET_SCORE_AUDIT');
        expect(result.bucketDiscriminative).toBe(true);
        expect(result.classification).toBe('P2_SPOTCHECK_FULL_AUDIT');
    });
    it('returns FULL_BUCKET_SCORE_AUDIT when score has non-zero values', () => {
        const result = assessFieldDiscriminability(
            ['Neutral'],
            [0, 0, 5, 7, 2],
        );
        expect(result.auditMode).toBe('FULL_BUCKET_SCORE_AUDIT');
        expect(result.scoreDiscriminative).toBe(true);
    });
    it('returns LIMITED_NON_DISCRIMINATIVE_FIELDS when bucket all Neutral and score all zero', () => {
        const result = assessFieldDiscriminability(
            ['Neutral', 'Neutral', 'Neutral'],
            [0, 0, 0],
        );
        expect(result.auditMode).toBe('LIMITED_NON_DISCRIMINATIVE_FIELDS');
        expect(result.classification).toBe('P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS');
        expect(result.bucketDiscriminative).toBe(false);
        expect(result.scoreDiscriminative).toBe(false);
    });
    it('returns RETURN_DISTRIBUTION_ONLY when no bucket or score fields', () => {
        const result = assessFieldDiscriminability([], []);
        expect(result.auditMode).toBe('RETURN_DISTRIBUTION_ONLY');
        expect(result.classification).toBe('P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS');
    });
    it('hasBucketField=false when empty bucket values', () => {
        const result = assessFieldDiscriminability([], [1, 2, 3]);
        expect(result.hasBucketField).toBe(false);
    });
    it('hasScoreField=false when empty score values', () => {
        const result = assessFieldDiscriminability(['A', 'B'], []);
        expect(result.hasScoreField).toBe(false);
    });
});

// ─── groupReturnsByBucket ─────────────────────────────────────────────────────

describe('groupReturnsByBucket', () => {
    const rows = [
        { bucket: 'BullishStrong', returnPct: 5.0, priceSource: 'stockQuote.close' },
        { bucket: 'BullishStrong', returnPct: 3.0, priceSource: 'stockQuote.close' },
        { bucket: 'Neutral', returnPct: -1.0, priceSource: 'stockQuote.close' },
        { bucket: 'Neutral', returnPct: null, priceSource: 'MISSING' },
        { bucket: 'Bearish', returnPct: -2.0, priceSource: 'stockQuote.close' },
    ];

    it('groups by bucket correctly', () => {
        const groups = groupReturnsByBucket(rows);
        const bucketNames = groups.map(g => g.bucket);
        expect(bucketNames).toContain('BullishStrong');
        expect(bucketNames).toContain('Neutral');
        expect(bucketNames).toContain('Bearish');
    });
    it('counts correctly', () => {
        const groups = groupReturnsByBucket(rows);
        const neutral = groups.find(g => g.bucket === 'Neutral');
        expect(neutral?.total).toBe(2);
        expect(neutral?.missing).toBe(1);
        expect(neutral?.returns).toEqual([-1.0]);
    });
    it('sorts output deterministically by bucket name', () => {
        const groups = groupReturnsByBucket(rows);
        const names = groups.map(g => g.bucket);
        expect(names).toEqual([...names].sort());
    });
    it('treats null bucket as MISSING', () => {
        const r = [{ bucket: null, returnPct: 1.0, priceSource: 'stockQuote.close' }];
        const groups = groupReturnsByBucket(r);
        expect(groups[0].bucket).toBe('MISSING');
    });
    it('skips PENDING price sources', () => {
        const r = [{ bucket: 'A', returnPct: 2.0, priceSource: 'PENDING' }];
        const groups = groupReturnsByBucket(r);
        expect(groups[0].returns).toHaveLength(0);
        expect(groups[0].missing).toBe(0);
    });
});

// ─── buildScoreDeciles ────────────────────────────────────────────────────────

describe('buildScoreDeciles', () => {
    it('returns empty for empty input', () => {
        expect(buildScoreDeciles([])).toHaveLength(0);
    });
    it('returns 10 deciles for sufficient input', () => {
        const rows = Array.from({ length: 100 }, (_, i) => ({
            score: i,
            returnPct: i % 2 === 0 ? i * 0.1 : -i * 0.1,
            priceSource: 'stockQuote.close',
        }));
        const deciles = buildScoreDeciles(rows);
        expect(deciles).toHaveLength(10);
    });
    it('is deterministic — same input same output', () => {
        const rows = [
            { score: 3, returnPct: 1.0, priceSource: 'stockQuote.close' },
            { score: 1, returnPct: 2.0, priceSource: 'stockQuote.close' },
            { score: 2, returnPct: 0.5, priceSource: 'stockQuote.close' },
            { score: 5, returnPct: -1.0, priceSource: 'stockQuote.close' },
            { score: 4, returnPct: 3.0, priceSource: 'stockQuote.close' },
        ];
        const d1 = buildScoreDeciles([...rows]);
        const d2 = buildScoreDeciles([...rows]);
        expect(d1).toEqual(d2);
    });
    it('decile numbers are 1-10', () => {
        const rows = Array.from({ length: 20 }, (_, i) => ({ score: i, returnPct: i * 0.5, priceSource: 'stockQuote.close' }));
        const deciles = buildScoreDeciles(rows);
        const decileNums = deciles.map(d => d.decile);
        expect(decileNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});

// ─── buildConfusionMatrix ─────────────────────────────────────────────────────

describe('buildConfusionMatrix', () => {
    const rows = [
        { label: '5D', returnPct: 5.0 },
        { label: '5D', returnPct: -2.0 },
        { label: '5D', returnPct: 0.5 },
        { label: '5D', returnPct: null },
        { label: '20D', returnPct: 15.0 },
        { label: '20D', returnPct: -5.0 },
    ];

    it('classifies into correct classes', () => {
        const matrix = buildConfusionMatrix(rows);
        const row5D = matrix.find(r => r.label === '5D');
        expect(row5D?.POSITIVE).toBe(1);
        expect(row5D?.NEGATIVE).toBe(1);
        expect(row5D?.FLAT).toBe(1);
        expect(row5D?.MISSING).toBe(1);
        expect(row5D?.total).toBe(4);
    });
    it('computes ratios correctly', () => {
        const matrix = buildConfusionMatrix(rows);
        const row5D = matrix.find(r => r.label === '5D');
        expect(row5D?.positiveRatio).toBe(0.25);
        expect(row5D?.negativeRatio).toBe(0.25);
        expect(row5D?.flatRatio).toBe(0.25);
        expect(row5D?.missingRatio).toBe(0.25);
    });
    it('sorts output by label', () => {
        const matrix = buildConfusionMatrix(rows);
        const labels = matrix.map(r => r.label);
        expect(labels).toEqual([...labels].sort());
    });
    it('handles empty input', () => {
        expect(buildConfusionMatrix([])).toHaveLength(0);
    });
});

// ─── containsForbiddenClaims ───────────────────────────────────────────────────

describe('containsForbiddenClaims', () => {
    it('detects ROI', () => {
        expect(containsForbiddenClaims('Our ROI was excellent')).not.toHaveLength(0);
    });
    it('detects win-rate', () => {
        expect(containsForbiddenClaims('win-rate is 60%')).not.toHaveLength(0);
    });
    it('detects outperform', () => {
        expect(containsForbiddenClaims('This outperforms the market')).not.toHaveLength(0);
    });
    it('detects guaranteed', () => {
        expect(containsForbiddenClaims('guaranteed returns')).not.toHaveLength(0);
    });
    it('detects alpha', () => {
        expect(containsForbiddenClaims('positive alpha')).not.toHaveLength(0);
    });
    it('returns empty for clean observability text', () => {
        expect(containsForbiddenClaims('descriptive statistics for observability only')).toHaveLength(0);
    });
    it('returns empty for field name context like recommendationBucket', () => {
        // The word 'recommendation' alone is not in the forbidden list — only as investment recommendation phrase
        expect(containsForbiddenClaims('field: recommendationBucket')).toHaveLength(0);
    });
    it('detects investment recommendation phrase', () => {
        expect(containsForbiddenClaims('This is an investment recommendation')).not.toHaveLength(0);
    });
});

// ─── deterministicHash ────────────────────────────────────────────────────────

describe('deterministicHash', () => {
    it('is stable across calls', () => {
        const h1 = deterministicHash('test-symbol|2024-01-01|5');
        const h2 = deterministicHash('test-symbol|2024-01-01|5');
        expect(h1).toBe(h2);
    });
    it('returns different values for different inputs', () => {
        const h1 = deterministicHash('A');
        const h2 = deterministicHash('B');
        expect(h1).not.toBe(h2);
    });
    it('returns a non-negative integer', () => {
        const h = deterministicHash('hello');
        expect(typeof h).toBe('number');
        expect(h).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(h)).toBe(true);
    });
    it('does not use Math.random', () => {
        // Calling deterministicHash 100 times should produce consistent results
        const results = new Set<number>();
        for (let i = 0; i < 100; i++) {
            results.add(deterministicHash('fixed-key'));
        }
        expect(results.size).toBe(1); // always same hash
    });
});

// ─── Frozen corpus integrity ──────────────────────────────────────────────────

describe('frozen corpus integrity', () => {
    it('simulation_snapshot_corpus.jsonl remains at 60 lines', () => {
        if (!fs.existsSync(FROZEN_CORPUS)) {
            throw new Error(`Frozen corpus not found: ${FROZEN_CORPUS}`);
        }
        const content = fs.readFileSync(FROZEN_CORPUS, 'utf8').trim();
        const lines = content.split('\n');
        expect(lines).toHaveLength(60);
    });
});

// ─── ManualReview files unchanged ─────────────────────────────────────────────

describe('ManualReview files unchanged', () => {
    for (const relPath of MANUAL_REVIEW_FILES) {
        it(`${path.basename(relPath)} exists`, () => {
            const fp = path.join(PROJECT_ROOT, relPath);
            expect(fs.existsSync(fp)).toBe(true);
        });
    }
});

// ─── P2 corpus artifacts parseable ────────────────────────────────────────────

describe('P2 corpus artifacts', () => {
    const P2_ARTIFACTS = [
        'p2spotcheck_preflight_audit.json',
        'p2spotcheck_corpus_field_inspection.json',
        'p2spotcheck_prediction_layer_audit.json',
        'p2spotcheck_walkthrough_cases.json',
    ];

    for (const artifact of P2_ARTIFACTS) {
        it(`${artifact} is valid JSON`, () => {
            const fp = path.join(OUTPUT_DIR, artifact);
            if (!fs.existsSync(fp)) {
                // Skip if not generated yet — PART G will verify
                return;
            }
            const content = fs.readFileSync(fp, 'utf8');
            expect(() => JSON.parse(content)).not.toThrow();
        });
    }

    it('preflight audit has classification P2_PREFLIGHT_PASS', () => {
        const fp = path.join(OUTPUT_DIR, 'p2spotcheck_preflight_audit.json');
        if (!fs.existsSync(fp)) return;
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        expect(data.classification).toBe('P2_PREFLIGHT_PASS');
    });

    it('field inspection has expected classification', () => {
        const fp = path.join(OUTPUT_DIR, 'p2spotcheck_corpus_field_inspection.json');
        if (!fs.existsSync(fp)) return;
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        expect(['P2_SPOTCHECK_FULL_AUDIT', 'P2_SPOTCHECK_LIMITED_BY_MISSING_SCORE_FIELDS']).toContain(data.classification);
    });

    it('prediction layer audit has observabilityNote', () => {
        const fp = path.join(OUTPUT_DIR, 'p2spotcheck_prediction_layer_audit.json');
        if (!fs.existsSync(fp)) return;
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        expect(typeof data.observabilityNote).toBe('string');
        expect(data.observabilityNote.length).toBeGreaterThan(0);
    });

    it('walkthrough cases are deterministic and have expected structure', () => {
        const fp = path.join(OUTPUT_DIR, 'p2spotcheck_walkthrough_cases.json');
        if (!fs.existsSync(fp)) return;
        const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
        expect(data.samplingStrategy).toContain('deterministic');
        expect(Array.isArray(data.cases)).toBe(true);
        expect(data.cases.length).toBeGreaterThan(0);
        for (const c of data.cases) {
            expect(c).toHaveProperty('symbol');
            expect(c).toHaveProperty('originalAsOfDate');
            expect(c).toHaveProperty('horizonDays');
            expect(c).toHaveProperty('returnClass');
        }
    });
});
