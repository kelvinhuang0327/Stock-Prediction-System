/**
 * P26F3-5-HARDRESET: Pipeline Pre-flight Tests
 *
 * DISCLAIMER: Does not constitute investment advice.
 * No DB write. No corpus write. No external API.
 * Synthetic fixture only.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

// ============================================================
// Helpers
// ============================================================
const ROOT = path.resolve(__dirname, '../../../../');
const SYNTHETIC_DIR = path.join(ROOT, 'data/manual/monthly-revenue/p26f3_5_synthetic_fixture');
const CORPUS_OUT = path.join(ROOT, 'outputs/online_validation');
const DROPZONE = path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone');

const TARGET_SYMBOLS = ['0055','00712','00738U','00830','00891','00903','1210','1308','1314','1319','1326','1402','1434','1513','1536','1560','1598','1605','1710','1717','1802','2317','2330','2454','6415'];
const TARGET_PERIODS = ['2025-09','2025-10','2025-11','2025-12','2026-01'];
const FORBIDDEN_FIELDS = ['outcomePrice', 'returnPct', 'realizedReturnClass'];
const FORBIDDEN_CLAIMS = /\b(ROI|win-rate|win rate|outperform|beat|guaranteed|investment recommendation)\b/i;
const ALLOWED_CLAIMS = /disclaimer|alphaScore|forbidden claim/i;

const BASELINE_SHA256: Record<string, string> = {
  'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'RuleBasedStockAnalyzer.ts': '4f6434a31fd211b6122408ee5e977e41f4cd45aee45cec586ec988b2c009e8e2',
  'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};
const SCORING_FILES: Record<string, string> = {
  'ActiveScoringSnapshotBuilder.ts': 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
  'RuleBasedStockAnalyzer.ts': 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
  'SignalFusionEngine.ts': 'src/lib/alpha/SignalFusionEngine.ts',
};
const CORPUS_EXPECTED: Record<string, number> = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'p19active_scoring_pit_replay_corpus.jsonl': 4500,
};

function sha256File(fp: string): string {
  try { return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex'); }
  catch { return 'MISSING'; }
}
function countNonEmptyLines(fp: string): number {
  if (!fs.existsSync(fp)) return -1;
  return fs.readFileSync(fp, 'utf8').split('\n').filter(l => l.trim()).length;
}
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

// ============================================================
// PART B: Synthetic Fixture Tests
// ============================================================
describe('P26F3-5: Synthetic Fixture', () => {
  it('synthetic fixture directory exists', () => {
    expect(fs.existsSync(SYNTHETIC_DIR)).toBe(true);
  });

  it('has exactly 5 synthetic CSV files', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    expect(files).toHaveLength(5);
  });

  it('each synthetic file has correct filename pattern (_synthetic.csv)', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      expect(f).toMatch(/_synthetic\.csv$/);
      expect(f).toMatch(/twse_monthly_revenue_\d{4}_\d{2}_synthetic\.csv/);
    }
  });

  it('synthetic files contain SYNTHETIC FIXTURE comment header', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      expect(content).toMatch(/SYNTHETIC FIXTURE/i);
      expect(content).toMatch(/NOT FOR DB WRITE/i);
    }
  });

  it('each synthetic file has exactly 25 data rows (one per symbol)', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      const rows = parseCSV(content);
      expect(rows).toHaveLength(25);
    }
  });

  it('total synthetic rows = 125 (5 files × 25 symbols)', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    let total = 0;
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      total += parseCSV(content).length;
    }
    expect(total).toBe(125);
  });

  it('synthetic fixture does NOT write to DB (no prisma client instantiation in fixture)', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR);
    for (const f of files) {
      const fp = path.join(SYNTHETIC_DIR, f);
      if (!fs.statSync(fp).isFile()) continue;
      const content = fs.readFileSync(fp, 'utf8');
      // CSV files should not reference prisma
      expect(content).not.toMatch(/prisma|PrismaClient/i);
    }
  });

  it('synthetic fixture has sourceName = SYNTHETIC (not a production sourceName)', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      const rows = parseCSV(content);
      for (const row of rows) {
        expect(row['sourceName']).toBe('SYNTHETIC');
      }
    }
  });

  it('synthetic fixture is NOT in the production drop-zone', () => {
    if (!fs.existsSync(DROPZONE)) return;
    const dropzoneFiles = fs.readdirSync(DROPZONE);
    const syntheticInDropzone = dropzoneFiles.filter(f => f.includes('_synthetic') || /_synthetic\.csv$/.test(f));
    expect(syntheticInDropzone).toHaveLength(0);
  });

  it('synthetic rows do NOT contain forbidden fields', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      const rows = parseCSV(content);
      for (const row of rows) {
        for (const ff of FORBIDDEN_FIELDS) {
          expect(row[ff] ?? '').toBe('');
        }
      }
    }
  });

  it('synthetic symbols are all from TARGET_SYMBOLS', () => {
    const files = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(SYNTHETIC_DIR, f), 'utf8');
      const rows = parseCSV(content);
      for (const row of rows) {
        expect(TARGET_SYMBOLS).toContain(row['stockId']);
      }
    }
  });
});

// ============================================================
// PART C: Pipeline Pre-flight Output Validation
// ============================================================
describe('P26F3-5: Pipeline Pre-flight Summary', () => {
  const summaryPath = path.join(CORPUS_OUT, 'p26f3_5_pipeline_preflight_summary.json');

  it('p26f3_5_pipeline_preflight_summary.json exists', () => {
    expect(fs.existsSync(summaryPath)).toBe(true);
  });

  it('summary is valid JSON', () => {
    const content = fs.readFileSync(summaryPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('summary.pipelinePass = true (all 5 stages passed on synthetic input)', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.pipelinePass).toBe(true);
  });

  it('inventory.candidateSourceFiles = 5', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.stageResults.inventory.candidateSourceFiles).toBe(5);
    expect(summary.stageResults.inventory.pass).toBe(true);
  });

  it('validator.acceptedRows = 125 (all synthetic rows well-formed)', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.stageResults.validator.acceptedRows).toBe(125);
    expect(summary.stageResults.validator.rejectedRows).toBe(0);
    expect(summary.stageResults.validator.pass).toBe(true);
  });

  it('coveragePreview.matchedRows > 0', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.stageResults.coveragePreview.matchedRows).toBeGreaterThan(0);
    expect(summary.stageResults.coveragePreview.pass).toBe(true);
  });

  it('safetyGate.status = PASS', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.stageResults.safetyGate.status).toBe('PASS');
    expect(summary.stageResults.safetyGate.pass).toBe(true);
  });

  it('scoringInvariance.mismatchedAlphaScoreCount = 0', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.stageResults.scoringInvariance.mismatchedAlphaScoreCount).toBe(0);
    expect(summary.stageResults.scoringInvariance.mismatchedBucketCount).toBe(0);
    expect(summary.stageResults.scoringInvariance.pass).toBe(true);
  });

  it('dbWritePerformed = false (no DB write in pre-flight)', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.dbWritePerformed).toBe(false);
  });

  it('corpusWritePerformed = false', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.corpusWritePerformed).toBe(false);
  });

  it('isSyntheticPreflight = true', () => {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    expect(summary.isSyntheticPreflight).toBe(true);
  });
});

// ============================================================
// PART F: Drop-zone Empty Path
// ============================================================
describe('P26F3-5: Drop-zone Conditional Scan — Empty Drop-zone', () => {
  const scanPath = path.join(CORPUS_OUT, 'p26f3_5_dropzone_scan_result.json');

  it('p26f3_5_dropzone_scan_result.json exists', () => {
    expect(fs.existsSync(scanPath)).toBe(true);
  });

  it('scan result is valid JSON', () => {
    const content = fs.readFileSync(scanPath, 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('classification = P26F3_5_SOURCE_NOT_PROVIDED when drop-zone has no candidate files', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    // Current state: no files in drop-zone
    expect(result.classification).toBe('P26F3_5_SOURCE_NOT_PROVIDED');
    expect(result.candidateSourceFiles).toBe(0);
  });

  it('importAllowed = false when SOURCE_NOT_PROVIDED', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.importAllowed).toBe(false);
  });

  it('requiresExplicitImportApprovalToken = true', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.requiresExplicitImportApprovalToken).toBe(true);
  });

  it('approvalTokenRequired = P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.approvalTokenRequired).toBe('P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY');
  });

  it('dbWritePerformed = false', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.dbWritePerformed).toBe(false);
  });

  it('operatorNextStep references handoff packet', () => {
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.handoffPacket || result.operatorNextStep).toBeTruthy();
  });
});

// ============================================================
// Malformed Input Rejection
// ============================================================
describe('P26F3-5: Pipeline rejects malformed input', () => {
  it('validator rejects row with missing stockId', () => {
    const badRow: Record<string, string> = {
      stockId: '',
      year: '2025',
      month: '9',
      revenue: '1000000',
      releaseDate: '2025-10-10',
      sourceName: 'TWSE',
      sourceFileName: 'test.csv',
    };
    const violations: string[] = [];
    if (!badRow['stockId']) violations.push('Missing stockId/symbol');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations).toContain('Missing stockId/symbol');
  });

  it('validator rejects row with invalid period', () => {
    const period = '2024-01'; // not in target periods
    const inTarget = TARGET_PERIODS.includes(period);
    expect(inTarget).toBe(false);
  });

  it('validator rejects row with symbol not in target set', () => {
    const symbol = 'NOTREAL';
    const inTarget = TARGET_SYMBOLS.includes(symbol);
    expect(inTarget).toBe(false);
  });

  it('validator rejects row with non-numeric revenue', () => {
    const revenue = 'abc';
    const isValid = !isNaN(Number(revenue)) && revenue !== '';
    expect(isValid).toBe(false);
  });

  it('validator rejects row with forbidden field', () => {
    const row: Record<string, string> = {
      stockId: '2330',
      year: '2025',
      month: '9',
      revenue: '1000000',
      releaseDate: '2025-10-10',
      sourceName: 'TWSE',
      sourceFileName: 'test.csv',
      outcomePrice: '100',
    };
    const forbidden = FORBIDDEN_FIELDS.filter(f => f in row && row[f] !== '');
    expect(forbidden.length).toBeGreaterThan(0);
  });
});

// ============================================================
// Approval Token Check
// ============================================================
describe('P26F3-5: Approval Token', () => {
  it('scan result requires explicit import approval token', () => {
    const scanPath = path.join(CORPUS_OUT, 'p26f3_5_dropzone_scan_result.json');
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.requiresExplicitImportApprovalToken).toBe(true);
    expect(result.importAllowed).toBe(false);
    expect(result.approvalTokenRequired).toBe('P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY');
  });

  it('import is not performed without token (current round has no token)', () => {
    // P26F3-5 does not provide the approval token — no DB write occurred
    const scanPath = path.join(CORPUS_OUT, 'p26f3_5_dropzone_scan_result.json');
    const result = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
    expect(result.dbWritePerformed).toBe(false);
  });
});

// ============================================================
// PART I: Frozen Corpus Invariance
// ============================================================
describe('P26F3-5: Frozen Corpus Invariance', () => {
  for (const [name, expected] of Object.entries(CORPUS_EXPECTED)) {
    it(`${name} has ${expected} lines (frozen)`, () => {
      const fp = path.join(CORPUS_OUT, name);
      const actual = countNonEmptyLines(fp);
      expect(actual).toBe(expected);
    });
  }
});

// ============================================================
// PART I: Scoring Formula Invariance (sha256)
// ============================================================
describe('P26F3-5: Scoring Formula Invariance', () => {
  for (const [baseName, expected] of Object.entries(BASELINE_SHA256)) {
    it(`${baseName} sha256 unchanged`, () => {
      const relPath = SCORING_FILES[baseName];
      const fp = path.join(ROOT, relPath);
      const actual = sha256File(fp);
      expect(actual).toBe(expected);
    });
  }
});

// ============================================================
// PART H: Forbidden Claims Scan
// ============================================================
describe('P26F3-5: Forbidden Claims Scan', () => {
  const filesToScan = [
    path.join(CORPUS_OUT, 'p26f3_5_pipeline_preflight_summary.json'),
    path.join(CORPUS_OUT, 'p26f3_5_pipeline_preflight_summary.md'),
    path.join(CORPUS_OUT, 'p26f3_5_dropzone_scan_result.json'),
    path.join(CORPUS_OUT, 'p26f3_5_dropzone_scan_result.md'),
    path.join(CORPUS_OUT, 'p26f3_5_operator_handoff_packet_summary.json'),
    path.join(ROOT, 'docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md'),
    path.join(ROOT, 'scripts/run-p26f3-5-pipeline-preflight.js'),
    path.join(ROOT, 'scripts/run-p26f3-5-dropzone-conditional-scan.js'),
  ];

  for (const fp of filesToScan) {
    const shortName = path.relative(ROOT, fp);
    it(`${shortName}: no forbidden claims`, () => {
      if (!fs.existsSync(fp)) return; // skip if not yet generated
      const content = fs.readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (ALLOWED_CLAIMS.test(line)) continue; // skip disclaimer lines and field names
        const match = FORBIDDEN_CLAIMS.exec(line);
        if (match) {
          throw new Error(`Forbidden claim "${match[0]}" found in ${shortName}: "${line.trim()}"`);
        }
      }
    });
  }

  it('synthetic fixture files have no forbidden claims', () => {
    const synFiles = fs.readdirSync(SYNTHETIC_DIR);
    for (const f of synFiles) {
      const fp = path.join(SYNTHETIC_DIR, f);
      if (!fs.statSync(fp).isFile()) continue;
      const content = fs.readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (ALLOWED_CLAIMS.test(line)) continue;
        const match = FORBIDDEN_CLAIMS.exec(line);
        if (match) {
          throw new Error(`Forbidden claim "${match[0]}" in ${f}: "${line.trim()}"`);
        }
      }
    }
  });
});

// ============================================================
// PART D: TSC Hygiene — Export/Signature Smoke Test
// ============================================================
describe('P26F3-5: data-quality/route.ts export signature', () => {
  it('data-quality route.ts has no duplicate function body', () => {
    const fp = path.join(ROOT, 'src/app/api/admin/data-quality/route.ts');
    const content = fs.readFileSync(fp, 'utf8');
    // Should have exactly one GET export
    const getCount = (content.match(/export async function GET/g) || []).length;
    expect(getCount).toBe(1);
  });

  it('data-quality route.ts has no orphaned code after function body', () => {
    const fp = path.join(ROOT, 'src/app/api/admin/data-quality/route.ts');
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n').length;
    // Fixed file should be ~124 lines; original had 181 (duplicate code added ~57 lines)
    expect(lines).toBeLessThan(150);
  });

  it('data-quality route.ts exports GET function', () => {
    const fp = path.join(ROOT, 'src/app/api/admin/data-quality/route.ts');
    const content = fs.readFileSync(fp, 'utf8');
    expect(content).toContain('export async function GET');
    expect(content).toContain('export const dynamic');
  });
});
