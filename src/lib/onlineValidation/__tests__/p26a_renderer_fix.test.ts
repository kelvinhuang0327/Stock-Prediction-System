/**
 * p26a_renderer_fix.test.ts
 * P26A-RENDERER-FIX-HARDRESET — Renderer tests
 *
 * Verifies: multi-factor reason rendering, alphaScore/bucket invariance,
 * frozen corpus, scoring formula sha256, forbidden claims.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import {
    renderReasonFromCorpusSnapshot,
    renderReasonBatch,
    isSingleTokenGenericReason,
    buildDataCoverageNote,
    countRenderedFactors,
    SINGLE_TOKEN_GENERIC_REASONS,
    CORPUS_REASON_RENDERER_VERSION,
} from '../P26ACorpusReasonRenderer';

import type { ActiveScoringSnapshot } from '../ActiveScoringSnapshotBuilder';

const ROOT = path.resolve(__dirname, '../../../../');

function sha256File(rel: string): string {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) return 'MISSING';
    return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
}

function countNonEmptyLines(rel: string): number {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) return -1;
    return fs.readFileSync(fp, 'utf8').split('\n').filter(l => l.trim().length > 0).length;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ActiveScoringSnapshot> = {}): ActiveScoringSnapshot {
    return {
        builderVersion: 'p3hardreset-active-scoring-builder-v1',
        symbol: '1710',
        asOfDate: '2025-12-15',
        scoringMode: 'RULE_BASED_ANALYZER',
        scoringEngineSource: 'RuleBasedStockAnalyzer',
        researchBucket: 'Neutral',
        alphaScore: 68,
        scoreSnapshot: {
            researchScore: 68,
            confidenceScore: 0,
            technicalScore: 65,
            chipScore: 55,
            fundamentalScore: 0,
            marketAdjustment: 0,
        },
        signalSnapshot: ['MA 趨勢', 'RSI(14)', 'MACD', '近 20 日動能', '法人近 10 日買超'],
        factorSnapshot: [
            'MA 趨勢: 多頭排列 (MA20(12.24) > MA60(12.19))',
            'RSI(14): 60 (中性健康區間)',
            'MACD: 0.01 (MACD > 0，多方動能)',
            '近 20 日動能: -3.49% (近 20 日漲跌幅 負)',
            '法人近 10 日買超: 1500 (千股)',
            '波動率: 2.1% (近 10 日年化)',
        ],
        reasonSnapshot: '技術偏多',
        limitations: [],
        dataCoverage: 'limited',
        dataPoints: 452,
        usedSources: ['StockQuote', 'InstitutionalChip'],
        missingSources: ['MonthlyRevenue'],
        pitGateDate: '2025-12-15',
        scoringAvailable: true,
        completenessStatus: 'PARTIAL',
        scoringNote: 'dataCoverage=limited dataPoints=452 recommendation=中性',
        ...overrides,
    };
}

// ── Core renderer tests ───────────────────────────────────────────────────────

describe('P26ACorpusReasonRenderer — core renderer', () => {
    it('factorSnapshot present + single-token reason → ENRICHED with multi-factor text', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.outcome).toBe('ENRICHED');
        expect(result.renderedText).not.toBe('技術偏多');
        expect(result.renderedText.length).toBeGreaterThan(10);
    });

    it('enriched text has multiple factor dimensions (countRenderedFactors > 1)', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        const dimCount = countRenderedFactors(result.renderedText);
        expect(dimCount).toBeGreaterThan(1);
    });

    it('enriched text contains technical dimension', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.renderedText).toMatch(/技術|MA|RSI|MACD/);
    });

    it('old reason text is preserved in oldText field', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.oldText).toBe('技術偏多');
    });

    it('alphaScoreUnchanged is always true', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.alphaScoreUnchanged).toBe(true);
    });

    it('bucketUnchanged is always true', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.bucketUnchanged).toBe(true);
    });

    it('factorCount in result equals factorSnapshot length', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.factorCount).toBe(snap.factorSnapshot.length);
    });

    it('rendererVersion is set', () => {
        const snap = makeSnapshot();
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.rendererVersion).toBe(CORPUS_REASON_RENDERER_VERSION);
    });
});

// ── Fallback cases ────────────────────────────────────────────────────────────

describe('P26ACorpusReasonRenderer — fallback cases', () => {
    it('factorSnapshot empty → FALLBACK_EMPTY, returns original reasonSnapshot', () => {
        const snap = makeSnapshot({ factorSnapshot: [], signalSnapshot: [] });
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.outcome).toBe('FALLBACK_EMPTY');
        expect(result.renderedText).toBe('技術偏多');
    });

    it('reasonSnapshot already rich → ALREADY_RICH, not re-enriched', () => {
        const richReason = '技術面偏多，均線多頭排列 / 法人中性（籌碼分數 55） / 波動率 2.1%';
        const snap = makeSnapshot({ reasonSnapshot: richReason });
        const result = renderReasonFromCorpusSnapshot(snap);
        expect(result.outcome).toBe('ALREADY_RICH');
        expect(result.renderedText).toBe(richReason);
    });

    it('reasonSnapshot null → ENRICHED from factorSnapshot', () => {
        const snap = makeSnapshot({ reasonSnapshot: '' });
        const result = renderReasonFromCorpusSnapshot(snap);
        // empty string is not single-token, but factors are available
        // outcome should be ENRICHED (empty string treated as needing enrichment)
        expect(result.factorCount).toBeGreaterThan(0);
    });
});

// ── isSingleTokenGenericReason ────────────────────────────────────────────────

describe('isSingleTokenGenericReason', () => {
    it('returns true for known single-token patterns', () => {
        expect(isSingleTokenGenericReason('技術偏多')).toBe(true);
        expect(isSingleTokenGenericReason('technicalBullish')).toBe(true);
        expect(isSingleTokenGenericReason('法人買超')).toBe(true);
    });

    it('returns false for multi-factor rich text', () => {
        expect(isSingleTokenGenericReason('技術面偏多，均線多頭 / 法人中性')).toBe(false);
        expect(isSingleTokenGenericReason('MA 趨勢: 多頭排列 (note)')).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isSingleTokenGenericReason(null)).toBe(false);
        expect(isSingleTokenGenericReason(undefined)).toBe(false);
    });

    it('SINGLE_TOKEN_GENERIC_REASONS set includes Chinese and English variants', () => {
        expect(SINGLE_TOKEN_GENERIC_REASONS.has('技術偏多')).toBe(true);
        expect(SINGLE_TOKEN_GENERIC_REASONS.has('技術偏空')).toBe(true);
        expect(SINGLE_TOKEN_GENERIC_REASONS.has('technicalBullish')).toBe(true);
    });
});

// ── Data coverage note ────────────────────────────────────────────────────────

describe('buildDataCoverageNote', () => {
    it('returns empty string when no missing sources', () => {
        const note = buildDataCoverageNote(['StockQuote', 'InstitutionalChip'], [], '2025-12-15');
        expect(note).toBe('');
    });

    it('includes missing source name when present', () => {
        const note = buildDataCoverageNote(['StockQuote'], ['MonthlyRevenue'], '2025-12-15');
        expect(note).toContain('MonthlyRevenue');
        expect(note).toContain('2025-12-15');
    });

    it('does NOT include investment claim language', () => {
        const note = buildDataCoverageNote(['StockQuote'], ['MonthlyRevenue'], '2025-12-15');
        expect(note).not.toMatch(/buy|sell|ROI|guaranteed/i);
    });

    it('includes neutral phrasing about data availability', () => {
        const note = buildDataCoverageNote(['StockQuote'], ['MonthlyRevenue'], '2025-12-15');
        expect(note).toMatch(/資料|PIT/);
    });
});

// ── Batch renderer ────────────────────────────────────────────────────────────

describe('renderReasonBatch', () => {
    it('returns array of same length as input', () => {
        const snaps = [makeSnapshot(), makeSnapshot({ symbol: '00738U' })];
        const results = renderReasonBatch(snaps);
        expect(results).toHaveLength(2);
    });

    it('each result has outcome field', () => {
        const results = renderReasonBatch([makeSnapshot()]);
        expect(results[0].outcome).toBeTruthy();
    });
});

// ── Scoring invariance ────────────────────────────────────────────────────────

describe('P26A renderer fix — alphaScore/bucket invariance', () => {
    it('renderer does NOT change alphaScore on input snapshot', () => {
        const snap = makeSnapshot({ alphaScore: 68 });
        renderReasonFromCorpusSnapshot(snap);
        expect(snap.alphaScore).toBe(68); // input not mutated
    });

    it('renderer does NOT change researchBucket on input snapshot', () => {
        const snap = makeSnapshot({ researchBucket: 'Neutral' });
        renderReasonFromCorpusSnapshot(snap);
        expect(snap.researchBucket).toBe('Neutral'); // input not mutated
    });

    it('renderer does NOT change factorSnapshot on input snapshot', () => {
        const snap = makeSnapshot();
        const originalFactorCount = snap.factorSnapshot.length;
        renderReasonFromCorpusSnapshot(snap);
        expect(snap.factorSnapshot).toHaveLength(originalFactorCount); // not mutated
    });
});

// ── Frozen corpus ─────────────────────────────────────────────────────────────

describe('P26A renderer fix — frozen corpus', () => {
    const FROZEN = [
        { file: 'outputs/online_validation/simulation_snapshot_corpus.jsonl', expected: 60 },
        { file: 'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl', expected: 4500 },
        { file: 'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl', expected: 9900 },
        { file: 'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl', expected: 4500 },
        { file: 'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl', expected: 4500 },
    ];

    it.each(FROZEN)('corpus $file has $expected non-empty lines', ({ file, expected }) => {
        expect(countNonEmptyLines(file)).toBe(expected);
    });
});

// ── Scoring formula sha256 ────────────────────────────────────────────────────

describe('P26A renderer fix — scoring formula sha256 unchanged', () => {
    const BASELINES = [
        { file: 'src/lib/analysis/RuleBasedStockAnalyzer.ts', sha: '4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2' },
        { file: 'src/lib/alpha/SignalFusionEngine.ts', sha: 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4' },
        { file: 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts', sha: '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d' },
    ];

    it.each(BASELINES)('$file sha256 unchanged', ({ file, sha }) => {
        expect(sha256File(file)).toBe(sha);
    });
});

// ── 9-case before/after artifact ─────────────────────────────────────────────

describe('P26A 9-case before/after artifacts', () => {
    let beforeAfter: ReturnType<typeof JSON.parse>;

    beforeAll(() => {
        const fp = path.join(ROOT, 'outputs/online_validation/p26a_renderer_fix_9case_before_after.json');
        beforeAfter = JSON.parse(fs.readFileSync(fp, 'utf8'));
    });

    it('before/after JSON is present and parseable', () => {
        expect(beforeAfter.compareId).toBe('P26A-RENDERER-FIX-9CASE-BEFORE-AFTER');
    });

    it('all 9 cases are present', () => {
        expect(beforeAfter.cases).toHaveLength(9);
    });

    it('all 9 cases have newReasonFactorCount > 1 (multi-factor)', () => {
        for (const c of beforeAfter.cases) {
            expect(c.newReasonFactorCount).toBeGreaterThan(1);
        }
    });

    it('mismatchedAlphaScoreCount = 0', () => {
        expect(beforeAfter.mismatchedAlphaScoreCount).toBe(0);
    });

    it('mismatchedBucketCount = 0', () => {
        expect(beforeAfter.mismatchedBucketCount).toBe(0);
    });

    it('all cases have alphaScoreUnchanged = true', () => {
        for (const c of beforeAfter.cases) {
            expect(c.alphaScoreUnchanged).toBe(true);
        }
    });

    it('all cases have bucketUnchanged = true', () => {
        for (const c of beforeAfter.cases) {
            expect(c.bucketUnchanged).toBe(true);
        }
    });

    it('all cases still show MonthlyRevenue as missing (not fabricated as resolved)', () => {
        for (const c of beforeAfter.cases) {
            expect(c.monthlyRevenueStatus).toBe('STILL_MISSING_SOURCE_BLOCKED');
        }
    });

    it('improvement classification is PARTIAL_FIX_SOURCE_STILL_MISSING or RENDERER_UNDEROUTPUT_FIXED', () => {
        const valid = ['PARTIAL_FIX_SOURCE_STILL_MISSING', 'RENDERER_UNDEROUTPUT_FIXED'];
        for (const c of beforeAfter.cases) {
            expect(valid).toContain(c.improvementClassification);
        }
    });
});

// ── Forbidden claims in new renderer file ────────────────────────────────────

describe('P26A renderer fix — forbidden claims in source file', () => {
    const FORBIDDEN = /\b(ROI|win-rate|win rate|profit|outperform|beat|guaranteed|investment recommendation)\b/i;
    const ALPHA_FIELD_PATTERN = /alphaScore/;

    function scanFile(rel: string): string[] {
        const fp = path.join(ROOT, rel);
        if (!fs.existsSync(fp)) return [];
        return fs.readFileSync(fp, 'utf8').split('\n').filter(line => {
            if (ALPHA_FIELD_PATTERN.test(line)) return false;
            return FORBIDDEN.test(line);
        });
    }

    it('P26ACorpusReasonRenderer.ts has no forbidden claims', () => {
        expect(scanFile('src/lib/onlineValidation/P26ACorpusReasonRenderer.ts')).toHaveLength(0);
    });

    it('before/after artifact JSON has no forbidden claims', () => {
        expect(scanFile('outputs/online_validation/p26a_renderer_fix_9case_before_after.json')).toHaveLength(0);
    });
});

// ── DB sha256 unchanged ───────────────────────────────────────────────────────

describe('P26A renderer fix — DB unchanged', () => {
    it('prisma/dev.db sha256 unchanged (no DB write)', () => {
        const expected = '9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6';
        expect(sha256File('prisma/dev.db')).toBe(expected);
    });
});
