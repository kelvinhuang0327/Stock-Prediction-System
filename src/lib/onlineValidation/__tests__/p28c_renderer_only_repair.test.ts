/**
 * p28c_renderer_only_repair.test.ts
 * P28C-RENDERER-ONLY-REPAIR-HARDRESET
 *
 * Tests for the P28C renderer-only repairs:
 *   - TR-01: scoreSnapshot pass-through in WalkthroughCaseInput
 *   - TR-02: scoreSnapshot wired in P26ACorpusRowAdapter
 *   - TR-03: inferDirectionFromMATrend() fallback in enrichReasonFromExistingFactors
 *   - TR-04: detectMixedSignal() in P26ACorpusReasonRenderer
 *   - TR-05: mixed-signal note appended when MA/MACD contradict
 *   - TR-06: CORPUS_REASON_RENDERER_VERSION bumped to v2
 *
 * All tests are read-only: no DB writes, no corpus mutations, no scoring changes.
 * No investment claims in any output.
 */

import {
    renderReasonFromCorpusSnapshot,
    isSingleTokenGenericReason,
    detectMixedSignal,
    buildMixedSignalNote,
    CORPUS_REASON_RENDERER_VERSION,
} from '../P26ACorpusReasonRenderer';
import { reviewCase, type WalkthroughCaseInput } from '../P5WalkthroughReviewUtils';
import { corpusRowToWalkthroughCaseInput, type CorpusRow } from '../P26ACorpusRowAdapter';
import { inferDirectionFromMATrend } from '../P26AReasonFactorEnrichmentUtils';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FACTORS_00891_MIXED = [
    'MA 趨勢: 空頭排列 (MA20(16.05) < MA60(16.58))',
    'RSI(14): 54.92 (中性健康區間)',
    'MACD: 0.12 (MACD > 0，多方動能)',
    '近 20 日動能: 6.38% (近 20 日漲跌幅 正)',
    '近 5 日報酬: -2.82% (近 5 日漲跌幅)',
    '量能變化: 0.72 (近 5 日/近 20 日成交量比)',
    '波動率: 17.15% (20 日年化波動率)',
    '近期最大回撤: -4.99% (近 20 日)',
    '法人近 10 日買超: 外資淨賣出 800 張',
    '營收年增率: N/A (尚無月營收資料)',
];

const SCORE_SNAPSHOT_75 = { technicalScore: 75, chipScore: 50, researchScore: 63, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 };

const FACTORS_1710_BULLISH = [
    'MA 趨勢: 多頭排列 (MA20(45.20) > MA60(42.80))',
    'RSI(14): 62.5 (偏強)',
    'MACD: 0.45 (MACD > 0，多方動能)',
    '近 20 日動能: 8.3% (近 20 日漲跌幅 正)',
    '近 5 日報酬: 1.2% (近 5 日漲跌幅)',
    '量能變化: 1.1 (近 5 日/近 20 日成交量比)',
    '波動率: 22.0% (20 日年化波動率)',
    '近期最大回撤: -3.5% (近 20 日)',
    '法人近 10 日買超: 外資淨買入 1200 張',
    '營收年增率: N/A (尚無月營收資料)',
];

const SCORE_SNAPSHOT_68 = { technicalScore: 68, chipScore: 65, researchScore: 68, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 };

// ─── TR-06: Renderer version ──────────────────────────────────────────────────

describe('TR-06: Renderer version', () => {
    test('CORPUS_REASON_RENDERER_VERSION is v2', () => {
        expect(CORPUS_REASON_RENDERER_VERSION).toBe('p26a-corpus-renderer-v2');
    });
});

// ─── TR-04: detectMixedSignal ─────────────────────────────────────────────────

describe('TR-04: detectMixedSignal', () => {
    test('detects MA 空頭排列 + MACD 多方動能 as mixed', () => {
        expect(detectMixedSignal(FACTORS_00891_MIXED)).toBe(true);
    });

    test('does NOT flag aligned bullish signals (MA 多頭 + MACD 多方) as mixed', () => {
        expect(detectMixedSignal(FACTORS_1710_BULLISH)).toBe(false);
    });

    test('does NOT flag when no MA trend factor present', () => {
        const noMA = ['RSI(14): 50 (中性)', 'MACD: 0.1 (MACD > 0，多方動能)'];
        expect(detectMixedSignal(noMA)).toBe(false);
    });

    test('detects MA 多頭排列 + MACD 空方動能 as mixed', () => {
        const maBullishMacdBear = [
            'MA 趨勢: 多頭排列 (MA20 > MA60)',
            'MACD: -0.3 (MACD < 0，空方動能)',
        ];
        expect(detectMixedSignal(maBullishMacdBear)).toBe(true);
    });

    test('returns false for empty factor array', () => {
        expect(detectMixedSignal([])).toBe(false);
    });
});

// ─── TR-05: buildMixedSignalNote ─────────────────────────────────────────────

describe('TR-05: buildMixedSignalNote content', () => {
    test('note contains 混合信號 keyword', () => {
        const note = buildMixedSignalNote(FACTORS_00891_MIXED);
        expect(note).toContain('混合信號');
    });

    test('note contains MA mention', () => {
        const note = buildMixedSignalNote(FACTORS_00891_MIXED);
        expect(note).toContain('MA');
    });

    test('note contains MACD mention', () => {
        const note = buildMixedSignalNote(FACTORS_00891_MIXED);
        expect(note).toContain('MACD');
    });

    test('note does NOT contain buy/sell claims', () => {
        const note = buildMixedSignalNote(FACTORS_00891_MIXED);
        const forbidden = /(?<!淨)買入|(?<!淨)賣出|ROI|win.?rate|outperform|profit|guaranteed/i;
        expect(forbidden.test(note)).toBe(false);
    });

    test('returns empty string for empty factor array', () => {
        expect(buildMixedSignalNote([])).toBe('');
    });
});

// ─── TR-03: inferDirectionFromMATrend ─────────────────────────────────────────

describe('TR-03: inferDirectionFromMATrend', () => {
    test('returns 偏多 for MA 多頭排列', () => {
        const factors = ['MA 趨勢: 多頭排列 (MA20 > MA60)'];
        expect(inferDirectionFromMATrend(factors)).toBe('偏多');
    });

    test('returns 偏空 for MA 空頭排列', () => {
        const factors = ['MA 趨勢: 空頭排列 (MA20 < MA60)'];
        expect(inferDirectionFromMATrend(factors)).toBe('偏空');
    });

    test('returns 中性 when no MA 趨勢 factor', () => {
        expect(inferDirectionFromMATrend(['RSI(14): 50'])).toBe('中性');
    });

    test('returns 中性 for empty array', () => {
        expect(inferDirectionFromMATrend([])).toBe('中性');
    });
});

// ─── TR-01: renderReasonFromCorpusSnapshot — scoreSnapshot_zero_label fix ────

describe('TR-01: renderReasonFromCorpusSnapshot with real scoreSnapshot', () => {
    const snapshot1710 = {
        symbol: '1710',
        asOfDate: '2026-01-15',
        horizonDays: 20,
        researchBucket: 'Strong',
        alphaScore: 68,
        reasonSnapshot: '技術偏多',
        factorSnapshot: FACTORS_1710_BULLISH,
        scoreSnapshot: SCORE_SNAPSHOT_68,
        signalTags: [],
        usedSources: ['Technical', 'Chip'],
        missingSources: ['MonthlyRevenue'],
        completenessStatus: 'PARTIAL',
        stableHashKey: 'test-1710',
    } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];

    test('outcome is ENRICHED (not FALLBACK_EMPTY)', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        expect(result.outcome).toBe('ENRICHED');
    });

    test('renderedText contains 技術面偏多 with real techScore=68', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        // techScore=68 ≥ 65 → label '偏多'
        expect(result.renderedText).toContain('技術面偏多');
    });

    test('renderedText does NOT contain 技術面中性 (which would indicate zeros bug)', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        expect(result.renderedText).not.toContain('技術面中性');
    });

    test('alphaScore unchanged (always true for renderer)', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        expect(result.alphaScoreUnchanged).toBe(true);
    });

    test('bucketUnchanged (always true for renderer)', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        expect(result.bucketUnchanged).toBe(true);
    });

    test('rendererVersion is v2', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot1710);
        expect(result.rendererVersion).toBe('p26a-corpus-renderer-v2');
    });
});

// ─── Family 2: mixed_signals_no_template — 00891 ─────────────────────────────

describe('00891 mixed-signal rendering', () => {
    const snapshot00891 = {
        symbol: '00891',
        asOfDate: '2026-02-11',
        horizonDays: 20,
        researchBucket: 'Neutral',
        alphaScore: 63,
        reasonSnapshot: '技術偏多',
        factorSnapshot: FACTORS_00891_MIXED,
        scoreSnapshot: SCORE_SNAPSHOT_75,
        signalTags: [],
        usedSources: ['Technical', 'Chip'],
        missingSources: ['MonthlyRevenue'],
        completenessStatus: 'PARTIAL',
        stableHashKey: 'test-00891',
    } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];

    test('outcome is ENRICHED', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        expect(result.outcome).toBe('ENRICHED');
    });

    test('renderedText contains mixed-signal note', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        expect(result.renderedText).toContain('混合信號');
    });

    test('renderedText contains MA factor', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        expect(result.renderedText).toContain('MA');
    });

    test('renderedText contains MACD factor', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        expect(result.renderedText).toContain('MACD');
    });

    test('renderedText does NOT contain fabricated factors', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        const forbidden = /EPS|P\/E|dividend|insider|short.?squeeze|dark.?pool/i;
        expect(forbidden.test(result.renderedText)).toBe(false);
    });

    test('no forbidden buy/sell/ROI claims', () => {
        const result = renderReasonFromCorpusSnapshot(snapshot00891);
        const FORBIDDEN = /(?<!淨)買入|(?<!淨)賣出|ROI|win[- ]?rate|\balpha\b(?!Score)|profit|outperform|guaranteed/i;
        expect(FORBIDDEN.test(result.renderedText)).toBe(false);
    });
});

// ─── TR-01: WalkthroughCaseInput scoreSnapshot field ─────────────────────────

describe('TR-01: WalkthroughCaseInput.scoreSnapshot pass-through', () => {
    test('reviewCase uses real scoreSnapshot when provided', () => {
        const caseRow: WalkthroughCaseInput = {
            symbol: '1710',
            originalAsOfDate: '2026-01-15',
            horizonDays: 20,
            researchBucket: 'Strong',
            primaryScore: 68,
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_1710_BULLISH,
            usedSources: ['Technical', 'Chip'],
            missingSources: ['MonthlyRevenue'],
            scoringCompletenessStatus: 'PARTIAL',
            scoreSnapshot: SCORE_SNAPSHOT_68,
        };
        const result = reviewCase(caseRow, 9);
        // With real scoreSnapshot (techScore=68), should render 技術面偏多, not 技術面中性
        expect(result.renderedReason).toContain('技術面偏多');
    });

    test('reviewCase falls back to zeros when scoreSnapshot not provided', () => {
        // Without scoreSnapshot, techScore=0 → inferDirectionFromMATrend is used as fallback
        const caseRow: WalkthroughCaseInput = {
            symbol: '1710',
            originalAsOfDate: '2026-01-15',
            horizonDays: 20,
            researchBucket: 'Strong',
            primaryScore: 68,
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_1710_BULLISH,
            usedSources: [],
            missingSources: [],
            scoringCompletenessStatus: 'PARTIAL',
            // no scoreSnapshot — fallback triggers inferDirectionFromMATrend
        };
        const result = reviewCase(caseRow, 9);
        // inferDirectionFromMATrend sees MA 多頭排列 → '偏多' fallback label
        expect(result.renderedReason).toContain('偏多');
    });

    test('reasonRendererOutcome is ENRICHED for single-token reason with factors', () => {
        const caseRow: WalkthroughCaseInput = {
            symbol: '00891',
            originalAsOfDate: '2026-02-11',
            horizonDays: 20,
            researchBucket: 'Neutral',
            primaryScore: 63,
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_00891_MIXED,
            usedSources: ['Technical'],
            missingSources: ['MonthlyRevenue'],
            scoringCompletenessStatus: 'PARTIAL',
            scoreSnapshot: SCORE_SNAPSHOT_75,
        };
        const result = reviewCase(caseRow, 22);
        expect(result.reasonRendererOutcome).toBe('ENRICHED');
    });
});

// ─── TR-02: CorpusRowAdapter scoreSnapshot wiring ───────────────────────────

describe('TR-02: corpusRowToWalkthroughCaseInput passes scoreSnapshot', () => {
    const corpusRow: CorpusRow = {
        symbol: '1710',
        originalAsOfDate: '2026-01-15',
        researchBucket: 'Strong',
        outcomeSnapshot: { horizonDays: 20, returnPct: 3.2 },
        scoringCompletenessStatus: 'PARTIAL',
        activeScoringSnapshot: {
            alphaScore: 68,
            researchBucket: 'Strong',
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_1710_BULLISH,
            scoreSnapshot: SCORE_SNAPSHOT_68 as Record<string, number>,
            usedSources: ['Technical', 'Chip'],
            missingSources: ['MonthlyRevenue'],
        },
    };

    test('scoreSnapshot is passed through to WalkthroughCaseInput', () => {
        const caseInput = corpusRowToWalkthroughCaseInput(corpusRow);
        expect(caseInput.scoreSnapshot).toBeDefined();
        expect(caseInput.scoreSnapshot?.technicalScore).toBe(68);
    });

    test('factorSnapshot is still passed through', () => {
        const caseInput = corpusRowToWalkthroughCaseInput(corpusRow);
        expect(caseInput.factorSnapshot).toBeDefined();
        expect(caseInput.factorSnapshot?.length).toBeGreaterThan(0);
    });

    test('alphaScore passes through as primaryScore', () => {
        const caseInput = corpusRowToWalkthroughCaseInput(corpusRow);
        expect(caseInput.primaryScore).toBe(68);
    });
});

// ─── Frozen invariants ───────────────────────────────────────────────────────

describe('Frozen invariant — renderer never changes alphaScore or bucket', () => {
    const allSingleTokens = ['技術偏多', '技術偏空', '法人買超', '法人賣超', '動能轉強', '動能走弱'];

    for (const token of allSingleTokens) {
        test(`${token}: alphaScoreUnchanged=true`, () => {
            const snap = {
                symbol: 'TEST',
                asOfDate: '2026-01-01',
                horizonDays: 20,
                researchBucket: 'Neutral',
                alphaScore: 50,
                reasonSnapshot: token,
                factorSnapshot: FACTORS_00891_MIXED,
                scoreSnapshot: { technicalScore: 50, chipScore: 50, researchScore: 50, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
                signalTags: [],
                usedSources: [],
                missingSources: [],
                completenessStatus: 'PARTIAL',
                stableHashKey: 'test',
            } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];
            const r = renderReasonFromCorpusSnapshot(snap);
            expect(r.alphaScoreUnchanged).toBe(true);
            expect(r.bucketUnchanged).toBe(true);
        });
    }
});

// ─── Boundary: FALLBACK_EMPTY when no factors ────────────────────────────────

describe('Boundary: FALLBACK_EMPTY when factorSnapshot is empty', () => {
    test('returns FALLBACK_EMPTY when factorSnapshot is empty', () => {
        const snap = {
            symbol: 'NODATA',
            asOfDate: '2026-01-01',
            horizonDays: 20,
            researchBucket: 'Neutral',
            alphaScore: 50,
            reasonSnapshot: '技術偏多',
            factorSnapshot: [],
            scoreSnapshot: { technicalScore: 0, chipScore: 0, researchScore: 0, confidenceScore: 0, fundamentalScore: 0, marketAdjustment: 0 },
            signalTags: [],
            usedSources: [],
            missingSources: [],
            completenessStatus: 'EMPTY',
            stableHashKey: 'test-nodata',
        } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];
        const r = renderReasonFromCorpusSnapshot(snap);
        expect(r.outcome).toBe('FALLBACK_EMPTY');
    });
});

// ─── No forbidden claims in all rendered outputs ──────────────────────────────

describe('No forbidden claims in rendered outputs', () => {
    const FORBIDDEN_REGEX = /(?<!淨)買入|(?<!淨)賣出|ROI\b|win[- ]?rate|\balpha\b(?!Score)|profit\b|outperform|guaranteed|investment recommendation/i;

    test('1710 bullish case: no forbidden claims', () => {
        const snap = {
            symbol: '1710',
            asOfDate: '2026-01-15',
            horizonDays: 20,
            researchBucket: 'Strong',
            alphaScore: 68,
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_1710_BULLISH,
            scoreSnapshot: SCORE_SNAPSHOT_68,
            signalTags: [],
            usedSources: [],
            missingSources: [],
            completenessStatus: 'PARTIAL',
            stableHashKey: 'test',
        } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];
        const r = renderReasonFromCorpusSnapshot(snap);
        expect(FORBIDDEN_REGEX.test(r.renderedText)).toBe(false);
    });

    test('00891 mixed-signal case: no forbidden claims', () => {
        const snap = {
            symbol: '00891',
            asOfDate: '2026-02-11',
            horizonDays: 20,
            researchBucket: 'Neutral',
            alphaScore: 63,
            reasonSnapshot: '技術偏多',
            factorSnapshot: FACTORS_00891_MIXED,
            scoreSnapshot: SCORE_SNAPSHOT_75,
            signalTags: [],
            usedSources: [],
            missingSources: [],
            completenessStatus: 'PARTIAL',
            stableHashKey: 'test',
        } as Parameters<typeof renderReasonFromCorpusSnapshot>[0];
        const r = renderReasonFromCorpusSnapshot(snap);
        expect(FORBIDDEN_REGEX.test(r.renderedText)).toBe(false);
    });

    test('mixed signal note: no forbidden claims', () => {
        const note = buildMixedSignalNote(FACTORS_00891_MIXED);
        expect(FORBIDDEN_REGEX.test(note)).toBe(false);
    });
});
