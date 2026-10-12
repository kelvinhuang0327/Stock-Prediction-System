import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectManualSourceFormat,
  parseManualSourceFile,
  classifyManualSourceFile,
  scanManualMonthlyRevenueDropzone,
  summarizeManualSourceScan,
  validateManualSourceNoOutcomeFields,
  validateManualSourceReadOnly,
} from '../P26F32ManualMonthlyRevenueSourceScannerUtils';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'p26f3-2-scan-'));
}

const SAMPLE_CSV = `stockId,year,month,revenue,releaseDate,sourceName,sourceFileName
2330,2025,9,50000000,2025-10-10,TWSE,twse_2025_09.csv
2454,2025,9,30000000,2025-10-10,TWSE,twse_2025_09.csv`;

const SAMPLE_JSON = JSON.stringify([
  { stockId: '2330', year: 2025, month: 9, revenue: 50000000, releaseDate: '2025-10-10', sourceName: 'TWSE', sourceFileName: 'test.json' },
  { stockId: '2454', year: 2025, month: 10, revenue: 30000000, releaseDate: '2025-11-10', sourceName: 'TWSE', sourceFileName: 'test.json' },
]);

const SAMPLE_JSONL = [
  JSON.stringify({ stockId: '2330', year: 2025, month: 9, revenue: 50000000, releaseDate: '2025-10-10', sourceName: 'TWSE', sourceFileName: 'test.jsonl' }),
  JSON.stringify({ stockId: '2454', year: 2025, month: 10, revenue: 30000000, releaseDate: '2025-11-10', sourceName: 'TWSE', sourceFileName: 'test.jsonl' }),
].join('\n');

describe('P26F32 Manual MonthlyRevenue Source Scanner Utils', () => {
  describe('detectManualSourceFormat', () => {
    it('detects csv', () => expect(detectManualSourceFormat('/tmp/data.csv')).toBe('csv'));
    it('detects json', () => expect(detectManualSourceFormat('/tmp/data.json')).toBe('json'));
    it('detects jsonl', () => expect(detectManualSourceFormat('/tmp/data.jsonl')).toBe('jsonl'));
    it('returns unknown for xlsx', () => expect(detectManualSourceFormat('/tmp/data.xlsx')).toBe('unknown'));
    it('returns unknown for txt', () => expect(detectManualSourceFormat('/tmp/data.txt')).toBe('unknown'));
  });

  describe('parseManualSourceFile — CSV', () => {
    it('parses valid CSV', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.csv');
      fs.writeFileSync(fp, SAMPLE_CSV);
      const { rows, error } = parseManualSourceFile(fp);
      expect(error).toBeUndefined();
      expect(rows).toHaveLength(2);
      expect(rows[0].stockId).toBe('2330');
    });
    it('returns empty rows for CSV with only header', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'empty.csv');
      fs.writeFileSync(fp, 'stockId,year,month\n');
      const { rows } = parseManualSourceFile(fp);
      expect(rows).toHaveLength(0);
    });
  });

  describe('parseManualSourceFile — JSON', () => {
    it('parses valid JSON array', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.json');
      fs.writeFileSync(fp, SAMPLE_JSON);
      const { rows, error } = parseManualSourceFile(fp);
      expect(error).toBeUndefined();
      expect(rows).toHaveLength(2);
      expect(rows[0].stockId).toBe('2330');
    });
    it('parses single JSON object as array of 1', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'single.json');
      fs.writeFileSync(fp, JSON.stringify({ stockId: '2330', year: 2025, month: 9, revenue: 50000 }));
      const { rows } = parseManualSourceFile(fp);
      expect(rows).toHaveLength(1);
    });
    it('returns error for invalid JSON', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(fp, 'NOT JSON');
      const { rows, error } = parseManualSourceFile(fp);
      expect(rows).toHaveLength(0);
      expect(error).toBeTruthy();
    });
  });

  describe('parseManualSourceFile — JSONL', () => {
    it('parses valid JSONL', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.jsonl');
      fs.writeFileSync(fp, SAMPLE_JSONL);
      const { rows, error } = parseManualSourceFile(fp);
      expect(error).toBeUndefined();
      expect(rows).toHaveLength(2);
    });
    it('returns error for unknown format', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.xlsx');
      fs.writeFileSync(fp, 'binary');
      const { rows, error } = parseManualSourceFile(fp);
      expect(rows).toHaveLength(0);
      expect(error).toBe('unknown_format');
    });
  });

  describe('classifyManualSourceFile', () => {
    it('classifies CSV as ok', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.csv');
      fs.writeFileSync(fp, SAMPLE_CSV);
      const result = classifyManualSourceFile(fp);
      expect(result.format).toBe('csv');
      expect(result.parseStatus).toBe('ok');
      expect(result.rowCount).toBe(2);
    });
    it('classifies unknown format file as unknown_format', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'data.xlsx');
      fs.writeFileSync(fp, 'bin');
      const result = classifyManualSourceFile(fp);
      expect(result.format).toBe('unknown');
      expect(result.parseStatus).toBe('unknown_format');
    });
    it('detects forbidden fields', () => {
      const tmpDir = makeTmpDir();
      const fp = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(fp, JSON.stringify([{ stockId: '2330', year: 2025, month: 9, revenue: 50000, outcomePrice: 100, releaseDate: '2025-10-10', sourceName: 'TWSE', sourceFileName: 'bad.json' }]));
      const result = classifyManualSourceFile(fp);
      expect(result.hasForbiddenFields).toBe(true);
      expect(result.forbiddenFieldsFound).toContain('outcomePrice');
    });
  });

  describe('scanManualMonthlyRevenueDropzone', () => {
    it('returns SOURCE_NOT_PROVIDED when dropzone does not exist', () => {
      const result = scanManualMonthlyRevenueDropzone('/nonexistent/path/xyz');
      expect(result.classification).toBe('P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY');
      expect(result.totalFiles).toBe(0);
      expect(result.dbWriteAllowed).toBe(false);
      expect(result.corpusWriteAllowed).toBe(false);
    });
    it('returns SOURCE_NOT_PROVIDED for empty dropzone', () => {
      const tmpDir = makeTmpDir();
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(result.classification).toBe('P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY');
    });
    it('classifies files when dropzone has CSV', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir,'data.csv'), SAMPLE_CSV);
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(result.totalFiles).toBe(1);
      expect(result.totalRows).toBe(2);
    });
    it('ignores README.md and EXPECTED_SCHEMA.json', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir,'README.md'), '# readme');
      fs.writeFileSync(path.join(tmpDir,'EXPECTED_SCHEMA.json'), '{}');
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(result.totalFiles).toBe(0);
    });
    it('rejects files with unknown format', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir,'data.xlsx'), 'bin');
      // xlsx not in accepted filter, so should not appear
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(result.totalFiles).toBe(0);
    });
    it('readOnly is always true', () => {
      const tmpDir = makeTmpDir();
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(result.readOnly).toBe(true);
    });
  });

  describe('summarizeManualSourceScan', () => {
    it('returns a non-empty string', () => {
      const tmpDir = makeTmpDir();
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      const summary = summarizeManualSourceScan(result);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('validateManualSourceNoOutcomeFields', () => {
    it('passes for clean scan', () => {
      const tmpDir = makeTmpDir();
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      expect(validateManualSourceNoOutcomeFields(result).pass).toBe(true);
    });
  });

  describe('validateManualSourceReadOnly', () => {
    it('always passes (no DB writes)', () => {
      const tmpDir = makeTmpDir();
      const result = scanManualMonthlyRevenueDropzone(tmpDir);
      const ro = validateManualSourceReadOnly(result);
      expect(ro.pass).toBe(true);
      expect(ro.dbWriteAttempted).toBe(false);
      expect(ro.corpusWriteAttempted).toBe(false);
    });
  });

  describe('No forbidden patterns', () => {
    it('source does not use Math.random()', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F32ManualMonthlyRevenueSourceScannerUtils.ts'), 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });
    it('source does not use external npm imports', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F32ManualMonthlyRevenueSourceScannerUtils.ts'), 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
    it('source does not write to DB', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F32ManualMonthlyRevenueSourceScannerUtils.ts'), 'utf8');
      expect(src).not.toMatch(/prisma\.(monthlyRevenue|create|update|delete|upsert)/);
    });
  });
});
