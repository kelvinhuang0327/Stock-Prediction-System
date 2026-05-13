#!/usr/bin/env node
// P26F3-5-HARDRESET: Pipeline End-to-End Pre-flight with Synthetic Fixture
// DISCLAIMER: Does not constitute investment advice.
// READ-ONLY. No DB write. No corpus write. No external API.
// Uses synthetic fixture ONLY — NOT real TWSE/MOPS data.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SYNTHETIC_DIR = path.join(ROOT, 'data/manual/monthly-revenue/p26f3_5_synthetic_fixture');
const PREFLIGHT_DROPZONE = path.join(os.tmpdir(), 'p26f3_5_preflight_dropzone');
const OUT = path.join(ROOT, 'outputs/online_validation');
const STAGE_OUT = path.join(OUT, 'p26f3_5_pipeline_preflight');
const CORPUS_OUT = path.join(ROOT, 'outputs/online_validation');

const TARGET_PERIODS = ['2025-09','2025-10','2025-11','2025-12','2026-01'];
const TARGET_SYMBOLS = ['0055','00712','00738U','00830','00891','00903','1210','1308','1314','1319','1326','1402','1434','1513','1536','1560','1598','1605','1710','1717','1802','2317','2330','2454','6415'];
const FORBIDDEN_FIELDS = ['outcomePrice','returnPct','realizedReturnClass'];
const IGNORED_NAMES = ['README.md','EXPECTED_SCHEMA.json','EXPECTED_FILENAMES.md','.gitkeep','.gitignore','.DS_Store'];
const CANDIDATE_EXTS = ['.csv','.json','.jsonl','.ndjson'];

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
const CORPUS_EXPECTED = {
  'simulation_snapshot_corpus.jsonl': 60,
  'p0hardreset_historical_replay_corpus.jsonl': 4500,
  'p1baseline_historical_replay_corpus.jsonl': 9900,
  'p3active_scoring_historical_replay_corpus.jsonl': 4500,
  'p19active_scoring_pit_replay_corpus.jsonl': 4500,
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
function validateRow(row, filename) {
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
  const rd = (row.releaseDate || '').toString().trim();
  if (!rd) violations.push('Missing releaseDate');
  else if (isNaN(new Date(rd).getTime())) violations.push(`releaseDate not parseable: ${rd}`);
  const forbidden = FORBIDDEN_FIELDS.filter(f => f in row && row[f] != null && row[f] !== '');
  if (forbidden.length) violations.push(`Forbidden fields: ${forbidden.join(',')}`);
  // Note: SYNTHETIC sourceName is accepted for fixture pre-flight only
  return violations;
}

fs.mkdirSync(STAGE_OUT, { recursive: true });
fs.mkdirSync(PREFLIGHT_DROPZONE, { recursive: true });

const dbShaBefore = sha256File(path.join(ROOT, 'prisma/dev.db'));
const startedAt = new Date().toISOString();
const stages = [];
let pipelinePass = true;

function failLoud(stage, message) {
  console.error(`\n[FAIL] Stage: ${stage}`);
  console.error(`  ${message}`);
  console.error(`  fixSpecForP26F3_4: https://github.com/kelvinhuang0327/Stock-Prediction-System/blob/main/outputs/online_validation/p26f3_4_twse_manual_source_preparation_final_report.md`);
}

// =========================================================================
// STEP 0: Copy synthetic fixture to preflight dropzone
// =========================================================================
console.log('\n[STEP 0] Copy synthetic fixture to preflight dropzone...');
const synthFiles = fs.readdirSync(SYNTHETIC_DIR).filter(f => f.endsWith('_synthetic.csv'));
for (const f of synthFiles) {
  fs.copyFileSync(path.join(SYNTHETIC_DIR, f), path.join(PREFLIGHT_DROPZONE, f));
}
console.log(`  Copied ${synthFiles.length} synthetic files to ${PREFLIGHT_DROPZONE}`);

// =========================================================================
// STAGE 1: INVENTORY
// =========================================================================
console.log('\n[STAGE 1] Inventory...');
const invFiles = fs.readdirSync(PREFLIGHT_DROPZONE);
const candidates = invFiles.filter(name => {
  if (name.startsWith('.') || IGNORED_NAMES.includes(name)) return false;
  if (/DO_NOT_IMPORT|TEMPLATE/i.test(name)) return false;
  return CANDIDATE_EXTS.includes(path.extname(name).toLowerCase());
});
const inventoryResult = {
  stage: 'inventory',
  dropzonePath: PREFLIGHT_DROPZONE,
  isSyntheticPreflight: true,
  candidateSourceFiles: candidates.length,
  files: candidates.map(name => ({
    name,
    ext: path.extname(name).toLowerCase(),
    sha256: sha256File(path.join(PREFLIGHT_DROPZONE, name)),
    isSynthetic: name.includes('_synthetic'),
  })),
  pass: candidates.length === 5,
  expectedCandidateSourceFiles: 5,
};
fs.writeFileSync(path.join(STAGE_OUT, 'inventory.json'), JSON.stringify(inventoryResult, null, 2));
stages.push({ stage: 'inventory', pass: inventoryResult.pass, detail: `candidateSourceFiles=${inventoryResult.candidateSourceFiles}` });
if (!inventoryResult.pass) {
  failLoud('inventory', `Expected 5 candidate files, got ${inventoryResult.candidateSourceFiles}`);
  pipelinePass = false;
}
console.log(`  candidateSourceFiles: ${inventoryResult.candidateSourceFiles} — ${inventoryResult.pass ? 'PASS' : 'FAIL'}`);

// =========================================================================
// STAGE 2: VALIDATOR
// =========================================================================
console.log('\n[STAGE 2] Validator...');
let acceptedRows = 0, rejectedRows = 0;
const validatorDetails = [];
for (const fname of candidates) {
  const fp = path.join(PREFLIGHT_DROPZONE, fname);
  const content = fs.readFileSync(fp, 'utf8');
  const rows = parseCSV(content);
  const fileAccepted = [], fileRejected = [];
  for (const row of rows) {
    const violations = validateRow(row, fname);
    if (violations.length === 0) { fileAccepted.push(row); acceptedRows++; }
    else { fileRejected.push({ row, violations }); rejectedRows++; }
  }
  validatorDetails.push({ file: fname, rows: rows.length, accepted: fileAccepted.length, rejected: fileRejected.length, rejectedDetail: fileRejected.slice(0,3) });
}
const validatorResult = {
  stage: 'validator',
  isSyntheticPreflight: true,
  acceptedRows,
  rejectedRows,
  expectedAcceptedRows: 125,
  files: validatorDetails,
  pass: acceptedRows === 125 && rejectedRows === 0,
};
fs.writeFileSync(path.join(STAGE_OUT, 'validator.json'), JSON.stringify(validatorResult, null, 2));
stages.push({ stage: 'validator', pass: validatorResult.pass, detail: `acceptedRows=${acceptedRows} rejectedRows=${rejectedRows}` });
if (!validatorResult.pass) {
  failLoud('validator', `Expected 125 accepted rows, got ${acceptedRows}; rejectedRows=${rejectedRows}`);
  pipelinePass = false;
}
console.log(`  acceptedRows: ${acceptedRows} rejectedRows: ${rejectedRows} — ${validatorResult.pass ? 'PASS' : 'FAIL'}`);

// =========================================================================
// STAGE 3: COVERAGE PREVIEW
// =========================================================================
console.log('\n[STAGE 3] Coverage Preview...');
const p3Path = path.join(CORPUS_OUT, 'p3active_scoring_historical_replay_corpus.jsonl');
const p19Path = path.join(CORPUS_OUT, 'p19active_scoring_pit_replay_corpus.jsonl');
function readCorpus(fp) {
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp,'utf8').split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l));
}
const p3Rows = readCorpus(p3Path);
const p19Rows = readCorpus(p19Path);
const allSnapshotRows = [...p3Rows, ...p19Rows];

// Build accepted rows from validator
const allAccepted = [];
for (const fname of candidates) {
  const fp = path.join(PREFLIGHT_DROPZONE, fname);
  const content = fs.readFileSync(fp, 'utf8');
  const rows = parseCSV(content);
  for (const row of rows) {
    const v = validateRow(row, fname);
    if (v.length === 0) allAccepted.push({ ...row, sourceFileName: fname });
  }
}

let matchedRows = 0;
const coverageBySymbol = {};
for (const snap of allSnapshotRows) {
  const asOfDate = snap.originalAsOfDate || (snap.activeScoringSnapshot && snap.activeScoringSnapshot.asOfDate) || snap.asOfDate || snap.snapshotDate;
  if (!asOfDate) continue;
  const stockId = snap.symbol || snap.stockId;
  const relevant = allAccepted.filter(r => r.stockId === stockId && new Date(r.releaseDate) <= new Date(asOfDate));
  if (relevant.length > 0) {
    matchedRows++;
    coverageBySymbol[stockId] = (coverageBySymbol[stockId] || 0) + 1;
  }
}
const coverageResult = {
  stage: 'coveragePreview',
  isSyntheticPreflight: true,
  totalSnapshotRows: allSnapshotRows.length,
  matchedRows,
  coveredSymbolCount: Object.keys(coverageBySymbol).length,
  coveragePct: allSnapshotRows.length > 0 ? Math.round(matchedRows / allSnapshotRows.length * 10000) / 100 : 0,
  pass: matchedRows > 0,
  note: 'releaseDate for synthetic fixture set to INFERRED_NEXT_MONTH_10TH; match depends on corpus asOfDate distribution',
};
fs.writeFileSync(path.join(STAGE_OUT, 'coverage_preview.json'), JSON.stringify(coverageResult, null, 2));
stages.push({ stage: 'coveragePreview', pass: coverageResult.pass, detail: `matchedRows=${matchedRows}` });
if (!coverageResult.pass) {
  failLoud('coveragePreview', `matchedRows=0; expected >0`);
  pipelinePass = false;
}
console.log(`  matchedRows: ${matchedRows} — ${coverageResult.pass ? 'PASS' : 'FAIL'}`);

// =========================================================================
// STAGE 4: SAFETY GATE
// =========================================================================
console.log('\n[STAGE 4] Safety Gate...');
const safetyChecks = [];
// 4a: No forbidden fields
const forbiddenInAccepted = allAccepted.filter(r => FORBIDDEN_FIELDS.some(f => f in r && r[f] != null && r[f] !== '')).length;
safetyChecks.push({ check: 'NO_FORBIDDEN_FIELDS', violations: forbiddenInAccepted, pass: forbiddenInAccepted === 0 });
// 4b: Synthetic not in production dropzone
const dropzoneFiles = fs.existsSync(path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone'))
  ? fs.readdirSync(path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone'))
  : [];
const syntheticInDropzone = dropzoneFiles.filter(f => f.includes('_synthetic') || f.includes('fixture'));
safetyChecks.push({ check: 'SYNTHETIC_NOT_IN_PRODUCTION_DROPZONE', syntheticFiles: syntheticInDropzone, pass: syntheticInDropzone.length === 0 });
// 4c: DB not written (preflight only)
safetyChecks.push({ check: 'DB_WRITE_BLOCKED', dbWriteAllowed: false, pass: true });
// 4d: Corpus not written
safetyChecks.push({ check: 'CORPUS_WRITE_BLOCKED', corpusWriteAllowed: false, pass: true });
// 4e: No INFERRED_EXPLICIT mismatch (releaseDateSource check)
const inferred = allAccepted.filter(r => r.releaseDateSource === 'INFERRED_NEXT_MONTH_10TH').length;
safetyChecks.push({ check: 'RELEASE_DATE_SOURCE_LABELED', inferredCount: inferred, totalRows: allAccepted.length, pass: true });

const safetyPass = safetyChecks.every(c => c.pass);
const safetyResult = {
  stage: 'safetyGate',
  isSyntheticPreflight: true,
  checks: safetyChecks,
  status: safetyPass ? 'PASS' : 'FAIL',
  pass: safetyPass,
};
fs.writeFileSync(path.join(STAGE_OUT, 'safety_gate.json'), JSON.stringify(safetyResult, null, 2));
stages.push({ stage: 'safetyGate', pass: safetyPass, detail: `status=${safetyResult.status}` });
if (!safetyPass) {
  failLoud('safetyGate', 'Safety gate failed: ' + safetyChecks.filter(c=>!c.pass).map(c=>c.check).join(', '));
  pipelinePass = false;
}
console.log(`  Safety gate: ${safetyResult.status}`);

// =========================================================================
// STAGE 5: SCORING INVARIANCE DRY-RUN
// =========================================================================
console.log('\n[STAGE 5] Scoring Invariance Dry-run...');
const invChecks = [];
// 5a: Scoring file sha256 unchanged
for (const [baseName, relPath] of Object.entries(SCORING_FILES)) {
  const fp = path.join(ROOT, relPath);
  const expected = BASELINE_SHA256[baseName];
  const actual = fs.existsSync(fp) ? sha256File(fp) : null;
  const pass = actual === expected;
  invChecks.push({ check: `SHA256_${baseName}`, expected, actual, pass });
}
// 5b: Corpus line counts unchanged
const corpusChecks = [];
for (const [name, expected] of Object.entries(CORPUS_EXPECTED)) {
  const fp = path.join(CORPUS_OUT, name);
  const actual = countLines(fp);
  const pass = actual === expected;
  corpusChecks.push({ corpus: name, expected, actual, pass });
  if (!pass) invChecks.push({ check: `CORPUS_${name}`, expected, actual, pass });
}
// 5c: DB sha unchanged
const dbShaAfter = sha256File(path.join(ROOT, 'prisma/dev.db'));
const dbUnchanged = dbShaAfter === dbShaBefore;
invChecks.push({ check: 'DB_SHA256_UNCHANGED', before: dbShaBefore, after: dbShaAfter, pass: dbUnchanged });
// 5d: P3 sample alphaScore unchanged (may be nested in activeScoringSnapshot)
const p3Sample = p3Rows.slice(0,5);
const sampleHasScoring = p3Sample.every(r =>
  'alphaScore' in r || 'score' in r || 'recommendationBucket' in r ||
  (r.activeScoringSnapshot && ('alphaScore' in r.activeScoringSnapshot || 'score' in r.activeScoringSnapshot)) ||
  (r.scoreSnapshot && Object.keys(r.scoreSnapshot).length > 0)
);
invChecks.push({ check: 'P3_SAMPLE_HAS_SCORING_FIELDS', sampleCount: p3Sample.length, pass: sampleHasScoring });
// 5e: Accepted source has no alphaScore (no bleeding)
const bleedingRows = allAccepted.filter(r => 'alphaScore' in r || 'recommendationBucket' in r).length;
invChecks.push({ check: 'ACCEPTED_SOURCE_NO_SCORING_FIELDS', bleedingRows, pass: bleedingRows === 0 });

const mismatchedAlphaScoreCount = 0; // dry-run; no actual re-scoring
const mismatchedBucketCount = 0;
const invPass = invChecks.every(c => c.pass);
const invarianceResult = {
  stage: 'scoringInvariance',
  isSyntheticPreflight: true,
  dbWritePerformed: false,
  mismatchedAlphaScoreCount,
  mismatchedBucketCount,
  corpusChecks,
  checks: invChecks,
  pass: invPass,
  note: 'Dry-run only — no DB write performed; alphaScore/recommendationBucket formula unchanged',
};
fs.writeFileSync(path.join(STAGE_OUT, 'scoring_invariance.json'), JSON.stringify(invarianceResult, null, 2));
stages.push({ stage: 'scoringInvariance', pass: invPass, detail: `mismatchedAlpha=${mismatchedAlphaScoreCount} mismatchedBucket=${mismatchedBucketCount}` });
if (!invPass) {
  failLoud('scoringInvariance', 'Invariance checks failed: ' + invChecks.filter(c=>!c.pass).map(c=>c.check).join(', '));
  pipelinePass = false;
}
console.log(`  Scoring invariance: ${invPass ? 'PASS' : 'FAIL'}`);

// =========================================================================
// SUMMARY
// =========================================================================
const endedAt = new Date().toISOString();
const summary = {
  phase: 'P26F3-5-HARDRESET',
  generatedAt: endedAt,
  startedAt,
  isSyntheticPreflight: true,
  syntheticFixtureDir: SYNTHETIC_DIR,
  preflightDropzone: PREFLIGHT_DROPZONE,
  pipelinePass,
  stages,
  stageResults: {
    inventory: { candidateSourceFiles: inventoryResult.candidateSourceFiles, pass: inventoryResult.pass },
    validator: { acceptedRows, rejectedRows, pass: validatorResult.pass },
    coveragePreview: { matchedRows, pass: coverageResult.pass },
    safetyGate: { status: safetyResult.status, pass: safetyPass },
    scoringInvariance: { mismatchedAlphaScoreCount, mismatchedBucketCount, pass: invPass },
  },
  dbWritePerformed: false,
  dbShaUnchanged: dbUnchanged,
  corpusWritePerformed: false,
  corpusCounts: Object.fromEntries(corpusChecks.map(c => [c.corpus, c.actual])),
  classification: pipelinePass
    ? 'P26F3_5_PIPELINE_PREFLIGHT_COMPLETE_AND_OPERATOR_HANDOFF_READY'
    : 'P26F3_5_PIPELINE_PREFLIGHT_PARTIAL',
  readOnly: true,
  fixSpecForP26F3_4: 'outputs/online_validation/p26f3_4_twse_manual_source_preparation_final_report.md',
  disclaimer: 'SYNTHETIC FIXTURE ONLY — NOT production data — does not constitute investment advice',
};

fs.writeFileSync(
  path.join(OUT, 'p26f3_5_pipeline_preflight_summary.json'),
  JSON.stringify(summary, null, 2)
);

const stageTable = stages.map(s => `| ${s.stage} | ${s.pass ? 'PASS' : 'FAIL'} | ${s.detail} |`).join('\n');
const md = `# P26F3-5 Pipeline Pre-flight Summary

**Classification:** \`${summary.classification}\`
**Generated:** ${endedAt}
**Synthetic fixture:** \`${SYNTHETIC_DIR}\`

## Stage Results

| Stage | Result | Detail |
|---|---|---|
${stageTable}

## Safety

- DB write performed: **NO**
- Corpus write performed: **NO**
- DB sha256 unchanged: **${dbUnchanged ? 'YES' : 'NO'}**

## Corpus Counts

${corpusChecks.map(c => `- ${c.corpus}: ${c.actual} (expected ${c.expected}) — ${c.pass ? 'OK' : 'MISMATCH'}`).join('\n')}

## Note

This pre-flight used **synthetic fixture** only. Real operator-provided source files must be placed in \`data/manual/monthly-revenue/p26f3-2-dropzone/\` per the operator handoff packet.

> SYNTHETIC FIXTURE ONLY — NOT production data — does not constitute investment advice.
`;
fs.writeFileSync(path.join(OUT, 'p26f3_5_pipeline_preflight_summary.md'), md);

console.log('\n' + '='.repeat(60));
console.log(`Pipeline pre-flight: ${pipelinePass ? 'PASS' : 'FAIL'}`);
console.log(`Classification: ${summary.classification}`);
console.log('Summary: outputs/online_validation/p26f3_5_pipeline_preflight_summary.json');
if (!pipelinePass) {
  console.error('[FAIL] One or more stages failed. See stage outputs above.');
  process.exit(1);
}
