#!/usr/bin/env node
// P26F3-5-HARDRESET: Drop-zone Conditional Scan
// DISCLAIMER: Does not constitute investment advice.
// READ-ONLY. No DB write. No corpus write. No external API. No import without explicit token.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DROPZONE = path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone');
const OUT = path.join(ROOT, 'outputs/online_validation');
const CORPUS_OUT = path.join(ROOT, 'outputs/online_validation');
const HANDOFF_PACKET = 'docs/manual-data/monthly-revenue/P26F3_5_OPERATOR_HANDOFF_PACKET.md';

const IGNORED_NAMES = ['README.md','EXPECTED_SCHEMA.json','EXPECTED_FILENAMES.md','TEMPLATE_DO_NOT_IMPORT_monthly_revenue.csv','.gitkeep','.gitignore','.DS_Store'];
const CANDIDATE_EXTS = ['.csv','.json','.jsonl','.ndjson'];
const TARGET_PERIODS = ['2025-09','2025-10','2025-11','2025-12','2026-01'];
const TARGET_SYMBOLS = ['0055','00712','00738U','00830','00891','00903','1210','1308','1314','1319','1326','1402','1434','1513','1536','1560','1598','1605','1710','1717','1802','2317','2330','2454','6415'];
const FORBIDDEN_FIELDS = ['outcomePrice','returnPct','realizedReturnClass'];
const ALLOWED_SOURCE_NAMES = ['TWSE','MOPS','OFFICIAL','MANUAL'];
const APPROVAL_TOKEN_REQUIRED = 'P26F4_APPROVE_HISTORICAL_MONTHLY_REVENUE_IMPORT_ONLY';

const BASELINE_SHA256 = {
  'ActiveScoringSnapshotBuilder.ts': '063a3bd524d20e9d0dfc847e342a93b36bd086bab042d9fde88282963156bf5d',
  'RuleBasedStockAnalyzer.ts': 'bc3716cc8e74be304f2e262aac586a61760bb59d6c95e82a575c38e03ea7373d',
  'SignalFusionEngine.ts': 'b8ce3fa3ae63fd7edf6b6067dd8ccea63c02741454b93792e87bfbc1e95d2bf4',
};
const SCORING_FILES = {
  'ActiveScoringSnapshotBuilder.ts': 'src/lib/onlineValidation/ActiveScoringSnapshotBuilder.ts',
  'RuleBasedStockAnalyzer.ts': 'src/lib/analysis/RuleBasedStockAnalyzer.ts',
  'SignalFusionEngine.ts': 'src/lib/alpha/SignalFusionEngine.ts',
};

function sha256File(fp) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex'); }
  catch { return 'UNREADABLE'; }
}
function countLines(fp) {
  if (!fs.existsSync(fp)) return -1;
  return fs.readFileSync(fp,'utf8').split('\n').filter(l => l.trim()).length;
}
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
    if (vals.length < headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j];
    rows.push(row);
  }
  return rows;
}
function parseFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') return { rows: parseCSV(content), error: null };
    if (ext === '.json') { const p = JSON.parse(content); return { rows: Array.isArray(p) ? p : [p], error: null }; }
    if (ext === '.jsonl' || ext === '.ndjson') return { rows: content.split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l)), error: null };
    return { rows: [], error: 'unknown_format' };
  } catch(e) { return { rows: [], error: e.message }; }
}
function validateRow(row) {
  const violations = [];
  const stockId = (row.stockId || row.symbol || '').toString().trim();
  if (!stockId) violations.push('Missing stockId/symbol');
  const year = Number(row.year), month = Number(row.month);
  if (isNaN(year) || isNaN(month)) violations.push('year/month not numeric');
  else {
    const period = `${year}-${String(month).padStart(2,'0')}`;
    if (!TARGET_PERIODS.includes(period)) violations.push(`Period ${period} not in target`);
    if (stockId && !TARGET_SYMBOLS.includes(stockId)) violations.push(`Symbol ${stockId} not in target`);
  }
  if (row.revenue === '' || row.revenue == null || isNaN(Number(row.revenue))) violations.push('revenue not numeric');
  const rd = (row.releaseDate || row.sourceReleaseDate || '').toString().trim();
  if (!rd) violations.push('Missing releaseDate');
  else if (isNaN(new Date(rd).getTime())) violations.push(`releaseDate not parseable: ${rd}`);
  if (!row.sourceName) violations.push('Missing sourceName');
  else if (!ALLOWED_SOURCE_NAMES.includes((row.sourceName || '').toUpperCase())) violations.push(`Invalid sourceName: ${row.sourceName}`);
  if (!row.sourceFileName) violations.push('Missing sourceFileName');
  const forbidden = FORBIDDEN_FIELDS.filter(f => f in row && row[f] != null && row[f] !== '');
  if (forbidden.length) violations.push(`Forbidden fields: ${forbidden.join(',')}`);
  return violations;
}

fs.mkdirSync(OUT, { recursive: true });
const scannedAt = new Date().toISOString();

// =========================================================================
// INVENTORY
// =========================================================================
if (!fs.existsSync(DROPZONE)) {
  const result = {
    phase: 'P26F3-5-HARDRESET',
    scannedAt,
    dropzonePath: DROPZONE,
    classification: 'P26F3_5_SOURCE_NOT_PROVIDED',
    candidateSourceFiles: 0,
    acceptedRows: 0,
    matchedRows: 0,
    requiresExplicitImportApprovalToken: true,
    approvalTokenRequired: APPROVAL_TOKEN_REQUIRED,
    importAllowed: false,
    dbWritePerformed: false,
    operatorNextStep: `Drop-zone directory does not exist. Create it and place TWSE source files there. See: ${HANDOFF_PACKET}`,
    handoffPacket: HANDOFF_PACKET,
    readOnly: true,
    disclaimer: 'Does not constitute investment advice.',
  };
  fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.md'), `# P26F3-5 Drop-zone Conditional Scan\n\n**Classification:** \`P26F3_5_SOURCE_NOT_PROVIDED\`\n\nDrop-zone directory does not exist.\nSee operator handoff packet: \`${HANDOFF_PACKET}\`\n`);
  console.log('Classification: P26F3_5_SOURCE_NOT_PROVIDED');
  console.log('Operator next step: Create drop-zone and place TWSE source files. See ' + HANDOFF_PACKET);
  process.exit(0);
}

const names = fs.readdirSync(DROPZONE);
const candidates = names.filter(name => {
  if (name.startsWith('.') || IGNORED_NAMES.includes(name)) return false;
  if (/DO_NOT_IMPORT|TEMPLATE|EXPECTED_SCHEMA|EXPECTED_FILENAMES/i.test(name)) return false;
  return CANDIDATE_EXTS.includes(path.extname(name).toLowerCase());
});

if (candidates.length === 0) {
  // SOURCE_NOT_PROVIDED path
  const result = {
    phase: 'P26F3-5-HARDRESET',
    scannedAt,
    dropzonePath: DROPZONE,
    classification: 'P26F3_5_SOURCE_NOT_PROVIDED',
    candidateSourceFiles: 0,
    totalFilesInDropzone: names.length,
    ignoredFiles: names.filter(n => IGNORED_NAMES.includes(n) || /DO_NOT_IMPORT|TEMPLATE|EXPECTED_SCHEMA|EXPECTED_FILENAMES/i.test(n)).length,
    acceptedRows: 0,
    matchedRows: 0,
    requiresExplicitImportApprovalToken: true,
    approvalTokenRequired: APPROVAL_TOKEN_REQUIRED,
    importAllowed: false,
    dbWritePerformed: false,
    operatorNextStep: `No candidate source files found in drop-zone. Download TWSE monthly revenue CSV files for 2025-09 through 2026-01 and place them in the drop-zone. See operator handoff packet: ${HANDOFF_PACKET}`,
    handoffPacket: HANDOFF_PACKET,
    readOnly: true,
    disclaimer: 'Does not constitute investment advice.',
  };
  fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.json'), JSON.stringify(result, null, 2));
  const md = `# P26F3-5 Drop-zone Conditional Scan

**Classification:** \`P26F3_5_SOURCE_NOT_PROVIDED\`
**Scanned at:** ${scannedAt}

## Status

No candidate source files found in drop-zone.

- Drop-zone path: \`${DROPZONE}\`
- Total files in drop-zone: ${names.length} (all are template/ignored files)
- Candidate source files: **0**

## Operator Next Step

1. Download TWSE monthly revenue CSV files for periods: **2025-09, 2025-10, 2025-11, 2025-12, 2026-01**
2. Place them in: \`${DROPZONE}\`
3. Re-run this scan: \`node scripts/run-p26f3-5-dropzone-conditional-scan.js\`
4. See full operator handoff packet: \`${HANDOFF_PACKET}\`

> Import requires explicit approval token: \`${APPROVAL_TOKEN_REQUIRED}\`
> DB write will NOT occur without this token.

> Does not constitute investment advice.
`;
  fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.md'), md);
  console.log('Classification: P26F3_5_SOURCE_NOT_PROVIDED');
  console.log('candidateSourceFiles: 0');
  console.log('Operator next step: Place TWSE source files in drop-zone. See ' + HANDOFF_PACKET);
  process.exit(0);
}

// =========================================================================
// FILES PRESENT PATH — run full pipeline scan (no import without token)
// =========================================================================
console.log(`candidateSourceFiles: ${candidates.length} — running full pipeline scan (NO import without token)`);

// VALIDATOR
let acceptedRows = 0, rejectedRows = 0;
const allAccepted = [], validatorFiles = [];
for (const fname of candidates) {
  const fp = path.join(DROPZONE, fname);
  const { rows, error } = parseFile(fp);
  if (error) { validatorFiles.push({ file: fname, error, accepted: 0, rejected: 0 }); continue; }
  const fileAccepted = [], fileRejected = [];
  for (const row of rows) {
    const violations = validateRow(row);
    if (violations.length === 0) { fileAccepted.push(row); acceptedRows++; }
    else { fileRejected.push({ stockId: row.stockId, violations }); rejectedRows++; }
  }
  allAccepted.push(...fileAccepted);
  validatorFiles.push({ file: fname, rows: rows.length, accepted: fileAccepted.length, rejected: fileRejected.length, rejectedSample: fileRejected.slice(0,3) });
}

// COVERAGE PREVIEW
function readCorpus(fp) {
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp,'utf8').split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l));
}
const p3Rows = readCorpus(path.join(CORPUS_OUT,'p3active_scoring_historical_replay_corpus.jsonl'));
const p19Rows = readCorpus(path.join(CORPUS_OUT,'p19active_scoring_pit_replay_corpus.jsonl'));
const allSnapshotRows = [...p3Rows,...p19Rows];
let matchedRows = 0;
for (const snap of allSnapshotRows) {
  const asOfDate = snap.originalAsOfDate || (snap.activeScoringSnapshot && snap.activeScoringSnapshot.asOfDate) || snap.asOfDate || snap.snapshotDate;
  if (!asOfDate) continue;
  const stockId = snap.symbol || snap.stockId;
  const relevant = allAccepted.filter(r => r.stockId === stockId && new Date(r.releaseDate||r.sourceReleaseDate) <= new Date(asOfDate));
  if (relevant.length > 0) matchedRows++;
}

// SAFETY GATE
const safetyChecks = [];
const forbiddenCount = allAccepted.filter(r => FORBIDDEN_FIELDS.some(f => f in r && r[f] != null)).length;
safetyChecks.push({ check: 'NO_FORBIDDEN_FIELDS', violations: forbiddenCount, pass: forbiddenCount === 0 });
const syntheticInBatch = allAccepted.filter(r => (r.sourceName||'').toUpperCase() === 'SYNTHETIC').length;
safetyChecks.push({ check: 'NO_SYNTHETIC_IN_PRODUCTION_DROPZONE', syntheticRows: syntheticInBatch, pass: syntheticInBatch === 0 });
safetyChecks.push({ check: 'DB_WRITE_BLOCKED', pass: true });
const safetyPass = safetyChecks.every(c => c.pass);

// SCORING INVARIANCE
const invChecks = [];
for (const [baseName, relPath] of Object.entries(SCORING_FILES)) {
  const fp = path.join(ROOT, relPath);
  const expected = BASELINE_SHA256[baseName];
  const actual = fs.existsSync(fp) ? sha256File(fp) : null;
  invChecks.push({ check: `SHA256_${baseName}`, pass: actual === expected });
}
const invPass = invChecks.every(c => c.pass);

const overallPass = safetyPass && invPass && acceptedRows >= 0;

const result = {
  phase: 'P26F3-5-HARDRESET',
  scannedAt,
  dropzonePath: DROPZONE,
  classification: overallPass ? 'P26F3_5_PIPELINE_PREFLIGHT_COMPLETE_OPERATOR_DROPPED_FILES_AWAITING_IMPORT_APPROVAL' : 'P26F3_5_PIPELINE_PREFLIGHT_PARTIAL',
  candidateSourceFiles: candidates.length,
  validator: { acceptedRows, rejectedRows, files: validatorFiles },
  coveragePreview: { matchedRows, totalSnapshotRows: allSnapshotRows.length },
  safetyGate: { pass: safetyPass, checks: safetyChecks },
  scoringInvariance: { pass: invPass, checks: invChecks },
  requiresExplicitImportApprovalToken: true,
  approvalTokenRequired: APPROVAL_TOKEN_REQUIRED,
  importAllowed: false,
  dbWritePerformed: false,
  dbWriteNote: 'DB write requires explicit approval token: ' + APPROVAL_TOKEN_REQUIRED + '. Not provided in P26F3-5.',
  operatorNextStep: 'Run P26F4 import gate with explicit approval token to import these files.',
  handoffPacket: HANDOFF_PACKET,
  readOnly: true,
  disclaimer: 'Does not constitute investment advice.',
};

fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.json'), JSON.stringify(result, null, 2));
const md = `# P26F3-5 Drop-zone Conditional Scan

**Classification:** \`${result.classification}\`
**Scanned at:** ${scannedAt}

## Inventory

- Candidate source files: **${candidates.length}**

## Validator

- Accepted rows: **${acceptedRows}**
- Rejected rows: **${rejectedRows}**

## Coverage Preview

- Matched snapshot rows: **${matchedRows}** / ${allSnapshotRows.length}

## Safety Gate

- Status: **${safetyPass ? 'PASS' : 'FAIL'}**

## Import Status

> **IMPORT NOT PERFORMED**
> Requires explicit approval token: \`${APPROVAL_TOKEN_REQUIRED}\`
> To proceed to import, run P26F4 with this token.

> Does not constitute investment advice.
`;
fs.writeFileSync(path.join(OUT, 'p26f3_5_dropzone_scan_result.md'), md);

console.log('Classification: ' + result.classification);
console.log('candidateSourceFiles: ' + candidates.length);
console.log('acceptedRows: ' + acceptedRows);
console.log('matchedRows: ' + matchedRows);
console.log('importAllowed: false (requires token: ' + APPROVAL_TOKEN_REQUIRED + ')');
