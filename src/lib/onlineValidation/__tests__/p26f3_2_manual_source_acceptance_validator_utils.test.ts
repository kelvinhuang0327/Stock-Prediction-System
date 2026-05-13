import {
  validateManualMonthlyRevenueRow,
  validateManualMonthlyRevenueRows,
  normalizeAcceptedManualMonthlyRevenueRow,
  buildAcceptedManualSourceManifest,
  classifyManualSourceAcceptance,
  validateAcceptedRowsNoOutcomeFields,
  validateAcceptedRowsPITSafe,
  ManualMonthlyRevenueRow,
  AcceptedManualRevenueRow,
} from '../P26F32ManualSourceAcceptanceValidatorUtils';

const CONTRACT = {
  targetPeriods: ['2025-09','2025-10','2025-11','2025-12','2026-01'],
  targetSymbols: ['0055','00712','00738U','00830','00891','00903','1210','1308','1314','1319','1326','1402','1434','1513','1536','1560','1598','1605','1710','1717','1802','2317','2330','2454','6415'],
};

function makeValidRow(overrides: Partial<ManualMonthlyRevenueRow> = {}): ManualMonthlyRevenueRow {
  return {
    stockId: '2330',
    year: 2025,
    month: 9,
    revenue: 50000000,
    releaseDate: '2025-10-10',
    sourceName: 'TWSE',
    sourceFileName: 'twse_2025_09.csv',
    ...overrides,
  };
}

describe('P26F32 Manual Source Acceptance Validator Utils', () => {
  describe('validateManualMonthlyRevenueRow', () => {
    it('accepts a valid row', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.accepted).toBeDefined();
      expect(result.accepted!.dryRunOnly).toBe(true);
      expect(result.accepted!.dbWriteAllowed).toBe(false);
      expect(result.accepted!.corpusWriteAllowed).toBe(false);
    });
    it('rejects row with invalid period', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ year: 2025, month: 8 }), CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('2025-08'))).toBe(true);
    });
    it('rejects row with invalid symbol', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ stockId: '9999' }), CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('9999'))).toBe(true);
    });
    it('rejects row missing releaseDate', () => {
      const row = makeValidRow();
      delete (row as Record<string, unknown>)['releaseDate'];
      const result = validateManualMonthlyRevenueRow(row, CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('releaseDate'))).toBe(true);
    });
    it('rejects row with non-numeric revenue', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ revenue: 'abc' }), CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('revenue'))).toBe(true);
    });
    it('rejects row with unknown sourceName', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ sourceName: 'UNKNOWN' }), CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('sourceName'))).toBe(true);
    });
    it('rejects row with outcomePrice', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ outcomePrice: 100 } as unknown as Partial<ManualMonthlyRevenueRow>), CONTRACT);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes('outcomePrice'))).toBe(true);
    });
    it('rejects row with returnPct', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ returnPct: 0.1 } as unknown as Partial<ManualMonthlyRevenueRow>), CONTRACT);
      expect(result.valid).toBe(false);
    });
    it('rejects row missing stockId and symbol', () => {
      const row = makeValidRow();
      delete (row as Record<string, unknown>)['stockId'];
      const result = validateManualMonthlyRevenueRow(row, CONTRACT);
      expect(result.valid).toBe(false);
    });
    it('accepts row using symbol instead of stockId', () => {
      const row: ManualMonthlyRevenueRow = {
        symbol: '2330',
        year: 2025,
        month: 9,
        revenue: 50000000,
        releaseDate: '2025-10-10',
        sourceName: 'TWSE',
        sourceFileName: 'test.csv',
      };
      const result = validateManualMonthlyRevenueRow(row, CONTRACT);
      expect(result.valid).toBe(true);
      expect(result.accepted!.stockId).toBe('2330');
    });
    it('accepted row has deterministic rowHash', () => {
      const r1 = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const r2 = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      expect(r1.rowHash).toBe(r2.rowHash);
    });
    it('revenue as string is accepted and coerced to number', () => {
      const result = validateManualMonthlyRevenueRow(makeValidRow({ revenue: '50000000' }), CONTRACT);
      expect(result.valid).toBe(true);
      expect(typeof result.accepted!.revenue).toBe('number');
    });
  });

  describe('validateManualMonthlyRevenueRows', () => {
    it('validates multiple rows', () => {
      const rows = [makeValidRow(), makeValidRow({ stockId: '2454', month: 10 })];
      const results = validateManualMonthlyRevenueRows(rows, CONTRACT);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.valid)).toBe(true);
    });
  });

  describe('normalizeAcceptedManualMonthlyRevenueRow', () => {
    it('returns normalized row for valid input', () => {
      const result = normalizeAcceptedManualMonthlyRevenueRow(makeValidRow());
      expect(result).not.toBeNull();
      expect(result!.dryRunOnly).toBe(true);
      expect(result!.dbWriteAllowed).toBe(false);
    });
    it('returns null for invalid row', () => {
      const result = normalizeAcceptedManualMonthlyRevenueRow(makeValidRow({ stockId: '9999' }));
      expect(result).toBeNull();
    });
  });

  describe('buildAcceptedManualSourceManifest', () => {
    it('returns manifest with empty rows for empty input', () => {
      const manifest = buildAcceptedManualSourceManifest([]);
      expect(manifest.acceptedRows).toBe(0);
      expect(manifest.readyForP26F4).toBe(false);
      expect(manifest.classification).toBe('P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY');
    });
    it('deduplicates rows by stockId+year+month deterministically', () => {
      const r1 = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const r2 = validateManualMonthlyRevenueRow(makeValidRow({ revenue: 99999 }), CONTRACT).accepted!;
      const manifest = buildAcceptedManualSourceManifest([r1, r2]);
      expect(manifest.acceptedRows).toBe(1);
    });
    it('dryRunContract.dbWriteAllowed = false', () => {
      const manifest = buildAcceptedManualSourceManifest([]);
      expect(manifest.dryRunContract.dbWriteAllowed).toBe(false);
    });
    it('readyForP26F4 is true when rows present', () => {
      const r = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const manifest = buildAcceptedManualSourceManifest([r]);
      expect(manifest.readyForP26F4).toBe(true);
    });
  });

  describe('classifyManualSourceAcceptance', () => {
    it('returns SOURCE_NOT_PROVIDED when empty', () => {
      expect(classifyManualSourceAcceptance([])).toBe('P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY');
    });
    it('returns MANUAL_SOURCE_ACCEPTED when rows present', () => {
      const r = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      expect(classifyManualSourceAcceptance([r])).toBe('P26F3_2_MANUAL_SOURCE_ACCEPTED_DRY_RUN');
    });
  });

  describe('validateAcceptedRowsNoOutcomeFields', () => {
    it('passes for clean rows', () => {
      const r = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const result = validateAcceptedRowsNoOutcomeFields([r]);
      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('validateAcceptedRowsPITSafe', () => {
    it('passes for valid accepted rows', () => {
      const r = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const result = validateAcceptedRowsPITSafe([r]);
      expect(result.pass).toBe(true);
    });
    it('fails if dryRunOnly is not true', () => {
      const r = validateManualMonthlyRevenueRow(makeValidRow(), CONTRACT).accepted!;
      const badRow = { ...r, dryRunOnly: false } as unknown as AcceptedManualRevenueRow;
      const result = validateAcceptedRowsPITSafe([badRow]);
      expect(result.pass).toBe(false);
    });
  });

  describe('No forbidden patterns', () => {
    it('source does not use Math.random()', () => {
      const fs = require('fs');
      const src = fs.readFileSync(require('path').join(__dirname, '../P26F32ManualSourceAcceptanceValidatorUtils.ts'), 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });
    it('source does not use external npm imports', () => {
      const fs = require('fs');
      const src = fs.readFileSync(require('path').join(__dirname, '../P26F32ManualSourceAcceptanceValidatorUtils.ts'), 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
    it('source does not write to DB', () => {
      const fs = require('fs');
      const src = fs.readFileSync(require('path').join(__dirname, '../P26F32ManualSourceAcceptanceValidatorUtils.ts'), 'utf8');
      expect(src).not.toMatch(/prisma\.(create|update|delete|upsert)/);
    });
  });
});
