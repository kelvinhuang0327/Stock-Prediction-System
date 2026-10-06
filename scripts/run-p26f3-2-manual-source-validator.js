#!/usr/bin/env node
// P26F3-2-HARDRESET: Manual Source Validator Script
// DISCLAIMER: Does not constitute investment advice.
// No DB write. No corpus write. No scoring change. No external API.

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DROPZONE = path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone');
const OUT = path.join(ROOT, 'outputs/online_validation');

const P26F3_2_TARGET_PERIODS = ['2025-09','2025-10','2025-11','2025-12','2026-01'];
const P26F3_2_TARGET_SYMBOLS = ['0055','00712','00738U','00830','00891','00903','1210','1308','1314','1319','1326','1402','1434','1513','1536','1560','1598','1605','1710','1717','1802','2317','2330','2454','6415'];
const P26F3_2_FORBIDDEN_FIELDS = ['outcomePrice','returnPct','realizedReturnClass'];
const P26F3_2_ALLOWED_SOURCE_NAMES = ['TWSE','MOPS','OFFICIAL','MANUAL'];

function deterministicRowHash(stockId, year, month) {
  const key = `${stockId}:${year}:${month}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function detectFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.json') return 'json';
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
  return 'unknown';
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
    if (vals.length !== headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j];
    rows.push(row);
  }
  return rows;
}

function parseFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fmt = detectFormat(filePath);
    if (fmt === 'csv') return { rows: parseCSV(content), error: null };
    if (fmt === 'json') { const p = JSON.parse(content); return { rows: Array.isArray(p) ? p : [p], error: null }; }
    if (fmt === 'jsonl') return { rows: content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)), error: null };
    return { rows: [], error: 'unknown_format' };
  } catch(e) { return { rows: [], error: e.message }; }
}

function validateRow(row) {
  const violations = [];
  const stockId = (row.stockId || row.symbol || '').toString().trim();
  if (!stockId) violations.push('Missing stockId/symbol');
  const year = Number(row.year), month = Number(row.month);
  if (isNaN(year) || isNaN(month)) violations.push('year/month not numeric');
  const period = `${year}-${String(month).padStart(2,'0')}`;
  if (!P26F3_2_TARGET_PERIODS.includes(period)) violations.push(`Period ${period} not in target`);
  if (stockId && !P26F3_2_TARGET_SYMBOLS.includes(stockId)) violations.push(`Symbol ${stockId} not in target`);
  if (isNaN(Number(row.revenue)) || row.revenue === '' || row.revenue == null) violations.push('revenue not numeric');
  const rd = (row.releaseDate || row.sourceReleaseDate || '').toString().trim();
  if (!rd) violations.push('Missing releaseDate');
  else if (isNaN(new Date(rd).getTime())) violations.push(`releaseDate not parseable: ${rd}`);
  if (!row.sourceName) violations.push('Missing sourceName');
  else if (!P26F3_2_ALLOWED_SOURCE_NAMES.includes(row.sourceName.toUpperCase())) violations.push(`Invalid sourceName: ${row.sourceName}`);
  if (!row.sourceFileName) violations.push('Missing sourceFileName');
  const forbidden = P26F3_2_FORBIDDEN_FIELDS.filter(f => f in row && row[f] != null);
  if (forbidden.length) violations.push(`Forbidden fields: ${forbidden.join(',')}`);
  if (violations.length > 0) return { valid: false, violations };
  return {
    valid: true, violations: [],
    accepted: {
      stockId, year, month, period, revenue: Number(row.revenue), releaseDate: rd,
      sourceName: row.sourceName.toUpperCase(), sourceFileName: row.sourceFileName,
      dryRunOnly: true, dbWriteAllowed: false, corpusWriteAllowed: false,
      rowHash: deterministicRowHash(stockId, year, month),
      normalizedAt: new Date().toISOString(),
    }
  };
}

// Scan dropzone
const scanResults = { dropzonePath: DROPZONE, scannedAt: new Date().toISOString(), files: [], totalRows: 0, acceptedRows: [], rejectedRows: 0 };

let files = [];
if (fs.existsSync(DROPZONE)) {
  files = fs.readdirSync(DROPZONE).filter(f => {
    if (f.startsWith('.') || f === 'README.md' || f === 'EXPECTED_SCHEMA.json') return false;
    return ['.csv','.json','.jsonl','.ndjson'].includes(path.extname(f).toLowerCase());
  });
}

let classification = 'P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY';
let totalAccepted = [];
let totalRejected = 0;

if (files.length > 0) {
  let anyForbidden = false, anyError = false, anyUnknown = false;
  for (const f of files) {
    const fp = path.join(DROPZONE, f);
    const fmt = detectFormat(fp);
    const { rows, error } = parseFile(fp);
    const fileResult = { fileName: f, format: fmt, rowCount: rows.length, parseStatus: error ? 'error' : rows.length === 0 ? 'empty' : 'ok', parseError: error, accepted: [], rejected: [] };
    for (const row of rows) {
      const res = validateRow(row);
      if (res.valid) fileResult.accepted.push(res.accepted);
      else { fileResult.rejected.push({ row, violations: res.violations }); totalRejected++; }
    }
    const forbidden = fileResult.accepted.some(r => P26F3_2_FORBIDDEN_FIELDS.some(f2 => f2 in r && r[f2] != null));
    if (forbidden) anyForbidden = true;
    if (error) anyError = true;
    if (fmt === 'unknown') anyUnknown = true;
    totalAccepted = totalAccepted.concat(fileResult.accepted);
    scanResults.files.push(fileResult);
    scanResults.totalRows += rows.length;
  }
  if (anyForbidden || anyError || anyUnknown) classification = 'P26F3_2_SOURCE_FILES_REJECTED';
  else if (totalAccepted.length > 0) classification = 'P26F3_2_MANUAL_SOURCE_ACCEPTED_DRY_RUN';
}

// Dedup
const dedupMap = new Map();
for (const r of totalAccepted) dedupMap.set(`${r.stockId}:${r.year}:${r.month}`, r);
const dedupedAccepted = Array.from(dedupMap.values());

const scanJSON = { ...scanResults, classification, acceptedRows: dedupedAccepted.length, rejectedRows: totalRejected, readOnly: true, dbWriteAllowed: false, corpusWriteAllowed: false };
const acceptanceJSON = { generatedAt: new Date().toISOString(), classification, acceptedRows: dedupedAccepted.length, rejectedRows: totalRejected, readyForP26F4: dedupedAccepted.length > 0, dbWriteAllowed: false, corpusWriteAllowed: false, rows: dedupedAccepted };
const manifestJSON = { generatedAt: new Date().toISOString(), acceptedRows: dedupedAccepted.length, classification, readyForP26F4: dedupedAccepted.length > 0, dryRunContract: { dbWriteAllowed: false, corpusWriteAllowed: false, scoringChangeAllowed: false }, rows: dedupedAccepted };

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_scan.json'), JSON.stringify(scanJSON,null,2));
fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_acceptance.json'), JSON.stringify(acceptanceJSON,null,2));
fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_manifest.json'), JSON.stringify(manifestJSON,null,2));

const scanMD = `# P26F3-2 Manual Source Scan\n\nScanned: ${scanResults.scannedAt}\nFiles: ${files.length}\nTotal rows: ${scanResults.totalRows}\nAccepted: ${dedupedAccepted.length}\nRejected: ${totalRejected}\nClassification: **${classification}**\n\n${classification === 'P26F3_2_SOURCE_NOT_PROVIDED_PACKAGE_READY' ? '> Drop-zone is empty. Place TWSE files and re-run.' : ''}\n`;
const acceptanceMD = `# P26F3-2 Manual Source Acceptance\n\nAccepted: ${dedupedAccepted.length} | Rejected: ${totalRejected}\nClassification: **${classification}**\nReady for P26F4: ${dedupedAccepted.length > 0}\nDB write: false | Corpus write: false\n`;
const manifestMD = `# P26F3-2 Manual Source Manifest\n\nAccepted rows: ${dedupedAccepted.length}\nClassification: **${classification}**\nAll rows dryRunOnly: true | dbWriteAllowed: false\n`;

fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_scan.md'), scanMD);
fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_acceptance.md'), acceptanceMD);
fs.writeFileSync(path.join(OUT,'p26f3_2_manual_source_manifest.md'), manifestMD);

console.log('P26F3-2 Manual Source Validator complete');
console.log(`Classification: ${classification}`);
console.log(`Accepted: ${dedupedAccepted.length} | Rejected: ${totalRejected}`);
console.log('DB write: false | Corpus write: false');
