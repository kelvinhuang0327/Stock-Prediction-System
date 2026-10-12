import * as fs from 'fs';
import * as path from 'path';

import {
  computeCoverageRatio,
  classifyCoverageRatio,
  scanCoverageForP3P19,
  summarizeCoverageRatios,
  validateCoverageRatioNoOutcomeFields,
} from '../P26ECoverageRatioScannerUtils';

describe('P26ECoverageRatioScannerUtils', () => {
  it('computeCoverageRatio(0, 4500) returns 0', () => {
    expect(computeCoverageRatio(0, 4500)).toBe(0);
  });

  it('computeCoverageRatio(4500, 4500) returns 1.0', () => {
    expect(computeCoverageRatio(4500, 4500)).toBe(1.0);
  });

  it('computeCoverageRatio(100, 4500) returns ~0.022 and classifies as VERY_LOW', () => {
    const ratio = computeCoverageRatio(100, 4500);
    expect(ratio).toBeCloseTo(0.0222, 3);
    expect(classifyCoverageRatio(ratio, {})).toBe('VERY_LOW');
  });

  it('classifyCoverageRatio(0, {}) returns NONE', () => {
    expect(classifyCoverageRatio(0, {})).toBe('NONE');
  });

  it('classifyCoverageRatio(0.5, {}) returns PARTIAL', () => {
    expect(classifyCoverageRatio(0.5, {})).toBe('PARTIAL');
  });

  it('classifyCoverageRatio(0.95, {}) returns HIGH', () => {
    expect(classifyCoverageRatio(0.95, {})).toBe('HIGH');
  });

  it('scanCoverageForP3P19 marks fixture-only source with fixtureCoverageOnly=true', () => {
    const sourceMappings = [
      { sourceCategory: 'NewsEvent', sourceState: 'FIXTURE_ONLY', fixtureFileFound: true, realSourceCandidates: [] },
    ];
    const corpusRows = [{ symbol: 'AAPL', asOfDate: '20260101' }];
    const result = scanCoverageForP3P19(sourceMappings, corpusRows) as {
      perSource: Record<string, { fixtureCoverageOnly: boolean; coverageRatio: number }>;
    };
    expect(result.perSource['NewsEvent'].fixtureCoverageOnly).toBe(true);
    expect(result.perSource['NewsEvent'].coverageRatio).toBe(0);
  });

  it('scanCoverageForP3P19 returns 0 count when corpus rows have no revenue context field', () => {
    const sourceMappings = [
      { sourceCategory: 'MonthlyRevenue', sourceState: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED', fixtureFileFound: false, realSourceCandidates: ['prisma/schema.prisma'] },
    ];
    const corpusRows = [
      { symbol: 'AAPL', asOfDate: '20260101', alphaScore: 5.0 },
      { symbol: 'MSFT', asOfDate: '20260101', alphaScore: 3.0 },
    ];
    const result = scanCoverageForP3P19(sourceMappings, corpusRows) as {
      perSource: Record<string, { coverageCount: number }>;
    };
    expect(result.perSource['MonthlyRevenue'].coverageCount).toBe(0);
  });

  it('validateCoverageRatioNoOutcomeFields passes for valid summary', () => {
    const summary = {
      totalCorpusRows: 9000,
      perSource: {
        MonthlyRevenue: { coverageRatio: 0, coverageClassification: 'NONE' },
      },
      anyRealCoverage: false,
    };
    const check = validateCoverageRatioNoOutcomeFields(summary);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it('validateCoverageRatioNoOutcomeFields fails when outcomePrice present', () => {
    const badSummary = { outcomePrice: 100, returnPct: 0.05 };
    const check = validateCoverageRatioNoOutcomeFields(badSummary);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
  });

  it('summarizeCoverageRatios produces correct structure', () => {
    const coverageResults = {
      totalCorpusRows: 9000,
      perSource: {
        MonthlyRevenue: {
          sourceCategory: 'MonthlyRevenue',
          fixtureCoverageOnly: false,
          coverageRatio: 0,
          coverageClassification: 'NONE',
        },
        NewsEvent: {
          sourceCategory: 'NewsEvent',
          fixtureCoverageOnly: true,
          coverageRatio: 0,
          coverageClassification: 'NONE',
        },
      },
    };
    const summary = summarizeCoverageRatios(coverageResults) as Record<string, unknown>;
    expect(summary['totalCorpusRows']).toBe(9000);
    expect(summary['anyRealCoverage']).toBe(false);
  });

  it('source file does not use Math.random()', () => {
    const filePath = path.join(__dirname, '..', 'P26ECoverageRatioScannerUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('source file has no external imports', () => {
    const filePath = path.join(__dirname, '..', 'P26ECoverageRatioScannerUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
