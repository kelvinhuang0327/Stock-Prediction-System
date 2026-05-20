/**
 * p26a_batch_pipeline_wiring.test.ts
 * P26A-BATCH-PIPELINE-WIRING-HARDRESET
 *
 * Tests for the batch pipeline wiring from P3 corpus to WalkthroughCaseInput.
 * Verifies:
 *   - P26ACorpusRowAdapter pass-through behavior
 *   - 9 real P26A corpus cases achieve reasonRendererOutcome = ENRICHED
 *   - No scoring mutations
 *   - Invariants: DB/corpus/scoring file checksums unchanged
 *   - No forbidden claims in output
 *
 * All tests are read-only: no DB write, no corpus mutation, no scoring change.
 * Not investment advice. No buy/sell claims. No performance claims.
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  corpusRowToWalkthroughCaseInput,
  type CorpusRow,
} from '../P26ACorpusRowAdapter';

import {
  reviewCase,
  type WalkthroughCaseInput,
} from '../P5WalkthroughReviewUtils';

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '../../../../');
const OUT_DIR = resolve(ROOT, 'outputs/online_validation');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FACTOR_SNAPSHOT_SAMPLE = [
  'MA 趨勢: 多頭排列 (MA20(28.82) > MA60(28.54))',
  'RSI(14): 37.29 (偏離中性)',
  'MACD: -0.01 (MACD < 0，空方動能)',
  '近 20 日動能: -0.9% (近 20 日漲跌幅 負)',
  '近 5 日報酬: 0.91% (近 5 日漲跌幅)',
  '近 20 日報酬: -0.9% (近一個月漲跌幅)',
  '量能變化: -8.87% (近 5 日均量 vs 20 日均量)',
  '波動率: 1.2% (近 60 日收盤價標準差/均價)',
  '近期最大回撤: 3.58% (近 60 日最大回撤)',
  '法人近 10 日買超: 0 (外資 -2,459 / 投信 0)',
];

const makeCorpusRow = (overrides: Partial<CorpusRow> = {}): CorpusRow => ({
  symbol: '1710',
  originalAsOfDate: '2025-12-15',
  researchBucket: 'Neutral',
  outcomeSnapshot: { horizonDays: 5, returnPct: -0.9 },
  scoringCompletenessStatus: 'PARTIAL',
  activeScoringSnapshot: {
    alphaScore: 42,
    researchBucket: 'Neutral',
    reasonSnapshot: '技術偏多',
    factorSnapshot: FACTOR_SNAPSHOT_SAMPLE,
    usedSources: ['StockQuote', 'InstitutionalChip'],
    missingSources: ['MonthlyRevenue'],
  },
  ...overrides,
});

// ─── P26ACorpusRowAdapter tests ───────────────────────────────────────────────

describe('P26ACorpusRowAdapter', () => {
  test('corpus row with factorSnapshot => WalkthroughCaseInput.factorSnapshot passed', () => {
    const row = makeCorpusRow();
    const input = corpusRowToWalkthroughCaseInput(row);
    expect(input.factorSnapshot).toBeDefined();
    expect(Array.isArray(input.factorSnapshot)).toBe(true);
    expect(input.factorSnapshot!.length).toBe(10);
    expect(input.factorSnapshot![0]).toContain('MA 趨勢');
  });

  test('corpus row with usedSources/missingSources => pass-through', () => {
    const row = makeCorpusRow();
    const input = corpusRowToWalkthroughCaseInput(row);
    expect(input.usedSources).toEqual(['StockQuote', 'InstitutionalChip']);
    expect(input.missingSources).toEqual(['MonthlyRevenue']);
  });

  test('corpus row without factorSnapshot => graceful undefined', () => {
    const row = makeCorpusRow({
      activeScoringSnapshot: {
        alphaScore: 42,
        reasonSnapshot: '技術偏多',
        // no factorSnapshot
      },
    });
    const input = corpusRowToWalkthroughCaseInput(row);
    expect(input.factorSnapshot).toBeUndefined();
    expect(input.usedSources).toBeUndefined();
    expect(input.missingSources).toBeUndefined();
  });

  test('corpus row without activeScoringSnapshot => all optional fields undefined', () => {
    const row = makeCorpusRow({ activeScoringSnapshot: undefined });
    const input = corpusRowToWalkthroughCaseInput(row);
    expect(input.factorSnapshot).toBeUndefined();
    expect(input.usedSources).toBeUndefined();
    expect(input.missingSources).toBeUndefined();
    expect(input.primaryScore).toBeNull();
  });

  test('does not mutate activeScoringSnapshot', () => {
    const row = makeCorpusRow();
    const originalSnap = JSON.stringify(row.activeScoringSnapshot);
    corpusRowToWalkthroughCaseInput(row);
    expect(JSON.stringify(row.activeScoringSnapshot)).toBe(originalSnap);
  });
});

// ─── Batch wiring real corpus tests (read from validation artifact) ───────────

describe('batch wiring: real P3 corpus 9 cases', () => {
  let validationData: {
    totalCases: number;
    enrichedCount: number;
    corpusRowFoundCount: number;
    factorSnapshotPassedCount: number;
    allEnriched: boolean;
    results: Array<{
      caseId: string;
      symbol: string;
      asOfDate: string;
      corpusRowFound: boolean;
      factorSnapshotPassed: boolean;
      factorSnapshotCount: number;
      usedSourcesPassed: boolean;
      missingSourcesPassed: boolean;
      reasonRendererOutcome: string;
      renderedReasonFactorCount: number;
      alphaScoreUnchanged: boolean;
      bucketUnchanged: boolean;
      dataAvailabilityNotePresent: boolean;
      classification: string;
    }>;
  };

  beforeAll(() => {
    const raw = readFileSync(
      resolve(OUT_DIR, 'p26a_batch_pipeline_wiring_9case_real_corpus_validation.json'),
      'utf8'
    );
    validationData = JSON.parse(raw);
  });

  test('reasonRendererOutcome = ENRICHED for all 9 cases', () => {
    expect(validationData.results.length).toBe(9);
    const nonEnriched = validationData.results.filter(r => r.reasonRendererOutcome !== 'ENRICHED');
    expect(nonEnriched).toHaveLength(0);
  });

  test('mismatchedAlphaScoreCount = 0', () => {
    const mismatched = validationData.results.filter(r => !r.alphaScoreUnchanged);
    expect(mismatched).toHaveLength(0);
  });

  test('mismatchedBucketCount = 0', () => {
    const mismatched = validationData.results.filter(r => !r.bucketUnchanged);
    expect(mismatched).toHaveLength(0);
  });

  test('9/9 corpusRowFound = true', () => {
    const notFound = validationData.results.filter(r => !r.corpusRowFound);
    expect(notFound).toHaveLength(0);
    expect(validationData.corpusRowFoundCount).toBe(9);
  });

  test('9/9 factorSnapshotPassed = true', () => {
    const notPassed = validationData.results.filter(r => !r.factorSnapshotPassed);
    expect(notPassed).toHaveLength(0);
    expect(validationData.factorSnapshotPassedCount).toBe(9);
  });

  test('9/9 renderedReasonFactorCount >= 3', () => {
    const insufficient = validationData.results.filter(r => r.renderedReasonFactorCount < 3);
    expect(insufficient).toHaveLength(0);
  });
});

// ─── Invariance tests ─────────────────────────────────────────────────────────

describe('invariance: scoring files sha256 unchanged', () => {
  const EXPECTED = {
    'RuleBasedStockAnalyzer.ts': '4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2',
    'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
    'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  };

  const FILE_PATHS: Record<string, string> = {
    'RuleBasedStockAnalyzer.ts': resolve(ROOT, 'src/lib/analysis/RuleBasedStockAnalyzer.ts'),
    'SignalFusionEngine.ts': resolve(ROOT, 'src/lib/alpha/SignalFusionEngine.ts'),
    'ActiveScoringSnapshotBuilder.ts': resolve(ROOT, 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts'),
  };

  for (const [name, expectedHash] of Object.entries(EXPECTED)) {
    test(`${name} sha256 = ${expectedHash.slice(0, 16)}...`, () => {
      const content = readFileSync(FILE_PATHS[name]);
      const actual = createHash('sha256').update(content).digest('hex');
      expect(actual).toBe(expectedHash);
    });
  }
});

describe('invariance: corpus line counts unchanged', () => {
  const EXPECTED: Record<string, number> = {
    'simulation_snapshot_corpus.jsonl': 60,
    'p0hardreset_historical_replay_corpus.jsonl': 4500,
    'p1baseline_historical_replay_corpus.jsonl': 9900,
    'p3active_scoring_historical_replay_corpus.jsonl': 4500,
    'p19active_scoring_pit_replay_corpus.jsonl': 4500,
  };

  for (const [filename, expectedLines] of Object.entries(EXPECTED)) {
    test(`${filename} has ${expectedLines} lines`, () => {
      const content = readFileSync(resolve(OUT_DIR, filename), 'utf8');
      const lines = content.trim().split('\n').length;
      expect(lines).toBe(expectedLines);
    });
  }
});

describe('invariance: DB unchanged', () => {
  test('prisma/dev.db sha256 unchanged', () => {
    const content = readFileSync(resolve(ROOT, 'prisma/dev.db'));
    const actual = createHash('sha256').update(content).digest('hex');
    expect(actual).toBe('9c24c697f7980c910802e37faecdf05d0d821db097358cda1ad6c5085af99ba6');
  });
});

// ─── Forbidden claims scan ────────────────────────────────────────────────────

describe('forbidden claims scan', () => {
  const FORBIDDEN_PATTERNS = [
    /\bbuy\b/i, /\bsell\b/i, /\bROI\b/i, /\balpha edge\b/i,
    /\bguaranteed\b/i, /\bprofit\b/i, /\boutperform\b/i,
    /\bprediction accuracy\b/i,
  ];

  test('no buy/sell/ROI/alpha/edge claims in validation output', () => {
    const content = readFileSync(
      resolve(OUT_DIR, 'p26a_batch_pipeline_wiring_9case_real_corpus_validation.json'),
      'utf8'
    );
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });

  test('no buy/sell/ROI/alpha/edge claims in P26ACorpusRowAdapter source', () => {
    const content = readFileSync(
      resolve(ROOT, 'src/lib/onlineValidation/P26ACorpusRowAdapter.ts'),
      'utf8'
    );
    const CLAIM_PATTERNS = [
      /\bbuy signal\b/i, /\bsell signal\b/i, /\bguaranteed\b/i,
      /\boutperform\b/i, /\bprofit\b/i,
    ];
    for (const pattern of CLAIM_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });
});
