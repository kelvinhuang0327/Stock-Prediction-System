/**
 * p19active_scoring_pit_replay_utils.test.ts
 *
 * DISCLAIMER: Does not constitute investment advice. Does not compute ROI,
 * profit, alpha, win-rate, edge, or outperformance. PIT replay utility tests.
 *
 * P19-HARDRESET PART F — Unit tests for P19ActiveScoringPitReplayUtils.ts
 */

import {
  buildPitReplayConfig,
  validatePitReplayConfig,
  classifyMonthlyRevenueAvailabilityInSnapshot,
  validateActiveScoringSnapshotPitSafety,
  summarizePitReplayCorpus,
  comparePitReplayToP3Shape,
  scanForbiddenClaims,
  P19_CORPUS_PATH,
  P3_CORPUS_PATH,
  FROZEN_CORPUS_PATHS,
  TAIWAN_REVENUE_RELEASE_DAY,
  PRODUCTION_APPLY_ALLOWED,
} from '../P19ActiveScoringPitReplayUtils';

// ─── buildPitReplayConfig ────────────────────────────────────────────────────

describe('buildPitReplayConfig', () => {
  it('is deterministic with no options', () => {
    const a = buildPitReplayConfig({});
    const b = buildPitReplayConfig({});
    expect(a).toEqual(b);
  });

  it('uses provided pitReplayRunDate', () => {
    const cfg = buildPitReplayConfig({ pitReplayRunDate: '2026-03-15' });
    expect(cfg.pitReplayRunDate).toBe('2026-03-15');
  });

  it('uses provided pitReplayRunId', () => {
    const cfg = buildPitReplayConfig({ pitReplayRunId: 'my-run-123', pitReplayRunDate: '2026-03-15' });
    expect(cfg.pitReplayRunId).toBe('my-run-123');
  });

  it('always sets productionApplyAllowed = false', () => {
    const cfg = buildPitReplayConfig({});
    expect(cfg.productionApplyAllowed).toBe(false);
  });

  it('sets outputPath to P19_CORPUS_PATH', () => {
    const cfg = buildPitReplayConfig({});
    expect(cfg.outputPath).toBe(P19_CORPUS_PATH);
  });

  it('sets sourceCorpusPath to P3_CORPUS_PATH', () => {
    const cfg = buildPitReplayConfig({});
    expect(cfg.sourceCorpusPath).toBe(P3_CORPUS_PATH);
  });

  it('allows custom allowInferredReleaseDate', () => {
    const cfg = buildPitReplayConfig({ allowInferredReleaseDate: false });
    expect(cfg.allowInferredReleaseDate).toBe(false);
  });
});

// ─── validatePitReplayConfig ─────────────────────────────────────────────────

describe('validatePitReplayConfig', () => {
  it('accepts a valid P19 config', () => {
    const cfg = buildPitReplayConfig({});
    const { valid, errors } = validatePitReplayConfig(cfg);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('rejects overwrite of P3 corpus path', () => {
    const cfg = buildPitReplayConfig({});
    const bad = { ...cfg, outputPath: P3_CORPUS_PATH };
    const { valid, errors } = validatePitReplayConfig(bad as typeof cfg);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('P3'))).toBe(true);
  });

  it('rejects overwrite of any frozen corpus path', () => {
    for (const frozenPath of FROZEN_CORPUS_PATHS) {
      const cfg = buildPitReplayConfig({});
      const bad = { ...cfg, outputPath: frozenPath };
      const { valid, errors } = validatePitReplayConfig(bad as typeof cfg);
      expect(valid).toBe(false);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects productionApplyAllowed = true', () => {
    const cfg = buildPitReplayConfig({});
    const bad = { ...cfg, productionApplyAllowed: true as unknown as false };
    const { valid, errors } = validatePitReplayConfig(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('productionApplyAllowed'))).toBe(true);
  });

  it('rejects empty pitReplayRunId', () => {
    const cfg = buildPitReplayConfig({});
    const bad = { ...cfg, pitReplayRunId: '' };
    const { valid, errors } = validatePitReplayConfig(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('pitReplayRunId'))).toBe(true);
  });

  it('rejects invalid pitReplayRunDate format', () => {
    const cfg = buildPitReplayConfig({});
    const bad = { ...cfg, pitReplayRunDate: '20260512' };
    const { valid, errors } = validatePitReplayConfig(bad);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('pitReplayRunDate'))).toBe(true);
  });
});

// ─── classifyMonthlyRevenueAvailabilityInSnapshot ────────────────────────────

describe('classifyMonthlyRevenueAvailabilityInSnapshot', () => {
  it('returns NOT_APPLICABLE_NO_DATA for null record', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(null, '2025-03-15');
    expect(result.pitGateStatus).toBe('NOT_APPLICABLE_NO_DATA');
  });

  it('returns NOT_APPLICABLE_NO_DATA for missing year/month', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot({}, '2025-03-15');
    expect(result.pitGateStatus).toBe('NOT_APPLICABLE_NO_DATA');
  });

  it('returns GATE_PASSED when releaseDate <= asOfDate', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 1, releaseDate: '2025-02-10' },
      '2025-03-15',
    );
    expect(result.pitGateStatus).toBe('GATE_PASSED');
    expect(result.inferred).toBe(false);
  });

  it('returns GATE_PASSED when releaseDate = asOfDate exactly', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 1, releaseDate: '2025-02-10' },
      '2025-02-10',
    );
    expect(result.pitGateStatus).toBe('GATE_PASSED');
  });

  it('returns GATE_REJECTED_UNRELEASED when releaseDate > asOfDate', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 2, releaseDate: '2025-03-10' },
      '2025-02-15',
    );
    expect(result.pitGateStatus).toBe('GATE_REJECTED_UNRELEASED');
    expect(result.inferred).toBe(false);
  });

  it('infers release date as TAIWAN_REVENUE_RELEASE_DAY of next month (non-December)', () => {
    // Jan 2025 → release date = Feb 10, 2025
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 1 },
      '2025-02-15',
      { allowInferredReleaseDate: true },
    );
    expect(result.pitGateStatus).toBe('INFERRED_GATE_PASSED');
    expect(result.releaseDate).toBe(`2025-02-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`);
    expect(result.inferred).toBe(true);
  });

  it('infers release date for December → January of next year', () => {
    // Dec 2024 → release date = Jan 10, 2025
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2024, month: 12 },
      '2025-01-15',
      { allowInferredReleaseDate: true },
    );
    expect(result.pitGateStatus).toBe('INFERRED_GATE_PASSED');
    expect(result.releaseDate).toBe(`2025-01-${String(TAIWAN_REVENUE_RELEASE_DAY).padStart(2, '0')}`);
    expect(result.inferred).toBe(true);
  });

  it('returns INFERRED_GATE_REJECTED when inferred date > asOfDate', () => {
    // Mar 2025 revenue not released by Mar 5
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 3 },
      '2025-04-05',
      { allowInferredReleaseDate: true },
    );
    expect(result.pitGateStatus).toBe('INFERRED_GATE_REJECTED');
    expect(result.inferred).toBe(true);
  });

  it('returns NOT_APPLICABLE_NO_DATA when allowInferred=false and no releaseDate', () => {
    const result = classifyMonthlyRevenueAvailabilityInSnapshot(
      { year: 2025, month: 1 },
      '2025-02-15',
      { allowInferredReleaseDate: false },
    );
    expect(result.pitGateStatus).toBe('NOT_APPLICABLE_NO_DATA');
    expect(result.inferred).toBe(false);
  });
});

// ─── validateActiveScoringSnapshotPitSafety ──────────────────────────────────

describe('validateActiveScoringSnapshotPitSafety', () => {
  const safeRow = {
    symbol: 'TST',
    originalAsOfDate: '2025-01-15',
    activeScoringSnapshot: {
      alphaScore: 0.5,
      scoreSnapshot: { researchScore: 75 },
    },
    outcomeSnapshot: {
      horizonDays: 30,
      outcomePrice: 150, // allowed — inside outcomeSnapshot
    },
  };

  it('returns safe=true for a clean row', () => {
    const result = validateActiveScoringSnapshotPitSafety(safeRow);
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('catches outcomePrice leakage in activeScoringSnapshot', () => {
    const row = {
      ...safeRow,
      activeScoringSnapshot: {
        alphaScore: 0.5,
        outcomePrice: 200, // FORBIDDEN here
      },
    };
    const result = validateActiveScoringSnapshotPitSafety(row);
    expect(result.safe).toBe(false);
    expect(result.forbiddenFieldsFound.some(f => f.includes('outcomePrice'))).toBe(true);
  });

  it('catches returnPct leakage in activeScoringSnapshot', () => {
    const row = {
      ...safeRow,
      activeScoringSnapshot: {
        alphaScore: 0.5,
        returnPct: 12.5, // FORBIDDEN here
      },
    };
    const result = validateActiveScoringSnapshotPitSafety(row);
    expect(result.safe).toBe(false);
    expect(result.forbiddenFieldsFound.some(f => f.includes('returnPct'))).toBe(true);
  });

  it('catches realizedReturnClass leakage in activeScoringSnapshot', () => {
    const row = {
      ...safeRow,
      activeScoringSnapshot: {
        alphaScore: 0.5,
        realizedReturnClass: 'UP', // FORBIDDEN here
      },
    };
    const result = validateActiveScoringSnapshotPitSafety(row);
    expect(result.safe).toBe(false);
    expect(result.forbiddenFieldsFound.some(f => f.includes('realizedReturnClass'))).toBe(true);
  });

  it('catches nested leakage inside activeScoringSnapshot', () => {
    const row = {
      ...safeRow,
      activeScoringSnapshot: {
        alphaScore: 0.5,
        scoreSnapshot: {
          researchScore: 75,
          returnPct: 5.0, // FORBIDDEN nested inside activeScoringSnapshot
        },
      },
    };
    const result = validateActiveScoringSnapshotPitSafety(row);
    expect(result.safe).toBe(false);
  });

  it('allows outcomePrice at top-level outcomeSnapshot path', () => {
    // outcomePrice inside outcomeSnapshot is expected outcome storage, not leakage
    const row = {
      symbol: 'TST',
      outcomeSnapshot: { outcomePrice: 150 },
      activeScoringSnapshot: { alphaScore: 0.5 },
    };
    const result = validateActiveScoringSnapshotPitSafety(row);
    expect(result.safe).toBe(true);
  });
});

// ─── summarizePitReplayCorpus ────────────────────────────────────────────────

describe('summarizePitReplayCorpus', () => {
  const makeRow = (symbol: string, date: string, status: string, bucket: string, horizon = 30) => ({
    symbol,
    originalAsOfDate: date,
    pitReplayRunId: 'test-run',
    pitReplayRunDate: '2026-01-01',
    scoringCompletenessStatus: status,
    researchBucket: bucket,
    monthlyRevenuePitGateStatus: 'NOT_APPLICABLE_NO_DATA',
    outcomeSnapshot: { horizonDays: horizon },
    productionApplyAllowed: false,
  });

  it('is deterministic — same input produces same output', () => {
    const rows = [
      makeRow('AAPL', '2025-01-15', 'COMPLETE', 'MOMENTUM'),
      makeRow('AAPL', '2025-01-15', 'PARTIAL', 'VALUE'),
      makeRow('MSFT', '2025-02-15', 'COMPLETE', 'MOMENTUM'),
    ];
    const a = summarizePitReplayCorpus(rows as Array<Record<string, unknown>>);
    const b = summarizePitReplayCorpus(rows as Array<Record<string, unknown>>);
    expect(a).toEqual(b);
  });

  it('counts rows, symbols, dates correctly', () => {
    const rows = [
      makeRow('SYM1', '2025-01-01', 'COMPLETE', 'A'),
      makeRow('SYM1', '2025-02-01', 'PARTIAL', 'A'),
      makeRow('SYM2', '2025-01-01', 'COMPLETE', 'B'),
    ];
    const summary = summarizePitReplayCorpus(rows as Array<Record<string, unknown>>);
    expect(summary.totalRows).toBe(3);
    expect(summary.uniqueSymbols).toBe(2);
    expect(summary.uniqueAsOfDates).toBe(2);
  });

  it('sets productionApplyAllowed = false', () => {
    const summary = summarizePitReplayCorpus([makeRow('SYM1', '2025-01-01', 'COMPLETE', 'A')] as Array<Record<string, unknown>>);
    expect(summary.productionApplyAllowed).toBe(false);
  });

  it('computes completeAndPartialRatio correctly', () => {
    const rows = [
      makeRow('A', '2025-01-01', 'COMPLETE', 'X'),
      makeRow('B', '2025-01-01', 'PARTIAL', 'X'),
      makeRow('C', '2025-01-01', 'NO_DATA', 'X'),
      makeRow('D', '2025-01-01', 'COMPLETE', 'X'),
    ];
    const summary = summarizePitReplayCorpus(rows as Array<Record<string, unknown>>);
    expect(summary.completeAndPartialRatio).toBeCloseTo(75, 1);
  });
});

// ─── comparePitReplayToP3Shape ───────────────────────────────────────────────

describe('comparePitReplayToP3Shape', () => {
  const makeP3Row = (symbol: string, date: string, status: string) => ({
    symbol,
    originalAsOfDate: date,
    scoringCompletenessStatus: status,
    researchBucket: 'MOMENTUM',
    activeScoringSnapshot: { alphaScore: 0.5 },
    outcomeSnapshot: { horizonDays: 30 },
  });

  const makeP19Row = (symbol: string, date: string, status: string) => ({
    ...makeP3Row(symbol, date, status),
    pitReplayRunId: 'p19-run',
    pitReplayRunDate: '2026-01-01',
    monthlyRevenuePitGateStatus: 'NOT_APPLICABLE_NO_DATA',
    monthlyRevenueAvailabilitySummary: { dataPresent: false },
    productionApplyAllowed: false,
  });

  it('detects schema-compatible rows (PARTIAL shape for small test dataset)', () => {
    // With < 4500 rows, result is 'PARTIAL' not 'COMPATIBLE' — expected behavior
    const p3Rows = [makeP3Row('A', '2025-01-01', 'COMPLETE')];
    const p19Rows = [makeP19Row('A', '2025-01-01', 'COMPLETE')];
    const result = comparePitReplayToP3Shape(
      p19Rows as Array<Record<string, unknown>>,
      p3Rows as Array<Record<string, unknown>>,
    );
    expect(result.schemaCompatible).toBe(true);
    // PARTIAL because row count < 4500 / symbols < 25 / dates < 60
    expect(result.shapeCompatibility).toBe('PARTIAL');
  });

  it('returns p19ReadyForP20Comparison = false for INCOMPATIBLE schema', () => {
    const p3Rows = [makeP3Row('A', '2025-01-01', 'COMPLETE')];
    const p19RowsMissingFields = [{ symbol: 'A', originalAsOfDate: '2025-01-01' }]; // missing required fields
    const result = comparePitReplayToP3Shape(
      p19RowsMissingFields as Array<Record<string, unknown>>,
      p3Rows as Array<Record<string, unknown>>,
    );
    expect(result.schemaCompatible).toBe(false);
    expect(result.p19ReadyForP20Comparison).toBe(false);
  });

  it('counts symbols and dates accurately', () => {
    const p3Rows = [
      makeP3Row('A', '2025-01-01', 'COMPLETE'),
      makeP3Row('B', '2025-02-01', 'PARTIAL'),
    ];
    const p19Rows = [
      makeP19Row('A', '2025-01-01', 'COMPLETE'),
      makeP19Row('B', '2025-02-01', 'PARTIAL'),
    ];
    const result = comparePitReplayToP3Shape(
      p19Rows as Array<Record<string, unknown>>,
      p3Rows as Array<Record<string, unknown>>,
    );
    expect(result.p3UniqueSymbols).toBe(2);
    expect(result.p19UniqueSymbols).toBe(2);
    expect(result.p3UniqueDates).toBe(2);
    expect(result.p19UniqueDates).toBe(2);
  });
});

// ─── scanForbiddenClaims ─────────────────────────────────────────────────────

describe('scanForbiddenClaims', () => {
  it('returns clean=true for text with no forbidden terms', () => {
    const result = scanForbiddenClaims('Signal strength: medium. Data completeness: high. Scoring: 75/100.');
    expect(result.clean).toBe(true);
    expect(result.matches).toHaveLength(0);
  });

  it('catches ROI claim', () => {
    const result = scanForbiddenClaims('Expected ROI of 15%.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches win-rate claim', () => {
    const result = scanForbiddenClaims('System has a 70% win-rate.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches win rate (space) claim', () => {
    const result = scanForbiddenClaims('Historical win rate is high.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches profit claim', () => {
    const result = scanForbiddenClaims('You will profit from this signal.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches outperform claim', () => {
    const result = scanForbiddenClaims('This strategy will outperform the benchmark.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches investment recommendation claim', () => {
    const result = scanForbiddenClaims('This is an investment recommendation for your portfolio.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('catches guaranteed claim', () => {
    const result = scanForbiddenClaims('Guaranteed returns of 10% annually.');
    expect(result.clean).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('is case-insensitive for forbidden terms', () => {
    const result = scanForbiddenClaims('expected roi is high');
    expect(result.clean).toBe(false);
  });

  it('exempts alphaScore field references', () => {
    const result = scanForbiddenClaims('The alphaScore field contains 0.75 for this symbol.');
    // 'alphaScore' containing 'alpha' should be exempted
    expect(result.clean).toBe(true);
  });

  it('exempts DISCLAIMER lines', () => {
    const result = scanForbiddenClaims('DISCLAIMER: Does not constitute investment advice. Does not compute ROI, profit, alpha, win-rate.');
    expect(result.clean).toBe(true);
  });

  it('returns the original text', () => {
    const text = 'Some scoring output.';
    const result = scanForbiddenClaims(text);
    expect(result.text).toBe(text);
  });
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe('Constants', () => {
  it('TAIWAN_REVENUE_RELEASE_DAY = 10', () => {
    expect(TAIWAN_REVENUE_RELEASE_DAY).toBe(10);
  });

  it('PRODUCTION_APPLY_ALLOWED = false', () => {
    expect(PRODUCTION_APPLY_ALLOWED).toBe(false);
  });

  it('P19_CORPUS_PATH contains p19', () => {
    expect(P19_CORPUS_PATH).toContain('p19');
  });

  it('P3_CORPUS_PATH contains p3', () => {
    expect(P3_CORPUS_PATH).toContain('p3');
  });

  it('FROZEN_CORPUS_PATHS has 4 entries', () => {
    expect(FROZEN_CORPUS_PATHS).toHaveLength(4);
  });

  it('FROZEN_CORPUS_PATHS does not include P19_CORPUS_PATH', () => {
    expect(FROZEN_CORPUS_PATHS).not.toContain(P19_CORPUS_PATH);
  });
});
