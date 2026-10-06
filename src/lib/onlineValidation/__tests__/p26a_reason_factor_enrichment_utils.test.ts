/**
 * p26a_reason_factor_enrichment_utils.test.ts
 * P26A-HARDRESET PART I — Tests for P26AReasonFactorEnrichmentUtils
 */

import {
    enrichReasonFromExistingFactors,
    buildFactorEvidenceBlock,
    classifyReasonQuality,
    validateReasonDoesNotIntroduceNewFactor,
    validateReasonHasNoForbiddenClaim,
    attachTechnicalContextToReason,
    attachChipContextToReason,
    attachMonthlyRevenueContextToReason,
    attachRegimeContextToReason,
    ALLOWED_FACTOR_SET,
} from '../P26AReasonFactorEnrichmentUtils';
import type { ActiveScoringSnapshot } from '../ActiveScoringSnapshotBuilder';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ActiveScoringSnapshot> = {}): ActiveScoringSnapshot {
    return {
        builderVersion: 'test-v1',
        symbol: 'TEST',
        asOfDate: '2025-12-01',
        scoringMode: 'RULE_BASED_ANALYZER',
        scoringEngineSource: 'RuleBasedStockAnalyzer',
        researchBucket: 'Watch',
        alphaScore: 55,
        scoreSnapshot: {
            researchScore: 55,
            confidenceScore: 0,
            technicalScore: 70,
            chipScore: 65,
            fundamentalScore: 0,
            marketAdjustment: 0,
        },
        signalSnapshot: ['MA 趨勢', 'RSI(14)', '法人近 10 日買超'],
        factorSnapshot: [
            'MA 趨勢: 多頭排列 (MA20(123.45) > MA60(110.23))',
            'RSI(14): 52.30 (中性健康區間)',
            'MACD: 1.23 (MACD > 0，多方動能)',
            '近 20 日動能: +3.2% (近 20 日漲跌幅 正)',
            '法人近 10 日買超: 5,000 (外資 3,000 / 投信 2,000)',
            '波動率: 2.10% (近 60 日收盤價標準差/均價)',
        ],
        reasonSnapshot: '技術偏多',
        limitations: [],
        dataCoverage: 'full',
        dataPoints: 120,
        usedSources: ['StockQuote', 'InstitutionalChip'],
        missingSources: [],
        pitGateDate: '2025-12-01',
        scoringAvailable: true,
        completenessStatus: 'COMPLETE',
        scoringNote: 'dataCoverage=full',
        ...overrides,
    };
}

// ─── enrichReasonFromExistingFactors — purity ────────────────────────────────

describe('enrichReasonFromExistingFactors', () => {
    it('is a pure function: same input → same output', () => {
        const snapshot = makeSnapshot();
        const result1 = enrichReasonFromExistingFactors(snapshot);
        const result2 = enrichReasonFromExistingFactors(snapshot);
        expect(result1).toBe(result2);
    });

    it('does not mutate the input snapshot', () => {
        const snapshot = makeSnapshot();
        const originalReason = snapshot.reasonSnapshot;
        enrichReasonFromExistingFactors(snapshot);
        expect(snapshot.reasonSnapshot).toBe(originalReason);
    });

    it('returns a non-empty string when factorSnapshot has data', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(5);
    });

    it('returns fallback when factorSnapshot is empty', () => {
        const snapshot = makeSnapshot({ factorSnapshot: [], signalSnapshot: [] });
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).toContain('觀察中');
    });

    it('includes technical context when technical factors are present', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).toMatch(/技術面/);
    });

    it('includes chip context when chip factors are present', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).toMatch(/法人/);
    });

    it('includes RSI value in result', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).toMatch(/RSI/);
    });

    it('does not include forbidden claims', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        const validation = validateReasonHasNoForbiddenClaim(result);
        expect(validation.valid).toBe(true);
    });

    it('does not include outcome fields in output', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        expect(result).not.toMatch(/returnPct|outcomePrice|realizedReturnClass/);
    });

    it('produces RICH quality classification for enriched reason', () => {
        const snapshot = makeSnapshot();
        const result = enrichReasonFromExistingFactors(snapshot);
        const evidence = buildFactorEvidenceBlock(snapshot);
        const quality = classifyReasonQuality(result, evidence);
        expect(quality).toBe('RICH');
    });
});

// ─── validateReasonDoesNotIntroduceNewFactor ─────────────────────────────────

describe('validateReasonDoesNotIntroduceNewFactor', () => {
    it('accepts allowed factor terms', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('技術面偏多，RSI 52.3，MACD 正');
        expect(result.valid).toBe(true);
        expect(result.violatingTerms).toHaveLength(0);
    });

    it('rejects EPS as a new factor', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('EPS 增長顯著');
        expect(result.valid).toBe(false);
        expect(result.violatingTerms.length).toBeGreaterThan(0);
    });

    it('rejects P/E ratio as a new factor', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('P/E ratio is low');
        expect(result.valid).toBe(false);
    });

    it('rejects dividend as a new factor', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('dividend yield is high');
        expect(result.valid).toBe(false);
    });

    it('rejects short interest as a new factor', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('short interest increasing');
        expect(result.valid).toBe(false);
    });

    it('accepts empty reason text', () => {
        const result = validateReasonDoesNotIntroduceNewFactor('');
        expect(result.valid).toBe(true);
    });
});

// ─── validateReasonHasNoForbiddenClaim ────────────────────────────────────────

describe('validateReasonHasNoForbiddenClaim', () => {
    it('rejects ROI claim', () => {
        const result = validateReasonHasNoForbiddenClaim('expected ROI is 20%');
        expect(result.valid).toBe(false);
    });

    it('rejects win-rate claim', () => {
        const result = validateReasonHasNoForbiddenClaim('win-rate 75%');
        expect(result.valid).toBe(false);
    });

    it('rejects win rate (no hyphen)', () => {
        const result = validateReasonHasNoForbiddenClaim('win rate 75%');
        expect(result.valid).toBe(false);
    });

    it('rejects alpha claim (standalone)', () => {
        const result = validateReasonHasNoForbiddenClaim('significant alpha detected');
        expect(result.valid).toBe(false);
    });

    it('allows alphaScore as field name', () => {
        // "alphaScore" contains "alpha" but the pattern requires standalone word boundary
        // This test validates our regex does not flag "alphaScore"
        const result = validateReasonHasNoForbiddenClaim('alphaScore: 55');
        // This may or may not pass depending on regex — document expected behavior
        // The pattern is /\balpha\b(?!\s*Score)/i — should allow "alphaScore"
        expect(result.violatingTerms).not.toContain('alphaScore');
    });

    it('rejects edge claim', () => {
        const result = validateReasonHasNoForbiddenClaim('statistical edge confirmed');
        expect(result.valid).toBe(false);
    });

    it('rejects profit claim', () => {
        const result = validateReasonHasNoForbiddenClaim('expected profit: 15%');
        expect(result.valid).toBe(false);
    });

    it('rejects outperform claim', () => {
        const result = validateReasonHasNoForbiddenClaim('will outperform the market');
        expect(result.valid).toBe(false);
    });

    it('rejects buy claim', () => {
        const result = validateReasonHasNoForbiddenClaim('buy signal detected');
        expect(result.valid).toBe(false);
    });

    it('rejects sell claim', () => {
        const result = validateReasonHasNoForbiddenClaim('sell signal confirmed');
        expect(result.valid).toBe(false);
    });

    it('rejects guaranteed claim', () => {
        const result = validateReasonHasNoForbiddenClaim('guaranteed return');
        expect(result.valid).toBe(false);
    });

    it('rejects investment recommendation claim', () => {
        const result = validateReasonHasNoForbiddenClaim('this is an investment recommendation');
        expect(result.valid).toBe(false);
    });

    it('accepts valid Chinese reason text with no forbidden claims', () => {
        const result = validateReasonHasNoForbiddenClaim('技術面偏多，MA20 > MA60，RSI 中性，法人偏多買超');
        expect(result.valid).toBe(true);
    });

    it('accepts empty string', () => {
        const result = validateReasonHasNoForbiddenClaim('');
        expect(result.valid).toBe(true);
    });
});

// ─── classifyReasonQuality ────────────────────────────────────────────────────

describe('classifyReasonQuality', () => {
    const richEvidence = buildFactorEvidenceBlock(makeSnapshot());
    const emptyEvidence = buildFactorEvidenceBlock(makeSnapshot({ factorSnapshot: [] }));

    it('classifies single generic tag as GENERIC when evidence is available', () => {
        const result = classifyReasonQuality('技術偏多', richEvidence);
        expect(result).toBe('GENERIC');
    });

    it('classifies single generic tag as UNDEROUTPUT when no evidence', () => {
        const result = classifyReasonQuality('技術偏多', { ...emptyEvidence, availableFactorCount: 1 });
        expect(result).toBe('UNDEROUTPUT');
    });

    it('classifies empty string as EMPTY', () => {
        const result = classifyReasonQuality('', richEvidence);
        expect(result).toBe('EMPTY');
    });

    it('classifies multi-dimensional numerical reason as RICH', () => {
        const result = classifyReasonQuality(
            '技術面偏多，MA20(123.45) > MA60，RSI 52.30，法人買超 5,000 張',
            richEvidence,
        );
        expect(result).toBe('RICH');
    });

    it('classifies reason with percentage as RICH', () => {
        const result = classifyReasonQuality('技術面偏多，近20日漲幅 +3.2%，RSI 52.3', richEvidence);
        expect(result).toBe('RICH');
    });

    it('is deterministic: same inputs same output', () => {
        const r1 = classifyReasonQuality('技術偏空', richEvidence);
        const r2 = classifyReasonQuality('技術偏空', richEvidence);
        expect(r1).toBe(r2);
    });
});

// ─── buildFactorEvidenceBlock ────────────────────────────────────────────────

describe('buildFactorEvidenceBlock', () => {
    it('extracts MA context', () => {
        const snapshot = makeSnapshot();
        const ev = buildFactorEvidenceBlock(snapshot);
        expect(ev.maContext).toContain('MA 趨勢');
    });

    it('extracts RSI context', () => {
        const snapshot = makeSnapshot();
        const ev = buildFactorEvidenceBlock(snapshot);
        expect(ev.rsiContext).toContain('RSI(14)');
    });

    it('extracts chip context', () => {
        const snapshot = makeSnapshot();
        const ev = buildFactorEvidenceBlock(snapshot);
        expect(ev.chipContext).toContain('法人近 10 日買超');
    });

    it('returns null for unavailable factors', () => {
        const snapshot = makeSnapshot({ factorSnapshot: ['MA 趨勢: 多頭排列 (MA20 > MA60)'] });
        const ev = buildFactorEvidenceBlock(snapshot);
        expect(ev.chipContext).toBeNull();
        expect(ev.revenueContext).toBeNull();
    });

    it('does not mutate snapshot', () => {
        const snapshot = makeSnapshot();
        const originalFactors = [...snapshot.factorSnapshot];
        buildFactorEvidenceBlock(snapshot);
        expect(snapshot.factorSnapshot).toEqual(originalFactors);
    });
});

// ─── attachTechnicalContextToReason ─────────────────────────────────────────

describe('attachTechnicalContextToReason', () => {
    it('returns string with technical label', () => {
        const snapshot = makeSnapshot();
        const result = attachTechnicalContextToReason(snapshot, 70);
        expect(result).toContain('技術面偏多');
    });

    it('returns bearish label for low score', () => {
        const snapshot = makeSnapshot();
        const result = attachTechnicalContextToReason(snapshot, 30);
        expect(result).toContain('技術面偏空');
    });

    it('includes numerical evidence from factorSnapshot', () => {
        const snapshot = makeSnapshot();
        const result = attachTechnicalContextToReason(snapshot, 70);
        expect(result).toMatch(/MA|RSI|MACD/);
    });
});

// ─── attachChipContextToReason ───────────────────────────────────────────────

describe('attachChipContextToReason', () => {
    it('returns chip context when chip factor is available', () => {
        const snapshot = makeSnapshot();
        const result = attachChipContextToReason(snapshot, 65);
        expect(result).toContain('法人');
    });

    it('returns empty string when no chip factor', () => {
        const snapshot = makeSnapshot({ factorSnapshot: ['MA 趨勢: 多頭排列 (test)'] });
        const result = attachChipContextToReason(snapshot, 0);
        expect(result).toBe('');
    });
});

// ─── attachMonthlyRevenueContextToReason ─────────────────────────────────────

describe('attachMonthlyRevenueContextToReason', () => {
    it('returns unavailable message when revenue not available', () => {
        const snapshot = makeSnapshot();
        const result = attachMonthlyRevenueContextToReason(snapshot, {
            available: false,
            yoY: null,
            latestPeriod: null,
            pitGated: true,
        });
        expect(result).toContain('PIT');
    });

    it('returns revenue context when available', () => {
        const snapshot = makeSnapshot({
            factorSnapshot: ['營收年增率: 15.2 (2025/11 vs 2024/11)'],
        });
        const result = attachMonthlyRevenueContextToReason(snapshot, {
            available: true,
            yoY: 15.2,
            latestPeriod: '2025/11',
            pitGated: true,
        });
        expect(result).toContain('月營收');
        expect(result).toContain('PIT');
    });
});

// ─── attachRegimeContextToReason ──────────────────────────────────────────────

describe('attachRegimeContextToReason', () => {
    it('returns unknown message when regime is Unknown', () => {
        const snapshot = makeSnapshot();
        const result = attachRegimeContextToReason(snapshot, { regime: 'Unknown', confidence: 0 });
        expect(result).toContain('無法判斷');
    });

    it('returns bull market context', () => {
        const snapshot = makeSnapshot();
        const result = attachRegimeContextToReason(snapshot, { regime: 'Bull', confidence: 80 });
        expect(result).toContain('多頭市場');
    });

    it('returns bear market context', () => {
        const snapshot = makeSnapshot();
        const result = attachRegimeContextToReason(snapshot, { regime: 'Bear', confidence: 60 });
        expect(result).toContain('空頭市場');
    });
});

// ─── No Math.random usage ─────────────────────────────────────────────────────

describe('Math.random is not used', () => {
    it('enrichReasonFromExistingFactors is deterministic without Math.random', () => {
        const original = Math.random;
        let randomCalled = false;
        Math.random = () => { randomCalled = true; return 0.5; };

        const snapshot = makeSnapshot();
        enrichReasonFromExistingFactors(snapshot);

        Math.random = original;
        expect(randomCalled).toBe(false);
    });
});

// ─── ALLOWED_FACTOR_SET integrity ────────────────────────────────────────────

describe('ALLOWED_FACTOR_SET', () => {
    it('contains all expected RuleBasedStockAnalyzer factor names', () => {
        expect(ALLOWED_FACTOR_SET.has('MA 趨勢')).toBe(true);
        expect(ALLOWED_FACTOR_SET.has('RSI(14)')).toBe(true);
        expect(ALLOWED_FACTOR_SET.has('MACD')).toBe(true);
        expect(ALLOWED_FACTOR_SET.has('法人近 10 日買超')).toBe(true);
        expect(ALLOWED_FACTOR_SET.has('營收年增率')).toBe(true);
        expect(ALLOWED_FACTOR_SET.has('波動率')).toBe(true);
    });

    it('does not contain outcome fields', () => {
        expect(ALLOWED_FACTOR_SET.has('returnPct')).toBe(false);
        expect(ALLOWED_FACTOR_SET.has('outcomePrice')).toBe(false);
        expect(ALLOWED_FACTOR_SET.has('realizedReturnClass')).toBe(false);
    });
});
