#!/usr/bin/env node
// P26F3-3-HARDRESET: Drop-zone Inventory Script
// DISCLAIMER: Does not constitute investment advice.
// READ-ONLY. No DB write. No corpus write. No external API.

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DROPZONE = path.join(ROOT, 'data/manual/monthly-revenue/p26f3-2-dropzone');
const OUT = path.join(ROOT, 'outputs/online_validation');

const IGNORED_NAMES = ['README.md', 'EXPECTED_SCHEMA.json', '.gitkeep', '.gitignore', '.DS_Store'];
const CANDIDATE_EXTS = ['.csv', '.json', '.jsonl', '.ndjson'];

function detectFormat(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.csv') return 'csv';
  if (ext === '.json') return 'json';
  if (ext === '.jsonl' || ext === '.ndjson') return 'jsonl';
  return 'unknown';
}

function sha256File(fp) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex'); }
  catch { return 'UNREADABLE'; }
}

function suspectPeriod(name) {
  const m = name.match(/(\d{4})[_\-]?(0[1-9]|1[0-2])/);
  return m ? `${m[1]}-${m[2]}` : null;
}

const inv = {
  dropzonePath: DROPZONE,
  inventoriedAt: new Date().toISOString(),
  totalFiles: 0,
  candidateSourceFiles: 0,
  ignoredFiles: 0,
  unsupportedFiles: 0,
  supportedFormatCounts: { csv: 0, json: 0, jsonl: 0 },
  classification: 'SOURCE_NOT_PROVIDED',
  files: [],
  readOnly: true,
  dbWriteAllowed: false,
  corpusWriteAllowed: false,
};

if (fs.existsSync(DROPZONE)) {
  const names = fs.readdirSync(DROPZONE);
  inv.totalFiles = names.length;
  for (const name of names) {
    const fp = path.join(DROPZONE, name);
    let stat;
    try { stat = fs.statSync(fp); } catch { continue; }
    const ignored = name.startsWith('.') || IGNORED_NAMES.includes(name);
    const ext = path.extname(name).toLowerCase();
    const isCandidate = !ignored && CANDIDATE_EXTS.includes(ext);
    const format = detectFormat(name);
    const entry = {
      fileName: name, filePath: fp, format,
      isCandidate, isIgnored: ignored,
      fileSizeBytes: stat.size,
      sha256: sha256File(fp),
      mtimeMs: stat.mtimeMs,
      mtimeISO: new Date(stat.mtimeMs).toISOString(),
      suspectedPeriod: suspectPeriod(name),
    };
    inv.files.push(entry);
    if (ignored) inv.ignoredFiles++;
    else if (isCandidate) {
      inv.candidateSourceFiles++;
      if (format === 'csv') inv.supportedFormatCounts.csv++;
      else if (format === 'json') inv.supportedFormatCounts.json++;
      else if (format === 'jsonl') inv.supportedFormatCounts.jsonl++;
    } else inv.unsupportedFiles++;
  }
  if (inv.candidateSourceFiles > 0) inv.classification = 'SOURCE_FILES_PRESENT';
  else if (inv.unsupportedFiles > 0) inv.classification = 'UNSUPPORTED_FILES_ONLY';
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT,'p26f3_3_dropzone_inventory.json'), JSON.stringify(inv,null,2));
fs.writeFileSync(path.join(OUT,'p26f3_3_dropzone_inventory.md'),
  `# P26F3-3 Drop-zone Inventory\n\nInventoried: ${inv.inventoriedAt}\nTotal files: ${inv.totalFiles}\nCandidate source files: **${inv.candidateSourceFiles}**\nIgnored: ${inv.ignoredFiles} | Unsupported: ${inv.unsupportedFiles}\nFormat counts: CSV=${inv.supportedFormatCounts.csv} JSON=${inv.supportedFormatCounts.json} JSONL=${inv.supportedFormatCounts.jsonl}\nClassification: **${inv.classification}**\nDB write: false | Corpus write: false\n\n${inv.candidateSourceFiles === 0 ? '> Drop-zone has no source files. Place TWSE monthly revenue files and re-run.' : ''}\n`
);
console.log(`Drop-zone inventory: ${inv.classification}`);
console.log(`Candidate files: ${inv.candidateSourceFiles} | Total: ${inv.totalFiles}`);
