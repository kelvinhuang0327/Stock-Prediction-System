import * as fs from 'fs';
import * as path from 'path';

import {
  classifySourceMapping,
  summarizeSourceMappingResults,
  validateSourceMappingDoesNotUseOutcomeFields,
  validateSourceMappingReadOnly,
  type SourceScanResult,
} from '../P26ESourceMappingScannerUtils';

function makeResult(overrides: Partial<SourceScanResult>): SourceScanResult {
  return {
    sourceCategory: 'MonthlyRevenue',
    sourceState: 'FIXTURE_ONLY',
    fixtureFileFound: true,
    realSourceCandidates: [],
    pitGateField: null,
    symbolJoinFieldFound: false,
    asOfDateCompatibleFieldFound: false,
    sourceHashFieldFound: false,
    outcomeFieldsDetected: false,
    readOnly: true,
    notes: '',
    ...overrides,
  };
}

describe('P26ESourceMappingScannerUtils', () => {
  it('classifySourceMapping returns FIXTURE_ONLY for fixture-only source', () => {
    const result = makeResult({ sourceState: 'FIXTURE_ONLY' });
    expect(classifySourceMapping(result)).toBe('FIXTURE_ONLY');
  });

  it('classifySourceMapping returns REAL_DATA_PRESENT_BUT_NOT_MAPPED for source with real candidates', () => {
    const result = makeResult({
      sourceState: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED',
      realSourceCandidates: ['prisma/schema.prisma'],
    });
    expect(classifySourceMapping(result)).toBe('REAL_DATA_PRESENT_BUT_NOT_MAPPED');
  });

  it('validateSourceMappingDoesNotUseOutcomeFields passes when outcomeFieldsDetected=false', () => {
    const results = [makeResult({ outcomeFieldsDetected: false })];
    const check = validateSourceMappingDoesNotUseOutcomeFields(results);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it('validateSourceMappingDoesNotUseOutcomeFields fails when outcomeFieldsDetected=true', () => {
    const results = [makeResult({ sourceCategory: 'NewsEvent', outcomeFieldsDetected: true })];
    const check = validateSourceMappingDoesNotUseOutcomeFields(results);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
    expect(check.violations[0]).toMatch(/outcomeFieldsDetected=true/);
  });

  it('validateSourceMappingReadOnly passes when readOnly=true', () => {
    const results = [makeResult({ readOnly: true })];
    const check = validateSourceMappingReadOnly(results);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it('validateSourceMappingReadOnly fails when readOnly=false', () => {
    const results = [makeResult({ sourceCategory: 'FinancialReport', readOnly: false })];
    const check = validateSourceMappingReadOnly(results);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
    expect(check.violations[0]).toMatch(/readOnly=false/);
  });

  it('summarizeSourceMappingResults counts fixture vs real correctly', () => {
    const results = [
      makeResult({ sourceCategory: 'MonthlyRevenue', sourceState: 'REAL_DATA_PRESENT_BUT_NOT_MAPPED', fixtureFileFound: false, realSourceCandidates: ['prisma/schema.prisma'] }),
      makeResult({ sourceCategory: 'NewsEvent', sourceState: 'FIXTURE_ONLY', fixtureFileFound: true, realSourceCandidates: [] }),
      makeResult({ sourceCategory: 'FinancialReport', sourceState: 'FIXTURE_ONLY', fixtureFileFound: true, realSourceCandidates: [] }),
    ];
    const summary = summarizeSourceMappingResults(results) as Record<string, unknown>;
    expect(summary['fixtureOnlyCount']).toBe(2);
    expect(summary['realDataPresentCount']).toBe(1);
    expect(summary['totalSources']).toBe(3);
    expect(summary['allReadOnly']).toBe(true);
    expect(summary['anyOutcomeFieldsDetected']).toBe(false);
  });

  it('source file does not use Math.random()', () => {
    const filePath = path.join(__dirname, '..', 'P26ESourceMappingScannerUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/Math\.random\(\)/);
  });

  it('source file has no external imports', () => {
    const filePath = path.join(__dirname, '..', 'P26ESourceMappingScannerUtils.ts');
    const src = fs.readFileSync(filePath, 'utf8');
    expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
  });
});
