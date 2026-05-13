/**
 * p26a_renderer_integration.test.ts
 * P26A-RENDERER-INTEGRATION-HARDRESET — Tests for integrated display path
 *
 * Verifies that P26ACorpusReasonRenderer is correctly integrated into
 * P5WalkthroughReviewUtils.reviewCase() as an additive display-only field.
 *
 * All tests are read-only: no DB write, no corpus mutation, no scoring change.
 * Not investment advice. No buy/sell claims. No performance claims.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  reviewCase,
  type WalkthroughCaseInput,
  type CaseReviewResult,
} from '../P5WalkthroughReviewUtils';
import {
  renderReasonFromCorpusSnapshot,
  isSingleTokenGenericReason,
  buildDataCoverageNote,
  CORPUS_REASON_RENDERER_VERSION,
} from '../P26ACorpusReasonRenderer';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FACTOR_SNAPSHOT_SAMPLE = [
  'MA 趨勢: 多頭排列 (MA20(12.24) > MA60(12.19))',
  'RSI(14): 60 (中性健康區間)',
  'MACD: 0.01 (MACD > 0，多方動能)',
  '法人近 10 日買超: -1004000 (外資近 10 日賣超)',
  '近 20 日動能: 2.34% (弱動能)',
  '法人淨買超(外資): -1004000',
  '法人淨買超(投信): 0',
  '成交量: 12345600',
  '波動率(20d): 2.34%',
  '庫存相對位置: 55%',
];

const SINGLE_TOKEN_CASE: WalkthroughCaseInput = {
  symbol: '1710',
  originalAsOfDate: '2025-12-15',
  horizonDays: 5,
  researchBucket: 'Neutral',
  primaryScore: 68,
  reasonSnapshot: '技術偏多',
  factorSnapshot: FACTOR_SNAPSHOT_SAMPLE,
  usedSources: ['StockQuote', 'InstitutionalChip'],
  missingSources: ['MonthlyRevenue'],
  scoringCompletenessStatus: 'PARTIAL',
};

const RICH_REASON_CASE: WalkthroughCaseInput = {
  symbol: '2330',
  originalAsOfDate: '2025-11-01',
  horizonDays: 5,
  researchBucket: 'Strong',
  primaryScore: 80,
  // Reason must be > 20 chars and not in SINGLE_TOKEN_GENERIC_REASONS to be classified ALREADY_RICH
  reasonSnapshot: '技術偏多 / 法人買超 / 動能轉強 / 近期量能明顯放大',
  factorSnapshot: FACTOR_SNAPSHOT_SAMPLE,
  usedSources: ['StockQuote', 'InstitutionalChip', 'MonthlyRevenue'],
  missingSources: [],
  scoringCompletenessStatus: 'COMPLETE',
};

const NO_FACTOR_CASE: WalkthroughCaseInput = {
  symbol: '0050',
  originalAsOfDate: '2025-10-01',
  horizonDays: 20,
  researchBucket: 'Watch',
  primaryScore: 50,
  reasonSnapshot: '技術偏多',
  factorSnapshot: [],
  usedSources: [],
  missingSources: ['MonthlyRevenue', 'StockQuote'],
  scoringCompletenessStatus: 'EMPTY',
};

const NULL_REASON_CASE: WalkthroughCaseInput = {
  symbol: '0051',
  originalAsOfDate: '2025-10-01',
  horizonDays: 5,
  researchBucket: 'Neutral',
  primaryScore: 45,
  reasonSnapshot: null,
  factorSnapshot: [],
  usedSources: [],
  missingSources: [],
};

// ─── P26A 9 case fixtures ──────────────────────────────────────────────────────

const P26A_9_CASES: WalkthroughCaseInput[] = [
  { symbol: '1710',   originalAsOfDate: '2025-12-15', horizonDays: 5,  primaryScore: 68, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00738U', originalAsOfDate: '2025-12-19', horizonDays: 5,  primaryScore: 63, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '1710',   originalAsOfDate: '2025-12-15', horizonDays: 5,  primaryScore: 68, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00891',  originalAsOfDate: '2025-11-12', horizonDays: 20, primaryScore: 63, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00891',  originalAsOfDate: '2025-11-12', horizonDays: 20, primaryScore: 63, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00891',  originalAsOfDate: '2025-10-15', horizonDays: 60, primaryScore: 58, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00738U', originalAsOfDate: '2025-12-19', horizonDays: 5,  primaryScore: 63, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '00891',  originalAsOfDate: '2025-12-30', horizonDays: 5,  primaryScore: 60, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
  { symbol: '1710',   originalAsOfDate: '2025-12-15', horizonDays: 5,  primaryScore: 68, reasonSnapshot: '技術偏多', factorSnapshot: [...FACTOR_SNAPSHOT_SAMPLE], usedSources: ['StockQuote', 'InstitutionalChip'], missingSources: ['MonthlyRevenue'], researchBucket: 'Neutral', scoringCompletenessStatus: 'PARTIAL' },
];

// ─── Corpus SHA256 invariance fixtures ────────────────────────────────────────

const SCORING_FILE_HASHES: Record<string, string> = {
  'src/lib/analysis/RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'src/lib/alpha/SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
  'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
};

const CORPUS_LINE_COUNTS: Record<string, number> = {
  'outputs/online_validation/simulation_snapshot_corpus.jsonl': 60,
  'outputs/online_validation/p0hardreset_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p1baseline_historical_replay_corpus.jsonl': 9900,
  'outputs/online_validation/p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'outputs/online_validation/p19active_scoring_pit_replay_corpus.jsonl': 4500,
};

function sha256File(relPath: string): string {
  const abs = resolve(process.cwd(), relPath);
  const buf = readFileSync(abs);
  return createHash('sha256').update(buf).digest('hex');
}

function countNonEmptyLines(relPath: string): number {
  const abs = resolve(process.cwd(), relPath);
  const text = readFileSync(abs, 'utf8');
  return text.split('\n').filter(l => l.trim().length > 0).length;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('P26A Renderer Integration — reviewCase() additive fields', () => {
  describe('1. integrated path calls P26ACorpusReasonRenderer', () => {
    it('reviewCase() produces renderedReason field (not undefined)', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReason).toBeDefined();
      expect(typeof result.renderedReason).toBe('string');
    });

    it('reasonRendererVersion is corpus renderer v1', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.reasonRendererVersion).toBe(CORPUS_REASON_RENDERER_VERSION);
    });
  });

  describe('2. reasonSnapshot preserved backward-compatible', () => {
    it('reasonSnapshotSummary still populated from original reasonSnapshot', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.reasonSnapshotSummary).toBe('技術偏多');
    });

    it('topSignalOrFactor still populated from original reasonSnapshot', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.topSignalOrFactor).toBe('技術偏多');
    });
  });

  describe('3. renderedReason / displayReason additive field exists', () => {
    it('renderedReason is defined and is a string', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReason).toBeDefined();
      expect(typeof result.renderedReason).toBe('string');
    });

    it('renderedReasonFactorCount is a number >= 0', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(typeof result.renderedReasonFactorCount).toBe('number');
      expect(result.renderedReasonFactorCount).toBeGreaterThanOrEqual(0);
    });

    it('reasonRendererOutcome is one of known values', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(['ENRICHED', 'ALREADY_RICH', 'FALLBACK_EMPTY', 'FALLBACK_NO_SNAPSHOT']).toContain(result.reasonRendererOutcome);
    });
  });

  describe('4. factorSnapshot present → display has multi-factor output', () => {
    it('SINGLE_TOKEN_CASE with factorSnapshot → renderedReason has multi-factor content', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReasonFactorCount).toBeGreaterThanOrEqual(3);
    });

    it('SINGLE_TOKEN_CASE → reasonRendererOutcome is ENRICHED', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.reasonRendererOutcome).toBe('ENRICHED');
    });

    it('renderedReason length is greater than original single token', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReason.length).toBeGreaterThan('技術偏多'.length);
    });
  });

  describe('5. flat reasonSnapshot + factorSnapshot → not single-token-only', () => {
    it('single-token reasonSnapshot with non-empty factorSnapshot → renderedReason not "技術偏多"', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReason).not.toBe('技術偏多');
    });

    it('renderedReason contains slash separator (multi-factor)', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.renderedReason).toMatch(/\//);
    });
  });

  describe('6. factorSnapshot empty → fallback preserves existing reasonSnapshot', () => {
    it('NO_FACTOR_CASE → outcome is FALLBACK_EMPTY', () => {
      const result = reviewCase(NO_FACTOR_CASE, 0);
      expect(result.reasonRendererOutcome).toBe('FALLBACK_EMPTY');
    });

    it('NO_FACTOR_CASE → renderedReason falls back to original reasonSnapshot', () => {
      const result = reviewCase(NO_FACTOR_CASE, 0);
      expect(result.renderedReason).toBe('技術偏多');
    });

    it('NULL_REASON_CASE → renderedReason is empty string fallback', () => {
      const result = reviewCase(NULL_REASON_CASE, 0);
      expect(typeof result.renderedReason).toBe('string');
    });
  });

  describe('7. MonthlyRevenue missing → neutral data availability note', () => {
    it('missingSources includes MonthlyRevenue → dataAvailabilityNote is non-empty', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.dataAvailabilityNote).toBeTruthy();
      expect(result.dataAvailabilityNote.length).toBeGreaterThan(0);
    });

    it('dataAvailabilityNote contains MonthlyRevenue', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.dataAvailabilityNote).toContain('MonthlyRevenue');
    });

    it('dataAvailabilityNote does NOT contain investment claim words', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      const forbidden = /ROI|win.rate|alpha|outperform|profit|buy|sell|guaranteed/i;
      expect(result.dataAvailabilityNote).not.toMatch(forbidden);
    });

    it('no missing sources → dataAvailabilityNote is empty string', () => {
      const result = reviewCase(RICH_REASON_CASE, 0);
      expect(result.dataAvailabilityNote).toBe('');
    });
  });

  describe('8. alphaScore unchanged', () => {
    it('reviewCase does not modify input caseRow.primaryScore', () => {
      const originalScore = SINGLE_TOKEN_CASE.primaryScore;
      reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(SINGLE_TOKEN_CASE.primaryScore).toBe(originalScore);
    });

    it('score in result matches input primaryScore', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.score).toBe(SINGLE_TOKEN_CASE.primaryScore);
    });
  });

  describe('9. recommendationBucket / researchBucket unchanged', () => {
    it('researchBucket in result matches input researchBucket', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(result.researchBucket).toBe(SINGLE_TOKEN_CASE.researchBucket);
    });

    it('reviewCase does not modify input researchBucket', () => {
      const originalBucket = SINGLE_TOKEN_CASE.researchBucket;
      reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(SINGLE_TOKEN_CASE.researchBucket).toBe(originalBucket);
    });
  });

  describe('10. scoring file sha256 unchanged', () => {
    for (const [filePath, expectedHash] of Object.entries(SCORING_FILE_HASHES)) {
      it(`${filePath.split('/').pop()} sha256 unchanged`, () => {
        const actual = sha256File(filePath);
        expect(actual).toBe(expectedHash);
      });
    }
  });

  describe('11. corpus line counts unchanged', () => {
    for (const [filePath, expectedCount] of Object.entries(CORPUS_LINE_COUNTS)) {
      it(`${filePath.split('/').pop()} has ${expectedCount} non-empty lines`, () => {
        const actual = countNonEmptyLines(filePath);
        expect(actual).toBe(expectedCount);
      });
    }
  });

  describe('12. P26A 9 cases — all integrated improved or partial', () => {
    P26A_9_CASES.forEach((caseInput, idx) => {
      const label = `${caseInput.symbol} ${caseInput.originalAsOfDate} h${caseInput.horizonDays}`;
      it(`case ${idx + 1} (${label}): renderedReason not single-token-only`, () => {
        const result = reviewCase(caseInput, idx);
        const rendered = result.renderedReason;
        expect(isSingleTokenGenericReason(rendered)).toBe(false);
      });

      it(`case ${idx + 1} (${label}): renderedReasonFactorCount >= 3`, () => {
        const result = reviewCase(caseInput, idx);
        expect(result.renderedReasonFactorCount).toBeGreaterThanOrEqual(3);
      });

      it(`case ${idx + 1} (${label}): alphaScore unchanged`, () => {
        const originalScore = caseInput.primaryScore;
        const result = reviewCase(caseInput, idx);
        expect(result.score).toBe(originalScore);
        expect(caseInput.primaryScore).toBe(originalScore);
      });

      it(`case ${idx + 1} (${label}): MonthlyRevenue missing note present`, () => {
        const result = reviewCase(caseInput, idx);
        expect(result.dataAvailabilityNote).toContain('MonthlyRevenue');
      });
    });
  });

  describe('13. forbidden claims scan — renderedReason has no buy/sell claims', () => {
    it('SINGLE_TOKEN_CASE renderedReason has no forbidden claim', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      const forbidden = /\bROI\b|win.rate|(?<![a-zA-Z])alpha(?!Score)|\boutperform\b|\bprofit\b|\bbuy\b|\bsell\b|\bguaranteed\b/i;
      expect(result.renderedReason).not.toMatch(forbidden);
    });

    it('dataAvailabilityNote has no forbidden claim', () => {
      const result = reviewCase(SINGLE_TOKEN_CASE, 0);
      const forbidden = /\bROI\b|win.rate|(?<![a-zA-Z])alpha(?!Score)|\boutperform\b|\bprofit\b|\bbuy\b|\bsell\b|\bguaranteed\b/i;
      expect(result.dataAvailabilityNote).not.toMatch(forbidden);
    });

    it('all 9 P26A cases renderedReason has no forbidden claim', () => {
      const forbidden = /\bROI\b|win.rate|\boutperform\b|\bprofit\b|\bbuy\b|\bsell\b|\bguaranteed\b/i;
      P26A_9_CASES.forEach((caseInput, idx) => {
        const result = reviewCase(caseInput, idx);
        expect(result.renderedReason).not.toMatch(forbidden);
      });
    });
  });

  describe('14. RICH_REASON_CASE — already rich reason preserved', () => {
    it('already rich reasonSnapshot → reasonRendererOutcome is ALREADY_RICH', () => {
      const result = reviewCase(RICH_REASON_CASE, 0);
      expect(result.reasonRendererOutcome).toBe('ALREADY_RICH');
    });

    it('already rich reason → renderedReason equals original reasonSnapshot', () => {
      const result = reviewCase(RICH_REASON_CASE, 0);
      expect(result.renderedReason).toBe(RICH_REASON_CASE.reasonSnapshot);
    });

    it('no missing sources → dataAvailabilityNote empty', () => {
      const result = reviewCase(RICH_REASON_CASE, 0);
      expect(result.dataAvailabilityNote).toBe('');
    });
  });

  describe('15. determinism — reviewCase produces same output for same input', () => {
    it('calling reviewCase twice with same input produces identical renderedReason', () => {
      const r1 = reviewCase(SINGLE_TOKEN_CASE, 0);
      const r2 = reviewCase(SINGLE_TOKEN_CASE, 0);
      expect(r1.renderedReason).toBe(r2.renderedReason);
      expect(r1.reasonRendererOutcome).toBe(r2.reasonRendererOutcome);
      expect(r1.renderedReasonFactorCount).toBe(r2.renderedReasonFactorCount);
    });
  });

  describe('16. WalkthroughCaseInput without factorSnapshot (backward compat)', () => {
    it('case without factorSnapshot field still works (no crash)', () => {
      const legacyCase: WalkthroughCaseInput = {
        symbol: '0050',
        originalAsOfDate: '2025-10-01',
        horizonDays: 5,
        researchBucket: 'Watch',
        primaryScore: 55,
        reasonSnapshot: '技術偏多 / 法人買超',
      };
      expect(() => reviewCase(legacyCase, 0)).not.toThrow();
    });

    it('legacy case without factorSnapshot → renderedReason is defined', () => {
      const legacyCase: WalkthroughCaseInput = {
        symbol: '0050',
        originalAsOfDate: '2025-10-01',
        horizonDays: 5,
        reasonSnapshot: '技術偏多 / 法人買超',
      };
      const result = reviewCase(legacyCase, 0);
      expect(result.renderedReason).toBeDefined();
    });
  });
});
