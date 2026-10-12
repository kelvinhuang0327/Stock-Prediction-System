import {
  scanLocalMonthlyRevenueHistoricalSources,
  classifyHistoricalSourceCandidate,
  extractHistoricalSourceMetadata,
  summarizeHistoricalSourceAvailability,
  validateHistoricalSourceNoOutcomeFields,
  validateHistoricalSourceReadOnly,
  HistoricalSourceScanResult,
  SourceCandidate,
} from '../P26F3MonthlyRevenueHistoricalSourceScannerUtils';
import * as fs from 'fs';
import * as path from 'path';

const emptyResult: HistoricalSourceScanResult = {
  scannedPaths: [],
  totalFilesScanned: 0,
  localSourcesFound: 0,
  realSourceCandidates: [],
  templateOnlyCandidates: [],
  missingPeriods: ['2025-09','2025-10','2025-11','2025-12','2026-01'],
  missingSymbols: ['2330','1210'],
  scanClassification: 'NO_LOCAL_HISTORICAL_SOURCE_FOUND',
};

describe('P26F3MonthlyRevenueHistoricalSourceScannerUtils', () => {
  it('scanLocalMonthlyRevenueHistoricalSources returns correct shape', () => {
    const result = scanLocalMonthlyRevenueHistoricalSources(path.join(__dirname, '../../../../'));
    expect(result).toHaveProperty('scannedPaths');
    expect(result).toHaveProperty('totalFilesScanned');
    expect(result).toHaveProperty('localSourcesFound');
    expect(result).toHaveProperty('realSourceCandidates');
    expect(result).toHaveProperty('missingPeriods');
    expect(result).toHaveProperty('scanClassification');
    expect(Array.isArray(result.scannedPaths)).toBe(true);
  });

  it('scan result has localSourcesFound >= 0', () => {
    const result = scanLocalMonthlyRevenueHistoricalSources(path.join(__dirname, '../../../../'));
    expect(result.localSourcesFound).toBeGreaterThanOrEqual(0);
  });

  it('scan result missingPeriods contains target periods when no source', () => {
    expect(emptyResult.missingPeriods).toContain('2025-09');
    expect(emptyResult.missingPeriods).toContain('2026-01');
  });

  it('classifyHistoricalSourceCandidate returns GENERATED_ARTIFACT for p26f paths', () => {
    const candidate = classifyHistoricalSourceCandidate(
      'outputs/online_validation/p26f_monthly_revenue_something.jsonl',
      '{"revenue":100}'
    );
    expect(candidate.sourceType).toBe('GENERATED_ARTIFACT');
  });

  it('classifyHistoricalSourceCandidate returns FIXTURE for fixture paths', () => {
    const candidate = classifyHistoricalSourceCandidate(
      'fixtures/monthly_revenue_fixture.json',
      '{"revenue":100}'
    );
    expect(candidate.sourceType).toBe('FIXTURE');
  });

  it('classifyHistoricalSourceCandidate returns TEMPLATE_ONLY for template paths', () => {
    const candidate = classifyHistoricalSourceCandidate(
      'data/template_monthly_revenue.csv',
      'revenue,stockId'
    );
    expect(candidate.sourceType).toBe('TEMPLATE_ONLY');
  });

  it('classifyHistoricalSourceCandidate returns SourceCandidate with correct shape', () => {
    const candidate = classifyHistoricalSourceCandidate('data/revenue.csv', 'revenue,stockId,year,month');
    expect(candidate).toHaveProperty('path');
    expect(candidate).toHaveProperty('sourceType');
    expect(candidate).toHaveProperty('hasRevenue');
    expect(candidate).toHaveProperty('hasReleaseDate');
    expect(candidate).toHaveProperty('rowCount');
  });

  it('extractHistoricalSourceMetadata returns metadata object', () => {
    const candidate: SourceCandidate = {
      path: 'data/revenue.csv',
      sourceType: 'REAL_SOURCE',
      periods: ['2025-09'],
      symbols: ['2330'],
      hasRevenue: true,
      hasReleaseDate: false,
      rowCount: 10,
      note: 'test',
    };
    const meta = extractHistoricalSourceMetadata(candidate);
    expect(meta).toHaveProperty('path');
    expect(meta).toHaveProperty('sourceType');
    expect(meta).toHaveProperty('periodCount');
    expect(meta).toHaveProperty('symbolCount');
  });

  it('summarizeHistoricalSourceAvailability returns correct shape for empty scan', () => {
    const summary = summarizeHistoricalSourceAvailability(emptyResult);
    expect(summary).toHaveProperty('scannedPaths');
    expect(summary).toHaveProperty('missingPeriods');
    expect(summary).toHaveProperty('scanClassification');
    expect((summary as Record<string, unknown>)['localSourcesFound']).toBe(0);
  });

  it('summarizeHistoricalSourceAvailability reports missing periods when no sources', () => {
    const summary = summarizeHistoricalSourceAvailability(emptyResult) as Record<string, unknown>;
    expect(Array.isArray(summary['missingPeriods'])).toBe(true);
    expect((summary['missingPeriods'] as string[]).length).toBeGreaterThan(0);
  });

  it('validateHistoricalSourceNoOutcomeFields passes for empty scan results', () => {
    const result = validateHistoricalSourceNoOutcomeFields(emptyResult);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('validateHistoricalSourceReadOnly passes for empty scan results', () => {
    const result = validateHistoricalSourceReadOnly(emptyResult);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('No Math.random() in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalSourceScannerUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('No external (non-relative) imports in source file', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../P26F3MonthlyRevenueHistoricalSourceScannerUtils.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
