import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  inventoryDropzone,
  summarizeInventory,
  DropzoneInventory,
} from '../P26F33DropzoneInventoryUtils';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'p26f3-3-inv-'));
}

describe('P26F33 Dropzone Inventory Utils', () => {
  describe('inventoryDropzone — empty / missing', () => {
    it('returns SOURCE_NOT_PROVIDED for non-existent path', () => {
      const inv = inventoryDropzone('/nonexistent/path/xyz/abc');
      expect(inv.classification).toBe('SOURCE_NOT_PROVIDED');
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.totalFiles).toBe(0);
    });

    it('returns SOURCE_NOT_PROVIDED for empty directory', () => {
      const tmpDir = makeTmpDir();
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('SOURCE_NOT_PROVIDED');
      expect(inv.candidateSourceFiles).toBe(0);
    });

    it('ignores README.md', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# readme');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('SOURCE_NOT_PROVIDED');
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });

    it('ignores .gitkeep', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });

    it('ignores EXPECTED_FILENAMES.md', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'EXPECTED_FILENAMES.md'), '# filenames');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });

    it('ignores TEMPLATE_DO_NOT_IMPORT files', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'TEMPLATE_DO_NOT_IMPORT_monthly_revenue.csv'), 'stockId\n');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });

    it('ignores files with DO_NOT_IMPORT in name', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'DO_NOT_IMPORT_data.json'), '[]');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });

    it('ignores EXPECTED_SCHEMA.json', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'EXPECTED_SCHEMA.json'), '{}');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.candidateSourceFiles).toBe(0);
      expect(inv.ignoredFiles).toBe(1);
    });
  });

  describe('inventoryDropzone — format detection', () => {
    it('detects CSV files as candidates', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'data_2025_09.csv'), 'stockId,revenue\n2330,50000');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('SOURCE_FILES_PRESENT');
      expect(inv.candidateSourceFiles).toBe(1);
      expect(inv.supportedFormatCounts.csv).toBe(1);
    });

    it('detects JSON files as candidates', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'data_2025_10.json'), '[{"stockId":"2330"}]');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('SOURCE_FILES_PRESENT');
      expect(inv.supportedFormatCounts.json).toBe(1);
    });

    it('detects JSONL files as candidates', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'data_2025_11.jsonl'), '{"stockId":"2330"}');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('SOURCE_FILES_PRESENT');
      expect(inv.supportedFormatCounts.jsonl).toBe(1);
    });

    it('returns UNSUPPORTED_FILES_ONLY for xlsx only', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'data.xlsx'), 'bin');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.classification).toBe('UNSUPPORTED_FILES_ONLY');
      expect(inv.unsupportedFiles).toBe(1);
      expect(inv.candidateSourceFiles).toBe(0);
    });
  });

  describe('inventoryDropzone — sha256 deterministic', () => {
    it('same file content produces same sha256', () => {
      const tmpDir = makeTmpDir();
      const content = '{"stockId":"2330","revenue":50000}';
      fs.writeFileSync(path.join(tmpDir, 'a.json'), content);
      const inv1 = inventoryDropzone(tmpDir);
      const inv2 = inventoryDropzone(tmpDir);
      expect(inv1.files[0].sha256).toBe(inv2.files[0].sha256);
    });

    it('different content produces different sha256', () => {
      const tmpDir1 = makeTmpDir();
      const tmpDir2 = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir1, 'a.json'), '{"a":1}');
      fs.writeFileSync(path.join(tmpDir2, 'a.json'), '{"a":2}');
      const inv1 = inventoryDropzone(tmpDir1);
      const inv2 = inventoryDropzone(tmpDir2);
      expect(inv1.files[0].sha256).not.toBe(inv2.files[0].sha256);
    });
  });

  describe('inventoryDropzone — period detection', () => {
    it('detects period from filename pattern YYYY_MM', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'twse_2025_09.csv'), 'h\n1');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.files.find(f => f.isCandidate)?.suspectedPeriod).toBe('2025-09');
    });

    it('returns null for filename with no period pattern', () => {
      const tmpDir = makeTmpDir();
      fs.writeFileSync(path.join(tmpDir, 'revenue.csv'), 'h\n1');
      const inv = inventoryDropzone(tmpDir);
      expect(inv.files.find(f => f.isCandidate)?.suspectedPeriod).toBeNull();
    });
  });

  describe('inventoryDropzone — safety guarantees', () => {
    it('readOnly is always true', () => {
      const inv = inventoryDropzone('/nonexistent');
      expect(inv.readOnly).toBe(true);
    });
    it('dbWriteAllowed is always false', () => {
      const inv = inventoryDropzone('/nonexistent');
      expect(inv.dbWriteAllowed).toBe(false);
    });
    it('corpusWriteAllowed is always false', () => {
      const inv = inventoryDropzone('/nonexistent');
      expect(inv.corpusWriteAllowed).toBe(false);
    });
    it('does not mutate the filesystem', () => {
      const tmpDir = makeTmpDir();
      const before = fs.readdirSync(tmpDir);
      inventoryDropzone(tmpDir);
      const after = fs.readdirSync(tmpDir);
      expect(before).toEqual(after);
    });
  });

  describe('summarizeInventory', () => {
    it('returns a non-empty string', () => {
      const inv = inventoryDropzone('/nonexistent');
      const s = summarizeInventory(inv);
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    });
    it('includes classification in summary', () => {
      const inv = inventoryDropzone('/nonexistent');
      expect(summarizeInventory(inv)).toContain('SOURCE_NOT_PROVIDED');
    });
  });

  describe('No forbidden patterns', () => {
    it('source does not use Math.random()', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F33DropzoneInventoryUtils.ts'), 'utf8');
      expect(src).not.toMatch(/Math\.random\(\)/);
    });
    it('source does not use external npm imports', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F33DropzoneInventoryUtils.ts'), 'utf8');
      expect(src).not.toMatch(/^import\s+.*from\s+['"][^.]/m);
    });
    it('source does not write to DB', () => {
      const src = fs.readFileSync(path.join(__dirname, '../P26F33DropzoneInventoryUtils.ts'), 'utf8');
      expect(src).not.toMatch(/prisma\.(create|update|delete|upsert)/);
    });
  });
});
